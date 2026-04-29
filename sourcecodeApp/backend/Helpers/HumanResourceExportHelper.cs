using System.Collections;
using System.Globalization;
using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using PGH.Dtos.Human;

namespace PGH.Helpers
{
    public static class HumanResourceExportHelper
    {
        public static async Task<IActionResult> BuildExportResponseAsync<T>(
            ControllerBase controller,
            IQueryable<T> query,
            HumanResourceExportRequest? request,
            HumanResourceQuerySchema schema,
            string filePrefix,
            CancellationToken cancellationToken = default)
        {
            request ??= new HumanResourceExportRequest();

            var format = ResolveFormat(request.Format);
            if (format is not "csv" and not "xlsx")
            {
                return controller.BadRequest(new
                {
                    message = "Invalid format. Supported formats are xlsx and csv."
                });
            }

            var resolvedColumns = ResolveColumns(request.Columns, schema);
            if ((request.Columns?.Count ?? 0) > 0 && resolvedColumns.Count == 0)
            {
                return controller.BadRequest(new
                {
                    message = "No valid export columns were provided.",
                    allowedColumns = schema.DisplayColumns
                });
            }

            var sourceRows = await query.ToListAsync(cancellationToken);
            var exportRows = BuildExportRows(sourceRows, request, schema);
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture);

            if (format == "csv")
            {
                var csvBytes = TableExportHelper.BuildCsvExport(
                    exportRows,
                    resolvedColumns,
                    schema.ResolveLabel);
                return controller.File(csvBytes, "text/csv", $"{filePrefix}_{timestamp}.csv");
            }

            var xlsxBytes = TableExportHelper.BuildXlsxExport(
                exportRows,
                resolvedColumns,
                schema.ResolveLabel,
                filePrefix);
            return controller.File(
                xlsxBytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"{filePrefix}_{timestamp}.xlsx");
        }

        private static string ResolveFormat(string? rawFormat) =>
            string.IsNullOrWhiteSpace(rawFormat)
                ? "xlsx"
                : rawFormat.Trim().ToLowerInvariant();

        private static List<string> ResolveColumns(
            IEnumerable<string>? requestedColumns,
            HumanResourceQuerySchema schema)
        {
            if (requestedColumns == null)
            {
                return [.. schema.DisplayColumns];
            }

            var validColumns = (requestedColumns ?? [])
                .Where(column => !string.IsNullOrWhiteSpace(column))
                .Select(column => column.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return validColumns;
        }

        private static List<object> BuildExportRows<T>(
            IReadOnlyList<T> sourceRows,
            HumanResourceExportRequest? request,
            HumanResourceQuerySchema schema)
        {
            if (sourceRows.Count == 0)
            {
                return [];
            }

            var firstPageResponse = HumanResourceQueryHelper.Execute(
                sourceRows,
                BuildPagedQueryRequest(request, 1),
                schema);

            var rows = firstPageResponse.Rows
                .Select(NormalizeExportRow)
                .ToList();

            for (var page = 2; page <= firstPageResponse.TotalPages; page += 1)
            {
                var pageResponse = HumanResourceQueryHelper.Execute(
                    sourceRows,
                    BuildPagedQueryRequest(request, page),
                    schema);

                rows.AddRange(pageResponse.Rows.Select(NormalizeExportRow));
            }

            return rows;
        }

        private static HumanResourceQueryRequest BuildPagedQueryRequest(
            HumanResourceExportRequest? request,
            int page)
        {
            return new HumanResourceQueryRequest
            {
                Page = page,
                PageSize = HumanResourceQueryHelper.MaxPageSize,
                FocusId = null,
                Filters = request?.Filters ?? [],
                Mode = request?.Mode,
                Sort = request?.Sort,
                Distinct = request?.Distinct,
                Search = request?.Search,
                SearchColumns = request?.SearchColumns,
                PriorityTopNullColumn = request?.PriorityTopNullColumn,
                PriorityBottomIds = request?.PriorityBottomIds ?? []
            };
        }

        private static object NormalizeExportRow(object row)
        {
            if (row is IDictionary<string, object?> typedDictionary)
            {
                return new Dictionary<string, object?>(typedDictionary, StringComparer.OrdinalIgnoreCase);
            }

            if (row is IDictionary<string, object> dictionary)
            {
                var normalizedDictionary = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                foreach (var entry in dictionary)
                {
                    normalizedDictionary[entry.Key] = entry.Value;
                }
                return normalizedDictionary;
            }

            var normalized = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            var rowType = row.GetType();

            foreach (var property in rowType.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                normalized[property.Name] = property.GetValue(row);
            }

            MergeExtraData(row, normalized);
            return normalized;
        }

        private static void MergeExtraData(object row, Dictionary<string, object?> target)
        {
            var extraDataProperty = row.GetType().GetProperty(
                "ExtraData",
                BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);

            if (extraDataProperty == null)
            {
                return;
            }

            var rawExtraData = extraDataProperty.GetValue(row);
            if (rawExtraData == null)
            {
                return;
            }

            if (rawExtraData is IDictionary<string, object?> typedDictionary)
            {
                foreach (var entry in typedDictionary)
                {
                    target[entry.Key] = entry.Value;
                }
                return;
            }

            if (rawExtraData is IDictionary<string, object> dictionary)
            {
                foreach (var entry in dictionary)
                {
                    target[entry.Key] = entry.Value;
                }
                return;
            }

            if (rawExtraData is string json && !string.IsNullOrWhiteSpace(json))
            {
                try
                {
                    var parsed = JsonConvert.DeserializeObject<Dictionary<string, object?>>(json);
                    if (parsed == null)
                    {
                        return;
                    }

                    foreach (var entry in parsed)
                    {
                        target[entry.Key] = entry.Value;
                    }
                }
                catch
                {
                    // Ignore malformed ExtraData and keep the export moving.
                }
                return;
            }

            if (rawExtraData is IEnumerable enumerable && rawExtraData is not string)
            {
                var index = 0;
                foreach (var value in enumerable)
                {
                    target[$"ExtraData_{index}"] = value;
                    index += 1;
                }
            }
        }
    }
}
