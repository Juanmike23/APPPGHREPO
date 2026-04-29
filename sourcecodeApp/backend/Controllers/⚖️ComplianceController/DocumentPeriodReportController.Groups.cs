/*
 * PGH-DOC
 * File: Controllers/⚖️ComplianceController/DocumentPeriodReportController.Groups.cs
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
using Newtonsoft.Json;
using PGH.Dtos.Compliance;
using PGH.Helpers;
using PGH.Models.Compliance;

namespace WebApplication2.Controllers
{
    public partial class DocumentPeriodReportController
    {
        private const string GroupValidationMessage = "Compliance Events tidak ditemukan.";

        [HttpGet("groups")]
        public async Task<IActionResult> GetGroups(CancellationToken cancellationToken = default)
        {
            var groups = await _db.DocumentPeriodReportGroups
                .AsNoTracking()
                .OrderByDescending(group => group.CreatedAt)
                .ThenByDescending(group => group.Id)
                .ToListAsync(cancellationToken);

            return Ok(await MapGroupsAsync(groups, cancellationToken));
        }

        [HttpGet("active-group")]
        public async Task<IActionResult> GetActiveGroup(CancellationToken cancellationToken = default)
        {
            var group = await ResolveReadGroupAsync(null, cancellationToken);
            if (group == null)
            {
                return NotFound("No compliance events found.");
            }

            return Ok(await MapGroupAsync(group, cancellationToken));
        }

        [HttpPost("groups")]
        public async Task<IActionResult> CreateGroup(
            [FromBody] DocumentPeriodReportGroupCreateDto? request,
            CancellationToken cancellationToken = default)
        {
            var groupName = ComplianceDocumentReportHelper.NormalizeOptionalText(request?.PeriodName);
            if (string.IsNullOrWhiteSpace(groupName))
            {
                return BadRequest("PeriodName is required.");
            }

            var period = ComplianceDocumentReportHelper.NormalizeOptionalText(request?.Period);
            if (await GroupNameExistsAsync(groupName, period, null, cancellationToken))
            {
                return Conflict($"Compliance Events '{groupName}' sudah ada.");
            }

            var sourceGroup = await ResolveSourceGroupForCloneAsync(
                request?.CloneFromGroupId,
                cancellationToken);

            var entity = new DocumentPeriodReportGroup
            {
                PeriodName = groupName,
                Period = period,
                SuggestionSeed = sourceGroup == null
                    ? null
                    : SerializeSuggestionSeed(await BuildSuggestionSeedMapForGroupAsync(
                        sourceGroup.Id,
                        sourceGroup.SuggestionSeed,
                        cancellationToken)),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.DocumentPeriodReportGroups.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(await MapGroupAsync(entity, cancellationToken));
        }

        [HttpPatch("groups/{id:long}")]
        public async Task<IActionResult> RenameGroup(
            long id,
            [FromBody] DocumentPeriodReportGroupUpdateDto? request,
            CancellationToken cancellationToken = default)
        {
            var groupName = ComplianceDocumentReportHelper.NormalizeOptionalText(request?.PeriodName);
            if (string.IsNullOrWhiteSpace(groupName))
            {
                return BadRequest("PeriodName is required.");
            }

            var group = await _db.DocumentPeriodReportGroups
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (group == null)
            {
                return NotFound(GroupValidationMessage);
            }

            if (await GroupNameExistsAsync(groupName, group.Period, group.Id, cancellationToken))
            {
                return Conflict($"Compliance Events '{groupName}' sudah ada.");
            }

            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    group.PeriodName = groupName;
                    group.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync(cancellationToken);

                    using (_db.SuppressAutomaticLogs())
                    {
                        var rows = await _db.DocumentPeriodReport
                            .Where(item => item.DocumentPeriodReportGroupId == group.Id)
                            .ToListAsync(cancellationToken);

                        foreach (var row in rows)
                        {
                            row.PeriodName = group.PeriodName;
                            row.Period = group.Period;
                        }

                        if (rows.Count > 0)
                        {
                            await _db.SaveChangesAsync(cancellationToken);
                        }
                    }

                    await transaction.CommitAsync(cancellationToken);
                }
                catch
                {
                    await transaction.RollbackAsync(cancellationToken);
                    throw;
                }

                return Ok(await MapGroupAsync(group, cancellationToken));
            });
        }

        [HttpDelete("groups/{id:long}")]
        public async Task<IActionResult> DeleteGroup(
            long id,
            CancellationToken cancellationToken = default)
        {
            var group = await _db.DocumentPeriodReportGroups
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (group == null)
            {
                return NotFound(GroupValidationMessage);
            }

            var rows = await _db.DocumentPeriodReport
                .Where(item => item.DocumentPeriodReportGroupId == id)
                .ToListAsync(cancellationToken);

            if (rows.Count > 0)
            {
                _db.DocumentPeriodReport.RemoveRange(rows);
            }

            _db.DocumentPeriodReportGroups.Remove(group);
            await _db.SaveChangesAsync(cancellationToken);

            var nextGroupId = await _db.DocumentPeriodReportGroups
                .AsNoTracking()
                .OrderByDescending(item => item.CreatedAt)
                .ThenByDescending(item => item.Id)
                .Select(item => (long?)item.Id)
                .FirstOrDefaultAsync(cancellationToken);

            return Ok(new
            {
                deletedGroupId = id,
                activeGroupId = nextGroupId
            });
        }

        private async Task<List<DocumentPeriodReportReadDto>> GetRowsForReadAsync(
            long? requestedGroupId,
            CancellationToken cancellationToken)
        {
            if (requestedGroupId == 0)
            {
                return await BuildReadQuery()
                    .OrderByDescending(item => item.CreatedAt)
                    .ThenByDescending(item => item.Id)
                    .ToListAsync(cancellationToken);
            }

            var group = await ResolveReadGroupAsync(requestedGroupId, cancellationToken);
            if (group == null)
            {
                return new List<DocumentPeriodReportReadDto>();
            }

            return await BuildReadQuery()
                .Where(item => item.GroupId == group.Id)
                .OrderByDescending(item => item.CreatedAt)
                .ThenByDescending(item => item.Id)
                .ToListAsync(cancellationToken);
        }

        private async Task<DocumentPeriodReportGroup?> ResolveReadGroupAsync(
            long? requestedGroupId,
            CancellationToken cancellationToken)
        {
            if (requestedGroupId is > 0)
            {
                return await _db.DocumentPeriodReportGroups
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.Id == requestedGroupId.Value, cancellationToken);
            }

            return await _db.DocumentPeriodReportGroups
                .AsNoTracking()
                .OrderByDescending(item => item.CreatedAt)
                .ThenByDescending(item => item.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task<DocumentPeriodReportGroup?> ResolveSourceGroupForCloneAsync(
            long? requestedGroupId,
            CancellationToken cancellationToken)
        {
            if (requestedGroupId is > 0)
            {
                return await _db.DocumentPeriodReportGroups
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.Id == requestedGroupId.Value, cancellationToken);
            }

            return await ResolveReadGroupAsync(null, cancellationToken);
        }

        private async Task<DocumentPeriodReportGroup?> ResolveGroupForCreateAsync(
            DocumentPeriodReportCreateDto dto,
            CancellationToken cancellationToken)
        {
            if (dto.GroupId is > 0)
            {
                return await _db.DocumentPeriodReportGroups
                    .FirstOrDefaultAsync(item => item.Id == dto.GroupId.Value, cancellationToken);
            }

            var normalizedName = ComplianceDocumentReportHelper.NormalizeOptionalText(dto.PeriodName);
            if (!string.IsNullOrWhiteSpace(normalizedName))
            {
                var normalizedPeriod = ComplianceDocumentReportHelper.NormalizeOptionalText(dto.Period);
                var existingGroup = await _db.DocumentPeriodReportGroups
                    .FirstOrDefaultAsync(item =>
                        item.PeriodName.ToLower() == normalizedName.ToLower() &&
                        (item.Period ?? string.Empty).ToLower() == (normalizedPeriod ?? string.Empty).ToLower(),
                        cancellationToken);

                if (existingGroup != null)
                {
                    return existingGroup;
                }

                var createdGroup = new DocumentPeriodReportGroup
                {
                    PeriodName = normalizedName,
                    Period = normalizedPeriod,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.DocumentPeriodReportGroups.Add(createdGroup);
                await _db.SaveChangesAsync(cancellationToken);
                return createdGroup;
            }

            return await ResolveReadGroupAsync(null, cancellationToken);
        }

        private async Task<List<DocumentPeriodReportGroupDto>> MapGroupsAsync(
            IEnumerable<DocumentPeriodReportGroup> groups,
            CancellationToken cancellationToken)
        {
            var groupList = groups.ToList();
            if (groupList.Count == 0)
            {
                return new List<DocumentPeriodReportGroupDto>();
            }

            var rowCountMap = await _db.DocumentPeriodReport
                .AsNoTracking()
                .Where(item => item.DocumentPeriodReportGroupId.HasValue)
                .GroupBy(item => item.DocumentPeriodReportGroupId!.Value)
                .Select(group => new { GroupId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(item => item.GroupId, item => item.Count, cancellationToken);

            var result = new List<DocumentPeriodReportGroupDto>(groupList.Count);
            foreach (var group in groupList)
            {
                var dto = await MapGroupAsync(group, cancellationToken);
                dto.RowCount = rowCountMap.TryGetValue(group.Id, out var rowCount) ? rowCount : 0;
                result.Add(dto);
            }

            return result;
        }

        private async Task<DocumentPeriodReportGroupDto> MapGroupAsync(
            DocumentPeriodReportGroup group,
            CancellationToken cancellationToken)
        {
            return new DocumentPeriodReportGroupDto
            {
                Id = group.Id,
                PeriodName = group.PeriodName,
                Period = group.Period,
                RowCount = await _db.DocumentPeriodReport
                    .AsNoTracking()
                    .CountAsync(item => item.DocumentPeriodReportGroupId == group.Id, cancellationToken),
                SuggestionValuesByColumn = await BuildSuggestionSeedMapForGroupAsync(
                    group.Id,
                    group.SuggestionSeed,
                    cancellationToken),
                CreatedAt = group.CreatedAt,
                UpdatedAt = group.UpdatedAt
            };
        }

        private async Task<Dictionary<string, List<string>>> BuildSuggestionSeedMapForGroupAsync(
            long groupId,
            string? existingSeed,
            CancellationToken cancellationToken)
        {
            var suggestionSeed = DeserializeSuggestionSeed(existingSeed);
            var rows = await _db.DocumentPeriodReport
                .AsNoTracking()
                .Where(item => item.DocumentPeriodReportGroupId == groupId)
                .Select(item => new
                {
                    item.DocumentToSubmit,
                    item.Link
                })
                .ToListAsync(cancellationToken);

            foreach (var row in rows)
            {
                MergeSuggestionValue(suggestionSeed, nameof(DocumentPeriodReport.DocumentToSubmit), row.DocumentToSubmit);
                MergeSuggestionValue(suggestionSeed, nameof(DocumentPeriodReport.Link), row.Link);
            }

            return suggestionSeed;
        }

        private static Dictionary<string, List<string>> DeserializeSuggestionSeed(string? rawValue)
        {
            if (string.IsNullOrWhiteSpace(rawValue))
            {
                return new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            }

            try
            {
                return JsonConvert.DeserializeObject<Dictionary<string, List<string>>>(rawValue)
                    ?? new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            }
            catch
            {
                return new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            }
        }

        private static string? SerializeSuggestionSeed(Dictionary<string, List<string>> suggestionSeed)
        {
            var normalized = suggestionSeed
                .Where(item => !string.IsNullOrWhiteSpace(item.Key))
                .ToDictionary(
                    item => item.Key,
                    item => item.Value
                        .Select(value => ComplianceDocumentReportHelper.NormalizeOptionalText(value))
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .Cast<string>()
                        .ToList(),
                    StringComparer.OrdinalIgnoreCase);

            return normalized.Count == 0 ? null : JsonConvert.SerializeObject(normalized);
        }

        private static void MergeSuggestionValue(
            IDictionary<string, List<string>> suggestionSeed,
            string columnName,
            string? value)
        {
            var normalized = ComplianceDocumentReportHelper.NormalizeOptionalText(value);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return;
            }

            if (!suggestionSeed.TryGetValue(columnName, out var values))
            {
                values = new List<string>();
                suggestionSeed[columnName] = values;
            }

            if (!values.Contains(normalized, StringComparer.OrdinalIgnoreCase))
            {
                values.Add(normalized);
            }
        }

        private static void MergeSuggestionSeedIntoGroup(
            DocumentPeriodReportGroup group,
            DocumentPeriodReport row)
        {
            var suggestionSeed = DeserializeSuggestionSeed(group.SuggestionSeed);
            MergeSuggestionValue(suggestionSeed, nameof(DocumentPeriodReport.DocumentToSubmit), row.DocumentToSubmit);
            MergeSuggestionValue(suggestionSeed, nameof(DocumentPeriodReport.Link), row.Link);
            group.SuggestionSeed = SerializeSuggestionSeed(suggestionSeed);
        }

        private async Task<bool> GroupNameExistsAsync(
            string groupName,
            string? period,
            long? excludingGroupId,
            CancellationToken cancellationToken)
        {
            var normalizedGroupName = groupName.ToLower();
            var normalizedPeriod = (period ?? string.Empty).ToLower();

            return await _db.DocumentPeriodReportGroups
                .AsNoTracking()
                .AnyAsync(item =>
                    item.Id != excludingGroupId &&
                    item.PeriodName.ToLower() == normalizedGroupName &&
                    (item.Period ?? string.Empty).ToLower() == normalizedPeriod,
                    cancellationToken);
        }
    }
}
