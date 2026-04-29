/*
 * PGH-DOC
 * File: Controllers/⚖️ComplianceController/WeeklyTable.Helpers.cs
 * Apa fungsi bagian ini:
 * - File ini menangani endpoint API dan alur request/response fitur.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using PGH.Dtos.Common;
using PGH.Dtos.Compliance;
using PGH.Helpers;
using PGH.Models.Compliance;

namespace WebApplication2.Controllers
{
    public partial class WeeklyTableController
    {
        private async Task<List<WeeklyTable>> GetRowsForReadAsync(
            long? requestedPeriodId,
            long? requestedTableId,
            CancellationToken cancellationToken)
        {
            var period = await ResolveReadPeriodAsync(requestedPeriodId, cancellationToken);
            if (period == null)
            {
                return new List<WeeklyTable>();
            }

            var table = await ResolveReadTableAsync(period.Id, requestedTableId, cancellationToken);
            if (requestedTableId.HasValue && table == null)
            {
                return new List<WeeklyTable>();
            }

            var query = _db.WeeklyTable
                .AsNoTracking()
                .Where(row => row.WeeklyPeriodId == period.Id);

            if (table != null)
            {
                query = query.Where(row => row.WeeklyTableInstanceId == table.Id);
            }

            return await query
                .OrderByDescending(row => row.CreatedAt)
                .ThenByDescending(row => row.Id)
                .ToListAsync(cancellationToken);
        }

        private async Task<List<WeeklyTableReadDto>> GetProjectedRowsForReadAsync(
            long? requestedPeriodId,
            long? requestedTableId,
            CancellationToken cancellationToken)
        {
            var period = await ResolveReadPeriodAsync(requestedPeriodId, cancellationToken);
            if (period == null)
            {
                return new List<WeeklyTableReadDto>();
            }

            var table = await ResolveReadTableAsync(period.Id, requestedTableId, cancellationToken);
            if (requestedTableId.HasValue && table == null)
            {
                return new List<WeeklyTableReadDto>();
            }

            var query = _db.WeeklyTable
                .AsNoTracking()
                .Where(row => row.WeeklyPeriodId == period.Id);

            if (table != null)
            {
                query = query.Where(row => row.WeeklyTableInstanceId == table.Id);
            }

            return await query
                .OrderByDescending(row => row.CreatedAt)
                .ThenByDescending(row => row.Id)
                .Select(row => new WeeklyTableReadDto
                {
                    Id = row.Id,
                    WeeklyTableInstanceId = row.WeeklyTableInstanceId,
                    Progress = row.Progress,
                    Status = row.Status,
                    Highlights = row.Highlights,
                    WorkInProgress = row.WorkInProgress,
                    Target = row.Target,
                    NextToDo = row.NextToDo,
                    ExtraData = null,
                    CreatedAt = row.CreatedAt,
                    UpdatedAt = row.UpdatedAt
                })
                .ToListAsync(cancellationToken);
        }

        private static string ResolveWeeklyExportFormat(string? rawFormat) =>
            string.IsNullOrWhiteSpace(rawFormat)
                ? "xlsx"
                : rawFormat.Trim().ToLowerInvariant();

        private static List<string> ResolveWeeklyExportColumns(IEnumerable<string>? requestedColumns)
        {
            if (requestedColumns == null)
            {
                return [.. DefaultExportColumns];
            }

            var selectedColumns = (requestedColumns ?? [])
                .Where(column => !string.IsNullOrWhiteSpace(column))
                .Select(column => column.Trim())
                .Where(column => DefaultExportColumns.Contains(column, StringComparer.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return selectedColumns.Count > 0
                ? selectedColumns
                : [];
        }

        private static string ResolveWeeklyExportColumnLabel(string column) =>
            ExportColumnLabels.TryGetValue(column, out var label)
                ? label
                : column;

        private static List<object> BuildWeeklyExportRows(
            IReadOnlyList<WeeklyTableReadDto> sourceRows,
            WeeklyTableExportRequest? request)
        {
            if (sourceRows.Count == 0)
            {
                return [];
            }

            var firstPageRequest = BuildWeeklyExportQueryRequest(request, 1);
            var firstPageResponse = TableQueryHelper.Execute(sourceRows, firstPageRequest, WeeklyQuerySchema);
            var rows = new List<object>(firstPageResponse.Rows);

            for (var page = 2; page <= firstPageResponse.TotalPages; page += 1)
            {
                var pageResponse = TableQueryHelper.Execute(
                    sourceRows,
                    BuildWeeklyExportQueryRequest(request, page),
                    WeeklyQuerySchema);

                rows.AddRange(pageResponse.Rows);
            }

            return rows;
        }

        private static TableQueryRequest BuildWeeklyExportQueryRequest(
            WeeklyTableExportRequest? request,
            int page)
        {
            return new TableQueryRequest
            {
                Page = page,
                PageSize = TableQueryHelper.MaxPageSize,
                Filters = request?.Filters ?? [],
                Mode = request?.Mode,
                Sort = request?.Sort,
                Distinct = request?.Distinct,
                Search = request?.Search,
                SearchColumns = request?.SearchColumns,
                PriorityTopNullColumn = request?.PriorityTopNullColumn,
                PriorityBottomIds = request?.PriorityBottomIds ?? []
            };
        }

        private static string BuildWeeklyExportFilePrefix(
            WeeklyPeriod period,
            WeeklyTableInstance? table)
        {
            var periodToken = SanitizeWeeklyExportFileSegment(period.PeriodCode);
            var tableToken = SanitizeWeeklyExportFileSegment(table?.TableName);

            if (string.IsNullOrWhiteSpace(tableToken))
            {
                return string.IsNullOrWhiteSpace(periodToken)
                    ? "WeeklyTable"
                    : $"WeeklyTable_{periodToken}";
            }

            return string.IsNullOrWhiteSpace(periodToken)
                ? $"WeeklyTable_{tableToken}"
                : $"WeeklyTable_{periodToken}_{tableToken}";
        }

        private static string SanitizeWeeklyExportFileSegment(string? value)
        {
            var invalidChars = Path.GetInvalidFileNameChars().ToHashSet();
            var sanitized = new string(
                string.Concat(value ?? string.Empty)
                    .Where(ch => !invalidChars.Contains(ch))
                    .ToArray())
                .Trim();

            if (string.IsNullOrWhiteSpace(sanitized))
            {
                return string.Empty;
            }

            sanitized = sanitized.Replace(' ', '_');
            return sanitized.Length > 64 ? sanitized[..64] : sanitized;
        }

        private async Task<WeeklyPeriod?> ResolveReadPeriodAsync(long? requestedPeriodId, CancellationToken cancellationToken)
        {
            if (requestedPeriodId is > 0)
            {
                return await _db.WeeklyPeriods
                    .AsNoTracking()
                    .FirstOrDefaultAsync(period => period.Id == requestedPeriodId.Value, cancellationToken);
            }

            var (start, _, year, weekNumber, periodCode) = GetCurrentWeekWindow();

            var currentPeriod = await _db.WeeklyPeriods
                .AsNoTracking()
                .FirstOrDefaultAsync(period =>
                    !period.IsLegacy &&
                    (period.PeriodCode == periodCode ||
                     (period.Year == year && period.WeekNumber == weekNumber) ||
                     period.WeekStartDate == start),
                    cancellationToken);

            if (currentPeriod != null)
            {
                return currentPeriod;
            }

            var latestWorkingPeriod = await _db.WeeklyPeriods
                .AsNoTracking()
                .Where(period => !period.IsLegacy)
                .OrderByDescending(period => period.WeekStartDate)
                .ThenByDescending(period => period.UpdatedAt)
                .ThenByDescending(period => period.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (latestWorkingPeriod != null)
            {
                return latestWorkingPeriod;
            }

            return await _db.WeeklyPeriods
                .AsNoTracking()
                .OrderByDescending(period => period.IsLegacy)
                .ThenByDescending(period => period.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task<List<WeeklyTableInstance>> GetTableInstancesForPeriodAsync(long periodId, CancellationToken cancellationToken)
        {
            return await _db.WeeklyTableInstances
                .AsNoTracking()
                .Where(instance => instance.WeeklyPeriodId == periodId)
                .OrderByDescending(instance => instance.IsDefault)
                .ThenBy(instance => instance.CreatedAt)
                .ThenBy(instance => instance.Id)
                .ToListAsync(cancellationToken);
        }

        private async Task<WeeklyTableInstance?> ResolveReadTableAsync(
            long periodId,
            long? requestedTableId,
            CancellationToken cancellationToken)
        {
            if (requestedTableId is > 0)
            {
                return await _db.WeeklyTableInstances
                    .AsNoTracking()
                    .FirstOrDefaultAsync(instance =>
                        instance.Id == requestedTableId.Value &&
                        instance.WeeklyPeriodId == periodId,
                        cancellationToken);
            }

            return await _db.WeeklyTableInstances
                .AsNoTracking()
                .Where(instance => instance.WeeklyPeriodId == periodId)
                .OrderByDescending(instance => instance.IsDefault)
                .ThenBy(instance => instance.CreatedAt)
                .ThenBy(instance => instance.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task<WeeklyPeriod> EnsureCurrentPeriodSnapshotAsync(CancellationToken cancellationToken)
        {
            var (start, end, year, weekNumber, periodCode) = GetCurrentWeekWindow();

            var currentPeriod = await _db.WeeklyPeriods
                .FirstOrDefaultAsync(period =>
                    period.PeriodCode == periodCode ||
                    (!period.IsLegacy && period.Year == year && period.WeekNumber == weekNumber),
                    cancellationToken);

            if (currentPeriod != null)
            {
                await EnsureDefaultTableInstanceAsync(currentPeriod.Id, cancellationToken);
                return currentPeriod;
            }

            currentPeriod = new WeeklyPeriod
            {
                PeriodCode = periodCode,
                DisplayName = BuildPeriodDisplayName(start, end, weekNumber),
                WeekStartDate = start,
                WeekEndDate = end,
                Year = year,
                WeekNumber = weekNumber,
                IsLegacy = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            using (_db.SuppressAutomaticLogs())
            {
                _db.WeeklyPeriods.Add(currentPeriod);
                await _db.SaveChangesAsync(cancellationToken);

                await CloneLatestSnapshotIntoPeriodAsync(currentPeriod.Id, cancellationToken);
                await EnsureDefaultTableInstanceAsync(currentPeriod.Id, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
            }

            return currentPeriod;
        }

        private async Task CloneLatestSnapshotIntoPeriodAsync(long targetPeriodId, CancellationToken cancellationToken)
        {
            var sourcePeriod = await _db.WeeklyPeriods
                .AsNoTracking()
                .Where(period => period.Id != targetPeriodId)
                .OrderByDescending(period => period.IsLegacy ? 0 : 1)
                .ThenByDescending(period => period.WeekStartDate)
                .ThenByDescending(period => period.UpdatedAt)
                .ThenByDescending(period => period.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (sourcePeriod == null)
            {
                return;
            }

            var sourceTables = await _db.WeeklyTableInstances
                .AsNoTracking()
                .Where(instance => instance.WeeklyPeriodId == sourcePeriod.Id)
                .OrderByDescending(instance => instance.IsDefault)
                .ThenBy(instance => instance.CreatedAt)
                .ThenBy(instance => instance.Id)
                .ToListAsync(cancellationToken);

            var tableMap = new Dictionary<long, WeeklyTableInstance>();
            var now = DateTime.UtcNow;

            if (sourceTables.Count > 0)
            {
                foreach (var sourceTable in sourceTables)
                {
                    var clone = new WeeklyTableInstance
                    {
                        WeeklyPeriodId = targetPeriodId,
                        LogicalTableKey = sourceTable.LogicalTableKey == Guid.Empty
                            ? Guid.NewGuid()
                            : sourceTable.LogicalTableKey,
                        TableName = sourceTable.TableName,
                        SuggestionSeed = sourceTable.SuggestionSeed,
                        IsDefault = sourceTable.IsDefault,
                        CreatedAt = now,
                        UpdatedAt = now
                    };

                    _db.WeeklyTableInstances.Add(clone);
                    tableMap[sourceTable.Id] = clone;
                }

                await _db.SaveChangesAsync(cancellationToken);
            }

            if (tableMap.Count == 0)
            {
                var fallbackTable = await EnsureDefaultTableInstanceAsync(targetPeriodId, cancellationToken);
                var sourceRowsWithoutInstance = await _db.WeeklyTable
                    .AsNoTracking()
                    .Where(row => row.WeeklyPeriodId == sourcePeriod.Id)
                    .OrderBy(row => row.Id)
                    .ToListAsync(cancellationToken);

                foreach (var sourceRow in sourceRowsWithoutInstance)
                {
                    _db.WeeklyTable.Add(CloneWeeklyRow(sourceRow, targetPeriodId, fallbackTable.Id, now));
                }

                return;
            }

            var sourceRows = await _db.WeeklyTable
                .AsNoTracking()
                .Where(row =>
                    row.WeeklyPeriodId == sourcePeriod.Id &&
                    row.WeeklyTableInstanceId.HasValue &&
                    tableMap.Keys.Contains(row.WeeklyTableInstanceId.Value))
                .OrderBy(row => row.Id)
                .ToListAsync(cancellationToken);

            foreach (var sourceRow in sourceRows)
            {
                if (!sourceRow.WeeklyTableInstanceId.HasValue ||
                    !tableMap.TryGetValue(sourceRow.WeeklyTableInstanceId.Value, out var targetTable))
                {
                    continue;
                }

                _db.WeeklyTable.Add(CloneWeeklyRow(sourceRow, targetPeriodId, targetTable.Id, now));
            }
        }

        private async Task<WeeklyTableInstance> EnsureDefaultTableInstanceAsync(long periodId, CancellationToken cancellationToken)
        {
            var existingDefault = await _db.WeeklyTableInstances
                .FirstOrDefaultAsync(instance => instance.WeeklyPeriodId == periodId && instance.IsDefault, cancellationToken);

            if (existingDefault != null)
            {
                return existingDefault;
            }

            var firstExisting = await _db.WeeklyTableInstances
                .FirstOrDefaultAsync(instance => instance.WeeklyPeriodId == periodId, cancellationToken);

            if (firstExisting != null)
            {
                using (_db.SuppressAutomaticLogs())
                {
                    firstExisting.IsDefault = true;
                    firstExisting.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync(cancellationToken);
                }
                return firstExisting;
            }

            var table = new WeeklyTableInstance
            {
                WeeklyPeriodId = periodId,
                LogicalTableKey = Guid.NewGuid(),
                TableName = DefaultTableName,
                IsDefault = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            using (_db.SuppressAutomaticLogs())
            {
                _db.WeeklyTableInstances.Add(table);
                await _db.SaveChangesAsync(cancellationToken);
            }
            return table;
        }

        private async Task<WeeklyTableInstance> ResolveTableInstanceForMutationAsync(
            long currentPeriodId,
            long? requestedTableId,
            CancellationToken cancellationToken)
        {
            if (requestedTableId is not > 0)
            {
                return await EnsureDefaultTableInstanceAsync(currentPeriodId, cancellationToken);
            }

            var requestedTable = await _db.WeeklyTableInstances
                .FirstOrDefaultAsync(instance => instance.Id == requestedTableId.Value, cancellationToken);

            if (requestedTable == null)
            {
                return await EnsureDefaultTableInstanceAsync(currentPeriodId, cancellationToken);
            }

            if (requestedTable.WeeklyPeriodId == currentPeriodId)
            {
                return requestedTable;
            }

            var mappedTable = await _db.WeeklyTableInstances
                .FirstOrDefaultAsync(instance =>
                    instance.WeeklyPeriodId == currentPeriodId &&
                    instance.LogicalTableKey == requestedTable.LogicalTableKey,
                    cancellationToken);

            if (mappedTable != null)
            {
                return mappedTable;
            }

            var existingTables = await _db.WeeklyTableInstances
                .Where(instance => instance.WeeklyPeriodId == currentPeriodId)
                .ToListAsync(cancellationToken);

            mappedTable = new WeeklyTableInstance
            {
                WeeklyPeriodId = currentPeriodId,
                LogicalTableKey = requestedTable.LogicalTableKey == Guid.Empty
                    ? Guid.NewGuid()
                    : requestedTable.LogicalTableKey,
                TableName = requestedTable.TableName,
                SuggestionSeed = requestedTable.SuggestionSeed,
                IsDefault = existingTables.Count == 0 || (requestedTable.IsDefault && existingTables.All(table => !table.IsDefault)),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            using (_db.SuppressAutomaticLogs())
            {
                _db.WeeklyTableInstances.Add(mappedTable);
                await _db.SaveChangesAsync(cancellationToken);
            }
            return mappedTable;
        }

        private async Task<WeeklyTable?> ResolveRowForMutationAsync(
            long sourceRowId,
            long currentPeriodId,
            long targetTableId,
            CancellationToken cancellationToken)
        {
            var currentRow = await _db.WeeklyTable
                .FirstOrDefaultAsync(row =>
                    row.Id == sourceRowId &&
                    row.WeeklyPeriodId == currentPeriodId &&
                    row.WeeklyTableInstanceId == targetTableId,
                    cancellationToken);

            if (currentRow != null)
            {
                return currentRow;
            }

            var sourceRow = await _db.WeeklyTable
                .AsNoTracking()
                .FirstOrDefaultAsync(row => row.Id == sourceRowId, cancellationToken);

            if (sourceRow == null)
            {
                return null;
            }

            var logicalRowKey = sourceRow.LogicalRowKey == Guid.Empty
                ? Guid.NewGuid()
                : sourceRow.LogicalRowKey;

            var existingClone = await _db.WeeklyTable
                .FirstOrDefaultAsync(row =>
                    row.WeeklyPeriodId == currentPeriodId &&
                    row.WeeklyTableInstanceId == targetTableId &&
                    row.LogicalRowKey == logicalRowKey,
                    cancellationToken);

            if (existingClone != null)
            {
                return existingClone;
            }

            var clone = CloneWeeklyRow(sourceRow, currentPeriodId, targetTableId, DateTime.UtcNow);
            clone.LogicalRowKey = logicalRowKey;
            using (_db.SuppressAutomaticLogs())
            {
                _db.WeeklyTable.Add(clone);
                await _db.SaveChangesAsync(cancellationToken);
            }
            return clone;
        }

        private async Task CloneRowsIntoInstanceAsync(
            long sourceTableId,
            long targetTableId,
            long targetPeriodId,
            CancellationToken cancellationToken)
        {
            var sourceRows = await _db.WeeklyTable
                .AsNoTracking()
                .Where(row => row.WeeklyTableInstanceId == sourceTableId)
                .OrderBy(row => row.Id)
                .ToListAsync(cancellationToken);

            if (sourceRows.Count == 0)
            {
                return;
            }

            var existingKeys = await _db.WeeklyTable
                .AsNoTracking()
                .Where(row => row.WeeklyPeriodId == targetPeriodId && row.WeeklyTableInstanceId == targetTableId)
                .Select(row => row.LogicalRowKey)
                .ToListAsync(cancellationToken);

            var existingKeySet = existingKeys
                .Where(key => key != Guid.Empty)
                .ToHashSet();

            var now = DateTime.UtcNow;

            foreach (var sourceRow in sourceRows)
            {
                var logicalRowKey = sourceRow.LogicalRowKey == Guid.Empty
                    ? Guid.NewGuid()
                    : sourceRow.LogicalRowKey;

                if (existingKeySet.Contains(logicalRowKey))
                {
                    continue;
                }

                existingKeySet.Add(logicalRowKey);
                var clone = CloneWeeklyRow(sourceRow, targetPeriodId, targetTableId, now);
                clone.LogicalRowKey = logicalRowKey;
                _db.WeeklyTable.Add(clone);
            }
        }

        private async Task<List<WeeklyTableInstanceDto>> MapTableInstancesAsync(
            IEnumerable<WeeklyTableInstance> tables,
            CancellationToken cancellationToken)
        {
            var tableList = tables.ToList();
            if (tableList.Count == 0)
            {
                return new List<WeeklyTableInstanceDto>();
            }

            var tableIds = tableList.Select(table => table.Id).ToList();
            var rowCountMap = await _db.WeeklyTable
                .AsNoTracking()
                .Where(row => row.WeeklyTableInstanceId.HasValue && tableIds.Contains(row.WeeklyTableInstanceId.Value))
                .GroupBy(row => row.WeeklyTableInstanceId!.Value)
                .Select(group => new { TableId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(item => item.TableId, item => item.Count, cancellationToken);

            var result = new List<WeeklyTableInstanceDto>(tableList.Count);

            foreach (var table in tableList)
            {
                var dto = _mapper.Map<WeeklyTableInstanceDto>(table);
                dto.RowCount = rowCountMap.TryGetValue(table.Id, out var count) ? count : 0;
                dto.SuggestionValuesByColumn = await BuildSuggestionSeedMapForTableAsync(
                    table.Id,
                    table.SuggestionSeed,
                    cancellationToken);
                result.Add(dto);
            }

            return result;
        }

        private async Task<WeeklyTableInstanceDto> MapTableInstanceAsync(
            WeeklyTableInstance table,
            CancellationToken cancellationToken)
        {
            var dto = _mapper.Map<WeeklyTableInstanceDto>(table);
            dto.RowCount = await _db.WeeklyTable
                .AsNoTracking()
                .CountAsync(row => row.WeeklyTableInstanceId == table.Id, cancellationToken);
            dto.SuggestionValuesByColumn = await BuildSuggestionSeedMapForTableAsync(
                table.Id,
                table.SuggestionSeed,
                cancellationToken);
            return dto;
        }

        private async Task TouchPeriodAsync(long periodId, CancellationToken cancellationToken)
        {
            var period = await _db.WeeklyPeriods.FirstOrDefaultAsync(item => item.Id == periodId, cancellationToken);
            if (period != null)
            {
                period.UpdatedAt = DateTime.UtcNow;
            }
        }

        private async Task TouchTableInstanceAsync(long tableId, CancellationToken cancellationToken)
        {
            var table = await _db.WeeklyTableInstances.FirstOrDefaultAsync(item => item.Id == tableId, cancellationToken);
            if (table != null)
            {
                table.UpdatedAt = DateTime.UtcNow;
            }
        }

        private static WeeklyTable CloneWeeklyRow(
            WeeklyTable sourceRow,
            long targetPeriodId,
            long targetTableId,
            DateTime timestamp)
        {
            return new WeeklyTable
            {
                WeeklyPeriodId = targetPeriodId,
                WeeklyTableInstanceId = targetTableId,
                LogicalRowKey = sourceRow.LogicalRowKey == Guid.Empty ? Guid.NewGuid() : sourceRow.LogicalRowKey,
                Progress = sourceRow.Progress,
                Status = sourceRow.Status,
                Highlights = sourceRow.Highlights,
                WorkInProgress = sourceRow.WorkInProgress,
                Target = sourceRow.Target,
                NextToDo = sourceRow.NextToDo,
                ExtraData = sourceRow.ExtraData,
                CreatedAt = timestamp,
                UpdatedAt = timestamp
            };
        }

        private async Task<Dictionary<string, List<string>>> BuildSuggestionSeedMapForTableAsync(
            long tableId,
            string? existingSuggestionSeed,
            CancellationToken cancellationToken)
        {
            var suggestionMap = DeserializeSuggestionSeed(existingSuggestionSeed);

            var rows = await _db.WeeklyTable
                .AsNoTracking()
                .Where(row => row.WeeklyTableInstanceId == tableId)
                .Select(row => new
                {
                    row.Progress,
                    row.Status,
                    row.Highlights,
                    row.WorkInProgress,
                    row.Target,
                    row.NextToDo
                })
                .ToListAsync(cancellationToken);

            foreach (var row in rows)
            {
                MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.Progress), row.Progress);
                MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.Status), row.Status);
                MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.Highlights), row.Highlights);
                MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.WorkInProgress), row.WorkInProgress);
                MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.Target), row.Target);
                MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.NextToDo), row.NextToDo);
            }

            return NormalizeSuggestionSeedMap(suggestionMap);
        }

        private static void MergeSuggestionSeedIntoTableInstance(
            WeeklyTableInstance table,
            WeeklyTable row)
        {
            var suggestionMap = DeserializeSuggestionSeed(table.SuggestionSeed);
            MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.Progress), row.Progress);
            MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.Status), row.Status);
            MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.Highlights), row.Highlights);
            MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.WorkInProgress), row.WorkInProgress);
            MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.Target), row.Target);
            MergeSuggestionValue(suggestionMap, nameof(WeeklyTable.NextToDo), row.NextToDo);
            table.SuggestionSeed = SerializeSuggestionSeed(NormalizeSuggestionSeedMap(suggestionMap));
            table.UpdatedAt = DateTime.UtcNow;
        }

        private static void MergeSuggestionValue(
            Dictionary<string, List<string>> suggestionMap,
            string column,
            string? value)
        {
            var trimmedValue = (value ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(trimmedValue))
            {
                return;
            }

            if (!suggestionMap.TryGetValue(column, out var values))
            {
                values = new List<string>();
                suggestionMap[column] = values;
            }

            if (!values.Any(item => string.Equals(item, trimmedValue, StringComparison.OrdinalIgnoreCase)))
            {
                values.Add(trimmedValue);
            }
        }

        private static Dictionary<string, List<string>> DeserializeSuggestionSeed(string? rawValue)
        {
            if (string.IsNullOrWhiteSpace(rawValue))
            {
                return new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            }

            try
            {
                var parsed = JsonConvert.DeserializeObject<Dictionary<string, List<string>>>(rawValue);
                return NormalizeSuggestionSeedMap(parsed);
            }
            catch
            {
                return new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            }
        }

        private static Dictionary<string, List<string>> NormalizeSuggestionSeedMap(
            Dictionary<string, List<string>>? suggestionMap)
        {
            var result = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

            if (suggestionMap == null)
            {
                return result;
            }

            foreach (var entry in suggestionMap)
            {
                var normalizedKey = entry.Key?.Trim();
                if (string.IsNullOrWhiteSpace(normalizedKey))
                {
                    continue;
                }

                var normalizedValues = (entry.Value ?? new List<string>())
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Select(value => value.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (normalizedValues.Count > 0)
                {
                    result[normalizedKey] = normalizedValues;
                }
            }

            return result;
        }

        private static string? SerializeSuggestionSeed(Dictionary<string, List<string>> suggestionMap)
        {
            var normalized = NormalizeSuggestionSeedMap(suggestionMap);
            return normalized.Count == 0
                ? null
                : JsonConvert.SerializeObject(normalized, Formatting.None);
        }

        private static Dictionary<string, object> DeserializeExtraData(string? extraData)
        {
            if (string.IsNullOrWhiteSpace(extraData))
            {
                return new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            }

            try
            {
                return JsonConvert.DeserializeObject<Dictionary<string, object>>(extraData)
                    ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            }
            catch
            {
                return new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            }
        }

        private static string? SerializeExtraData(Dictionary<string, object> extraData)
        {
            return extraData.Count == 0
                ? null
                : JsonConvert.SerializeObject(extraData, Formatting.None);
        }

        private static (DateTime start, DateTime end, int year, int weekNumber, string periodCode) GetCurrentWeekWindow()
        {
            var today = DateTime.Today;
            var year = ISOWeek.GetYear(today);
            var weekNumber = ISOWeek.GetWeekOfYear(today);
            var start = ISOWeek.ToDateTime(year, weekNumber, DayOfWeek.Monday);
            var end = start.AddDays(6);
            var periodCode = $"{year}-W{weekNumber:D2}";
            return (start, end, year, weekNumber, periodCode);
        }

        private static string BuildPeriodDisplayName(DateTime start, DateTime end, int weekNumber)
        {
            var startLabel = start.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
            var endLabel = end.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
            return $"Week {weekNumber:D2} • {startLabel} - {endLabel}";
        }
    }
}
