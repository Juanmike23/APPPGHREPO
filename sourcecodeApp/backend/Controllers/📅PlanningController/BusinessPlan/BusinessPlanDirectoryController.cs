/*
 * PGH-DOC
 * File: Controllers/📅PlanningController/BusinessPlan/BusinessPlanDirectoryController.cs
 * Apa fungsi bagian ini:
 * - File ini menangani file directory Planning berbentuk folder bertingkat dan file dokumen.
 * Kenapa perlu:
 * - Perlu agar user Planning bisa mengelola struktur folder sendiri tanpa mencampur dokumen ke list flat.
 * Aturan khususnya apa:
 * - Tetap memakai tabel `Planing_BusinessPlan.BusinessPlanFile`.
 * - Folder dan file disimpan di tabel yang sama, dibedakan oleh `IsFolder` dan `ParentId`.
 * - Upload dibatasi untuk dokumen kerja Planning yang umum dipakai.
 */

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using PGH.Helpers;
using PGH.Models.ChangeLog;
using PGH.Models.Planing.BusinessPlan;
using System.IO;
using System.Text.Json;
using WebApplication2.Data;

namespace PGH.Controllers.Planing.BusinessPlan;

[ApiController]
[Route("api/planning/business-plan-directory")]
public class BusinessPlanDirectoryController : ControllerBase
{
    private const int DefaultPageSize = 24;
    private const int MaxPageSize = 96;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        "ppt",
        "pptx",
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "csv"
    };

    private static readonly HashSet<string> AllowedTypeFilters = new(StringComparer.OrdinalIgnoreCase)
    {
        "all",
        "folder",
        "file",
        "presentation",
        "document",
        "spreadsheet",
        "pdf",
        "ppt",
        "pptx",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "csv"
    };

    private static readonly HashSet<string> AllowedSortFilters = new(StringComparer.OrdinalIgnoreCase)
    {
        "name-asc",
        "name-desc",
        "newest",
        "oldest"
    };

    private readonly AppDbContext _db;
    private readonly ILogger<BusinessPlanDirectoryController> _logger;
    private readonly IHostEnvironment _environment;

    public BusinessPlanDirectoryController(
        AppDbContext db,
        ILogger<BusinessPlanDirectoryController> logger,
        IHostEnvironment environment)
    {
        _db = db;
        _logger = logger;
        _environment = environment;
    }

    [HttpGet("entries")]
    public async Task<IActionResult> GetEntries(
        [FromQuery] long? parentId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? type = null,
        [FromQuery] string? sort = null,
        [FromQuery] bool includeDescendants = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        if (!CanAccessPlanning())
        {
            return ForbiddenResponse();
        }

        var normalizedType = NormalizeType(type);
        var normalizedSort = NormalizeSort(sort);
        var normalizedSearch = (search ?? string.Empty).Trim();
        var shouldSearchDescendants = includeDescendants && !string.IsNullOrWhiteSpace(normalizedSearch);
        var resolvedPage = NormalizePage(page);
        var resolvedPageSize = NormalizePageSize(pageSize);
        var currentFolder = parentId.HasValue
            ? await _db.BusinessPlanFile
                .AsNoTracking()
                .Where(entry => entry.Id == parentId.Value && entry.IsFolder)
                .Select(entry => new DirectoryFolderInfo
                {
                    Id = entry.Id,
                    FileName = entry.FileName,
                    ParentId = entry.ParentId
                })
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        if (parentId.HasValue && currentFolder == null)
        {
            return NotFound(new { message = "Folder tidak ditemukan." });
        }

        var scopedQuery = await BuildScopedQueryAsync(parentId, shouldSearchDescendants, cancellationToken);

        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            var escapedSearch = EscapeLikePattern(normalizedSearch);
            scopedQuery = scopedQuery.Where(entry =>
                entry.FileName != null &&
                EF.Functions.Like(entry.FileName, $"%{escapedSearch}%"));
        }

        scopedQuery = ApplyTypeFilter(scopedQuery, normalizedType);
        scopedQuery = ApplySort(scopedQuery, normalizedSort);

        var totalCount = await scopedQuery.CountAsync(cancellationToken);
        var items = await scopedQuery
            .Skip((resolvedPage - 1) * resolvedPageSize)
            .Take(resolvedPageSize)
            .Select(entry => new DirectoryEntryInfo
            {
                Id = entry.Id,
                FileName = entry.FileName,
                IsFolder = entry.IsFolder,
                ParentId = entry.ParentId,
                ContentType = entry.ContentType,
                UploadedAt = entry.UploadedAt,
                FileSizeBytes = entry.FileSizeBytes
            })
            .ToListAsync(cancellationToken);

        var folderIds = items
            .Where(entry => entry.IsFolder)
            .Select(entry => entry.Id)
            .ToArray();

        var childCountByParentId = folderIds.Length == 0
            ? new Dictionary<long, int>()
            : await _db.BusinessPlanFile
                .AsNoTracking()
                .Where(entry => entry.ParentId.HasValue && folderIds.Contains(entry.ParentId.Value))
                .GroupBy(entry => entry.ParentId!.Value)
                .Select(group => new ParentChildCount
                {
                    ParentId = group.Key,
                    Count = group.Count()
                })
                .ToDictionaryAsync(group => group.ParentId, group => group.Count, cancellationToken);

        var currentFolderChildCount = currentFolder == null
            ? 0
            : await _db.BusinessPlanFile
                .AsNoTracking()
                .CountAsync(entry => entry.ParentId == currentFolder.Id, cancellationToken);

        return Ok(new
        {
            currentFolder = currentFolder == null ? null : MapFolderSummary(currentFolder, currentFolderChildCount),
            breadcrumbs = await BuildBreadcrumbsAsync(currentFolder, cancellationToken),
            searchScope = shouldSearchDescendants ? "subtree" : "current-folder",
            items = items
                .Select(entry => MapEntry(entry, childCountByParentId))
                .ToList(),
            pagination = new
            {
                page = resolvedPage,
                pageSize = resolvedPageSize,
                totalCount,
                hasMore = resolvedPage * resolvedPageSize < totalCount
            }
        });
    }

    private async Task<IQueryable<BusinessPlanFile>> BuildScopedQueryAsync(
        long? parentId,
        bool includeDescendants,
        CancellationToken cancellationToken)
    {
        var baseQuery = _db.BusinessPlanFile.AsNoTracking();
        if (!includeDescendants)
        {
            return baseQuery.Where(entry => entry.ParentId == parentId);
        }

        if (!parentId.HasValue)
        {
            return baseQuery;
        }

        var descendantFolderIds = await GetDescendantFolderIdsAsync(parentId.Value, cancellationToken);
        if (descendantFolderIds.Count == 0)
        {
            return baseQuery.Where(entry => entry.ParentId == parentId);
        }

        return baseQuery.Where(entry =>
            entry.ParentId == parentId ||
            (entry.ParentId.HasValue && descendantFolderIds.Contains(entry.ParentId.Value)));
    }

    private async Task<HashSet<long>> GetDescendantFolderIdsAsync(long rootFolderId, CancellationToken cancellationToken)
    {
        var descendantFolderIds = new HashSet<long>();
        var frontier = new List<long> { rootFolderId };

        while (frontier.Count > 0)
        {
            var currentFrontier = frontier;
            frontier = new List<long>();

            var childFolderIds = await _db.BusinessPlanFile
                .AsNoTracking()
                .Where(entry =>
                    entry.IsFolder &&
                    entry.ParentId.HasValue &&
                    currentFrontier.Contains(entry.ParentId.Value))
                .Select(entry => entry.Id)
                .ToListAsync(cancellationToken);

            foreach (var childFolderId in childFolderIds)
            {
                if (descendantFolderIds.Add(childFolderId))
                {
                    frontier.Add(childFolderId);
                }
            }
        }

        return descendantFolderIds;
    }

    [HttpPost("folders")]
    [Consumes("application/json")]
    public Task<IActionResult> CreateFolderJson(
        [FromBody] CreateFolderRequest? request,
        CancellationToken cancellationToken = default) =>
        CreateFolderCore(request, cancellationToken);

    [HttpPost("folders")]
    [Consumes("multipart/form-data", "application/x-www-form-urlencoded")]
    public Task<IActionResult> CreateFolderForm(
        [FromForm] CreateFolderRequest? request,
        CancellationToken cancellationToken = default) =>
        CreateFolderCore(request, cancellationToken);

    [HttpPost("folder")]
    [Consumes("application/json")]
    public Task<IActionResult> CreateFolderJsonAlias(
        [FromBody] CreateFolderRequest? request,
        CancellationToken cancellationToken = default) =>
        CreateFolderCore(request, cancellationToken);

    [HttpPost("folder")]
    [Consumes("multipart/form-data", "application/x-www-form-urlencoded")]
    public Task<IActionResult> CreateFolderFormAlias(
        [FromForm] CreateFolderRequest? request,
        CancellationToken cancellationToken = default) =>
        CreateFolderCore(request, cancellationToken);

    private async Task<IActionResult> CreateFolderCore(
        CreateFolderRequest? request,
        CancellationToken cancellationToken = default)
    {
        if (!CanAccessPlanning())
        {
            return ForbiddenResponse();
        }

        var normalizedName = NormalizeEntryName(request?.Name);
        if (normalizedName == null)
        {
            return BadRequest("Nama folder tidak valid.");
        }

        var parentFolder = await ValidateParentFolderAsync(request?.ParentId, cancellationToken);
        if (request?.ParentId != null && parentFolder == null)
        {
            return NotFound(new { message = "Folder parent tidak ditemukan." });
        }

        var hasDuplicate = await _db.BusinessPlanFile.AnyAsync(
            entry =>
                entry.ParentId == request!.ParentId &&
                entry.FileName != null &&
                entry.FileName == normalizedName,
            cancellationToken);

        if (hasDuplicate)
        {
            return Conflict(new { message = "Nama folder atau file sudah dipakai di folder ini." });
        }

        var folder = new BusinessPlanFile
        {
            FileName = normalizedName,
            IsFolder = true,
            ParentId = request?.ParentId,
            ContentType = null,
            FileSizeBytes = null,
            FileStoragePath = null,
            FileData = null,
            UploadedAt = DateTime.UtcNow
        };

        _db.BusinessPlanFile.Add(folder);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(MapEntry(ToDirectoryEntryInfo(folder), new Dictionary<long, int>()));
    }

    [HttpPost("upload")]
    [RequestSizeLimit(UploadLimitHelper.PlanningDirectoryMaxRequestBytes)]
    public async Task<IActionResult> Upload(
        [FromForm] IFormFile file,
        [FromForm] long? parentId = null,
        CancellationToken cancellationToken = default)
    {
        if (!CanAccessPlanning())
        {
            return ForbiddenResponse();
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest("File tidak ditemukan atau kosong.");
        }

        if (file.Length > UploadLimitHelper.PlanningDirectoryMaxFileBytes)
        {
            return BadRequest($"Ukuran file Planning maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.PlanningDirectoryMaxFileBytes)}.");
        }

        if (parentId.HasValue)
        {
            var parentFolder = await ValidateParentFolderAsync(parentId, cancellationToken);
            if (parentFolder == null)
            {
                return NotFound(new { message = "Folder parent tidak ditemukan." });
            }
        }

        if (!DocumentUploadPolicyHelper.IsPlanningDirectoryFileAllowed(file.FileName, file.ContentType))
        {
            return BadRequest("Format file tidak didukung. Gunakan file PPT, PPTX, PDF, DOC, DOCX, XLS, XLSX, atau CSV.");
        }

        var normalizedFileName = NormalizeEntryName(file.FileName);
        if (normalizedFileName == null)
        {
            return BadRequest("Nama file tidak valid.");
        }

        var hasDuplicate = await _db.BusinessPlanFile.AnyAsync(
            entry =>
                entry.ParentId == parentId &&
                entry.FileName != null &&
                entry.FileName == normalizedFileName,
            cancellationToken);

        if (hasDuplicate)
        {
            return Conflict(new { message = "Nama file atau folder sudah dipakai di folder ini." });
        }

        var utcNow = DateTime.UtcNow;
        var relativeStoragePath = BusinessPlanFileStorageHelper.BuildRelativeStoragePath(normalizedFileName, utcNow);
        var physicalStoragePath = BusinessPlanFileStorageHelper.ResolvePhysicalStoragePath(_environment.ContentRootPath, relativeStoragePath);
        BusinessPlanFileStorageHelper.EnsureStorageDirectory(_environment.ContentRootPath, relativeStoragePath);

        await using (var fileStream = new FileStream(
            physicalStoragePath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 81920,
            options: FileOptions.Asynchronous | FileOptions.SequentialScan))
        {
            await file.CopyToAsync(fileStream, cancellationToken);
        }

        var doc = new BusinessPlanFile
        {
            FileName = normalizedFileName,
            IsFolder = false,
            ParentId = parentId,
            ContentType = string.IsNullOrWhiteSpace(DocumentUploadPolicyHelper.NormalizeContentType(file.ContentType))
                ? "application/octet-stream"
                : DocumentUploadPolicyHelper.NormalizeContentType(file.ContentType),
            FileSizeBytes = file.Length,
            FileStoragePath = relativeStoragePath,
            FileData = null,
            UploadedAt = utcNow
        };

        _db.BusinessPlanFile.Add(doc);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            TryDeleteStoredFile(relativeStoragePath);
            throw;
        }

        return Ok(MapEntry(ToDirectoryEntryInfo(doc), new Dictionary<long, int>()));
    }

    [HttpGet("{id:long}/file")]
    public async Task<IActionResult> Download(long id, CancellationToken cancellationToken = default)
    {
        if (!CanAccessPlanning())
        {
            return ForbiddenResponse();
        }

        var doc = await _db.BusinessPlanFile
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (doc == null || doc.IsFolder)
        {
            return NotFound();
        }

        var contentType = string.IsNullOrWhiteSpace(doc.ContentType)
            ? "application/octet-stream"
            : doc.ContentType;

        if (!string.IsNullOrWhiteSpace(doc.FileStoragePath))
        {
            var physicalStoragePath = BusinessPlanFileStorageHelper.ResolvePhysicalStoragePath(_environment.ContentRootPath, doc.FileStoragePath);
            if (System.IO.File.Exists(physicalStoragePath))
            {
                var stream = new FileStream(
                    physicalStoragePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.Read,
                    bufferSize: 81920,
                    options: FileOptions.Asynchronous | FileOptions.SequentialScan);

                return File(stream, contentType, doc.FileName ?? $"planning-file-{id}", enableRangeProcessing: true);
            }

            _logger.LogWarning("Business plan file storage path is missing on disk. Id={Id}, Path={Path}", id, doc.FileStoragePath);
        }

        if (doc.FileData == null || doc.FileData.Length == 0)
        {
            return NotFound();
        }

        return File(doc.FileData, contentType, doc.FileName ?? $"planning-file-{id}");
    }

    [HttpPatch("{id:long}")]
    public async Task<IActionResult> Rename(
        long id,
        [FromBody] RenameEntryRequest? request,
        CancellationToken cancellationToken = default)
    {
        if (!CanAccessPlanning())
        {
            return ForbiddenResponse();
        }

        var requestedName = NormalizeEntryName(request?.Name);
        if (requestedName == null)
        {
            return BadRequest(new { message = "Nama file atau folder tidak valid." });
        }

        var entry = await _db.BusinessPlanFile
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entry == null)
        {
            return NotFound();
        }

        var normalizedName = ResolveRenameTargetName(entry, requestedName);
        if (normalizedName == null)
        {
            return BadRequest(new { message = "Nama file atau folder tidak valid." });
        }

        if (string.Equals(entry.FileName, normalizedName, StringComparison.Ordinal))
        {
            return Ok(MapEntry(ToDirectoryEntryInfo(entry), new Dictionary<long, int>()));
        }

        var hasDuplicate = await _db.BusinessPlanFile.AnyAsync(
            item =>
                item.Id != id &&
                item.ParentId == entry.ParentId &&
                item.FileName != null &&
                item.FileName == normalizedName,
            cancellationToken);

        if (hasDuplicate)
        {
            return Conflict(new { message = "Nama file atau folder sudah dipakai di folder ini." });
        }

        entry.FileName = normalizedName;
        await _db.SaveChangesAsync(cancellationToken);

        var childCountByParentId = entry.IsFolder
            ? await _db.BusinessPlanFile
                .AsNoTracking()
                .Where(item => item.ParentId == entry.Id)
                .CountAsync(cancellationToken)
            : 0;

        return Ok(MapEntry(
            ToDirectoryEntryInfo(entry),
            entry.IsFolder
                ? new Dictionary<long, int> { [entry.Id] = childCountByParentId }
                : new Dictionary<long, int>()));
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken = default)
    {
        if (!CanAccessPlanning())
        {
            return ForbiddenResponse();
        }

        var target = await _db.BusinessPlanFile
            .AsNoTracking()
            .Where(entry => entry.Id == id)
            .Select(entry => new DirectoryNodeInfo
            {
                Id = entry.Id,
                ParentId = entry.ParentId,
                IsFolder = entry.IsFolder,
                FileName = entry.FileName,
                ContentType = entry.ContentType,
                FileSizeBytes = entry.FileSizeBytes
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (target == null)
        {
            return NotFound();
        }

        var deleteIds = new HashSet<long> { target.Id };
        if (target.IsFolder)
        {
            var frontier = new List<long> { target.Id };

            while (frontier.Count > 0)
            {
                var currentFrontier = frontier;
                frontier = new List<long>();

                var children = await _db.BusinessPlanFile
                    .AsNoTracking()
                    .Where(entry => entry.ParentId.HasValue && currentFrontier.Contains(entry.ParentId.Value))
                    .Select(entry => new DirectoryNodeInfo
                    {
                        Id = entry.Id,
                        ParentId = entry.ParentId,
                        IsFolder = entry.IsFolder,
                        FileName = entry.FileName,
                        ContentType = entry.ContentType,
                        FileSizeBytes = entry.FileSizeBytes
                    })
                    .ToListAsync(cancellationToken);

                foreach (var child in children)
                {
                    if (deleteIds.Add(child.Id) && child.IsFolder)
                    {
                        frontier.Add(child.Id);
                    }
                }
            }
        }

        var fileStoragePaths = await _db.BusinessPlanFile
            .AsNoTracking()
            .Where(entry => deleteIds.Contains(entry.Id) && !entry.IsFolder && entry.FileStoragePath != null)
            .Select(entry => entry.FileStoragePath!)
            .ToListAsync(cancellationToken);

        var allDeletedNodes = target.IsFolder
            ? await _db.BusinessPlanFile
                .AsNoTracking()
                .Where(entry => deleteIds.Contains(entry.Id))
                .Select(entry => new DirectoryNodeInfo
                {
                    Id = entry.Id,
                    ParentId = entry.ParentId,
                    IsFolder = entry.IsFolder,
                    FileName = entry.FileName,
                    ContentType = entry.ContentType,
                    FileSizeBytes = entry.FileSizeBytes
                })
                .ToListAsync(cancellationToken)
            : new List<DirectoryNodeInfo> { target };

        var deletedCount = await _db.BusinessPlanFile
            .Where(entry => deleteIds.Contains(entry.Id))
            .ExecuteDeleteAsync(cancellationToken);

        await WriteDeleteChangeLogAsync(target, allDeletedNodes, deletedCount, cancellationToken);

        foreach (var storagePath in fileStoragePaths)
        {
            TryDeleteStoredFile(storagePath);
        }

        return Ok(new
        {
            message = "Deleted",
            id,
            deletedCount
        });
    }

    private bool CanAccessPlanning()
    {
        if (User?.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        return FeatureAccessResolver.CanAccessRequestedStream(User, FeatureAccessResolver.PlanningStream);
    }

    private IActionResult ForbiddenResponse()
    {
        _logger.LogWarning(
            "Forbidden planning-folder access. UserId={UserId} Endpoint={Endpoint} TimeUtc={TimeUtc}",
            FeatureAccessResolver.GetUserId(User),
            HttpContext.Request.Path,
            DateTime.UtcNow);

        return StatusCode(StatusCodes.Status403Forbidden, new
        {
            message = FeatureAccessResolver.AccessDeniedMessage
        });
    }

    private async Task<BusinessPlanFile?> ValidateParentFolderAsync(long? parentId, CancellationToken cancellationToken)
    {
        if (!parentId.HasValue)
        {
            return null;
        }

        return await _db.BusinessPlanFile.FirstOrDefaultAsync(
            entry => entry.Id == parentId.Value && entry.IsFolder,
            cancellationToken);
    }

    private static object MapEntry(DirectoryEntryInfo entry, IReadOnlyDictionary<long, int> childCountByParentId)
    {
        var childCount = childCountByParentId.TryGetValue(entry.Id, out var resolvedCount)
            ? resolvedCount
            : 0;

        return new
        {
            entry.Id,
            Name = entry.FileName,
            entry.FileName,
            entry.IsFolder,
            entry.ParentId,
            entry.ContentType,
            entry.UploadedAt,
            FileSize = entry.FileSizeBytes ?? 0L,
            Extension = entry.IsFolder ? string.Empty : GetExtension(entry.FileName),
            ChildCount = childCount
        };
    }

    private static DirectoryEntryInfo ToDirectoryEntryInfo(BusinessPlanFile entry)
    {
        return new DirectoryEntryInfo
        {
            Id = entry.Id,
            FileName = entry.FileName,
            IsFolder = entry.IsFolder,
            ParentId = entry.ParentId,
            ContentType = entry.ContentType,
            UploadedAt = entry.UploadedAt,
            FileSizeBytes = entry.FileSizeBytes
        };
    }

    private static object MapFolderSummary(DirectoryFolderInfo entry, int childCount)
    {
        return new
        {
            entry.Id,
            Name = entry.FileName,
            entry.ParentId,
            ChildCount = childCount
        };
    }

    private async Task<IReadOnlyList<object>> BuildBreadcrumbsAsync(
        DirectoryFolderInfo? currentFolder,
        CancellationToken cancellationToken)
    {
        var breadcrumbs = new List<object>
        {
            new
            {
                Id = (long?)null,
                Name = "Root",
                ParentId = (long?)null,
                ChildCount = 0
            }
        };

        if (currentFolder == null)
        {
            return breadcrumbs;
        }

        var stack = new Stack<DirectoryFolderInfo>();
        var cursor = currentFolder;
        while (cursor != null)
        {
            stack.Push(cursor);
            if (!cursor.ParentId.HasValue)
            {
                cursor = null;
                continue;
            }

            cursor = await _db.BusinessPlanFile
                .AsNoTracking()
                .Where(entry => entry.Id == cursor.ParentId.Value && entry.IsFolder)
                .Select(entry => new DirectoryFolderInfo
                {
                    Id = entry.Id,
                    FileName = entry.FileName,
                    ParentId = entry.ParentId
                })
                .FirstOrDefaultAsync(cancellationToken);
        }

        while (stack.Count > 0)
        {
            breadcrumbs.Add(MapFolderSummary(stack.Pop(), 0));
        }

        return breadcrumbs;
    }

    private static IQueryable<BusinessPlanFile> ApplySort(IQueryable<BusinessPlanFile> entries, string sort)
    {
        return sort switch
        {
            "name-desc" => entries
                .OrderBy(entry => entry.IsFolder ? 0 : 1)
                .ThenByDescending(entry => entry.FileName)
                .ThenByDescending(entry => entry.Id),
            "newest" => entries
                .OrderBy(entry => entry.IsFolder ? 0 : 1)
                .ThenByDescending(entry => entry.UploadedAt ?? entry.CreatedAt ?? DateTime.MinValue)
                .ThenByDescending(entry => entry.Id),
            "oldest" => entries
                .OrderBy(entry => entry.IsFolder ? 0 : 1)
                .ThenBy(entry => entry.UploadedAt ?? entry.CreatedAt ?? DateTime.MinValue)
                .ThenBy(entry => entry.Id),
            _ => entries
                .OrderBy(entry => entry.IsFolder ? 0 : 1)
                .ThenBy(entry => entry.FileName)
                .ThenBy(entry => entry.Id)
        };
    }

    private static IQueryable<BusinessPlanFile> ApplyTypeFilter(IQueryable<BusinessPlanFile> entries, string normalizedType)
    {
        return normalizedType switch
        {
            "folder" => entries.Where(entry => entry.IsFolder),
            "file" => entries.Where(entry => !entry.IsFolder),
            "presentation" => entries.Where(entry =>
                !entry.IsFolder &&
                entry.FileName != null &&
                (EF.Functions.Like(entry.FileName, "%.ppt") || EF.Functions.Like(entry.FileName, "%.pptx"))),
            "document" => entries.Where(entry =>
                !entry.IsFolder &&
                entry.FileName != null &&
                (EF.Functions.Like(entry.FileName, "%.doc") || EF.Functions.Like(entry.FileName, "%.docx"))),
            "spreadsheet" => entries.Where(entry =>
                !entry.IsFolder &&
                entry.FileName != null &&
                (EF.Functions.Like(entry.FileName, "%.xls") ||
                 EF.Functions.Like(entry.FileName, "%.xlsx") ||
                 EF.Functions.Like(entry.FileName, "%.csv"))),
            "pdf" => entries.Where(entry =>
                !entry.IsFolder &&
                entry.FileName != null &&
                EF.Functions.Like(entry.FileName, "%.pdf")),
            "ppt" or "pptx" or "doc" or "docx" or "xls" or "xlsx" or "csv" => entries.Where(entry =>
                !entry.IsFolder &&
                entry.FileName != null &&
                EF.Functions.Like(entry.FileName, $"%.{normalizedType}")),
            _ => entries
        };
    }

    private static string NormalizeType(string? type)
    {
        var normalized = (type ?? "all").Trim().ToLowerInvariant();
        return AllowedTypeFilters.Contains(normalized) ? normalized : "all";
    }

    private static string NormalizeSort(string? sort)
    {
        var normalized = (sort ?? "name-asc").Trim().ToLowerInvariant();
        return AllowedSortFilters.Contains(normalized) ? normalized : "name-asc";
    }

    private static int NormalizePage(int page)
    {
        return page < 1 ? 1 : page;
    }

    private static int NormalizePageSize(int pageSize)
    {
        if (pageSize < 1)
        {
            return DefaultPageSize;
        }

        return pageSize > MaxPageSize ? MaxPageSize : pageSize;
    }

    private static string EscapeLikePattern(string value)
    {
        return value
            .Replace("[", "[[]", StringComparison.Ordinal)
            .Replace("%", "[%]", StringComparison.Ordinal)
            .Replace("_", "[_]", StringComparison.Ordinal);
    }

    private static string? NormalizeEntryName(string? rawName)
    {
        var trimmed = (rawName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return null;
        }

        if (trimmed.Length > 512)
        {
            return null;
        }

        if (trimmed.Contains('/') || trimmed.Contains('\\'))
        {
            return null;
        }

        if (trimmed.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        {
            return null;
        }

        return trimmed;
    }

    private static string GetExtension(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return string.Empty;
        }

        return Path.GetExtension(fileName)?.Trim().TrimStart('.').ToLowerInvariant() ?? string.Empty;
    }

    private static string? ResolveRenameTargetName(BusinessPlanFile entry, string requestedName)
    {
        if (entry.IsFolder)
        {
            return requestedName;
        }

        var currentFileName = entry.FileName ?? string.Empty;
        var currentExtension = Path.GetExtension(currentFileName);
        if (string.IsNullOrWhiteSpace(currentExtension))
        {
            return requestedName;
        }

        var requestedBaseName = requestedName.Trim();
        while (requestedBaseName.EndsWith(currentExtension, StringComparison.OrdinalIgnoreCase))
        {
            requestedBaseName = requestedBaseName[..^currentExtension.Length].TrimEnd();
        }

        if (string.IsNullOrWhiteSpace(requestedBaseName))
        {
            requestedBaseName = Path.GetFileNameWithoutExtension(requestedName)?.Trim();
        }

        if (string.IsNullOrWhiteSpace(requestedBaseName))
        {
            return null;
        }

        return $"{requestedBaseName}{currentExtension}";
    }

    private async Task WriteDeleteChangeLogAsync(
        DirectoryNodeInfo target,
        IReadOnlyCollection<DirectoryNodeInfo> deletedNodes,
        int deletedCount,
        CancellationToken cancellationToken)
    {
        try
        {
            var deletedFolderCount = deletedNodes.Count(node => node.IsFolder);
            var deletedFileCount = deletedNodes.Count(node => !node.IsFolder);
            var payloadFields = new List<object>
            {
                new
                {
                    field = nameof(BusinessPlanFile.FileName),
                    label = "Nama File",
                    before = target.FileName ?? "Belum Diisi"
                },
                new
                {
                    field = "ItemType",
                    label = "Jenis Item",
                    before = target.IsFolder ? "Folder" : "File"
                }
            };

            if (!target.IsFolder)
            {
                payloadFields.Add(new
                {
                    field = nameof(BusinessPlanFile.ContentType),
                    label = "Tipe File",
                    before = BuildFriendlyFileTypeLabel(target.ContentType, target.FileName)
                });

                if (target.FileSizeBytes.HasValue && target.FileSizeBytes.Value > 0)
                {
                    payloadFields.Add(new
                    {
                        field = nameof(BusinessPlanFile.FileSizeBytes),
                        label = "Ukuran File",
                        before = FormatFileSize(target.FileSizeBytes.Value)
                    });
                }
            }

            if (target.IsFolder)
            {
                payloadFields.Add(new
                {
                    field = "DeletedFolders",
                    label = "Folder Dihapus",
                    before = deletedFolderCount.ToString()
                });
                payloadFields.Add(new
                {
                    field = "DeletedFiles",
                    label = "File Dihapus",
                    before = deletedFileCount.ToString()
                });
                payloadFields.Add(new
                {
                    field = "DeletedItems",
                    label = "Total Item Dihapus",
                    before = deletedCount.ToString()
                });
            }

            var changeSummary = JsonSerializer.Serialize(new
            {
                kind = "DELETE",
                message = target.IsFolder
                    ? $"Menghapus folder: {target.FileName ?? "Belum Diisi"}."
                    : $"Menghapus file: {target.FileName ?? "Belum Diisi"}.",
                fields = payloadFields
            });

            _db.ChangeLog.Add(new ChangeLog
            {
                TableName = "BusinessPlanFile",
                EntityId = target.Id,
                ChangedBy = FeatureAccessResolver.GetUserId(User),
                ChangeType = "DELETE",
                ChangeSummary = changeSummary,
                Timestamp = DateTime.UtcNow,
                IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
            });

            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gagal menulis riwayat hapus Business Plan Directory. Id={Id}", target.Id);
        }
    }

    private static string BuildFriendlyFileTypeLabel(string? contentType, string? fileName = null)
    {
        var normalizedContentType = string.IsNullOrWhiteSpace(contentType)
            ? null
            : contentType.Trim().ToLowerInvariant();
        var normalizedExtension = string.IsNullOrWhiteSpace(fileName)
            ? null
            : Path.GetExtension(fileName)?.Trim().ToLowerInvariant();

        var label = normalizedExtension switch
        {
            ".xlsx" => "Excel (.xlsx)",
            ".xls" => "Excel (.xls)",
            ".csv" => "CSV",
            ".pdf" => "PDF",
            ".docx" => "Word (.docx)",
            ".doc" => "Word (.doc)",
            ".pptx" => "PowerPoint (.pptx)",
            ".ppt" => "PowerPoint (.ppt)",
            _ => normalizedContentType switch
            {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => "Excel (.xlsx)",
                "application/vnd.ms-excel" => "Excel (.xls)",
                "text/csv" => "CSV",
                "application/pdf" => "PDF",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => "Word (.docx)",
                "application/msword" => "Word (.doc)",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" => "PowerPoint (.pptx)",
                "application/vnd.ms-powerpoint" => "PowerPoint (.ppt)",
                _ => null
            }
        };

        if (!string.IsNullOrWhiteSpace(label))
        {
            return label;
        }

        if (!string.IsNullOrWhiteSpace(normalizedExtension))
        {
            return $"File ({normalizedExtension})";
        }

        return "File";
    }

    private static string FormatFileSize(long fileSizeBytes)
    {
        if (fileSizeBytes < 1024)
        {
            return $"{fileSizeBytes} B";
        }

        var kiloBytes = fileSizeBytes / 1024d;
        if (kiloBytes < 1024)
        {
            return $"{kiloBytes:0.##} KB";
        }

        var megaBytes = kiloBytes / 1024d;
        return $"{megaBytes:0.##} MB";
    }

    private void TryDeleteStoredFile(string relativeStoragePath)
    {
        try
        {
            var physicalPath = BusinessPlanFileStorageHelper.ResolvePhysicalStoragePath(_environment.ContentRootPath, relativeStoragePath);
            if (System.IO.File.Exists(physicalPath))
            {
                System.IO.File.Delete(physicalPath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete stored business plan file from disk. Path={Path}", relativeStoragePath);
        }
    }

    private sealed class DirectoryEntryInfo
    {
        public long Id { get; init; }
        public string? FileName { get; init; }
        public bool IsFolder { get; init; }
        public long? ParentId { get; init; }
        public string? ContentType { get; init; }
        public DateTime? UploadedAt { get; init; }
        public long? FileSizeBytes { get; init; }
    }

    private sealed class DirectoryFolderInfo
    {
        public long Id { get; init; }
        public string? FileName { get; init; }
        public long? ParentId { get; init; }
    }

    private sealed class DirectoryNodeInfo
    {
        public long Id { get; init; }
        public long? ParentId { get; init; }
        public bool IsFolder { get; init; }
        public string? FileName { get; init; }
        public string? ContentType { get; init; }
        public long? FileSizeBytes { get; init; }
    }

    private sealed class ParentChildCount
    {
        public long ParentId { get; init; }
        public int Count { get; init; }
    }

    public sealed class CreateFolderRequest
    {
        public string? Name { get; set; }
        public long? ParentId { get; set; }
    }

    public sealed class RenameEntryRequest
    {
        public string? Name { get; set; }
    }
}
