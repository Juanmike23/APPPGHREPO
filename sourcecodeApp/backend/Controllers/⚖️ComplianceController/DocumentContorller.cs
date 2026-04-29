/*
 * PGH-DOC
 * File: Controllers/⚖️ComplianceController/DocumentContorller.cs
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
using PGH.Models.Compliance;
using WebApplication2.Data;

[ApiController]
[Route("api/[controller]")]
public class DocumentsController : ControllerBase
{
    private const string ComplianceFolderName = "Compliance";

    private readonly AppDbContext _db;
    private readonly ILogger<DocumentsController> _logger;

    public DocumentsController(AppDbContext db, ILogger<DocumentsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet("{id:long}/file")]
    public async Task<IActionResult> DownloadFile(long id, CancellationToken ct)
    {
        var (doc, error) = await ResolveAccessibleDocumentAsync(id, ct, requireFileData: true);
        if (error != null)
            return error;

        return BuildInlineFileResult(doc!);
    }

    [HttpPost("{folder}/upload")]
    [RequestSizeLimit(UploadLimitHelper.ComplianceDocumentMaxRequestBytes)]
    public async Task<IActionResult> UploadToFolder(string folder, [FromForm] IFormFile file)
    {
        if (!IsComplianceFolder(folder))
        {
            LogForbiddenDocumentAccess(folder, "upload-folder-outside-compliance");
            return ForbiddenDocumentResponse();
        }

        if (file == null || file.Length == 0)
            return BadRequest("No file provided or empty.");

        if (file.Length > UploadLimitHelper.ComplianceDocumentMaxFileBytes)
            return BadRequest($"Ukuran file compliance maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.ComplianceDocumentMaxFileBytes)}.");

        if (!DocumentUploadPolicyHelper.IsComplianceDocumentAllowed(file.FileName, file.ContentType))
            return BadRequest("Format file compliance tidak didukung. Gunakan PPT, PPTX, PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, JPEG, PNG, WEBP, atau GIF.");

        var doc = await SaveDocumentAsync(file, ComplianceFolderName);

        return Ok(ToUploadResponse(doc));
    }

    private async Task<(Documents? doc, IActionResult? error)> ResolveAccessibleDocumentAsync(
        long id,
        CancellationToken ct,
        bool requireFileData = false,
        bool tracked = false)
    {
        if (User?.Identity?.IsAuthenticated != true)
            return (null, Unauthorized());

        if (!FeatureAccessResolver.CanAccessRequestedStream(User, FeatureAccessResolver.ComplianceStream))
        {
            LogForbiddenDocumentAccess(id.ToString(), "stream-access-denied");
            return (null, ForbiddenDocumentResponse());
        }

        var query = tracked
            ? _db.Documents.AsQueryable()
            : _db.Documents.AsNoTracking();

        var doc = await query.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (doc == null)
            return (null, NotFound());

        if (!await IsDocumentInComplianceScopeAsync(doc, ct))
        {
            LogForbiddenDocumentAccess(id.ToString(), "document-not-bound-to-compliance");
            return (null, ForbiddenDocumentResponse());
        }

        if (requireFileData && (doc.FileData == null || doc.FileData.Length == 0))
            return (null, NotFound());

        return (doc, null);
    }

    private async Task<bool> IsDocumentInComplianceScopeAsync(Documents doc, CancellationToken ct)
    {
        if (doc.Folder == ComplianceFolderName)
            return true;

        return await _db.DocumentPeriodReport
            .AsNoTracking()
            .AnyAsync(x => x.DocumentId == doc.Id, ct);
    }

    private async Task<Documents> SaveDocumentAsync(IFormFile file, string folder)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var safeFileName = DocumentUploadPolicyHelper.SanitizeFileName(file.FileName);
        var normalizedContentType = DocumentUploadPolicyHelper.NormalizeContentType(file.ContentType);

        var doc = new Documents
        {
            FileName = safeFileName,
            ContentType = string.IsNullOrWhiteSpace(normalizedContentType)
                ? "application/octet-stream"
                : normalizedContentType,
            FileData = ms.ToArray(),
            UploadedAt = DateTime.UtcNow,
            Folder = folder
        };

        _db.Documents.Add(doc);
        await _db.SaveChangesAsync();

        return doc;
    }

    private IActionResult BuildInlineFileResult(Documents doc)
    {
        var contentType = string.IsNullOrWhiteSpace(doc.ContentType)
            ? "application/octet-stream"
            : doc.ContentType;

        Response.Headers["Content-Disposition"] =
            $"inline; filename*=UTF-8''{Uri.EscapeDataString(doc.FileName ?? "file")}";

        return File(doc.FileData!, contentType);
    }

    private static object ToUploadResponse(Documents doc) => new
    {
        doc.Id,
        doc.FileName,
        doc.ContentType,
        doc.UploadedAt
    };

    private IActionResult ForbiddenDocumentResponse() =>
        StatusCode(StatusCodes.Status403Forbidden, new
        {
            message = FeatureAccessResolver.AccessDeniedMessage
        });

    private void LogForbiddenDocumentAccess(string documentRef, string reason)
    {
        _logger.LogWarning(
            "Forbidden document access. UserId={UserId} DocumentRef={DocumentRef} Endpoint={Endpoint} TimeUtc={TimeUtc} Reason={Reason}",
            FeatureAccessResolver.GetUserId(User),
            documentRef,
            HttpContext.Request.Path,
            DateTime.UtcNow,
            reason);
    }

    private static bool IsComplianceFolder(string folder) =>
        string.Equals(folder?.Trim(), ComplianceFolderName, StringComparison.OrdinalIgnoreCase);
}
