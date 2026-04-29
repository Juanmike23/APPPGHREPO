/*
 * PGH-DOC
 * File: Helpers/HumanResourceQueryHelper.cs
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
using System.Globalization;
using System.Collections.Concurrent;
using System.Linq.Expressions;
using System.Reflection;
using PGH.Dtos.Human;

namespace PGH.Helpers
{
    public static class HumanResourceQueryHelper
    {
        public const int DefaultPageSize = 25;
        public const int MaxPageSize = 100;
        private static readonly IReadOnlyDictionary<string, string> HumanColumnLabels =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["NPP"] = "NPP",
                ["Nama"] = "Nama",
                ["JenjangJabatan"] = "Jenjang Jabatan",
                ["Posisi"] = "Posisi",
                ["Department"] = "Department",
                ["JenisKelamin"] = "Jenis Kelamin",
                ["TanggalLahir"] = "Tanggal Lahir",
                ["TanggalJoinBNI"] = "Tanggal Join BNI",
                ["ManmonthManagedService"] = "Manmonth Managed Service",
                ["Role"] = "Role",
                ["Vendor"] = "Vendor",
                ["DIREKTORAT"] = "Direktorat",
                ["KODEJOB"] = "Kode Job",
                ["JOB"] = "Job",
                ["Existing"] = "Existing",
                ["Kebutuhan"] = "Kebutuhan",
                ["Gap"] = "Gap",
                ["UsulanTraining"] = "Usulan Training",
                ["BulanTahun"] = "Bulan/Tahun",
                ["JumlahPerserta"] = "Jumlah Peserta",
                ["SentralDesentral"] = "Sentral/Desentral",
                ["DivisiDepartment"] = "Divisi/Department",
                ["Fasilitator"] = "Fasilitator",
                ["Biaya"] = "Biaya",
                ["Start"] = "Start",
                ["End"] = "End",
                ["JudulTraining"] = "Judul Training",
                ["TahunPelaksanaan"] = "Tahun Pelaksanaan",
                ["SertifikasiNonSerifikasi"] = "Sertifikasi/Non-Sertifikasi",
                ["CreatedAt"] = "Waktu Dibuat",
                ["UpdatedAt"] = "Waktu Diperbarui",
            };

        public static readonly HumanResourceQuerySchema FteSchema = CreateSchema(
            displayColumns:
            [
                "NPP",
                "Nama",
                "JenjangJabatan",
                "Posisi",
                "Department"
            ],
            searchableColumns:
            [
                "NPP",
                "Nama",
                "JenjangJabatan",
                "Posisi",
                "Department"
            ]);

        public static readonly HumanResourceQuerySchema NonFteSchema = CreateSchema(
            displayColumns:
            [
                "NPP",
                "Nama",
                "JenisKelamin",
                "TanggalLahir",
                "TanggalJoinBNI",
                "ManmonthManagedService",
                "Department",
                "Role",
                "Vendor"
            ],
            searchableColumns:
            [
                "NPP",
                "Nama",
                "JenisKelamin",
                "ManmonthManagedService",
                "Department",
                "Role",
                "Vendor"
            ]);

        public static readonly HumanResourceQuerySchema KebutuhanFteSchema = CreateSchema(
            displayColumns:
            [
                "DIREKTORAT",
                "KODEJOB",
                "JOB",
                "Department",
                "Existing",
                "Kebutuhan",
                "Gap"
            ],
            searchableColumns:
            [
                "DIREKTORAT",
                "KODEJOB",
                "JOB",
                "Department"
            ]);

        public static readonly HumanResourceQuerySchema BnuSchema = CreateSchema(
            displayColumns:
            [
                "UsulanTraining",
                "BulanTahun",
                "JumlahPerserta",
                "SentralDesentral",
                "DivisiDepartment",
                "Biaya"
            ],
            searchableColumns:
            [
                "UsulanTraining",
                "BulanTahun",
                "JumlahPerserta",
                "SentralDesentral",
                "DivisiDepartment",
                "Biaya"
            ]);

        public static readonly HumanResourceQuerySchema InternalTrainingSchema = CreateSchema(
            displayColumns:
            [
                "UsulanTraining",
                "Start",
                "End",
                "JumlahPerserta",
                "DivisiDepartment",
                "Fasilitator",
                "Biaya"
            ],
            searchableColumns:
            [
                "UsulanTraining",
                "Start",
                "End",
                "JumlahPerserta",
                "DivisiDepartment",
                "Fasilitator",
                "Biaya"
            ]);

        public static readonly HumanResourceQuerySchema KompetensiPegawaiSchema = CreateSchema(
            displayColumns:
            [
                "NPP",
                "Nama",
                "Department",
                "JudulTraining",
                "TahunPelaksanaan",
                "SertifikasiNonSerifikasi"
            ],
            searchableColumns:
            [
                "NPP",
                "Nama",
                "Department",
                "JudulTraining",
                "TahunPelaksanaan",
                "SertifikasiNonSerifikasi"
            ]);

        private static HumanResourceQuerySchema CreateSchema(
            IReadOnlyList<string> displayColumns,
            IReadOnlyList<string> searchableColumns)
        {
            var filterable = new HashSet<string>(displayColumns, StringComparer.OrdinalIgnoreCase)
            {
                "CreatedAt",
                "UpdatedAt"
            };

            var sortable = new HashSet<string>(displayColumns, StringComparer.OrdinalIgnoreCase)
            {
                "CreatedAt",
                "UpdatedAt"
            };

            return new HumanResourceQuerySchema(
                displayColumns,
                filterable,
                new HashSet<string>(searchableColumns, StringComparer.OrdinalIgnoreCase),
                sortable,
                HumanColumnLabels);
        }

        private static readonly ConcurrentDictionary<(Type Type, string Column), PropertyInfo?> PropertyCache = new();
        private static readonly ConcurrentDictionary<(Type Type, string Column), Func<object, object?>> ValueAccessorCache = new();

        public static async Task<HumanResourceQueryResponse> ExecuteAsync<T>(
            IQueryable<T> sourceQuery,
            HumanResourceQueryRequest? request,
            HumanResourceQuerySchema schema,
            CancellationToken cancellationToken = default)
        {
            request ??= new HumanResourceQueryRequest();
            sourceQuery ??= Enumerable.Empty<T>().AsQueryable();

            var distinctColumn = NormalizeColumnKey(request.Distinct?.Column, schema);
            var workingQuery = sourceQuery;
            if (!TryApplyFiltersToQueryable(
                    workingQuery,
                    request.Filters ?? [],
                    request.Mode,
                    schema,
                    out workingQuery))
            {
                var fallbackRows = await sourceQuery.ToListAsync(cancellationToken);
                return Execute(fallbackRows, request, schema);
            }

            if (!TryApplySearchToQueryable(
                    workingQuery,
                    request.Search,
                    request.SearchColumns,
                    schema,
                    out workingQuery))
            {
                var fallbackRows = await sourceQuery.ToListAsync(cancellationToken);
                return Execute(fallbackRows, request, schema);
            }

            if (!string.IsNullOrWhiteSpace(distinctColumn))
            {
                try
                {
                    var distinctResponse = await ExecuteDistinctServerAsync(
                        workingQuery,
                        distinctColumn,
                        schema,
                        request.Page,
                        request.PageSize,
                        cancellationToken);
                    if (distinctResponse != null)
                    {
                        return distinctResponse;
                    }
                }
                catch
                {
                    // Fallback path keeps existing behavior for unsupported providers/translations.
                }

                var fallbackRows = await sourceQuery.ToListAsync(cancellationToken);
                return Execute(fallbackRows, request, schema);
            }

            if (!TryApplySortToQueryable(
                    workingQuery,
                    request.Sort,
                    request.PriorityTopNullColumn,
                    request.PriorityBottomIds,
                    schema,
                    out workingQuery))
            {
                var fallbackRows = await sourceQuery.ToListAsync(cancellationToken);
                return Execute(fallbackRows, request, schema);
            }

            var (page, pageSize) = NormalizePaging(request.Page, request.PageSize);
            var totalCount = await workingQuery.CountAsync(cancellationToken);
            var totalPages = totalCount == 0
                ? 1
                : (int)Math.Ceiling(totalCount / (double)pageSize);
            var effectivePage = Math.Min(page, totalPages);

            if (request.FocusId.HasValue && request.FocusId.Value > 0 && totalCount > 0)
            {
                var (canResolveFocus, focusedPage) = await TryResolveFocusedPageAsync(
                    workingQuery,
                    request.FocusId.Value,
                    pageSize,
                    cancellationToken);
                if (!canResolveFocus)
                {
                    var fallbackRows = await sourceQuery.ToListAsync(cancellationToken);
                    return Execute(fallbackRows, request, schema);
                }

                if (focusedPage > 0)
                {
                    effectivePage = Math.Clamp(focusedPage, 1, totalPages);
                }
            }

            var skip = (effectivePage - 1) * pageSize;

            var pageRows = await workingQuery
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new HumanResourceQueryResponse
            {
                Rows = pageRows.Cast<object>().ToList(),
                Page = effectivePage,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                HasPreviousPage = effectivePage > 1,
                HasNextPage = effectivePage < totalPages
            };
        }

        public static HumanResourceQueryResponse Execute<T>(
            IEnumerable<T> sourceRows,
            HumanResourceQueryRequest? request,
            HumanResourceQuerySchema schema)
        {
            request ??= new HumanResourceQueryRequest();

            var rows = sourceRows?.ToList() ?? [];
            rows = ApplyFilters(rows, request.Filters ?? [], request.Mode, schema);
            rows = ApplySearch(rows, request.Search, request.SearchColumns, schema);

            var distinctColumn = NormalizeColumnKey(request.Distinct?.Column, schema);
            if (!string.IsNullOrWhiteSpace(distinctColumn))
            {
                return BuildDistinctResponse(rows, distinctColumn, request.Page, request.PageSize, schema);
            }

            rows = ApplySort(
                rows,
                request.Sort,
                request.PriorityTopNullColumn,
                request.PriorityBottomIds,
                schema);

            var (page, pageSize) = NormalizePaging(request.Page, request.PageSize);
            var orderedIds = request.FocusId.HasValue && request.FocusId.Value > 0
                ? rows.Select(ReadRowId).Where(id => id > 0).ToList()
                : null;

            var totalCount = rows.Count;
            var totalPages = totalCount == 0
                ? 1
                : (int)Math.Ceiling(totalCount / (double)pageSize);
            var effectivePage = Math.Min(page, totalPages);

            if (orderedIds != null)
            {
                var focusIndex = orderedIds.FindIndex(id => id == request.FocusId!.Value);
                if (focusIndex >= 0)
                {
                    effectivePage = (focusIndex / pageSize) + 1;
                }
            }

            var skip = (effectivePage - 1) * pageSize;
            var pagedRows = rows.Skip(skip).Take(pageSize).Cast<object>().ToList();

            return new HumanResourceQueryResponse
            {
                Rows = pagedRows,
                Page = effectivePage,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                HasPreviousPage = effectivePage > 1,
                HasNextPage = effectivePage < totalPages
            };
        }

        private static bool TryApplyFiltersToQueryable<T>(
            IQueryable<T> source,
            IEnumerable<HumanResourceFilterRequest> filters,
            string? mode,
            HumanResourceQuerySchema schema,
            out IQueryable<T> query)
        {
            query = source;

            var normalizedFilters = filters
                .Select(filter => new
                {
                    Column = NormalizeColumnKey(filter.Column, schema),
                    Operator = string.IsNullOrWhiteSpace(filter.Operator) ? "=" : filter.Operator.Trim(),
                    Value = filter.Value ?? string.Empty
                })
                .Where(filter => filter.Column != null && schema.FilterableColumns.Contains(filter.Column))
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
            HumanResourceQuerySchema schema,
            out IQueryable<T> query)
        {
            query = source;
            var normalizedSearch = (rawSearch ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedSearch))
            {
                return true;
            }

            var searchColumns = (rawSearchColumns ?? [])
                .Select(column => NormalizeColumnKey(column, schema))
                .Where(column => column != null && schema.SearchableColumns.Contains(column))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (searchColumns.Count == 0)
            {
                searchColumns = schema.DisplayColumns
                    .Select(column => NormalizeColumnKey(column, schema))
                    .Where(column => column != null && schema.SearchableColumns.Contains(column))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
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
            HumanResourceSortRequest? sort,
            string? priorityTopNullColumn,
            IEnumerable<long>? priorityBottomIds,
            HumanResourceQuerySchema schema,
            out IQueryable<T> query)
        {
            query = source;
            var sortColumn = NormalizeColumnKey(sort?.Column, schema);
            if (string.IsNullOrWhiteSpace(sortColumn) || !schema.SortableColumns.Contains(sortColumn))
            {
                return true;
            }

            var property = ResolvePropertyInfo(typeof(T), sortColumn);
            if (property == null)
            {
                return false;
            }

            var descending = string.Equals(sort?.Direction, "desc", StringComparison.OrdinalIgnoreCase);
            var normalizedPriorityTopNullColumn = NormalizeColumnKey(priorityTopNullColumn, schema);
            var prioritizeNullAtTop = !descending &&
                                      !string.IsNullOrWhiteSpace(normalizedPriorityTopNullColumn) &&
                                      string.Equals(
                                          normalizedPriorityTopNullColumn,
                                          sortColumn,
                                          StringComparison.OrdinalIgnoreCase);
            var normalizedPriorityBottomIds = NormalizePriorityBottomIds(priorityBottomIds);

            query = ApplyQueryableOrder(
                source,
                property,
                descending,
                prioritizeNullAtTop,
                normalizedPriorityBottomIds);
            return true;
        }

        private static IQueryable<T> ApplyQueryableOrder<T>(
            IQueryable<T> source,
            PropertyInfo property,
            bool descending,
            bool nullsFirst,
            IReadOnlyList<long> priorityBottomIds)
        {
            var parameter = Expression.Parameter(typeof(T), "row");
            var propertyExpr = Expression.Property(parameter, property);
            var keySelector = Expression.Lambda(propertyExpr, parameter);
            var propertyType = property.PropertyType;
            var allowsNull = !propertyType.IsValueType || Nullable.GetUnderlyingType(propertyType) != null;
            var orderedWithBottomRank = TryApplyPriorityBottomToQueryable(source, parameter, priorityBottomIds);

            if (!allowsNull)
            {
                var ordered = orderedWithBottomRank == null
                    ? ApplyOrderByQueryable(source, keySelector, propertyType, descending)
                    : ApplyThenByQueryable(orderedWithBottomRank, keySelector, propertyType, descending);
                return ApplyStableIdTieBreaker(ordered);
            }

            var isNullExpr = Expression.Equal(propertyExpr, Expression.Constant(null, propertyType));
            var nullRankWhenNull = nullsFirst ? 0 : 1;
            var nullRankWhenNotNull = nullsFirst ? 1 : 0;
            var nullRankExpr = Expression.Condition(
                isNullExpr,
                Expression.Constant(nullRankWhenNull),
                Expression.Constant(nullRankWhenNotNull));
            var nullRankSelector = Expression.Lambda(nullRankExpr, parameter);

            var withNullRank = orderedWithBottomRank == null
                ? ApplyOrderByQueryable(source, nullRankSelector, typeof(int), descending: false)
                : ApplyThenByQueryable(orderedWithBottomRank, nullRankSelector, typeof(int), descending: false);
            var orderedBySortValue = ApplyThenByQueryable(withNullRank, keySelector, propertyType, descending);
            return ApplyStableIdTieBreaker(orderedBySortValue);
        }

        private static IOrderedQueryable<T> ApplyOrderByQueryable<T>(
            IQueryable<T> source,
            LambdaExpression keySelector,
            Type keyType,
            bool descending)
        {
            var methodName = descending ? nameof(Queryable.OrderByDescending) : nameof(Queryable.OrderBy);
            var method = typeof(Queryable)
                .GetMethods(BindingFlags.Public | BindingFlags.Static)
                .First(candidate =>
                    candidate.Name == methodName &&
                    candidate.GetParameters().Length == 2);
            var generic = method.MakeGenericMethod(typeof(T), keyType);
            var ordered = generic.Invoke(null, [source, keySelector]);
            return (IOrderedQueryable<T>)ordered!;
        }

        private static IOrderedQueryable<T> ApplyThenByQueryable<T>(
            IOrderedQueryable<T> source,
            LambdaExpression keySelector,
            Type keyType,
            bool descending)
        {
            var methodName = descending ? nameof(Queryable.ThenByDescending) : nameof(Queryable.ThenBy);
            var method = typeof(Queryable)
                .GetMethods(BindingFlags.Public | BindingFlags.Static)
                .First(candidate =>
                    candidate.Name == methodName &&
                    candidate.GetParameters().Length == 2);
            var generic = method.MakeGenericMethod(typeof(T), keyType);
            var ordered = generic.Invoke(null, [source, keySelector]);
            return (IOrderedQueryable<T>)ordered!;
        }

        private static IOrderedQueryable<T>? TryApplyPriorityBottomToQueryable<T>(
            IQueryable<T> source,
            ParameterExpression parameter,
            IReadOnlyList<long> priorityBottomIds)
        {
            if (priorityBottomIds.Count == 0)
            {
                return null;
            }

            var idProperty = ResolvePropertyInfo(typeof(T), "Id");
            if (idProperty == null)
            {
                return null;
            }

            var propertyType = idProperty.PropertyType;
            var underlyingType = Nullable.GetUnderlyingType(propertyType) ?? propertyType;
            if (underlyingType != typeof(long) &&
                underlyingType != typeof(int) &&
                underlyingType != typeof(short) &&
                underlyingType != typeof(byte))
            {
                return null;
            }

            var idExpr = Expression.Property(parameter, idProperty);
            Expression idValueExpr;
            if (Nullable.GetUnderlyingType(propertyType) != null)
            {
                idValueExpr = Expression.Coalesce(idExpr, Expression.Default(underlyingType));
            }
            else
            {
                idValueExpr = idExpr;
            }

            var idAsLongExpr = idValueExpr.Type == typeof(long)
                ? idValueExpr
                : Expression.Convert(idValueExpr, typeof(long));

            var constants = priorityBottomIds.Distinct().ToArray();
            var constantExpr = Expression.Constant(constants);
            var containsMethod = typeof(Enumerable)
                .GetMethods(BindingFlags.Public | BindingFlags.Static)
                .First(method =>
                    method.Name == nameof(Enumerable.Contains) &&
                    method.GetParameters().Length == 2)
                .MakeGenericMethod(typeof(long));
            var containsExpr = Expression.Call(containsMethod, constantExpr, idAsLongExpr);
            var bottomRankExpr = Expression.Condition(
                containsExpr,
                Expression.Constant(1),
                Expression.Constant(0));
            var bottomRankSelector = Expression.Lambda(bottomRankExpr, parameter);
            return ApplyOrderByQueryable(source, bottomRankSelector, typeof(int), descending: false);
        }

        private static IQueryable<T> ApplyStableIdTieBreaker<T>(IOrderedQueryable<T> source)
        {
            var idProperty = ResolvePropertyInfo(typeof(T), "Id");
            if (idProperty == null)
            {
                return source;
            }

            var parameter = Expression.Parameter(typeof(T), "row");
            var idExpr = Expression.Property(parameter, idProperty);
            var idSelector = Expression.Lambda(idExpr, parameter);
            return ApplyThenByQueryable(source, idSelector, idProperty.PropertyType, descending: false);
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

        private static async Task<HumanResourceQueryResponse?> ExecuteDistinctServerAsync<T>(
            IQueryable<T> sourceQuery,
            string distinctColumn,
            HumanResourceQuerySchema schema,
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
                return new HumanResourceQueryResponse
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

            foreach (var displayColumn in schema.DisplayColumns)
            {
                var normalizedColumn = NormalizeColumnKey(displayColumn, schema);
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

                    foreach (var displayColumn in schema.DisplayColumns)
                    {
                        var normalizedColumn = NormalizeColumnKey(displayColumn, schema);
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

            return new HumanResourceQueryResponse
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
            var genericMethod = typeof(HumanResourceQueryHelper)
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
            var genericMethod = typeof(HumanResourceQueryHelper)
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
            var op = string.IsNullOrWhiteSpace(normalizedOperator) ? "=" : normalizedOperator.Trim().ToLowerInvariant();

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
            IEnumerable<HumanResourceFilterRequest> filters,
            string? mode,
            HumanResourceQuerySchema schema)
        {
            var normalizedFilters = filters
                .Select(filter => new
                {
                    Column = NormalizeColumnKey(filter.Column, schema),
                    Operator = string.IsNullOrWhiteSpace(filter.Operator) ? "=" : filter.Operator.Trim(),
                    Value = filter.Value ?? string.Empty
                })
                .Where(filter => filter.Column != null && schema.FilterableColumns.Contains(filter.Column))
                .ToList();

            if (normalizedFilters.Count == 0)
            {
                return rows.ToList();
            }

            var useOr = string.Equals(mode, "or", StringComparison.OrdinalIgnoreCase);

            return rows.Where(row =>
            {
                var evaluations = normalizedFilters.Select(filter =>
                    CompareValues(ReadValue(row!, filter.Column!), filter.Operator, filter.Value));
                return useOr ? evaluations.Any(result => result) : evaluations.All(result => result);
            }).ToList();
        }

        private static List<T> ApplySearch<T>(
            IEnumerable<T> rows,
            string? rawSearch,
            IEnumerable<string>? rawSearchColumns,
            HumanResourceQuerySchema schema)
        {
            var normalizedSearch = (rawSearch ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedSearch))
            {
                return rows.ToList();
            }

            var searchColumns = (rawSearchColumns ?? [])
                .Select(column => NormalizeColumnKey(column, schema))
                .Where(column => column != null && schema.SearchableColumns.Contains(column))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (searchColumns.Count == 0)
            {
                searchColumns = schema.DisplayColumns
                    .Select(column => NormalizeColumnKey(column, schema))
                    .Where(column => column != null && schema.SearchableColumns.Contains(column))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }

            return rows.Where(row =>
                searchColumns.Any(column =>
                {
                    var text = NormalizeSearchValue(ReadValue(row!, column!));
                    return !string.IsNullOrWhiteSpace(text) &&
                           text.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase);
                }))
                .ToList();
        }

        private static List<T> ApplySort<T>(
            IEnumerable<T> rows,
            HumanResourceSortRequest? sort,
            string? priorityTopNullColumn,
            IEnumerable<long>? priorityBottomIds,
            HumanResourceQuerySchema schema)
        {
            var sortColumn = NormalizeColumnKey(sort?.Column, schema);
            if (string.IsNullOrWhiteSpace(sortColumn) || !schema.SortableColumns.Contains(sortColumn))
            {
                return rows.ToList();
            }

            var descending = string.Equals(sort?.Direction, "desc", StringComparison.OrdinalIgnoreCase);
            var normalizedPriorityTopNullColumn = NormalizeColumnKey(priorityTopNullColumn, schema);
            var prioritizeNullAtTop = !descending &&
                                      !string.IsNullOrWhiteSpace(normalizedPriorityTopNullColumn) &&
                                      string.Equals(
                                          normalizedPriorityTopNullColumn,
                                          sortColumn,
                                          StringComparison.OrdinalIgnoreCase);
            var normalizedPriorityBottomIds = NormalizePriorityBottomIds(priorityBottomIds);
            var bottomIdSet = normalizedPriorityBottomIds.Count == 0
                ? null
                : new HashSet<long>(normalizedPriorityBottomIds);
            var comparer = Comparer<object?>.Create(CompareQueryValues);
            var projected = rows.Select(row => new
            {
                Row = row,
                SortValue = ReadValue(row!, sortColumn),
                RowId = ReadRowId(row!)
            });

            var withBottomRank = projected.OrderBy(item =>
                bottomIdSet != null && bottomIdSet.Contains(item.RowId) ? 1 : 0);
            var withNullRank = withBottomRank.ThenBy(item =>
                IsNullLikeSortValue(item.SortValue)
                    ? (prioritizeNullAtTop ? 0 : 1)
                    : (prioritizeNullAtTop ? 1 : 0));
            var ordered = descending
                ? withNullRank.ThenByDescending(item => item.SortValue, comparer)
                : withNullRank.ThenBy(item => item.SortValue, comparer);

            return ordered
                .ThenBy(item => item.RowId)
                .Select(item => item.Row)
                .ToList();
        }

        private static HumanResourceQueryResponse BuildDistinctResponse<T>(
            IReadOnlyList<T> rows,
            string distinctColumn,
            int requestedPage,
            int requestedPageSize,
            HumanResourceQuerySchema schema)
        {
            var groups = new Dictionary<string, DistinctGroup>(StringComparer.Ordinal);

            foreach (var row in rows)
            {
                var groupValue = NormalizeDistinctValue(ReadValue(row!, distinctColumn));
                if (groupValue == null) continue;

                var groupToken = BuildDistinctToken(groupValue);
                if (!groups.TryGetValue(groupToken, out var group))
                {
                    group = new DistinctGroup { GroupValue = groupValue };
                    groups[groupToken] = group;
                }

                group.Total += 1;

                foreach (var displayColumn in schema.DisplayColumns)
                {
                    var normalizedColumn = NormalizeColumnKey(displayColumn, schema);
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

                    foreach (var displayColumn in schema.DisplayColumns)
                    {
                        var normalizedColumn = NormalizeColumnKey(displayColumn, schema);
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

            return new HumanResourceQueryResponse
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

        private static IReadOnlyList<long> NormalizePriorityBottomIds(IEnumerable<long>? values)
        {
            if (values == null)
            {
                return [];
            }

            return values
                .Where(value => value > 0)
                .Distinct()
                .ToList();
        }

        private static long ReadRowId<T>(T row)
        {
            var value = ReadValue(row!, "Id");
            if (value == null) return 0;

            return long.TryParse(
                Convert.ToString(value, CultureInfo.InvariantCulture),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var parsed)
                ? parsed
                : 0;
        }

        private static string? NormalizeColumnKey(string? value, HumanResourceQuerySchema schema)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var key = value.Trim();
            if (schema.CanonicalMap.TryGetValue(key, out var canonical))
            {
                return canonical;
            }

            return null;
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

        private static object? ReadValue(object row, string column)
        {
            var rowType = row.GetType();
            var normalizedColumn = string.IsNullOrWhiteSpace(column)
                ? string.Empty
                : column.Trim().ToLowerInvariant();
            var accessor = ValueAccessorCache.GetOrAdd((rowType, normalizedColumn), static key =>
            {
                var property = ResolvePropertyInfo(key.Type, key.Column);
                if (property == null)
                {
                    return static _ => null;
                }

                var objectParameter = Expression.Parameter(typeof(object), "row");
                var typedInstance = Expression.Convert(objectParameter, key.Type);
                var propertyExpr = Expression.Property(typedInstance, property);
                var boxedExpr = Expression.Convert(propertyExpr, typeof(object));
                return Expression.Lambda<Func<object, object?>>(boxedExpr, objectParameter).Compile();
            });

            return accessor(row);
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

        private static bool IsNullLikeSortValue(object? value)
        {
            if (value == null || value is DBNull)
            {
                return true;
            }

            return value is string text && string.IsNullOrWhiteSpace(text);
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
            public TGroup? GroupValue { get; set; }
            public int Count { get; set; }
        }

        private sealed class DistinctPairCountProjection<TGroup, TDisplay>
        {
            public TGroup? GroupValue { get; set; }
            public TDisplay? DisplayValue { get; set; }
            public int Count { get; set; }
        }

        private sealed class DistinctGroupCountEntry
        {
            public object? GroupValue { get; set; }
            public int Count { get; set; }
        }

        private sealed class DistinctPairCountEntry
        {
            public object? GroupValue { get; set; }
            public object? DisplayValue { get; set; }
            public int Count { get; set; }
        }
    }

    public sealed class HumanResourceQuerySchema(
        IReadOnlyList<string> displayColumns,
        IReadOnlySet<string> filterableColumns,
        IReadOnlySet<string> searchableColumns,
        IReadOnlySet<string> sortableColumns,
        IReadOnlyDictionary<string, string> columnLabels)
    {
        public IReadOnlyList<string> DisplayColumns { get; } = displayColumns;
        public IReadOnlySet<string> FilterableColumns { get; } = filterableColumns;
        public IReadOnlySet<string> SearchableColumns { get; } = searchableColumns;
        public IReadOnlySet<string> SortableColumns { get; } = sortableColumns;
        public IReadOnlyDictionary<string, string> ColumnLabels { get; } = columnLabels;
        public IReadOnlyDictionary<string, string> CanonicalMap { get; } = BuildCanonicalMap(
            displayColumns,
            filterableColumns,
            searchableColumns,
            sortableColumns,
            columnLabels);

        private static IReadOnlyDictionary<string, string> BuildCanonicalMap(
            IReadOnlyList<string> displayColumns,
            IReadOnlySet<string> filterableColumns,
            IReadOnlySet<string> searchableColumns,
            IReadOnlySet<string> sortableColumns,
            IReadOnlyDictionary<string, string> columnLabels)
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

            foreach (var entry in columnLabels)
            {
                if (!string.IsNullOrWhiteSpace(entry.Key) &&
                    !string.IsNullOrWhiteSpace(entry.Value))
                {
                    map[entry.Value] = entry.Key;
                }
            }

            return map;
        }

        public string ResolveLabel(string column) =>
            !string.IsNullOrWhiteSpace(column) &&
            ColumnLabels.TryGetValue(column, out var label) &&
            !string.IsNullOrWhiteSpace(label)
                ? label
                : column;
    }
}
