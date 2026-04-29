/*
 * PGH-DOC
 * File: Controllers/⚖️ComplianceController/DocumentPeriodReportController.cs
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
using Microsoft.Extensions.Caching.Memory;
using Newtonsoft.Json.Linq;
using PGH.Dtos.Compliance;
using PGH.Helpers;
using PGH.Models.Compliance;
using System.Security.Claims;
using WebApplication2.Data;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public partial class DocumentPeriodReportController : ControllerBase
    {
        private static class ComplianceProgressSummaryCacheOptions
        {
            public static readonly TimeSpan SummaryTtl = TimeSpan.FromSeconds(45);
        }

        private const string ProgressValidationMessage = "ProgressPercent must be between 0 and 100.";
        private const string DocumentValidationMessage = "DocumentId is not valid.";
        private const string LinkValidationMessage = "Link harus berupa URL absolut http:// atau https://.";

        private readonly AppDbContext _db;
        private readonly IMemoryCache _memoryCache;

        public DocumentPeriodReportController(AppDbContext db, IMemoryCache memoryCache)
        {
            _db = db;
            _memoryCache = memoryCache;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] long? groupId = null,
            CancellationToken cancellationToken = default)
        {
            var list = await GetRowsForReadAsync(groupId, cancellationToken);
            return Ok(list);
        }

        [HttpGet("progress-summary")]
        public async Task<IActionResult> GetProgressSummary(CancellationToken cancellationToken = default)
        {
            var stream = User.FindFirst("stream")?.Value ?? "unknown-stream";
            var level =
                User.FindFirst("level")?.Value ??
                User.FindFirst(ClaimTypes.Role)?.Value ??
                "unknown-level";
            var cacheKey = $"compliance-progress-summary::{level}::{stream}";

            if (_memoryCache.TryGetValue(cacheKey, out List<object>? cachedSummary) &&
                cachedSummary != null)
            {
                return Ok(cachedSummary);
            }

            var rows = await (
                from report in _db.DocumentPeriodReport.AsNoTracking()
                join grp in _db.DocumentPeriodReportGroups.AsNoTracking()
                    on report.DocumentPeriodReportGroupId equals grp.Id into groupJoin
                from grp in groupJoin.DefaultIfEmpty()
                select new
                {
                    groupId = grp != null ? (long?)grp.Id : report.DocumentPeriodReportGroupId,
                    periodName = grp != null ? grp.PeriodName : report.PeriodName,
                    period = grp != null ? grp.Period : report.Period,
                    progressPercent = report.ProgressPercent
                })
                .ToListAsync(cancellationToken);

            var summary = rows
                .Where(x => x.groupId.HasValue || !string.IsNullOrWhiteSpace(x.periodName))
                .GroupBy(x => new { x.groupId, x.periodName, x.period })
                .Select(g => new
                {
                    groupId = g.Key.groupId,
                    periodName = g.Key.periodName,
                    period = g.Key.period,
                    documentCount = g.Count(),
                    averageProgress = ComplianceDocumentReportHelper.RoundProgress(g.Average(x => x.progressPercent)),
                    completedCount = g.Count(x => x.progressPercent >= 100m),
                    notStartedCount = g.Count(x => x.progressPercent <= 0m)
                })
                .OrderByDescending(x => x.groupId)
                .ThenBy(x => x.periodName)
                .Cast<object>()
                .ToList();

            _memoryCache.Set(
                cacheKey,
                summary,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = ComplianceProgressSummaryCacheOptions.SummaryTtl
                });

            return Ok(summary);
        }

        [HttpGet("{id:long}")]
        public async Task<IActionResult> GetById(long id, CancellationToken cancellationToken = default)
        {
            var row = await BuildReadQuery()
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

            if (row == null)
            {
                return NotFound();
            }

            return Ok(row);
        }

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken = default)
        {
            var row = await _db.DocumentPeriodReport.FindAsync(new object[] { id }, cancellationToken);
            if (row == null)
            {
                return NotFound();
            }

            var previousDocumentId = row.DocumentId;
            _db.DocumentPeriodReport.Remove(row);
            await _db.SaveChangesAsync(cancellationToken);

            await CleanupOrphanDocumentAsync(previousDocumentId, cancellationToken);
            return Ok(new { message = "Deleted", id });
        }

        [HttpPatch("{id:long}")]
        public async Task<IActionResult> Patch(
            long id,
            [FromBody] DocumentPeriodReportPatchRequestDto body,
            CancellationToken cancellationToken = default)
        {
            var row = await _db.DocumentPeriodReport.FindAsync(new object[] { id }, cancellationToken);
            if (row == null)
            {
                return NotFound();
            }

            if (body?.Changes == null)
            {
                return BadRequest(new { message = "No changes provided." });
            }

            var changes = body.Changes;
            var previousDocumentId = row.DocumentId;

            if (ComplianceDocumentReportHelper.TryGetProperty(changes, "DocumentId", out var documentIdToken))
            {
                if (documentIdToken.Type == JTokenType.Null)
                {
                    row.DocumentId = null;
                }
                else
                {
                    if (!ComplianceDocumentReportHelper.TryReadLong(documentIdToken, out var documentId))
                    {
                        return BadRequest(new { message = DocumentValidationMessage });
                    }

                    var documentExists = await _db.Documents
                        .AsNoTracking()
                        .AnyAsync(x => x.Id == documentId, cancellationToken);

                    if (!documentExists)
                    {
                        return BadRequest(new { message = DocumentValidationMessage });
                    }

                    row.DocumentId = documentId;
                }
            }

            if (previousDocumentId != row.DocumentId)
            {
                await RegisterPendingDocumentChangeAsync(
                    row.Id,
                    nameof(DocumentPeriodReport.DocumentId),
                    previousDocumentId,
                    row.DocumentId,
                    cancellationToken);
            }

            if (ComplianceDocumentReportHelper.TryGetProperty(changes, "DocumentToSubmit", out var documentToSubmitToken))
            {
                row.DocumentToSubmit = documentToSubmitToken.Type == JTokenType.Null
                    ? null
                    : ComplianceDocumentReportHelper.NormalizeOptionalText(documentToSubmitToken.ToObject<string>());
            }

            if (ComplianceDocumentReportHelper.TryGetProperty(changes, "Link", out var linkToken))
            {
                var incomingLink = linkToken.Type == JTokenType.Null
                    ? null
                    : linkToken.ToObject<string>();

                if (!ComplianceDocumentReportHelper.TryNormalizeExternalLink(incomingLink, out var normalizedLink))
                {
                    return BadRequest(new { message = LinkValidationMessage });
                }

                row.Link = normalizedLink;
            }

            if (ComplianceDocumentReportHelper.TryGetProperty(changes, "ProgressPercent", out var progressPercentToken))
            {
                if (!ComplianceDocumentReportHelper.TryReadDecimal(progressPercentToken, out var progressPercent))
                {
                    return BadRequest(new { message = ProgressValidationMessage });
                }

                if (!ComplianceDocumentReportHelper.IsValidProgress(progressPercent))
                {
                    return BadRequest(new { message = ProgressValidationMessage });
                }

                row.ProgressPercent = ComplianceDocumentReportHelper.RoundProgress(progressPercent);
            }

            var group = row.DocumentPeriodReportGroupId.HasValue
                ? await _db.DocumentPeriodReportGroups
                    .FirstOrDefaultAsync(item => item.Id == row.DocumentPeriodReportGroupId.Value, cancellationToken)
                : null;

            if (group != null)
            {
                group.UpdatedAt = DateTime.UtcNow;
                MergeSuggestionSeedIntoGroup(group, row);
            }

            await _db.SaveChangesAsync(cancellationToken);
            await CleanupOrphanDocumentAsync(
                previousDocumentId != row.DocumentId ? previousDocumentId : null,
                cancellationToken);

            var updated = await BuildReadQuery()
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

            var response = updated ?? ToReadDto(row, group);
            return Ok(response);
        }

        private async Task CleanupOrphanDocumentAsync(long? documentId, CancellationToken cancellationToken)
        {
            if (!documentId.HasValue)
            {
                return;
            }

            var stillReferenced = await _db.DocumentPeriodReport
                .AsNoTracking()
                .AnyAsync(x => x.DocumentId == documentId.Value, cancellationToken);

            if (stillReferenced)
            {
                return;
            }

            var orphanDocument = await _db.Documents
                .FirstOrDefaultAsync(x => x.Id == documentId.Value, cancellationToken);

            if (orphanDocument == null)
            {
                return;
            }

            _db.Documents.Remove(orphanDocument);
            await _db.SaveChangesAsync(cancellationToken);
        }

        [HttpPost]
        public async Task<IActionResult> Create(
            [FromBody] DocumentPeriodReportCreateDto dto,
            CancellationToken cancellationToken = default)
        {
            if (!ComplianceDocumentReportHelper.IsValidProgress(dto.ProgressPercent))
            {
                return BadRequest(new { message = ProgressValidationMessage });
            }

            if (dto.DocumentId.HasValue)
            {
                var documentExists = await _db.Documents
                    .AsNoTracking()
                    .AnyAsync(x => x.Id == dto.DocumentId.Value, cancellationToken);

                if (!documentExists)
                {
                    return BadRequest(new { message = DocumentValidationMessage });
                }
            }

            if (!ComplianceDocumentReportHelper.TryNormalizeExternalLink(dto.Link, out var normalizedLink))
            {
                return BadRequest(new { message = LinkValidationMessage });
            }

            var group = await ResolveGroupForCreateAsync(dto, cancellationToken);
            if (group == null)
            {
                return BadRequest(new { message = GroupValidationMessage });
            }

            var entity = new DocumentPeriodReport
            {
                DocumentPeriodReportGroupId = group.Id,
                Period = group.Period,
                PeriodName = group.PeriodName,
                DocumentId = dto.DocumentId,
                DocumentToSubmit = ComplianceDocumentReportHelper.NormalizeOptionalText(dto.DocumentToSubmit),
                CreatedAt = dto.CreatedAt ?? DateTime.UtcNow,
                Link = normalizedLink,
                ProgressPercent = ComplianceDocumentReportHelper.RoundProgress(dto.ProgressPercent)
            };

            _db.DocumentPeriodReport.Add(entity);
            group.UpdatedAt = DateTime.UtcNow;
            MergeSuggestionSeedIntoGroup(group, entity);
            await _db.SaveChangesAsync(cancellationToken);

            var created = await BuildReadQuery()
                .FirstOrDefaultAsync(x => x.Id == entity.Id, cancellationToken);

            var response = created ?? ToReadDto(entity, group);
            return Ok(new { inserted = response });
        }

        private IQueryable<DocumentPeriodReportReadDto> BuildReadQuery()
        {
            return
                from r in _db.DocumentPeriodReport.AsNoTracking()
                join g in _db.DocumentPeriodReportGroups.AsNoTracking()
                    on r.DocumentPeriodReportGroupId equals g.Id into groupJoin
                from g in groupJoin.DefaultIfEmpty()
                join d in _db.Documents.AsNoTracking() on r.DocumentId equals d.Id into gj
                from d in gj.DefaultIfEmpty()
                select new DocumentPeriodReportReadDto
                {
                    Id = r.Id,
                    GroupId = g != null ? g.Id : r.DocumentPeriodReportGroupId,
                    Period = g != null ? g.Period : r.Period,
                    PeriodName = g != null ? g.PeriodName : r.PeriodName,
                    DocumentId = r.DocumentId,
                    DocumentToSubmit = r.DocumentToSubmit,
                    CreatedAt = r.CreatedAt,
                    FileName = d != null ? d.FileName : null,
                    Link = ComplianceDocumentReportHelper.SanitizeExternalLinkForOutput(r.Link),
                    DocumentFileUrl = d != null ? ComplianceDocumentReportHelper.BuildDocumentFilePath(d.Id) : null,
                    ProgressPercent = r.ProgressPercent
                };
        }

        private async Task RegisterPendingDocumentChangeAsync(
            long entityId,
            string columnName,
            long? previousDocumentId,
            long? nextDocumentId,
            CancellationToken cancellationToken)
        {
            if (HttpContext?.Items == null)
            {
                return;
            }

            var documentIds = new[] { previousDocumentId, nextDocumentId }
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToArray();

            var documentsById = documentIds.Length == 0
                ? new Dictionary<long, Documents>()
                : await _db.Documents
                    .AsNoTracking()
                    .Where(document => documentIds.Contains(document.Id))
                    .ToDictionaryAsync(document => document.Id, cancellationToken);

            documentsById.TryGetValue(previousDocumentId ?? 0, out var previousDocument);
            documentsById.TryGetValue(nextDocumentId ?? 0, out var nextDocument);

            if (!HttpContext.Items.TryGetValue(AppDbContext.PendingComplianceDocumentChangesItemKey, out var rawValue) ||
                rawValue is not List<AppDbContext.PendingDocumentLinkChange> pendingChanges)
            {
                pendingChanges = new List<AppDbContext.PendingDocumentLinkChange>();
                HttpContext.Items[AppDbContext.PendingComplianceDocumentChangesItemKey] = pendingChanges;
            }

            pendingChanges.Add(new AppDbContext.PendingDocumentLinkChange(
                entityId,
                columnName,
                ComplianceDocumentReportHelper.DescribeDocumentForChangeLog(previousDocument),
                ComplianceDocumentReportHelper.DescribeDocumentForChangeLog(nextDocument)));
        }

        private static DocumentPeriodReportReadDto ToReadDto(
            DocumentPeriodReport row,
            DocumentPeriodReportGroup? group = null)
        {
            return new DocumentPeriodReportReadDto
            {
                Id = row.Id,
                GroupId = group?.Id ?? row.DocumentPeriodReportGroupId,
                Period = group?.Period ?? row.Period,
                PeriodName = group?.PeriodName ?? row.PeriodName,
                DocumentId = row.DocumentId,
                DocumentToSubmit = row.DocumentToSubmit,
                CreatedAt = row.CreatedAt,
                Link = ComplianceDocumentReportHelper.SanitizeExternalLinkForOutput(row.Link),
                DocumentFileUrl = row.DocumentId.HasValue
                    ? ComplianceDocumentReportHelper.BuildDocumentFilePath(row.DocumentId.Value)
                    : null,
                ProgressPercent = row.ProgressPercent
            };
        }

        [HttpGet("{dbKey}/tables/{table}/DocumentPeriodReport/{id}")]
        public IActionResult GetDocument(string dbKey, string table, long id)
        {
            var parts = table.Split('.', 2, StringSplitOptions.TrimEntries);
            var schema = parts.Length == 2 ? parts[0] : "dbo";
            var name = parts.Length == 2 ? parts[1] : parts[0];

            if (!string.Equals(dbKey, "PGHAzure", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(schema, "Compliance", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(name, "Documents", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = FeatureAccessResolver.AccessDeniedMessage
                });
            }

            return LocalRedirect(ComplianceDocumentReportHelper.BuildDocumentFilePath(id));
        }
    }
}
