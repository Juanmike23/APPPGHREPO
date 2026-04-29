using System.Collections;
using System.Reflection;
using System.Text;
using OfficeOpenXml;
using OfficeOpenXml.Style;

namespace PGH.Helpers
{
    public static class TableExportHelper
    {
        public static byte[] BuildCsvExport(
            IReadOnlyList<object> rows,
            IReadOnlyList<string> columns,
            Func<string, string>? headerResolver = null)
        {
            var sb = new StringBuilder();
            sb.AppendLine(string.Join(",", columns.Select(column => FormatCsvValue(ResolveHeader(column, headerResolver)))));

            foreach (var row in rows)
            {
                var values = columns
                    .Select(column => FormatCsvValue(FormatExportValue(ReadValue(row, column))))
                    .ToArray();

                sb.AppendLine(string.Join(",", values));
            }

            return Encoding.UTF8.GetBytes(sb.ToString());
        }

        public static byte[] BuildXlsxExport(
            IReadOnlyList<object> rows,
            IReadOnlyList<string> columns,
            Func<string, string>? headerResolver = null,
            string worksheetName = "Export")
        {
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add(SanitizeWorksheetName(worksheetName));
            PopulateWorksheet(worksheet, rows, columns, headerResolver);

            return package.GetAsByteArray();
        }

        public static void PopulateWorksheet(
            ExcelWorksheet worksheet,
            IReadOnlyList<object> rows,
            IReadOnlyList<string> columns,
            Func<string, string>? headerResolver = null)
        {
            ArgumentNullException.ThrowIfNull(worksheet);

            for (var columnIndex = 0; columnIndex < columns.Count; columnIndex += 1)
            {
                var cell = worksheet.Cells[1, columnIndex + 1];
                cell.Value = ResolveHeader(columns[columnIndex], headerResolver);
                cell.Style.Font.Bold = true;
                cell.Style.WrapText = true;
                cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                cell.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
                cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                cell.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(241, 245, 249));
                cell.Style.Border.Top.Style = ExcelBorderStyle.Thin;
                cell.Style.Border.Left.Style = ExcelBorderStyle.Thin;
                cell.Style.Border.Right.Style = ExcelBorderStyle.Thin;
                cell.Style.Border.Bottom.Style = ExcelBorderStyle.Thin;
            }

            for (var rowIndex = 0; rowIndex < rows.Count; rowIndex += 1)
            {
                for (var columnIndex = 0; columnIndex < columns.Count; columnIndex += 1)
                {
                    var value = FormatExportValue(ReadValue(rows[rowIndex], columns[columnIndex]));
                    var cell = worksheet.Cells[rowIndex + 2, columnIndex + 1];
                    cell.Value = value;
                    cell.Style.WrapText = true;
                    cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
                    cell.Style.VerticalAlignment = ExcelVerticalAlignment.Top;
                    cell.Style.Border.Top.Style = ExcelBorderStyle.Thin;
                    cell.Style.Border.Left.Style = ExcelBorderStyle.Thin;
                    cell.Style.Border.Right.Style = ExcelBorderStyle.Thin;
                    cell.Style.Border.Bottom.Style = ExcelBorderStyle.Thin;
                }
            }

            ApplyAutoFitLayout(worksheet, columns.Count);
        }

        public static string FormatSpreadsheetValue(object? value) => FormatExportValue(value);

        public static string SanitizeWorksheetTitle(string value) => SanitizeWorksheetName(value);

        public static void ApplyAutoFitLayout(
            ExcelWorksheet worksheet,
            int totalColumns,
            int headerRowNumber = 1,
            int freezePaneRow = 2,
            int maxColumnWidth = 60)
        {
            ArgumentNullException.ThrowIfNull(worksheet);

            if (worksheet.Dimension == null || totalColumns <= 0)
            {
                return;
            }

            worksheet.Cells[worksheet.Dimension.Address].AutoFitColumns();

            for (var columnIndex = 1; columnIndex <= totalColumns; columnIndex += 1)
            {
                if (worksheet.Column(columnIndex).Width > maxColumnWidth)
                {
                    worksheet.Column(columnIndex).Width = maxColumnWidth;
                }
            }

            ApplyEstimatedRowHeights(
                worksheet,
                headerRowNumber,
                worksheet.Dimension.End.Row,
                totalColumns,
                headerRowNumber);

            if (freezePaneRow > 1)
            {
                worksheet.View.FreezePanes(freezePaneRow, 1);
            }

            worksheet.Cells[headerRowNumber, 1, headerRowNumber, totalColumns].AutoFilter = true;
        }

        public static void ApplyEstimatedRowHeights(
            ExcelWorksheet worksheet,
            int startRow,
            int endRow,
            int totalColumns,
            int headerRowNumber = 1)
        {
            ArgumentNullException.ThrowIfNull(worksheet);

            if (worksheet.Dimension == null || totalColumns <= 0 || endRow < startRow)
            {
                return;
            }

            for (var rowIndex = startRow; rowIndex <= endRow; rowIndex += 1)
            {
                var isHeaderRow = rowIndex == headerRowNumber;
                var targetHeight = EstimateRowHeight(worksheet, rowIndex, totalColumns, isHeaderRow);
                var row = worksheet.Row(rowIndex);
                var currentHeight = row.Height > 0 ? row.Height : 0;

                row.CustomHeight = true;
                row.Height = Math.Max(currentHeight, targetHeight);
            }
        }

