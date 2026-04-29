using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using PGH.Dtos.Procurement;
using PGH.Models.Procurement;
using WebApplication2.Data;

namespace PGH.Helpers
{
    public static class ProcurementExportHelper
    {
        private static readonly Dictionary<string, string> ExportColumnLabels =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["Source"] = "Source",
                ["project_id"] = "Project ID",
                ["Status_Pengadaan"] = "Status Pengadaan",
                ["Department"] = "Department",
                ["PIC"] = "PIC",
                ["Vendor"] = "Vendor",
                ["TipePengadaan"] = "Tipe Pengadaan",
                ["Perjanjian"] = "Perjanjian",
                ["NilaiPengajuanAPS"] = "Nilai Pengadaan (Pengajuan APS)",
                ["NilaiApproveSTA"] = "Nilai di Approve STA",
                ["NilaiKontrak"] = "Nilai Kontrak (PFA)",
                ["JenisAnggaran"] = "Jenis Anggaran",
                ["NoPKS"] = "No PKS",
                ["TglPKS"] = "Tgl PKS",
                ["NoSPK"] = "No SPK",
                ["TglSPK"] = "Tgl SPK",
                ["WaktuMulai"] = "Waktu Mulai",
                ["JatuhTempo"] = "Jatuh Tempo",
                ["PICPFA"] = "PIC PFA",
                ["TglKirimkePFA"] = "Tgl Kirim ke PFA",
                ["Keterangan"] = "Keterangan",
                ["SisaBulan"] = "Sisa Bulan",
                ["CreatedAt"] = "Created At",
                ["UpdatedAt"] = "Updated At"
            };
        private static readonly string[] StatusSheetColumns =
        [
            "Level",
            "Code",
            "Section",
            "Step",
            "Item",
            "Checklist",
            "Persetujuan",
            "Status",
            "Checkpoint"
        ];
        private static readonly Dictionary<string, string> StatusSheetColumnLabels =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["Level"] = "Level",
                ["Code"] = "Code",
                ["Section"] = "Section",
                ["Step"] = "Step",
                ["Item"] = "Item",
                ["Checklist"] = "Checklist",
                ["Persetujuan"] = "Persetujuan",
                ["Status"] = "Status",
                ["Checkpoint"] = "Checkpoint"
            };
        private static readonly Dictionary<string, double> StatusSheetColumnWidths =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["Level"] = 12,
                ["Code"] = 12,
                ["Section"] = 26,
                ["Step"] = 28,
                ["Item"] = 34,
                ["Checklist"] = 36,
                ["Persetujuan"] = 24,
                ["Status"] = 14,
                ["Checkpoint"] = 16
            };

        public static async Task<IActionResult> BuildExportResponseAsync<T>(
            ControllerBase controller,
            IQueryable<T> query,
            ProcurementExportRequest? request,
            IReadOnlyCollection<string> displayColumns,
            string filePrefix,
            AppDbContext db,
            CancellationToken cancellationToken = default)
        {
            request ??= new ProcurementExportRequest();

            var format = ResolveFormat(request.Format);
            if (format is not "csv" and not "xlsx")
            {
                return controller.BadRequest(new
                {
                    message = "Invalid format. Supported formats are xlsx and csv."
                });
            }

            var resolvedColumns = ResolveColumns(request.Columns, displayColumns);
            if ((request.Columns?.Count ?? 0) > 0 && resolvedColumns.Count == 0)
            {
                return controller.BadRequest(new
                {
                    message = "No valid export columns were provided.",
                    allowedColumns = displayColumns
                });
            }

            var sourceRows = await query.ToListAsync(cancellationToken);
            var exportRows = BuildExportRows(sourceRows, request, displayColumns);
            var timestamp = DateTime.Now.ToString("yyyy_MM_dd", CultureInfo.InvariantCulture);

            if (format == "csv")
            {
                var csvBytes = TableExportHelper.BuildCsvExport(
                    exportRows,
                    resolvedColumns,
                    ResolveColumnLabel);
                return controller.File(csvBytes, "text/csv", $"{filePrefix}_{timestamp}.csv");
            }

            var xlsxBytes = await BuildXlsxExportAsync(
                exportRows,
                resolvedColumns,
                filePrefix,
                db,
                request,
                cancellationToken);

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
            IReadOnlyCollection<string> displayColumns)
        {
            if (requestedColumns == null)
            {
                return [.. displayColumns];
            }

            return (requestedColumns ?? [])
                .Where(column => !string.IsNullOrWhiteSpace(column))
                .Select(column => column.Trim())
                .Where(column => displayColumns.Contains(column, StringComparer.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static List<object> BuildExportRows<T>(
            IReadOnlyList<T> sourceRows,
            ProcurementExportRequest? request,
            IReadOnlyCollection<string> displayColumns)
        {
            if (sourceRows.Count == 0)
            {
                return [];
            }

            var firstPageResponse = ProcurementListQueryHelper.Execute(
                sourceRows,
                BuildPagedQueryRequest(request, 1),
                displayColumns);

            var rows = new List<object>(firstPageResponse.Rows);
            for (var page = 2; page <= firstPageResponse.TotalPages; page += 1)
            {
                var pageResponse = ProcurementListQueryHelper.Execute(
                    sourceRows,
                    BuildPagedQueryRequest(request, page),
                    displayColumns);
                rows.AddRange(pageResponse.Rows);
            }

            return rows;
        }

        private static ProcurementListQueryRequest BuildPagedQueryRequest(
            ProcurementExportRequest? request,
            int page)
        {
            return new ProcurementListQueryRequest
            {
                Page = page,
                PageSize = ProcurementListQueryHelper.MaxPageSize,
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

        private static string ResolveColumnLabel(string column) =>
            ExportColumnLabels.TryGetValue(column, out var label)
                ? label
                : column;

        private static string ResolveStatusSheetColumnLabel(string column) =>
            StatusSheetColumnLabels.TryGetValue(column, out var label)
                ? label
                : column;

        private static async Task<byte[]> BuildXlsxExportAsync(
            IReadOnlyList<object> exportRows,
            IReadOnlyList<string> resolvedColumns,
            string filePrefix,
            AppDbContext db,
            ProcurementExportRequest? request,
            CancellationToken cancellationToken)
        {
            using var package = new ExcelPackage();
            var mainWorksheet = package.Workbook.Worksheets.Add(
                TableExportHelper.SanitizeWorksheetTitle(filePrefix));
            TableExportHelper.PopulateWorksheet(
                mainWorksheet,
                exportRows,
                resolvedColumns,
                ResolveColumnLabel);

            if (request?.Distinct?.Column == null)
            {
                await AppendStatusWorksheetAsync(package, exportRows, db, cancellationToken);
            }

            return package.GetAsByteArray();
        }

        private static async Task AppendStatusWorksheetAsync(
            ExcelPackage package,
            IReadOnlyList<object> exportRows,
            AppDbContext db,
            CancellationToken cancellationToken)
        {
            var items = (exportRows ?? [])
                .Select(row => new ProcurementExportItemSummary
                {
                    ProcurementItemId = ReadLongValue(row, "Id"),
                    ProjectId = ReadStringValue(row, "project_id"),
                    Perjanjian = ReadStringValue(row, "Perjanjian"),
                    Source = ReadStringValue(row, "Source"),
                    Department = ReadStringValue(row, "Department"),
                    PIC = ReadStringValue(row, "PIC"),
                    CurrentStatus = ReadStringValue(row, "Status_Pengadaan"),
                })
                .Where(item => item.ProcurementItemId > 0)
                .GroupBy(item => item.ProcurementItemId)
                .Select(group => group.First())
                .ToList();

            if (items.Count == 0)
            {
                return;
            }

            var templates = await db.StatusPengadaanTemplate
                .AsNoTracking()
                .Where(x => x.IsActive &&
                    (x.TemplateKey ?? StatusPengadaanStructureHelper.DefaultTemplateKey) ==
                    StatusPengadaanStructureHelper.DefaultTemplateKey)
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToListAsync(cancellationToken);

            if (templates.Count == 0)
            {
                return;
            }

            for (var index = 0; index < templates.Count; index += 1)
            {
                var template = templates[index];
                StatusPengadaanStructureHelper.NormalizeTemplateRow(template);
                template.SortOrder ??= (index + 1) * 10;
            }

            var actionableTemplateIds =
                StatusPengadaanStructureHelper.ResolveActionableTemplateIds(templates);
            var procurementIds = items.Select(item => item.ProcurementItemId).ToArray();
            var progressRows = await db.StatusPengadaan
                .AsNoTracking()
                .Where(x => x.ProcurementItemId.HasValue && procurementIds.Contains(x.ProcurementItemId.Value))
                .OrderBy(x => x.Id)
                .ToListAsync(cancellationToken);

            var progressRowsByProcurementId = progressRows
                .Where(row => row.ProcurementItemId.HasValue)
                .GroupBy(row => row.ProcurementItemId!.Value)
                .ToDictionary(group => group.Key, group => group.ToList());
            var statusWorksheet = package.Workbook.Worksheets.Add("Status Pengadaan");
            for (var columnIndex = 0; columnIndex < StatusSheetColumns.Length; columnIndex += 1)
            {
                var columnKey = StatusSheetColumns[columnIndex];
                statusWorksheet.Column(columnIndex + 1).Width =
                    StatusSheetColumnWidths.TryGetValue(columnKey, out var width)
                        ? width
                        : 18;
            }
            statusWorksheet.View.ShowGridLines = true;
            var cursorRowNumber = 1;

            foreach (var item in items)
            {
                progressRowsByProcurementId.TryGetValue(item.ProcurementItemId, out var itemProgressRows);
                itemProgressRows ??= [];

                var structuredRows = BuildStructuredStatusRows(
                    itemProgressRows,
                    templates,
                    actionableTemplateIds);
                var flattenedRows = CompactProcurementChecklistDisplayRows(
                    ConsolidateProcurementStatusGroups(
                        FlattenProcurementChecklist(structuredRows)));

                WriteStatusSheetTitleRow(statusWorksheet, cursorRowNumber, item);
                cursorRowNumber += 1;

                WriteStatusSheetMetaRow(statusWorksheet, cursorRowNumber, item);
                cursorRowNumber += 1;

                WriteStatusSheetHeaderRow(statusWorksheet, cursorRowNumber);
                cursorRowNumber += 1;

                if (flattenedRows.Count == 0)
                {
                    WriteStatusSheetEmptyStateRow(statusWorksheet, cursorRowNumber);
                    cursorRowNumber += 2;
                    continue;
                }

                foreach (var flattenedRow in flattenedRows)
                {
                    WriteStatusSheetDataRow(statusWorksheet, cursorRowNumber, flattenedRow);
                    cursorRowNumber += 1;
                }

                cursorRowNumber += 1;
            }
        }

        private static List<ProcurementStatusStructuredRow> BuildStructuredStatusRows(
            IReadOnlyList<StatusPengadaan> progressRows,
            IReadOnlyList<StatusPengadaanTemplate> templates,
            ISet<long> actionableTemplateIds)
        {
            var progressRowsByTemplateId = (progressRows ?? [])
                .Where(row => row.TemplateNodeId.HasValue)
                .GroupBy(row => row.TemplateNodeId!.Value)
                .ToDictionary(group => group.Key, group => group.First());

            return templates
                .Select(template =>
                {
                    progressRowsByTemplateId.TryGetValue(template.Id, out var linkedRow);
                    var isActionable = actionableTemplateIds.Contains(template.Id);

                    return new ProcurementStatusStructuredRow
                    {
                        TemplateNodeId = template.Id,
                        ParentTemplateId = template.ParentTemplateId,
                        NodeType = template.NodeType,
                        Code = template.Code,
                        Title = template.Title,
                        Persetujuan = linkedRow?.Persetujuan ?? template.Persetujuan,
                        Status = isActionable
                            ? (string.IsNullOrWhiteSpace(linkedRow?.Status) ? "Not Yet" : linkedRow!.Status)
                            : null,
                        SortOrder = template.SortOrder,
                        IsActionable = isActionable,
                    };
                })
                .OrderBy(row => row.SortOrder ?? int.MaxValue)
                .ThenBy(row => row.TemplateNodeId)
                .ToList();
        }

        private static List<ProcurementStatusDisplayRow> FlattenProcurementChecklist(
            IReadOnlyList<ProcurementStatusStructuredRow> rows)
        {
            var sortedRows = (rows ?? [])
                .OrderBy(row => row.SortOrder ?? int.MaxValue)
                .ThenBy(row => row.TemplateNodeId)
                .ToList();

            var latestDoneTemplateId = sortedRows
                .Where(row => row.IsActionable)
                .Reverse<ProcurementStatusStructuredRow>()
                .FirstOrDefault(row =>
                    string.Equals(row.Status?.Trim(), "done", StringComparison.OrdinalIgnoreCase))
                ?.TemplateNodeId;

            var currentSection = string.Empty;
            var currentStep = string.Empty;
            var currentItem = string.Empty;
            var currentItemRawTitle = string.Empty;
            var checklistIndex = 0;
            var flattened = new List<ProcurementStatusDisplayRow>();
            var itemParentIdsWithPoints = sortedRows
                .Where(row =>
                    string.Equals(
                        StatusPengadaanStructureHelper.NormalizeNodeType(row.NodeType),
                        StatusPengadaanStructureHelper.NodePoint,
                        StringComparison.OrdinalIgnoreCase) &&
                    row.ParentTemplateId.HasValue)
                .Select(row => row.ParentTemplateId!.Value)
                .ToHashSet();
            var stepParentIdsWithItems = sortedRows
                .Where(row =>
                    string.Equals(
                        StatusPengadaanStructureHelper.NormalizeNodeType(row.NodeType),
                        StatusPengadaanStructureHelper.NodeItem,
                        StringComparison.OrdinalIgnoreCase) &&
                    row.ParentTemplateId.HasValue)
                .Select(row => row.ParentTemplateId!.Value)
                .ToHashSet();

            foreach (var row in sortedRows)
            {
                var nodeType = StatusPengadaanStructureHelper.NormalizeNodeType(row.NodeType);
                var title = (row.Title ?? string.Empty).Trim();
                var approval = (row.Persetujuan ?? string.Empty).Trim();
                var status = string.IsNullOrWhiteSpace(row.Status) ? "Not Yet" : row.Status!.Trim();
                var code = (row.Code ?? string.Empty).Trim();
                var isCheckpoint = latestDoneTemplateId == row.TemplateNodeId ? "Aktif" : string.Empty;

                if (nodeType == StatusPengadaanStructureHelper.NodeSection)
                {
                    currentSection = string.IsNullOrWhiteSpace(code)
                        ? (title.Length > 0 ? title : "Section")
                        : $"{code}. {(title.Length > 0 ? title : "Section")}";
                    currentStep = string.Empty;
                    currentItem = string.Empty;
                    currentItemRawTitle = string.Empty;
                    checklistIndex = 0;
                    flattened.Add(new ProcurementStatusDisplayRow
                    {
                        Level = "Section",
                        Code = code,
                        Section = currentSection,
                    });
                    continue;
                }

                if (nodeType == StatusPengadaanStructureHelper.NodeStep)
                {
                    currentStep = string.IsNullOrWhiteSpace(code)
                        ? (title.Length > 0 ? title : "Step")
                        : $"{code}. {(title.Length > 0 ? title : "Step")}";
                    currentItem = string.Empty;
                    currentItemRawTitle = string.Empty;
                    checklistIndex = 0;
                    var isLeafStep = row.IsActionable && !stepParentIdsWithItems.Contains(row.TemplateNodeId);
                    flattened.Add(new ProcurementStatusDisplayRow
                    {
                        Level = "Step",
                        Code = code,
                        Section = currentSection,
                        Step = currentStep,
                        Persetujuan = isLeafStep ? approval : string.Empty,
                        Status = isLeafStep ? status : string.Empty,
                        Checkpoint = isLeafStep ? isCheckpoint : string.Empty,
                    });
                    continue;
                }

                if (!(row.IsActionable || nodeType == StatusPengadaanStructureHelper.NodeItem || nodeType == StatusPengadaanStructureHelper.NodePoint))
                {
                    continue;
                }

                if (nodeType == StatusPengadaanStructureHelper.NodeItem)
                {
                    currentItemRawTitle = title.Length > 0 ? title : "Item";
                    currentItem = string.IsNullOrWhiteSpace(code)
                        ? currentItemRawTitle
                        : $"{code}. {currentItemRawTitle}";
                    checklistIndex = 0;
                    var isLeafItem = row.IsActionable && !itemParentIdsWithPoints.Contains(row.TemplateNodeId);
                    flattened.Add(new ProcurementStatusDisplayRow
                    {
                        Level = "Item",
                        Code = code,
                        Section = currentSection,
                        Step = currentStep,
                        Item = currentItem,
                        Persetujuan = isLeafItem ? approval : string.Empty,
                        Status = isLeafItem ? status : string.Empty,
                        Checkpoint = isLeafItem ? isCheckpoint : string.Empty,
                    });
                    continue;
                }

                checklistIndex += 1;
                var checklistTitle = title.Length > 0 ? title : "Point";
                var normalizedChecklistTitle = checklistTitle.ToLowerInvariant();
                var belongsToIzinPrinsipThresholdGroup =
                    string.Equals(
                        currentItemRawTitle.Trim(),
                        "penyampaian izin prinsip",
                        StringComparison.OrdinalIgnoreCase) &&
                    (normalizedChecklistTitle == "oleh user penyusul < rp 3m" ||
                        normalizedChecklistTitle == "oleh user penyusul > rp 3m");

                flattened.Add(new ProcurementStatusDisplayRow
                {
                    Level = "Point",
                    Code = code,
                    Section = currentSection,
                    Step = currentStep,
                    Item = currentItem,
                    Checklist = $"{checklistIndex}. {checklistTitle}",
                    Persetujuan = approval,
                    Status = status,
                    Checkpoint = isCheckpoint,
                    StatusGroupKey = belongsToIzinPrinsipThresholdGroup
                        ? "penyampaian-izin-prinsip-threshold"
                        : string.Empty,
                });
            }

            return flattened;
        }

        private static List<ProcurementStatusDisplayRow> ConsolidateProcurementStatusGroups(
            IReadOnlyList<ProcurementStatusDisplayRow> entries)
        {
            var normalizedEntries = (entries ?? [])
                .Select(entry => entry.Clone())
                .ToList();
            var groupedIndexes = new Dictionary<string, List<int>>(StringComparer.Ordinal);

            for (var index = 0; index < normalizedEntries.Count; index += 1)
            {
                var groupKey = (normalizedEntries[index].StatusGroupKey ?? string.Empty).Trim();
                if (groupKey.Length == 0)
                {
                    continue;
                }

                if (!groupedIndexes.TryGetValue(groupKey, out var indexes))
                {
                    indexes = new List<int>();
                    groupedIndexes[groupKey] = indexes;
                }

                indexes.Add(index);
            }

            foreach (var indexes in groupedIndexes.Values)
            {
                if (indexes.Count <= 1)
                {
                    continue;
                }

                var rows = indexes.Select(index => normalizedEntries[index]).ToList();
                var combinedStatus = rows.Any(row =>
                        string.Equals(row.Status?.Trim(), "done", StringComparison.OrdinalIgnoreCase))
                    ? "Done"
                    : rows.FirstOrDefault(row => !string.IsNullOrWhiteSpace(row.Status))?.Status ?? "Not Yet";
                var combinedCheckpoint = rows.Any(row =>
                        string.Equals(row.Checkpoint?.Trim(), "aktif", StringComparison.OrdinalIgnoreCase))
                    ? "Aktif"
                    : string.Empty;
                var anchorItem = (rows[0].Item ?? string.Empty).Trim();
                var itemSummaryIndex = -1;

                if (anchorItem.Length > 0)
                {
                    for (var index = indexes[0] - 1; index >= 0; index -= 1)
                    {
                        var entry = normalizedEntries[index];
                        if (string.Equals(entry.Level?.Trim(), "item", StringComparison.OrdinalIgnoreCase) &&
                            string.Equals(entry.Item?.Trim(), anchorItem, StringComparison.Ordinal))
                        {
                            itemSummaryIndex = index;
                            break;
                        }
                    }
                }

                if (itemSummaryIndex >= 0)
                {
                    normalizedEntries[itemSummaryIndex].Status = combinedStatus;
                    normalizedEntries[itemSummaryIndex].Checkpoint = combinedCheckpoint;
                    foreach (var index in indexes)
                    {
                        normalizedEntries[index].Status = string.Empty;
                        normalizedEntries[index].Checkpoint = string.Empty;
                    }
                    continue;
                }

                normalizedEntries[indexes[0]].Status = combinedStatus;
                normalizedEntries[indexes[0]].Checkpoint = combinedCheckpoint;
                foreach (var index in indexes.Skip(1))
                {
                    normalizedEntries[index].Status = string.Empty;
                    normalizedEntries[index].Checkpoint = string.Empty;
                }
            }

            return normalizedEntries;
        }

        private static List<ProcurementStatusDisplayRow> CompactProcurementChecklistDisplayRows(
            IReadOnlyList<ProcurementStatusDisplayRow> entries)
        {
            var previousSection = string.Empty;
            var previousStep = string.Empty;
            var previousItem = string.Empty;
            var compactedRows = new List<ProcurementStatusDisplayRow>();

            foreach (var entry in entries ?? [])
            {
                var nextEntry = entry.Clone();
                var section = (nextEntry.Section ?? string.Empty).Trim();
                var step = (nextEntry.Step ?? string.Empty).Trim();
                var item = (nextEntry.Item ?? string.Empty).Trim();

                if (section.Length > 0 && string.Equals(section, previousSection, StringComparison.Ordinal))
                {
                    nextEntry.Section = string.Empty;
                }
                else if (section.Length > 0)
                {
                    previousSection = section;
                    previousStep = string.Empty;
                    previousItem = string.Empty;
                }

                if (step.Length > 0 && string.Equals(step, previousStep, StringComparison.Ordinal))
                {
                    nextEntry.Step = string.Empty;
                }
                else if (step.Length > 0)
                {
                    previousStep = step;
                    previousItem = string.Empty;
                }

                if (item.Length > 0 && string.Equals(item, previousItem, StringComparison.Ordinal))
                {
                    nextEntry.Item = string.Empty;
                }
                else if (item.Length > 0)
                {
                    previousItem = item;
                }

                compactedRows.Add(nextEntry);
            }

            return compactedRows;
        }

        private static void WriteStatusSheetTitleRow(
            ExcelWorksheet worksheet,
            int rowNumber,
            ProcurementExportItemSummary item)
        {
            worksheet.Cells[rowNumber, 1, rowNumber, StatusSheetColumns.Length].Merge = true;
            var titleCell = worksheet.Cells[rowNumber, 1];
            var normalizedProjectId =
                string.IsNullOrWhiteSpace(item.ProjectId)
                    ? "-"
                    : TableExportHelper.FormatSpreadsheetValue(item.ProjectId);
            var normalizedPerjanjian =
                TableExportHelper.FormatSpreadsheetValue(item.Perjanjian);
            var procurementTitle =
                normalizedPerjanjian.Length > 0
                    ? normalizedPerjanjian
                    : (normalizedProjectId != "-" ? normalizedProjectId : $"Procurement {item.ProcurementItemId}");
            var titleText = $"{normalizedProjectId} | {procurementTitle}";

            titleCell.Value = titleText;
            titleCell.Style.Font.Bold = true;
            titleCell.Style.Font.Size = 13;
            titleCell.Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(248, 250, 252));
            titleCell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
            titleCell.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
            titleCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
            titleCell.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(36, 54, 74));
            ApplyRangeBorder(worksheet.Cells[rowNumber, 1, rowNumber, StatusSheetColumns.Length], "FF24364A", ExcelBorderStyle.Thin);
            worksheet.Row(rowNumber).Height = 24;
        }

        private static void WriteStatusSheetMetaRow(
            ExcelWorksheet worksheet,
            int rowNumber,
            ProcurementExportItemSummary item)
        {
            worksheet.Cells[rowNumber, 1, rowNumber, StatusSheetColumns.Length].Merge = true;
            var metaCell = worksheet.Cells[rowNumber, 1];
            metaCell.Value = string.Join("   |   ", new[]
            {
                $"Source: {(string.IsNullOrWhiteSpace(item.Source) ? "-" : item.Source)}",
                $"Department: {(string.IsNullOrWhiteSpace(item.Department) ? "-" : item.Department)}",
                $"PIC: {(string.IsNullOrWhiteSpace(item.PIC) ? "-" : item.PIC)}",
                $"Status Pengadaan: {(string.IsNullOrWhiteSpace(item.CurrentStatus) ? "-" : item.CurrentStatus)}",
            });
            metaCell.Style.Font.Italic = true;
            metaCell.Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(71, 85, 105));
            metaCell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
            metaCell.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
            metaCell.Style.WrapText = true;
            metaCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
            metaCell.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(248, 250, 252));
            ApplyRangeBorder(worksheet.Cells[rowNumber, 1, rowNumber, StatusSheetColumns.Length], "FFE2E8F0", ExcelBorderStyle.Thin);
        }

        private static void WriteStatusSheetHeaderRow(ExcelWorksheet worksheet, int rowNumber)
        {
            for (var index = 0; index < StatusSheetColumns.Length; index += 1)
            {
                worksheet.Cells[rowNumber, index + 1].Value =
                    ResolveStatusSheetColumnLabel(StatusSheetColumns[index]);
            }

            var range = worksheet.Cells[rowNumber, 1, rowNumber, StatusSheetColumns.Length];
            range.Style.Font.Bold = true;
            range.Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(31, 41, 55));
            range.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
            range.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
            range.Style.WrapText = true;
            range.Style.Fill.PatternType = ExcelFillStyle.Solid;
            range.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(246, 231, 216));
            ApplyRangeBorder(range, "FFD1D5DB", ExcelBorderStyle.Thin);
            worksheet.Row(rowNumber).Height = 22;
        }

        private static void WriteStatusSheetEmptyStateRow(ExcelWorksheet worksheet, int rowNumber)
        {
            worksheet.Cells[rowNumber, 1, rowNumber, StatusSheetColumns.Length].Merge = true;
            var emptyCell = worksheet.Cells[rowNumber, 1];
            emptyCell.Value = "Checklist belum tersedia untuk procurement ini.";
            emptyCell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
            emptyCell.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
            emptyCell.Style.WrapText = true;
            ApplyRangeBorder(worksheet.Cells[rowNumber, 1, rowNumber, StatusSheetColumns.Length], "FFE5E7EB", ExcelBorderStyle.Thin);
        }

        private static void WriteStatusSheetDataRow(
            ExcelWorksheet worksheet,
            int rowNumber,
            ProcurementStatusDisplayRow entry)
        {
            var values = new[]
            {
                entry.Level,
                entry.Code,
                entry.Section,
                entry.Step,
                entry.Item,
                entry.Checklist,
                entry.Persetujuan,
                entry.Status,
                entry.Checkpoint
            };

            for (var index = 0; index < values.Length; index += 1)
            {
                var cell = worksheet.Cells[rowNumber, index + 1];
                cell.Value = TableExportHelper.FormatSpreadsheetValue(values[index]);
                cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
                cell.Style.VerticalAlignment = ExcelVerticalAlignment.Top;
                cell.Style.WrapText = true;
            }

            var rowRange = worksheet.Cells[rowNumber, 1, rowNumber, StatusSheetColumns.Length];
            ApplyRangeBorder(rowRange, "FFE5E7EB", ExcelBorderStyle.Thin);

            var level = (entry.Level ?? string.Empty).Trim().ToLowerInvariant();
            var isSectionHeader = level == "section";
            var isStepHeader = level == "step";
            var isItemHeader = level == "item" && string.IsNullOrWhiteSpace(entry.Status);
            var isDone = string.Equals(entry.Status?.Trim(), "done", StringComparison.OrdinalIgnoreCase);
            var isCheckpoint = string.Equals(entry.Checkpoint?.Trim(), "aktif", StringComparison.OrdinalIgnoreCase);
            var statusCell = worksheet.Cells[rowNumber, 8];
            var checkpointCell = worksheet.Cells[rowNumber, 9];

            if (isSectionHeader)
            {
                rowRange.Style.Font.Bold = true;
                rowRange.Style.Font.Size = 12;
                rowRange.Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(124, 45, 18));
                rowRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                rowRange.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(255, 237, 213));
                ApplyRangeBorder(rowRange, "FFF59E0B", ExcelBorderStyle.Medium, "FFFCD34D");
                worksheet.Row(rowNumber).Height = 24;
                return;
            }

            if (isStepHeader)
            {
                rowRange.Style.Font.Bold = true;
                rowRange.Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(36, 54, 74));
                rowRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                rowRange.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(250, 245, 239));
            }

            if (isItemHeader)
            {
                rowRange.Style.Font.Bold = true;
                rowRange.Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(36, 54, 74));
                rowRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                rowRange.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(248, 250, 252));
                return;
            }

            statusCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
            statusCell.Style.Fill.BackgroundColor.SetColor(
                isDone
                    ? System.Drawing.Color.FromArgb(232, 247, 237)
                    : System.Drawing.Color.FromArgb(255, 241, 232));
            statusCell.Style.Font.Bold = true;
            statusCell.Style.Font.Color.SetColor(
                isDone
                    ? System.Drawing.Color.FromArgb(31, 143, 77)
                    : System.Drawing.Color.FromArgb(184, 91, 0));

            if (isCheckpoint)
            {
                rowRange.Style.Font.Bold = true;
                checkpointCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                checkpointCell.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(253, 230, 138));
            }
        }

        private static void ApplyRangeBorder(
            ExcelRange range,
            string argb,
            ExcelBorderStyle edgeStyle,
            string? sideArgb = null)
        {
            range.Style.Border.Top.Style = edgeStyle;
            range.Style.Border.Top.Color.SetColor(System.Drawing.ColorTranslator.FromHtml($"#{argb[2..]}"));
            range.Style.Border.Bottom.Style = edgeStyle;
            range.Style.Border.Bottom.Color.SetColor(System.Drawing.ColorTranslator.FromHtml($"#{argb[2..]}"));

            var sideColorArgb = sideArgb ?? argb;
            range.Style.Border.Left.Style = ExcelBorderStyle.Thin;
            range.Style.Border.Left.Color.SetColor(System.Drawing.ColorTranslator.FromHtml($"#{sideColorArgb[2..]}"));
            range.Style.Border.Right.Style = ExcelBorderStyle.Thin;
            range.Style.Border.Right.Color.SetColor(System.Drawing.ColorTranslator.FromHtml($"#{sideColorArgb[2..]}"));
        }

        private static long ReadLongValue(object row, string propertyName)
        {
            var rawValue = ReadValue(row, propertyName);
            if (rawValue == null)
            {
                return 0;
            }

            return long.TryParse(
                Convert.ToString(rawValue, CultureInfo.InvariantCulture),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var parsed)
                ? parsed
                : 0;
        }

        private static string ReadStringValue(object row, string propertyName)
        {
            return TableExportHelper.FormatSpreadsheetValue(ReadValue(row, propertyName));
        }

        private static object? ReadValue(object row, string propertyName)
        {
            if (row is IDictionary<string, object?> typedDictionary &&
                typedDictionary.TryGetValue(propertyName, out var typedValue))
            {
                return typedValue;
            }

            if (row is IDictionary<string, object> dictionary &&
                dictionary.TryGetValue(propertyName, out var value))
            {
                return value;
            }

            var property = row.GetType().GetProperty(
                propertyName,
                System.Reflection.BindingFlags.Public |
                System.Reflection.BindingFlags.Instance |
                System.Reflection.BindingFlags.IgnoreCase);

            return property?.GetValue(row);
        }

        private sealed class ProcurementExportItemSummary
        {
            public long ProcurementItemId { get; init; }
            public string ProjectId { get; init; } = string.Empty;
            public string Perjanjian { get; init; } = string.Empty;
            public string Source { get; init; } = string.Empty;
            public string Department { get; init; } = string.Empty;
            public string PIC { get; init; } = string.Empty;
            public string CurrentStatus { get; init; } = string.Empty;
        }

        private sealed class ProcurementStatusStructuredRow
        {
            public long TemplateNodeId { get; init; }
            public long? ParentTemplateId { get; init; }
            public string? NodeType { get; init; }
            public string? Code { get; init; }
            public string? Title { get; init; }
            public string? Persetujuan { get; init; }
            public string? Status { get; init; }
            public int? SortOrder { get; init; }
            public bool IsActionable { get; init; }
        }

        private sealed class ProcurementStatusDisplayRow
        {
            public string? Level { get; set; }
            public string? Code { get; set; }
            public string? Section { get; set; }
            public string? Step { get; set; }
            public string? Item { get; set; }
            public string? Checklist { get; set; }
            public string? Persetujuan { get; set; }
            public string? Status { get; set; }
            public string? Checkpoint { get; set; }
            public string? StatusGroupKey { get; set; }

            public ProcurementStatusDisplayRow Clone() => new()
            {
                Level = Level,
                Code = Code,
                Section = Section,
                Step = Step,
                Item = Item,
                Checklist = Checklist,
                Persetujuan = Persetujuan,
                Status = Status,
                Checkpoint = Checkpoint,
                StatusGroupKey = StatusGroupKey,
            };
        }
    }
}
