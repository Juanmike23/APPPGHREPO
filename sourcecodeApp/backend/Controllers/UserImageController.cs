/*
 * PGH-DOC
 * File: Controllers/UserImageController.cs
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
using PGH.Helpers;
using PGH.Models.User;
using WebApplication2.Data;

[ApiController]
[Route("api/[controller]")]
public class UserImagesController : ControllerBase
{
    private readonly AppDbContext _db;

    public UserImagesController(AppDbContext db)
    {
        _db = db;
    }

    // ============================================================
    // 1️⃣ Upload PROFILE IMAGE
    // ============================================================
    [HttpPost("upload/{userId}")]
    [RequestSizeLimit(UploadLimitHelper.UserImageMaxRequestBytes)]
    public async Task<IActionResult> Upload(Guid userId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        if (file.Length > UploadLimitHelper.UserImageMaxFileBytes)
            return BadRequest($"Ukuran file maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.UserImageMaxFileBytes)}.");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);

        // Delete old images for this user
        var oldImages = _db.UserImages.Where(x => x.UserId == userId);
        _db.UserImages.RemoveRange(oldImages);

        var userImage = new UserImage
        {
            UserId = userId,
            MimeType = file.ContentType,
            ImageData = ms.ToArray(),
            CreatedAt = DateTime.UtcNow
        };

        _db.UserImages.Add(userImage);
        await _db.SaveChangesAsync();

        return Ok(new { success = true });
    }

    // ============================================================
    // 2️⃣ Upload BACKGROUND IMAGE
    // ============================================================
    [HttpPost("upload-bg/{userId}")]
    [RequestSizeLimit(UploadLimitHelper.UserImageMaxRequestBytes)]
    public async Task<IActionResult> UploadBg(Guid userId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        if (file.Length > UploadLimitHelper.UserImageMaxFileBytes)
            return BadRequest($"Ukuran file maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.UserImageMaxFileBytes)}.");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);

        var userImage = _db.UserImages
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefault();

        if (userImage == null)
            return NotFound("Upload normal image first.");

        userImage.ImageBg = ms.ToArray();
        userImage.ImageBgMimeType = file.ContentType;   // ⭐ NEW MIME TYPE

        await _db.SaveChangesAsync();

        return Ok(new { success = true });
    }

    // ============================================================
    // 3️⃣ Get PROFILE IMAGE
    // ============================================================
    [HttpGet("{userId}")]
    public IActionResult GetImage(Guid userId)
    {
        var img = _db.UserImages
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefault();

        if (img == null || img.ImageData == null)
            return NotFound();

        return File(img.ImageData, img.MimeType ?? "image/jpeg");
    }

    // ============================================================
    // 4️⃣ Get BACKGROUND IMAGE
    // ============================================================
    [HttpGet("bg/{userId}")]
    public IActionResult GetImageBg(Guid userId)
    {
        var img = _db.UserImages
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefault();

        if (img == null || img.ImageBg == null)
            return NotFound();

        return File(img.ImageBg, img.ImageBgMimeType ?? "image/jpeg");
    }

    // ============================================================
    // 5️⃣ DELETE by ImageId
    // ============================================================
    [HttpDelete("{imageId}")]
    public async Task<IActionResult> Delete(Guid imageId)
    {
        var img = await _db.UserImages.FindAsync(imageId);

        if (img == null)
            return NotFound();

        _db.UserImages.Remove(img);
        await _db.SaveChangesAsync();

        return Ok(new { success = true });
    }
}
