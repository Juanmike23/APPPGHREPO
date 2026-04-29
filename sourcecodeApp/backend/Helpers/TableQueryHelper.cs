/*
 * PGH-DOC
 * File: Helpers/TableQueryHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika bantu bersama agar kode fitur tetap konsisten.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using PGH.Dtos.Common;
using PGH.Dtos.Human;

namespace PGH.Helpers
{
    public static class TableQueryHelper
    {
        public const int DefaultPageSize = HumanResourceQueryHelper.DefaultPageSize;
        public const int MaxPageSize = HumanResourceQueryHelper.MaxPageSize;

        public static async Task<TableQueryResponse> ExecuteAsync<T>(
            IQueryable<T> sourceQuery,
            TableQueryRequest? request,
            TableQuerySchema schema,
            CancellationToken cancellationToken = default)
        {
            var legacyResponse = await HumanResourceQueryHelper.ExecuteAsync(
                sourceQuery,
                ToLegacyRequest(request),
                schema.ToLegacySchema(),
                cancellationToken);

            return ToGenericResponse(legacyResponse);
        }

        public static TableQueryResponse Execute<T>(
            IEnumerable<T> sourceRows,
            TableQueryRequest? request,
            TableQuerySchema schema)
        {
            var legacyResponse = HumanResourceQueryHelper.Execute(
                sourceRows,
                ToLegacyRequest(request),
                schema.ToLegacySchema());

            return ToGenericResponse(legacyResponse);
        }

        private static HumanResourceQueryRequest ToLegacyRequest(TableQueryRequest? request)
        {
            request ??= new TableQueryRequest();

            return new HumanResourceQueryRequest
            {
                Page = request.Page,
                PageSize = request.PageSize,
                FocusId = request.FocusId,
                Filters = (request.Filters ?? [])
                    .Select(filter => new HumanResourceFilterRequest
                    {
                        Column = filter.Column,
                        Operator = filter.Operator,
                        Value = filter.Value
                    })
                    .ToList(),
                Mode = request.Mode,
                Sort = request.Sort == null
                    ? null
                    : new HumanResourceSortRequest
                    {
                        Column = request.Sort.Column,
                        Direction = request.Sort.Direction
                    },
                Distinct = request.Distinct == null
                    ? null
                    : new HumanResourceDistinctRequest
                    {
                        Column = request.Distinct.Column
                    },
                Search = request.Search,
                SearchColumns = request.SearchColumns,
                PriorityTopNullColumn = request.PriorityTopNullColumn,
                PriorityBottomIds = request.PriorityBottomIds
            };
        }

        private static TableQueryResponse ToGenericResponse(HumanResourceQueryResponse response)
        {
            return new TableQueryResponse
            {
                Rows = response.Rows ?? [],
                Page = response.Page,
                PageSize = response.PageSize,
                TotalCount = response.TotalCount,
                TotalPages = response.TotalPages,
                HasPreviousPage = response.HasPreviousPage,
                HasNextPage = response.HasNextPage
            };
        }
    }

    public sealed class TableQuerySchema
    {
        public TableQuerySchema(
            IReadOnlyList<string> displayColumns,
            IReadOnlySet<string> filterableColumns,
            IReadOnlySet<string> searchableColumns,
            IReadOnlySet<string> sortableColumns)
        {
            DisplayColumns = displayColumns;
            FilterableColumns = filterableColumns;
            SearchableColumns = searchableColumns;
            SortableColumns = sortableColumns;
            CanonicalMap = BuildCanonicalMap(
                displayColumns,
                filterableColumns,
                searchableColumns,
                sortableColumns);
        }

        public IReadOnlyList<string> DisplayColumns { get; }
        public IReadOnlySet<string> FilterableColumns { get; }
        public IReadOnlySet<string> SearchableColumns { get; }
        public IReadOnlySet<string> SortableColumns { get; }
        public IReadOnlyDictionary<string, string> CanonicalMap { get; }

        internal HumanResourceQuerySchema ToLegacySchema()
        {
            return new HumanResourceQuerySchema(
                DisplayColumns,
                FilterableColumns,
                SearchableColumns,
                SortableColumns,
                DisplayColumns.ToDictionary(
                    column => column,
                    column => column,
                    StringComparer.OrdinalIgnoreCase));
        }

        private static IReadOnlyDictionary<string, string> BuildCanonicalMap(
            IReadOnlyList<string> displayColumns,
            IReadOnlySet<string> filterableColumns,
            IReadOnlySet<string> searchableColumns,
            IReadOnlySet<string> sortableColumns)
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var key in displayColumns) keys.Add(key);
            foreach (var key in filterableColumns) keys.Add(key);
            foreach (var key in searchableColumns) keys.Add(key);
            foreach (var key in sortableColumns) keys.Add(key);

            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var key in keys)
            {
                map[key] = key;
            }

            map["Created At"] = "CreatedAt";
            map["Updated At"] = "UpdatedAt";
            return map;
        }
    }
}
