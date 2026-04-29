/*
 * PGH-DOC
 * File: Helpers/AuditListExportHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan utilitas sanitasi dan rendering export untuk ListAudit.
 * Kenapa perlu:
 * - Perlu agar formatting CSV/XLSX, sanitasi rich text, dan presentasi distinct export tetap konsisten lintas endpoint audit.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using OfficeOpenXml;
using OfficeOpenXml.Style;
using PGH.Models.Audit;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace PGH.Helpers;

public sealed class AuditListDistinctExportValueItem
{
    public object? Value { get; init; }
    public int Count { get; init; }
}

public static class AuditListExportHelper
{
    private static readonly Regex RichTextTagRegex = new("</?(b|i|u)>", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string? StripInlineFormatTags(string? value)
    {
        if (value == null)
        {
            return null;
        }

        return RichTextTagRegex.Replace(value, string.Empty);
    }

    public static string? NormalizeExportTextValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        return (StripInlineFormatTags(value) ?? string.Empty)
            .Replace("\r\n", "\n")
            .Trim();
    }

    public static int SanitizeEntity(ListAudit entity, IEnumerable<string> sanitizedStringPropertyNames)
    {
        var changedFields = 0;

        foreach (var propertyName in sanitizedStringPropertyNames)
        {
            var property = typeof(ListAudit).GetProperty(propertyName);
            if (property?.PropertyType != typeof(string) || !property.CanRead || !property.CanWrite)
            {
                continue;
            }

            var currentValue = property.GetValue(entity) as string;
            var sanitizedValue = StripInlineFormatTags(currentValue);
            if (!string.Equals(currentValue, sanitizedValue, StringComparison.Ordinal))
            {
                property.SetValue(entity, sanitizedValue);
                changedFields++;
            }
        }

        var sanitizedExtraData = StripInlineFormatTags(entity.ExtraData);
        if (!string.Equals(entity.ExtraData, sanitizedExtraData, StringComparison.Ordinal))
        {
            entity.ExtraData = sanitizedExtraData;
            changedFields++;
        }

        return changedFields;
    }

    public static byte[] BuildCsvExport(
        IReadOnlyList<ListAudit> rows,
        IReadOnlyList<string> columns,
        string syntheticNumberColumn,
        IReadOnlyDictionary<string, string> columnLabels)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", columns.Select(column => FormatCsvValue(GetExportHeaderLabel(column, columnLabels)))));

        for (int rowIndex = 0; rowIndex < rows.Count; rowIndex++)
        {
            var row = rows[rowIndex];
            var sequenceNumber = rowIndex + 1;
            var values = columns
                .Select(column => FormatCsvValue(GetExportCellValue(row, column, sequenceNumber, forCsv: true, syntheticNumberColumn)));
            sb.AppendLine(string.Join(",", values));
        }

        return BuildUtf8BomBytes(sb.ToString());
    }

    public static byte[] BuildXlsxExport(
        IReadOnlyList<ListAudit> rows,
        IReadOnlyList<string> columns,
        IReadOnlyDictionary<string, string> columnLabels)
    {
        using var package = new ExcelPackage();
        var worksheet = package.Workbook.Worksheets.Add("ListAudit");

        for (int col = 0; col < columns.Count; col++)
        {
            worksheet.Cells[1, col + 1].Value = GetExportHeaderLabel(columns[col], columnLabels);
            worksheet.Cells[1, col + 1].Style.Font.Bold = true;
        }

        for (int rowIndex = 0; rowIndex < rows.Count; rowIndex++)
        {
            var excelRow = rowIndex + 2;
            var row = rows[rowIndex];

            for (int col = 0; col < columns.Count; col++)
            {
                var columnKey = columns[col];
                var excelCol = col + 1;

                if (columnKey == nameof(ListAudit.RHA))
                {
                    if (!TryAddEvidenceImage(worksheet, excelRow, excelCol, row.RHA, $"RHA_{row.Id}_{excelRow}"))
                    {
                        worksheet.Cells[excelRow, excelCol].Value = row.RHA != null && row.RHA.Length > 0 ? "Yes" : "No";
                    }

                    continue;
                }

                if (columnKey == nameof(ListAudit.LHA))
                {
                    if (!TryAddEvidenceImage(worksheet, excelRow, excelCol, row.LHA, $"LHA_{row.Id}_{excelRow}"))
                    {
                        worksheet.Cells[excelRow, excelCol].Value = row.LHA != null && row.LHA.Length > 0 ? "Yes" : "No";
                    }

                    continue;
                }

                var value = GetExportCellValue(row, columnKey, rowIndex + 1, forCsv: false, syntheticNumberColumn: null);
                worksheet.Cells[excelRow, excelCol].Value = value;

                if (value is DateTime)
                {
                    worksheet.Cells[excelRow, excelCol].Style.Numberformat.Format = "yyyy-mm-dd hh:mm:ss";
                }
            }
        }

        if (worksheet.Dimension != null)
        {
            ApplyStandardExportWorksheetStyles(worksheet, columns.Count);
            TableExportHelper.ApplyAutoFitLayout(worksheet, columns.Count);
        }

        var rhaIndex = columns
            .Select((value, index) => new { value, index })
            .FirstOrDefault(x => string.Equals(x.value, nameof(ListAudit.RHA), StringComparison.OrdinalIgnoreCase))
            ?.index ?? -1;
        if (rhaIndex >= 0)
        {
            worksheet.Column(rhaIndex + 1).Width = Math.Max(worksheet.Column(rhaIndex + 1).Width, 16);
        }

        var lhaIndex = columns
            .Select((value, index) => new { value, index })
            .FirstOrDefault(x => string.Equals(x.value, nameof(ListAudit.LHA), StringComparison.OrdinalIgnoreCase))
            ?.index ?? -1;
        if (lhaIndex >= 0)
        {
            worksheet.Column(lhaIndex + 1).Width = Math.Max(worksheet.Column(lhaIndex + 1).Width, 16);
        }

        return package.GetAsByteArray();
    }

    public static byte[] BuildDistinctCsvExport(
        IReadOnlyList<Dictionary<string, object?>> rows,
        IReadOnlyList<string> columns,
        IReadOnlyDictionary<string, string> columnLabels)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", columns.Select(column => FormatCsvValue(GetExportHeaderLabel(column, columnLabels)))));

        foreach (var row in rows)
        {
            var values = columns.Select(column =>
            {
                row.TryGetValue(column, out var rawValue);
                return FormatCsvValue(FormatDistinctAggregateItems(rawValue));
            });
            sb.AppendLine(string.Join(",", values));
        }

        return BuildUtf8BomBytes(sb.ToString());
    }

    public static byte[] BuildDistinctXlsxExport(
        IReadOnlyList<Dictionary<string, object?>> rows,
        IReadOnlyList<string> columns,
        string distinctColumn,
        string distinctTotalColumn,
        IReadOnlyDictionary<string, string> columnLabels)
    {
        using var package = new ExcelPackage();
        var worksheet = package.Workbook.Worksheets.Add("ListAuditDistinct");

        for (int col = 0; col < columns.Count; col++)
        {
            worksheet.Cells[1, col + 1].Value = GetExportHeaderLabel(columns[col], columnLabels);
            worksheet.Cells[1, col + 1].Style.Font.Bold = true;
        }

        for (int rowIndex = 0; rowIndex < rows.Count; rowIndex++)
        {
            var excelRow = rowIndex + 2;
            var row = rows[rowIndex];

            for (int col = 0; col < columns.Count; col++)
            {
                var columnKey = columns[col];
                row.TryGetValue(columnKey, out var rawValue);
                var excelCell = worksheet.Cells[excelRow, col + 1];

                if (string.Equals(columnKey, distinctTotalColumn, StringComparison.OrdinalIgnoreCase))
                {
                    excelCell.Value = rawValue;
                    continue;
                }

                if (string.Equals(columnKey, distinctColumn, StringComparison.OrdinalIgnoreCase))
                {
                    excelCell.Value = FormatDistinctDisplayValue(rawValue);
                    continue;
                }

                excelCell.Value = FormatDistinctAggregateItems(rawValue);
                excelCell.Style.WrapText = true;
            }
        }

        ApplyStandardExportWorksheetStyles(worksheet, columns.Count);
        TableExportHelper.ApplyAutoFitLayout(worksheet, columns.Count);
        return package.GetAsByteArray();
    }

    private static string GetExportHeaderLabel(string key, IReadOnlyDictionary<string, string> columnLabels) =>
        columnLabels.TryGetValue(key, out var label) ? label : key;

    private static object? GetExportCellValue(
        ListAudit row,
        string key,
        int sequenceNumber,
        bool forCsv,
        string? syntheticNumberColumn)
    {
        return key switch
        {
            var column when syntheticNumberColumn != null &&
                           string.Equals(column, syntheticNumberColumn, StringComparison.OrdinalIgnoreCase) => sequenceNumber,
            nameof(ListAudit.TAHUN) => NormalizeExportTextValue(row.TAHUN),
            nameof(ListAudit.NAMAAUDIT) => NormalizeExportTextValue(row.NAMAAUDIT),
            nameof(ListAudit.RINGKASANAUDIT) => NormalizeExportTextValue(row.RINGKASANAUDIT),
            nameof(ListAudit.PEMANTAUAN) => NormalizeExportTextValue(row.PEMANTAUAN),
            nameof(ListAudit.JENISAUDIT) => NormalizeExportTextValue(row.JENISAUDIT),
            nameof(ListAudit.SOURCE) => NormalizeExportTextValue(row.SOURCE),
            nameof(ListAudit.PICAUDIT) => NormalizeExportTextValue(row.PICAUDIT),
            nameof(ListAudit.DEPARTMENT) => NormalizeExportTextValue(row.DEPARTMENT),
            nameof(ListAudit.PICAPLIKASI) => NormalizeExportTextValue(row.PICAPLIKASI),
            nameof(ListAudit.IN) => row.IN,
            nameof(ListAudit.JATUHTEMPO) => row.JATUHTEMPO,
            nameof(ListAudit.LINK) => NormalizeExportTextValue(row.LINK),
            nameof(ListAudit.STATUS) => NormalizeExportTextValue(row.STATUS),
            nameof(ListAudit.KETERANGAN) => NormalizeExportTextValue(row.KETERANGAN),
            nameof(ListAudit.CreatedAt) => row.CreatedAt,
            nameof(ListAudit.UpdatedAt) => row.UpdatedAt,
            nameof(ListAudit.RHA) => forCsv ? (row.RHA != null && row.RHA.Length > 0 ? "Yes" : "No") : null,
            nameof(ListAudit.LHA) => forCsv ? (row.LHA != null && row.LHA.Length > 0 ? "Yes" : "No") : null,
            _ => null
        };
    }

    private static string FormatCsvValue(object? value)
    {
        if (value == null)
        {
            return string.Empty;
        }

        if (value is DateTime dt)
        {
            return dt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        }

        var text = value.ToString() ?? string.Empty;
        if (text.Contains('"'))
        {
            text = text.Replace("\"", "\"\"");
        }

        return text.IndexOfAny([',', '"', '\r', '\n']) >= 0
            ? $"\"{text}\""
            : text;
    }

    private static string FormatDistinctDisplayValue(object? value)
    {
        return value switch
        {
            null => "Belum Diisi",
            string stringValue => string.IsNullOrWhiteSpace(stringValue)
                ? "Belum Diisi"
                : NormalizeExportTextValue(stringValue) ?? string.Empty,
            DateTime dateTimeValue => dateTimeValue.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            DateTimeOffset dateTimeOffsetValue => dateTimeOffsetValue.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty
        };
    }

    private static string FormatDistinctAggregateItems(object? value)
    {
        if (value is not IEnumerable<AuditListDistinctExportValueItem> items)
        {
            return FormatDistinctDisplayValue(value);
        }

        var materialized = items.ToList();
        if (materialized.Count == 0)
        {
            return string.Empty;
        }

        return string.Join(
            "\n",
            materialized.Select(item =>
            {
                var label = FormatDistinctDisplayValue(item.Value);
                return item.Count > 1 ? $"{label} ({item.Count})" : label;
            }));
    }

    private static byte[] BuildUtf8BomBytes(string text)
    {
        var body = Encoding.UTF8.GetBytes(text);
        var bom = Encoding.UTF8.GetPreamble();
        var bytes = new byte[bom.Length + body.Length];
        Buffer.BlockCopy(bom, 0, bytes, 0, bom.Length);
        Buffer.BlockCopy(body, 0, bytes, bom.Length, body.Length);
        return bytes;
    }

    private static bool TryAddEvidenceImage(ExcelWorksheet worksheet, int rowIndex, int columnIndex, byte[]? imageBytes, string pictureName)
    {
        if (imageBytes == null || imageBytes.Length == 0)
        {
            return false;
        }

        try
        {
            using var stream = new MemoryStream(imageBytes);
            var picture = worksheet.Drawings.AddPicture(pictureName, stream);
            picture.SetPosition(rowIndex - 1, 2, columnIndex - 1, 2);
            picture.SetSize(96, 96);
            worksheet.Row(rowIndex).Height = Math.Max(worksheet.Row(rowIndex).Height, 72);
            worksheet.Column(columnIndex).Width = Math.Max(worksheet.Column(columnIndex).Width, 16);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void ApplyStandardExportWorksheetStyles(
        ExcelWorksheet worksheet,
        int totalColumns)
    {
        if (worksheet.Dimension == null || totalColumns <= 0)
        {
            return;
        }

        var headerRange = worksheet.Cells[1, 1, 1, totalColumns];
        headerRange.Style.Font.Bold = true;
        headerRange.Style.WrapText = true;
        headerRange.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
        headerRange.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
        headerRange.Style.Border.Top.Style = ExcelBorderStyle.Thin;
        headerRange.Style.Border.Left.Style = ExcelBorderStyle.Thin;
        headerRange.Style.Border.Right.Style = ExcelBorderStyle.Thin;
        headerRange.Style.Border.Bottom.Style = ExcelBorderStyle.Thin;

        if (worksheet.Dimension.End.Row < 2)
        {
            return;
        }

        var dataRange = worksheet.Cells[2, 1, worksheet.Dimension.End.Row, totalColumns];
        dataRange.Style.WrapText = true;
        dataRange.Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
        dataRange.Style.VerticalAlignment = ExcelVerticalAlignment.Top;
        dataRange.Style.Border.Top.Style = ExcelBorderStyle.Thin;
        dataRange.Style.Border.Left.Style = ExcelBorderStyle.Thin;
        dataRange.Style.Border.Right.Style = ExcelBorderStyle.Thin;
        dataRange.Style.Border.Bottom.Style = ExcelBorderStyle.Thin;
    }
}
