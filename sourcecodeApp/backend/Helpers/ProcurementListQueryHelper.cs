/*
 * PGH-DOC
 * File: Helpers/ProcurementListQueryHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika bantu bersama agar kode fitur tetap konsisten.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Globalization;
using System.Linq.Expressions;
using System.Reflection;
using PGH.Dtos.Common;
using PGH.Dtos.Procurement;

namespace PGH.Helpers
{
    public static class ProcurementListQueryHelper
    {
        public const int DefaultPageSize = 25;
        public const int MaxPageSize = 100;

        public static readonly IReadOnlyList<string> SharedDisplayColumns =
        [
            "Status_Pengadaan",
            "project_id",
            "Department",
            "PIC",
            "Vendor",
            "TipePengadaan",
            "Perjanjian",
            "NilaiPengajuanAPS",
            "NilaiApproveSTA",
            "NilaiKontrak",
            "JenisAnggaran",
            "NoPKS",
            "TglPKS",
            "NoSPK",
            "TglSPK",
            "WaktuMulai",
            "JatuhTempo",
            "PICPFA",
            "TglKirimkePFA",
            "Keterangan",
            "SisaBulan"
        ];

        public static readonly IReadOnlyList<string> AllDisplayColumns =
            ["Source", .. SharedDisplayColumns];

        private static readonly string[] SearchableColumns =
        [
            "Source",
            "project_id",
            "Department",
            "PIC",
            "Vendor",
            "TipePengadaan",
            "Perjanjian",
            "NilaiPengajuanAPS",
            "NilaiApproveSTA",
            "Status_Pengadaan",
            "TglKirimkePFA",
            "Keterangan",
            "PICPFA",
            "JenisAnggaran",
            "NilaiKontrak",
            "NoPKS",
            "NoSPK"
        ];

        private static readonly string[] FilterableColumns =
        [
            "Id",
            "Source",
            "project_id",
            "Department",
            "PIC",
            "Vendor",
            "TipePengadaan",
            "Perjanjian",
            "NilaiPengajuanAPS",
            "NilaiApproveSTA",
            "Status_Pengadaan",
            "TglKirimkePFA",
            "Keterangan",
            "PICPFA",
            "JenisAnggaran",
            "NilaiKontrak",
            "NoPKS",
            "TglPKS",
            "NoSPK",
            "TglSPK",
            "WaktuMulai",
            "JatuhTempo",
            "SisaBulan"
        ];

        private static readonly string[] SortableColumns =
        [
            "Id",
            "Source",
            "project_id",
            "Department",
            "PIC",
            "Vendor",
            "TipePengadaan",
            "Perjanjian",
            "NilaiPengajuanAPS",
            "NilaiApproveSTA",
            "Status_Pengadaan",
            "TglKirimkePFA",
            "Keterangan",
            "PICPFA",
            "JenisAnggaran",
            "NilaiKontrak",
            "NoPKS",
            "TglPKS",
            "NoSPK",
            "TglSPK",
            "WaktuMulai",
            "JatuhTempo",
            "SisaBulan",
            "CreatedAt",
            "UpdatedAt"
        ];

        private static readonly Dictionary<string, string> CanonicalColumnMap =
            BuildCanonicalColumnMap();

        private static readonly StringComparer ColumnComparer = StringComparer.OrdinalIgnoreCase;
        private static readonly ConcurrentDictionary<(Type Type, string Column), PropertyInfo?> PropertyCache = new();
        private static readonly ConcurrentDictionary<(Type Type, string Column), Func<object, object?>> ValueAccessorCache = new();

        public static async Task<ProcurementListQueryResponse> ExecuteAsync<T>(
            IQueryable<T> sourceQuery,
            ProcurementListQueryRequest? request,
            IReadOnlyCollection<string> displayColumns,
            CancellationToken cancellationToken = default)
        {
            request ??= new ProcurementListQueryRequest();
            sourceQuery ??= Enumerable.Empty<T>().AsQueryable();

            var schema = BuildTableQuerySchema(displayColumns);
            var globalRequest = BuildTableQueryRequest(request, schema);

            var response = await TableQueryHelper.ExecuteAsync(
                sourceQuery,
                globalRequest,
                schema,
                cancellationToken);

            return ToProcurementResponse(response);
        }

        public static ProcurementListQueryResponse Execute<T>(
            IEnumerable<T> sourceRows,
            ProcurementListQueryRequest? request,
            IReadOnlyCollection<string> displayColumns)
        {
            request ??= new ProcurementListQueryRequest();
            sourceRows ??= [];

            var schema = BuildTableQuerySchema(displayColumns);
            var globalRequest = BuildTableQueryRequest(request, schema);
            var response = TableQueryHelper.Execute(sourceRows, globalRequest, schema);
            return ToProcurementResponse(response);
        }

        private static TableQuerySchema BuildTableQuerySchema(IReadOnlyCollection<string> displayColumns)
        {
            var normalizedDisplayColumns = (displayColumns ?? [])
                .Select(NormalizeColumnKey)
                .Where(column => !string.IsNullOrWhiteSpace(column))
                .Select(column => column!)
                .Distinct(ColumnComparer)
                .ToList();

            if (normalizedDisplayColumns.Count == 0)
            {
                normalizedDisplayColumns = SharedDisplayColumns
                    .Select(NormalizeColumnKey)
                    .Where(column => !string.IsNullOrWhiteSpace(column))
                    .Select(column => column!)
                    .Distinct(ColumnComparer)
                    .ToList();
            }

            var filterableColumns = new HashSet<string>(
                normalizedDisplayColumns
                    .Where(column => FilterableColumns.Contains(column, ColumnComparer)),
                ColumnComparer);
            filterableColumns.Add("Id");
            filterableColumns.Add("CreatedAt");
            filterableColumns.Add("UpdatedAt");

            var searchableColumns = new HashSet<string>(
                normalizedDisplayColumns
                    .Where(column => SearchableColumns.Contains(column, ColumnComparer)),
                ColumnComparer);

            var sortableColumns = new HashSet<string>(
                normalizedDisplayColumns
                    .Where(column => SortableColumns.Contains(column, ColumnComparer)),
                ColumnComparer);
            sortableColumns.Add("Id");
            sortableColumns.Add("CreatedAt");
            sortableColumns.Add("UpdatedAt");

            return new TableQuerySchema(
                normalizedDisplayColumns,
                filterableColumns,
                searchableColumns,
                sortableColumns);
        }

        private static TableQueryRequest BuildTableQueryRequest(
            ProcurementListQueryRequest request,
            TableQuerySchema schema)
        {
            var filters = (request.Filters ?? [])
                .Select(filter =>
                {
                    var canonical = NormalizeColumnKey(filter?.Column);
                    if (string.IsNullOrWhiteSpace(canonical) ||
                        !schema.FilterableColumns.Contains(canonical))
                    {
                        return null;
                    }

                    return new TableFilterRequest
                    {
                        Column = canonical,
                        Operator = string.IsNullOrWhiteSpace(filter?.Operator)
                            ? "="
                            : filter!.Operator!.Trim(),
                        Value = filter?.Value ?? string.Empty
                    };
                })
                .Where(filter => filter != null)
                .Cast<TableFilterRequest>()
                .ToList();

            var sortColumn = NormalizeColumnKey(request.Sort?.Column);
            var sort = !string.IsNullOrWhiteSpace(sortColumn) &&
                       schema.SortableColumns.Contains(sortColumn)
                ? new TableSortRequest
                {
                    Column = sortColumn,
                    Direction = request.Sort?.Direction
                }
                : null;

            var distinctColumn = NormalizeColumnKey(request.Distinct?.Column);
            var distinct = !string.IsNullOrWhiteSpace(distinctColumn) &&
                           schema.FilterableColumns.Contains(distinctColumn)
                ? new TableDistinctRequest
                {
                    Column = distinctColumn
                }
                : null;

            var searchColumns = (request.SearchColumns ?? [])
                .Select(NormalizeColumnKey)
                .Where(column =>
                    !string.IsNullOrWhiteSpace(column) &&
                    schema.SearchableColumns.Contains(column!))
                .Select(column => column!)
                .Distinct(ColumnComparer)
                .ToList();

            var priorityTopNullColumn = NormalizeColumnKey(request.PriorityTopNullColumn);
            if (string.IsNullOrWhiteSpace(priorityTopNullColumn) ||
                !schema.SortableColumns.Contains(priorityTopNullColumn))
            {
                priorityTopNullColumn = null;
            }

            var priorityBottomIds = (request.PriorityBottomIds ?? [])
                .Where(value => value > 0)
                .Distinct()
                .ToList();

            return new TableQueryRequest
            {
                Page = request.Page,
                PageSize = request.PageSize,
                FocusId = request.FocusId,
                Filters = filters,
                Mode = request.Mode,
                Sort = sort,
                Distinct = distinct,
                Search = request.Search,
                SearchColumns = searchColumns,
                PriorityTopNullColumn = priorityTopNullColumn,
                PriorityBottomIds = priorityBottomIds
            };
        }

        private static ProcurementListQueryResponse ToProcurementResponse(TableQueryResponse response)
        {
            return new ProcurementListQueryResponse
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

        private static bool TryApplyFiltersToQueryable<T>(
            IQueryable<T> source,
            IEnumerable<ProcurementListFilterRequest> filters,
            string? mode,
            out IQueryable<T> query)
        {
            query = source;

            var normalizedFilters = filters
                .Select(filter => new
                {
                    Column = NormalizeColumnKey(filter?.Column),
                    Operator = string.IsNullOrWhiteSpace(filter?.Operator) ? "=" : filter!.Operator!.Trim(),
                    Value = filter?.Value ?? string.Empty
                })
                .Where(filter => filter.Column != null && FilterableColumns.Contains(filter.Column, ColumnComparer))
                .ToList();

            if (normalizedFilters.Count == 0)
            {
                return true;
            }

            var parameter = Expression.Parameter(typeof(T), "row");
            Expression? combined = null;
            var useOr = string.Equals(mode, "or", StringComparison.OrdinalIgnoreCase);

            foreach (var filter in normalizedFilters)
            {
                var property = ResolvePropertyInfo(typeof(T), filter.Column!);
                if (property == null)
                {
                    return false;
                }

                if (!TryBuildFilterExpression(parameter, property, filter.Operator, filter.Value, out var condition) ||
                    condition == null)
                {
                    return false;
                }

                combined = combined == null
                    ? condition
                    : useOr
                        ? Expression.OrElse(combined, condition)
                        : Expression.AndAlso(combined, condition);
            }

            if (combined == null)
            {
                return true;
            }

            var predicate = Expression.Lambda<Func<T, bool>>(combined, parameter);
            query = source.Where(predicate);
            return true;
        }

        private static bool TryApplySearchToQueryable<T>(
            IQueryable<T> source,
            string? rawSearch,
            IEnumerable<string>? rawSearchColumns,
            IReadOnlyCollection<string> displayColumns,
            out IQueryable<T> query)
        {
            query = source;

            var normalizedSearch = (rawSearch ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedSearch))
            {
                return true;
            }

            var searchColumns = (rawSearchColumns ?? [])
                .Select(NormalizeColumnKey)
                .Where(column => column != null && SearchableColumns.Contains(column, ColumnComparer))
                .Distinct(ColumnComparer)
                .ToList();

            if (searchColumns.Count == 0)
            {
                searchColumns = displayColumns
                    .Select(NormalizeColumnKey)
                    .Where(column => column != null && SearchableColumns.Contains(column, ColumnComparer))
                    .Distinct(ColumnComparer)
                    .ToList();
            }

            var parameter = Expression.Parameter(typeof(T), "row");
            Expression? combined = null;
            foreach (var searchColumn in searchColumns)
            {
                var property = ResolvePropertyInfo(typeof(T), searchColumn!);
                if (property == null || property.PropertyType != typeof(string))
                {
                    continue;
                }

                var propertyExpr = Expression.Property(parameter, property);
                var notNullExpr = Expression.NotEqual(
                    propertyExpr,
                    Expression.Constant(null, typeof(string)));
                var containsExpr = Expression.Call(
                    propertyExpr,
                    typeof(string).GetMethod(nameof(string.Contains), [typeof(string)])!,
                    Expression.Constant(normalizedSearch));
                var finalExpr = Expression.AndAlso(notNullExpr, containsExpr);
                combined = combined == null
                    ? finalExpr
                    : Expression.OrElse(combined, finalExpr);
            }

            if (combined == null)
            {
                return false;
            }

            var predicate = Expression.Lambda<Func<T, bool>>(combined, parameter);
            query = source.Where(predicate);
            return true;
        }

        private static bool TryApplySortToQueryable<T>(
            IQueryable<T> source,
            ProcurementListSortRequest? sort,
            out IQueryable<T> query)
        {
            query = source;
            var sortColumn = NormalizeColumnKey(sort?.Column);
            if (string.IsNullOrWhiteSpace(sortColumn) || !SortableColumns.Contains(sortColumn, ColumnComparer))
            {
                return true;
            }

            var property = ResolvePropertyInfo(typeof(T), sortColumn);
            if (property == null)
            {
                return false;
            }

            var descending = string.Equals(sort?.Direction, "desc", StringComparison.OrdinalIgnoreCase);
            query = ApplyQueryableOrder(source, property, descending);
            return true;
        }

        private static IQueryable<T> ApplyQueryableOrder<T>(
            IQueryable<T> source,
            PropertyInfo property,
            bool descending)
        {
            var parameter = Expression.Parameter(typeof(T), "row");
            var propertyExpr = Expression.Property(parameter, property);
            var keySelector = Expression.Lambda(propertyExpr, parameter);

            var methodName = descending ? nameof(Queryable.OrderByDescending) : nameof(Queryable.OrderBy);
            var method = typeof(Queryable)
                .GetMethods(BindingFlags.Public | BindingFlags.Static)
                .First(candidate =>
                    candidate.Name == methodName &&
                    candidate.GetParameters().Length == 2);
            var generic = method.MakeGenericMethod(typeof(T), property.PropertyType);
            var ordered = generic.Invoke(null, [source, keySelector]);
            return (IQueryable<T>)ordered!;
        }

        private static async Task<(bool CanResolveFocus, int FocusedPage)> TryResolveFocusedPageAsync<T>(
            IQueryable<T> orderedQuery,
            long focusId,
            int pageSize,
            CancellationToken cancellationToken)
        {
            if (focusId <= 0 || pageSize <= 0)
            {
                return (true, 0);
            }

            if (!TryBuildLongIdSelector<T>(out var idSelector))
            {
                return (false, 0);
            }

            var orderedIds = await orderedQuery
                .Select(idSelector)
                .ToListAsync(cancellationToken);
            var focusIndex = orderedIds.FindIndex(id => id == focusId);
            if (focusIndex < 0)
            {
                return (true, 0);
            }

            return (true, (focusIndex / pageSize) + 1);
        }

        private static bool TryBuildLongIdSelector<T>(out Expression<Func<T, long>> selector)
        {
            selector = null!;

            var idProperty = ResolvePropertyInfo(typeof(T), "Id");
            if (idProperty == null)
            {
                return false;
            }

            var propertyType = idProperty.PropertyType;
            var underlyingType = Nullable.GetUnderlyingType(propertyType) ?? propertyType;
            if (underlyingType != typeof(long) &&
                underlyingType != typeof(int) &&
                underlyingType != typeof(short) &&
                underlyingType != typeof(byte))
            {
                return false;
            }

            var parameter = Expression.Parameter(typeof(T), "row");
            var propertyExpr = Expression.Property(parameter, idProperty);
            Expression valueExpr;

            if (Nullable.GetUnderlyingType(propertyType) != null)
            {
                valueExpr = Expression.Coalesce(propertyExpr, Expression.Default(underlyingType));
            }
            else
            {
                valueExpr = propertyExpr;
            }

            var longExpr = valueExpr.Type == typeof(long)
                ? valueExpr
                : Expression.Convert(valueExpr, typeof(long));

            selector = Expression.Lambda<Func<T, long>>(longExpr, parameter);
            return true;
        }

        private static async Task<ProcurementListQueryResponse?> ExecuteDistinctServerAsync<T>(
            IQueryable<T> sourceQuery,
            string distinctColumn,
            IReadOnlyCollection<string> displayColumns,
            int requestedPage,
            int requestedPageSize,
            CancellationToken cancellationToken)
        {
            var distinctProperty = ResolvePropertyInfo(typeof(T), distinctColumn);
            if (distinctProperty == null)
            {
                return null;
            }

            var groupTotals = await QueryDistinctTotalsAsync(
                sourceQuery,
                distinctProperty,
                cancellationToken);
            if (groupTotals == null)
            {
                return null;
            }

            var normalizedGroups = new Dictionary<string, DistinctServerGroupPageEntry>(StringComparer.Ordinal);
            foreach (var item in groupTotals)
            {
                var normalizedGroupValue = NormalizeDistinctValue(item.GroupValue);
                if (normalizedGroupValue == null)
                {
                    continue;
                }

                var token = BuildDistinctToken(normalizedGroupValue);
                if (normalizedGroups.TryGetValue(token, out var existing))
                {
                    existing.Total += item.Count;
                }
                else
                {
                    normalizedGroups[token] = new DistinctServerGroupPageEntry
                    {
                        Token = token,
                        GroupValue = normalizedGroupValue,
                        Total = item.Count
                    };
                }
            }

            var orderedGroups = normalizedGroups.Values
                .OrderBy(group => BuildDistinctOrderKey(group.GroupValue), StringComparer.OrdinalIgnoreCase)
                .ToList();

            var (page, pageSize) = NormalizePaging(requestedPage, requestedPageSize);
            var totalCount = orderedGroups.Count;
            var totalPages = totalCount == 0
                ? 1
                : (int)Math.Ceiling(totalCount / (double)pageSize);
            var effectivePage = Math.Min(page, totalPages);
            var skip = (effectivePage - 1) * pageSize;

            var pagedGroups = orderedGroups
                .Skip(skip)
                .Take(pageSize)
                .ToList();

            var selectedGroups = pagedGroups.ToDictionary(
                group => group.Token,
                group => new DistinctGroup
                {
                    GroupValue = group.GroupValue,
                    Total = group.Total
                },
                StringComparer.Ordinal);

            if (pagedGroups.Count == 0)
            {
                return new ProcurementListQueryResponse
                {
                    Rows = [],
                    Page = effectivePage,
                    PageSize = pageSize,
                    TotalCount = totalCount,
                    TotalPages = totalPages,
                    HasPreviousPage = effectivePage > 1,
                    HasNextPage = effectivePage < totalPages
                };
            }

            foreach (var displayColumn in displayColumns)
            {
                var normalizedColumn = NormalizeColumnKey(displayColumn);
                if (normalizedColumn == null ||
                    string.Equals(normalizedColumn, distinctColumn, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var displayProperty = ResolvePropertyInfo(typeof(T), normalizedColumn);
                if (displayProperty == null)
                {
                    continue;
                }

                var pairCounts = await QueryDistinctPairCountsAsync(
                    sourceQuery,
                    distinctProperty,
                    displayProperty,
                    cancellationToken);
                if (pairCounts == null)
                {
                    return null;
                }

                foreach (var pair in pairCounts)
                {
                    var normalizedGroupValue = NormalizeDistinctValue(pair.GroupValue);
                    if (normalizedGroupValue == null)
                    {
                        continue;
                    }

                    var groupToken = BuildDistinctToken(normalizedGroupValue);
                    if (!selectedGroups.TryGetValue(groupToken, out var group))
                    {
                        continue;
                    }

                    var normalizedDisplayValue = NormalizeDistinctValue(pair.DisplayValue);
                    var valueToken = BuildDistinctToken(normalizedDisplayValue);

                    if (!group.Counts.TryGetValue(normalizedColumn, out var columnCounts))
                    {
                        columnCounts = new Dictionary<string, (object? Value, int Count)>(StringComparer.Ordinal);
                        group.Counts[normalizedColumn] = columnCounts;
                    }

                    if (columnCounts.TryGetValue(valueToken, out var existing))
                    {
                        columnCounts[valueToken] = (existing.Value, existing.Count + pair.Count);
                    }
                    else
                    {
                        columnCounts[valueToken] = (normalizedDisplayValue, pair.Count);
                    }
                }
            }

            var rowsPayload = pagedGroups
                .Select((group, index) =>
                {
                    var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["Id"] = skip + index + 1L,
                        ["__rowKey"] = BuildDistinctRowKey(distinctColumn, group.GroupValue),
                        [distinctColumn] = group.GroupValue,
                        ["Total"] = group.Total
                    };

                    selectedGroups.TryGetValue(group.Token, out var selectedGroup);

                    foreach (var displayColumn in displayColumns)
                    {
                        var normalizedColumn = NormalizeColumnKey(displayColumn);
                        if (normalizedColumn == null ||
                            string.Equals(normalizedColumn, distinctColumn, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        if (selectedGroup == null ||
                            !selectedGroup.Counts.TryGetValue(normalizedColumn, out var columnCounts) ||
                            columnCounts.Count == 0)
                        {
                            row[normalizedColumn] = Array.Empty<object>();
                            continue;
                        }

                        row[normalizedColumn] = columnCounts.Values
                            .OrderByDescending(item => item.Count)
                            .ThenBy(item => BuildDistinctOrderKey(item.Value), StringComparer.OrdinalIgnoreCase)
                            .Select(item => new
                            {
                                value = item.Value,
                                count = item.Count
                            })
                            .ToList();
                    }

                    return (object)row;
                })
                .ToList();

            return new ProcurementListQueryResponse
            {
                Rows = rowsPayload,
                Page = effectivePage,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                HasPreviousPage = effectivePage > 1,
                HasNextPage = effectivePage < totalPages
            };
        }

        private static async Task<List<DistinctGroupCountEntry>?> QueryDistinctTotalsAsync<T>(
            IQueryable<T> sourceQuery,
            PropertyInfo distinctProperty,
            CancellationToken cancellationToken)
        {
            var genericMethod = typeof(ProcurementListQueryHelper)
                .GetMethod(nameof(QueryDistinctTotalsCoreAsync), BindingFlags.NonPublic | BindingFlags.Static)
                ?.MakeGenericMethod(typeof(T), distinctProperty.PropertyType);
            if (genericMethod == null)
            {
                return null;
            }

            var invoked = genericMethod.Invoke(null, [sourceQuery, distinctProperty, cancellationToken]);
            if (invoked is not Task<List<DistinctGroupCountEntry>> task)
            {
                return null;
            }

            return await task;
        }

        private static async Task<List<DistinctPairCountEntry>?> QueryDistinctPairCountsAsync<T>(
            IQueryable<T> sourceQuery,
            PropertyInfo distinctProperty,
            PropertyInfo displayProperty,
            CancellationToken cancellationToken)
        {
            var genericMethod = typeof(ProcurementListQueryHelper)
                .GetMethod(nameof(QueryDistinctPairCountsCoreAsync), BindingFlags.NonPublic | BindingFlags.Static)
                ?.MakeGenericMethod(typeof(T), distinctProperty.PropertyType, displayProperty.PropertyType);
            if (genericMethod == null)
            {
                return null;
            }

            var invoked = genericMethod.Invoke(null, [sourceQuery, distinctProperty, displayProperty, cancellationToken]);
            if (invoked is not Task<List<DistinctPairCountEntry>> task)
            {
                return null;
            }

            return await task;
        }

        private static async Task<List<DistinctGroupCountEntry>> QueryDistinctTotalsCoreAsync<T, TDistinct>(
            IQueryable<T> sourceQuery,
            PropertyInfo distinctProperty,
            CancellationToken cancellationToken)
        {
            var parameter = Expression.Parameter(typeof(T), "row");
            var propertyExpr = Expression.Property(parameter, distinctProperty);
            var selector = Expression.Lambda<Func<T, TDistinct>>(propertyExpr, parameter);

            var grouped = await sourceQuery
                .GroupBy(selector)
                .Select(group => new DistinctGroupCountProjection<TDistinct>
                {
                    GroupValue = group.Key,
                    Count = group.Count()
                })
                .ToListAsync(cancellationToken);

            return grouped
                .Select(item => new DistinctGroupCountEntry
                {
                    GroupValue = item.GroupValue,
                    Count = item.Count
                })
                .ToList();
        }

        private static async Task<List<DistinctPairCountEntry>> QueryDistinctPairCountsCoreAsync<T, TDistinct, TDisplay>(
            IQueryable<T> sourceQuery,
            PropertyInfo distinctProperty,
            PropertyInfo displayProperty,
            CancellationToken cancellationToken)
        {
            var parameter = Expression.Parameter(typeof(T), "row");
            var distinctExpr = Expression.Property(parameter, distinctProperty);
            var displayExpr = Expression.Property(parameter, displayProperty);

            var keyType = typeof(ValueTuple<TDistinct, TDisplay>);
            var keyConstructor = keyType.GetConstructor([typeof(TDistinct), typeof(TDisplay)]);
            if (keyConstructor == null)
            {
                return [];
            }

            var keyExpr = Expression.New(keyConstructor, distinctExpr, displayExpr);
            var keySelector = Expression.Lambda<Func<T, ValueTuple<TDistinct, TDisplay>>>(keyExpr, parameter);

            var grouped = await sourceQuery
                .GroupBy(keySelector)
                .Select(group => new DistinctPairCountProjection<TDistinct, TDisplay>
                {
                    GroupValue = group.Key.Item1,
                    DisplayValue = group.Key.Item2,
                    Count = group.Count()
                })
                .ToListAsync(cancellationToken);

            return grouped
                .Select(item => new DistinctPairCountEntry
                {
                    GroupValue = item.GroupValue,
                    DisplayValue = item.DisplayValue,
                    Count = item.Count
                })
                .ToList();
        }

        private static bool TryBuildFilterExpression(
            ParameterExpression parameter,
            PropertyInfo property,
            string normalizedOperator,
            string value,
            out Expression? expression)
        {
            expression = null;

            var propertyExpr = Expression.Property(parameter, property);
            var propertyType = property.PropertyType;
            var targetType = Nullable.GetUnderlyingType(propertyType) ?? propertyType;
            var op = string.IsNullOrWhiteSpace(normalizedOperator)
                ? "="
                : normalizedOperator.Trim().ToLowerInvariant();

            if (value.Length == 0)
            {
                if (propertyType == typeof(string))
                {
                    var isNull = Expression.Equal(propertyExpr, Expression.Constant(null, propertyType));
                    var isEmpty = Expression.Equal(propertyExpr, Expression.Constant(string.Empty, propertyType));
                    expression = Expression.OrElse(isNull, isEmpty);
                    return true;
                }

                if (Nullable.GetUnderlyingType(propertyType) != null)
                {
                    expression = Expression.Equal(propertyExpr, Expression.Constant(null, propertyType));
                    return true;
                }

                expression = Expression.Constant(false);
                return true;
            }

            if (op == "contains")
            {
                if (propertyType != typeof(string))
                {
                    return false;
                }

                var notNull = Expression.NotEqual(propertyExpr, Expression.Constant(null, typeof(string)));
                var contains = Expression.Call(
                    propertyExpr,
                    typeof(string).GetMethod(nameof(string.Contains), [typeof(string)])!,
                    Expression.Constant(value));
                expression = Expression.AndAlso(notNull, contains);
                return true;
            }

            if (!TryConvertStringValue(value, targetType, out var converted))
            {
                return false;
            }

            var constant = Expression.Constant(converted, targetType);
            var comparableRight = targetType == propertyType
                ? (Expression)constant
                : Expression.Convert(constant, propertyType);

            expression = op switch
            {
                "=" => Expression.Equal(propertyExpr, comparableRight),
                "!=" => Expression.NotEqual(propertyExpr, comparableRight),
                ">" when targetType != typeof(string) => Expression.GreaterThan(propertyExpr, comparableRight),
                "<" when targetType != typeof(string) => Expression.LessThan(propertyExpr, comparableRight),
                ">=" when targetType != typeof(string) => Expression.GreaterThanOrEqual(propertyExpr, comparableRight),
                "<=" when targetType != typeof(string) => Expression.LessThanOrEqual(propertyExpr, comparableRight),
                _ => null
            };

            return expression != null;
        }

        private static bool TryConvertStringValue(string rawValue, Type targetType, out object? converted)
        {
            converted = null;

            if (targetType == typeof(string))
            {
                converted = rawValue;
                return true;
            }

            if (targetType == typeof(DateTime))
            {
                if (DateTime.TryParse(rawValue, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var dateValue))
                {
                    converted = dateValue;
                    return true;
                }

                return false;
            }

            if (targetType == typeof(decimal))
            {
                if (decimal.TryParse(rawValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var decimalValue))
                {
                    converted = decimalValue;
                    return true;
                }

                return false;
            }

            if (targetType == typeof(int))
            {
                if (int.TryParse(rawValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var intValue))
                {
                    converted = intValue;
                    return true;
                }

                return false;
            }

            if (targetType == typeof(long))
            {
                if (long.TryParse(rawValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var longValue))
                {
                    converted = longValue;
                    return true;
                }

                return false;
            }

            if (targetType == typeof(double))
            {
                if (double.TryParse(rawValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var doubleValue))
                {
                    converted = doubleValue;
                    return true;
                }

                return false;
            }

            if (targetType == typeof(float))
            {
                if (float.TryParse(rawValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var floatValue))
                {
                    converted = floatValue;
                    return true;
                }

                return false;
            }

            if (targetType == typeof(bool))
            {
                if (bool.TryParse(rawValue, out var boolValue))
                {
                    converted = boolValue;
                    return true;
                }

                return false;
            }

            try
            {
                converted = Convert.ChangeType(rawValue, targetType, CultureInfo.InvariantCulture);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static List<T> ApplyFilters<T>(
            IEnumerable<T> rows,
            IEnumerable<ProcurementListFilterRequest> filters,
            string? mode)
        {
            var normalizedFilters = filters
                .Select(filter => new
                {
                    Column = NormalizeColumnKey(filter.Column),
                    Operator = string.IsNullOrWhiteSpace(filter.Operator) ? "=" : filter.Operator.Trim(),
                    Value = filter.Value ?? string.Empty
                })
                .Where(filter => filter.Column != null)
                .ToList();

            if (normalizedFilters.Count == 0)
            {
                return rows.ToList();
            }

            var useOr = string.Equals(mode, "or", StringComparison.OrdinalIgnoreCase);

            return rows.Where(row =>
            {
                var evaluations = normalizedFilters.Select(filter =>
                    CompareValues(
                        ReadValue(row!, filter.Column!),
                        filter.Operator,
                        filter.Value));

                return useOr ? evaluations.Any(result => result) : evaluations.All(result => result);
            }).ToList();
        }

        private static List<T> ApplySearch<T>(
            IEnumerable<T> rows,
            string? rawSearch,
            IEnumerable<string>? rawSearchColumns,
            IReadOnlyCollection<string> displayColumns)
        {
            var normalizedSearch = (rawSearch ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedSearch))
            {
                return rows.ToList();
            }

            var searchColumns = (rawSearchColumns ?? [])
                .Select(NormalizeColumnKey)
                .Where(column => column != null && SearchableColumns.Contains(column, ColumnComparer))
                .Distinct(ColumnComparer)
                .ToList();

            if (searchColumns.Count == 0)
            {
                searchColumns = displayColumns
                    .Select(NormalizeColumnKey)
                    .Where(column => column != null && SearchableColumns.Contains(column, ColumnComparer))
                    .Distinct(ColumnComparer)
                    .ToList();
            }

            if (searchColumns.Count == 0)
            {
                return rows.ToList();
            }

            return rows.Where(row =>
                searchColumns.Any(column =>
                {
                    var value = ReadValue(row!, column!);
                    var text = NormalizeSearchValue(value);
                    return !string.IsNullOrWhiteSpace(text) &&
                           text.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase);
                }))
                .ToList();
        }

        private static List<T> ApplySort<T>(IEnumerable<T> rows, ProcurementListSortRequest? sort)
        {
            var sortColumn = NormalizeColumnKey(sort?.Column);
            if (string.IsNullOrWhiteSpace(sortColumn) || !SortableColumns.Contains(sortColumn, ColumnComparer))
            {
                return rows.ToList();
            }

            var descending = string.Equals(sort?.Direction, "desc", StringComparison.OrdinalIgnoreCase);
            var comparer = Comparer<object?>.Create(CompareQueryValues);

            return descending
                ? rows.OrderByDescending(row => ReadValue(row!, sortColumn), comparer).ToList()
                : rows.OrderBy(row => ReadValue(row!, sortColumn), comparer).ToList();
        }

        private static ProcurementListQueryResponse BuildDistinctResponse<T>(
            IReadOnlyList<T> rows,
            string distinctColumn,
            IReadOnlyCollection<string> displayColumns,
            int requestedPage,
            int requestedPageSize)
        {
            var groups = new Dictionary<string, DistinctGroup>(StringComparer.Ordinal);

            foreach (var row in rows)
            {
                var groupValue = NormalizeDistinctValue(ReadValue(row!, distinctColumn));
                if (groupValue == null)
                {
                    continue;
                }

                var groupToken = BuildDistinctToken(groupValue);
                if (!groups.TryGetValue(groupToken, out var group))
                {
                    group = new DistinctGroup
                    {
                        GroupValue = groupValue
                    };
                    groups[groupToken] = group;
                }

                group.Total += 1;

                foreach (var displayColumn in displayColumns)
                {
                    var normalizedColumn = NormalizeColumnKey(displayColumn);
                    if (normalizedColumn == null ||
                        string.Equals(normalizedColumn, distinctColumn, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var displayValue = NormalizeDistinctValue(ReadValue(row!, normalizedColumn));
                    var valueToken = BuildDistinctToken(displayValue);

                    if (!group.Counts.TryGetValue(normalizedColumn, out var columnCounts))
                    {
                        columnCounts = new Dictionary<string, (object? Value, int Count)>(StringComparer.Ordinal);
                        group.Counts[normalizedColumn] = columnCounts;
                    }

                    if (columnCounts.TryGetValue(valueToken, out var existing))
                    {
                        columnCounts[valueToken] = (existing.Value, existing.Count + 1);
                    }
                    else
                    {
                        columnCounts[valueToken] = (displayValue, 1);
                    }
                }
            }

            var orderedGroups = groups.Values
                .OrderBy(group => BuildDistinctOrderKey(group.GroupValue), StringComparer.OrdinalIgnoreCase)
                .ToList();

            var (page, pageSize) = NormalizePaging(requestedPage, requestedPageSize);
            var totalCount = orderedGroups.Count;
            var totalPages = totalCount == 0
                ? 1
                : (int)Math.Ceiling(totalCount / (double)pageSize);
            var effectivePage = Math.Min(page, totalPages);
            var skip = (effectivePage - 1) * pageSize;

            var rowsPayload = orderedGroups
                .Skip(skip)
                .Take(pageSize)
                .Select((group, index) =>
                {
                    var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["Id"] = skip + index + 1L,
                        ["__rowKey"] = BuildDistinctRowKey(distinctColumn, group.GroupValue),
                        [distinctColumn] = group.GroupValue,
                        ["Total"] = group.Total
                    };

                    foreach (var displayColumn in displayColumns)
                    {
                        var normalizedColumn = NormalizeColumnKey(displayColumn);
                        if (normalizedColumn == null ||
                            string.Equals(normalizedColumn, distinctColumn, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        if (!group.Counts.TryGetValue(normalizedColumn, out var columnCounts) || columnCounts.Count == 0)
                        {
                            row[normalizedColumn] = Array.Empty<object>();
                            continue;
                        }

                        row[normalizedColumn] = columnCounts.Values
                            .OrderByDescending(item => item.Count)
                            .ThenBy(item => BuildDistinctOrderKey(item.Value), StringComparer.OrdinalIgnoreCase)
                            .Select(item => new
                            {
                                value = item.Value,
                                count = item.Count
                            })
                            .ToList();
                    }

                    return (object)row;
                })
                .ToList();

            return new ProcurementListQueryResponse
            {
                Rows = rowsPayload,
                Page = effectivePage,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                HasPreviousPage = effectivePage > 1,
                HasNextPage = effectivePage < totalPages
            };
        }

        private static string BuildDistinctRowKey(string distinctColumn, object? groupValue)
        {
            var normalizedColumn = string.IsNullOrWhiteSpace(distinctColumn)
                ? "unknown"
                : distinctColumn.Trim().ToLowerInvariant();
            var token = BuildDistinctToken(groupValue);
            return $"distinct:{Uri.EscapeDataString(normalizedColumn)}:{Uri.EscapeDataString(token)}";
        }

        private static (int page, int pageSize) NormalizePaging(int page, int pageSize)
        {
            var normalizedPage = page < 1 ? 1 : page;
            var normalizedPageSize = pageSize <= 0
                ? DefaultPageSize
                : Math.Min(pageSize, MaxPageSize);
            return (normalizedPage, normalizedPageSize);
        }

        private static long ReadRowId<T>(T row)
        {
            var value = ReadValue(row!, "Id");
            if (value == null)
            {
                return 0;
            }

            return long.TryParse(
                Convert.ToString(value, CultureInfo.InvariantCulture),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var parsed)
                ? parsed
                : 0;
        }

        private static string? NormalizeColumnKey(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return CanonicalColumnMap.TryGetValue(value.Trim(), out var canonical)
                ? canonical
                : null;
        }

        private static PropertyInfo? ResolvePropertyInfo(Type type, string column)
        {
            var normalizedColumn = string.IsNullOrWhiteSpace(column)
                ? string.Empty
                : column.Trim().ToLowerInvariant();
            return PropertyCache.GetOrAdd((type, normalizedColumn), static key =>
            {
                var (modelType, normalizedName) = key;
                return modelType
                    .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .FirstOrDefault(prop =>
                        string.Equals(prop.Name, normalizedName, StringComparison.OrdinalIgnoreCase));
            });
        }

        private static Dictionary<string, string> BuildCanonicalColumnMap()
        {
            var keys = FilterableColumns
                .Concat(SortableColumns)
                .Concat(SearchableColumns)
                .Distinct(ColumnComparer)
                .ToList();

            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var key in keys)
            {
                map[key] = key;
            }

            map["Dept"] = "Department";
            map["dept"] = "Department";
            map["Tipe Pengadaan"] = "TipePengadaan";
            map["Nilai Pengadaan (Pengajuan APS)"] = "NilaiPengajuanAPS";
            map["Nilai di Approve STA"] = "NilaiApproveSTA";
            map["Nilai Kontrak (PFA)"] = "NilaiKontrak";
            map["PIC PFA"] = "PICPFA";
            map["Tgl Kirim ke PFA"] = "TglKirimkePFA";
            map["Sisa Bulan"] = "SisaBulan";

            return map;
        }

        private static object? ReadValue(object row, string column)
        {
            var rowType = row.GetType();
            var normalizedColumn = string.IsNullOrWhiteSpace(column)
                ? string.Empty
                : column.Trim().ToLowerInvariant();
            var property = ResolvePropertyInfo(rowType, normalizedColumn);
            if (property != null && !string.Equals(property.Name, "ExtraData", StringComparison.OrdinalIgnoreCase))
            {
                var accessor = ValueAccessorCache.GetOrAdd((rowType, normalizedColumn), static key =>
                {
                    var resolvedProperty = ResolvePropertyInfo(key.Type, key.Column);
                    if (resolvedProperty == null)
                    {
                        return static _ => null;
                    }

                    var objectParameter = Expression.Parameter(typeof(object), "row");
                    var typedInstance = Expression.Convert(objectParameter, key.Type);
                    var propertyExpr = Expression.Property(typedInstance, resolvedProperty);
                    var boxedExpr = Expression.Convert(propertyExpr, typeof(object));
                    return Expression.Lambda<Func<object, object?>>(boxedExpr, objectParameter).Compile();
                });

                return accessor(row);
            }

            var extraDataProperty = ResolvePropertyInfo(rowType, "ExtraData");
            var extraData = extraDataProperty?.GetValue(row) as IDictionary<string, object>;

            if (extraData != null)
            {
                foreach (var entry in extraData)
                {
                    if (string.Equals(entry.Key, column, StringComparison.OrdinalIgnoreCase))
                    {
                        return entry.Value;
                    }
                }
            }

            return null;
        }

        private static bool CompareValues(object? cellValue, string? op, string? filterValue)
        {
            var normalizedOperator = string.IsNullOrWhiteSpace(op) ? "=" : op.Trim();
            var expectedValue = filterValue ?? string.Empty;

            if (expectedValue == string.Empty)
            {
                return cellValue == null || string.IsNullOrWhiteSpace(Convert.ToString(cellValue, CultureInfo.InvariantCulture));
            }

            if (cellValue == null)
            {
                return false;
            }

            if (TryCoerceDate(cellValue, out var leftDate) && TryCoerceDate(expectedValue, out var rightDate))
            {
                return CompareComparable(leftDate, rightDate, normalizedOperator);
            }

            if (TryCoerceDecimal(cellValue, out var leftDecimal) && TryCoerceDecimal(expectedValue, out var rightDecimal))
            {
                return CompareComparable(leftDecimal, rightDecimal, normalizedOperator);
            }

            var leftText = NormalizeSearchValue(cellValue);
            var rightText = NormalizeSearchValue(expectedValue);

            return normalizedOperator switch
            {
                "contains" => leftText.Contains(rightText, StringComparison.OrdinalIgnoreCase),
                "=" => string.Equals(leftText, rightText, StringComparison.OrdinalIgnoreCase),
                "!=" => !string.Equals(leftText, rightText, StringComparison.OrdinalIgnoreCase),
                ">" => string.Compare(leftText, rightText, StringComparison.OrdinalIgnoreCase) > 0,
                "<" => string.Compare(leftText, rightText, StringComparison.OrdinalIgnoreCase) < 0,
                ">=" => string.Compare(leftText, rightText, StringComparison.OrdinalIgnoreCase) >= 0,
                "<=" => string.Compare(leftText, rightText, StringComparison.OrdinalIgnoreCase) <= 0,
                _ => leftText.Contains(rightText, StringComparison.OrdinalIgnoreCase)
            };
        }

        private static bool CompareComparable<T>(T left, T right, string op) where T : IComparable<T>
        {
            var comparison = left.CompareTo(right);
            return op switch
            {
                "=" => comparison == 0,
                "!=" => comparison != 0,
                ">" => comparison > 0,
                "<" => comparison < 0,
                ">=" => comparison >= 0,
                "<=" => comparison <= 0,
                _ => comparison == 0
            };
        }

        private static int CompareQueryValues(object? left, object? right)
        {
            if (ReferenceEquals(left, right)) return 0;
            if (left == null) return 1;
            if (right == null) return -1;

            if (TryCoerceDate(left, out var leftDate) && TryCoerceDate(right, out var rightDate))
            {
                return leftDate.CompareTo(rightDate);
            }

            if (TryCoerceDecimal(left, out var leftDecimal) && TryCoerceDecimal(right, out var rightDecimal))
            {
                return leftDecimal.CompareTo(rightDecimal);
            }

            var leftText = NormalizeSearchValue(left);
            var rightText = NormalizeSearchValue(right);
            return string.Compare(leftText, rightText, StringComparison.OrdinalIgnoreCase);
        }

        private static bool TryCoerceDate(object? value, out DateTime result)
        {
            if (value is DateTime dateTime)
            {
                result = dateTime;
                return true;
            }

            return DateTime.TryParse(
                Convert.ToString(value, CultureInfo.InvariantCulture),
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces,
                out result);
        }

        private static bool TryCoerceDecimal(object? value, out decimal result)
        {
            return decimal.TryParse(
                Convert.ToString(value, CultureInfo.InvariantCulture),
                NumberStyles.Any,
                CultureInfo.InvariantCulture,
                out result);
        }

        private static string NormalizeSearchValue(object? value)
        {
            if (value == null)
            {
                return string.Empty;
            }

            if (value is DateTime dateTime)
            {
                return dateTime.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
            }

            return Convert.ToString(value, CultureInfo.InvariantCulture)?.Trim() ?? string.Empty;
        }

        private static object? NormalizeDistinctValue(object? value)
        {
            if (value == null)
            {
                return "(empty)";
            }

            if (value is string text && string.IsNullOrWhiteSpace(text))
            {
                return "(empty)";
            }

            return value;
        }

        private static string BuildDistinctToken(object? value)
        {
            if (value == null)
            {
                return "__NULL__";
            }

            return value switch
            {
                DateTime dateTime => $"__DATE__:{dateTime:O}",
                _ => value.ToString() ?? "__NULL__"
            };
        }

        private static string BuildDistinctOrderKey(object? value)
        {
            return value switch
            {
                null => string.Empty,
                DateTime dateTime => dateTime.ToString("O", CultureInfo.InvariantCulture),
                _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty
            };
        }

        private sealed class DistinctGroup
        {
            public required object GroupValue { get; init; }
            public int Total { get; set; }
            public Dictionary<string, Dictionary<string, (object? Value, int Count)>> Counts { get; } =
                new(StringComparer.OrdinalIgnoreCase);
        }

        private sealed class DistinctServerGroupPageEntry
        {
            public required string Token { get; init; }
            public required object GroupValue { get; init; }
            public int Total { get; set; }
        }

        private sealed class DistinctGroupCountProjection<TGroup>
        {
            public TGroup? GroupValue { get; init; }
            public int Count { get; init; }
        }

        private sealed class DistinctPairCountProjection<TGroup, TDisplay>
        {
            public TGroup? GroupValue { get; init; }
            public TDisplay? DisplayValue { get; init; }
            public int Count { get; init; }
        }

        private sealed class DistinctGroupCountEntry
        {
            public object? GroupValue { get; init; }
            public int Count { get; init; }
        }

        private sealed class DistinctPairCountEntry
        {
            public object? GroupValue { get; init; }
            public object? DisplayValue { get; init; }
            public int Count { get; init; }
        }
    }
}
