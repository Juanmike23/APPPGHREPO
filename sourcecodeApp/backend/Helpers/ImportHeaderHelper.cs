/*
 * PGH-DOC
 * File: Helpers/ImportHeaderHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menangani parsing row staging import, deteksi header row, dan pemisahan header/data rows.
 * Kenapa perlu:
 * - Perlu agar alur header detection import tetap konsisten lintas target tanpa mengulang logika di controller besar.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using PGH.Models.ImportTable;
using System.Text.Json;

namespace PGH.Helpers;

public static class ImportHeaderHelper
{
    private const int DefaultMaxAutoDetectHeaderScanRows = 12;

    public static List<string> DeserializeRowValues(ImportData row) =>
        JsonSerializer.Deserialize<List<string>>(row.Data ?? "[]") ?? [];

    public static int ResolveHeaderRowIndex(
        string target,
        IReadOnlyList<ImportData> rows,
        Func<string, IReadOnlyList<string>> expectedColumnsResolver,
        Func<string, string, string> headerNormalizer,
        int? requestedHeaderRowNumber = null,
        int maxAutoDetectHeaderScanRows = DefaultMaxAutoDetectHeaderScanRows)
    {
        if (rows.Count == 0)
        {
            return 0;
        }

        if (requestedHeaderRowNumber.HasValue)
        {
            var requestedIndex = requestedHeaderRowNumber.Value - 1;
            if (requestedIndex >= 0 && requestedIndex < rows.Count)
            {
                return requestedIndex;
            }
        }

        var expectedColumns = expectedColumnsResolver(target);
        if (expectedColumns.Count == 0)
        {
            return 0;
        }

        var bestIndex = 0;
        var bestScore = -1;
        var scanLimit = Math.Min(rows.Count, Math.Max(1, maxAutoDetectHeaderScanRows));

        for (var rowIndex = 0; rowIndex < scanLimit; rowIndex++)
        {
            var values = DeserializeRowValues(rows[rowIndex]);
            if (values.Count == 0)
            {
                continue;
            }

            var normalizedHeaders = values
                .Select((value, columnIndex) =>
                    string.IsNullOrWhiteSpace(value)
                        ? $"__EMPTY_{columnIndex}__"
                        : headerNormalizer(target, value))
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .ToList();

            if (normalizedHeaders.Count == 0)
            {
                continue;
            }

            var matchedColumns = normalizedHeaders
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count(column => expectedColumns.Contains(column, StringComparer.OrdinalIgnoreCase));

            if (matchedColumns <= 0)
            {
                continue;
            }

            var score = (matchedColumns * 100) + normalizedHeaders.Count;
            if (score > bestScore)
            {
                bestScore = score;
                bestIndex = rowIndex;
            }
        }

        return bestScore > 0 ? bestIndex : 0;
    }

    public static (int HeaderRowIndex, List<string> Headers, List<ImportData> DataRows) ResolveHeadersAndDataRows(
        string target,
        List<ImportData> rows,
        Func<string, IReadOnlyList<string>> expectedColumnsResolver,
        Func<string, string, string> headerNormalizer,
        int? requestedHeaderRowNumber = null,
        int maxAutoDetectHeaderScanRows = DefaultMaxAutoDetectHeaderScanRows)
    {
        if (rows.Count == 0)
        {
            return (0, [], []);
        }

        var headerRowIndex = ResolveHeaderRowIndex(
            target,
            rows,
            expectedColumnsResolver,
            headerNormalizer,
            requestedHeaderRowNumber,
            maxAutoDetectHeaderScanRows);
        var headers = DeserializeRowValues(rows[headerRowIndex]);

        for (var i = 0; i < headers.Count; i++)
        {
            if (string.IsNullOrWhiteSpace(headers[i]))
            {
                headers[i] = $"__EMPTY_{i}__";
            }
        }

        var dataRows = rows.Skip(headerRowIndex + 1).ToList();
        return (headerRowIndex, headers, dataRows);
    }
}
