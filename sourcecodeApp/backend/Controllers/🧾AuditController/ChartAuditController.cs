/*
 * PGH-DOC
 * File: Controllers/🧾AuditController/ChartAuditController.cs
 * Apa fungsi bagian ini:
 * - File ini menangani endpoint API dan alur request/response fitur.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PGH.Helpers;
using PGH.Models.Audit;
using WebApplication2.Data;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChartAuditController : ControllerBase
    {
        private static readonly HashSet<string> RemovedNumberColumnTokens =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "NO",
                "NOMOR"
            };

        private static readonly string[] AllowedChartColumns =
        [
            nameof(ListAudit.TAHUN),
            nameof(ListAudit.NAMAAUDIT),
            nameof(ListAudit.RINGKASANAUDIT),
            nameof(ListAudit.PEMANTAUAN),
            nameof(ListAudit.JENISAUDIT),
            nameof(ListAudit.SOURCE),
            nameof(ListAudit.PICAUDIT),
            nameof(ListAudit.DEPARTMENT),
            nameof(ListAudit.PICAPLIKASI),
            nameof(ListAudit.IN),
            nameof(ListAudit.JATUHTEMPO),
            nameof(ListAudit.LINK),
            nameof(ListAudit.STATUS),
            nameof(ListAudit.KETERANGAN)
        ];

        private readonly AppDbContext _db;

        public ChartAuditController(AppDbContext db)
        {
            _db = db;
        }

        private static string SanitizeIdentifier(string value)
        {
            var cleaned = new string((value ?? string.Empty)
                .Where(ch => char.IsLetterOrDigit(ch) || ch == '_')
                .ToArray());

            if (string.IsNullOrWhiteSpace(cleaned))
            {
                return cleaned;
            }

            return cleaned.Length > 120 ? cleaned[..120] : cleaned;
        }

        private static bool IsRemovedNumberColumn(string? rawColumn)
        {
            var token = SanitizeIdentifier(rawColumn ?? string.Empty).ToUpperInvariant();
            return RemovedNumberColumnTokens.Contains(token);
        }

        private static IActionResult BuildRemovedNumberColumnResult(string columnName)
        {
            return new BadRequestObjectResult(new
            {
                message = $"Column '{columnName}' is no longer available for Audit charts because 'NO/Nomor' has been removed from ListAudit. Clear the chart state and choose a business column such as STATUS, SOURCE, JENISAUDIT, PICAUDIT, DEPARTMENT, PICAPLIKASI, TAHUN, or NAMAAUDIT."
            });
        }

        private static IActionResult BuildUnsupportedChartColumnResult(string columnName)
        {
            return new BadRequestObjectResult(new
            {
                message = $"Column '{columnName}' is not supported for Audit charts.",
                allowedColumns = AllowedChartColumns
            });
        }

        private static string? ResolveChartColumn(string rawColumn, out IActionResult? error)
        {
            error = null;
            var sanitized = SanitizeIdentifier(rawColumn);
            if (string.IsNullOrWhiteSpace(sanitized))
            {
                error = BuildUnsupportedChartColumnResult(rawColumn);
                return null;
            }

            if (IsRemovedNumberColumn(sanitized))
            {
                error = BuildRemovedNumberColumnResult(rawColumn);
                return null;
            }

            var resolved = AllowedChartColumns
                .FirstOrDefault(column => string.Equals(column, sanitized, StringComparison.OrdinalIgnoreCase));

            if (resolved == null)
            {
                error = BuildUnsupportedChartColumnResult(rawColumn);
                return null;
            }

            return resolved;
        }

        private static IQueryable<ListAudit> ApplyAuditTypeFilter(IQueryable<ListAudit> query, string? type)
        {
            var normalizedType = (type ?? "all").Trim().ToLowerInvariant();

            return normalizedType switch
            {
                "internal" => query.Where(row =>
                    row.JENISAUDIT != null &&
                    row.JENISAUDIT.Trim().ToLower() == "internal"),
                "external" or "eksternal" => query.Where(row =>
                    row.JENISAUDIT != null &&
                    (row.JENISAUDIT.Trim().ToLower() == "external" ||
                     row.JENISAUDIT.Trim().ToLower() == "eksternal")),
                _ => query
            };
        }

        private static string NormalizeAuditTypeBucket(string? value)
        {
            var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();

            if (normalized.Contains("internal"))
            {
                return "internal";
            }

            if (normalized.Contains("external") || normalized.Contains("eksternal"))
            {
                return "external";
            }

            return "unknown";
        }

        private static string NormalizeAuditLabel(string? value) =>
            string.IsNullOrWhiteSpace(value) ? "Unknown" : value.Trim();

        private static IReadOnlyList<string> ResolveRequestedDashboardColumns(string? columns)
        {
            var requested = string.IsNullOrWhiteSpace(columns)
                ? []
                : columns
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(column => ResolveChartColumn(column, out _))
                    .Where(column => !string.IsNullOrWhiteSpace(column))
                    .Cast<string>()
                    .ToList();

            var required = new[]
            {
                nameof(ListAudit.STATUS),
                nameof(ListAudit.DEPARTMENT),
                nameof(ListAudit.TAHUN)
            };

            return requested
                .Concat(required)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private async Task<AuditTypeSummaryDto> BuildAuditTypeSummaryAsync(
            IQueryable<ListAudit> query,
            bool distinct)
        {
            if (distinct)
            {
                var totalDistinct = await query
                    .Select(row => row.NAMAAUDIT)
                    .Distinct()
                    .CountAsync();
                var internalDistinct = await ApplyAuditTypeFilter(query, "internal")
                    .Select(row => row.NAMAAUDIT)
                    .Distinct()
                    .CountAsync();
                var externalDistinct = await ApplyAuditTypeFilter(query, "external")
                    .Select(row => row.NAMAAUDIT)
                    .Distinct()
                    .CountAsync();
                var unknownDistinct = await query
                    .Where(row =>
                        row.JENISAUDIT == null ||
                        row.JENISAUDIT.Trim() == string.Empty ||
                        (row.JENISAUDIT.Trim().ToLower() != "internal" &&
                         row.JENISAUDIT.Trim().ToLower() != "external" &&
                         row.JENISAUDIT.Trim().ToLower() != "eksternal"))
                    .Select(row => row.NAMAAUDIT)
                    .Distinct()
                    .CountAsync();

                return new AuditTypeSummaryDto
                {
                    Internal = internalDistinct,
                    External = externalDistinct,
                    Unknown = unknownDistinct,
                    Total = totalDistinct
                };
            }

            var grouped = (await query
                    .GroupBy(row => row.JENISAUDIT)
                    .Select(group => new
                    {
                        Type = group.Key,
                        Count = group.Count()
                    })
                    .ToListAsync())
                .GroupBy(row => NormalizeAuditTypeBucket(row.Type))
                .ToDictionary(
                    group => group.Key,
                    group => group.Sum(item => item.Count),
                    StringComparer.OrdinalIgnoreCase);

            var internalCount = grouped.TryGetValue("internal", out var internalValue) ? internalValue : 0;
            var externalCount = grouped.TryGetValue("external", out var externalValue) ? externalValue : 0;
            var unknownCount = grouped.TryGetValue("unknown", out var unknownValue) ? unknownValue : 0;

            return new AuditTypeSummaryDto
            {
                Internal = internalCount,
                External = externalCount,
                Unknown = unknownCount,
                Total = internalCount + externalCount + unknownCount
            };
        }

        private async Task<List<AuditChartRowDto>> BuildChartRowsAsync(
            IQueryable<ListAudit> query,
            string column)
        {
            return (await query
                    .GroupBy(row => EF.Property<string>(row, column))
                    .Select(group => new AuditChartRowDto
                    {
                        Label = group.Key,
                        Count = group.Count()
                    })
                    .ToListAsync())
                .Select(row => new AuditChartRowDto
                {
                    Label = NormalizeAuditLabel(row.Label),
                    Count = row.Count
                })
                .OrderByDescending(row => row.Count)
                .ThenBy(row => row.Label)
                .ToList();
        }

        private async Task<Dictionary<string, List<AuditChartRowDto>>> BuildSectionChartRowsAsync(
            IQueryable<ListAudit> query,
            string column)
        {
            var grouped = await query
                .GroupBy(row => new
                {
                    Type = row.JENISAUDIT,
                    Label = EF.Property<string>(row, column)
                })
                .Select(group => new
                {
                    group.Key.Type,
                    group.Key.Label,
                    Count = group.Count()
                })
                .ToListAsync();

            var result = new Dictionary<string, List<AuditChartRowDto>>(StringComparer.OrdinalIgnoreCase)
            {
                ["internal"] = [],
                ["external"] = []
            };

            foreach (var row in grouped)
            {
                var bucket = NormalizeAuditTypeBucket(row.Type);
                if (!result.ContainsKey(bucket))
                {
                    continue;
                }

                result[bucket].Add(new AuditChartRowDto
                {
                    Label = NormalizeAuditLabel(row.Label),
                    Count = row.Count
                });
            }

            foreach (var key in result.Keys.ToList())
            {
                result[key] = result[key]
                    .OrderByDescending(row => row.Count)
                    .ThenBy(row => row.Label)
                    .ToList();
            }

            return result;
        }

        [HttpGet("dashboard-all")]
        public async Task<IActionResult> GetDashboardAll(
            [FromQuery] string type = "all",
            [FromQuery] string? columns = null,
            CancellationToken cancellationToken = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async ct => Ok(await GetDashboardAllPayloadAsync(type, columns ?? string.Empty, ct)),
                "Audit dashboard request was canceled.",
                cancellationToken);
        }

        [HttpGet("dashboard-compare")]
        public async Task<IActionResult> GetDashboardCompare(
            [FromQuery] string? columns = null,
            CancellationToken cancellationToken = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async ct => Ok(await GetDashboardComparePayloadAsync(columns ?? string.Empty, ct)),
                "Audit dashboard request was canceled.",
                cancellationToken);
        }

        private sealed class AuditChartRowDto
        {
            public string Label { get; set; } = string.Empty;
            public int Count { get; set; }
        }

        private sealed class AuditTypeSummaryDto
        {
            public int Internal { get; set; }
            public int External { get; set; }
            public int Unknown { get; set; }
            public int Total { get; set; }
        }

        private sealed class AuditDashboardAllPayload
        {
            public AuditTypeSummaryDto Overview { get; init; } = new();
            public AuditTypeSummaryDto Distinct { get; init; } = new();
            public Dictionary<string, List<AuditChartRowDto>> Charts { get; init; } =
                new(StringComparer.OrdinalIgnoreCase);
        }

        private sealed class AuditDashboardComparePayload
        {
            public AuditTypeSummaryDto Overview { get; init; } = new();
            public AuditTypeSummaryDto Distinct { get; init; } = new();
            public Dictionary<string, Dictionary<string, List<AuditChartRowDto>>> Sections { get; init; } =
                new(StringComparer.OrdinalIgnoreCase);
        }

        private async Task<AuditDashboardAllPayload> GetDashboardAllPayloadAsync(
            string type,
            string requestedColumns,
            CancellationToken cancellationToken = default)
        {
            var baseQuery = _db.ListAudit.AsNoTracking();
            var filteredQuery = ApplyAuditTypeFilter(baseQuery, type);
            var requested = ResolveRequestedDashboardColumns(requestedColumns);

            var payload = new AuditDashboardAllPayload
            {
                Overview = await BuildAuditTypeSummaryAsync(baseQuery, distinct: false),
                Distinct = await BuildAuditTypeSummaryAsync(baseQuery, distinct: true),
                Charts = new Dictionary<string, List<AuditChartRowDto>>(StringComparer.OrdinalIgnoreCase)
            };

            foreach (var column in requested)
            {
                payload.Charts[column] = await BuildChartRowsAsync(filteredQuery, column);
            }

            return payload;
        }

        private async Task<AuditDashboardComparePayload> GetDashboardComparePayloadAsync(
            string requestedColumns,
            CancellationToken cancellationToken = default)
        {
            var baseQuery = _db.ListAudit.AsNoTracking();
            var requested = ResolveRequestedDashboardColumns(requestedColumns);
            var payload = new AuditDashboardComparePayload
            {
                Overview = await BuildAuditTypeSummaryAsync(baseQuery, distinct: false),
                Distinct = await BuildAuditTypeSummaryAsync(baseQuery, distinct: true),
                Sections = new Dictionary<string, Dictionary<string, List<AuditChartRowDto>>>(
                    StringComparer.OrdinalIgnoreCase)
                {
                    ["internal"] = new Dictionary<string, List<AuditChartRowDto>>(StringComparer.OrdinalIgnoreCase),
                    ["external"] = new Dictionary<string, List<AuditChartRowDto>>(StringComparer.OrdinalIgnoreCase)
                }
            };

            foreach (var column in requested)
            {
                var rowsBySection = await BuildSectionChartRowsAsync(baseQuery, column);
                payload.Sections["internal"][column] = rowsBySection.TryGetValue("internal", out var internalRows)
                    ? internalRows
                    : [];
                payload.Sections["external"][column] = rowsBySection.TryGetValue("external", out var externalRows)
                    ? externalRows
                    : [];
            }

            return payload;
        }
    }
}
