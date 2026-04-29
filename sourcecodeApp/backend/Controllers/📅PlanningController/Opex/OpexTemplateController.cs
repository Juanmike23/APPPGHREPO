/*
 * PGH-DOC
 * File: Controllers/📅PlanningController/Opex/OpexTemplateController.cs
 */

using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using PGH.Dtos.Common;
using PGH.Dtos.Planing.Realization;
using PGH.Helpers;
using PGH.Models.ChangeLog;
using PGH.Models.Planing.Realization;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using WebApplication2.Data;

namespace PGH.Controllers.Planing.BusinessPlan
{
    [ApiController]
    [Route("api/opex")]
    [Route("api/opextemplate")]
    public class OpexTemplateController : ControllerBase
    {
        private const string OpexScope = "OPEX";
        private const string ImportModeMerge = "merge";
        private const string ImportModeReplace = "replace";
        private const string SnapshotSourceImport = "import";
        private const int ExcelParseScanRowLimit = 120_000;
        private const int ExcelParseTrailingEmptyThreshold = 120;
        private const string OverviewCachePrefix = "pgh:opex:overview:";
        private const string HomeSummaryCachePrefix = "pgh:opex:home-summary:";
        private const string DerivedRowsCachePrefix = "pgh:opex:derived:";
        private static readonly TimeSpan ImportJobRetention = TimeSpan.FromHours(6);
        private const int SqlDecimalScale = 12;
        private static readonly TimeSpan OverviewCacheTtl = TimeSpan.FromSeconds(45);
        private static readonly TimeSpan DerivedRowsCacheTtl = TimeSpan.FromSeconds(30);
        private static readonly decimal SqlDecimalMax = 9999999999999999.999999999999m;
        private static readonly decimal SqlDecimalMin = -9999999999999999.999999999999m;
        private static readonly ConcurrentDictionary<long, ConcurrentDictionary<string, byte>> OverviewCacheKeysByTable = new();
        private static readonly ConcurrentDictionary<long, ConcurrentDictionary<string, byte>> HomeSummaryCacheKeysByTable = new();
        private static readonly ConcurrentDictionary<long, ConcurrentDictionary<string, byte>> DerivedRowsCacheKeysByTable = new();
        private static readonly ConcurrentDictionary<string, OpexImportJobState> ImportJobs = new(StringComparer.OrdinalIgnoreCase);
        private static readonly string[] MonthOrder =
            ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        private static readonly decimal[] BudgetGuardrailTargetPctByMonth =
            [7m, 14m, 22m, 30m, 39m, 48m, 58m, 68m, 77m, 85m, 93m, 100m];
        private static readonly Dictionary<string, int[]> QuarterMonths = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Q1"] = [1, 2, 3], ["Q2"] = [4, 5, 6], ["Q3"] = [7, 8, 9], ["Q4"] = [10, 11, 12]
        };
        private static readonly Dictionary<string, int> MonthTokenMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["JAN"]=1,["JANUARI"]=1,["JANUARY"]=1,["FEB"]=2,["FEBRUARI"]=2,["FEBRUARY"]=2,["MAR"]=3,["MARET"]=3,["MARCH"]=3,["APR"]=4,["APRIL"]=4,
            ["MAY"]=5,["MEI"]=5,["JUN"]=6,["JUNI"]=6,["JUNE"]=6,["JUL"]=7,["JULI"]=7,["JULY"]=7,["AUG"]=8,["AGU"]=8,["AGUSTUS"]=8,["AUGUST"]=8,
            ["SEP"]=9,["SEPT"]=9,["SEPTEMBER"]=9,["OCT"]=10,["OKT"]=10,["OKTOBER"]=10,["OCTOBER"]=10,["NOV"]=11,["NOVEMBER"]=11,["DEC"]=12,["DES"]=12,["DESEMBER"]=12,["DECEMBER"]=12
        };
        private static readonly (string Key, int ColumnIndex)[] HeaderLabelColumns =
        [
            (nameof(OpexTemplateReadDto.RealizationLastYearThisMonth), 17),
            (nameof(OpexTemplateReadDto.RealizationThisYearThisMonth), 18),
            (nameof(OpexTemplateReadDto.GrowthRp), 19),
            (nameof(OpexTemplateReadDto.Growth), 20),
            (nameof(OpexTemplateReadDto.FullYearFY), 21),
            (nameof(OpexTemplateReadDto.YTD), 22),
            (nameof(OpexTemplateReadDto.toAngThisYear), 23),
            (nameof(OpexTemplateReadDto.toAngYTDThisYear), 24)
        ];
        private const string OperationalOthersTotalLabel = "Jumlah Beban Operasional Lainnya";
        private static readonly string[] DashboardCategories =
        [
            "Beban Kantor",
            "Beban Teknologi & Telekomunikasi",
            "Beban Penyusutan dan Amortisasi",
            "Beban Personalia",
            "Beban Lainnya",
            OperationalOthersTotalLabel
        ];
        private static readonly TableQuerySchema OpexTemplateQuerySchema =
            new(
                displayColumns:
                [
                    nameof(OpexTemplateReadDto.SIT),
                    nameof(OpexTemplateReadDto.MataAnggaranParent),
                    nameof(OpexTemplateReadDto.MataAnggaranChild),
                    nameof(OpexTemplateReadDto.RowType),
                    nameof(OpexTemplateReadDto.Jan),
                    nameof(OpexTemplateReadDto.Feb),
                    nameof(OpexTemplateReadDto.Mar),
                    nameof(OpexTemplateReadDto.Apr),
                    nameof(OpexTemplateReadDto.May),
                    nameof(OpexTemplateReadDto.Jun),
                    nameof(OpexTemplateReadDto.Jul),
                    nameof(OpexTemplateReadDto.Aug),
                    nameof(OpexTemplateReadDto.Sep),
                    nameof(OpexTemplateReadDto.Oct),
                    nameof(OpexTemplateReadDto.Nov),
                    nameof(OpexTemplateReadDto.Dec),
                    nameof(OpexTemplateReadDto.Accumulated),
                    nameof(OpexTemplateReadDto.RealizationLastYearThisMonth),
                    nameof(OpexTemplateReadDto.RealizationThisYearThisMonth),
                    nameof(OpexTemplateReadDto.GrowthRp),
                    nameof(OpexTemplateReadDto.Growth),
                    nameof(OpexTemplateReadDto.FullYearFY),
                    nameof(OpexTemplateReadDto.YTD),
                    nameof(OpexTemplateReadDto.toAngThisYear),
                    nameof(OpexTemplateReadDto.toAngYTDThisYear),
                    nameof(OpexTemplateReadDto.SisaFY),
                    nameof(OpexTemplateReadDto.CreatedAt),
                    nameof(OpexTemplateReadDto.UpdatedAt)
                ],
                filterableColumns: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    nameof(OpexTemplateReadDto.SIT),
                    nameof(OpexTemplateReadDto.MataAnggaranParent),
                    nameof(OpexTemplateReadDto.MataAnggaranChild),
                    nameof(OpexTemplateReadDto.RowType),
                    nameof(OpexTemplateReadDto.Jan),
                    nameof(OpexTemplateReadDto.Feb),
                    nameof(OpexTemplateReadDto.Mar),
                    nameof(OpexTemplateReadDto.Apr),
                    nameof(OpexTemplateReadDto.May),
                    nameof(OpexTemplateReadDto.Jun),
                    nameof(OpexTemplateReadDto.Jul),
                    nameof(OpexTemplateReadDto.Aug),
                    nameof(OpexTemplateReadDto.Sep),
                    nameof(OpexTemplateReadDto.Oct),
                    nameof(OpexTemplateReadDto.Nov),
                    nameof(OpexTemplateReadDto.Dec),
                    nameof(OpexTemplateReadDto.Accumulated),
                    nameof(OpexTemplateReadDto.RealizationLastYearThisMonth),
                    nameof(OpexTemplateReadDto.RealizationThisYearThisMonth),
                    nameof(OpexTemplateReadDto.GrowthRp),
                    nameof(OpexTemplateReadDto.Growth),
                    nameof(OpexTemplateReadDto.FullYearFY),
                    nameof(OpexTemplateReadDto.YTD),
                    nameof(OpexTemplateReadDto.toAngThisYear),
                    nameof(OpexTemplateReadDto.toAngYTDThisYear),
                    nameof(OpexTemplateReadDto.SisaFY),
                    nameof(OpexTemplateReadDto.CreatedAt),
                    nameof(OpexTemplateReadDto.UpdatedAt)
                },
                searchableColumns: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    nameof(OpexTemplateReadDto.SIT),
                    nameof(OpexTemplateReadDto.MataAnggaranParent),
                    nameof(OpexTemplateReadDto.MataAnggaranChild),
                    nameof(OpexTemplateReadDto.RowType),
                    nameof(OpexTemplateReadDto.Jan),
                    nameof(OpexTemplateReadDto.Feb),
                    nameof(OpexTemplateReadDto.Mar),
                    nameof(OpexTemplateReadDto.Apr),
                    nameof(OpexTemplateReadDto.May),
                    nameof(OpexTemplateReadDto.Jun),
                    nameof(OpexTemplateReadDto.Jul),
                    nameof(OpexTemplateReadDto.Aug),
                    nameof(OpexTemplateReadDto.Sep),
                    nameof(OpexTemplateReadDto.Oct),
                    nameof(OpexTemplateReadDto.Nov),
                    nameof(OpexTemplateReadDto.Dec),
                    nameof(OpexTemplateReadDto.Accumulated),
                    nameof(OpexTemplateReadDto.RealizationLastYearThisMonth),
                    nameof(OpexTemplateReadDto.RealizationThisYearThisMonth),
                    nameof(OpexTemplateReadDto.GrowthRp),
                    nameof(OpexTemplateReadDto.Growth),
                    nameof(OpexTemplateReadDto.FullYearFY),
                    nameof(OpexTemplateReadDto.YTD),
                    nameof(OpexTemplateReadDto.toAngThisYear),
                    nameof(OpexTemplateReadDto.toAngYTDThisYear),
                    nameof(OpexTemplateReadDto.SisaFY)
                },
                sortableColumns: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    nameof(OpexTemplateReadDto.SIT),
                    nameof(OpexTemplateReadDto.MataAnggaranParent),
                    nameof(OpexTemplateReadDto.MataAnggaranChild),
                    nameof(OpexTemplateReadDto.RowType),
                    nameof(OpexTemplateReadDto.Jan),
                    nameof(OpexTemplateReadDto.Feb),
                    nameof(OpexTemplateReadDto.Mar),
                    nameof(OpexTemplateReadDto.Apr),
                    nameof(OpexTemplateReadDto.May),
                    nameof(OpexTemplateReadDto.Jun),
                    nameof(OpexTemplateReadDto.Jul),
                    nameof(OpexTemplateReadDto.Aug),
                    nameof(OpexTemplateReadDto.Sep),
                    nameof(OpexTemplateReadDto.Oct),
                    nameof(OpexTemplateReadDto.Nov),
                    nameof(OpexTemplateReadDto.Dec),
                    nameof(OpexTemplateReadDto.Accumulated),
                    nameof(OpexTemplateReadDto.RealizationLastYearThisMonth),
                    nameof(OpexTemplateReadDto.RealizationThisYearThisMonth),
                    nameof(OpexTemplateReadDto.GrowthRp),
                    nameof(OpexTemplateReadDto.Growth),
                    nameof(OpexTemplateReadDto.FullYearFY),
                    nameof(OpexTemplateReadDto.YTD),
                    nameof(OpexTemplateReadDto.toAngThisYear),
                    nameof(OpexTemplateReadDto.toAngYTDThisYear),
                    nameof(OpexTemplateReadDto.SisaFY),
                    nameof(OpexTemplateReadDto.CreatedAt),
                    nameof(OpexTemplateReadDto.UpdatedAt)
                });

        private static readonly string[] OpexDynamicHeaderColumns =
        [
            nameof(OpexTemplateReadDto.RealizationLastYearThisMonth),
            nameof(OpexTemplateReadDto.RealizationThisYearThisMonth),
            nameof(OpexTemplateReadDto.GrowthRp),
            nameof(OpexTemplateReadDto.Growth),
            nameof(OpexTemplateReadDto.FullYearFY),
            nameof(OpexTemplateReadDto.YTD),
            nameof(OpexTemplateReadDto.toAngThisYear),
            nameof(OpexTemplateReadDto.toAngYTDThisYear)
        ];

        private static readonly (string Key, string Label, string[] Columns)[] OpexExportHeaderGroups =
        [
            ("mutasi", "Mutasi", [nameof(OpexTemplateReadDto.Jan), nameof(OpexTemplateReadDto.Feb), nameof(OpexTemplateReadDto.Mar), nameof(OpexTemplateReadDto.Apr), nameof(OpexTemplateReadDto.May), nameof(OpexTemplateReadDto.Jun), nameof(OpexTemplateReadDto.Jul), nameof(OpexTemplateReadDto.Aug), nameof(OpexTemplateReadDto.Sep), nameof(OpexTemplateReadDto.Oct), nameof(OpexTemplateReadDto.Nov), nameof(OpexTemplateReadDto.Dec), nameof(OpexTemplateReadDto.Accumulated)]),
            ("realisasi", "Realisasi", [nameof(OpexTemplateReadDto.RealizationLastYearThisMonth), nameof(OpexTemplateReadDto.RealizationThisYearThisMonth)]),
            ("growth", "Growth", [nameof(OpexTemplateReadDto.GrowthRp), nameof(OpexTemplateReadDto.Growth)]),
            ("anggaran", "Anggaran", [nameof(OpexTemplateReadDto.FullYearFY), nameof(OpexTemplateReadDto.YTD)]),
            ("achievement", "% achievement", [nameof(OpexTemplateReadDto.toAngThisYear), nameof(OpexTemplateReadDto.toAngYTDThisYear)])
        ];

        private static readonly Dictionary<string, string> OpexBaseExportColumnLabels =
            new(StringComparer.OrdinalIgnoreCase)
            {
                [nameof(OpexTemplateReadDto.SIT)] = "SIT",
                [nameof(OpexTemplateReadDto.MataAnggaranParent)] = "Kelompok Mata Anggaran",
                [nameof(OpexTemplateReadDto.MataAnggaranChild)] = "Detail Mata Anggaran",
                [nameof(OpexTemplateReadDto.Jan)] = "Jan",
                [nameof(OpexTemplateReadDto.Feb)] = "Feb",
                [nameof(OpexTemplateReadDto.Mar)] = "Mar",
                [nameof(OpexTemplateReadDto.Apr)] = "Apr",
                [nameof(OpexTemplateReadDto.May)] = "May",
                [nameof(OpexTemplateReadDto.Jun)] = "Jun",
                [nameof(OpexTemplateReadDto.Jul)] = "Jul",
                [nameof(OpexTemplateReadDto.Aug)] = "Aug",
                [nameof(OpexTemplateReadDto.Sep)] = "Sep",
                [nameof(OpexTemplateReadDto.Oct)] = "Oct",
                [nameof(OpexTemplateReadDto.Nov)] = "Nov",
                [nameof(OpexTemplateReadDto.Dec)] = "Dec",
                [nameof(OpexTemplateReadDto.SisaFY)] = "Sisa Anggaran FY",
                [nameof(OpexTemplateReadDto.CreatedAt)] = "Created At",
                [nameof(OpexTemplateReadDto.UpdatedAt)] = "Updated At"
            };

        private static readonly Dictionary<string, string> OpexMonthIdMap =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["Jan"] = "Januari",
                ["Feb"] = "Februari",
                ["Mar"] = "Maret",
                ["Apr"] = "April",
                ["May"] = "Mei",
                ["Jun"] = "Juni",
                ["Jul"] = "Juli",
                ["Aug"] = "Agustus",
                ["Sep"] = "September",
                ["Oct"] = "Oktober",
                ["Nov"] = "November",
                ["Dec"] = "Desember"
            };

        private readonly AppDbContext _db;
        private readonly IMapper _mapper;
        private readonly IMemoryCache _memoryCache;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OpexTemplateController> _logger;

        private sealed record OpexImportJobState(
            string JobId,
            string Status,
            int ProgressPercent,
            string Step,
            long TableId,
            int? Year,
            string ImportMode,
            string FileName,
            DateTime CreatedAtUtc,
            DateTime? StartedAtUtc,
            DateTime? FinishedAtUtc,
            string? Error,
            object? Result,
            DateTime UpdatedAtUtc,
            DateTime ExpiresAtUtc);

        private sealed record SnapshotOverride(
            bool HasRealizationLastYearOverride,
            decimal? RealizationLastYearThisMonth,
            bool HasRealizationThisYearOverride,
            decimal? RealizationThisYearThisMonth,
            bool HasFullYearFyOverride,
            decimal? FullYearFY,
            int? FullYearFySourceMonthIndex,
            bool HasFullYearFyTimeline);

        private sealed class ParsedOpexTemplateRow
        {
            public OpexTemplate Row { get; init; } = new();
            public bool HasRealizationLastYearOverride { get; init; }
            public decimal? RealizationLastYearThisMonth { get; init; }
            public bool HasRealizationThisYearOverride { get; init; }
            public decimal? RealizationThisYearThisMonth { get; init; }
            public bool HasFullYearFyOverride { get; init; }
        }

        private sealed class DerivedTemplateRow
        {
            public required OpexTemplate Source { get; init; }
            public required OpexTemplateReadDto Dto { get; init; }
            public bool IsDetail { get; init; }
            public string ParentKey { get; init; } = string.Empty;
        }

        public OpexTemplateController(
            AppDbContext db,
            IMapper mapper,
            IMemoryCache memoryCache,
            IServiceScopeFactory scopeFactory,
            ILogger<OpexTemplateController> logger)
        {
            _db = db;
            _mapper = mapper;
            _memoryCache = memoryCache;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        private static bool IsOpexScope(string? scope)
        {
            var normalized = (scope ?? "").Trim();
            return String.Equals(normalized, OpexScope, StringComparison.OrdinalIgnoreCase);
        }

        [HttpGet("table/{tableId:long}")]
        public async Task<IActionResult> GetTableRows(
            long tableId,
            [FromQuery] int? year = null,
            [FromQuery] string mode = "total",
            [FromQuery] string period = "Dec",
            [FromQuery] bool kroOnly = false,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var table = await GetTemplateTableAsync(tableId, cancellationToken);
                if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");

                var targetYear = await ResolveYearAsync(tableId, year, table.Year, cancellationToken);
                var normalizedMode = string.Equals(mode, "monthly", StringComparison.OrdinalIgnoreCase)
                    ? "monthly"
                    : "total";
                var normalizedPeriod = string.IsNullOrWhiteSpace(period) ? "Dec" : period.Trim();

                var dtoRows = await LoadDerivedRowsAsync(
                    table,
                    tableId,
                    targetYear,
                    normalizedMode,
                    normalizedPeriod,
                    kroOnly,
                    cancellationToken);

                return Ok(dtoRows);
            }
            catch (OperationCanceledException) when (RequestCancellationHelper.IsRequestCanceled(this, cancellationToken))
            {
                _logger.LogInformation("GetTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (SqlException ex) when (RequestCancellationHelper.IsCanceledSqlException(this, ex, cancellationToken))
            {
                _logger.LogInformation("GetTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (InvalidOperationException ex) when (RequestCancellationHelper.IsCanceledInvalidOperationException(this, ex, cancellationToken))
            {
                _logger.LogInformation("GetTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
        }

        [HttpPost("table/{tableId:long}/query")]
        public async Task<IActionResult> QueryTableRows(
            long tableId,
            [FromBody] TableQueryRequest? request,
            [FromQuery] int? year = null,
            [FromQuery] string mode = "total",
            [FromQuery] string period = "Dec",
            [FromQuery] bool kroOnly = false,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var table = await GetTemplateTableAsync(tableId, cancellationToken);
                if (table == null) return Ok(BuildEmptyQueryResponse(request));

                var targetYear = await ResolveYearAsync(tableId, year, table.Year, cancellationToken);
                var normalizedMode = string.Equals(mode, "monthly", StringComparison.OrdinalIgnoreCase)
                    ? "monthly"
                    : "total";
                var normalizedPeriod = string.IsNullOrWhiteSpace(period) ? "Dec" : period.Trim();
                var dtoRows = await LoadDerivedRowsAsync(
                    table,
                    tableId,
                    targetYear,
                    normalizedMode,
                    normalizedPeriod,
                    kroOnly,
                    cancellationToken);

                var response = TableQueryHelper.Execute(
                    dtoRows,
                    request,
                    OpexTemplateQuerySchema);

                return Ok(response);
            }
            catch (OperationCanceledException) when (RequestCancellationHelper.IsRequestCanceled(this, cancellationToken))
            {
                _logger.LogInformation("QueryTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (SqlException ex) when (RequestCancellationHelper.IsCanceledSqlException(this, ex, cancellationToken))
            {
                _logger.LogInformation("QueryTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (InvalidOperationException ex) when (RequestCancellationHelper.IsCanceledInvalidOperationException(this, ex, cancellationToken))
            {
                _logger.LogInformation("QueryTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
        }

        [HttpPost("table/{tableId:long}/export")]
        public async Task<IActionResult> ExportTableRows(
            long tableId,
            [FromBody] OpexTableExportRequest? request,
            [FromQuery] int? year = null,
            [FromQuery] string mode = "total",
            [FromQuery] string period = "Dec",
            [FromQuery] bool kroOnly = false,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var table = await GetTemplateTableAsync(tableId, cancellationToken);
                if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");

                request ??= new OpexTableExportRequest();

                var format = ResolveOpexExportFormat(request.Format);
                if (format is not "csv" and not "xlsx")
                {
                    return BadRequest(new
                    {
                        message = "Invalid format. Supported formats are xlsx and csv."
                    });
                }

                var targetYear = await ResolveYearAsync(tableId, year, table.Year, cancellationToken);
                var normalizedMode = string.Equals(mode, "monthly", StringComparison.OrdinalIgnoreCase)
                    ? "monthly"
                    : "total";
                var normalizedPeriod = string.IsNullOrWhiteSpace(period) ? "Dec" : period.Trim();

                var dtoRows = await LoadDerivedRowsAsync(
                    table,
                    tableId,
                    targetYear,
                    normalizedMode,
                    normalizedPeriod,
                    kroOnly,
                    cancellationToken);

                var resolvedColumns = ResolveOpexExportColumns(request.Columns);
                if ((request.Columns?.Count ?? 0) > 0 && resolvedColumns.Count == 0)
                {
                    return BadRequest(new
                    {
                        message = "No valid export columns were provided.",
                        allowedColumns = OpexTemplateQuerySchema.DisplayColumns
                    });
                }

                var exportRows = BuildOpexExportRows(dtoRows, request);
                var columnLabels = await BuildOpexExportColumnLabelsAsync(
                    tableId,
                    targetYear,
                    normalizedMode,
                    normalizedPeriod,
                    cancellationToken);

                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture);
                var safeTableName = SanitizeOpexFileToken(table.TableName) ?? "OPEX";
                var filePrefix = $"{safeTableName}_{targetYear}";

                if (format == "csv")
                {
                    var csvBytes = TableExportHelper.BuildCsvExport(
                        exportRows,
                        resolvedColumns,
                        column => ResolveOpexColumnLabel(column, columnLabels));

                    return File(csvBytes, "text/csv", $"{filePrefix}_{timestamp}.csv");
                }

                var xlsxBytes = BuildOpexXlsxExport(
                    exportRows,
                    resolvedColumns,
                    columnLabels,
                    worksheetName: filePrefix,
                    budgetYear: targetYear);

                return File(
                    xlsxBytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"{filePrefix}_{timestamp}.xlsx");
            }
            catch (OperationCanceledException) when (RequestCancellationHelper.IsRequestCanceled(this, cancellationToken))
            {
                _logger.LogInformation("ExportTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (SqlException ex) when (RequestCancellationHelper.IsCanceledSqlException(this, ex, cancellationToken))
            {
                _logger.LogInformation("ExportTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (InvalidOperationException ex) when (RequestCancellationHelper.IsCanceledInvalidOperationException(this, ex, cancellationToken))
            {
                _logger.LogInformation("ExportTableRows OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
        }

        [HttpGet("table/{tableId:long}/maxmonth")]
        public async Task<IActionResult> GetMaxMonth(
            long tableId,
            [FromQuery] int? year = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var table = await GetTemplateTableAsync(tableId, cancellationToken);
                if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");

                var targetYear = await ResolveYearAsync(tableId, year, table.Year, cancellationToken);
                var metadataMonth = await _db.OpexTemplateHeaders
                    .AsNoTracking()
                    .Where(x => x.PlanningDashboardTableId == tableId && x.Year == targetYear)
                    .Select(x => (int?)x.ReportMonthIndex)
                    .FirstOrDefaultAsync(cancellationToken);

                if (metadataMonth.HasValue && metadataMonth.Value is >= 1 and <= 12)
                {
                    return Ok(new
                    {
                        tableId,
                        year = targetYear,
                        maxMonth = MonthOrder[metadataMonth.Value - 1],
                        monthIndex = metadataMonth.Value
                    });
                }

                var rows = await _db.OpexTemplate.AsNoTracking()
                    .Where(x => x.PlanningDashboardTableId == tableId && x.Year == targetYear)
                    .ToListAsync(cancellationToken);

                var monthIndex = ResolveMaxMonth(rows);
                return Ok(new { tableId, year = targetYear, maxMonth = MonthOrder[monthIndex - 1], monthIndex });
            }
            catch (OperationCanceledException) when (RequestCancellationHelper.IsRequestCanceled(this, cancellationToken))
            {
                _logger.LogInformation("GetMaxMonth OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (SqlException ex) when (RequestCancellationHelper.IsCanceledSqlException(this, ex, cancellationToken))
            {
                _logger.LogInformation("GetMaxMonth OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (InvalidOperationException ex) when (RequestCancellationHelper.IsCanceledInvalidOperationException(this, ex, cancellationToken))
            {
                _logger.LogInformation("GetMaxMonth OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
        }

        [HttpGet("table/{tableId:long}/budget-guardrail-targets")]
        public async Task<IActionResult> GetBudgetGuardrailTargets(
            long tableId,
            [FromQuery] int? year = null,
            CancellationToken cancellationToken = default)
        {
            var table = await GetTemplateTableAsync(tableId, cancellationToken);
            if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");

            var targetYear = await ResolveYearAsync(tableId, year, table.Year, cancellationToken);
            var configuredTargets = await LoadBudgetGuardrailTargetsAsync(tableId, targetYear, cancellationToken);
            var defaultTargets = BuildDefaultBudgetGuardrailTargets();

            var dto = new OpexBudgetGuardrailConfigReadDto
            {
                TableId = tableId,
                TableName = table.TableName,
                Year = targetYear,
                Source = configuredTargets.Count > 0 ? "configured+default" : "default",
                Rows = Enumerable.Range(1, 12)
                    .Select(monthIndex =>
                    {
                        var configured = configuredTargets.TryGetValue(monthIndex, out var targetPct);
                        return new OpexBudgetGuardrailTargetRowDto
                        {
                            MonthIndex = monthIndex,
                            Month = MonthOrder[monthIndex - 1],
                            TargetPct = configured ? targetPct : defaultTargets[monthIndex],
                            DefaultTargetPct = defaultTargets[monthIndex],
                            IsDefault = !configured,
                        };
                    })
                    .ToList()
            };

            return Ok(dto);
        }

        [HttpPut("table/{tableId:long}/budget-guardrail-targets")]
        public async Task<IActionResult> UpdateBudgetGuardrailTargets(
            long tableId,
            [FromBody] OpexBudgetGuardrailConfigUpdateRequest? request,
            [FromQuery] int? year = null,
            CancellationToken cancellationToken = default)
        {
            if (request == null || request.Rows == null || request.Rows.Count == 0)
            {
                return BadRequest("Minimal satu target guardrail harus dikirim.");
            }

            var table = await GetTemplateTableAsync(tableId, cancellationToken);
            if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");

            var requestedYear = request.Year ?? year;
            var targetYear = await ResolveYearAsync(tableId, requestedYear, table.Year, cancellationToken);

            foreach (var row in request.Rows)
            {
                if (row.MonthIndex < 1 || row.MonthIndex > 12)
                {
                    return BadRequest($"MonthIndex {row.MonthIndex} tidak valid. Gunakan 1 sampai 12.");
                }

                if (row.TargetPct.HasValue && (row.TargetPct.Value < 0m || row.TargetPct.Value > 100m))
                {
                    return BadRequest($"TargetPct bulan {row.MonthIndex} harus di antara 0 sampai 100.");
                }
            }

            var monthIndexes = request.Rows
                .Select(item => item.MonthIndex)
                .Distinct()
                .ToArray();

            var existingRows = await _db.OpexBudgetGuardrailConfigs
                .Where(x =>
                    x.PlanningDashboardTableId == tableId &&
                    x.Year == targetYear &&
                    monthIndexes.Contains(x.MonthIndex))
                .ToListAsync(cancellationToken);
            var existingByMonth = existingRows.ToDictionary(x => x.MonthIndex);
            var now = DateTime.UtcNow;

            foreach (var row in request.Rows.GroupBy(item => item.MonthIndex).Select(group => group.Last()))
            {
                if (!row.TargetPct.HasValue)
                {
                    if (existingByMonth.TryGetValue(row.MonthIndex, out var existingToDelete))
                    {
                        _db.OpexBudgetGuardrailConfigs.Remove(existingToDelete);
                    }

                    continue;
                }

                if (!existingByMonth.TryGetValue(row.MonthIndex, out var existing))
                {
                    existing = new OpexBudgetGuardrailConfig
                    {
                        PlanningDashboardTableId = tableId,
                        Year = targetYear,
                        MonthIndex = row.MonthIndex,
                        CreatedAt = now,
                    };
                    _db.OpexBudgetGuardrailConfigs.Add(existing);
                    existingByMonth[row.MonthIndex] = existing;
                }

                existing.TargetPct = Round1(row.TargetPct.Value);
                existing.UpdatedAt = now;
            }

            await _db.SaveChangesAsync(cancellationToken);
            InvalidateTableCaches(tableId);

            return await GetBudgetGuardrailTargets(tableId, targetYear, cancellationToken);
        }

        [HttpGet("table/{tableId:long}/overview")]
        public async Task<IActionResult> GetOverview(
            long tableId,
            [FromQuery] int? year = null,
            [FromQuery] string mode = "total",
            [FromQuery] string period = "Dec",
            [FromQuery] bool kroOnly = false,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var table = await GetTemplateTableAsync(tableId, cancellationToken);
                if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");

            var targetYear = await ResolveYearAsync(tableId, year, table.Year, cancellationToken);
            var normalizedMode = string.Equals(mode, "monthly", StringComparison.OrdinalIgnoreCase)
                ? "monthly"
                : "total";
            var normalizedPeriod = string.IsNullOrWhiteSpace(period) ? "Dec" : period.Trim();
            var cacheKey = BuildOverviewCacheKey(tableId, targetYear, normalizedMode, normalizedPeriod, kroOnly);
            if (_memoryCache.TryGetValue(cacheKey, out object? cachedPayload) && cachedPayload != null)
            {
                return Ok(cachedPayload);
            }

            var allRowsQuery = _db.OpexTemplate
                .AsNoTracking()
                .Where(x => x.PlanningDashboardTableId == tableId);
            allRowsQuery = ApplyKroFilter(allRowsQuery, kroOnly);
            var allRows = await allRowsQuery
                .ToListAsync(cancellationToken);
            var currentRows = allRows
                .Where(x => x.Year == targetYear)
                .ToList();
            var previousRows = await LoadPreviousYearRowsAsync(table, targetYear, cancellationToken);

            var months = ResolvePeriodMonths(normalizedMode, normalizedPeriod);
            var selectedReportMonth = ResolveReportMonth(months);
            var trendMonths = Enumerable.Range(1, selectedReportMonth).ToList();
            var currentYearSnapshotOverrides = await LoadSnapshotOverridesAsync(
                tableId,
                targetYear,
                selectedReportMonth,
                cancellationToken);
            var categories = BuildCategorySummary(
                currentRows,
                previousRows,
                months,
                currentYearSnapshotOverrides);
            var categoriesForTotals = categories
                .Where(x => !string.Equals(x.label, OperationalOthersTotalLabel, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (categoriesForTotals.Count == 0) categoriesForTotals = categories;

            var totalCurr = categoriesForTotals.Sum(x => x.currValue);
            var totalPrev = categoriesForTotals.Sum(x => x.prevValue);
            var totalFY = categoriesForTotals.Sum(x => x.currFY);
            var categoriesYtd = BuildCategorySummary(
                currentRows,
                previousRows,
                trendMonths,
                currentYearSnapshotOverrides);
            var categoriesYtdForTotals = categoriesYtd
                .Where(x => !string.Equals(x.label, OperationalOthersTotalLabel, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (categoriesYtdForTotals.Count == 0) categoriesYtdForTotals = categoriesYtd;

            var totalCurrYtd = categoriesYtdForTotals.Sum(x => x.currValue);
            var totalPrevYtd = categoriesYtdForTotals.Sum(x => x.prevValue);
            var totalFyYtd = categoriesYtdForTotals.Sum(x => x.currFY);

            var availableYears = allRows
                .Select(x => x.Year)
                .Distinct()
                .OrderBy(x => x)
                .ToList();
            if (!availableYears.Contains(targetYear)) availableYears.Add(targetYear);
            availableYears.Sort();

            var headerReportMonth = await _db.OpexTemplateHeaders
                .AsNoTracking()
                .Where(x => x.PlanningDashboardTableId == tableId && x.Year == targetYear)
                .Select(x => (int?)x.ReportMonthIndex)
                .FirstOrDefaultAsync(cancellationToken) ?? ResolveLoadedMaxMonth(currentRows);
            if (headerReportMonth <= 0) headerReportMonth = 12;
            var headerLabels = await ResolveHeaderLabelsAsync(
                tableId,
                targetYear,
                headerReportMonth,
                cancellationToken);
            var monthlyActual = BuildMonthlyActualSeries(currentRows, trendMonths);
            var loadPlot = BuildLoadPlotSeries(currentRows);
            var rowsByYear = allRows
                .GroupBy(x => x.Year)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyList<OpexTemplate>)g.OrderBy(x => x.Id).ToList());
            var snapshotOverridesByYear = new Dictionary<int, IReadOnlyDictionary<string, SnapshotOverride>>();
            foreach (var yearKey in availableYears)
            {
                snapshotOverridesByYear[yearKey] = await LoadSnapshotOverridesAsync(
                    tableId,
                    yearKey,
                    selectedReportMonth,
                    cancellationToken);
            }
            var budgetGuardrailTargets = await LoadBudgetGuardrailTargetsAsync(
                tableId,
                targetYear,
                cancellationToken);
            var yearlyTrend = BuildYearlyUsageTrend(
                rowsByYear,
                availableYears,
                trendMonths,
                snapshotOverridesByYear);
            var budgetGuardrailMonitor = BuildBudgetGuardrailMonitor(
                currentRows,
                previousRows,
                selectedReportMonth,
                currentYearSnapshotOverrides,
                budgetGuardrailTargets);

            var payload = new
            {
                tableId,
                tableName = table.TableName,
                year = targetYear,
                mode = normalizedMode,
                period = normalizedPeriod,
                kroOnly,
                months = months.Select(x => MonthOrder[x - 1]).ToArray(),
                categories = categories.Select(x => new
                {
                    label = x.label,
                    currValue = Round2(x.currValue),
                    prevValue = Round2(x.prevValue),
                    currFY = Round2(x.currFY),
                    diff = Round2(x.currValue - x.prevValue),
                    growthPct = x.prevValue == 0m ? 0m : Round1(((x.currValue - x.prevValue) / x.prevValue) * 100m),
                    runRatePct = x.currFY == 0m ? 0m : Round1((x.currValue / x.currFY) * 100m)
                }),
                totals = new
                {
                    curr = Round2(totalCurr),
                    prev = Round2(totalPrev),
                    fy = Round2(totalFY),
                    percent = totalFY == 0m ? 0m : Round1((totalCurr / totalFY) * 100m)
                },
                totalsYtd = new
                {
                    curr = Round2(totalCurrYtd),
                    prev = Round2(totalPrevYtd),
                    fy = Round2(totalFyYtd),
                    percent = totalFyYtd == 0m ? 0m : Round1((totalCurrYtd / totalFyYtd) * 100m),
                    throughMonth = MonthOrder[selectedReportMonth - 1]
                },
                categoriesYtd = categoriesYtd.Select(x => new
                {
                    label = x.label,
                    currValue = Round2(x.currValue),
                    prevValue = Round2(x.prevValue),
                    currFY = Round2(x.currFY),
                    diff = Round2(x.currValue - x.prevValue),
                    growthPct = x.prevValue == 0m ? 0m : Round1(((x.currValue - x.prevValue) / x.prevValue) * 100m),
                    runRatePct = x.currFY == 0m ? 0m : Round1((x.currValue / x.currFY) * 100m)
                }),
                monthlyActual = new
                {
                    throughMonth = MonthOrder[selectedReportMonth - 1],
                    rows = monthlyActual
                },
                loadPlot = new
                {
                    throughMonth = MonthOrder[selectedReportMonth - 1],
                    rows = loadPlot
                },
                yearlyTrend = yearlyTrend,
                budgetGuardrailMonitor,
                headerLabels,
                availableYears
            };

                CacheOverviewPayload(tableId, cacheKey, payload);
                return Ok(payload);
            }
            catch (OperationCanceledException) when (RequestCancellationHelper.IsRequestCanceled(this, cancellationToken))
            {
                _logger.LogInformation("GetOverview OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (SqlException ex) when (RequestCancellationHelper.IsCanceledSqlException(this, ex, cancellationToken))
            {
                _logger.LogInformation("GetOverview OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
            catch (InvalidOperationException ex) when (RequestCancellationHelper.IsCanceledInvalidOperationException(this, ex, cancellationToken))
            {
                _logger.LogInformation("GetOverview OPEX dibatalkan client. tableId={TableId}, year={Year}", tableId, year);
                return ClientCanceledResult();
            }
        }

        [HttpPost("table/{tableId:long}")]
        public async Task<IActionResult> CreateBlankRow(
            long tableId,
            [FromQuery] int? year = null,
            CancellationToken cancellationToken = default)
        {
            var table = await GetTemplateTableAsync(tableId, cancellationToken);
            if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");
            var targetYear = await ResolveYearAsync(tableId, year, table.Year, cancellationToken);

            var now = DateTime.UtcNow;
            var row = new OpexTemplate
            {
                PlanningDashboardTableId = tableId,
                Year = targetYear,
                IsKro = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            _db.OpexTemplate.Add(row);
            await _db.SaveChangesAsync(cancellationToken);
            InvalidateTableCaches(tableId);
            return Ok(_mapper.Map<OpexTemplateReadDto>(row));
        }

        [HttpPatch("{id:long}")]
        public async Task<IActionResult> PatchRow(
            long id,
            [FromBody] Dictionary<string, object>? changes,
            [FromQuery] long? tableId = null,
            [FromQuery] int? year = null,
            [FromQuery] string mode = "total",
            [FromQuery] string period = "Dec",
            [FromQuery] bool kroOnly = false,
            CancellationToken cancellationToken = default)
        {
            return BadRequest("FullYearFY OPEX hanya bisa diubah melalui import. Edit manual dinonaktifkan.");
        }

        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete(
            [FromBody] List<long>? ids,
            CancellationToken cancellationToken = default)
        {
            if (ids == null || ids.Count == 0) return BadRequest("No IDs provided.");
            var rows = await _db.OpexTemplate.Where(x => ids.Contains(x.Id)).ToListAsync(cancellationToken);
            if (rows.Count == 0) return NotFound("No matching rows found.");
            var affectedTableIds = rows
                .Select(x => x.PlanningDashboardTableId)
                .Distinct()
                .ToArray();
            _db.OpexTemplate.RemoveRange(rows);
            await _db.SaveChangesAsync(cancellationToken);
            foreach (var affectedTableId in affectedTableIds)
            {
                InvalidateTableCaches(affectedTableId);
            }
            return Ok(new { deleted = rows.Count });
        }

        [HttpPost("import/table/{tableId:long}")]
        [RequestSizeLimit(UploadLimitHelper.OpexImportMaxRequestBytes)]
        public async Task<IActionResult> ImportTemplate(
            long tableId,
            IFormFile? file,
            [FromQuery] int? year = null,
            [FromQuery] string? importMode = null,
            CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0) return BadRequest("File is required.");
            if (file.Length > UploadLimitHelper.OpexImportMaxFileBytes)
                return BadRequest($"Ukuran file import OPEX maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.OpexImportMaxFileBytes)}.");
            var ext = Path.GetExtension(file.FileName);
            if (!string.Equals(ext, ".xlsx", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(ext, ".xlsm", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Format file harus .xlsx atau .xlsm.");
            if (!TryNormalizeImportMode(importMode, out var normalizedImportMode, out var importModeError))
            {
                return BadRequest(importModeError);
            }
            var isReplaceImport = string.Equals(normalizedImportMode, ImportModeReplace, StringComparison.OrdinalIgnoreCase);
            var importStopwatch = Stopwatch.StartNew();

            var table = await GetTemplateTableAsync(tableId, cancellationToken);
            if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");

            await using var stream = new MemoryStream();
            await file.CopyToAsync(stream, cancellationToken);
            stream.Position = 0;
            using var package = new ExcelPackage(stream);
            var ws = package.Workbook.Worksheets.FirstOrDefault();
            if (ws == null) return BadRequest("Worksheet tidak ditemukan.");

            var detectedYear = ParseYearFromWorksheet(ws);
            var targetYear = year ?? detectedYear;
            if (year.HasValue && year.Value != detectedYear)
            {
                return BadRequest(
                    $"Tahun file ({detectedYear}) tidak sesuai dengan target import ({year.Value}). Pilih table/year yang sesuai.");
            }
            var importedReportMonth = Math.Clamp(ParseReportMonth(ws), 1, 12);
            List<ParsedOpexTemplateRow> staged;
            try
            {
                staged = ParseRows(ws);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            var duplicateSits = staged
                .Where(item => !string.IsNullOrWhiteSpace(item.Row.SIT))
                .GroupBy(item => item.Row.SIT!, StringComparer.OrdinalIgnoreCase)
                .Where(group => group.Count() > 1)
                .Select(group => group.Key)
                .Take(10)
                .ToList();
            if (duplicateSits.Count > 0)
            {
                return BadRequest(
                    $"Duplikat SIT pada file import: {string.Join(", ", duplicateSits)}. Pastikan setiap SIT unik per tahun.");
            }
            if (staged.Count == 0) return BadRequest("Tidak ada data valid yang terbaca dari template.");
            var importHeaderLabels = ParseHeaderLabels(ws, targetYear, importedReportMonth);
            var parsedMs = importStopwatch.ElapsedMilliseconds;

            using var suppressLogs = _db.SuppressAutomaticLogs();
            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    var cleared = (rowsDeleted: 0, snapshotsDeleted: 0, headersDeleted: 0);
                    if (isReplaceImport)
                    {
                        cleared = await ClearYearDataAsync(tableId, targetYear, cancellationToken);
                    }
                    var clearedMs = importStopwatch.ElapsedMilliseconds;

                var existing = await _db.OpexTemplate
                    .Where(x => x.PlanningDashboardTableId == tableId && x.Year == targetYear)
                    .ToListAsync(cancellationToken);
                var existingHeader = await _db.OpexTemplateHeaders
                    .FirstOrDefaultAsync(
                        x => x.PlanningDashboardTableId == tableId && x.Year == targetYear,
                        cancellationToken);
                var existingHeaderMonth = existingHeader?.ReportMonthIndex is >= 1 and <= 12
                    ? existingHeader.ReportMonthIndex
                    : 0;
                var existingLoadedMaxMonth = ResolveLoadedMaxMonth(existing);
                var existingKnownMaxMonth = Math.Max(existingHeaderMonth, existingLoadedMaxMonth);
                if (existingKnownMaxMonth < 1 || existingKnownMaxMonth > 12)
                {
                    existingKnownMaxMonth = importedReportMonth;
                }

                if (!isReplaceImport && importedReportMonth < existingKnownMaxMonth)
                {
                    return Conflict(
                        $"Import MERGE harus berurutan dan tidak boleh mundur. " +
                        $"Bulan aktif saat ini {MonthOrder[existingKnownMaxMonth - 1]}, " +
                        $"file yang diimport {MonthOrder[importedReportMonth - 1]}. " +
                        "Gunakan file bulan terbaru atau gunakan Replace & Import jika memang ingin reset.");
                }

                var effectiveReportMonth = isReplaceImport
                    ? importedReportMonth
                    : Math.Max(existingKnownMaxMonth, importedReportMonth);
                var didLockToNewerMonth = false;
                var shouldUpdateHeaderLabels =
                    isReplaceImport ||
                    importedReportMonth >= existingKnownMaxMonth ||
                    existingHeader == null;
                var existingBySit = existing.Where(x => !string.IsNullOrWhiteSpace(x.SIT))
                    .GroupBy(x => x.SIT!, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First(), StringComparer.OrdinalIgnoreCase);
                var existingSnapshots = isReplaceImport
                    ? []
                    : await _db.OpexTemplateMonthlySnapshots
                        .Where(x =>
                            x.PlanningDashboardTableId == tableId &&
                            x.Year == targetYear &&
                            x.ReportMonthIndex == importedReportMonth)
                        .ToListAsync(cancellationToken);
                var existingSnapshotsBySit = existingSnapshots
                    .GroupBy(x => x.SIT, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First(), StringComparer.OrdinalIgnoreCase);

                var now = DateTime.UtcNow;
                var inserted = 0;
                var updated = 0;
                var snapshotInserted = 0;
                var snapshotUpdated = 0;
                var snapshotDeleted = 0;
                var previousAutoDetectChanges = _db.ChangeTracker.AutoDetectChangesEnabled;
                _db.ChangeTracker.AutoDetectChangesEnabled = false;
                try
                {
                    foreach (var source in staged)
                    {
                        var sourceRow = source.Row;
                        if (string.IsNullOrWhiteSpace(sourceRow.SIT)) continue;
                        if (!existingBySit.TryGetValue(sourceRow.SIT, out var target))
                        {
                            target = new OpexTemplate
                            {
                                PlanningDashboardTableId = tableId,
                                Year = targetYear,
                                SIT = sourceRow.SIT,
                                CreatedAt = now,
                                UpdatedAt = now
                            };
                            _db.OpexTemplate.Add(target);
                            existingBySit[sourceRow.SIT] = target;
                            inserted++;
                        }
                        else
                        {
                            updated++;
                        }

                        target.MataAnggaranParent = sourceRow.MataAnggaranParent;
                        target.MataAnggaranChild = sourceRow.MataAnggaranChild;
                        target.RowType = sourceRow.RowType;
                        target.IsKro = sourceRow.IsKro;
                        if (source.HasFullYearFyOverride)
                        {
                            target.FullYearFY = sourceRow.FullYearFY;
                        }
                        ApplyMonthCutoff(target, sourceRow, importedReportMonth);
                        target.UpdatedAt = now;

                        var hasSnapshotOverride =
                            source.HasRealizationLastYearOverride ||
                            source.HasRealizationThisYearOverride ||
                            source.HasFullYearFyOverride;
                        var shouldPersistImportMarker =
                            hasSnapshotOverride ||
                            IsDetailTemplateRow(sourceRow);
                        if (!existingSnapshotsBySit.TryGetValue(sourceRow.SIT, out var snapshotRow))
                        {
                            if (shouldPersistImportMarker)
                            {
                                snapshotRow = new OpexTemplateMonthlySnapshot
                                {
                                    PlanningDashboardTableId = tableId,
                                    Year = targetYear,
                                    SIT = sourceRow.SIT,
                                    ReportMonthIndex = importedReportMonth,
                                    HasRealizationLastYearOverride = source.HasRealizationLastYearOverride,
                                    RealizationLastYearThisMonth = source.HasRealizationLastYearOverride
                                        ? source.RealizationLastYearThisMonth
                                        : null,
                                    HasRealizationThisYearOverride = source.HasRealizationThisYearOverride,
                                    RealizationThisYearThisMonth = source.HasRealizationThisYearOverride
                                        ? source.RealizationThisYearThisMonth
                                        : null,
                                    HasFullYearFyOverride = source.HasFullYearFyOverride,
                                    SnapshotSource = SnapshotSourceImport,
                                    FullYearFY = source.HasFullYearFyOverride
                                        ? sourceRow.FullYearFY
                                        : null,
                                    CreatedAt = now,
                                    UpdatedAt = now
                                };
                                _db.OpexTemplateMonthlySnapshots.Add(snapshotRow);
                                existingSnapshotsBySit[sourceRow.SIT] = snapshotRow;
                                snapshotInserted++;
                            }
                        }
                        else
                        {
                            if (!shouldPersistImportMarker)
                            {
                                _db.OpexTemplateMonthlySnapshots.Remove(snapshotRow);
                                existingSnapshotsBySit.Remove(sourceRow.SIT);
                                snapshotDeleted++;
                            }
                            else
                            {
                                snapshotRow.HasRealizationLastYearOverride = source.HasRealizationLastYearOverride;
                                snapshotRow.RealizationLastYearThisMonth = source.HasRealizationLastYearOverride
                                    ? source.RealizationLastYearThisMonth
                                    : null;
                                snapshotRow.HasRealizationThisYearOverride = source.HasRealizationThisYearOverride;
                                snapshotRow.RealizationThisYearThisMonth = source.HasRealizationThisYearOverride
                                    ? source.RealizationThisYearThisMonth
                                    : null;
                                snapshotRow.HasFullYearFyOverride = source.HasFullYearFyOverride;
                                snapshotRow.SnapshotSource = SnapshotSourceImport;
                                snapshotRow.FullYearFY = source.HasFullYearFyOverride
                                    ? sourceRow.FullYearFY
                                    : null;
                                snapshotRow.UpdatedAt = now;
                                snapshotUpdated++;
                            }
                        }
                    }
                }
                finally
                {
                    _db.ChangeTracker.AutoDetectChangesEnabled = previousAutoDetectChanges;
                }
                _db.ChangeTracker.DetectChanges();

                if (shouldUpdateHeaderLabels || existingHeader == null)
                {
                    var labelsForUpsert = shouldUpdateHeaderLabels
                        ? importHeaderLabels
                        : BuildFallbackHeaderLabels(targetYear, effectiveReportMonth);
                    await UpsertHeaderLabelsAsync(
                        tableId,
                        targetYear,
                        effectiveReportMonth,
                        labelsForUpsert,
                        now,
                        cancellationToken);
                }
                else if (existingHeader is not null && existingHeader.ReportMonthIndex != effectiveReportMonth)
                {
                    existingHeader.ReportMonthIndex = effectiveReportMonth;
                    existingHeader.UpdatedAt = now;
                }

                    await _db.SaveChangesAsync(cancellationToken);
                    var upsertMs = importStopwatch.ElapsedMilliseconds;
                    var impactedSits = staged
                        .Select(item => NormalizeSit(item.Row.SIT))
                        .Where(sit => !string.IsNullOrWhiteSpace(sit))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray();
                    await RecalculateDerived(
                        table,
                        targetYear,
                        effectiveReportMonth,
                        cancellationToken,
                        impactedSits: impactedSits);
                    await _db.SaveChangesAsync(cancellationToken);
                    var recalculatedMs = importStopwatch.ElapsedMilliseconds;
                    await transaction.CommitAsync(cancellationToken);
                    importStopwatch.Stop();
                    InvalidateTableCaches(tableId);
                    await TryAppendImportChangeLogAsync(
                        tableId,
                        table.TableName,
                        targetYear,
                        normalizedImportMode,
                        effectiveReportMonth,
                        importedReportMonth,
                        file?.FileName,
                        staged.Count,
                        inserted,
                        updated,
                        cleared,
                        snapshotInserted,
                        snapshotUpdated,
                        snapshotDeleted,
                        cancellationToken);

                    return Ok(new
                    {
                        tableId,
                        tableName = table.TableName,
                        year = targetYear,
                        importMode = normalizedImportMode,
                        reportMonth = MonthOrder[effectiveReportMonth - 1],
                        importedReportMonth = MonthOrder[importedReportMonth - 1],
                        didLockToNewerMonth,
                        processed = staged.Count,
                        inserted,
                        updated,
                        cleared = new
                        {
                            rows = cleared.rowsDeleted,
                            snapshots = cleared.snapshotsDeleted,
                            headers = cleared.headersDeleted
                        },
                        snapshot = new
                        {
                            inserted = snapshotInserted,
                            updated = snapshotUpdated,
                            deleted = snapshotDeleted
                        },
                        performance = new
                        {
                            totalMs = importStopwatch.ElapsedMilliseconds,
                            parseMs = parsedMs,
                            clearMs = Math.Max(0, clearedMs - parsedMs),
                            upsertMs = Math.Max(0, upsertMs - clearedMs),
                            recalculateMs = Math.Max(0, recalculatedMs - upsertMs)
                        }
                    });
                }
                catch (OperationCanceledException) when (RequestCancellationHelper.IsRequestCanceled(this, cancellationToken))
                {
                    await RollbackSafelyAsync(transaction);
                    _logger.LogInformation("Import OPEX dibatalkan oleh client. tableId={TableId}, year={Year}, mode={ImportMode}",
                        tableId,
                        year,
                        normalizedImportMode);
                    return ClientCanceledResult();
                }
                catch (SqlException ex) when (RequestCancellationHelper.IsCanceledSqlException(this, ex, cancellationToken))
                {
                    await RollbackSafelyAsync(transaction);
                    _logger.LogInformation("Import OPEX dibatalkan oleh client. tableId={TableId}, year={Year}, mode={ImportMode}",
                        tableId,
                        year,
                        normalizedImportMode);
                    return ClientCanceledResult();
                }
                catch (InvalidOperationException ex) when (RequestCancellationHelper.IsCanceledInvalidOperationException(this, ex, cancellationToken))
                {
                    await RollbackSafelyAsync(transaction);
                    _logger.LogInformation("Import OPEX dibatalkan oleh client. tableId={TableId}, year={Year}, mode={ImportMode}",
                        tableId,
                        year,
                        normalizedImportMode);
                    return ClientCanceledResult();
                }
                catch
                {
                    await RollbackSafelyAsync(transaction);
                    throw;
                }
            });
        }

        private async Task TryAppendImportChangeLogAsync(
            long tableId,
            string? tableName,
            int targetYear,
            string importMode,
            int effectiveReportMonth,
            int importedReportMonth,
            string? originalFileName,
            int processed,
            int inserted,
            int updated,
            (int rowsDeleted, int snapshotsDeleted, int headersDeleted) cleared,
            int snapshotInserted,
            int snapshotUpdated,
            int snapshotDeleted,
            CancellationToken cancellationToken)
        {
            try
            {
                var userId = FeatureAccessResolver.GetUserId(HttpContext?.User ?? new ClaimsPrincipal());
                var ipAddress = HttpContext?.Connection.RemoteIpAddress?.ToString();
                var safeFileName = System.IO.Path.GetFileName(originalFileName ?? string.Empty);
                var payloadFields = new List<object>
                {
                    new { field = "TableName", label = "Nama Table", after = string.IsNullOrWhiteSpace(tableName) ? "Belum Diisi" : tableName },
                    new { field = "Year", label = "Tahun", after = targetYear.ToString(CultureInfo.InvariantCulture) },
                    new { field = "ImportMode", label = "Mode Import", after = string.IsNullOrWhiteSpace(importMode) ? "-" : importMode.ToUpperInvariant() },
                    new { field = "ImportedReportMonth", label = "Bulan File Import", after = MonthOrder[importedReportMonth - 1] },
                    new { field = "EffectiveReportMonth", label = "Bulan Aktif Setelah Import", after = MonthOrder[effectiveReportMonth - 1] },
                    new { field = "ProcessedRows", label = "Baris Diproses", after = processed.ToString(CultureInfo.InvariantCulture) },
                    new { field = "InsertedRows", label = "Baris Baru", after = inserted.ToString(CultureInfo.InvariantCulture) },
                    new { field = "UpdatedRows", label = "Baris Update", after = updated.ToString(CultureInfo.InvariantCulture) },
                    new { field = "SnapshotInserted", label = "Snapshot Baru", after = snapshotInserted.ToString(CultureInfo.InvariantCulture) },
                    new { field = "SnapshotUpdated", label = "Snapshot Update", after = snapshotUpdated.ToString(CultureInfo.InvariantCulture) }
                };

                if (snapshotDeleted > 0)
                {
                    payloadFields.Add(new { field = "SnapshotDeleted", label = "Snapshot Dihapus", after = snapshotDeleted.ToString(CultureInfo.InvariantCulture) });
                }

                if (cleared.rowsDeleted > 0 || cleared.snapshotsDeleted > 0 || cleared.headersDeleted > 0)
                {
                    payloadFields.Add(new
                    {
                        field = "ClearedData",
                        label = "Data Dibersihkan",
                        after = $"Rows {cleared.rowsDeleted}, Snapshot {cleared.snapshotsDeleted}, Header {cleared.headersDeleted}"
                    });
                }

                if (!string.IsNullOrWhiteSpace(safeFileName))
                {
                    payloadFields.Add(new { field = "ImportFileName", label = "File Import", after = safeFileName });
                }

                var changeSummary = JsonSerializer.Serialize(new
                {
                    kind = "IMPORT",
                    message = $"Import {importMode.ToUpperInvariant()} OPEX {MonthOrder[effectiveReportMonth - 1]} {targetYear} berhasil.",
                    fields = payloadFields
                });

                _db.ChangeLog.Add(new ChangeLog
                {
                    TableName = "OpexTemplate",
                    EntityId = tableId,
                    ScopeTableName = "PlanningDashboardTable",
                    ScopeEntityId = tableId,
                    ChangedBy = userId,
                    ChangeType = "IMPORT",
                    ChangeSummary = changeSummary,
                    Timestamp = DateTime.UtcNow,
                    IPAddress = ipAddress
                });

                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Gagal menulis riwayat import OPEX. tableId={TableId}, year={Year}, mode={ImportMode}",
                    tableId,
                    targetYear,
                    importMode);
            }
        }

        [HttpGet("home-summary")]
        public async Task<IActionResult> GetHomeSummary(CancellationToken cancellationToken = default)
        {
            try
            {
                var table = await _db.PlanningDashboardTables
                    .AsNoTracking()
                    .Where(x => x.Scope != null && x.Scope.ToUpper() == OpexScope)
                    .OrderByDescending(x => x.IsDefault)
                    .ThenByDescending(x => x.UpdatedAt)
                    .ThenByDescending(x => x.CreatedAt)
                    .ThenByDescending(x => x.Id)
                    .FirstOrDefaultAsync(cancellationToken);

                if (table == null)
                {
                    return NotFound("Table dashboard OPEX tidak ditemukan.");
                }

                var cacheKey = BuildHomeSummaryCacheKey(table.Id, table.Year);
                if (_memoryCache.TryGetValue(cacheKey, out object? cachedPayload) && cachedPayload != null)
                {
                    return Ok(cachedPayload);
                }

                var currentRows = await _db.OpexTemplate
                    .AsNoTracking()
                    .Where(x => x.PlanningDashboardTableId == table.Id && x.Year == table.Year)
                    .ToListAsync(cancellationToken);
                var previousRows = await LoadPreviousYearRowsAsync(table, table.Year, cancellationToken);

                var reportMonth = await _db.OpexTemplateHeaders
                    .AsNoTracking()
                    .Where(x => x.PlanningDashboardTableId == table.Id && x.Year == table.Year)
                    .Select(x => (int?)x.ReportMonthIndex)
                    .FirstOrDefaultAsync(cancellationToken) ?? ResolveLoadedMaxMonth(currentRows);
                if (reportMonth <= 0) reportMonth = 12;
                reportMonth = Math.Clamp(reportMonth, 1, 12);

                var activeMonths = Enumerable.Range(1, Math.Clamp(reportMonth, 1, 12)).ToList();
                var snapshotOverrides = await LoadSnapshotOverridesAsync(
                    table.Id,
                    table.Year,
                    reportMonth,
                    cancellationToken);
                var categories = BuildCategorySummary(
                    currentRows,
                    previousRows,
                    activeMonths,
                    snapshotOverrides);
                var focusCategory = categories.FirstOrDefault(item =>
                    string.Equals(item.label, OperationalOthersTotalLabel, StringComparison.OrdinalIgnoreCase));
                var focusRunRatePct = focusCategory.currFY == 0m
                    ? 0m
                    : Round1((focusCategory.currValue / focusCategory.currFY) * 100m);
                var focusGrowthPct = focusCategory.prevValue == 0m
                    ? 0m
                    : Round1(((focusCategory.currValue - focusCategory.prevValue) / focusCategory.prevValue) * 100m);
                var payload = new
                {
                    tableId = table.Id,
                    tableName = table.TableName,
                    year = table.Year,
                    period = MonthOrder[reportMonth - 1],
                    reportMonth = reportMonth,
                    label = OperationalOthersTotalLabel,
                    runRatePct = focusRunRatePct,
                    growthPct = focusGrowthPct,
                    currentValue = Round2(focusCategory.currValue),
                    previousValue = Round2(focusCategory.prevValue),
                    fy = Round2(focusCategory.currFY),
                    hasData = currentRows.Count > 0
                };

                CacheHomeSummaryPayload(table.Id, cacheKey, payload);
                return Ok(payload);
            }
            catch (OperationCanceledException) when (RequestCancellationHelper.IsRequestCanceled(this, cancellationToken))
            {
                _logger.LogInformation("GetHomeSummary OPEX dibatalkan client.");
                return ClientCanceledResult();
            }
            catch (SqlException ex) when (RequestCancellationHelper.IsCanceledSqlException(this, ex, cancellationToken))
            {
                _logger.LogInformation("GetHomeSummary OPEX dibatalkan client.");
                return ClientCanceledResult();
            }
            catch (InvalidOperationException ex) when (RequestCancellationHelper.IsCanceledInvalidOperationException(this, ex, cancellationToken))
            {
                _logger.LogInformation("GetHomeSummary OPEX dibatalkan client.");
                return ClientCanceledResult();
            }
        }

        [HttpPost("import/table/{tableId:long}/async")]
        [RequestSizeLimit(UploadLimitHelper.OpexImportMaxRequestBytes)]
        public async Task<IActionResult> ImportTemplateAsync(
            long tableId,
            IFormFile? file,
            [FromQuery] int? year = null,
            [FromQuery] string? importMode = null,
            CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0) return BadRequest("File is required.");
            if (file.Length > UploadLimitHelper.OpexImportMaxFileBytes)
                return BadRequest($"Ukuran file import OPEX maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.OpexImportMaxFileBytes)}.");
            var ext = Path.GetExtension(file.FileName);
            if (!string.Equals(ext, ".xlsx", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(ext, ".xlsm", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Format file harus .xlsx atau .xlsm.");
            if (!TryNormalizeImportMode(importMode, out var normalizedImportMode, out var importModeError))
            {
                return BadRequest(importModeError);
            }

            await using var stream = new MemoryStream();
            await file.CopyToAsync(stream, cancellationToken);
            var fileBytes = stream.ToArray();
            if (fileBytes.Length == 0) return BadRequest("File is required.");

            CleanupExpiredImportJobs();
            var jobId = Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            var queuedState = new OpexImportJobState(
                JobId: jobId,
                Status: "queued",
                ProgressPercent: 0,
                Step: "Menunggu proses import",
                TableId: tableId,
                Year: year,
                ImportMode: normalizedImportMode,
                FileName: file.FileName,
                CreatedAtUtc: now,
                StartedAtUtc: null,
                FinishedAtUtc: null,
                Error: null,
                Result: null,
                UpdatedAtUtc: now,
                ExpiresAtUtc: now.Add(ImportJobRetention));
            ImportJobs[jobId] = queuedState;

            _ = Task.Run(
                () => RunImportJobAsync(
                    jobId,
                    tableId,
                    fileBytes,
                    file.FileName,
                    file.ContentType,
                    year,
                    normalizedImportMode),
                CancellationToken.None);

            var statusUrl = $"{Request.Scheme}://{Request.Host}/api/opex/import/jobs/{jobId}";
            return Accepted(new
            {
                jobId,
                status = queuedState.Status,
                progressPercent = queuedState.ProgressPercent,
                step = queuedState.Step,
                statusUrl
            });
        }

        [HttpGet("import/jobs/{jobId}")]
        public IActionResult GetImportJobStatus(string jobId)
        {
            if (string.IsNullOrWhiteSpace(jobId))
            {
                return BadRequest("jobId is required.");
            }

            CleanupExpiredImportJobs();
            if (!ImportJobs.TryGetValue(jobId, out var state))
            {
                return NotFound("Import job tidak ditemukan atau sudah kedaluwarsa.");
            }

            return Ok(new
            {
                state.JobId,
                state.Status,
                state.ProgressPercent,
                state.Step,
                state.TableId,
                state.Year,
                state.ImportMode,
                state.FileName,
                state.CreatedAtUtc,
                state.StartedAtUtc,
                state.FinishedAtUtc,
                state.Error,
                state.Result
            });
        }

        [HttpPost("table/{tableId:long}/reset")]
        public async Task<IActionResult> ResetYearData(
            long tableId,
            [FromQuery] int? year = null,
            CancellationToken cancellationToken = default)
        {
            var table = await GetTemplateTableAsync(tableId, cancellationToken);
            if (table == null) return NotFound("Table dashboard OPEX tidak ditemukan.");

            var targetYear = await ResolveYearAsync(tableId, year, table.Year, cancellationToken);
            using var suppressLogs = _db.SuppressAutomaticLogs();
            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    var cleared = await ClearYearDataAsync(tableId, targetYear, cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    InvalidateTableCaches(tableId);

                    return Ok(new
                    {
                        tableId,
                        tableName = table.TableName,
                        year = targetYear,
                        cleared = new
                        {
                            rows = cleared.rowsDeleted,
                            snapshots = cleared.snapshotsDeleted,
                            headers = cleared.headersDeleted
                        }
                    });
                }
                catch (OperationCanceledException) when (RequestCancellationHelper.IsRequestCanceled(this, cancellationToken))
                {
                    await RollbackSafelyAsync(transaction);
                    _logger.LogInformation("Reset OPEX dibatalkan oleh client. tableId={TableId}, year={Year}",
                        tableId,
                        targetYear);
                    return ClientCanceledResult();
                }
                catch (SqlException ex) when (RequestCancellationHelper.IsCanceledSqlException(this, ex, cancellationToken))
                {
                    await RollbackSafelyAsync(transaction);
                    _logger.LogInformation("Reset OPEX dibatalkan oleh client. tableId={TableId}, year={Year}",
                        tableId,
                        targetYear);
                    return ClientCanceledResult();
                }
                catch (InvalidOperationException ex) when (RequestCancellationHelper.IsCanceledInvalidOperationException(this, ex, cancellationToken))
                {
                    await RollbackSafelyAsync(transaction);
                    _logger.LogInformation("Reset OPEX dibatalkan oleh client. tableId={TableId}, year={Year}",
                        tableId,
                        targetYear);
                    return ClientCanceledResult();
                }
                catch
                {
                    await RollbackSafelyAsync(transaction);
                    throw;
                }
            });
        }

        private IActionResult ClientCanceledResult()
        {
            return RequestCancellationHelper.CreateCanceledProblemDetails(this);
        }

        private static async Task RollbackSafelyAsync(IDbContextTransaction transaction)
        {
            try
            {
                await transaction.RollbackAsync(CancellationToken.None);
            }
            catch
            {
                // Ignore rollback cancellation/failure to avoid masking original cause.
            }
        }

        private async Task<PlanningDashboardTable?> GetTemplateTableAsync(long tableId, CancellationToken cancellationToken)
        {
            var table = await _db.PlanningDashboardTables
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == tableId, cancellationToken);
            if (table == null) return null;
            return IsOpexScope(table.Scope) ? table : null;
        }

        private async Task RunImportJobAsync(
            string jobId,
            long tableId,
            byte[] fileBytes,
            string fileName,
            string? contentType,
            int? year,
            string normalizedImportMode)
        {
            var startedAt = DateTime.UtcNow;
            UpdateImportJob(
                jobId,
                current => current with
                {
                    Status = "running",
                    ProgressPercent = 5,
                    Step = "Memulai proses import",
                    StartedAtUtc = startedAt,
                    UpdatedAtUtc = startedAt,
                    ExpiresAtUtc = startedAt.Add(ImportJobRetention)
                });

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var scopedController = ActivatorUtilities.CreateInstance<OpexTemplateController>(scope.ServiceProvider);

                await using var memoryStream = new MemoryStream(fileBytes);
                var formFile = new FormFile(memoryStream, 0, fileBytes.Length, "file", fileName)
                {
                    Headers = new HeaderDictionary(),
                    ContentType = string.IsNullOrWhiteSpace(contentType)
                        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        : contentType
                };

                UpdateImportJob(
                    jobId,
                    current => current with
                    {
                        ProgressPercent = 20,
                        Step = "Memproses data file",
                        UpdatedAtUtc = DateTime.UtcNow
                    });

                var result = await scopedController.ImportTemplate(
                    tableId,
                    formFile,
                    year,
                    normalizedImportMode,
                    CancellationToken.None);

                if (result is ObjectResult objectResult && (objectResult.StatusCode ?? 200) >= 400)
                {
                    var errorText = ExtractObjectResultMessage(objectResult);
                    var finishedAt = DateTime.UtcNow;
                    UpdateImportJob(
                        jobId,
                        current => current with
                        {
                            Status = "failed",
                            ProgressPercent = 100,
                            Step = "Import gagal",
                            Error = errorText,
                            Result = null,
                            FinishedAtUtc = finishedAt,
                            UpdatedAtUtc = finishedAt,
                            ExpiresAtUtc = finishedAt.Add(ImportJobRetention)
                        });
                    return;
                }

                var okValue = result is OkObjectResult ok ? ok.Value : null;
                var successAt = DateTime.UtcNow;
                UpdateImportJob(
                    jobId,
                    current => current with
                    {
                        Status = "completed",
                        ProgressPercent = 100,
                        Step = "Import selesai",
                        Error = null,
                        Result = okValue,
                        FinishedAtUtc = successAt,
                        UpdatedAtUtc = successAt,
                        ExpiresAtUtc = successAt.Add(ImportJobRetention)
                    });
            }
            catch (Exception ex)
            {
                var failedAt = DateTime.UtcNow;
                _logger.LogError(ex, "Async import OPEX failed for job {JobId}.", jobId);
                UpdateImportJob(
                    jobId,
                    current => current with
                    {
                        Status = "failed",
                        ProgressPercent = 100,
                        Step = "Import gagal",
                        Error = ex.Message,
                        Result = null,
                        FinishedAtUtc = failedAt,
                        UpdatedAtUtc = failedAt,
                        ExpiresAtUtc = failedAt.Add(ImportJobRetention)
                    });
            }
        }

        private static string ExtractObjectResultMessage(ObjectResult objectResult)
        {
            if (objectResult.Value == null)
            {
                return $"HTTP {(objectResult.StatusCode ?? 500)}";
            }

            return objectResult.Value switch
            {
                string text => text,
                _ => objectResult.Value.ToString() ?? $"HTTP {(objectResult.StatusCode ?? 500)}"
            };
        }

        private static void UpdateImportJob(
            string jobId,
            Func<OpexImportJobState, OpexImportJobState> updateFactory)
        {
            if (!ImportJobs.TryGetValue(jobId, out var current))
            {
                return;
            }

            ImportJobs[jobId] = updateFactory(current);
        }

        private static void CleanupExpiredImportJobs()
        {
            var now = DateTime.UtcNow;
            foreach (var entry in ImportJobs)
            {
                if (entry.Value.ExpiresAtUtc <= now)
                {
                    ImportJobs.TryRemove(entry.Key, out _);
                }
            }
        }

        private async Task<int> ResolveYearAsync(long tableId, int? year, int fallback, CancellationToken cancellationToken)
        {
            if (year.HasValue && year.Value >= 1900 && year.Value <= 2099) return year.Value;
            var latest = await _db.OpexTemplate.Where(x => x.PlanningDashboardTableId == tableId)
                .OrderByDescending(x => x.Year).Select(x => x.Year).FirstOrDefaultAsync(cancellationToken);
            return latest >= 1900 ? latest : fallback;
        }

        private async Task<List<OpexTemplateReadDto>> LoadDerivedRowsAsync(
            PlanningDashboardTable table,
            long tableId,
            int targetYear,
            string normalizedMode,
            string normalizedPeriod,
            bool kroOnly,
            CancellationToken cancellationToken)
        {
            var cacheKey = BuildDerivedRowsCacheKey(
                tableId,
                targetYear,
                normalizedMode,
                normalizedPeriod,
                kroOnly);

            if (_memoryCache.TryGetValue(cacheKey, out List<OpexTemplateReadDto>? cachedRows) &&
                cachedRows != null)
            {
                return cachedRows;
            }

            var rowsQuery = _db.OpexTemplate
                .AsNoTracking()
                .Where(x => x.PlanningDashboardTableId == tableId && x.Year == targetYear);
            rowsQuery = ApplyKroFilter(rowsQuery, kroOnly);
            var rows = await rowsQuery
                .OrderBy(x => x.Id)
                .ToListAsync(cancellationToken);

            var months = ResolvePeriodMonths(normalizedMode, normalizedPeriod);
            var reportMonth = ResolveReportMonth(months);
            var snapshotOverrides = await LoadSnapshotOverridesAsync(
                tableId,
                targetYear,
                reportMonth,
                cancellationToken);
            var previousRows = await LoadPreviousYearRowsAsync(table, targetYear, cancellationToken);
            var dtoRows = BuildDerivedReadDtos(
                rows,
                previousRows,
                reportMonth,
                months,
                snapshotOverrides);

            _memoryCache.Set(cacheKey, dtoRows, DerivedRowsCacheTtl);
            var keyBucket = DerivedRowsCacheKeysByTable.GetOrAdd(
                tableId,
                _ => new ConcurrentDictionary<string, byte>(StringComparer.Ordinal));
            keyBucket[cacheKey] = 1;

            return dtoRows;
        }

        private async Task<List<OpexTemplate>> LoadPreviousYearRowsAsync(
            PlanningDashboardTable table,
            int targetYear,
            CancellationToken cancellationToken)
        {
            if (targetYear <= 1900)
            {
                return [];
            }

            var previousYear = targetYear - 1;
            var candidateTables = await _db.PlanningDashboardTables
                .AsNoTracking()
                .Where(x => x.Year == previousYear)
                .OrderByDescending(x => x.IsDefault)
                .ThenByDescending(x => x.UpdatedAt)
                .ThenByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .ToListAsync(cancellationToken);

            var tableScopeIsOpex = IsOpexScope(table.Scope);
            PlanningDashboardTable? previousTable;
            if (tableScopeIsOpex)
            {
                previousTable = candidateTables.FirstOrDefault(x => IsOpexScope(x.Scope));
            }
            else
            {
                previousTable = candidateTables.FirstOrDefault(x =>
                    string.Equals(x.Scope, table.Scope, StringComparison.OrdinalIgnoreCase));
            }

            if (previousTable == null)
            {
                return [];
            }

            return await _db.OpexTemplate.AsNoTracking()
                .Where(x => x.PlanningDashboardTableId == previousTable.Id && x.Year == previousYear)
                .ToListAsync(cancellationToken);
        }

        private async Task<Dictionary<string, SnapshotOverride>> LoadSnapshotOverridesAsync(
            long tableId,
            int year,
            int reportMonth,
            CancellationToken cancellationToken)
        {
            var boundedMonth = Math.Clamp(reportMonth, 1, 12);
            var snapshots = await _db.OpexTemplateMonthlySnapshots
                .AsNoTracking()
                .Where(x =>
                    x.PlanningDashboardTableId == tableId &&
                    x.Year == year)
                .ToListAsync(cancellationToken);

            return snapshots
                .Where(x => !string.IsNullOrWhiteSpace(x.SIT))
                .GroupBy(x => NormalizeSit(x.SIT), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        var snapshotItems = g
                            .OrderBy(x => x.ReportMonthIndex)
                            .ThenBy(x => x.Id)
                            .ToList();
                        var exactMonthSnapshot = snapshotItems
                            .Where(x => x.ReportMonthIndex == boundedMonth)
                            .OrderByDescending(x => x.Id)
                            .FirstOrDefault();
                        var exactMonthImportSnapshot =
                            exactMonthSnapshot != null &&
                            string.Equals(
                                NormalizeSnapshotSource(exactMonthSnapshot.SnapshotSource),
                                SnapshotSourceImport,
                                StringComparison.OrdinalIgnoreCase)
                                ? exactMonthSnapshot
                                : null;
                        var exactMonthFy =
                            exactMonthImportSnapshot?.HasFullYearFyOverride == true
                                ? NormalizeFullYearValue(exactMonthImportSnapshot.FullYearFY)
                                : null;
                        return new SnapshotOverride(
                            exactMonthSnapshot?.HasRealizationLastYearOverride ?? false,
                            exactMonthSnapshot?.HasRealizationLastYearOverride == true
                                ? exactMonthSnapshot.RealizationLastYearThisMonth
                                : null,
                            exactMonthSnapshot?.HasRealizationThisYearOverride ?? false,
                            exactMonthSnapshot?.HasRealizationThisYearOverride == true
                                ? exactMonthSnapshot.RealizationThisYearThisMonth
                                : null,
                            exactMonthImportSnapshot?.HasFullYearFyOverride == true && exactMonthFy.HasValue,
                            exactMonthFy,
                            exactMonthImportSnapshot?.ReportMonthIndex,
                            exactMonthImportSnapshot != null);
                    },
                    StringComparer.OrdinalIgnoreCase);
        }

        private async Task<Dictionary<int, decimal>> LoadBudgetGuardrailTargetsAsync(
            long tableId,
            int year,
            CancellationToken cancellationToken)
        {
            var configuredRows = await _db.OpexBudgetGuardrailConfigs
                .AsNoTracking()
                .Where(x => x.PlanningDashboardTableId == tableId && x.Year == year)
                .ToListAsync(cancellationToken);

            return configuredRows
                .Where(x => x.MonthIndex is >= 1 and <= 12)
                .GroupBy(x => x.MonthIndex)
                .ToDictionary(
                    group => group.Key,
                    group => Round1(group.OrderByDescending(item => item.UpdatedAt).ThenByDescending(item => item.Id).First().TargetPct));
        }

        private static Dictionary<int, decimal> BuildDefaultBudgetGuardrailTargets()
        {
            return Enumerable.Range(1, 12)
                .ToDictionary(
                    monthIndex => monthIndex,
                    monthIndex => Round1(BudgetGuardrailTargetPctByMonth[monthIndex - 1]));
        }

        private static object BuildBudgetGuardrailMonitor(
            IReadOnlyCollection<OpexTemplate> currentRows,
            IReadOnlyCollection<OpexTemplate> previousRows,
            int reportMonth,
            IReadOnlyDictionary<string, SnapshotOverride>? snapshotOverrides = null,
            IReadOnlyDictionary<int, decimal>? configuredTargets = null)
        {
            var boundedReportMonth = Math.Clamp(reportMonth, 1, 12);
            var cumulativeMonths = Enumerable.Range(1, boundedReportMonth).ToList();
            var categories = BuildCategorySummary(
                currentRows,
                previousRows,
                cumulativeMonths,
                snapshotOverrides,
                allowStoredFullYearFallback: false);
            var targetByMonth = BuildDefaultBudgetGuardrailTargets();
            if (configuredTargets != null)
            {
                foreach (var item in configuredTargets.Where(item => item.Key is >= 1 and <= 12))
                {
                    targetByMonth[item.Key] = Round1(item.Value);
                }
            }

            var targetPct = targetByMonth[boundedReportMonth];
            var rows = categories
                .Select(item =>
                {
                    var fy = item.currFY > 0m ? item.currFY : (decimal?)null;
                    var actualValue = item.currValue;
                    var targetValue = fy.HasValue
                        ? fy.Value * targetPct / 100m
                        : (decimal?)null;
                    var actualPct = fy.HasValue && fy.Value > 0m
                        ? (actualValue / fy.Value) * 100m
                        : (decimal?)null;
                    var variancePct = actualPct.HasValue
                        ? actualPct.Value - targetPct
                        : (decimal?)null;
                    var status = !fy.HasValue
                        ? "no-fy"
                        : actualPct.GetValueOrDefault() <= targetPct
                            ? "within-target"
                            : "over-target";

                    return new
                    {
                        label = item.label,
                        actualValue = Round2(actualValue),
                        fy = fy.HasValue ? Round2(fy.Value) : (decimal?)null,
                        targetValue = targetValue.HasValue ? Round2(targetValue.Value) : (decimal?)null,
                        actualPct = actualPct.HasValue ? Round1(actualPct.Value) : (decimal?)null,
                        targetPct = Round1(targetPct),
                        variancePct = variancePct.HasValue ? Round1(variancePct.Value) : (decimal?)null,
                        status
                    };
                })
                .ToArray();

            return new
            {
                reportMonth = MonthOrder[boundedReportMonth - 1],
                targetPct = Round1(targetPct),
                source = configuredTargets != null && configuredTargets.Count > 0
                    ? "configured+default"
                    : "default",
                rows
            };
        }

        private async Task<(int rowsDeleted, int snapshotsDeleted, int headersDeleted)> ClearYearDataAsync(
            long tableId,
            int targetYear,
            CancellationToken cancellationToken)
        {
            var rowsDeleted = await _db.OpexTemplate
                .Where(x => x.PlanningDashboardTableId == tableId && x.Year == targetYear)
                .ExecuteDeleteAsync(cancellationToken);
            var snapshotsDeleted = await _db.OpexTemplateMonthlySnapshots
                .Where(x => x.PlanningDashboardTableId == tableId && x.Year == targetYear)
                .ExecuteDeleteAsync(cancellationToken);
            var headersDeleted = await _db.OpexTemplateHeaders
                .Where(x => x.PlanningDashboardTableId == tableId && x.Year == targetYear)
                .ExecuteDeleteAsync(cancellationToken);
            return (rowsDeleted, snapshotsDeleted, headersDeleted);
        }

        private static int ResolveReportMonth(IReadOnlyList<int>? months)
        {
            if (months == null || months.Count == 0) return 12;
            var validMonths = months.Where(month => month is >= 1 and <= 12).ToArray();
            if (validMonths.Length == 0) return 12;
            return validMonths.Max();
        }

        private static int ResolveMaxMonth(IReadOnlyCollection<OpexTemplate> rows)
        {
            var max = 1;
            for (var m = 1; m <= 12; m++) if (rows.Any(x => MonthValue(x, m) != 0m)) max = m;
            return max;
        }

        private static List<int> ResolvePeriodMonths(string mode, string period)
        {
            if (QuarterMonths.TryGetValue((period ?? "").Trim(), out var q))
            {
                return q.ToList();
            }

            var monthly = string.Equals(mode, "monthly", StringComparison.OrdinalIgnoreCase);
            if (!TryMonth(period, out var month))
            {
                return monthly ? [12] : Enumerable.Range(1, 12).ToList();
            }

            return monthly ? [month] : Enumerable.Range(1, month).ToList();
        }

        private static bool IsCumulativeSelection(IReadOnlyList<int> months, int reportMonth)
        {
            if (months == null || months.Count == 0 || reportMonth < 1 || months.Count != reportMonth)
            {
                return false;
            }

            for (var month = 1; month <= reportMonth; month++)
            {
                if (months[month - 1] != month)
                {
                    return false;
                }
            }

            return true;
        }

        private static IQueryable<OpexTemplate> ApplyKroFilter(IQueryable<OpexTemplate> query, bool kroOnly)
        {
            if (!kroOnly)
            {
                return query;
            }

            return query.Where(x =>
                x.IsKro ||
                (x.MataAnggaranChild != null && EF.Functions.Like(x.MataAnggaranChild, "%KRO%")));
        }

        private static List<(string label, decimal currValue, decimal prevValue, decimal currFY)> BuildCategorySummary(
            IReadOnlyCollection<OpexTemplate> currentRows,
            IReadOnlyCollection<OpexTemplate> previousRows,
            IReadOnlyList<int> months,
            IReadOnlyDictionary<string, SnapshotOverride>? snapshotOverrides = null,
            bool allowStoredFullYearFallback = true)
        {
            var currentByParent = currentRows.Where(x => !string.IsNullOrWhiteSpace(x.MataAnggaranParent))
                .GroupBy(x => x.MataAnggaranParent!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First(), StringComparer.OrdinalIgnoreCase);
            var detailRowsByParent = currentRows
                .Where(x => IsDetailTemplateRow(x) && !string.IsNullOrWhiteSpace(x.MataAnggaranParent))
                .GroupBy(x => x.MataAnggaranParent!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Id).ToList(), StringComparer.OrdinalIgnoreCase);
            var prevBySit = previousRows.Where(x => !string.IsNullOrWhiteSpace(x.SIT))
                .GroupBy(x => x.SIT!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First(), StringComparer.OrdinalIgnoreCase);

            var result = new List<(string, decimal, decimal, decimal)>();
            foreach (var label in DashboardCategories)
            {
                if (detailRowsByParent.TryGetValue(label, out var details) && details.Count > 0)
                {
                    var currValue = details.Sum(detail => months.Sum(m => MonthValue(detail, m)));
                    var prevValue = details.Sum(detail =>
                    {
                        if (string.IsNullOrWhiteSpace(detail.SIT) ||
                            !prevBySit.TryGetValue(detail.SIT, out var previous))
                        {
                            return 0m;
                        }

                        return months.Sum(m => MonthValue(previous, m));
                    });
                    var currFY = details.Sum(detail =>
                    {
                        var snapshotOverride = ResolveSnapshotOverride(detail.SIT, snapshotOverrides);
                        var effectiveFullYear = ResolveEffectiveFullYear(
                            detail,
                            snapshotOverride,
                            allowStoredFullYearFallback);
                        return effectiveFullYear ?? 0m;
                    });
                    result.Add((label, currValue, prevValue, currFY));
                    continue;
                }

                if (!currentByParent.TryGetValue(label, out var curr))
                {
                    result.Add((label, 0m, 0m, 0m));
                    continue;
                }

                var fallbackCurrValue = months.Sum(m => MonthValue(curr, m));
                var fallbackPrevValue = !string.IsNullOrWhiteSpace(curr.SIT) && prevBySit.TryGetValue(curr.SIT, out var prev)
                    ? months.Sum(m => MonthValue(prev, m))
                    : 0m;
                var fallbackOverride = ResolveSnapshotOverride(curr.SIT, snapshotOverrides);
                var fallbackFullYear = ResolveEffectiveFullYear(
                    curr,
                    fallbackOverride,
                    allowStoredFullYearFallback);
                result.Add((label, fallbackCurrValue, fallbackPrevValue, fallbackFullYear ?? 0m));
            }
            return result;
        }

        private static List<object> BuildMonthlyActualSeries(
            IReadOnlyCollection<OpexTemplate> currentRows,
            IReadOnlyList<int> months)
        {
            var normalizedMonths = (months ?? [])
                .Where(month => month is >= 1 and <= 12)
                .Distinct()
                .OrderBy(month => month)
                .ToList();

            if (normalizedMonths.Count == 0)
            {
                normalizedMonths = Enumerable.Range(1, 12).ToList();
            }

            var currentByParent = currentRows
                .Where(x => !string.IsNullOrWhiteSpace(x.MataAnggaranParent))
                .GroupBy(x => x.MataAnggaranParent!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.Id).First(),
                    StringComparer.OrdinalIgnoreCase);
            var detailRowsByParent = currentRows
                .Where(x => IsDetailTemplateRow(x) && !string.IsNullOrWhiteSpace(x.MataAnggaranParent))
                .GroupBy(x => x.MataAnggaranParent!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderBy(x => x.Id).ToList(),
                    StringComparer.OrdinalIgnoreCase);

            var categoriesForTotals = DashboardCategories
                .Where(label => !string.Equals(label, OperationalOthersTotalLabel, StringComparison.OrdinalIgnoreCase))
                .SelectMany(label =>
                {
                    if (detailRowsByParent.TryGetValue(label, out var details) && details.Count > 0)
                    {
                        return details;
                    }

                    return currentByParent.TryGetValue(label, out var fallbackRow)
                        ? [fallbackRow]
                        : [];
                })
                .ToList();

            if (categoriesForTotals.Count == 0)
            {
                categoriesForTotals = detailRowsByParent.Count > 0
                    ? detailRowsByParent.Values.SelectMany(x => x).ToList()
                    : currentByParent.Values.ToList();
            }

            var series = new List<object>(normalizedMonths.Count);
            foreach (var monthIndex in normalizedMonths)
            {
                var realization = categoriesForTotals.Sum(row => MonthValue(row, monthIndex));
                series.Add(new
                {
                    month = MonthOrder[monthIndex - 1],
                    realization = Round2(realization)
                });
            }

            return series;
        }

        private static List<object> BuildLoadPlotSeries(
            IReadOnlyCollection<OpexTemplate> currentRows)
        {
            var currentByParent = currentRows
                .Where(x => !string.IsNullOrWhiteSpace(x.MataAnggaranParent))
                .GroupBy(x => x.MataAnggaranParent!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.Id).First(),
                    StringComparer.OrdinalIgnoreCase);
            var detailRowsByParent = currentRows
                .Where(x => IsDetailTemplateRow(x) && !string.IsNullOrWhiteSpace(x.MataAnggaranParent))
                .GroupBy(x => x.MataAnggaranParent!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderBy(x => x.Id).ToList(),
                    StringComparer.OrdinalIgnoreCase);

            var rows = new List<object>();
            foreach (var label in DashboardCategories.Where(label =>
                         !string.Equals(label, OperationalOthersTotalLabel, StringComparison.OrdinalIgnoreCase)))
            {
                IReadOnlyList<OpexTemplate> sourceRows;
                if (detailRowsByParent.TryGetValue(label, out var details) && details.Count > 0)
                {
                    sourceRows = details;
                }
                else if (currentByParent.TryGetValue(label, out var fallbackRow))
                {
                    sourceRows = [fallbackRow];
                }
                else
                {
                    sourceRows = Array.Empty<OpexTemplate>();
                }

                rows.Add(new
                {
                    label,
                    series = Enumerable.Range(1, 12)
                        .Select(monthIndex => Round2(sourceRows.Sum(row => MonthValue(row, monthIndex))))
                        .ToArray()
                });
            }

            return rows;
        }

        private static List<object> BuildYearlyUsageTrend(
            IReadOnlyDictionary<int, IReadOnlyList<OpexTemplate>> rowsByYear,
            IReadOnlyCollection<int> years,
            IReadOnlyList<int> months,
            IReadOnlyDictionary<int, IReadOnlyDictionary<string, SnapshotOverride>> snapshotOverridesByYear)
        {
            var sortedYears = years.OrderBy(x => x).ToList();
            var trend = new List<object>(sortedYears.Count);
            foreach (var year in sortedYears)
            {
                var rows = rowsByYear.TryGetValue(year, out var value)
                    ? value
                    : Array.Empty<OpexTemplate>();
                var yearSnapshots = snapshotOverridesByYear.TryGetValue(year, out var overrideMap)
                    ? overrideMap
                    : null;
                var categories = BuildCategorySummary(
                    rows,
                    Array.Empty<OpexTemplate>(),
                    months,
                    yearSnapshots);
                var categoriesForTotals = categories
                    .Where(x => !string.Equals(x.label, OperationalOthersTotalLabel, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                if (categoriesForTotals.Count == 0)
                {
                    categoriesForTotals = categories;
                }

                var realization = categoriesForTotals.Sum(x => x.currValue);
                var fullYearBudget = categoriesForTotals.Sum(x => x.currFY);
                trend.Add(new
                {
                    year,
                    realization = Round2(realization),
                    fy = Round2(fullYearBudget),
                    usagePct = fullYearBudget == 0m ? 0m : Round1((realization / fullYearBudget) * 100m)
                });
            }

            return trend;
        }

        private static List<OpexTemplateReadDto> BuildDerivedReadDtos(
            IReadOnlyList<OpexTemplate> rows,
            IReadOnlyCollection<OpexTemplate> previousRows,
            int reportMonth,
            IReadOnlyList<int>? selectedMonths = null,
            IReadOnlyDictionary<string, SnapshotOverride>? snapshotOverrides = null)
        {
            var activeMonths = (selectedMonths ?? Enumerable.Range(1, 12).ToList())
                .Where(month => month is >= 1 and <= 12)
                .Distinct()
                .OrderBy(month => month)
                .ToArray();
            if (activeMonths.Length == 0)
            {
                activeMonths = Enumerable.Range(1, 12).ToArray();
            }
            var activeMonthSet = activeMonths.ToHashSet();
            var selectedReportMonth = ResolveReportMonth(activeMonths);
            var cumulativeMonths = Enumerable.Range(1, selectedReportMonth).ToArray();
            var isCumulativeSelection = IsCumulativeSelection(activeMonths, selectedReportMonth);
            var realizationMonths = isCumulativeSelection ? cumulativeMonths : activeMonths;
            var budgetMonthFactor = isCumulativeSelection ? selectedReportMonth : realizationMonths.Length;

            var prevBySit = previousRows
                .Where(x => !string.IsNullOrWhiteSpace(x.SIT))
                .GroupBy(x => x.SIT!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(x => x.Id).First(),
                    StringComparer.OrdinalIgnoreCase);

            var derivedRows = new List<DerivedTemplateRow>(rows.Count);
            foreach (var row in rows)
            {
                var displayCurrent = activeMonths.Sum(m => MonthValue(row, m));
                var realizationCurrent = realizationMonths.Sum(m => MonthValue(row, m));
                OpexTemplate? prevRow = null;
                var hasPrev = !string.IsNullOrWhiteSpace(row.SIT) &&
                              prevBySit.TryGetValue(row.SIT, out prevRow);
                var fallbackPreviousRealization = hasPrev && prevRow != null
                    ? realizationMonths.Sum(m => MonthValue(prevRow, m))
                    : (decimal?)null;
                var snapshotOverride = ResolveSnapshotOverride(row.SIT, snapshotOverrides);
                var effectiveCurrentRealization =
                    isCumulativeSelection && snapshotOverride?.HasRealizationThisYearOverride == true
                        ? snapshotOverride.RealizationThisYearThisMonth.GetValueOrDefault()
                        : realizationCurrent;
                var effectivePreviousRealization =
                    isCumulativeSelection && snapshotOverride?.HasRealizationLastYearOverride == true
                        ? snapshotOverride.RealizationLastYearThisMonth
                        : fallbackPreviousRealization;
                var fullYear = ResolveEffectiveFullYear(row, snapshotOverride);
                var hasValidFullYear = fullYear.HasValue && fullYear.Value > 0m;
                var ytdBudget = hasValidFullYear
                    ? fullYear!.Value * budgetMonthFactor / 12m
                    : (decimal?)null;
                var hasValidYtdBudget = ytdBudget.HasValue && ytdBudget.Value > 0m;
                var toAngThisYear = hasValidFullYear
                    ? (effectiveCurrentRealization / fullYear!.Value) * 100m
                    : (decimal?)null;
                var toAngYtd = hasValidYtdBudget
                    ? (effectiveCurrentRealization / ytdBudget!.Value) * 100m
                    : (decimal?)null;
                decimal? growthRp = effectivePreviousRealization.HasValue
                    ? effectiveCurrentRealization - effectivePreviousRealization.Value
                    : null;
                decimal? growthPct = effectivePreviousRealization.HasValue
                    ? (effectivePreviousRealization.Value == 0m
                        ? 0m
                        : ((effectiveCurrentRealization - effectivePreviousRealization.Value) / effectivePreviousRealization.Value) * 100m)
                    : null;

                var dto = new OpexTemplateReadDto
                {
                    Id = row.Id,
                    PlanningDashboardTableId = row.PlanningDashboardTableId,
                    Year = row.Year,
                    SIT = row.SIT,
                    MataAnggaranParent = row.MataAnggaranParent,
                    MataAnggaranChild = row.MataAnggaranChild,
                    RowType = row.RowType,
                    Jan = activeMonthSet.Contains(1) ? row.Jan : null,
                    Feb = activeMonthSet.Contains(2) ? row.Feb : null,
                    Mar = activeMonthSet.Contains(3) ? row.Mar : null,
                    Apr = activeMonthSet.Contains(4) ? row.Apr : null,
                    May = activeMonthSet.Contains(5) ? row.May : null,
                    Jun = activeMonthSet.Contains(6) ? row.Jun : null,
                    Jul = activeMonthSet.Contains(7) ? row.Jul : null,
                    Aug = activeMonthSet.Contains(8) ? row.Aug : null,
                    Sep = activeMonthSet.Contains(9) ? row.Sep : null,
                    Oct = activeMonthSet.Contains(10) ? row.Oct : null,
                    Nov = activeMonthSet.Contains(11) ? row.Nov : null,
                    Dec = activeMonthSet.Contains(12) ? row.Dec : null,
                    Accumulated = displayCurrent,
                    RealizationLastYearThisMonth = effectivePreviousRealization,
                    RealizationThisYearThisMonth = effectiveCurrentRealization,
                    GrowthRp = growthRp,
                    Growth = growthPct,
                    FullYearFY = fullYear,
                    YTD = ytdBudget,
                    toAngThisYear = toAngThisYear,
                    toAngYTDThisYear = toAngYtd,
                    SisaFY = hasValidFullYear ? fullYear!.Value - effectiveCurrentRealization : null,
                    CreatedAt = row.CreatedAt,
                    UpdatedAt = row.UpdatedAt
                };

                derivedRows.Add(new DerivedTemplateRow
                {
                    Source = row,
                    Dto = dto,
                    IsDetail = IsDetailTemplateRow(row),
                    ParentKey = NormalizeParentGroupKey(row.MataAnggaranParent)
                });
            }

            var detailRows = derivedRows
                .Where(x => x.IsDetail)
                .ToList();
            var detailRowsByParent = detailRows
                .Where(x => !string.IsNullOrWhiteSpace(x.ParentKey))
                .GroupBy(x => x.ParentKey, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

            foreach (var groupRow in derivedRows.Where(x => !x.IsDetail))
            {
                var detailChildren = ResolveDetailChildrenForGroup(
                    groupRow.Source,
                    detailRows,
                    detailRowsByParent);
                if (detailChildren.Count == 0)
                {
                    continue;
                }

                var aggregatedCurrent = detailChildren.Sum(x => x.Dto.RealizationThisYearThisMonth ?? 0m);
                var hasPreviousAggregate = detailChildren.Any(x => x.Dto.RealizationLastYearThisMonth.HasValue);
                var aggregatedPrevious = hasPreviousAggregate
                    ? detailChildren.Sum(x => x.Dto.RealizationLastYearThisMonth ?? 0m)
                    : (decimal?)null;
                var hasFullYearAggregate = detailChildren.Any(x => x.Dto.FullYearFY.HasValue);
                var aggregatedFullYear = hasFullYearAggregate
                    ? detailChildren.Sum(x => x.Dto.FullYearFY ?? 0m)
                    : (decimal?)null;
                var hasYtdAggregate = detailChildren.Any(x => x.Dto.YTD.HasValue);
                var aggregatedYtd = hasYtdAggregate
                    ? detailChildren.Sum(x => x.Dto.YTD ?? 0m)
                    : (decimal?)null;
                var aggregatedAccumulated = detailChildren.Sum(x => x.Dto.Accumulated ?? 0m);

                groupRow.Dto.Accumulated = aggregatedAccumulated;
                groupRow.Dto.RealizationThisYearThisMonth = aggregatedCurrent;
                groupRow.Dto.RealizationLastYearThisMonth = aggregatedPrevious;
                groupRow.Dto.GrowthRp = aggregatedPrevious.HasValue
                    ? aggregatedCurrent - aggregatedPrevious.Value
                    : null;
                groupRow.Dto.Growth = aggregatedPrevious.HasValue
                    ? (aggregatedPrevious.Value == 0m
                        ? 0m
                        : ((aggregatedCurrent - aggregatedPrevious.Value) / aggregatedPrevious.Value) * 100m)
                    : null;
                groupRow.Dto.FullYearFY = aggregatedFullYear;
                groupRow.Dto.YTD = aggregatedYtd;
                groupRow.Dto.toAngThisYear = aggregatedFullYear.HasValue && aggregatedFullYear.Value > 0m
                    ? (aggregatedCurrent / aggregatedFullYear.Value) * 100m
                    : null;
                groupRow.Dto.toAngYTDThisYear = aggregatedYtd.HasValue && aggregatedYtd.Value > 0m
                    ? (aggregatedCurrent / aggregatedYtd.Value) * 100m
                    : null;
                groupRow.Dto.SisaFY = aggregatedFullYear.HasValue
                    ? aggregatedFullYear.Value - aggregatedCurrent
                    : null;
            }

            return derivedRows.Select(x => x.Dto).ToList();
        }

        private static SnapshotOverride? ResolveSnapshotOverride(
            string? sit,
            IReadOnlyDictionary<string, SnapshotOverride>? snapshotOverrides)
        {
            if (snapshotOverrides == null || string.IsNullOrWhiteSpace(sit))
            {
                return null;
            }

            return snapshotOverrides.TryGetValue(sit, out var overrideValue)
                ? overrideValue
                : null;
        }

        private static decimal? ResolveEffectiveFullYear(
            OpexTemplate row,
            SnapshotOverride? snapshotOverride,
            bool allowStoredFullYearFallback = true)
        {
            if (snapshotOverride?.HasFullYearFyOverride == true && snapshotOverride.FullYearFY.HasValue)
            {
                return NormalizeFullYearValue(snapshotOverride.FullYearFY.Value);
            }

            if (!allowStoredFullYearFallback)
            {
                return null;
            }

            if (CanEditFullYearFy(row))
            {
                return null;
            }

            return NormalizeFullYearValue(row.FullYearFY);
        }

        private async Task<HashSet<long>> RecalculateDerived(
            PlanningDashboardTable table,
            int year,
            int reportMonth,
            CancellationToken cancellationToken,
            IReadOnlyCollection<string>? impactedSits = null)
        {
            var changedRowIds = new HashSet<long>();
            var rows = await _db.OpexTemplate
                .Where(x => x.PlanningDashboardTableId == table.Id && x.Year == year)
                .OrderBy(x => x.Id).ToListAsync(cancellationToken);
            if (rows.Count == 0) return changedRowIds;

            var prevRows = await LoadPreviousYearRowsAsync(table, year, cancellationToken);
            var prevBySit = prevRows.Where(x => !string.IsNullOrWhiteSpace(x.SIT))
                .GroupBy(x => x.SIT!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First(), StringComparer.OrdinalIgnoreCase);
            var boundedReportMonth = Math.Clamp(reportMonth, 1, 12);
            var snapshotOverrides = await LoadSnapshotOverridesAsync(
                table.Id,
                year,
                boundedReportMonth,
                cancellationToken);
            var cumulativeMonths = Enumerable.Range(1, boundedReportMonth).ToArray();
            var normalizedImpactedSits = BuildImpactedSitScope(impactedSits);
            var useIncrementalScope =
                normalizedImpactedSits.Count > 0 &&
                normalizedImpactedSits.Count <= Math.Max(250, rows.Count / 2);

            var now = DateTime.UtcNow;
            var baseRows = useIncrementalScope
                ? rows.Where(row =>
                    IsDetailTemplateRow(row) &&
                    IsSitInImpactedScope(row.SIT, normalizedImpactedSits))
                : rows;
            foreach (var row in baseRows)
            {
                var curr = cumulativeMonths.Sum(m => MonthValue(row, m));
                OpexTemplate? prevRow = null;
                var hasPrev = !string.IsNullOrWhiteSpace(row.SIT) &&
                              prevBySit.TryGetValue(row.SIT, out prevRow);
                var fallbackPrev = hasPrev && prevRow != null
                    ? cumulativeMonths.Sum(m => MonthValue(prevRow, m))
                    : (decimal?)null;
                var snapshotOverride = ResolveSnapshotOverride(row.SIT, snapshotOverrides);
                var effectiveCurrentRealization =
                    snapshotOverride?.HasRealizationThisYearOverride == true
                        ? snapshotOverride.RealizationThisYearThisMonth.GetValueOrDefault()
                        : curr;
                var effectivePreviousRealization =
                    snapshotOverride?.HasRealizationLastYearOverride == true
                        ? snapshotOverride.RealizationLastYearThisMonth
                        : fallbackPrev;
                var effectiveFullYear = ResolveEffectiveFullYear(row, snapshotOverride);
                var hasValidFullYear = effectiveFullYear.HasValue && effectiveFullYear.Value > 0m;
                var ytdBudget = hasValidFullYear
                    ? effectiveFullYear!.Value * boundedReportMonth / 12m
                    : (decimal?)null;
                decimal? nextGrowthRp = effectivePreviousRealization.HasValue
                    ? effectiveCurrentRealization - effectivePreviousRealization.Value
                    : null;
                decimal? nextGrowth = effectivePreviousRealization.HasValue
                    ? (effectivePreviousRealization.Value == 0m
                        ? 0m
                        : ((effectiveCurrentRealization - effectivePreviousRealization.Value) / effectivePreviousRealization.Value) * 100m)
                    : null;
                decimal? nextToAngThisYear = hasValidFullYear
                    ? (effectiveCurrentRealization / effectiveFullYear!.Value) * 100m
                    : null;
                decimal? nextToAngYtdThisYear = ytdBudget.HasValue && ytdBudget.Value > 0m
                    ? (effectiveCurrentRealization / ytdBudget.Value) * 100m
                    : null;
                decimal? nextSisaFy = hasValidFullYear
                    ? effectiveFullYear!.Value - effectiveCurrentRealization
                    : null;
                var rowChanged = false;

                if (row.Accumulated != curr)
                {
                    row.Accumulated = curr;
                    rowChanged = true;
                }
                if (row.RealizationThisYearThisMonth != effectiveCurrentRealization)
                {
                    row.RealizationThisYearThisMonth = effectiveCurrentRealization;
                    rowChanged = true;
                }
                if (row.RealizationLastYearThisMonth != effectivePreviousRealization)
                {
                    row.RealizationLastYearThisMonth = effectivePreviousRealization;
                    rowChanged = true;
                }
                if (row.GrowthRp != nextGrowthRp)
                {
                    row.GrowthRp = nextGrowthRp;
                    rowChanged = true;
                }
                if (row.Growth != nextGrowth)
                {
                    row.Growth = nextGrowth;
                    rowChanged = true;
                }
                if (row.FullYearFY != effectiveFullYear)
                {
                    row.FullYearFY = effectiveFullYear;
                    rowChanged = true;
                }
                if (row.YTD != ytdBudget)
                {
                    row.YTD = ytdBudget;
                    rowChanged = true;
                }
                if (row.toAngThisYear != nextToAngThisYear)
                {
                    row.toAngThisYear = nextToAngThisYear;
                    rowChanged = true;
                }
                if (row.toAngYTDThisYear != nextToAngYtdThisYear)
                {
                    row.toAngYTDThisYear = nextToAngYtdThisYear;
                    rowChanged = true;
                }
                if (row.SisaFY != nextSisaFy)
                {
                    row.SisaFY = nextSisaFy;
                    rowChanged = true;
                }

                if (rowChanged)
                {
                    row.UpdatedAt = now;
                    changedRowIds.Add(row.Id);
                }
            }

            var detailRows = rows
                .Where(IsDetailTemplateRow)
                .ToList();
            var detailRowsByParent = detailRows
                .Where(row => !string.IsNullOrWhiteSpace(NormalizeParentGroupKey(row.MataAnggaranParent)))
                .GroupBy(row => NormalizeParentGroupKey(row.MataAnggaranParent), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);
            var impactedDetailRows = useIncrementalScope
                ? detailRows
                    .Where(row => IsSitInImpactedScope(row.SIT, normalizedImpactedSits))
                    .ToList()
                : [];
            var impactedDetailRowsByParent = useIncrementalScope
                ? impactedDetailRows
                    .Where(row => !string.IsNullOrWhiteSpace(NormalizeParentGroupKey(row.MataAnggaranParent)))
                    .GroupBy(row => NormalizeParentGroupKey(row.MataAnggaranParent), StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, List<OpexTemplate>>(StringComparer.OrdinalIgnoreCase);

            var groupRows = useIncrementalScope
                ? rows
                    .Where(row => !IsDetailTemplateRow(row))
                    .Where(groupRow =>
                        ResolveDetailChildrenForGroup(
                            groupRow,
                            impactedDetailRows,
                            impactedDetailRowsByParent).Count > 0)
                : rows.Where(row => !IsDetailTemplateRow(row));
            foreach (var groupRow in groupRows)
            {
                var detailChildren = ResolveDetailChildrenForGroup(
                    groupRow,
                    detailRows,
                    detailRowsByParent);
                if (detailChildren.Count == 0)
                {
                    continue;
                }

                var aggregatedCurrent = detailChildren.Sum(x => x.RealizationThisYearThisMonth ?? 0m);
                var hasPreviousAggregate = detailChildren.Any(x => x.RealizationLastYearThisMonth.HasValue);
                var aggregatedPrevious = hasPreviousAggregate
                    ? detailChildren.Sum(x => x.RealizationLastYearThisMonth ?? 0m)
                    : (decimal?)null;
                var hasFullYearAggregate = detailChildren.Any(x => x.FullYearFY.HasValue);
                var aggregatedFullYear = hasFullYearAggregate
                    ? detailChildren.Sum(x => x.FullYearFY ?? 0m)
                    : (decimal?)null;
                var hasYtdAggregate = detailChildren.Any(x => x.YTD.HasValue);
                var aggregatedYtd = hasYtdAggregate
                    ? detailChildren.Sum(x => x.YTD ?? 0m)
                    : (decimal?)null;
                var aggregatedAccumulated = detailChildren.Sum(x => x.Accumulated ?? 0m);

                decimal? nextGrowthRp = aggregatedPrevious.HasValue
                    ? aggregatedCurrent - aggregatedPrevious.Value
                    : null;
                decimal? nextGrowth = aggregatedPrevious.HasValue
                    ? (aggregatedPrevious.Value == 0m
                        ? 0m
                        : ((aggregatedCurrent - aggregatedPrevious.Value) / aggregatedPrevious.Value) * 100m)
                    : null;
                decimal? nextToAngThisYear = aggregatedFullYear.HasValue && aggregatedFullYear.Value > 0m
                    ? (aggregatedCurrent / aggregatedFullYear.Value) * 100m
                    : null;
                decimal? nextToAngYtdThisYear = aggregatedYtd.HasValue && aggregatedYtd.Value > 0m
                    ? (aggregatedCurrent / aggregatedYtd.Value) * 100m
                    : null;
                decimal? nextSisaFy = aggregatedFullYear.HasValue
                    ? aggregatedFullYear.Value - aggregatedCurrent
                    : null;
                var rowChanged = false;

                if (groupRow.Accumulated != aggregatedAccumulated)
                {
                    groupRow.Accumulated = aggregatedAccumulated;
                    rowChanged = true;
                }
                if (groupRow.RealizationThisYearThisMonth != aggregatedCurrent)
                {
                    groupRow.RealizationThisYearThisMonth = aggregatedCurrent;
                    rowChanged = true;
                }
                if (groupRow.RealizationLastYearThisMonth != aggregatedPrevious)
                {
                    groupRow.RealizationLastYearThisMonth = aggregatedPrevious;
                    rowChanged = true;
                }
                if (groupRow.GrowthRp != nextGrowthRp)
                {
                    groupRow.GrowthRp = nextGrowthRp;
                    rowChanged = true;
                }
                if (groupRow.Growth != nextGrowth)
                {
                    groupRow.Growth = nextGrowth;
                    rowChanged = true;
                }
                if (groupRow.FullYearFY != aggregatedFullYear)
                {
                    groupRow.FullYearFY = aggregatedFullYear;
                    rowChanged = true;
                }
                if (groupRow.YTD != aggregatedYtd)
                {
                    groupRow.YTD = aggregatedYtd;
                    rowChanged = true;
                }
                if (groupRow.toAngThisYear != nextToAngThisYear)
                {
                    groupRow.toAngThisYear = nextToAngThisYear;
                    rowChanged = true;
                }
                if (groupRow.toAngYTDThisYear != nextToAngYtdThisYear)
                {
                    groupRow.toAngYTDThisYear = nextToAngYtdThisYear;
                    rowChanged = true;
                }
                if (groupRow.SisaFY != nextSisaFy)
                {
                    groupRow.SisaFY = nextSisaFy;
                    rowChanged = true;
                }

                if (rowChanged)
                {
                    groupRow.UpdatedAt = now;
                    changedRowIds.Add(groupRow.Id);
                }
            }

            return changedRowIds;
        }

        private static HashSet<string> BuildImpactedSitScope(IReadOnlyCollection<string>? impactedSits)
        {
            var normalized = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (impactedSits == null || impactedSits.Count == 0)
            {
                return normalized;
            }

            foreach (var sit in impactedSits)
            {
                var token = NormalizeSit(sit);
                if (!string.IsNullOrWhiteSpace(token))
                {
                    normalized.Add(token);
                }
            }

            return normalized;
        }

        private static bool IsSitInImpactedScope(string? sit, IReadOnlyCollection<string> impactedSits)
        {
            if (impactedSits == null || impactedSits.Count == 0)
            {
                return false;
            }

            var normalized = NormalizeSit(sit);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return false;
            }

            foreach (var impacted in impactedSits)
            {
                if (string.Equals(impacted, normalized, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (IsSitAncestor(impacted, normalized) || IsSitAncestor(normalized, impacted))
                {
                    return true;
                }
            }

            return false;
        }

        private static List<DerivedTemplateRow> ResolveDetailChildrenForGroup(
            OpexTemplate groupRow,
            IReadOnlyList<DerivedTemplateRow> detailRows,
            IReadOnlyDictionary<string, List<DerivedTemplateRow>> detailRowsByParent)
        {
            if (detailRows.Count == 0)
            {
                return [];
            }

            var groupSit = NormalizeSit(groupRow.SIT);
            if (!string.IsNullOrWhiteSpace(groupSit))
            {
                var bySit = detailRows
                    .Where(detail => IsSitAncestor(groupSit, detail.Source.SIT))
                    .ToList();
                if (bySit.Count > 0)
                {
                    return bySit;
                }
            }

            var parentKey = NormalizeParentGroupKey(groupRow.MataAnggaranParent);
            if (!string.IsNullOrWhiteSpace(parentKey) &&
                detailRowsByParent.TryGetValue(parentKey, out var byParent) &&
                byParent.Count > 0)
            {
                return byParent;
            }

            if (IsOperationalOthersTotalLabel(parentKey))
            {
                var operationalParentLabels = new HashSet<string>(
                    DashboardCategories
                        .Where(label => !IsOperationalOthersTotalLabel(label))
                        .Select(NormalizeParentGroupKey),
                    StringComparer.OrdinalIgnoreCase);

                var byOperationalParent = detailRows
                    .Where(detail =>
                        !string.IsNullOrWhiteSpace(detail.Source.MataAnggaranParent) &&
                        operationalParentLabels.Contains(NormalizeParentGroupKey(detail.Source.MataAnggaranParent)))
                    .ToList();

                if (byOperationalParent.Count > 0)
                {
                    return byOperationalParent;
                }

                return detailRows.ToList();
            }

            return [];
        }

        private static List<OpexTemplate> ResolveDetailChildrenForGroup(
            OpexTemplate groupRow,
            IReadOnlyList<OpexTemplate> detailRows,
            IReadOnlyDictionary<string, List<OpexTemplate>> detailRowsByParent)
        {
            if (detailRows.Count == 0)
            {
                return [];
            }

            var groupSit = NormalizeSit(groupRow.SIT);
            if (!string.IsNullOrWhiteSpace(groupSit))
            {
                var bySit = detailRows
                    .Where(detail => IsSitAncestor(groupSit, detail.SIT))
                    .ToList();
                if (bySit.Count > 0)
                {
                    return bySit;
                }
            }

            var parentKey = NormalizeParentGroupKey(groupRow.MataAnggaranParent);
            if (!string.IsNullOrWhiteSpace(parentKey) &&
                detailRowsByParent.TryGetValue(parentKey, out var byParent) &&
                byParent.Count > 0)
            {
                return byParent;
            }

            if (IsOperationalOthersTotalLabel(parentKey))
            {
                var operationalParentLabels = new HashSet<string>(
                    DashboardCategories
                        .Where(label => !IsOperationalOthersTotalLabel(label))
                        .Select(NormalizeParentGroupKey),
                    StringComparer.OrdinalIgnoreCase);

                var byOperationalParent = detailRows
                    .Where(detail =>
                        !string.IsNullOrWhiteSpace(detail.MataAnggaranParent) &&
                        operationalParentLabels.Contains(NormalizeParentGroupKey(detail.MataAnggaranParent)))
                    .ToList();

                if (byOperationalParent.Count > 0)
                {
                    return byOperationalParent;
                }

                return detailRows.ToList();
            }

            return [];
        }

        private static Dictionary<string, string> BuildFallbackHeaderLabels(int year, int reportMonth)
        {
            var boundedMonth = Math.Clamp(reportMonth, 1, 12);
            var monthToken = MonthOrder[boundedMonth - 1];
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [nameof(OpexTemplateReadDto.RealizationLastYearThisMonth)] = $"{monthToken} {year - 1}",
                [nameof(OpexTemplateReadDto.RealizationThisYearThisMonth)] = $"{monthToken} {year}",
                [nameof(OpexTemplateReadDto.GrowthRp)] = "Rp",
                [nameof(OpexTemplateReadDto.Growth)] = "%",
                [nameof(OpexTemplateReadDto.FullYearFY)] = "Full Year (FY)",
                [nameof(OpexTemplateReadDto.YTD)] = "YTD",
                [nameof(OpexTemplateReadDto.toAngThisYear)] = $"to Ang. {year}",
                [nameof(OpexTemplateReadDto.toAngYTDThisYear)] = $"to Ang. YTD {year}"
            };
        }

        private static string NormalizeHeaderLabelText(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
            var normalized = raw.Replace("\r", string.Empty, StringComparison.Ordinal);
            var lines = normalized
                .Split('\n')
                .Select(line => Regex.Replace(line, @"\s+", " ").Trim())
                .Where(line => line.Length > 0);
            return string.Join("\n", lines);
        }

        private static Dictionary<string, string> ParseHeaderLabels(ExcelWorksheet ws, int year, int reportMonth)
        {
            var labels = BuildFallbackHeaderLabels(year, reportMonth);
            var headerRow = FindMonthHeaderRow(ws);

            foreach (var (key, columnIndex) in HeaderLabelColumns)
            {
                var value = NormalizeHeaderLabelText(ws.Cells[headerRow, columnIndex].Value?.ToString());
                if (!string.IsNullOrWhiteSpace(value))
                {
                    labels[key] = value;
                }
            }

            return labels;
        }

        private async Task UpsertHeaderLabelsAsync(
            long tableId,
            int year,
            int reportMonth,
            IReadOnlyDictionary<string, string> labels,
            DateTime now,
            CancellationToken cancellationToken)
        {
            var metadata = await _db.OpexTemplateHeaders
                .FirstOrDefaultAsync(
                    x => x.PlanningDashboardTableId == tableId && x.Year == year,
                    cancellationToken);

            if (metadata == null)
            {
                metadata = new OpexTemplateHeader
                {
                    PlanningDashboardTableId = tableId,
                    Year = year,
                    CreatedAt = now
                };
                _db.OpexTemplateHeaders.Add(metadata);
            }

            metadata.ReportMonthIndex = Math.Clamp(reportMonth, 1, 12);
            metadata.RealizationLastYearLabel = labels.TryGetValue(nameof(OpexTemplateReadDto.RealizationLastYearThisMonth), out var realizationLastYear)
                ? realizationLastYear
                : null;
            metadata.RealizationThisYearLabel = labels.TryGetValue(nameof(OpexTemplateReadDto.RealizationThisYearThisMonth), out var realizationThisYear)
                ? realizationThisYear
                : null;
            metadata.GrowthRpLabel = labels.TryGetValue(nameof(OpexTemplateReadDto.GrowthRp), out var growthRp)
                ? growthRp
                : null;
            metadata.GrowthPercentLabel = labels.TryGetValue(nameof(OpexTemplateReadDto.Growth), out var growthPercent)
                ? growthPercent
                : null;
            metadata.FullYearFyLabel = labels.TryGetValue(nameof(OpexTemplateReadDto.FullYearFY), out var fullYearFy)
                ? fullYearFy
                : null;
            metadata.YtdLabel = labels.TryGetValue(nameof(OpexTemplateReadDto.YTD), out var ytd)
                ? ytd
                : null;
            metadata.ToAngThisYearLabel = labels.TryGetValue(nameof(OpexTemplateReadDto.toAngThisYear), out var toAngThisYear)
                ? toAngThisYear
                : null;
            metadata.ToAngYtdThisYearLabel = labels.TryGetValue(nameof(OpexTemplateReadDto.toAngYTDThisYear), out var toAngYtdThisYear)
                ? toAngYtdThisYear
                : null;
            metadata.UpdatedAt = now;
        }

        private async Task<Dictionary<string, string>> ResolveHeaderLabelsAsync(
            long tableId,
            int year,
            int reportMonth,
            CancellationToken cancellationToken)
        {
            var fallback = BuildFallbackHeaderLabels(year, reportMonth);
            var metadata = await _db.OpexTemplateHeaders
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.PlanningDashboardTableId == tableId && x.Year == year,
                    cancellationToken);
            if (metadata == null)
            {
                return fallback;
            }

            ApplyHeaderLabelOverride(
                fallback,
                nameof(OpexTemplateReadDto.RealizationLastYearThisMonth),
                metadata.RealizationLastYearLabel);
            ApplyHeaderLabelOverride(
                fallback,
                nameof(OpexTemplateReadDto.RealizationThisYearThisMonth),
                metadata.RealizationThisYearLabel);
            ApplyHeaderLabelOverride(
                fallback,
                nameof(OpexTemplateReadDto.GrowthRp),
                metadata.GrowthRpLabel);
            ApplyHeaderLabelOverride(
                fallback,
                nameof(OpexTemplateReadDto.Growth),
                metadata.GrowthPercentLabel);
            ApplyHeaderLabelOverride(
                fallback,
                nameof(OpexTemplateReadDto.FullYearFY),
                metadata.FullYearFyLabel);
            ApplyHeaderLabelOverride(
                fallback,
                nameof(OpexTemplateReadDto.YTD),
                metadata.YtdLabel);
            ApplyHeaderLabelOverride(
                fallback,
                nameof(OpexTemplateReadDto.toAngThisYear),
                metadata.ToAngThisYearLabel);
            ApplyHeaderLabelOverride(
                fallback,
                nameof(OpexTemplateReadDto.toAngYTDThisYear),
                metadata.ToAngYtdThisYearLabel);

            return fallback;
        }

        private static void ApplyHeaderLabelOverride(
            IDictionary<string, string> labels,
            string key,
            string? candidate)
        {
            var normalized = NormalizeHeaderLabelText(candidate);
            if (!string.IsNullOrWhiteSpace(normalized))
            {
                labels[key] = normalized;
            }
        }

        private static int ParseYearFromWorksheet(ExcelWorksheet ws)
        {
            var tokens = new[] { ws.Cells[3, 4].Value?.ToString(), ws.Cells[2, 17].Value?.ToString(), ws.Cells[5, 21].Value?.ToString() };
            foreach (var token in tokens)
            {
                var digits = new string((token ?? "").Where(char.IsDigit).ToArray());
                for (var i = 0; i + 4 <= digits.Length; i++)
                    if (int.TryParse(digits.Substring(i, 4), out var year) && year is >= 1900 and <= 2099)
                        return year;
            }
            return DateTime.UtcNow.Year;
        }

        private static int ParseReportMonth(ExcelWorksheet ws)
        {
            if (TryMonth(ws.Cells[3, 1].Value?.ToString(), out var fromHeader)) return fromHeader;
            if (ws.Dimension == null) return 1;
            var headerRow = FindMonthHeaderRow(ws);
            var dataStartRow = Math.Max(1, headerRow + 1);
            var dataEndRow = ResolveEffectiveDataEndRow(ws, dataStartRow);
            if (dataEndRow < dataStartRow) return 1;
            var detected = 1;
            for (var row = dataStartRow; row <= dataEndRow; row++)
            {
                var sit = NormalizeSit(ws.Cells[row, 1].Value?.ToString());
                if (string.IsNullOrWhiteSpace(sit)) continue;

                for (var month = 1; month <= 12; month++)
                {
                    var col = 3 + month;
                    if (ParseDecimal(ws.Cells[row, col].Value) != 0m)
                    {
                        detected = month;
                    }
                }
            }
            return detected;
        }

        private static int FindMonthHeaderRow(ExcelWorksheet ws)
        {
            if (ws.Dimension == null) return 6;
            var scanUntil = Math.Min(ws.Dimension.End.Row, 32);
            for (var row = 1; row <= scanUntil; row++)
            {
                var janToken = ws.Cells[row, 4].Value?.ToString();
                var decToken = ws.Cells[row, 15].Value?.ToString();
                if (TryMonth(janToken, out var jan) && jan == 1 &&
                    TryMonth(decToken, out var dec) && dec == 12)
                {
                    return row;
                }
            }

            return 6;
        }

        private static List<ParsedOpexTemplateRow> ParseRows(ExcelWorksheet ws)
        {
            var rows = new List<ParsedOpexTemplateRow>();
            if (ws.Dimension == null) return rows;

            var headerRow = FindMonthHeaderRow(ws);
            var dataStartRow = Math.Max(1, headerRow + 1);
            var dataEndRow = ResolveEffectiveDataEndRow(ws, dataStartRow);
            if (dataEndRow < dataStartRow) return rows;

            for (var r = dataStartRow; r <= dataEndRow; r++)
            {
                var sit = NormalizeSit(ws.Cells[r, 1].Value?.ToString());
                if (string.IsNullOrWhiteSpace(sit) || string.Equals(sit, "SIT", StringComparison.OrdinalIgnoreCase)) continue;
                var parent = (ws.Cells[r, 2].Value?.ToString() ?? "").Trim();
                var child = (ws.Cells[r, 3].Value?.ToString() ?? "").Trim();
                var isKro = ResolveIsKro(parent, child, sit);
                var hasRealizationLastYearOverride = TryParseOverrideValue(
                    ws.Cells[r, 17].Value,
                    out var realizationLastYearOverride);
                var hasRealizationThisYearOverride = TryParseOverrideValue(
                    ws.Cells[r, 18].Value,
                    out var realizationThisYearOverride);
                var hasFullYearFyOverrideRaw = TryParseOverrideValue(
                    ws.Cells[r, 21].Value,
                    out var fullYearFyOverrideRaw);
                var normalizedFullYearFyOverride = hasFullYearFyOverrideRaw
                    ? NormalizeFullYearValue(fullYearFyOverrideRaw)
                    : null;
                var hasFullYearFyOverride = normalizedFullYearFyOverride.HasValue;

                rows.Add(new ParsedOpexTemplateRow
                {
                    Row = new OpexTemplate
                    {
                        SIT = sit,
                        MataAnggaranParent = parent,
                        MataAnggaranChild = child,
                        RowType = string.IsNullOrWhiteSpace(child) ? "GROUP" : "DETAIL",
                        IsKro = isKro,
                        Jan = ParseDecimal(ws.Cells[r, 4].Value), Feb = ParseDecimal(ws.Cells[r, 5].Value), Mar = ParseDecimal(ws.Cells[r, 6].Value),
                        Apr = ParseDecimal(ws.Cells[r, 7].Value), May = ParseDecimal(ws.Cells[r, 8].Value), Jun = ParseDecimal(ws.Cells[r, 9].Value),
                        Jul = ParseDecimal(ws.Cells[r, 10].Value), Aug = ParseDecimal(ws.Cells[r, 11].Value), Sep = ParseDecimal(ws.Cells[r, 12].Value),
                        Oct = ParseDecimal(ws.Cells[r, 13].Value), Nov = ParseDecimal(ws.Cells[r, 14].Value), Dec = ParseDecimal(ws.Cells[r, 15].Value),
                        FullYearFY = normalizedFullYearFyOverride, YTD = ParseNullableDecimal(ws.Cells[r, 22].Value),
                        toAngThisYear = ParseNullablePercent(ws.Cells[r, 23].Value), toAngYTDThisYear = ParseNullablePercent(ws.Cells[r, 24].Value),
                        SisaFY = ParseNullableDecimal(ws.Cells[r, 25].Value)
                    },
                    HasRealizationLastYearOverride = hasRealizationLastYearOverride,
                    RealizationLastYearThisMonth = hasRealizationLastYearOverride
                        ? realizationLastYearOverride
                        : null,
                    HasRealizationThisYearOverride = hasRealizationThisYearOverride,
                    RealizationThisYearThisMonth = hasRealizationThisYearOverride
                        ? realizationThisYearOverride
                        : null,
                    HasFullYearFyOverride = hasFullYearFyOverride
                });
            }
            return rows;
        }

        private static int ResolveEffectiveDataEndRow(ExcelWorksheet ws, int dataStartRow)
        {
            if (ws.Dimension == null)
            {
                return dataStartRow - 1;
            }

            var dimensionEndRow = ws.Dimension.End.Row;
            var upperBound = Math.Min(
                dimensionEndRow,
                dataStartRow + ExcelParseScanRowLimit - 1);

            var hasSeenData = false;
            var trailingEmptyRows = 0;
            var lastDataRow = dataStartRow - 1;

            for (var row = dataStartRow; row <= upperBound; row++)
            {
                var sit = NormalizeSit(ws.Cells[row, 1].Value?.ToString());
                var parent = (ws.Cells[row, 2].Value?.ToString() ?? string.Empty).Trim();
                var child = (ws.Cells[row, 3].Value?.ToString() ?? string.Empty).Trim();
                var hasData = !string.IsNullOrWhiteSpace(sit) ||
                              !string.IsNullOrWhiteSpace(parent) ||
                              !string.IsNullOrWhiteSpace(child);

                if (hasData)
                {
                    hasSeenData = true;
                    trailingEmptyRows = 0;
                    lastDataRow = row;
                    continue;
                }

                if (!hasSeenData)
                {
                    continue;
                }

                trailingEmptyRows++;
                if (trailingEmptyRows >= ExcelParseTrailingEmptyThreshold)
                {
                    break;
                }
            }

            if (lastDataRow >= dataStartRow)
            {
                return lastDataRow;
            }

            return dataStartRow - 1;
        }

        private static bool TryParseOverrideValue(object? value, out decimal parsed)
        {
            parsed = 0m;
            var raw = value?.ToString()?.Trim() ?? string.Empty;
            if (raw.Length == 0) return false;
            parsed = ParseDecimal(value);
            return true;
        }

        private static bool TryParseFullYearPatchValue(object? value, out decimal? parsed)
        {
            parsed = null;
            object? normalizedValue = value;

            if (value is JsonElement json)
            {
                normalizedValue = json.ValueKind switch
                {
                    JsonValueKind.Null => null,
                    JsonValueKind.Undefined => null,
                    JsonValueKind.String => json.GetString(),
                    JsonValueKind.Number when json.TryGetDecimal(out var decimalValue) => (object)decimalValue,
                    JsonValueKind.Number => (object)json.GetDouble(),
                    _ => json.ToString()
                };
            }

            if (normalizedValue == null)
            {
                parsed = null;
                return true;
            }

            if (normalizedValue is string text && string.IsNullOrWhiteSpace(text))
            {
                parsed = null;
                return true;
            }

            try
            {
                if (!TryParseOverrideValue(normalizedValue, out var numericValue))
                {
                    parsed = null;
                    return false;
                }

                parsed = NormalizeFullYearValue(numericValue);
                return true;
            }
            catch
            {
                parsed = null;
                return false;
            }
        }

        private static bool CanEditFullYearFy(OpexTemplate row)
        {
            var rowType = (row.RowType ?? string.Empty).Trim();
            var isGroup = string.Equals(rowType, "GROUP", StringComparison.OrdinalIgnoreCase);
            var hasChild = !string.IsNullOrWhiteSpace(row.MataAnggaranChild);
            var hasSit = !string.IsNullOrWhiteSpace(row.SIT);
            return hasSit && hasChild && !isGroup;
        }

        private static bool IsDetailTemplateRow(OpexTemplate row)
        {
            return CanEditFullYearFy(row);
        }

        private static decimal? NormalizeFullYearValue(decimal? value)
        {
            if (!value.HasValue)
            {
                return null;
            }

            return value.Value == 0m ? null : value.Value;
        }

        private static string NormalizeSnapshotSource(string? value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? SnapshotSourceImport
                : value.Trim().ToLowerInvariant();
        }

        private static bool HasFullYearFyValueSnapshot(OpexTemplateMonthlySnapshot snapshot)
        {
            return snapshot.HasFullYearFyOverride && NormalizeFullYearValue(snapshot.FullYearFY).HasValue;
        }

        private static bool IsSitAncestor(string? ancestorSit, string? descendantSit)
        {
            var ancestorToken = NormalizeSit(ancestorSit);
            var descendantToken = NormalizeSit(descendantSit);
            if (string.IsNullOrWhiteSpace(ancestorToken) || string.IsNullOrWhiteSpace(descendantToken))
            {
                return false;
            }

            var ancestorComparable = NormalizeSitComparable(ancestorToken);
            var descendantComparable = NormalizeSitComparable(descendantToken);
            if (ancestorComparable.Length == 0 || descendantComparable.Length == 0)
            {
                return false;
            }

            if (
                descendantComparable.Length > ancestorComparable.Length &&
                descendantComparable.StartsWith(ancestorComparable, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            // Parent code dengan suffix "00" sering merepresentasikan grup level yang sama panjang,
            // contoh: PLOPX01010100 -> PLOPX01010101/02/03.
            if (
                ancestorComparable.EndsWith("00", StringComparison.OrdinalIgnoreCase) &&
                ancestorComparable.Length == descendantComparable.Length &&
                ancestorComparable.Length > 2 &&
                ancestorComparable[..^2].Equals(descendantComparable[..^2], StringComparison.OrdinalIgnoreCase) &&
                !descendantComparable.EndsWith("00", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (!descendantToken.StartsWith(ancestorToken, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (descendantToken.Length <= ancestorToken.Length)
            {
                return false;
            }

            var boundary = descendantToken[ancestorToken.Length];
            return boundary is '.' or '-' or '_' or '/';
        }

        private static string NormalizeSitComparable(string? sit)
        {
            var normalized = NormalizeSit(sit);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return string.Empty;
            }

            return Regex.Replace(normalized, "[^A-Z0-9]", string.Empty, RegexOptions.CultureInvariant);
        }

        private static string NormalizeParentGroupKey(string? parentLabel)
        {
            return string.IsNullOrWhiteSpace(parentLabel)
                ? string.Empty
                : parentLabel.Trim();
        }

        private static bool IsOperationalOthersTotalLabel(string? label)
        {
            return string.Equals(
                NormalizeParentGroupKey(label),
                NormalizeParentGroupKey(OperationalOthersTotalLabel),
                StringComparison.OrdinalIgnoreCase);
        }

        private static void ApplyMonthCutoff(OpexTemplate target, OpexTemplate source, int cutoffMonth)
        {
            for (var m = 1; m <= cutoffMonth; m++) SetMonthValue(target, m, MonthValue(source, m));
        }

        private static string NormalizeSit(string? sitRaw)
        {
            if (string.IsNullOrWhiteSpace(sitRaw))
            {
                return string.Empty;
            }

            var normalized = sitRaw
                .Trim()
                .ToUpperInvariant()
                .Replace('–', '-')
                .Replace('—', '-')
                .Replace('−', '-');
            normalized = Regex.Replace(normalized, @"\s+", string.Empty);
            return normalized;
        }

        private static bool ResolveIsKro(string? parent, string? child, string? sit)
        {
            if (!string.IsNullOrWhiteSpace(child) &&
                child.Contains("KRO", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (!string.IsNullOrWhiteSpace(parent) &&
                parent.Contains("KRO", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return !string.IsNullOrWhiteSpace(sit) &&
                   sit.Contains("KRO", StringComparison.OrdinalIgnoreCase);
        }

        private static bool TryMonth(string? token, out int month)
        {
            month = 0;
            var raw = (token ?? "").Trim().ToUpperInvariant();
            if (int.TryParse(raw, out var num) && num is >= 1 and <= 12) { month = num; return true; }
            raw = new string(raw.Where(char.IsLetter).ToArray());
            return MonthTokenMap.TryGetValue(raw, out month);
        }

        private static decimal MonthValue(OpexTemplate row, int month) => month switch
        {
            1 => row.Jan, 2 => row.Feb, 3 => row.Mar, 4 => row.Apr, 5 => row.May, 6 => row.Jun,
            7 => row.Jul, 8 => row.Aug, 9 => row.Sep, 10 => row.Oct, 11 => row.Nov, 12 => row.Dec, _ => 0m
        };

        private static void SetMonthValue(OpexTemplate row, int month, decimal value)
        {
            switch (month)
            {
                case 1: row.Jan = value; break; case 2: row.Feb = value; break; case 3: row.Mar = value; break;
                case 4: row.Apr = value; break; case 5: row.May = value; break; case 6: row.Jun = value; break;
                case 7: row.Jul = value; break; case 8: row.Aug = value; break; case 9: row.Sep = value; break;
                case 10: row.Oct = value; break; case 11: row.Nov = value; break; case 12: row.Dec = value; break;
            }
        }

        private static decimal ParseDecimal(object? value)
        {
            if (value == null) return 0m;
            if (value is decimal dec) return NormalizeDecimalForStorage(dec);
            if (value is double dbl) return NormalizeDecimalForStorage(Convert.ToDecimal(dbl, CultureInfo.InvariantCulture));
            if (value is float flt) return NormalizeDecimalForStorage(Convert.ToDecimal(flt, CultureInfo.InvariantCulture));
            if (value is int i) return NormalizeDecimalForStorage(i);
            if (value is long l) return NormalizeDecimalForStorage(l);

            var raw = value.ToString()?.Trim() ?? string.Empty;
            if (raw.Length == 0) return 0m;
            raw = raw
                .Replace("Rp", "", StringComparison.OrdinalIgnoreCase)
                .Replace("%", "", StringComparison.OrdinalIgnoreCase)
                .Replace(" ", string.Empty, StringComparison.Ordinal)
                .Replace("\u00A0", string.Empty, StringComparison.Ordinal)
                .Trim();

            if (decimal.TryParse(raw, NumberStyles.Any, CultureInfo.GetCultureInfo("id-ID"), out var id))
            {
                return NormalizeDecimalForStorage(id);
            }

            if (decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var inv))
            {
                return NormalizeDecimalForStorage(inv);
            }

            var normalized = NormalizeNumericToken(raw);
            if (decimal.TryParse(normalized, NumberStyles.Any, CultureInfo.InvariantCulture, out var normalizedParsed))
            {
                return NormalizeDecimalForStorage(normalizedParsed);
            }

            return 0m;
        }

        private static decimal NormalizeDecimalForStorage(decimal value)
        {
            var rounded = Math.Round(value, SqlDecimalScale, MidpointRounding.AwayFromZero);
            if (rounded > SqlDecimalMax || rounded < SqlDecimalMin)
            {
                throw new InvalidOperationException(
                    $"Nilai numerik '{value}' melebihi batas yang diizinkan. Maksimal nilai adalah {SqlDecimalMax}.");
            }

            return rounded;
        }

        private static string NormalizeNumericToken(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;

            var token = raw.Trim();
            var hasDot = token.Contains('.', StringComparison.Ordinal);
            var hasComma = token.Contains(',', StringComparison.Ordinal);

            if (hasDot && hasComma)
            {
                var lastDot = token.LastIndexOf('.');
                var lastComma = token.LastIndexOf(',');
                // "1.234,567" -> "1234.567" | "1,234.567" -> "1234.567"
                return lastComma > lastDot
                    ? token.Replace(".", string.Empty, StringComparison.Ordinal).Replace(",", ".", StringComparison.Ordinal)
                    : token.Replace(",", string.Empty, StringComparison.Ordinal);
            }

            if (hasComma)
            {
                // "1,234,567" => thousands separator
                if (Regex.IsMatch(token, @"^-?\d{1,3}(,\d{3})+$"))
                {
                    return token.Replace(",", string.Empty, StringComparison.Ordinal);
                }

                // "537,777247" => decimal separator
                return token.Replace(",", ".", StringComparison.Ordinal);
            }

            if (hasDot && Regex.IsMatch(token, @"^-?\d{1,3}(\.\d{3})+$"))
            {
                return token.Replace(".", string.Empty, StringComparison.Ordinal);
            }

            return token;
        }

        private static decimal? ParseNullableDecimal(object? value)
        {
            var raw = value?.ToString()?.Trim() ?? string.Empty;
            if (raw.Length == 0) return null;
            return ParseDecimal(value);
        }

        private static decimal? ParseNullablePercent(object? value)
        {
            var raw = value?.ToString()?.Trim() ?? string.Empty;
            if (raw.Length == 0) return null;
            var parsed = ParseDecimal(value);
            if (raw.Contains('%')) return parsed;
            return Math.Abs(parsed) <= 1m ? parsed * 100m : parsed;
        }

        private static decimal Round2(decimal value) =>
            Math.Round(value, 2, MidpointRounding.AwayFromZero);

        private static decimal Round1(decimal value) =>
            Math.Round(value, 1, MidpointRounding.AwayFromZero);

        private static int ResolveLoadedMaxMonth(IReadOnlyCollection<OpexTemplate> rows)
        {
            var max = 0;
            for (var month = 1; month <= 12; month++)
            {
                if (rows.Any(x => MonthValue(x, month) != 0m))
                {
                    max = month;
                }
            }

            return max;
        }

        private static string BuildOverviewCacheKey(
            long tableId,
            int year,
            string mode,
            string period,
            bool kroOnly)
        {
            return $"{OverviewCachePrefix}{tableId}:{year}:{mode}:{period}:{(kroOnly ? 1 : 0)}";
        }

        private static string BuildDerivedRowsCacheKey(
            long tableId,
            int year,
            string mode,
            string period,
            bool kroOnly)
        {
            return $"{DerivedRowsCachePrefix}{tableId}:{year}:{mode}:{period}:{(kroOnly ? 1 : 0)}";
        }

        private static string BuildHomeSummaryCacheKey(long tableId, int year)
        {
            return $"{HomeSummaryCachePrefix}{tableId}:{year}";
        }

        private void CacheOverviewPayload(long tableId, string cacheKey, object payload)
        {
            _memoryCache.Set(cacheKey, payload, OverviewCacheTtl);
            var keyBucket = OverviewCacheKeysByTable.GetOrAdd(
                tableId,
                _ => new ConcurrentDictionary<string, byte>(StringComparer.Ordinal));
            keyBucket[cacheKey] = 1;
        }

        private void CacheHomeSummaryPayload(long tableId, string cacheKey, object payload)
        {
            _memoryCache.Set(cacheKey, payload, OverviewCacheTtl);
            var keyBucket = HomeSummaryCacheKeysByTable.GetOrAdd(
                tableId,
                _ => new ConcurrentDictionary<string, byte>(StringComparer.Ordinal));
            keyBucket[cacheKey] = 1;
        }

        private void InvalidateOverviewCache(long tableId)
        {
            if (!OverviewCacheKeysByTable.TryRemove(tableId, out var keyBucket))
            {
                return;
            }

            foreach (var cacheKey in keyBucket.Keys)
            {
                _memoryCache.Remove(cacheKey);
            }
        }

        private void InvalidateHomeSummaryCache(long tableId)
        {
            if (!HomeSummaryCacheKeysByTable.TryRemove(tableId, out var keyBucket))
            {
                return;
            }

            foreach (var cacheKey in keyBucket.Keys)
            {
                _memoryCache.Remove(cacheKey);
            }
        }

        private void InvalidateDerivedRowsCache(long tableId)
        {
            if (!DerivedRowsCacheKeysByTable.TryRemove(tableId, out var keyBucket))
            {
                return;
            }

            foreach (var cacheKey in keyBucket.Keys)
            {
                _memoryCache.Remove(cacheKey);
            }
        }

        private void InvalidateTableCaches(long tableId)
        {
            InvalidateOverviewCache(tableId);
            InvalidateHomeSummaryCache(tableId);
            InvalidateDerivedRowsCache(tableId);
        }

        private static string ResolveOpexExportFormat(string? rawFormat) =>
            string.IsNullOrWhiteSpace(rawFormat)
                ? "xlsx"
                : rawFormat.Trim().ToLowerInvariant();

        private static List<string> ResolveOpexExportColumns(IEnumerable<string>? requestedColumns)
        {
            if (requestedColumns == null)
            {
                return [.. OpexTemplateQuerySchema.DisplayColumns];
            }

            return requestedColumns
                .Where(column => !string.IsNullOrWhiteSpace(column))
                .Select(column => column.Trim())
                .Where(column => OpexTemplateQuerySchema.DisplayColumns.Contains(column, StringComparer.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static List<object> BuildOpexExportRows(
            IReadOnlyList<OpexTemplateReadDto> sourceRows,
            OpexTableExportRequest? request)
        {
            if (sourceRows.Count == 0)
            {
                return [];
            }

            var firstPageResponse = TableQueryHelper.Execute(
                sourceRows,
                BuildOpexPagedExportQueryRequest(request, 1),
                OpexTemplateQuerySchema);

            var rows = new List<object>(firstPageResponse.Rows);
            for (var page = 2; page <= firstPageResponse.TotalPages; page += 1)
            {
                var pageResponse = TableQueryHelper.Execute(
                    sourceRows,
                    BuildOpexPagedExportQueryRequest(request, page),
                    OpexTemplateQuerySchema);
                rows.AddRange(pageResponse.Rows);
            }

            return rows;
        }

        private static TableQueryRequest BuildOpexPagedExportQueryRequest(
            OpexTableExportRequest? request,
            int page)
        {
            return new TableQueryRequest
            {
                Page = page,
                PageSize = TableQueryHelper.MaxPageSize,
                FocusId = null,
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

        private async Task<Dictionary<string, string>> BuildOpexExportColumnLabelsAsync(
            long tableId,
            int year,
            string mode,
            string period,
            CancellationToken cancellationToken)
        {
            var months = ResolvePeriodMonths(mode, period);
            var reportMonth = ResolveReportMonth(months);
            var resolvedDynamicLabels = await ResolveHeaderLabelsAsync(
                tableId,
                year,
                reportMonth,
                cancellationToken);

            var labels = new Dictionary<string, string>(OpexBaseExportColumnLabels, StringComparer.OrdinalIgnoreCase)
            {
                [nameof(OpexTemplateReadDto.Accumulated)] = ResolveOpexAccumulatedLabel(months),
                [nameof(OpexTemplateReadDto.YTD)] = ResolveOpexBudgetPeriodLabel(months, year),
                [nameof(OpexTemplateReadDto.toAngYTDThisYear)] = ResolveOpexAchievementPeriodLabel(months, year),
            };

            foreach (var column in OpexDynamicHeaderColumns)
            {
                if (resolvedDynamicLabels.TryGetValue(column, out var label) && !string.IsNullOrWhiteSpace(label))
                {
                    labels[column] = label;
                }
            }

            labels[nameof(OpexTemplateReadDto.YTD)] = ResolveOpexBudgetPeriodLabel(months, year);
            labels[nameof(OpexTemplateReadDto.toAngYTDThisYear)] = ResolveOpexAchievementPeriodLabel(months, year);

            return labels;
        }

        private static string ResolveOpexAccumulatedLabel(IReadOnlyList<int>? months)
        {
            var validMonths = (months ?? [])
                .Where(month => month is >= 1 and <= 12)
                .ToArray();

            if (validMonths.Length == 0)
            {
                return "Total Akumulasi (sesuai filter bulan)";
            }

            if (validMonths.Length == 1)
            {
                var token = MonthOrder[validMonths[0] - 1];
                return $"Total Akumulasi bulan {ResolveOpexMonthLabel(token)}";
            }

            var firstToken = MonthOrder[validMonths.Min() - 1];
            var lastToken = MonthOrder[validMonths.Max() - 1];
            if (string.Equals(firstToken, lastToken, StringComparison.OrdinalIgnoreCase))
            {
                return $"Total Akumulasi bulan {ResolveOpexMonthLabel(firstToken)}";
            }

            return $"Total Akumulasi {firstToken}-{lastToken}";
        }

        private static bool IsQuarterScopedSelection(IReadOnlyList<int>? months)
        {
            var validMonths = (months ?? [])
                .Where(month => month is >= 1 and <= 12)
                .Distinct()
                .OrderBy(month => month)
                .ToArray();

            if (validMonths.Length != 3)
            {
                return false;
            }

            return QuarterMonths.Values.Any(quarterMonths =>
                quarterMonths.Length == validMonths.Length &&
                quarterMonths.SequenceEqual(validMonths));
        }

        private static string ResolveOpexBudgetPeriodLabel(IReadOnlyList<int>? months, int year)
        {
            var validMonths = (months ?? [])
                .Where(month => month is >= 1 and <= 12)
                .Distinct()
                .OrderBy(month => month)
                .ToArray();

            if (validMonths.Length == 0)
            {
                return $"Anggaran {year} YTD (s.d. bulan filter)";
            }

            var reportMonth = ResolveReportMonth(validMonths);
            if (IsCumulativeSelection(validMonths, reportMonth))
            {
                return $"Anggaran {year} YTD (s.d. bulan filter)";
            }

            if (validMonths.Length == 1)
            {
                return $"Anggaran {year} bulan {ResolveOpexMonthLabel(MonthOrder[validMonths[0] - 1])}";
            }

            var firstToken = ResolveOpexMonthLabel(MonthOrder[validMonths.Min() - 1]);
            var lastToken = ResolveOpexMonthLabel(MonthOrder[validMonths.Max() - 1]);
            return $"Anggaran {year} periode {firstToken}-{lastToken}";
        }

        private static string ResolveOpexAchievementPeriodLabel(IReadOnlyList<int>? months, int year)
        {
            var validMonths = (months ?? [])
                .Where(month => month is >= 1 and <= 12)
                .Distinct()
                .OrderBy(month => month)
                .ToArray();

            if (validMonths.Length == 0)
            {
                return $"to Ang. YTD {year}";
            }

            var reportMonth = ResolveReportMonth(validMonths);
            if (IsCumulativeSelection(validMonths, reportMonth))
            {
                return $"to Ang. YTD {year}";
            }

            if (validMonths.Length == 1)
            {
                return $"to Ang. bulan {ResolveOpexMonthLabel(MonthOrder[validMonths[0] - 1])} {year}";
            }

            var firstToken = ResolveOpexMonthLabel(MonthOrder[validMonths.Min() - 1]);
            var lastToken = ResolveOpexMonthLabel(MonthOrder[validMonths.Max() - 1]);
            return $"to Ang. periode {firstToken}-{lastToken} {year}";
        }

        private static string ResolveOpexMonthLabel(string token) =>
            OpexMonthIdMap.TryGetValue(token, out var label)
                ? label
                : token;

        private static string ResolveOpexColumnLabel(
            string column,
            IReadOnlyDictionary<string, string> columnLabels)
        {
            return columnLabels.TryGetValue(column, out var label)
                ? label
                : column;
        }

        private static byte[] BuildOpexXlsxExport(
            IReadOnlyList<object> rows,
            IReadOnlyList<string> columns,
            IReadOnlyDictionary<string, string> columnLabels,
            string worksheetName,
            int budgetYear)
        {
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add(SanitizeOpexWorksheetName(worksheetName));

            var hasGroupedHeader = ApplyOpexExcelGroupedHeader(
                worksheet,
                columns,
                columnLabels,
                budgetYear);

            var headerRows = hasGroupedHeader ? 2 : 1;
            var dataStartRow = hasGroupedHeader ? 3 : 2;
            var autoFilterRow = hasGroupedHeader ? 2 : 1;

            if (!hasGroupedHeader)
            {
                for (var columnIndex = 0; columnIndex < columns.Count; columnIndex += 1)
                {
                    worksheet.Cells[1, columnIndex + 1].Value = ResolveOpexColumnLabel(columns[columnIndex], columnLabels);
                }
            }

            for (var rowIndex = 0; rowIndex < rows.Count; rowIndex += 1)
            {
                for (var columnIndex = 0; columnIndex < columns.Count; columnIndex += 1)
                {
                    worksheet.Cells[dataStartRow + rowIndex, columnIndex + 1].Value =
                        FormatOpexExportValue(ReadOpexExportValue(rows[rowIndex], columns[columnIndex]));
                }
            }

            ApplyOpexWorksheetStyles(worksheet, columns.Count, headerRows, dataStartRow, autoFilterRow, hasGroupedHeader);

            if (worksheet.Dimension != null)
            {
                TableExportHelper.ApplyAutoFitLayout(
                    worksheet,
                    columns.Count,
                    autoFilterRow,
                    dataStartRow);
            }

            return package.GetAsByteArray();
        }

        private static bool ApplyOpexExcelGroupedHeader(
            ExcelWorksheet worksheet,
            IReadOnlyList<string> columns,
            IReadOnlyDictionary<string, string> columnLabels,
            int budgetYear)
        {
            if (columns.Count == 0) return false;

            var hasMultiColumnGroup = OpexExportHeaderGroups.Any(group =>
                columns.Count(column => group.Columns.Contains(column, StringComparer.OrdinalIgnoreCase)) > 1);
            if (!hasMultiColumnGroup)
            {
                return false;
            }

            var hasGroupedHeader = false;

            for (var index = 0; index < columns.Count; index += 1)
            {
                var column = columns[index];
                var group = OpexExportHeaderGroups.FirstOrDefault(candidate =>
                    candidate.Columns.Contains(column, StringComparer.OrdinalIgnoreCase));

                if (group.Key == null)
                {
                    worksheet.Cells[1, index + 1, 2, index + 1].Merge = true;
                    worksheet.Cells[1, index + 1].Value = ResolveOpexColumnLabel(column, columnLabels);
                    continue;
                }

                var groupColumns = columns
                    .Where(candidate => group.Columns.Contains(candidate, StringComparer.OrdinalIgnoreCase))
                    .ToArray();
                if (groupColumns.Length == 0)
                {
                    worksheet.Cells[1, index + 1, 2, index + 1].Merge = true;
                    worksheet.Cells[1, index + 1].Value = ResolveOpexColumnLabel(column, columnLabels);
                    continue;
                }

                var firstGroupColumn = groupColumns[0];
                if (!string.Equals(firstGroupColumn, column, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var startColumnIndex = index + 1;
                var endColumnIndex = startColumnIndex + groupColumns.Length - 1;
                var groupLabel = string.Equals(group.Key, "anggaran", StringComparison.OrdinalIgnoreCase)
                    ? $"Anggaran {budgetYear}"
                    : group.Label;

                worksheet.Cells[1, startColumnIndex, 1, endColumnIndex].Merge = true;
                worksheet.Cells[1, startColumnIndex].Value = groupLabel;

                for (var groupOffset = 0; groupOffset < groupColumns.Length; groupOffset += 1)
                {
                    var groupColumn = groupColumns[groupOffset];
                    worksheet.Cells[2, startColumnIndex + groupOffset].Value =
                        ResolveOpexColumnLabel(groupColumn, columnLabels);
                }

                hasGroupedHeader = hasGroupedHeader || groupColumns.Length > 1;
            }

            return hasGroupedHeader;
        }

        private static void ApplyOpexWorksheetStyles(
            ExcelWorksheet worksheet,
            int columnCount,
            int headerRows,
            int dataStartRow,
            int autoFilterRow,
            bool hasGroupedHeader)
        {
            for (var row = 1; row <= headerRows; row += 1)
            {
                var range = worksheet.Cells[row, 1, row, columnCount];
                range.Style.Font.Bold = true;
                range.Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(31, 41, 55));
                range.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                range.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
                range.Style.WrapText = true;
                range.Style.Fill.PatternType = ExcelFillStyle.Solid;
                range.Style.Fill.BackgroundColor.SetColor(
                    row == 1 && hasGroupedHeader
                        ? System.Drawing.Color.FromArgb(238, 242, 247)
                        : System.Drawing.Color.FromArgb(246, 231, 216));
                range.Style.Border.Top.Style = ExcelBorderStyle.Thin;
                range.Style.Border.Left.Style = ExcelBorderStyle.Thin;
                range.Style.Border.Right.Style = ExcelBorderStyle.Thin;
                range.Style.Border.Bottom.Style = ExcelBorderStyle.Thin;
                worksheet.Row(row).Height = 24;
            }

            if (worksheet.Dimension != null && worksheet.Dimension.End.Row >= dataStartRow)
            {
                var dataRange = worksheet.Cells[dataStartRow, 1, worksheet.Dimension.End.Row, columnCount];
                dataRange.Style.WrapText = true;
                dataRange.Style.VerticalAlignment = ExcelVerticalAlignment.Top;
                dataRange.Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
                dataRange.Style.Border.Top.Style = ExcelBorderStyle.Thin;
                dataRange.Style.Border.Left.Style = ExcelBorderStyle.Thin;
                dataRange.Style.Border.Right.Style = ExcelBorderStyle.Thin;
                dataRange.Style.Border.Bottom.Style = ExcelBorderStyle.Thin;
            }

            worksheet.View.FreezePanes(dataStartRow, 1);
            worksheet.Cells[autoFilterRow, 1, autoFilterRow, columnCount].AutoFilter = true;
        }

        private static object? ReadOpexExportValue(object row, string column)
        {
            if (row is IDictionary<string, object?> typedDictionary &&
                typedDictionary.TryGetValue(column, out var typedValue))
            {
                return typedValue;
            }

            if (row is IDictionary<string, object> dictionary &&
                dictionary.TryGetValue(column, out var value))
            {
                return value;
            }

            var property = row.GetType().GetProperty(
                column,
                System.Reflection.BindingFlags.Public |
                System.Reflection.BindingFlags.Instance |
                System.Reflection.BindingFlags.IgnoreCase);

            return property?.GetValue(row);
        }

        private static string FormatOpexExportValue(object? value)
        {
            if (value == null)
            {
                return string.Empty;
            }

            if (value is string text)
            {
                return text;
            }

            if (value is DateTime dateTime)
            {
                return dateTime.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
            }

            if (TryFormatOpexCountValue(value, out var countedValue))
            {
                return countedValue;
            }

            if (value is System.Collections.IEnumerable enumerable and not byte[])
            {
                var items = new List<string>();
                foreach (var item in enumerable)
                {
                    var formattedItem = FormatOpexExportValue(item);
                    if (!string.IsNullOrWhiteSpace(formattedItem))
                    {
                        items.Add(formattedItem);
                    }
                }

                return string.Join(Environment.NewLine, items.Distinct(StringComparer.OrdinalIgnoreCase));
            }

            return value.ToString() ?? string.Empty;
        }

        private static bool TryFormatOpexCountValue(object value, out string formatted)
        {
            formatted = string.Empty;
            var valueProperty = value.GetType().GetProperty(
                "Value",
                System.Reflection.BindingFlags.Public |
                System.Reflection.BindingFlags.Instance |
                System.Reflection.BindingFlags.IgnoreCase);

            if (valueProperty == null)
            {
                return false;
            }

            var countProperty = value.GetType().GetProperty(
                "Count",
                System.Reflection.BindingFlags.Public |
                System.Reflection.BindingFlags.Instance |
                System.Reflection.BindingFlags.IgnoreCase);

            var rawValue = valueProperty.GetValue(value);
            var displayValue = rawValue == null || string.IsNullOrWhiteSpace(rawValue.ToString())
                ? "Belum Diisi"
                : rawValue.ToString();

            if (countProperty == null)
            {
                formatted = displayValue ?? string.Empty;
                return true;
            }

            var rawCount = countProperty.GetValue(value);
            if (rawCount == null || !int.TryParse(rawCount.ToString(), out var count) || count <= 1)
            {
                formatted = displayValue ?? string.Empty;
                return true;
            }

            formatted = $"{displayValue} ({count})";
            return true;
        }

        private static string SanitizeOpexWorksheetName(string value)
        {
            var invalidChars = Path.GetInvalidFileNameChars().Concat(['[', ']', '*', '?', '/', '\\']).ToHashSet();
            var sanitized = new string((value ?? string.Empty).Where(ch => !invalidChars.Contains(ch)).ToArray()).Trim();
            if (string.IsNullOrWhiteSpace(sanitized))
            {
                return "OPEX";
            }

            return sanitized.Length > 31 ? sanitized[..31] : sanitized;
        }

        private static string? SanitizeOpexFileToken(string? value)
        {
            var cleaned = new string((value ?? string.Empty)
                .Where(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_')
                .ToArray())
                .Trim();

            return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
        }

        private static TableQueryResponse BuildEmptyQueryResponse(TableQueryRequest? request)
        {
            request ??= new TableQueryRequest();
            var safePage = request.Page > 0 ? request.Page : 1;
            var safePageSize = request.PageSize > 0
                ? Math.Min(request.PageSize, TableQueryHelper.MaxPageSize)
                : TableQueryHelper.DefaultPageSize;

            return new TableQueryResponse
            {
                Rows = [],
                Page = safePage,
                PageSize = safePageSize,
                TotalCount = 0,
                TotalPages = 1,
                HasPreviousPage = false,
                HasNextPage = false
            };
        }

        private static bool TryNormalizeImportMode(string? importMode, out string normalizedMode, out string? error)
        {
            normalizedMode = ImportModeMerge;
            error = null;

            var raw = string.IsNullOrWhiteSpace(importMode)
                ? ImportModeMerge
                : importMode.Trim().ToLowerInvariant();
            if (string.Equals(raw, ImportModeMerge, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(raw, ImportModeReplace, StringComparison.OrdinalIgnoreCase))
            {
                normalizedMode = raw;
                return true;
            }

            error = "importMode harus 'merge' atau 'replace'.";
            return false;
        }
    }
}
