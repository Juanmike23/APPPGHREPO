/*
 * PGH-DOC

 * File: Controllers/ðŸ›’ProcurementController/APSChartController.cs

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
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using PGH.Dtos.Procurement;
using PGH.Helpers;
using PGH.Models.Procurement;
using System.Text.RegularExpressions;
using WebApplication2.Data;

namespace PGH.Controllers.Procurement
{
    [ApiController]
    [Route("api/[controller]")]
    public class APSChartController : ControllerBase
    {
        private readonly AppDbContext _db;

        public APSChartController(AppDbContext db)
        {
            _db = db;
        }

        // Treat client disconnect/navigation as a canceled request instead of a server failure.
        private Task<IActionResult> ExecuteProcurementRequestAsync(
            Func<CancellationToken, Task<IActionResult>> action,
            CancellationToken cancellationToken = default)
        {
            return RequestCancellationHelper.ExecuteAsync(
                this,
                action,
                "Procurement dashboard request was canceled.",
                cancellationToken);
        }

        private IQueryable<ProcurementItem> QueryProcurementItems(string? type = null)
        {
            var normalizedType = type?.Trim().ToLowerInvariant();
            var query = _db.ProcurementItems.AsQueryable();

            return normalizedType switch
            {
                "new" => query.Where(x => x.SourceType == ProcurementCanonicalHelper.SourceNew),
                "existing" => query.Where(x => x.SourceType == ProcurementCanonicalHelper.SourceExisting),
                _ => query
            };
        }

        private IQueryable<ProcurementItem> QueryReminderItems(string? type, int months)
        {
            var today = DateTime.UtcNow.Date;
            var currentYear = today.Year;
            var currentMonth = today.Month;

            return QueryProcurementItems(type).Where(x =>
                x.JatuhTempo != null &&
                x.JatuhTempo >= today &&
                ((((x.JatuhTempo!.Value.Year - currentYear) * 12) + x.JatuhTempo.Value.Month - currentMonth) >= 0) &&
                ((((x.JatuhTempo!.Value.Year - currentYear) * 12) + x.JatuhTempo.Value.Month - currentMonth) <= months));
        }

        private static int NormalizeReminderMonths(int months) =>
            months switch
            {
                <= 1 => 1,
                <= 3 => 3,
                _ => 6
            };

        private static Dictionary<int, int> BuildReminderBands(IEnumerable<DateTime> dueDates)
        {
            var counts = new Dictionary<int, int>
            {
                [1] = 0,
                [3] = 0,
                [6] = 0
            };

            foreach (var dueDate in dueDates)
            {
                var monthsRemaining = ProcurementCanonicalHelper.CalculateRemainingMonths(dueDate) ?? -1;
                if (monthsRemaining < 0)
                {
                    continue;
                }

                if (monthsRemaining <= 1)
                {
                    counts[1]++;
                }

                if (monthsRemaining <= 3)
                {
                    counts[3]++;
                }

                if (monthsRemaining <= 6)
                {
                    counts[6]++;
                }
            }

            return counts;
        }

        private static async Task<Dictionary<int, int>> BuildReminderBandsAsync(IQueryable<ProcurementItem> query)
        {
            var dueDates = await query
                .Where(x => x.JatuhTempo != null)
                .Select(x => x.JatuhTempo!.Value)
                .ToListAsync();

            return BuildReminderBands(dueDates);
        }

        private static ProcureTemp ToProcureTemp(ProcurementItem item) => new()
        {
            Id = item.Id,
            Source = item.SourceType == ProcurementCanonicalHelper.SourceExisting ? "ExistingProcure" : "NewProcure",
            NamaVendor = item.Vendor,
            Status_Pengadaan = item.Status_Pengadaan,
            Mulai = item.WaktuMulai,
            JatuhTempo = item.JatuhTempo,
            Judul = item.Perjanjian,
            Department = item.Department,
            Nominal = item.NilaiKontrak,
            MataAnggaran = item.JenisAnggaran
        };

        private sealed class ProcurementOverviewSummary
        {
            public string[] Labels { get; init; } = ["New", "Existing"];
            public int[] Values { get; init; } = [0, 0];
            public int Total { get; init; }
            public int New { get; init; }
            public int Existing { get; init; }
        }

        private sealed class ReminderBandSummary
        {
            public int Month1 { get; init; }
            public int Month3 { get; init; }
            public int Month6 { get; init; }
        }

        private sealed class ReminderCountsSummary
        {
            public int All { get; init; }
            public int Newproc { get; init; }
            public int Existingproc { get; init; }
            public object Bands { get; init; } = new { };
        }

        private sealed class StatusCountRow
        {
            public string Label { get; init; } = string.Empty;
            public int Count { get; init; }
            public int Total { get; init; }
            public double Percentage { get; init; }
            public int SortOrder { get; init; }
        }

        private sealed class ReminderProgressRow
        {
            public long ProcurementItemId { get; init; }
            public long TemplateNodeId { get; init; }
            public string? Status { get; init; }
        }

        private sealed class DashboardSummaryPayload
        {
            public ProcurementOverviewSummary Overview { get; init; } = new();
            public ReminderCountsSummary ReminderCounts { get; init; } = new();
            public Dictionary<string, List<ProcureReminderDto>> Reminders { get; init; } =
                new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, List<StatusCountRow>> StatusCounts { get; init; } =
                new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, List<object>> Funnels { get; init; } =
                new(StringComparer.OrdinalIgnoreCase);
        }

        private async Task<DashboardSummaryPayload> GetDashboardSummaryAsync(
            CancellationToken cancellationToken = default)
        {
            var allReminders = await BuildReminderListAsync("all", cancellationToken: cancellationToken);

            return new DashboardSummaryPayload
            {
                Overview = await BuildOverviewSummaryAsync(cancellationToken),
                ReminderCounts = await BuildReminderCountsSummaryAsync(cancellationToken),
                Reminders = new Dictionary<string, List<ProcureReminderDto>>(StringComparer.OrdinalIgnoreCase)
                {
                    ["all"] = allReminders,
                    ["new"] = allReminders
                        .Where(x => string.Equals(x.Type, "new", StringComparison.OrdinalIgnoreCase))
                        .ToList(),
                    ["existing"] = allReminders
                        .Where(x => string.Equals(x.Type, "existing", StringComparison.OrdinalIgnoreCase))
                        .ToList()
                },
                StatusCounts = new Dictionary<string, List<StatusCountRow>>(StringComparer.OrdinalIgnoreCase)
                {
                    ["all"] = await BuildStatusCountRowsAsync("all", cancellationToken),
                    ["new"] = await BuildStatusCountRowsAsync("new", cancellationToken),
                    ["existing"] = await BuildStatusCountRowsAsync("existing", cancellationToken)
                },
                Funnels = new Dictionary<string, List<object>>(StringComparer.OrdinalIgnoreCase)
                {
                    ["all"] = await BuildCheckpointFunnelRowsAsync("all", cancellationToken),
                    ["new"] = await BuildCheckpointFunnelRowsAsync("new", cancellationToken),
                    ["existing"] = await BuildCheckpointFunnelRowsAsync("existing", cancellationToken)
                }
            };
        }

        private async Task<ProcurementOverviewSummary> BuildOverviewSummaryAsync(CancellationToken cancellationToken = default)
        {
            var totalNew = await QueryProcurementItems("new").CountAsync(cancellationToken);
            var totalExisting = await QueryProcurementItems("existing").CountAsync(cancellationToken);

            return new ProcurementOverviewSummary
            {
                Values = [totalNew, totalExisting],
                Total = totalNew + totalExisting,
                New = totalNew,
                Existing = totalExisting
            };
        }

        private async Task<List<StatusCountRow>> BuildStatusCountRowsAsync(
            string? type = "all",
            CancellationToken cancellationToken = default)
        {
            var baseQuery = QueryProcurementItems(type).AsNoTracking();
            var totalProcurement = await baseQuery.CountAsync(cancellationToken);

            var rows = await baseQuery
                .Where(x => x.Status_Pengadaan != null && x.Status_Pengadaan.Trim() != string.Empty)
                .GroupBy(x => x.Status_Pengadaan!.Trim())
                .Select(group => new
                {
                    Label = group.Key,
                    Count = group.Count()
                })
                .OrderByDescending(row => row.Count)
                .ThenBy(row => row.Label)
                .ToListAsync(cancellationToken);

            return rows
                .Select((row, index) => new StatusCountRow
                {
                    Label = row.Label,
                    Count = row.Count,
                    Total = totalProcurement,
                    Percentage = totalProcurement > 0 ? Math.Round((double)row.Count / totalProcurement * 100d, 1) : 0d,
                    SortOrder = index + 1
                })
                .ToList();
        }

        private async Task<ReminderCountsSummary> BuildReminderCountsSummaryAsync(CancellationToken cancellationToken = default)
        {
            var reminderRows = await QueryReminderItems("all", 6)
                .AsNoTracking()
                .Where(x => x.JatuhTempo != null)
                .Select(x => new
                {
                    x.SourceType,
                    DueDate = x.JatuhTempo!.Value
                })
                .ToListAsync(cancellationToken);

            var allBands = BuildReminderBands(reminderRows.Select(x => x.DueDate));
            var newBands = BuildReminderBands(
                reminderRows
                    .Where(x => ProcurementCanonicalHelper.NormalizeSourceType(x.SourceType) == ProcurementCanonicalHelper.SourceNew)
                    .Select(x => x.DueDate));
            var existingBands = BuildReminderBands(
                reminderRows
                    .Where(x => ProcurementCanonicalHelper.NormalizeSourceType(x.SourceType) == ProcurementCanonicalHelper.SourceExisting)
                    .Select(x => x.DueDate));

            return new ReminderCountsSummary
            {
                All = allBands[6],
                Newproc = newBands[6],
                Existingproc = existingBands[6],
                Bands = new
                {
                    all = new ReminderBandSummary
                    {
                        Month1 = allBands[1],
                        Month3 = allBands[3],
                        Month6 = allBands[6]
                    },
                    newproc = new ReminderBandSummary
                    {
                        Month1 = newBands[1],
                        Month3 = newBands[3],
                        Month6 = newBands[6]
                    },
                    existingproc = new ReminderBandSummary
                    {
                        Month1 = existingBands[1],
                        Month3 = existingBands[3],
                        Month6 = existingBands[6]
                    }
                }
            };
        }

        private async Task EnrichReminderProgressAsync(
            List<ProcureReminderDto> reminders,
            CancellationToken cancellationToken = default)
        {
            if (reminders.Count == 0)
            {
                return;
            }

            var templateKey = StatusPengadaanStructureHelper.DefaultTemplateKey;
            var templates = await _db.StatusPengadaanTemplate
                .AsNoTracking()
                .Where(x => x.IsActive && (x.TemplateKey ?? templateKey) == templateKey)
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToListAsync(cancellationToken);

            var actionableTemplateIds = StatusPengadaanStructureHelper
                .ResolveActionableTemplateIds(templates)
                .ToHashSet();

            var actionableTemplates = templates
                .Where(x => actionableTemplateIds.Contains(x.Id))
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToList();

            var totalSteps = actionableTemplates.Count;
            var firstLabel = actionableTemplates.Count == 0
                ? "Not Started"
                : CleanAlurName(ResolveCheckpointLabel(actionableTemplates[0]));

            if (totalSteps == 0)
            {
                foreach (var reminder in reminders)
                {
                    reminder.Progress = 0;
                    reminder.DoneCount = 0;
                    reminder.TotalSteps = 0;
                    reminder.CurrentStep = "Not Started";
                }

                return;
            }

            var reminderIds = reminders
                .Select(x => x.Id)
                .Distinct()
                .ToList();

            var templateLabelMap = actionableTemplates.ToDictionary(
                x => x.Id,
                x => CleanAlurName(ResolveCheckpointLabel(x)));
            var templateOrderMap = actionableTemplates
                .Select((template, index) => new { template.Id, Index = index })
                .ToDictionary(x => x.Id, x => x.Index);

            var progressRows = await _db.StatusPengadaan
                .AsNoTracking()
                .Where(x =>
                    x.ProcurementItemId.HasValue &&
                    reminderIds.Contains(x.ProcurementItemId.Value) &&
                    x.TemplateNodeId.HasValue &&
                    actionableTemplateIds.Contains(x.TemplateNodeId.Value))
                .Select(x => new ReminderProgressRow
                {
                    ProcurementItemId = x.ProcurementItemId!.Value,
                    TemplateNodeId = x.TemplateNodeId!.Value,
                    Status = x.Status
                })
                .ToListAsync(cancellationToken);

            var rowsByProcurementId = progressRows
                .GroupBy(x => x.ProcurementItemId)
                .ToDictionary(group => group.Key, group => group.ToList());

            foreach (var reminder in reminders)
            {
                rowsByProcurementId.TryGetValue(reminder.Id, out var rows);
                rows ??= [];

                var doneRows = rows
                    .Where(x =>
                        string.Equals(x.Status, "Done", StringComparison.OrdinalIgnoreCase) &&
                        templateOrderMap.ContainsKey(x.TemplateNodeId))
                    .OrderBy(x => templateOrderMap[x.TemplateNodeId])
                    .ToList();

                var doneCount = doneRows.Count;
                var progress = (int)Math.Round(doneCount / (double)totalSteps * 100);
                var latestDone = doneRows.LastOrDefault();

                reminder.DoneCount = doneCount;
                reminder.TotalSteps = totalSteps;
                reminder.Progress = progress;
                reminder.CurrentStep = latestDone != null &&
                                       templateLabelMap.TryGetValue(latestDone.TemplateNodeId, out var currentLabel) &&
                                       !string.IsNullOrWhiteSpace(currentLabel)
                    ? currentLabel
                    : firstLabel;
            }
        }

        private async Task<List<ProcureReminderDto>> BuildReminderListAsync(
            string? type,
            string? sortBy = "countdown",
            int months = 6,
            CancellationToken cancellationToken = default)
        {
            var normalizedMonths = NormalizeReminderMonths(months);
            var items = await QueryReminderItems(type, normalizedMonths)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var result = items
                .Select(ProcurementCanonicalHelper.ToReminderDto)
                .ToList();

            await EnrichReminderProgressAsync(result, cancellationToken);

            return (sortBy ?? "countdown").Trim().ToLowerInvariant() switch
            {
                "countdown" => result.OrderBy(r => r.DaysRemaining).ToList(),
                _ => result.OrderBy(r => r.JatuhTempo).ToList()
            };
        }

        private async Task<List<object>> BuildCheckpointFunnelRowsAsync(
            string? type = "all",
            CancellationToken cancellationToken = default)
        {
            var templateKey = StatusPengadaanStructureHelper.DefaultTemplateKey;
            var templates = await _db.StatusPengadaanTemplate
                .AsNoTracking()
                .Where(x =>
                    x.IsActive &&
                    (x.TemplateKey ?? templateKey) == templateKey)
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToListAsync(cancellationToken);

            if (!templates.Any())
            {
                return [];
            }

            var actionableTemplateIds = StatusPengadaanStructureHelper
                .ResolveActionableTemplateIds(templates)
                .ToHashSet();

            var orderedCheckpoints = templates
                .Where(x => actionableTemplateIds.Contains(x.Id))
                .Select(x => new
                {
                    x.Id,
                    x.SortOrder,
                    Label = ResolveCheckpointLabel(x),
                })
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToList();

            var procurementIds = await QueryProcurementItems(type)
                .AsNoTracking()
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);

            var totalProcurement = procurementIds.Count;

            if (!orderedCheckpoints.Any())
            {
                return [];
            }

            var firstCheckpointId = orderedCheckpoints[0].Id;
            var checkpointOrderMap = orderedCheckpoints
                .Select((checkpoint, index) => new { checkpoint.Id, Index = index })
                .ToDictionary(x => x.Id, x => x.Index);
            var templateRevisionUtc = templates
                .Select(x => x.UpdatedAt ?? x.CreatedAt)
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .DefaultIfEmpty(DateTime.UtcNow)
                .Max();

            var progressRows = await _db.StatusPengadaan
                .AsNoTracking()
                .Where(x =>
                    x.TemplateNodeId.HasValue &&
                    x.ProcurementItemId.HasValue &&
                    actionableTemplateIds.Contains(x.TemplateNodeId.Value) &&
                    procurementIds.Contains(x.ProcurementItemId.Value))
                .Select(x => new
                {
                    ProcurementItemId = x.ProcurementItemId!.Value,
                    TemplateNodeId = x.TemplateNodeId!.Value,
                    x.Status,
                })
                .ToListAsync(cancellationToken);

            var rowsByProcurement = progressRows
                .GroupBy(x => x.ProcurementItemId)
                .ToDictionary(group => group.Key, group => group.ToList());

            var checkpointCount = orderedCheckpoints.Count;
            var currentFrequency = new int[checkpointCount];

            foreach (var procurementId in procurementIds)
            {
                var currentCheckpointId = firstCheckpointId;

                if (rowsByProcurement.TryGetValue(procurementId, out var rows))
                {
                    var furthestDoneTemplateId = rows
                        .Where(x =>
                            string.Equals(x.Status, "Done", StringComparison.OrdinalIgnoreCase) &&
                            checkpointOrderMap.ContainsKey(x.TemplateNodeId))
                        .OrderBy(x => checkpointOrderMap[x.TemplateNodeId])
                        .Select(x => x.TemplateNodeId)
                        .LastOrDefault();

                    if (furthestDoneTemplateId != 0)
                    {
                        currentCheckpointId = furthestDoneTemplateId;
                    }
                }

                if (!checkpointOrderMap.ContainsKey(currentCheckpointId))
                {
                    currentCheckpointId = firstCheckpointId;
                }

                var currentCheckpointOrder = checkpointOrderMap.TryGetValue(currentCheckpointId, out var resolvedOrder)
                    ? resolvedOrder
                    : 0;

                if (currentCheckpointOrder < 0 || currentCheckpointOrder >= checkpointCount)
                {
                    currentCheckpointOrder = 0;
                }

                currentFrequency[currentCheckpointOrder]++;
            }

            var cumulativeDone = new int[checkpointCount];
            var runningDone = 0;
            for (var index = checkpointCount - 1; index >= 0; index--)
            {
                runningDone += currentFrequency[index];
                cumulativeDone[index] = runningDone;
            }

            return orderedCheckpoints
                .Select((checkpoint, index) =>
                {
                    var currentCount = currentFrequency[index];
                    var cumulativeDoneCount = cumulativeDone[index];
                    var notYetCount = Math.Max(totalProcurement - cumulativeDoneCount, 0);
                    var currentPercentage = totalProcurement == 0
                        ? 0
                        : Math.Round((double)currentCount / totalProcurement * 100d, 1);
                    var completionRate = totalProcurement == 0
                        ? 0
                        : Math.Round((double)cumulativeDoneCount / totalProcurement * 100d, 1);

                    return (object)new
                    {
                        checkpoint.Id,
                        checkpoint.Label,
                        checkpoint.SortOrder,
                        Index = index + 1,
                        Count = currentCount,
                        CurrentCount = currentCount,
                        CumulativeDoneCount = cumulativeDoneCount,
                        NotYetCount = notYetCount,
                        Percentage = currentPercentage,
                        CompletionRate = completionRate,
                        Total = totalProcurement,
                        MetricType = "CurrentStageDistribution",
                        PercentageFormula = "CurrentCount/Total*100",
                        CompletionFormula = "CumulativeDoneCount/Total*100",
                        TemplateRevisionUtc = templateRevisionUtc,
                    };
                })
                .ToList();
        }

        // ============================
        // 1ï¸âƒ£  CHART: Total New vs Existing
        // ============================
        [HttpGet("chart/overview")]
        public async Task<IActionResult> GetChartOverview(CancellationToken cancellationToken)
        {
            return await ExecuteProcurementRequestAsync(
                async ct => Ok((await GetDashboardSummaryAsync(ct)).Overview),
                cancellationToken);
        }

        [HttpGet("dashboard-summary")]
        [EnableRateLimiting("dashboard-heavy")]
        public async Task<IActionResult> GetDashboardSummary(CancellationToken cancellationToken)
        {
            return await ExecuteProcurementRequestAsync(
                async ct => Ok(await GetDashboardSummaryAsync(ct)),
                cancellationToken);
        }

        // ============================
        // 2ï¸âƒ£  CHART: Due within x months
        // ============================
        [HttpGet("chart/duedue")]
        public async Task<IActionResult> GetChartDueWithinXMonths(
      [FromQuery] int months = 3,
      [FromQuery] string type = "all",
      CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementRequestAsync(
                async ct =>
                {
                    months = months switch
                    {
                        <= 1 => 1,
                        <= 3 => 3,
                        _ => 6
                    };

                    var newQuery = QueryReminderItems("new", months);
                    var existingQuery = QueryReminderItems("existing", months);

                    int newDueCount = 0;
                    int existingDueCount = 0;
                    object chartData;

                    if (type.Equals("new", StringComparison.OrdinalIgnoreCase))
                    {
                        newDueCount = await newQuery.CountAsync(ct);

                        chartData = new
                        {
                            Labels = new[] { "New" },
                            Values = new[] { newDueCount },
                            Total = newDueCount,
                            Type = "new"
                        };
                    }
                    else if (type.Equals("existing", StringComparison.OrdinalIgnoreCase))
                    {
                        existingDueCount = await existingQuery.CountAsync(ct);

                        chartData = new
                        {
                            Labels = new[] { "Existing" },
                            Values = new[] { existingDueCount },
                            Total = existingDueCount,
                            Type = "existing"
                        };
                    }
                    else
                    {
                        newDueCount = await newQuery.CountAsync(ct);
                        existingDueCount = await existingQuery.CountAsync(ct);

                        chartData = new
                        {
                            Labels = new[] { "New", "Existing" },
                            Values = new[] { newDueCount, existingDueCount },
                            Total = newDueCount + existingDueCount,
                            Type = "all"
                        };
                    }

                    return Ok(chartData);
                },
                cancellationToken);
        }


        // ============================
        // 3[]  CHART: bar status pengadaan
        // ============================
        [HttpGet("chart/by-status")]
        public async Task<IActionResult> GetChartByStatus(
            [FromQuery] string? type = "all",
            CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementRequestAsync(
                async ct =>
                {
                    var statusCounts = await BuildStatusCountRowsAsync(type, ct);
                    var labels = statusCounts.Select(x => x.Label).ToArray();
                    var values = statusCounts.Select(x => x.Count).ToArray();
                    var total = values.Sum();

                    var result = new
                    {
                        Labels = labels,
                        Values = values,
                        Total = total,
                        Type = (type ?? "all").Trim().ToLowerInvariant()
                    };

                    return Ok(result);
                },
                cancellationToken);
        }



        // ============================
        // 4[]  (Already Existing) Reminder Endpoint
        // ============================
        // GET: api/APSChart/reminders?type=all|new|existing&sortBy=countdown|progress
        [HttpGet("reminders")]
        public async Task<IActionResult> GetReminders(
            [FromQuery] string? type = "all",
            [FromQuery] string? sortBy = "countdown",
            [FromQuery] int months = 6,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementRequestAsync(
                async ct => Ok(await BuildReminderListAsync(type, sortBy, months, ct)),
                cancellationToken);
        }


        [HttpGet("reminders/counts")]
        public async Task<IActionResult> GetReminderCounts(CancellationToken cancellationToken)
        {
            return await ExecuteProcurementRequestAsync(
                async ct => Ok((await GetDashboardSummaryAsync(ct)).ReminderCounts),
                cancellationToken);
        }


        // (optional) util to mimic frontend progress calculation if template steps are defined
        private static int CalculateProgress(string? status, List<string> steps)
        {
            if (string.IsNullOrWhiteSpace(status) || steps.Count == 0) return 0;

            string clean(string s) => Regex.Replace(s ?? "", @"^[a-z0-9]+[.)]\s*", "", RegexOptions.IgnoreCase).Trim().ToLower();
            var normalized = clean(status);
            var idx = steps.FindIndex(s => clean(s) == normalized);
            return idx < 0 ? 0 : (int)Math.Round(((double)(idx + 1) / steps.Count) * 100);
        }



        //get column only
        [HttpGet("column/{columnName}")]
        public async Task<IActionResult> GetColumnValues(string columnName, [FromQuery] string? type = null)
        {
            var prop = typeof(ProcurementItem).GetProperty(columnName);
            if (prop == null)
                return BadRequest($"Column '{columnName}' does not exist.");

            var items = await QueryProcurementItems(type).ToListAsync();
            var result = items.Select(item => new
            {
                Source = item.SourceType == ProcurementCanonicalHelper.SourceExisting ? "ExistingProcure" : "NewProcure",
                Id = item.Id,
                Value = prop.GetValue(item)
            }).ToList();

            return Ok(result);
        }

        [HttpGet("combined-status")]
        public async Task<IActionResult> GetCombinedStatus(
      [FromQuery] string? columnName = "Status_Pengadaan",
      [FromQuery] string? type = null,
      CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementRequestAsync(
                async ct =>
                {
                    // --- 1ï¸âƒ£ Load AlurPengadaanIT order ---
                    var alurList = await _db.StatusPengadaanTemplate
                .Where(x => !string.IsNullOrWhiteSpace(x.AlurPengadaanIT))
                .OrderBy(x => x.Id)
                .Select(x => new
                {
                    x.Id,
                    x.AlurPengadaanIT,
                    AlurOrder = ExtractAlurOrder(x.AlurPengadaanIT ?? string.Empty)
                })
                .ToListAsync(ct);

                    // Build lookup dictionary: normalized AlurOrder â†’ position index
                    var orderMap = alurList
                .Select((x, idx) => new { Key = Normalize(x.AlurOrder), Index = idx })
                .GroupBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToDictionary(x => x.Key, x => x.Index, StringComparer.OrdinalIgnoreCase);

                    var prop = typeof(ProcurementItem).GetProperty(columnName ?? "");
                    if (prop == null)
                        return BadRequest($"Column '{columnName}' does not exist.");

                    var result = new List<dynamic>();

                    var items = await QueryProcurementItems(type).ToListAsync(ct);
                    result.AddRange(items.Select(item => new
                    {
                        Source = item.SourceType == ProcurementCanonicalHelper.SourceExisting ? "ExistingProcure" : "NewProcure",
                        Value = prop.GetValue(item)?.ToString()
                    }));

                    // --- 5ï¸âƒ£ Filter out blanks ---
                    result = result.Where(r => !string.IsNullOrWhiteSpace(r.Value)).ToList();

                    // --- 6ï¸âƒ£ Sort according to AlurPengadaanIT order ---
                    var ordered = result
                .Select(r =>
                {
                    var normalized = Normalize(r.Value);
                    int orderIndex = orderMap.TryGetValue(normalized, out int idx) ? idx : int.MaxValue;
                    return new
                    {
                        r.Source,
                        r.Value,
                        OrderIndex = orderIndex
                    };
                })
                .OrderBy(r => r.OrderIndex)
                .ThenBy(r => r.Source)
                .Select(r => new
                {
                    r.Source,
                    r.Value
                })
                .ToList();

                    return Ok(ordered);
                },
                cancellationToken);
        }

        [HttpGet("checkpoint-funnel")]
        public async Task<IActionResult> GetCheckpointFunnel(
            [FromQuery] string? type = "all",
            CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementRequestAsync(
                async ct =>
                {
                    var normalizedType = (type ?? "all").Trim().ToLowerInvariant();
                    var payload = await GetDashboardSummaryAsync(ct);
                    return Ok(
                        payload.Funnels.TryGetValue(normalizedType, out var rows)
                            ? rows
                            : payload.Funnels.TryGetValue("all", out var allRows)
                                ? allRows
                                : Array.Empty<object>());
                },
                cancellationToken);
        }

        private static string ResolveCheckpointLabel(StatusPengadaanTemplate template)
        {
            if (!string.IsNullOrWhiteSpace(template.Title))
            {
                return template.Title.Trim();
            }

            if (!string.IsNullOrWhiteSpace(template.DenganDetail))
            {
                return template.DenganDetail.Trim();
            }

            if (!string.IsNullOrWhiteSpace(template.Persetujuan))
            {
                return template.Persetujuan.Trim();
            }

            return (template.AlurPengadaanIT ?? $"Checkpoint {template.Id}").Trim();
        }

        private static string CleanAlurName(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
            {
                return input;
            }

            var index = input.IndexOf(". ", StringComparison.Ordinal);
            if (index >= 0 && index + 2 < input.Length)
            {
                return input[(index + 2)..].Trim();
            }

            return input.Trim();
        }




        [HttpGet("filter")]
        public async Task<IActionResult> GetFilteredAPS([FromQuery] string? type = "all")
        {
            var queryParams = HttpContext.Request.Query;
            type = type?.ToLowerInvariant() ?? "all";

            // ðŸ§± Base query: unified shape
            IQueryable<ProcureTemp> baseQuery;

            // ðŸ§© Choose table(s)
            switch (type)
            {
                case "new":
                    baseQuery = QueryProcurementItems("new").Select(x => new ProcureTemp
                    {
                        Id = x.Id,
                        Source = "NewProcure",
                        NamaVendor = x.Vendor,
                        Status_Pengadaan = x.Status_Pengadaan,
                        Mulai = x.WaktuMulai,
                        JatuhTempo = x.JatuhTempo,
                        Judul = x.Perjanjian,
                        Department = x.Department,
                        Nominal = x.NilaiKontrak,
                        MataAnggaran = x.JenisAnggaran

                    });
                    break;

                case "existing":
                    baseQuery = QueryProcurementItems("existing").Select(x => new ProcureTemp
                    {
                        Id = x.Id,
                        Source = "ExistingProcure",
                        NamaVendor = x.Vendor,
                        Status_Pengadaan = x.Status_Pengadaan,
                        Mulai = x.WaktuMulai,
                        JatuhTempo = x.JatuhTempo,
                        Judul = x.Perjanjian,
                        Department = x.Department,
                        Nominal = x.NilaiKontrak,
                        MataAnggaran = x.JenisAnggaran

                    });
                    break;

                default: // all
                    var newPart = QueryProcurementItems("new").Select(x => new ProcureTemp
                    {
                        Id = x.Id,
                        Source = "NewProcure",
                        NamaVendor = x.Vendor,
                        Status_Pengadaan = x.Status_Pengadaan,
                        Mulai = x.WaktuMulai,
                        JatuhTempo = x.JatuhTempo,
                        Judul = x.Perjanjian,
                        Department = x.Department,
                        Nominal = x.NilaiKontrak,
                        MataAnggaran = x.JenisAnggaran

                    });
                    var existingPart = QueryProcurementItems("existing").Select(x => new ProcureTemp
                    {
                        Id = x.Id,
                        Source = "ExistingProcure",
                        NamaVendor = x.Vendor,
                        Status_Pengadaan = x.Status_Pengadaan,
                        Mulai = x.WaktuMulai,
                        JatuhTempo = x.JatuhTempo,
                        Judul = x.Perjanjian,
                        Department = x.Department,
                        Nominal = x.NilaiKontrak,
                        MataAnggaran = x.JenisAnggaran

                    });
                    baseQuery = newPart.Concat(existingPart);
                    break;
            }

            // ðŸ§  Apply dynamic query filters
            if (queryParams.Any())
            {
                foreach (var kvp in queryParams)
                {
                    var column = kvp.Key;
                    if (string.Equals(column, "type", StringComparison.OrdinalIgnoreCase))
                        continue; // skip the type param

                    var value = kvp.Value.FirstOrDefault()?.Trim();
                    if (string.IsNullOrEmpty(value)) continue;

                    var prop = typeof(ProcureTemp).GetProperty(column);
                    if (prop == null)
                        return BadRequest($"Column '{column}' does not exist.");

                    var normalized = value.ToLowerInvariant();

                    // LIKE '%value%' search (case-insensitive)
                    baseQuery = baseQuery.Where(e =>
                        EF.Property<string>(e, column) != null &&
                        EF.Functions.Like(EF.Property<string>(e, column).ToLower(), $"%{normalized}%"));
                }
            }

            var list = await baseQuery.ToListAsync();

            return Ok(list);
        }

        // ðŸ§© Temp projection shape
        internal class ProcureTemp
        {
            public long Id { get; set; }

            public string Source { get; set; } = "";

            public string? Department { get; set; }
            public string? NamaVendor { get; set; }
            public string? Status_Pengadaan { get; set; }
            public string? Nominal { get; set; }
            public string? MataAnggaran { get; set; }

            public DateTime? Mulai { get; set; }
            public DateTime? JatuhTempo { get; set; }
            public string? Judul { get; set; }

          
        }

        [HttpGet("filtered-by-due")]
        public async Task<IActionResult> GetFilteredByDue(
    [FromQuery] int countdown = 6, // months ahead
    [FromQuery] string type = "all")
        {
            var now = DateTime.UtcNow;
            var cutoff = now.AddMonths(countdown);

            // ðŸ§± Base queries
            var newQuery = QueryProcurementItems("new")
                .Where(x => x.JatuhTempo != null && x.JatuhTempo >= now && x.JatuhTempo <= cutoff)
                .Select(x => new ProcureTemp
                {
                    Id = x.Id,
                    Source = "NewProcure",
                    Department = x.Department,
                    NamaVendor = x.Vendor,
                    Status_Pengadaan = x.Status_Pengadaan,
                    Mulai = x.WaktuMulai,
                    JatuhTempo = x.JatuhTempo,
                    Judul = x.Perjanjian
                });

            var existingQuery = QueryProcurementItems("existing")
                .Where(x => x.JatuhTempo != null && x.JatuhTempo >= now && x.JatuhTempo <= cutoff)
                .Select(x => new ProcureTemp
                {
                    Id = x.Id,
                    Source = "ExistingProcure",
                    Department = x.Department,
                    NamaVendor = x.Vendor,
                    Status_Pengadaan = x.Status_Pengadaan,
                    Mulai = x.WaktuMulai,
                    JatuhTempo = x.JatuhTempo,
                    Judul = x.Perjanjian
                });

            List<ProcureTemp> result;

            switch (type.ToLowerInvariant())
            {
                case "new":
                    result = await newQuery.ToListAsync();
                    break;

                case "existing":
                    result = await existingQuery.ToListAsync();
                    break;

                default: // all
                    var combined = newQuery.Concat(existingQuery);
                    result = await combined.ToListAsync();
                    break;
            }

            // ðŸ§® Optionally include computed fields
            var enrichedResult = result
                .Select(r => new
                {
                    r.Id,
                    r.Source,
                    r.Department,
                    r.NamaVendor,
                    r.Status_Pengadaan,
                    r.Mulai,
                    r.JatuhTempo,
                    r.Judul,
                    DaysRemaining = r.JatuhTempo.HasValue
                        ? (r.JatuhTempo.Value - DateTime.UtcNow).Days
                        : (int?)null
                })
                .OrderBy(r => r.DaysRemaining)
                .ToList();

            return Ok(enrichedResult);

        }




        // --- Helpers ---
        private static string ExtractAlurOrder(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return string.Empty;

            text = text.Trim();
            var idx = text.IndexOf(". ");
            if (idx >= 0 && idx + 2 < text.Length)
                return text[(idx + 2)..].Trim();
            return text;
        }

        private static string Normalize(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            return Regex.Replace(input.Trim(), @"^[a-z0-9]+[.)-]?\s*", "", RegexOptions.IgnoreCase)
                .Trim()
                .ToLowerInvariant();
        }


    }





}