        private static string ResolveHeader(string column, Func<string, string>? headerResolver) =>
            headerResolver?.Invoke(column) ?? column;

        private static double EstimateRowHeight(
            ExcelWorksheet worksheet,
            int rowIndex,
            int totalColumns,
            bool isHeaderRow)
        {
            var baseHeight = isHeaderRow ? 22d : 18d;
            var heightPerLine = isHeaderRow ? 18d : 15d;
            var maxHeight = isHeaderRow ? 72d : 120d;
            var maxLineCount = 1;

            for (var columnIndex = 1; columnIndex <= totalColumns; columnIndex += 1)
            {
                var text = Convert.ToString(worksheet.Cells[rowIndex, columnIndex].Value) ?? string.Empty;
                if (string.IsNullOrWhiteSpace(text))
                {
                    continue;
                }

                var columnWidth = Math.Max(worksheet.Column(columnIndex).Width, 8d);
                var estimatedLineCount = EstimateWrappedLineCount(text, columnWidth);
                if (estimatedLineCount > maxLineCount)
                {
                    maxLineCount = estimatedLineCount;
                }
            }

            return Math.Min(maxHeight, Math.Max(baseHeight, maxLineCount * heightPerLine));
        }

        private static int EstimateWrappedLineCount(string text, double columnWidth)
        {
            var normalized = text
                .Replace("\r\n", "\n", StringComparison.Ordinal)
                .Replace('\r', '\n');
            var segments = normalized.Split('\n');
            var estimatedCharsPerLine = Math.Max(8, (int)Math.Floor(columnWidth * 1.15));
            var totalLines = 0;

            foreach (var segment in segments)
            {
                var segmentLength = Math.Max(1, segment.Length);
                totalLines += Math.Max(1, (int)Math.Ceiling(segmentLength / (double)estimatedCharsPerLine));
            }

            return Math.Max(1, totalLines);
        }

        private static object? ReadValue(object row, string column)
        {
            if (row is IDictionary<string, object?> typedDictionary &&
                typedDictionary.TryGetValue(column, out var typedValue))
            {
                return typedValue;
            }

            if (row is IDictionary<string, object> dictionary &&
                dictionary.TryGetValue(column, out var value))
            {
                return value;
            }

            var property = row.GetType().GetProperty(
                column,
                BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);

            return property?.GetValue(row);
        }

        private static string FormatExportValue(object? value)
        {
            if (value == null)
            {
                return string.Empty;
            }

            if (value is string text)
            {
                return SanitizeSpreadsheetText(text);
            }

            if (value is DateTime dateTime)
            {
                return dateTime.ToString("yyyy-MM-dd HH:mm:ss");
            }

            if (TryFormatCountValue(value, out var countedValue))
            {
                return countedValue;
            }

            if (value is IEnumerable enumerable and not byte[])
            {
                var items = new List<string>();
                foreach (var item in enumerable)
                {
                    var formattedItem = FormatExportValue(item);
                    if (!string.IsNullOrWhiteSpace(formattedItem))
                    {
                        items.Add(formattedItem);
                    }
                }

                return string.Join(Environment.NewLine, items.Distinct(StringComparer.OrdinalIgnoreCase));
            }

            return SanitizeSpreadsheetText(value.ToString() ?? string.Empty);
        }

        private static string SanitizeSpreadsheetText(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            var builder = new StringBuilder(value.Length);
            foreach (var rune in value.EnumerateRunes())
            {
                var codePoint = rune.Value;
                var isAllowed =
                    codePoint == 0x09 ||
                    codePoint == 0x0A ||
                    codePoint == 0x0D ||
                    (codePoint >= 0x20 && codePoint <= 0xD7FF) ||
                    (codePoint >= 0xE000 && codePoint <= 0xFFFD) ||
                    (codePoint >= 0x10000 && codePoint <= 0x10FFFF);

                if (isAllowed)
                {
                    builder.Append(rune.ToString());
                }
            }

            return builder.ToString();
        }

        private static bool TryFormatCountValue(object value, out string formatted)
        {
            formatted = string.Empty;
            var valueType = value.GetType();
            var valueProperty = valueType.GetProperty("Value", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (valueProperty == null)
            {
                return false;
            }

            var countProperty = valueType.GetProperty("Count", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            var rawValue = valueProperty.GetValue(value);
            var displayValue = rawValue == null || string.IsNullOrWhiteSpace(rawValue.ToString())
                ? "Belum Diisi"
                : rawValue.ToString();

            if (countProperty == null)
            {
                formatted = displayValue ?? string.Empty;
                return true;
            }

            var rawCount = countProperty.GetValue(value);
            if (rawCount == null || !int.TryParse(rawCount.ToString(), out var count) || count <= 1)
            {
                formatted = displayValue ?? string.Empty;
                return true;
            }

            formatted = $"{displayValue} ({count})";
            return true;
        }

        private static string FormatCsvValue(string value)
        {
            var normalized = value.Replace("\"", "\"\"");
            return $"\"{normalized}\"";
        }

        private static string SanitizeWorksheetName(string value)
        {
            var invalidChars = Path.GetInvalidFileNameChars().Concat(['[', ']', '*', '?', '/', '\\']).ToHashSet();
            var sanitized = new string(value.Where(ch => !invalidChars.Contains(ch)).ToArray()).Trim();
            if (string.IsNullOrWhiteSpace(sanitized))
            {
                return "Export";
            }

            return sanitized.Length > 31 ? sanitized[..31] : sanitized;
        }
    }
}
