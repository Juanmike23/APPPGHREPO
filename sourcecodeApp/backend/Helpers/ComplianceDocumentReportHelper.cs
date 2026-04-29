/*
 * PGH-DOC
 * File: Helpers/ComplianceDocumentReportHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan utilitas bersama untuk document period report compliance.
 * Kenapa perlu:
 * - Perlu agar validasi progress, normalisasi link, deskripsi dokumen, dan URL file konsisten lintas endpoint compliance.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System.IO;
using Newtonsoft.Json.Linq;
using PGH.Models.Compliance;

namespace PGH.Helpers;

public static class ComplianceDocumentReportHelper
{
    public static bool IsValidProgress(decimal progressPercent) =>
        progressPercent >= 0m && progressPercent <= 100m;

    public static decimal RoundProgress(decimal progressPercent) =>
        Math.Round(progressPercent, 2, MidpointRounding.AwayFromZero);

    public static string? NormalizeOptionalText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static bool TryNormalizeExternalLink(string? value, out string? normalizedLink)
    {
        normalizedLink = NormalizeOptionalText(value);
        if (normalizedLink == null)
        {
            return true;
        }

        if (!Uri.TryCreate(normalizedLink, UriKind.Absolute, out var uri))
        {
            normalizedLink = null;
            return false;
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            normalizedLink = null;
            return false;
        }

        normalizedLink = uri.AbsoluteUri;
        return true;
    }

    public static string? SanitizeExternalLinkForOutput(string? value)
    {
        return TryNormalizeExternalLink(value, out var normalizedLink)
            ? normalizedLink
            : null;
    }

    public static string? DescribeDocumentForChangeLog(Documents? document)
    {
        if (document == null)
        {
            return null;
        }

        var fileName = string.IsNullOrWhiteSpace(document.FileName)
            ? "file-tanpa-nama"
            : document.FileName.Trim();
        var contentType = BuildFriendlyFileTypeLabel(document.ContentType, document.FileName);
        var fileSize = document.FileData?.LongLength ?? 0L;

        return $"{fileName} ({contentType}, {FormatFileSize(fileSize)})";
    }

    public static string BuildFriendlyFileTypeLabel(string? contentType, string? fileName = null)
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
            ".png" => "PNG",
            ".jpg" or ".jpeg" => "JPG",
            ".webp" => "WEBP",
            ".gif" => "GIF",
            ".zip" => "ZIP",
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
                "image/png" => "PNG",
                "image/jpeg" => "JPG",
                "image/webp" => "WEBP",
                "image/gif" => "GIF",
                "application/zip" or "application/x-zip-compressed" => "ZIP",
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

    public static string FormatFileSize(long fileSizeBytes)
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

    public static bool TryGetProperty(JObject source, string propertyName, out JToken value)
    {
        foreach (var property in source.Properties())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = JValue.CreateNull();
        return false;
    }

    public static bool TryReadLong(JToken token, out long value)
    {
        value = default;
        if (token.Type == JTokenType.Null)
        {
            return false;
        }

        try
        {
            value = token.ToObject<long>();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static bool TryReadDecimal(JToken token, out decimal value)
    {
        value = default;
        if (token.Type == JTokenType.Null)
        {
            return false;
        }

        try
        {
            value = token.ToObject<decimal>();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static string BuildDocumentFilePath(long documentId) =>
        $"/api/documents/{documentId}/file";
}
