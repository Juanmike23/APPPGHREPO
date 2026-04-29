/*
 * PGH-DOC
 * File: Helpers/DocumentUploadPolicyHelper.cs
 * Apa fungsi bagian ini:
 * - Menyediakan policy global validasi upload dokumen agar tidak di-hardcode per controller.
 * Kenapa perlu:
 * - Mengurangi duplikasi validasi file dan menjaga standar keamanan upload konsisten lintas unit.
 * Aturan khususnya apa:
 * - Validasi berdasarkan ekstensi, MIME, dan ukuran maksimum.
 */

namespace PGH.Helpers;

public static class DocumentUploadPolicyHelper
{
    private static readonly IReadOnlyDictionary<string, ISet<string>> PlanningDirectoryContentTypesByExtension =
        new Dictionary<string, ISet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [".ppt"] = MimeSet("application/vnd.ms-powerpoint"),
            [".pptx"] = MimeSet("application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            [".pdf"] = MimeSet("application/pdf"),
            [".doc"] = MimeSet("application/msword"),
            [".docx"] = MimeSet("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            [".xls"] = MimeSet("application/vnd.ms-excel"),
            [".xlsx"] = MimeSet("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            [".csv"] = MimeSet("text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"),
        };

    private static readonly IReadOnlyDictionary<string, ISet<string>> ComplianceDocumentContentTypesByExtension =
        new Dictionary<string, ISet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [".ppt"] = MimeSet("application/vnd.ms-powerpoint"),
            [".pptx"] = MimeSet("application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            [".pdf"] = MimeSet("application/pdf"),
            [".doc"] = MimeSet("application/msword"),
            [".docx"] = MimeSet("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            [".xls"] = MimeSet("application/vnd.ms-excel"),
            [".xlsx"] = MimeSet("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            [".csv"] = MimeSet("text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"),
            [".jpg"] = MimeSet("image/jpeg", "image/jpg"),
            [".jpeg"] = MimeSet("image/jpeg", "image/jpg"),
            [".png"] = MimeSet("image/png"),
            [".webp"] = MimeSet("image/webp"),
            [".gif"] = MimeSet("image/gif"),
        };

    private static readonly IReadOnlyDictionary<string, ISet<string>> AuditEvidenceContentTypesByExtension =
        new Dictionary<string, ISet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = MimeSet("image/jpeg", "image/jpg"),
            [".jpeg"] = MimeSet("image/jpeg", "image/jpg"),
            [".png"] = MimeSet("image/png"),
            [".webp"] = MimeSet("image/webp"),
            [".gif"] = MimeSet("image/gif"),
        };

    public static string GetExtension(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return string.Empty;
        }

        return Path.GetExtension(fileName)?.Trim().ToLowerInvariant() ?? string.Empty;
    }

    public static string SanitizeFileName(string? fileName)
    {
        var sanitized = Path.GetFileName(fileName ?? string.Empty);
        return string.IsNullOrWhiteSpace(sanitized) ? "file" : sanitized;
    }

    public static string NormalizeContentType(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
        {
            return string.Empty;
        }

        return contentType.Split(';', 2)[0].Trim().ToLowerInvariant();
    }

    public static bool IsPlanningDirectoryFileAllowed(string? fileName, string? contentType) =>
        IsAllowedFile(fileName, contentType, PlanningDirectoryContentTypesByExtension, allowGenericBinaryFallback: true);

    public static bool IsComplianceDocumentAllowed(string? fileName, string? contentType) =>
        IsAllowedFile(fileName, contentType, ComplianceDocumentContentTypesByExtension, allowGenericBinaryFallback: true);

    public static bool IsAuditEvidenceImageAllowed(string? fileName, string? contentType) =>
        IsAllowedFile(fileName, contentType, AuditEvidenceContentTypesByExtension, allowGenericBinaryFallback: false);

    public static bool IsAllowedFile(
        string? fileName,
        string? contentType,
        ISet<string> allowedExtensions,
        ISet<string> allowedContentTypes)
    {
        var extension = GetExtension(fileName);
        if (!allowedExtensions.Contains(extension))
        {
            return false;
        }

        var normalizedContentType = NormalizeContentType(contentType);
        if (string.IsNullOrWhiteSpace(normalizedContentType))
        {
            return false;
        }

        return allowedContentTypes.Contains(normalizedContentType);
    }

    public static bool IsAllowedFile(
        string? fileName,
        string? contentType,
        IReadOnlyDictionary<string, ISet<string>> allowedContentTypesByExtension,
        bool allowGenericBinaryFallback)
    {
        var extension = GetExtension(fileName);
        if (!allowedContentTypesByExtension.TryGetValue(extension, out var allowedContentTypes))
        {
            return false;
        }

        var normalizedContentType = NormalizeContentType(contentType);
        if (string.IsNullOrWhiteSpace(normalizedContentType))
        {
            return false;
        }

        if (allowedContentTypes.Contains(normalizedContentType))
        {
            return true;
        }

        return allowGenericBinaryFallback &&
               string.Equals(normalizedContentType, "application/octet-stream", StringComparison.OrdinalIgnoreCase);
    }

    public static string DetectImageContentType(byte[]? fileBytes)
    {
        if (fileBytes == null || fileBytes.Length < 4)
        {
            return "application/octet-stream";
        }

        if (fileBytes.Length >= 3 &&
            fileBytes[0] == 0xFF &&
            fileBytes[1] == 0xD8 &&
            fileBytes[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (fileBytes.Length >= 8 &&
            fileBytes[0] == 0x89 &&
            fileBytes[1] == 0x50 &&
            fileBytes[2] == 0x4E &&
            fileBytes[3] == 0x47 &&
            fileBytes[4] == 0x0D &&
            fileBytes[5] == 0x0A &&
            fileBytes[6] == 0x1A &&
            fileBytes[7] == 0x0A)
        {
            return "image/png";
        }

        if (fileBytes.Length >= 6)
        {
            var header = System.Text.Encoding.ASCII.GetString(fileBytes, 0, 6);
            if (string.Equals(header, "GIF87a", StringComparison.Ordinal) ||
                string.Equals(header, "GIF89a", StringComparison.Ordinal))
            {
                return "image/gif";
            }
        }

        if (fileBytes.Length >= 12 &&
            fileBytes[0] == 0x52 &&
            fileBytes[1] == 0x49 &&
            fileBytes[2] == 0x46 &&
            fileBytes[3] == 0x46 &&
            fileBytes[8] == 0x57 &&
            fileBytes[9] == 0x45 &&
            fileBytes[10] == 0x42 &&
            fileBytes[11] == 0x50)
        {
            return "image/webp";
        }

        return "application/octet-stream";
    }

    private static HashSet<string> MimeSet(params string[] values) =>
        new(values, StringComparer.OrdinalIgnoreCase);
}

