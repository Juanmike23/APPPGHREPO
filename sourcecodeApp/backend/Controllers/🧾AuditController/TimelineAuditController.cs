/*
 * PGH-DOC
 * File: Controllers/🧾AuditController/TimelineAuditController.cs
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
    public class TimelineController : ControllerBase
    {
        private readonly AppDbContext _db;

        public TimelineController(AppDbContext db)
        {
            _db = db;
        }

        private static string NormalizeStatusToken(string? value) =>
            string.IsNullOrWhiteSpace(value)
                ? string.Empty
                : value.Trim().ToLowerInvariant();

        private static string ResolveStatusCategory(string? value)
        {
            var normalized = NormalizeStatusToken(value);

            if (string.IsNullOrWhiteSpace(normalized))
            {
                return "unknown";
            }

            if (normalized == "open")
            {
                return "open";
            }

            if (normalized is "in progress" or "inprogress" or "progress" or "berjalan")
            {
                return "inprogress";
            }

            if (normalized is "closed" or "close" or "selesai" or "done")
            {
                return "closed";
            }

            return "anomaly";
        }

        private static string ResolveStatusDisplayLabelFromCategory(string category) =>
            category switch
            {
                "open" => "Open",
                "inprogress" => "In Progress",
                "closed" => "Closed",
                "unknown" => "Belum Diisi",
                "anomaly" => "Status Tidak Valid",
                _ => "Belum Diisi"
            };

        private static DateTime ResolveEffectiveStartDate(DateTime? start, DateTime? end)
        {
            if (start.HasValue)
            {
                return start.Value;
            }

            if (end.HasValue)
            {
                return new DateTime(end.Value.Year, end.Value.Month, 1);
            }

            return DateTime.Today;
        }

        private static DateTime ResolveEffectiveEndDate(DateTime? end)
        {
            if (end.HasValue)
            {
                return new DateTime(end.Value.Year, end.Value.Month, 1).AddMonths(1);
            }

            return DateTime.Today.AddDays(1);
        }

        private static int? TryParseAuditYear(string? value)
        {
            if (!int.TryParse(value?.Trim(), out var parsedYear))
            {
                return null;
            }

            return parsedYear is >= 1900 and <= 3000 ? parsedYear : null;
        }

        private static TimelineWindow? ResolveTimelineWindow(TimelineSourceRow row)
        {
            var effectiveStart = ResolveEffectiveStartDate(row.Start, row.End);
            var effectiveEndExclusive = ResolveEffectiveEndDate(row.End);
            var auditYear = TryParseAuditYear(row.Tahun);

            if (auditYear.HasValue)
            {
                var yearStart = new DateTime(auditYear.Value, 1, 1);
                var yearEndExclusive = yearStart.AddYears(1);

                if (effectiveEndExclusive <= yearStart || effectiveStart >= yearEndExclusive)
                {
                    return null;
                }

                if (effectiveStart < yearStart)
                {
                    effectiveStart = yearStart;
                }

                if (effectiveEndExclusive > yearEndExclusive)
                {
                    effectiveEndExclusive = yearEndExclusive;
                }
            }

            if (effectiveEndExclusive <= effectiveStart)
            {
                return null;
            }

            return new TimelineWindow
            {
                Start = effectiveStart,
                End = effectiveEndExclusive.AddDays(-1),
                EndExclusive = effectiveEndExclusive
            };
        }

        private static string BuildTimelineTitle(TimelineSourceRow row, bool includeYear = true)
        {
            var baseTitle = string.IsNullOrWhiteSpace(row.NamaAudit)
                ? "Belum Diisi"
                : row.NamaAudit.Trim();
            var normalizedYear = row.Tahun?.Trim();

            if (!includeYear || string.IsNullOrWhiteSpace(normalizedYear))
            {
                return baseTitle;
            }

            return $"{baseTitle} ({normalizedYear})";
        }

        private static bool MatchesMode(string category, string? mode)
        {
            var normalizedMode = string.IsNullOrWhiteSpace(mode)
                ? "all"
                : mode.Trim().ToLowerInvariant();

            return normalizedMode switch
            {
                "open" => category == "open",
                "inprogress" => category == "inprogress",
                "closed" => category == "closed",
                "unknown" => category == "unknown",
                "anomaly" => category == "anomaly",
                _ => true
            };
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

        private static IQueryable<ListAudit> ApplyTimelineRangeFilter(
            IQueryable<ListAudit> query,
            DateTime? rangeStart,
            DateTime? rangeEnd)
        {
            if (rangeStart.HasValue)
            {
                var startBoundary = rangeStart.Value.Date;
                query = query.Where(row => !row.JATUHTEMPO.HasValue || row.JATUHTEMPO.Value >= startBoundary);
            }

            if (rangeEnd.HasValue)
            {
                var endBoundary = rangeEnd.Value;
                query = query.Where(row => !row.IN.HasValue || row.IN.Value < endBoundary);
            }

            return query;
        }

        private static bool OverlapsTimelineRange(
            TimelineWindow? window,
            DateTime? rangeStart,
            DateTime? rangeEnd)
        {
            if (window == null)
            {
                return false;
            }

            if (!rangeStart.HasValue && !rangeEnd.HasValue)
            {
                return true;
            }

            if (rangeStart.HasValue && window.EndExclusive <= rangeStart.Value)
            {
                return false;
            }

            if (rangeEnd.HasValue && window.Start >= rangeEnd.Value)
            {
                return false;
            }

            return true;
        }

        private static string ResolveGroupedStatusCategory(IEnumerable<TimelineSourceRow> rows)
        {
            var categories = rows
                .Select(row => ResolveStatusCategory(row.Status))
                .ToList();

            if (categories.Count == 0)
            {
                return "unknown";
            }

            if (categories.Contains("anomaly", StringComparer.Ordinal))
            {
                return "anomaly";
            }

            if (categories.Contains("inprogress", StringComparer.Ordinal))
            {
                return "inprogress";
            }

            if (categories.Contains("open", StringComparer.Ordinal))
            {
                return "open";
            }

            if (categories.All(category => category == "closed"))
            {
                return "closed";
            }

            if (categories.Contains("unknown", StringComparer.Ordinal))
            {
                return "unknown";
            }

            return "closed";
        }

        [HttpGet("timeline")]
        public async Task<IActionResult> GetTimeline(
            [FromQuery] string mode = "all",
            [FromQuery] bool distinct = false,
            [FromQuery] string type = "all",
            [FromQuery] DateTime? rangeStart = null,
            [FromQuery] DateTime? rangeEnd = null,
            CancellationToken cancellationToken = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async ct =>
                {
                    rangeStart = rangeStart?.Date;
                    rangeEnd = rangeEnd?.Date;

                    var query = ApplyAuditTypeFilter(_db.ListAudit.AsNoTracking(), type);

                    var sourceRows = await query
                        .OrderBy(row => row.JATUHTEMPO ?? DateTime.Today)
                        .ThenByDescending(row => row.CreatedAt)
                        .ThenByDescending(row => row.Id)
                        .Select(row => new TimelineSourceRow
                        {
                            Id = row.Id,
                            NamaAudit = row.NAMAAUDIT,
                            Tahun = row.TAHUN,
                            Start = row.IN,
                            End = row.JATUHTEMPO,
                            Status = row.STATUS
                        })
                        .ToListAsync(ct);

            var timelineRows = sourceRows
                .Select(row =>
                {
                    var window = ResolveTimelineWindow(row);
                    if (window == null)
                    {
                        return null;
                    }

                    var statusCategory = ResolveStatusCategory(row.Status);
                    return new TimelineAuditRow
                    {
                        Row = row,
                        Window = window,
                        StatusCategory = statusCategory,
                        StatusLabel = ResolveStatusDisplayLabelFromCategory(statusCategory),
                    };
                })
                .Where(row => row != null)
                .Cast<TimelineAuditRow>()
                .ToList();

            if (!distinct)
            {
                var filteredRows = timelineRows
                    .Where(row => MatchesMode(row.StatusCategory, mode))
                    .ToList();

                var visibleRows = filteredRows
                    .Where(row => OverlapsTimelineRange(row.Window, rangeStart, rangeEnd))
                    .ToList();

                var years = filteredRows
                    .SelectMany(row => new[]
                    {
                        row.Window.Start.Year,
                        row.Window.End.Year
                    })
                    .ToList();

                return Ok(new
                {
                    Events = visibleRows
                        .Select(row => new TimelineEventDto
                        {
                            Id = row.Row.Id.ToString(),
                            ResourceId = row.Row.Id.ToString(),
                            Title = BuildTimelineTitle(row.Row),
                            Start = row.Window.Start,
                            End = row.Window.End,
                            Status = row.StatusLabel,
                            RawStatus = row.StatusCategory == "anomaly"
                                ? row.Row.Status?.Trim()
                                : null
                        })
                        .ToList(),
                    Resources = visibleRows
                        .Select((row, index) => new TimelineResourceDto
                        {
                            Id = row.Row.Id.ToString(),
                            Title = BuildTimelineTitle(row.Row),
                            Order = index
                        })
                        .ToList(),
                    MinYear = years.Any() ? years.Min() : DateTime.Now.Year,
                    MaxYear = years.Any() ? years.Max() : DateTime.Now.Year,
                    Counts = new
                    {
                        All = timelineRows.Count,
                        Open = timelineRows.Count(row => row.StatusCategory == "open"),
                        InProgress = timelineRows.Count(row => row.StatusCategory == "inprogress"),
                        Closed = timelineRows.Count(row => row.StatusCategory == "closed"),
                        Unknown = timelineRows.Count(row => row.StatusCategory == "unknown"),
                        Anomaly = timelineRows.Count(row => row.StatusCategory == "anomaly")
                    }
                });
            }

            var groupedRows = timelineRows
                .GroupBy(row => new
                {
                    NamaAuditKey = string.IsNullOrWhiteSpace(row.Row.NamaAudit)
                        ? $"__blank__{row.Row.Id}"
                        : row.Row.NamaAudit.Trim(),
                    NamaAuditDisplay = string.IsNullOrWhiteSpace(row.Row.NamaAudit)
                        ? "Belum Diisi"
                        : row.Row.NamaAudit.Trim(),
                    Tahun = string.IsNullOrWhiteSpace(row.Row.Tahun)
                        ? string.Empty
                        : row.Row.Tahun.Trim()
                })
                .Select(group =>
                {
                    var orderedRows = group
                        .OrderBy(row => row.Window.Start)
                        .ThenBy(row => row.Window.End)
                        .ThenBy(row => row.Row.Id)
                        .ToList();

                    var anchorRow = orderedRows.First();
                    var statusCategory = ResolveGroupedStatusCategory(group.Select(item => item.Row));

                    return new GroupedAudit
                    {
                        Row = anchorRow.Row,
                        Rows = orderedRows,
                        Title = string.IsNullOrWhiteSpace(group.Key.Tahun)
                            ? group.Key.NamaAuditDisplay
                            : $"{group.Key.NamaAuditDisplay} ({group.Key.Tahun})",
                        Count = group.Count(),
                        MIN = group.Min(row => row.Window.Start),
                        MaxDate = group.Max(row => row.Window.End),
                        StatusCategory = statusCategory,
                        Status = ResolveStatusDisplayLabelFromCategory(statusCategory),
                        RawStatus = statusCategory == "anomaly"
                            ? string.Join(", ",
                                group.Select(row => row.Row.Status?.Trim())
                                    .Where(value => !string.IsNullOrWhiteSpace(value))
                                    .Distinct(StringComparer.OrdinalIgnoreCase)
                                    .Take(3))
                            : null
                    };
                })
                .OrderBy(group => group.MaxDate ?? DateTime.Today)
                .ThenBy(group => group.Title)
                .ToList();

            var filteredGroups = groupedRows
                .Where(group => MatchesMode(group.StatusCategory, mode))
                .ToList();

            var visibleGroups = filteredGroups
                .Select(group =>
                {
                    var overlappingRows = group.Rows
                        .Where(row => OverlapsTimelineRange(row.Window, rangeStart, rangeEnd))
                        .ToList();

                    if (overlappingRows.Count == 0)
                    {
                        return null;
                    }

                    var orderedVisibleRows = overlappingRows
                        .OrderBy(row => row.Window.Start)
                        .ThenBy(row => row.Window.End)
                        .ThenBy(row => row.Row.Id)
                        .ToList();

                    var anchorRow = orderedVisibleRows.First();
                    var statusCategory = ResolveGroupedStatusCategory(orderedVisibleRows.Select(item => item.Row));

                    return new GroupedAudit
                    {
                        Row = anchorRow.Row,
                        Rows = orderedVisibleRows,
                        Title = group.Title,
                        Count = orderedVisibleRows.Count,
                        MIN = orderedVisibleRows.Min(row => row.Window.Start),
                        MaxDate = orderedVisibleRows.Max(row => row.Window.End),
                        StatusCategory = statusCategory,
                        Status = ResolveStatusDisplayLabelFromCategory(statusCategory),
                        RawStatus = statusCategory == "anomaly"
                            ? string.Join(", ",
                                orderedVisibleRows.Select(row => row.Row.Status?.Trim())
                                    .Where(value => !string.IsNullOrWhiteSpace(value))
                                    .Distinct(StringComparer.OrdinalIgnoreCase)
                                    .Take(3))
                            : null
                    };
                })
                .Where(group => group != null)
                .Cast<GroupedAudit>()
                .ToList();

            var groupedYears = filteredGroups
                .SelectMany(group => new[]
                {
                    group.MIN?.Year ?? DateTime.Now.Year,
                    group.MaxDate?.Year ?? DateTime.Now.Year
                })
                .ToList();

            return Ok(new
            {
                Events = visibleGroups
                    .Select(group => new TimelineEventDto
                    {
                        Id = group.Row.Id.ToString(),
                        ResourceId = group.Row.Id.ToString(),
                        Title = group.Title,
                        Start = group.MIN,
                        End = group.MaxDate,
                        Status = group.Status,
                        RawStatus = string.IsNullOrWhiteSpace(group.RawStatus)
                            ? null
                            : group.RawStatus
                    })
                    .ToList(),
                Resources = visibleGroups
                    .Select((group, index) => new TimelineResourceDto
                    {
                        Id = group.Row.Id.ToString(),
                        Title = $"{group.Title} ({group.Count})",
                        Order = index
                    })
                    .ToList(),
                MinYear = groupedYears.Any() ? groupedYears.Min() : DateTime.Now.Year,
                MaxYear = groupedYears.Any() ? groupedYears.Max() : DateTime.Now.Year,
                Counts = new
                {
                    All = groupedRows.Count,
                    Open = groupedRows.Count(group => group.StatusCategory == "open"),
                    InProgress = groupedRows.Count(group => group.StatusCategory == "inprogress"),
                    Closed = groupedRows.Count(group => group.StatusCategory == "closed"),
                    Unknown = groupedRows.Count(group => group.StatusCategory == "unknown"),
                    Anomaly = groupedRows.Count(group => group.StatusCategory == "anomaly")
                }
            });
                },
                "Audit timeline request was canceled.",
                cancellationToken);
        }

        private sealed class TimelineSourceRow
        {
            public long Id { get; set; }
            public string? NamaAudit { get; set; }
            public string? Tahun { get; set; }
            public DateTime? Start { get; set; }
            public DateTime? End { get; set; }
            public string? Status { get; set; }
        }

        private sealed class TimelineAuditRow
        {
            public TimelineSourceRow Row { get; set; } = null!;
            public TimelineWindow Window { get; set; } = null!;
            public string StatusCategory { get; set; } = "unknown";
            public string StatusLabel { get; set; } = "Belum Diisi";
        }

        private sealed class TimelineWindow
        {
            public DateTime Start { get; set; }
            public DateTime End { get; set; }
            public DateTime EndExclusive { get; set; }
        }

        public sealed class TimelineEventDto
        {
            public string Id { get; set; } = string.Empty;
            public string ResourceId { get; set; } = string.Empty;
            public string Title { get; set; } = string.Empty;
            public DateTime? Start { get; set; }
            public DateTime? End { get; set; }
            public string Status { get; set; } = string.Empty;
            public string? RawStatus { get; set; }
        }

        public sealed class TimelineResourceDto
        {
            public string Id { get; set; } = string.Empty;
            public string Title { get; set; } = string.Empty;
            public int Order { get; set; }
        }

        private sealed class GroupedAudit
        {
            public TimelineSourceRow Row { get; set; } = null!;
            public IReadOnlyList<TimelineAuditRow> Rows { get; set; } = Array.Empty<TimelineAuditRow>();
            public string Title { get; set; } = string.Empty;
            public int Count { get; set; }
            public DateTime? MIN { get; set; }
            public DateTime? MaxDate { get; set; }
            public string StatusCategory { get; set; } = "unknown";
            public string Status { get; set; } = string.Empty;
            public string? RawStatus { get; set; }
        }
    }
}
