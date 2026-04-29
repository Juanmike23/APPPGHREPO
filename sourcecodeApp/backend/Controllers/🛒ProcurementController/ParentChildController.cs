/*
 * PGH-DOC
 * File: Controllers/🛒ProcurementController/ParentChildController.cs
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
using PGH.Dtos.Procurement;
using PGH.Helpers;
using PGH.Models.Procurement;
using WebApplication2.Data;

[ApiController]
[Route("api/[controller]")]
public class ParentChildController : ControllerBase
{
    private readonly AppDbContext _context;
    private const string ParentChildRelationType = "ParentChild";

    public ParentChildController(AppDbContext context)
    {
        _context = context;
    }

    private Task<IActionResult> ExecuteParentChildRequestAsync(
        Func<CancellationToken, Task<IActionResult>> action,
        CancellationToken cancellationToken = default)
    {
        return RequestCancellationHelper.ExecuteAsync(
            this,
            action,
            "Procurement parent-child request was canceled.",
            cancellationToken);
    }

    [HttpPost("set-parent")]
    public async Task<IActionResult> SetParent([FromBody] SetParentDto dto)
    {
        var mutationForbidden = EnsureCanMutateParentChild();
        if (mutationForbidden != null)
            return mutationForbidden;

        var child = await ResolveItemAsync(dto.ChildId, dto.ChildSource);
        if (child == null)
            return NotFound("Child record not found.");

        if (!dto.ParentId.HasValue || string.IsNullOrWhiteSpace(dto.ParentSource))
        {
            await ClearParentLinksAsync(child.Id);
            return Ok("Parent mapping cleared.");
        }

        var parent = await ResolveItemAsync(dto.ParentId.Value, dto.ParentSource);
        if (parent == null)
            return NotFound("Parent record not found.");

        if (child.Id == parent.Id)
            return BadRequest("A record cannot be its own parent.");

        var ruleViolation = await ValidateSingleHierarchyRulesAsync(child.Id, parent.Id);
        if (!string.IsNullOrWhiteSpace(ruleViolation))
        {
            return BadRequest(ruleViolation);
        }

        await UpsertSingleParentAsync(
            childId: child.Id,
            parentId: parent.Id,
            linkSource: "manual",
            confidenceScore: 100m,
            matchReason: "Manual parent assignment");

        return Ok("Parent mapping updated.");
    }

    [HttpPost("add-parent")]
    public async Task<IActionResult> AddParent([FromBody] SetParentDto dto)
    {
        var mutationForbidden = EnsureCanMutateParentChild();
        if (mutationForbidden != null)
            return mutationForbidden;

        var child = await ResolveItemAsync(dto.ChildId, dto.ChildSource);
        if (child == null)
            return NotFound("Child record not found.");

        if (!dto.ParentId.HasValue || string.IsNullOrWhiteSpace(dto.ParentSource))
            return BadRequest("ParentId and ParentSource are required.");

        var parent = await ResolveItemAsync(dto.ParentId.Value, dto.ParentSource);
        if (parent == null)
            return NotFound("Parent record not found.");

        if (child.Id == parent.Id)
            return BadRequest("A record cannot be its own parent.");

        var ruleViolation = await ValidateSingleHierarchyRulesAsync(child.Id, parent.Id);
        if (!string.IsNullOrWhiteSpace(ruleViolation))
        {
            return BadRequest(ruleViolation);
        }

        var suggestions = await BuildCandidatesAsync(child, null);
        var suggestion = suggestions.FirstOrDefault(x => x.Id == parent.Id);

        await UpsertSingleParentAsync(
            childId: child.Id,
            parentId: parent.Id,
            linkSource: suggestion == null ? "manual" : "suggested-manual",
            confidenceScore: suggestion?.Score ?? 100m,
            matchReason: suggestion?.MatchReason ?? "Manual parent assignment");

        return Ok("Parent relationship updated.");
    }

    [HttpGet("list")]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var data = await _context.ProcurementRelations
                    .AsNoTracking()
                    .Where(x => x.RelationType == ParentChildRelationType)
                    .Include(x => x.ChildItem)
                    .Include(x => x.ParentItem)
                    .OrderByDescending(x => x.IsPrimary)
                    .ThenByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                    .ThenByDescending(x => x.Id)
                    .ToListAsync(ct);

                return Ok(data.Select(MapRelationToDto));
            },
            cancellationToken);
    }

    [HttpGet("parent/{parentId:long}")]
    public async Task<IActionResult> GetByParentId(
        long parentId,
        [FromQuery] string? parentSource = null,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var parent = await ResolveItemAsync(parentId, parentSource);
                if (parent == null)
                    return Ok(Array.Empty<ParentChildReadDto>());

                var data = await _context.ProcurementRelations
                    .AsNoTracking()
                    .Where(x => x.ParentProcurementItemId == parent.Id && x.RelationType == ParentChildRelationType)
                    .Include(x => x.ChildItem)
                    .Include(x => x.ParentItem)
                    .OrderByDescending(x => x.IsPrimary)
                    .ThenByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                    .ThenByDescending(x => x.Id)
                    .ToListAsync(ct);

                return Ok(data.Select(MapRelationToDto));
            },
            cancellationToken);
    }

    [HttpGet("children/{parentId:long}")]
    public async Task<IActionResult> GetChildren(
        long parentId,
        [FromQuery] string? parentSource = null,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var parent = await ResolveItemAsync(parentId, parentSource);
                if (parent == null)
                    return Ok(Array.Empty<object>());

                var data = await _context.ProcurementRelations
                    .AsNoTracking()
                    .Where(x => x.ParentProcurementItemId == parent.Id && x.RelationType == ParentChildRelationType)
                    .Include(x => x.ChildItem)
                    .OrderByDescending(x => x.IsPrimary)
                    .ThenByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                    .ThenByDescending(x => x.Id)
                    .ToListAsync(ct);

                return Ok(data.Select(x => new
                {
                    Id = x.ChildItem!.Id,
                    Source = ProcurementCanonicalHelper.ToLegacySourceName(x.ChildItem.SourceType),
                    x.ChildItem.project_id,
                    x.ChildItem.Department,
                    x.ChildItem.Vendor,
                    x.ChildItem.Perjanjian,
                    x.ChildItem.NoSPK,
                    x.ChildItem.TglSPK
                }));
            },
            cancellationToken);
    }

    [HttpGet("child/{childId:long}")]
    public async Task<IActionResult> GetParents(
        long childId,
        [FromQuery] string childSource,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var child = await ResolveItemAsync(childId, childSource);
                if (child == null)
                    return Ok(Array.Empty<object>());

                var data = await _context.ProcurementRelations
                    .AsNoTracking()
                    .Where(x => x.ChildProcurementItemId == child.Id && x.RelationType == ParentChildRelationType)
                    .Include(x => x.ParentItem)
                    .OrderByDescending(x => x.IsPrimary)
                    .ThenByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                    .ThenByDescending(x => x.Id)
                    .ToListAsync(ct);

                var result = data.Select(x => new
                {
                    Id = x.ParentItem?.Id,
                    Source = x.ParentItem == null ? null : ProcurementCanonicalHelper.ToLegacySourceName(x.ParentItem.SourceType),
                    x.ParentItem?.project_id,
                    x.ParentItem?.Department,
                    x.ParentItem?.Vendor,
                    Perjanjian = x.ParentItem?.Perjanjian,
                    NoSPK = x.ParentItem?.NoSPK,
                    TglSPK = x.ParentItem?.TglSPK,
                    Score = x.ConfidenceScore,
                    x.MatchReason,
                    x.IsPrimary
                }).ToList();

                return Ok(result);
            },
            cancellationToken);
    }

    [HttpGet("graph/{itemId:long}")]
    public async Task<IActionResult> GetRelationGraph(
        long itemId,
        [FromQuery] string? itemSource = null,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var seedItem = await ResolveItemAsync(itemId, itemSource);
                if (seedItem == null)
                {
                    return Ok(new
                    {
                        SeedId = (long?)null,
                        RelatedIds = Array.Empty<long>(),
                        ParentNodeIds = Array.Empty<long>(),
                        RelationCount = 0,
                        NodeCount = 0,
                        Edges = Array.Empty<object>(),
                        Nodes = Array.Empty<object>()
                    });
                }

                var relationRows = await _context.ProcurementRelations
                    .AsNoTracking()
                    .Where(x => x.RelationType == ParentChildRelationType)
                    .Select(x => new
                    {
                        ParentId = x.ParentProcurementItemId,
                        ChildId = x.ChildProcurementItemId
                    })
                    .ToListAsync(ct);

                var adjacency = new Dictionary<long, List<long>>();
                foreach (var relation in relationRows)
                {
                    if (!adjacency.TryGetValue(relation.ParentId, out var parentNeighbors))
                    {
                        parentNeighbors = new List<long>();
                        adjacency[relation.ParentId] = parentNeighbors;
                    }
                    parentNeighbors.Add(relation.ChildId);

                    if (!adjacency.TryGetValue(relation.ChildId, out var childNeighbors))
                    {
                        childNeighbors = new List<long>();
                        adjacency[relation.ChildId] = childNeighbors;
                    }
                    childNeighbors.Add(relation.ParentId);
                }

                var visited = new HashSet<long> { seedItem.Id };
                var queue = new Queue<long>();
                queue.Enqueue(seedItem.Id);

                while (queue.Count > 0)
                {
                    var currentId = queue.Dequeue();
                    if (!adjacency.TryGetValue(currentId, out var neighbors))
                    {
                        continue;
                    }

                    foreach (var neighborId in neighbors)
                    {
                        if (visited.Add(neighborId))
                        {
                            queue.Enqueue(neighborId);
                        }
                    }
                }

                var relatedIds = visited.OrderBy(id => id).ToList();

                var relatedEdges = relationRows
                    .Where(x => visited.Contains(x.ParentId) && visited.Contains(x.ChildId))
                    .Select(x => new
                    {
                        x.ParentId,
                        x.ChildId
                    })
                    .ToList();
                var parentNodeIds = relatedEdges
                    .Select(x => x.ParentId)
                    .Distinct()
                    .OrderBy(id => id)
                    .ToList();

                var relatedNodes = await _context.ProcurementItems
                    .AsNoTracking()
                    .Where(x => relatedIds.Contains(x.Id))
                    .Select(x => new
                    {
                        x.Id,
                        Source = ProcurementCanonicalHelper.ToLegacySourceName(x.SourceType),
                        x.project_id,
                        x.Department,
                        x.Vendor,
                        x.Perjanjian,
                        x.JatuhTempo
                    })
                    .OrderBy(x => x.JatuhTempo == null)
                    .ThenBy(x => x.JatuhTempo)
                    .ThenBy(x => x.Id)
                    .ToListAsync(ct);

                return Ok(new
                {
                    SeedId = seedItem.Id,
                    RelatedIds = relatedIds,
                    ParentNodeIds = parentNodeIds,
                    RelationCount = relatedEdges.Count,
                    NodeCount = relatedNodes.Count,
                    Edges = relatedEdges,
                    Nodes = relatedNodes
                });
            },
            cancellationToken);
    }

    [HttpDelete("remove-parent")]
    public async Task<IActionResult> RemoveParent(int childId, string childSource, int parentId, string parentSource)
    {
        var mutationForbidden = EnsureCanMutateParentChild();
        if (mutationForbidden != null)
            return mutationForbidden;

        var child = await ResolveItemAsync(childId, childSource);
        var parent = await ResolveItemAsync(parentId, parentSource);

        if (child == null || parent == null)
            return NotFound("Parent relation not found.");

        var relation = await _context.ProcurementRelations
            .FirstOrDefaultAsync(x =>
                x.ChildProcurementItemId == child.Id &&
                x.ParentProcurementItemId == parent.Id &&
                x.RelationType == ParentChildRelationType);

        if (relation == null)
            return NotFound("Parent relation not found.");

        _context.ProcurementRelations.Remove(relation);
        await _context.SaveChangesAsync();

        return Ok("Parent removed.");
    }

    [HttpGet("search/title")]
    public async Task<IActionResult> GetByTitle(
        [FromQuery] string title,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var normalized = NormalizeText(title);
                if (string.IsNullOrWhiteSpace(normalized))
                    return BadRequest("Title is required.");

                var row = await _context.ProcurementItems
                    .AsNoTracking()
                    .Where(x => x.Perjanjian != null && NormalizeText(x.Perjanjian) == normalized)
                    .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                    .ThenByDescending(x => x.Id)
                    .Select(x => new
                    {
                        x.Id,
                        x.project_id,
                        x.Department,
                        x.Vendor,
                        x.Perjanjian,
                        Source = ProcurementCanonicalHelper.ToLegacySourceName(x.SourceType)
                    })
                    .FirstOrDefaultAsync(ct);

                if (row == null)
                    return NotFound("No row found with that title");

                return Ok(row);
            },
            cancellationToken);
    }

    [HttpGet("distinct/perjanjian")]
    public async Task<IActionResult> GetDistinctPerjanjian(
        CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var list = await _context.ProcurementItems
                    .AsNoTracking()
                    .Where(x => !string.IsNullOrWhiteSpace(x.Perjanjian))
                    .Select(x => x.Perjanjian!)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToListAsync(ct);

                return Ok(list);
            },
            cancellationToken);
    }

    [HttpGet("search-candidates")]
    public async Task<IActionResult> SearchCandidates(
        [FromQuery] long childId,
        [FromQuery] string childSource,
        [FromQuery] string? q = null,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var child = await ResolveItemAsync(childId, childSource);
                if (child == null)
                    return NotFound("Child record not found.");

                var childHasChildren = await _context.ProcurementRelations
                    .AsNoTracking()
                    .AnyAsync(x =>
                        x.ParentProcurementItemId == child.Id &&
                        x.RelationType == ParentChildRelationType, ct);
                if (childHasChildren)
                {
                    return Ok(Array.Empty<object>());
                }

                var candidates = await BuildCandidatesAsync(child, q);
                return Ok(candidates);
            },
            cancellationToken);
    }

    [HttpGet("integrity/mixed-roles")]
    public async Task<IActionResult> GetMixedRoleItems(
        [FromQuery] int take = 200,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteParentChildRequestAsync(
            async ct =>
            {
                var safeTake = Math.Clamp(take, 1, 1000);

                var relations = await _context.ProcurementRelations
                    .AsNoTracking()
                    .Where(x => x.RelationType == ParentChildRelationType)
                    .Select(x => new
                    {
                        x.ChildProcurementItemId,
                        x.ParentProcurementItemId
                    })
                    .ToListAsync(ct);

                var childIds = relations
                    .Select(x => x.ChildProcurementItemId)
                    .ToHashSet();
                var parentIds = relations
                    .Select(x => x.ParentProcurementItemId)
                    .ToHashSet();
                var mixedIds = childIds
                    .Intersect(parentIds)
                    .OrderBy(id => id)
                    .ToList();

                var sampledIds = mixedIds.Take(safeTake).ToList();
                var parentCountById = relations
                    .GroupBy(x => x.ChildProcurementItemId)
                    .ToDictionary(group => group.Key, group => group.Count());
                var childCountById = relations
                    .GroupBy(x => x.ParentProcurementItemId)
                    .ToDictionary(group => group.Key, group => group.Count());

                var sampledItems = await _context.ProcurementItems
                    .AsNoTracking()
                    .Where(x => sampledIds.Contains(x.Id))
                    .Select(x => new
                    {
                        x.Id,
                        x.project_id,
                        x.Perjanjian,
                        Source = ProcurementCanonicalHelper.ToLegacySourceName(x.SourceType)
                    })
                    .ToListAsync(ct);
                var sampledItemById = sampledItems.ToDictionary(x => x.Id);

                var summary = sampledIds
                    .Select(id =>
                    {
                        sampledItemById.TryGetValue(id, out var item);
                        return new
                        {
                            ItemId = id,
                            ProjectId = item?.project_id,
                            item?.Perjanjian,
                            item?.Source,
                            ParentLinks = parentCountById.GetValueOrDefault(id),
                            ChildLinks = childCountById.GetValueOrDefault(id)
                        };
                    })
                    .ToList();

                return Ok(new
                {
                    RelationType = ParentChildRelationType,
                    TotalRelationRows = relations.Count,
                    MixedRoleCount = mixedIds.Count,
                    ReturnedCount = summary.Count,
                    HasMore = mixedIds.Count > summary.Count,
                    Items = summary
                });
            },
            cancellationToken);
    }

    [HttpPost("integrity/normalize-mixed-roles")]
    public async Task<IActionResult> NormalizeMixedRoles(
        [FromQuery] bool dryRun = true,
        [FromQuery] int take = 500)
    {
        var mutationForbidden = EnsureCanMutateParentChild();
        if (mutationForbidden != null)
            return mutationForbidden;

        var safeTake = Math.Clamp(take, 1, 5000);

        var relations = await _context.ProcurementRelations
            .Where(x => x.RelationType == ParentChildRelationType)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .ToListAsync();

        var childIds = relations
            .Select(x => x.ChildProcurementItemId)
            .ToHashSet();
        var parentIds = relations
            .Select(x => x.ParentProcurementItemId)
            .ToHashSet();
        var mixedIds = childIds
            .Intersect(parentIds)
            .OrderBy(id => id)
            .Take(safeTake)
            .ToHashSet();

        var incomingLinksToRemove = relations
            .Where(x => mixedIds.Contains(x.ChildProcurementItemId))
            .ToList();

        var outgoingLinksToKeepById = relations
            .Where(x => mixedIds.Contains(x.ParentProcurementItemId))
            .GroupBy(x => x.ParentProcurementItemId)
            .ToDictionary(group => group.Key, group => group.Count());
        var incomingLinksToRemoveById = incomingLinksToRemove
            .GroupBy(x => x.ChildProcurementItemId)
            .ToDictionary(group => group.Key, group => group.Count());

        var mixedItems = await _context.ProcurementItems
            .AsNoTracking()
            .Where(x => mixedIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.project_id,
                x.Perjanjian,
                Source = ProcurementCanonicalHelper.ToLegacySourceName(x.SourceType)
            })
            .ToListAsync();

        var plan = mixedItems
            .OrderBy(x => x.Id)
            .Select(item => new
            {
                ItemId = item.Id,
                ProjectId = item.project_id,
                item.Perjanjian,
                item.Source,
                ParentLinksToRemove = incomingLinksToRemoveById.GetValueOrDefault(item.Id),
                ChildLinksKept = outgoingLinksToKeepById.GetValueOrDefault(item.Id)
            })
            .ToList();

        if (dryRun || incomingLinksToRemove.Count == 0)
        {
            return Ok(new
            {
                DryRun = true,
                Rule = "Jika node menjadi parent+child, incoming parent link dihapus agar node tetap sebagai parent.",
                MixedRoleCount = mixedIds.Count,
                CandidateRelationsToRemove = incomingLinksToRemove.Count,
                Plan = plan
            });
        }

        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _context.ProcurementRelations.RemoveRange(incomingLinksToRemove);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }

            return Ok(new
            {
                DryRun = false,
                NormalizedMixedRoleCount = mixedIds.Count,
                RemovedIncomingRelations = incomingLinksToRemove.Count,
                Plan = plan
            });
        });
    }

    private async Task<ProcurementItem?> ResolveItemAsync(long id, string? source)
    {
        if (id <= 0)
        {
            return null;
        }

        var normalizedSource = string.IsNullOrWhiteSpace(source)
            ? null
            : ProcurementCanonicalHelper.NormalizeSourceType(source);

        var query = _context.ProcurementItems.AsNoTracking().Where(x => x.Id == id);
        if (!string.IsNullOrWhiteSpace(normalizedSource))
        {
            query = query.Where(x => x.SourceType == normalizedSource);
        }

        return await query.FirstOrDefaultAsync();
    }

    private async Task<List<ProcurementLinkCandidate>> BuildCandidatesAsync(ProcurementItem child, string? searchTerm)
    {
        var normalizedSearch = NormalizeCompactText(searchTerm);
        var relations = await _context.ProcurementRelations
            .AsNoTracking()
            .Where(x => x.ChildProcurementItemId == child.Id && x.RelationType == ParentChildRelationType)
            .Select(x => x.ParentProcurementItemId)
            .ToListAsync();

        var allItems = await _context.ProcurementItems
            .AsNoTracking()
            .Where(x =>
                x.Id != child.Id &&
                !_context.ProcurementRelations.Any(rel =>
                    rel.RelationType == ParentChildRelationType &&
                    rel.ChildProcurementItemId == x.Id))
            .ToListAsync();

        var results = allItems
            .Where(item =>
                string.IsNullOrWhiteSpace(normalizedSearch) ||
                NormalizeCompactText(item.NoSPK).Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase))
            .Select(item =>
            {
                var (score, reason) = CalculateCandidateScore(child, item);
                return new ProcurementLinkCandidate
                {
                    Id = item.Id,
                    ProjectId = item.project_id,
                    Department = item.Department,
                    Vendor = item.Vendor,
                    Perjanjian = item.Perjanjian,
                    NoSPK = item.NoSPK,
                    TglSPK = item.TglSPK,
                    Source = ProcurementCanonicalHelper.ToLegacySourceName(item.SourceType),
                    Score = score,
                    MatchReason = reason,
                    IsLinked = relations.Contains(item.Id)
                };
            })
            .Where(item => item.Score > 0 || !string.IsNullOrWhiteSpace(normalizedSearch))
            .OrderByDescending(item => item.IsLinked)
            .ThenByDescending(item => item.Score)
            .ThenBy(item => item.Perjanjian)
            .Take(8)
            .ToList();

        return results;
    }

    private async Task UpsertSingleParentAsync(
        long childId,
        long parentId,
        string linkSource,
        decimal? confidenceScore,
        string? matchReason)
    {
        var currentLinks = await _context.ProcurementRelations
            .Where(x =>
                x.ChildProcurementItemId == childId &&
                x.RelationType == ParentChildRelationType)
            .ToListAsync();

        if (currentLinks.Count > 0)
        {
            _context.ProcurementRelations.RemoveRange(currentLinks);
        }

        _context.ProcurementRelations.Add(new ProcurementRelation
        {
            ChildProcurementItemId = childId,
            ParentProcurementItemId = parentId,
            RelationType = ParentChildRelationType,
            IsPrimary = true,
            LinkSource = string.IsNullOrWhiteSpace(linkSource) ? "manual" : linkSource,
            ConfidenceScore = confidenceScore,
            MatchReason = string.IsNullOrWhiteSpace(matchReason)
                ? "Manual parent assignment"
                : matchReason
        });

        await _context.SaveChangesAsync();
    }

    private async Task ClearParentLinksAsync(long childId)
    {
        var currentLinks = await _context.ProcurementRelations
            .Where(x =>
                x.ChildProcurementItemId == childId &&
                x.RelationType == ParentChildRelationType)
            .ToListAsync();

        if (currentLinks.Count == 0)
        {
            return;
        }

        _context.ProcurementRelations.RemoveRange(currentLinks);
        await _context.SaveChangesAsync();
    }

    private async Task<string?> ValidateSingleHierarchyRulesAsync(long childId, long parentId)
    {
        var childIsParent = await _context.ProcurementRelations
            .AsNoTracking()
            .AnyAsync(x =>
                x.ParentProcurementItemId == childId &&
                x.RelationType == ParentChildRelationType);
        if (childIsParent)
        {
            return "Baris ini sudah menjadi parent untuk baris lain. Parent tidak boleh memiliki parent.";
        }

        var parentAlreadyChild = await _context.ProcurementRelations
            .AsNoTracking()
            .AnyAsync(x =>
                x.ChildProcurementItemId == parentId &&
                x.RelationType == ParentChildRelationType);
        if (parentAlreadyChild)
        {
            return "Parent yang dipilih saat ini sudah menjadi child. Pilih parent yang belum punya parent.";
        }

        return null;
    }

    private IActionResult? EnsureCanMutateParentChild()
    {
        var level = FeatureAccessResolver.GetUserLevel(User) ?? string.Empty;
        if (FeatureAccessResolver.CanPerform(level, Request.Method))
        {
            return null;
        }

        return StatusCode(403, new { message = "Anda tidak memiliki akses untuk mengubah relasi parent-child procurement." });
    }

    private static ParentChildReadDto MapRelationToDto(ProcurementRelation relation) => new()
    {
        Id = relation.Id,
        ChildId = relation.ChildItem?.Id ?? relation.ChildProcurementItemId,
        ChildSource = relation.ChildItem == null
            ? string.Empty
            : ProcurementCanonicalHelper.ToLegacySourceName(relation.ChildItem.SourceType),
        ParentId = relation.ParentItem?.Id ?? relation.ParentProcurementItemId,
        ParentSource = relation.ParentItem == null
            ? null
            : ProcurementCanonicalHelper.ToLegacySourceName(relation.ParentItem.SourceType),
        ChildName = relation.ChildItem?.Perjanjian ?? string.Empty,
        ParentName = relation.ParentItem?.Perjanjian
    };

    private static (decimal Score, string MatchReason) CalculateCandidateScore(ProcurementItem child, ProcurementItem candidate)
    {
        decimal score = 0m;
        var reasons = new List<string>();

        if (EqualsNormalized(child.Department, candidate.Department))
        {
            score += 35m;
            reasons.Add("department match");
        }

        if (EqualsNormalized(child.Vendor, candidate.Vendor))
        {
            score += 25m;
            reasons.Add("vendor match");
        }

        if (
            !string.IsNullOrWhiteSpace(child.NoSPK) &&
            !string.IsNullOrWhiteSpace(candidate.NoSPK) &&
            string.Equals(
                NormalizeCompactText(child.NoSPK),
                NormalizeCompactText(candidate.NoSPK),
                StringComparison.OrdinalIgnoreCase))
        {
            score += 45m;
            reasons.Add("No SPK match");
        }

        if (EqualsNormalized(child.PIC, candidate.PIC))
        {
            score += 10m;
            reasons.Add("PIC match");
        }

        var titleSimilarity = CalculateTokenSimilarity(child.Perjanjian, candidate.Perjanjian);
        if (titleSimilarity > 0)
        {
            score += Math.Round(titleSimilarity * 30m, 2);
            reasons.Add("title similarity");
        }

        var daysDelta = CalculateDaysDelta(child, candidate);
        if (daysDelta.HasValue && daysDelta.Value <= 180)
        {
            score += 10m;
            reasons.Add("nearby timeline");
        }

        return (score, reasons.Count == 0 ? "No strong match" : string.Join(", ", reasons));
    }

    private static int? CalculateDaysDelta(ProcurementItem child, ProcurementItem candidate)
    {
        var left = child.WaktuMulai ?? child.JatuhTempo;
        var right = candidate.JatuhTempo ?? candidate.WaktuMulai;
        if (!left.HasValue || !right.HasValue)
        {
            return null;
        }

        return Math.Abs((left.Value.Date - right.Value.Date).Days);
    }

    private static decimal CalculateTokenSimilarity(string? left, string? right)
    {
        var leftTokens = Tokenize(left);
        var rightTokens = Tokenize(right);
        if (leftTokens.Count == 0 || rightTokens.Count == 0)
        {
            return 0m;
        }

        var intersection = leftTokens.Intersect(rightTokens, StringComparer.OrdinalIgnoreCase).Count();
        if (intersection == 0)
        {
            return 0m;
        }

        var union = leftTokens.Union(rightTokens, StringComparer.OrdinalIgnoreCase).Count();
        return union == 0 ? 0m : intersection / (decimal)union;
    }

    private static HashSet<string> Tokenize(string? input) =>
        NormalizeText(input)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(token => token.Length > 2)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    private static bool EqualsNormalized(string? left, string? right) =>
        string.Equals(NormalizeText(left), NormalizeText(right), StringComparison.OrdinalIgnoreCase)
        && !string.IsNullOrWhiteSpace(left)
        && !string.IsNullOrWhiteSpace(right);

    private static string NormalizeText(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        return new string(input.Trim().ToLowerInvariant().Select(ch =>
            char.IsLetterOrDigit(ch) || char.IsWhiteSpace(ch) ? ch : ' ').ToArray());
    }

    private static string NormalizeCompactText(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        return new string(
            input
                .Trim()
                .ToLowerInvariant()
                .Where(char.IsLetterOrDigit)
                .ToArray());
    }

    private sealed class ProcurementLinkCandidate
    {
        public long Id { get; init; }
        public string? ProjectId { get; init; }
        public string? Department { get; init; }
        public string? Vendor { get; init; }
        public string? Perjanjian { get; init; }
        public string? NoSPK { get; init; }
        public DateTime? TglSPK { get; init; }
        public string? Source { get; init; }
        public decimal Score { get; init; }
        public string MatchReason { get; init; } = string.Empty;
        public bool IsLinked { get; init; }
    }
}
