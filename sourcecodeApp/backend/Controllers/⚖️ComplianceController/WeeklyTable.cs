/*
 * PGH-DOC
 * File: Controllers/⚖️ComplianceController/WeeklyTable.cs
 * Apa fungsi bagian ini:
 * - File ini menangani endpoint API dan alur request/response fitur.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using PGH.Dtos.Common;
using PGH.Dtos.Compliance;
using PGH.Helpers;
using PGH.Models.Compliance;
using WebApplication2.Data;
using System.Globalization;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public partial class WeeklyTableController : ControllerBase
    {
        private const string LegacyPeriodCode = "LEGACY-IMPORT";
        private const string DefaultTableName = "Weekly Table";

        private static readonly string[] EditableScalarColumns =
        {
            nameof(WeeklyTable.Progress),
            nameof(WeeklyTable.Status),
            nameof(WeeklyTable.Highlights),
            nameof(WeeklyTable.WorkInProgress),
            nameof(WeeklyTable.Target),
            nameof(WeeklyTable.NextToDo)
        };

        private static readonly Dictionary<string, string> StatusProgressMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Open"] = "0%",
            ["Analisa / Review"] = "17%",
            ["Koordinasi"] = "33%",
            ["Diskusi / Meeting"] = "50%",
            ["Collection"] = "67%",
            ["Validation"] = "83%",
            ["Done"] = "100%"
        };

        private static readonly TableQuerySchema WeeklyQuerySchema = new(
            displayColumns:
            [
                nameof(WeeklyTableReadDto.Progress),
                nameof(WeeklyTableReadDto.Status),
                nameof(WeeklyTableReadDto.Highlights),
                nameof(WeeklyTableReadDto.WorkInProgress),
                nameof(WeeklyTableReadDto.Target),
                nameof(WeeklyTableReadDto.NextToDo)
            ],
            filterableColumns: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                nameof(WeeklyTableReadDto.Progress),
                nameof(WeeklyTableReadDto.Status),
                nameof(WeeklyTableReadDto.Highlights),
                nameof(WeeklyTableReadDto.WorkInProgress),
                nameof(WeeklyTableReadDto.Target),
                nameof(WeeklyTableReadDto.NextToDo),
                nameof(WeeklyTableReadDto.CreatedAt),
                nameof(WeeklyTableReadDto.UpdatedAt)
            },
            searchableColumns: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                nameof(WeeklyTableReadDto.Progress),
                nameof(WeeklyTableReadDto.Status),
                nameof(WeeklyTableReadDto.Highlights),
                nameof(WeeklyTableReadDto.WorkInProgress),
                nameof(WeeklyTableReadDto.Target),
                nameof(WeeklyTableReadDto.NextToDo)
            },
            sortableColumns: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                nameof(WeeklyTableReadDto.Progress),
                nameof(WeeklyTableReadDto.Status),
                nameof(WeeklyTableReadDto.Highlights),
                nameof(WeeklyTableReadDto.WorkInProgress),
                nameof(WeeklyTableReadDto.Target),
                nameof(WeeklyTableReadDto.NextToDo),
                nameof(WeeklyTableReadDto.CreatedAt),
                nameof(WeeklyTableReadDto.UpdatedAt)
            });

        private static readonly string[] DefaultExportColumns =
        [
            nameof(WeeklyTableReadDto.Progress),
            nameof(WeeklyTableReadDto.Status),
            nameof(WeeklyTableReadDto.Highlights),
            nameof(WeeklyTableReadDto.WorkInProgress),
            nameof(WeeklyTableReadDto.Target),
            nameof(WeeklyTableReadDto.NextToDo)
        ];

        private static readonly Dictionary<string, string> ExportColumnLabels =
            new(StringComparer.OrdinalIgnoreCase)
            {
                [nameof(WeeklyTableReadDto.Progress)] = "Progress",
                [nameof(WeeklyTableReadDto.Status)] = "Status",
                [nameof(WeeklyTableReadDto.Highlights)] = "Highlights",
                [nameof(WeeklyTableReadDto.WorkInProgress)] = "Work In Progress",
                [nameof(WeeklyTableReadDto.Target)] = "Target",
                [nameof(WeeklyTableReadDto.NextToDo)] = "Next To Do"
            };

        private readonly IMapper _mapper;
        private readonly AppDbContext _db;

        public WeeklyTableController(IMapper mapper, AppDbContext db)
        {
            _mapper = mapper;
            _db = db;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] long? periodId = null,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                var rows = await GetRowsForReadAsync(periodId, tableId, cancellationToken);
                return Ok(_mapper.Map<List<WeeklyTableReadDto>>(rows));
            }, cancellationToken);
        }

        [HttpPost("query")]
        public async Task<IActionResult> Query(
            [FromBody] TableQueryRequest? request,
            [FromQuery] long? periodId = null,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                var period = await ResolveReadPeriodAsync(periodId, cancellationToken);
                if (period == null)
                {
                    return Ok(BuildEmptyQueryResponse(request));
                }

                var table = await ResolveReadTableAsync(period.Id, tableId, cancellationToken);
                if (tableId.HasValue && table == null)
                {
                    return Ok(BuildEmptyQueryResponse(request));
                }

                var query = _db.WeeklyTable
                    .AsNoTracking()
                    .Where(row => row.WeeklyPeriodId == period.Id);

                if (table != null)
                {
                    query = query.Where(row => row.WeeklyTableInstanceId == table.Id);
                }

                var projectedQuery = query
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
                    });

                var response = await TableQueryHelper.ExecuteAsync(
                    projectedQuery,
                    request,
                    WeeklyQuerySchema,
                    cancellationToken);

                return Ok(response);
            }, cancellationToken);
        }

        [HttpPost("export")]
        public async Task<IActionResult> Export(
            [FromBody] WeeklyTableExportRequest? request,
            [FromQuery] long? periodId = null,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                request ??= new WeeklyTableExportRequest();

                var format = ResolveWeeklyExportFormat(request.Format);
                if (format is not "csv" and not "xlsx")
                {
                    return BadRequest(new
                    {
                        message = "Invalid format. Supported formats are xlsx and csv."
                    });
                }

                var resolvedColumns = ResolveWeeklyExportColumns(request.Columns);
                if ((request.Columns?.Count ?? 0) > 0 && resolvedColumns.Count == 0)
                {
                    return BadRequest(new
                    {
                        message = "No valid export columns were provided.",
                        allowedColumns = DefaultExportColumns
                    });
                }

                var period = await ResolveReadPeriodAsync(periodId, cancellationToken);
                if (period == null)
                {
                    return NotFound("No weekly period data found.");
                }

                var table = await ResolveReadTableAsync(period.Id, tableId, cancellationToken);
                if (tableId.HasValue && table == null)
                {
                    return NotFound("Weekly table instance not found.");
                }

                var projectedRows = await GetProjectedRowsForReadAsync(period.Id, table?.Id, cancellationToken);
                var exportRows = BuildWeeklyExportRows(projectedRows, request);
                var timestamp = DateTime.Now.ToString("yyyy_MM_dd", CultureInfo.InvariantCulture);
                const string filePrefix = "WeeklyTable";

                if (format == "csv")
                {
                    var csvBytes = TableExportHelper.BuildCsvExport(
                        exportRows,
                        resolvedColumns,
                        ResolveWeeklyExportColumnLabel);
                    return File(csvBytes, "text/csv", $"{filePrefix}_{timestamp}.csv");
                }

                var xlsxBytes = TableExportHelper.BuildXlsxExport(
                    exportRows,
                    resolvedColumns,
                    ResolveWeeklyExportColumnLabel,
                    worksheetName: "Weekly Table");

                return File(
                    xlsxBytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"{filePrefix}_{timestamp}.xlsx");
            }, cancellationToken);
        }

        [HttpGet("periods")]
        public async Task<IActionResult> GetPeriods(CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                var periods = await _db.WeeklyPeriods
                    .AsNoTracking()
                    .OrderByDescending(p => p.IsLegacy ? 0 : 1)
                    .ThenByDescending(p => p.WeekStartDate)
                    .ThenByDescending(p => p.CreatedAt)
                    .ToListAsync(cancellationToken);

                var rowCounts = await _db.WeeklyTable
                    .AsNoTracking()
                    .GroupBy(row => row.WeeklyPeriodId)
                    .Select(group => new { WeeklyPeriodId = group.Key, Count = group.Count() })
                    .ToListAsync(cancellationToken);

                var rowCountMap = rowCounts
                    .Where(x => x.WeeklyPeriodId.HasValue)
                    .ToDictionary(x => x.WeeklyPeriodId!.Value, x => x.Count);

                var result = periods.Select(period => new WeeklyPeriodDto
                {
                    Id = period.Id,
                    PeriodCode = period.PeriodCode,
                    DisplayName = period.DisplayName,
                    WeekStartDate = period.WeekStartDate,
                    WeekEndDate = period.WeekEndDate,
                    Year = period.Year,
                    WeekNumber = period.WeekNumber,
                    IsLegacy = period.IsLegacy,
                    RowCount = rowCountMap.TryGetValue(period.Id, out var count) ? count : 0
                }).ToList();

                return Ok(result);
            }, cancellationToken);
        }

        [HttpGet("active-period")]
        public async Task<IActionResult> GetActivePeriod(CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                var period = await ResolveReadPeriodAsync(null, cancellationToken);
                if (period == null)
                {
                    return NotFound("No weekly period data found.");
                }

                var rowCount = await _db.WeeklyTable.CountAsync(row => row.WeeklyPeriodId == period.Id, cancellationToken);

                return Ok(new WeeklyPeriodDto
                {
                    Id = period.Id,
                    PeriodCode = period.PeriodCode,
                    DisplayName = period.DisplayName,
                    WeekStartDate = period.WeekStartDate,
                    WeekEndDate = period.WeekEndDate,
                    Year = period.Year,
                    WeekNumber = period.WeekNumber,
                    IsLegacy = period.IsLegacy,
                    RowCount = rowCount
                });
            }, cancellationToken);
        }

        [HttpGet("tables")]
        public async Task<IActionResult> GetTables(
            [FromQuery] long? periodId = null,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                var period = await ResolveReadPeriodAsync(periodId, cancellationToken);
                if (period == null)
                {
                    return Ok(Array.Empty<WeeklyTableInstanceDto>());
                }

                var tables = await GetTableInstancesForPeriodAsync(period.Id, cancellationToken);
                return Ok(await MapTableInstancesAsync(tables, cancellationToken));
            }, cancellationToken);
        }

        [HttpGet("active-table")]
        public async Task<IActionResult> GetActiveTable(
            [FromQuery] long? periodId = null,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                var period = await ResolveReadPeriodAsync(periodId, cancellationToken);
                if (period == null)
                {
                    return NotFound("No weekly period data found.");
                }

                var table = await ResolveReadTableAsync(period.Id, null, cancellationToken);
                if (table == null)
                {
                    return NotFound("No weekly table instance found.");
                }

                return Ok(await MapTableInstanceAsync(table, cancellationToken));
            }, cancellationToken);
        }

        [HttpPost("tables")]
        public async Task<ActionResult<WeeklyTableInstanceDto>> CreateTable(
            [FromBody] WeeklyTableInstanceCreateDto? request,
            CancellationToken cancellationToken = default)
        {
            var tableName = request?.TableName?.Trim();
            if (string.IsNullOrWhiteSpace(tableName))
            {
                return BadRequest("TableName is required.");
            }

            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            if (request?.PeriodId is > 0 && request.PeriodId != currentPeriod.Id)
            {
                return BadRequest("New table can only be created in the active weekly period.");
            }

            var normalizedName = tableName.ToLowerInvariant();
            var nameExists = await _db.WeeklyTableInstances
                .AnyAsync(instance =>
                    instance.WeeklyPeriodId == currentPeriod.Id &&
                    instance.TableName.ToLower() == normalizedName,
                    cancellationToken);

            if (nameExists)
            {
                return Conflict($"Table '{tableName}' already exists in the active weekly period.");
            }

            var existingTables = await GetTableInstancesForPeriodAsync(currentPeriod.Id, cancellationToken);
            WeeklyTableInstance? sourceTable = null;

            var sourceTableId = request?.CloneFromTableId;
            if (sourceTableId is > 0)
            {
                sourceTable = await _db.WeeklyTableInstances
                    .AsNoTracking()
                    .FirstOrDefaultAsync(instance =>
                        instance.Id == sourceTableId.Value &&
                        instance.WeeklyPeriodId == currentPeriod.Id,
                        cancellationToken);
            }

            if (sourceTable == null)
            {
                sourceTable = existingTables
                    .OrderByDescending(table => table.IsDefault)
                    .ThenBy(table => table.CreatedAt)
                    .ThenBy(table => table.Id)
                    .FirstOrDefault();
            }

            var newTable = new WeeklyTableInstance
            {
                WeeklyPeriodId = currentPeriod.Id,
                LogicalTableKey = Guid.NewGuid(),
                TableName = tableName,
                SuggestionSeed = sourceTable == null
                    ? null
                    : SerializeSuggestionSeed(await BuildSuggestionSeedMapForTableAsync(
                        sourceTable.Id,
                        sourceTable.SuggestionSeed,
                        cancellationToken)),
                IsDefault = existingTables.Count == 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.WeeklyTableInstances.Add(newTable);
            await _db.SaveChangesAsync(cancellationToken);

            if (request?.CloneRows == true && sourceTable != null)
            {
                await CloneRowsIntoInstanceAsync(
                    sourceTable.Id,
                    newTable.Id,
                    currentPeriod.Id,
                    cancellationToken);
            }

            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await TouchTableInstanceAsync(newTable.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(await MapTableInstanceAsync(newTable, cancellationToken));
        }

        [HttpPatch("tables/{id:long}")]
        public async Task<ActionResult<WeeklyTableInstanceDto>> RenameTable(
            long id,
            [FromBody] WeeklyTableInstanceUpdateDto? request,
            CancellationToken cancellationToken = default)
        {
            var tableName = request?.TableName?.Trim();
            if (string.IsNullOrWhiteSpace(tableName))
            {
                return BadRequest("TableName is required.");
            }

            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            var targetTable = await _db.WeeklyTableInstances
                .FirstOrDefaultAsync(instance =>
                    instance.Id == id &&
                    instance.WeeklyPeriodId == currentPeriod.Id,
                    cancellationToken);

            if (targetTable == null)
            {
                return NotFound("Weekly table instance not found.");
            }

            var normalizedName = tableName.ToLowerInvariant();
            var nameExists = await _db.WeeklyTableInstances
                .AnyAsync(instance =>
                    instance.Id != targetTable.Id &&
                    instance.WeeklyPeriodId == currentPeriod.Id &&
                    instance.TableName.ToLower() == normalizedName,
                    cancellationToken);

            if (nameExists)
            {
                return Conflict($"Table '{tableName}' already exists in the active weekly period.");
            }

            targetTable.TableName = tableName;
            targetTable.UpdatedAt = DateTime.UtcNow;
            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(await MapTableInstanceAsync(targetTable, cancellationToken));
        }

        [HttpDelete("tables/{id:long}")]
        public async Task<IActionResult> DeleteTable(
            long id,
            CancellationToken cancellationToken = default)
        {
            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            var tablesInPeriod = await _db.WeeklyTableInstances
                .Where(instance => instance.WeeklyPeriodId == currentPeriod.Id)
                .OrderByDescending(instance => instance.IsDefault)
                .ThenBy(instance => instance.CreatedAt)
                .ThenBy(instance => instance.Id)
                .ToListAsync(cancellationToken);

            var targetTable = tablesInPeriod.FirstOrDefault(instance => instance.Id == id);
            if (targetTable == null)
            {
                return NotFound("Weekly table instance not found.");
            }

            if (tablesInPeriod.Count <= 1)
            {
                return BadRequest("Minimal satu table weekly harus tersisa.");
            }

            var targetRows = await _db.WeeklyTable
                .Where(row =>
                    row.WeeklyPeriodId == currentPeriod.Id &&
                    row.WeeklyTableInstanceId == targetTable.Id)
                .ToListAsync(cancellationToken);

            if (targetRows.Count > 0)
            {
                _db.WeeklyTable.RemoveRange(targetRows);
            }

            _db.WeeklyTableInstances.Remove(targetTable);

            var fallbackTable = tablesInPeriod
                .Where(instance => instance.Id != targetTable.Id)
                .OrderByDescending(instance => instance.IsDefault)
                .ThenBy(instance => instance.CreatedAt)
                .ThenBy(instance => instance.Id)
                .FirstOrDefault();

            if (fallbackTable != null &&
                (targetTable.IsDefault || tablesInPeriod.Where(instance => instance.Id != targetTable.Id).All(instance => !instance.IsDefault)))
            {
                fallbackTable.IsDefault = true;
                fallbackTable.UpdatedAt = DateTime.UtcNow;
            }

            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                DeletedTableId = id,
                ActiveTableId = fallbackTable?.Id
            });
        }

        [HttpPatch("{id:long}")]
        public async Task<IActionResult> PatchWeeklyTable(
            long id,
            [FromBody] Dictionary<string, object>? changes,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            if (changes == null || changes.Count == 0)
            {
                return BadRequest("No changes provided.");
            }

            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            var targetTable = await ResolveTableInstanceForMutationAsync(currentPeriod.Id, tableId, cancellationToken);
            var weeklyTable = await ResolveRowForMutationAsync(id, currentPeriod.Id, targetTable.Id, cancellationToken);

            if (weeklyTable == null)
            {
                return NotFound($"WeeklyTable with id {id} not found.");
            }

            var extraDict = DeserializeExtraData(weeklyTable.ExtraData);

            foreach (var kvp in changes)
            {
                var property = typeof(WeeklyTable).GetProperty(
                    kvp.Key,
                    System.Reflection.BindingFlags.IgnoreCase |
                    System.Reflection.BindingFlags.Public |
                    System.Reflection.BindingFlags.Instance);

                if (property != null &&
                    property.PropertyType == typeof(string) &&
                    EditableScalarColumns.Contains(property.Name, StringComparer.OrdinalIgnoreCase))
                {
                    property.SetValue(weeklyTable, kvp.Value?.ToString());
                    continue;
                }

                if (!string.Equals(kvp.Key, nameof(WeeklyTable.ExtraData), StringComparison.OrdinalIgnoreCase))
                {
                    extraDict[kvp.Key] = kvp.Value ?? string.Empty;
                }
            }

            if (string.IsNullOrWhiteSpace(weeklyTable.Progress) &&
                !string.IsNullOrWhiteSpace(weeklyTable.Status) &&
                StatusProgressMap.TryGetValue(weeklyTable.Status, out var mappedProgress))
            {
                weeklyTable.Progress = mappedProgress;
            }

            weeklyTable.ExtraData = SerializeExtraData(extraDict);
            weeklyTable.UpdatedAt = DateTime.UtcNow;
            MergeSuggestionSeedIntoTableInstance(targetTable, weeklyTable);
            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await TouchTableInstanceAsync(targetTable.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Updated successfully",
                weeklyTable = _mapper.Map<WeeklyTableReadDto>(weeklyTable)
            });
        }

        [HttpPost]
        public async Task<IActionResult> Create(
            [FromBody] WeeklyTableCreateDto? dto,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            var requestedTableId = tableId ?? dto?.WeeklyTableInstanceId;
            var targetTable = await ResolveTableInstanceForMutationAsync(currentPeriod.Id, requestedTableId, cancellationToken);

            var weeklyTable = _mapper.Map<WeeklyTable>(dto ?? new WeeklyTableCreateDto());
            weeklyTable.WeeklyPeriodId = currentPeriod.Id;
            weeklyTable.WeeklyTableInstanceId = targetTable.Id;
            weeklyTable.LogicalRowKey = Guid.NewGuid();
            weeklyTable.CreatedAt = DateTime.UtcNow;
            weeklyTable.UpdatedAt = DateTime.UtcNow;

            if (string.IsNullOrWhiteSpace(weeklyTable.Progress) &&
                !string.IsNullOrWhiteSpace(weeklyTable.Status) &&
                StatusProgressMap.TryGetValue(weeklyTable.Status, out var mappedProgress))
            {
                weeklyTable.Progress = mappedProgress;
            }

            _db.WeeklyTable.Add(weeklyTable);
            MergeSuggestionSeedIntoTableInstance(targetTable, weeklyTable);
            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await TouchTableInstanceAsync(targetTable.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(_mapper.Map<WeeklyTableReadDto>(weeklyTable));
        }

        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete(
            [FromBody] List<long>? ids,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            if (ids == null || ids.Count == 0)
            {
                return BadRequest("No IDs provided.");
            }

            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            var targetTable = await ResolveTableInstanceForMutationAsync(currentPeriod.Id, tableId, cancellationToken);

            var rows = await _db.WeeklyTable
                .Where(row =>
                    ids.Contains(row.Id) &&
                    row.WeeklyPeriodId == currentPeriod.Id &&
                    row.WeeklyTableInstanceId == targetTable.Id)
                .ToListAsync(cancellationToken);

            if (rows.Count == 0)
            {
                return NotFound("No matching rows found.");
            }

            _db.WeeklyTable.RemoveRange(rows);
            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await TouchTableInstanceAsync(targetTable.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new { DeletedCount = rows.Count });
        }

        [HttpPost("extra/bulk")]
        public async Task<IActionResult> AddExtraDataFieldToAll(
            [FromBody] Dictionary<string, object>? newField,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            if (newField == null || newField.Count == 0)
            {
                return BadRequest("No field provided.");
            }

            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            var targetTable = await ResolveTableInstanceForMutationAsync(currentPeriod.Id, tableId, cancellationToken);

            var rows = await _db.WeeklyTable
                .Where(row => row.WeeklyPeriodId == currentPeriod.Id && row.WeeklyTableInstanceId == targetTable.Id)
                .ToListAsync(cancellationToken);

            foreach (var row in rows)
            {
                var dict = DeserializeExtraData(row.ExtraData);
                foreach (var kvp in newField)
                {
                    if (!dict.ContainsKey(kvp.Key))
                    {
                        dict[kvp.Key] = kvp.Value;
                    }
                }

                row.ExtraData = SerializeExtraData(dict);
                row.UpdatedAt = DateTime.UtcNow;
            }

            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await TouchTableInstanceAsync(targetTable.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new { Message = "Field(s) added to all rows." });
        }

        [HttpDelete("extra/bulk/{key}")]
        public async Task<IActionResult> DeleteExtraDataFieldFromAll(
            string key,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            var targetTable = await ResolveTableInstanceForMutationAsync(currentPeriod.Id, tableId, cancellationToken);

            var rows = await _db.WeeklyTable
                .Where(row => row.WeeklyPeriodId == currentPeriod.Id && row.WeeklyTableInstanceId == targetTable.Id)
                .ToListAsync(cancellationToken);

            foreach (var row in rows)
            {
                var dict = DeserializeExtraData(row.ExtraData);
                if (dict.Remove(key))
                {
                    row.ExtraData = SerializeExtraData(dict);
                    row.UpdatedAt = DateTime.UtcNow;
                }
            }

            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await TouchTableInstanceAsync(targetTable.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new { Message = $"Field '{key}' deleted from all rows." });
        }

        [HttpGet("filter")]
        public async Task<IActionResult> GetBy(
            [FromQuery] string column,
            [FromQuery] string value,
            [FromQuery] long? periodId = null,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                if (string.IsNullOrWhiteSpace(column))
                {
                    return BadRequest("Column is required.");
                }

                var prop = typeof(WeeklyTable).GetProperty(
                    column,
                    System.Reflection.BindingFlags.IgnoreCase |
                    System.Reflection.BindingFlags.Public |
                    System.Reflection.BindingFlags.Instance);

                if (prop == null)
                {
                    return BadRequest($"Column '{column}' not found.");
                }

                var rows = await GetRowsForReadAsync(periodId, tableId, cancellationToken);
                var filtered = rows
                    .Where(row => string.Equals(prop.GetValue(row)?.ToString(), value, StringComparison.Ordinal))
                    .ToList();

                return Ok(_mapper.Map<List<WeeklyTableReadDto>>(filtered));
            }, cancellationToken);
        }

        [HttpGet("status-summary")]
        [EnableRateLimiting("dashboard-heavy")]
        public async Task<IActionResult> GetStatusSummary(
            [FromQuery] long? periodId = null,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteWeeklyRequestAsync(async () =>
            {
                var period = await ResolveReadPeriodAsync(periodId, cancellationToken);
                if (period == null)
                {
                    return Ok(new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase));
                }

                var table = await ResolveReadTableAsync(period.Id, tableId, cancellationToken);
                if (tableId.HasValue && table == null)
                {
                    return Ok(new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase));
                }

                var query = _db.WeeklyTable
                    .AsNoTracking()
                    .Where(row => row.WeeklyPeriodId == period.Id);

                if (table != null)
                {
                    query = query.Where(row => row.WeeklyTableInstanceId == table.Id);
                }

                var result = await query
                    .Where(row => !string.IsNullOrWhiteSpace(row.Status))
                    .GroupBy(row => row.Status!.Trim())
                    .Select(group => new
                    {
                        Status = group.Key,
                        Count = group.Count()
                    })
                    .ToListAsync(cancellationToken);

                return Ok(result.ToDictionary(item => item.Status, item => item.Count));
            }, cancellationToken);
        }

        [HttpPatch("{id:long}/progress")]
        public async Task<IActionResult> PatchProgressFromStatus(
            long id,
            [FromQuery] long? tableId = null,
            CancellationToken cancellationToken = default)
        {
            var currentPeriod = await EnsureCurrentPeriodSnapshotAsync(cancellationToken);
            var targetTable = await ResolveTableInstanceForMutationAsync(currentPeriod.Id, tableId, cancellationToken);
            var weeklyTable = await ResolveRowForMutationAsync(id, currentPeriod.Id, targetTable.Id, cancellationToken);

            if (weeklyTable == null)
            {
                return NotFound($"WeeklyTable with id {id} not found.");
            }

            if (string.IsNullOrWhiteSpace(weeklyTable.Status) ||
                !StatusProgressMap.TryGetValue(weeklyTable.Status, out var progress))
            {
                return Ok(new
                {
                    Message = "Progress unchanged because status is not mapped.",
                    weeklyTable = _mapper.Map<WeeklyTableReadDto>(weeklyTable)
                });
            }

            weeklyTable.Progress = progress;
            weeklyTable.UpdatedAt = DateTime.UtcNow;
            MergeSuggestionSeedIntoTableInstance(targetTable, weeklyTable);
            await TouchPeriodAsync(currentPeriod.Id, cancellationToken);
            await TouchTableInstanceAsync(targetTable.Id, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Progress updated from status.",
                weeklyTable = _mapper.Map<WeeklyTableReadDto>(weeklyTable)
            });
        }

        private Task<IActionResult> ExecuteWeeklyRequestAsync(
            Func<Task<IActionResult>> action,
            CancellationToken cancellationToken,
            string message = "Weekly table request was canceled.")
        {
            return RequestCancellationHelper.ExecuteAsync(
                this,
                _ => action(),
                message,
                cancellationToken);
        }

        private static TableQueryResponse BuildEmptyQueryResponse(TableQueryRequest? request)
        {
            var pageSize = request?.PageSize > 0
                ? Math.Min(request.PageSize, TableQueryHelper.MaxPageSize)
                : TableQueryHelper.DefaultPageSize;

            return new TableQueryResponse
            {
                Rows = [],
                Page = 1,
                PageSize = pageSize,
                TotalCount = 0,
                TotalPages = 1,
                HasPreviousPage = false,
                HasNextPage = false
            };
        }
    }
}
