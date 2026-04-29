/*
 * PGH-DOC
 * File: src/Variables/Table/TableToolBarElement/ExportTable.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useMemo, useState } from "react";
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  FormGroup,
  Label,
  Input,
  ModalFooter,
  Button,
  ModalBody,
  ModalHeader,
  Modal,
} from "@pgh/ui-bootstrap";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import { normalizeSearchText } from "../filters/search";
import {
  getListAuditCanonicalColumn,
} from "../../../Components/Audit/Utils/columnHelpers";
import {
  PROCUREMENT_DEFAULT_PAGE_SIZE,
  PROCUREMENT_SEARCH_SCOPE_ALL,
  buildProcurementServerQueryPayload,
} from "../../../Components/Procurement/APS/serverQuery";
import {
  HUMAN_RESOURCE_DEFAULT_PAGE_SIZE,
  HUMAN_RESOURCE_SEARCH_SCOPE_ALL,
  buildHumanResourceServerQueryPayload,
} from "../../../Components/Human/Resource/serverQuery";
import {
  buildOpexHeaderRows,
} from "../../utils/opexSchema";
import {
  resolveTableTransferProfile,
} from "../tableTargetProfiles";
import "./ExportTable.css";

const EXCLUDED_COLUMNS = ["Id", "Action", "__isTotalRow"];
const MAX_CELL_LENGTH = 32760;
const DEFAULT_VIEW_KEY = "default";
const SEARCH_SCOPE_ALL = "__all__";
const LIST_AUDIT_BUSINESS_COLUMNS = [
  "NO",
  "TAHUN",
  "NAMAAUDIT",
  "RINGKASANAUDIT",
  "PEMANTAUAN",
  "JENISAUDIT",
  "SOURCE",
  "PICAUDIT",
  "DEPARTMENT",
  "PICAPLIKASI",
  "IN",
  "JATUHTEMPO",
  "LINK",
  "STATUS",
  "KETERANGAN",
];
const LIST_AUDIT_SYSTEM_COLUMNS = [
  "CreatedAt",
  "UpdatedAt",
  "RHA",
  "LHA",
];
const LIST_AUDIT_EXPORT_BASE_COLUMNS = [
  ...LIST_AUDIT_BUSINESS_COLUMNS,
  ...LIST_AUDIT_SYSTEM_COLUMNS,
];
const LIST_AUDIT_FILTERABLE_COLUMNS = new Set(
  LIST_AUDIT_BUSINESS_COLUMNS.filter((column) => column !== "NO").map((column) =>
    column.toUpperCase(),
  ),
);
const LIST_AUDIT_SEARCHABLE_COLUMNS = new Set([
  "TAHUN",
  "NAMAAUDIT",
  "RINGKASANAUDIT",
  "PEMANTAUAN",
  "JENISAUDIT",
  "SOURCE",
  "PICAUDIT",
  "DEPARTMENT",
  "PICAPLIKASI",
  "LINK",
  "STATUS",
  "KETERANGAN",
]);
const LIST_AUDIT_SUPPORTED_OPERATORS = new Set([
  "contains",
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
]);
const LIST_AUDIT_EXPORT_SORTABLE_COLUMNS = new Set([
  ...LIST_AUDIT_BUSINESS_COLUMNS.filter((column) => column !== "NO"),
  "CreatedAt",
  "UpdatedAt",
]);
const PROCUREMENT_STATUS_SHEET_COLUMNS = [
  { header: "Level", key: "Level", width: 12 },
  { header: "Code", key: "Code", width: 12 },
  { header: "Section", key: "Section", width: 26 },
  { header: "Step", key: "Step", width: 28 },
  { header: "Item", key: "Item", width: 34 },
  { header: "Checklist", key: "Checklist", width: 36 },
  { header: "Persetujuan", key: "Persetujuan", width: 24 },
  { header: "Status", key: "Status", width: 14 },
  { header: "Checkpoint", key: "Checkpoint", width: 16 },
];
let excelJsModulePromise;
const loadExcelJs = async () => {
  if (!excelJsModulePromise) {
    excelJsModulePromise = import("exceljs").then(
      (module) => module.default ?? module,
    );
  }
  return excelJsModulePromise;
};

let pdfBundlePromise;
const loadPdfBundle = async () => {
  if (!pdfBundlePromise) {
    pdfBundlePromise = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]).then(([jspdfModule, autoTableModule]) => ({
      jsPDFConstructor:
        jspdfModule.jsPDF ?? jspdfModule.default ?? jspdfModule,
      autoTableFn:
        autoTableModule.default ??
        autoTableModule.autoTable ??
        autoTableModule,
    }));
  }

  return pdfBundlePromise;
};

const canonicalizeListAuditColumn = (value) => {
  return getListAuditCanonicalColumn(value);
};

const normalizeAuditType = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) return null;
  if (normalized === "internal") return "internal";
  if (normalized === "external" || normalized === "eksternal") return "external";
  if (normalized === "all") return "all";

  return null;
};

const sanitizeExportBaseName = (value) => {
  const normalized = String(value ?? "")
    .replace(/[/\\?%*:|"<>]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

  return normalized || "Export";
};

const resolveExportBaseName = ({ rawName, transferProfile }) => {
  if (transferProfile?.id === "listaudit") {
    return "AuditList";
  }

  if (transferProfile?.id === "weeklytable") {
    return "WeeklyTable";
  }

  if (transferProfile?.id === "procurement") {
    return "ProcurementList";
  }

  return sanitizeExportBaseName(rawName || "Export");
};

const formatExportTimestamp = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part) => String(part).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("_");
};

const buildExportFileName = (baseName, extension, exportedAt = new Date()) =>
  `${sanitizeExportBaseName(baseName)}_${formatExportTimestamp(exportedAt)}.${String(extension ?? "").trim().toLowerCase()}`;

const sanitizeSpreadsheetText = (value) => {
  const text = String(value ?? "");
  let sanitized = "";

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint == null) continue;

    const isAllowed =
      codePoint === 0x09 ||
      codePoint === 0x0a ||
      codePoint === 0x0d ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);

    if (isAllowed) {
      sanitized += char;
    }
  }

  return sanitized;
};

const readErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.clone().json();
    if (payload?.message) return payload.message;
  } catch {
    // ignore non-json response
  }

  try {
    const text = (await response.text()).trim();
    if (text) return text;
  } catch {
    // ignore text parsing failure
  }

  return fallback;
};

const normalizeCellValue = (value) => {
  if (value == null) return "";

  if (Array.isArray(value)) {
    return sanitizeSpreadsheetText(
      value
      .map((item) => {
        if (item && typeof item === "object") {
          return item.value ?? JSON.stringify(item);
        }
        return String(item ?? "");
      })
      .join(", "),
    );
  }

  if (typeof value === "object") {
    if ("value" in value && value.value != null) {
      return sanitizeSpreadsheetText(String(value.value));
    }

    try {
      return sanitizeSpreadsheetText(JSON.stringify(value));
    } catch {
      return sanitizeSpreadsheetText(String(value));
    }
  }

  return sanitizeSpreadsheetText(String(value));
};

const humanizeExportColumnLabel = (value) =>
  String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getTextLineMaxLength = (value) =>
  String(value ?? "")
    .split(/\r?\n/)
    .reduce((maxLength, line) => Math.max(maxLength, line.length), 0);

const normalizeProcurementNodeType = (value) =>
  String(value ?? "").trim().toLowerCase();

const resolveProcurementRowType = (row, endpointName) => {
  const source = String(row?.Source ?? "").trim().toLowerCase();
  if (source === "existing" || source === "existingprocure" || source === "exs") {
    return "existingprocure";
  }

  if (source === "new" || source === "newprocure") {
    return "newprocure";
  }

  return String(endpointName ?? "").trim().toLowerCase() === "existingprocure"
    ? "existingprocure"
    : "newprocure";
};

const resolveProcurementCheckpointRowId = (rows) => {
  const actionableRows = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.IsActionable)
    .sort(
      (left, right) =>
        (left?.SortOrder ?? Number.MAX_SAFE_INTEGER) -
          (right?.SortOrder ?? Number.MAX_SAFE_INTEGER) ||
        Number(left?.Id ?? 0) - Number(right?.Id ?? 0),
    );

  const latestDone = actionableRows
    .slice()
    .reverse()
    .find((row) => String(row?.Status ?? "").trim().toLowerCase() === "done");

  return latestDone?.Id ?? null;
};

const flattenProcurementChecklist = (rows) => {
  const sortedRows = (Array.isArray(rows) ? rows : [])
    .slice()
    .sort(
      (left, right) =>
        (left?.SortOrder ?? Number.MAX_SAFE_INTEGER) -
          (right?.SortOrder ?? Number.MAX_SAFE_INTEGER) ||
        Number(left?.Id ?? 0) - Number(right?.Id ?? 0),
    );

  let currentSection = "";
  let currentStep = "";
  let currentItem = "";
  let currentItemRawTitle = "";
  let checklistIndex = 0;
  const checkpointRowId = resolveProcurementCheckpointRowId(sortedRows);
  const flattened = [];
  const itemParentIdsWithPoints = new Set(
    sortedRows
      .filter(
        (row) =>
          normalizeProcurementNodeType(row?.NodeType) === "point" &&
          row?.ParentTemplateId != null,
      )
      .map((row) => row.ParentTemplateId),
  );
  const stepParentIdsWithItems = new Set(
    sortedRows
      .filter(
        (row) =>
          normalizeProcurementNodeType(row?.NodeType) === "item" &&
          row?.ParentTemplateId != null,
      )
      .map((row) => row.ParentTemplateId),
  );

  sortedRows.forEach((row) => {
    const nodeType = normalizeProcurementNodeType(row?.NodeType);
    const title = String(row?.Title ?? row?.AlurPengadaanIT ?? "").trim();
    const approval = String(row?.Persetujuan ?? "").trim();
    const status = String(row?.Status ?? "").trim() || "Not Yet";
    const code = String(row?.Code ?? "").trim();
    const isCheckpoint = checkpointRowId === row?.Id ? "Aktif" : "";

    if (nodeType === "section") {
      currentSection = code ? `${code}. ${title || "Section"}` : title || "Section";
      currentStep = "";
      currentItem = "";
      currentItemRawTitle = "";
      checklistIndex = 0;
      flattened.push({
        Level: "Section",
        Code: code,
        Section: currentSection,
        Step: "",
        Item: "",
        Checklist: "",
        Persetujuan: "",
        Status: "",
        Checkpoint: "",
      });
      return;
    }

    if (nodeType === "step") {
      currentStep = code ? `${code}. ${title || "Step"}` : title || "Step";
      currentItem = "";
      currentItemRawTitle = "";
      checklistIndex = 0;
      const isLeafStep = row?.IsActionable && !stepParentIdsWithItems.has(row?.TemplateNodeId);
      flattened.push({
        Level: "Step",
        Code: code,
        Section: currentSection,
        Step: currentStep,
        Item: "",
        Checklist: "",
        Persetujuan: isLeafStep ? approval : "",
        Status: isLeafStep ? status : "",
        Checkpoint: isLeafStep ? isCheckpoint : "",
      });

      return;
    }

    if (!(row?.IsActionable || nodeType === "item" || nodeType === "point")) {
      return;
    }

    if (nodeType === "item") {
      currentItemRawTitle = title || "Item";
      currentItem = code
        ? `${code}. ${currentItemRawTitle}`
        : currentItemRawTitle;
      checklistIndex = 0;
      const isLeafItem = row?.IsActionable && !itemParentIdsWithPoints.has(row?.TemplateNodeId);

      flattened.push({
        Level: "Item",
        Code: code,
        Section: currentSection,
        Step: currentStep,
        Item: currentItem,
        Checklist: "",
        Persetujuan: isLeafItem ? approval : "",
        Status: isLeafItem ? status : "",
        Checkpoint: isLeafItem ? isCheckpoint : "",
      });
      return;
    }

    checklistIndex += 1;
    const checklistTitle = title || "Point";
    const normalizedChecklistTitle = checklistTitle.toLowerCase();
    const belongsToIzinPrinsipThresholdGroup =
      currentItemRawTitle.toLowerCase() === "penyampaian izin prinsip" &&
      (normalizedChecklistTitle === "oleh user penyusul < rp 3m" ||
        normalizedChecklistTitle === "oleh user penyusul > rp 3m");

    flattened.push({
      Level: "Point",
      Code: code,
      Section: currentSection,
      Step: currentStep,
      Item: currentItem,
      Checklist: `${checklistIndex}. ${checklistTitle}`,
      Persetujuan: approval,
      Status: status,
      Checkpoint: isCheckpoint,
      StatusGroupKey: belongsToIzinPrinsipThresholdGroup
        ? "penyampaian-izin-prinsip-threshold"
        : "",
    });
  });

  return flattened;
};

const consolidateProcurementStatusGroups = (entries) => {
  const normalizedEntries = (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
  }));
  const groupedIndexes = new Map();

  normalizedEntries.forEach((entry, index) => {
    const groupKey = String(entry.StatusGroupKey ?? "").trim();
    if (!groupKey) {
      return;
    }

    if (!groupedIndexes.has(groupKey)) {
      groupedIndexes.set(groupKey, []);
    }

    groupedIndexes.get(groupKey).push(index);
  });

  groupedIndexes.forEach((indexes) => {
    if (!Array.isArray(indexes) || indexes.length <= 1) {
      return;
    }

    const rows = indexes.map((index) => normalizedEntries[index]);
    const combinedStatus = rows.some(
      (row) => String(row.Status ?? "").trim().toLowerCase() === "done",
    )
      ? "Done"
      : rows.find((row) => String(row.Status ?? "").trim())?.Status || "Not Yet";
    const combinedCheckpoint = rows.some(
      (row) => String(row.Checkpoint ?? "").trim().toLowerCase() === "aktif",
    )
      ? "Aktif"
      : "";
    const anchorItem = String(rows[0]?.Item ?? "").trim();
    const itemSummaryIndex =
      anchorItem
        ? normalizedEntries
            .slice(0, indexes[0])
            .findLastIndex(
              (entry) =>
                String(entry.Level ?? "").trim().toLowerCase() === "item" &&
                String(entry.Item ?? "").trim() === anchorItem,
            )
        : -1;

    if (itemSummaryIndex >= 0) {
      normalizedEntries[itemSummaryIndex].Status = combinedStatus;
      normalizedEntries[itemSummaryIndex].Checkpoint = combinedCheckpoint;
      indexes.forEach((index) => {
        normalizedEntries[index].Status = "";
        normalizedEntries[index].Checkpoint = "";
      });
      return;
    }

    normalizedEntries[indexes[0]].Status = combinedStatus;
    normalizedEntries[indexes[0]].Checkpoint = combinedCheckpoint;

    indexes.slice(1).forEach((index) => {
      normalizedEntries[index].Status = "";
      normalizedEntries[index].Checkpoint = "";
    });
  });

  return normalizedEntries;
};

const compactProcurementChecklistDisplayRows = (entries) => {
  let previousSection = "";
  let previousStep = "";
  let previousItem = "";

  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const nextEntry = { ...entry };
    const section = String(nextEntry.Section ?? "").trim();
    const step = String(nextEntry.Step ?? "").trim();
    const item = String(nextEntry.Item ?? "").trim();

    if (section && section === previousSection) {
      nextEntry.Section = "";
    } else {
      previousSection = section;
      previousStep = "";
      previousItem = "";
    }

    if (step && step === previousStep) {
      nextEntry.Step = "";
    } else if (step) {
      previousStep = step;
      previousItem = "";
    }

    if (item && item === previousItem) {
      nextEntry.Item = "";
    } else if (item) {
      previousItem = item;
    }

    return nextEntry;
  });
};

const applyStandardWorksheetStyles = (worksheet, columnCount, options = {}) => {
  const normalizedColumnCount = Math.max(1, Number(columnCount) || 1);
  const headerRowsRaw = Number(options?.headerRows ?? 1);
  const headerRows =
    Number.isFinite(headerRowsRaw) && headerRowsRaw > 0
      ? Math.floor(headerRowsRaw)
      : 1;
  const dataStartRowRaw = Number(options?.dataStartRow ?? headerRows + 1);
  const dataStartRow =
    Number.isFinite(dataStartRowRaw) && dataStartRowRaw > headerRows
      ? Math.floor(dataStartRowRaw)
      : headerRows + 1;
  const autoFilterRowRaw = Number(options?.autoFilterRow ?? headerRows);
  const autoFilterRow =
    Number.isFinite(autoFilterRowRaw) && autoFilterRowRaw >= 1
      ? Math.floor(autoFilterRowRaw)
      : headerRows;
  const freezeRowsRaw = Number(options?.freezeRows ?? headerRows);
  const freezeRows =
    Number.isFinite(freezeRowsRaw) && freezeRowsRaw >= 1
      ? Math.floor(freezeRowsRaw)
      : headerRows;
  const enableAutoFilter = options?.enableAutoFilter !== false;
  const groupHeaderRows = new Set(
    Array.isArray(options?.groupHeaderRows)
      ? options.groupHeaderRows
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 1)
          .map((value) => Math.floor(value))
      : [],
  );

  for (let rowNumber = 1; rowNumber <= headerRows; rowNumber += 1) {
    const headerRowRef = worksheet.getRow(rowNumber);
    headerRowRef.height = 24;
    const fillColor = groupHeaderRows.has(rowNumber) ? "FFEEF2F7" : "FFF6E7D8";

    headerRowRef.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: "FF1F2937" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillColor },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
    });
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < dataStartRow) return;
    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  worksheet.views = [{ state: "frozen", ySplit: freezeRows }];
  if (enableAutoFilter) {
    worksheet.autoFilter = {
      from: { row: autoFilterRow, column: 1 },
      to: { row: autoFilterRow, column: normalizedColumnCount },
    };
  }
};

const applyProcurementStatusSheetHeaderStyles = (row) => {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FF1F2937" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF6E7D8" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
};

const buildSourceColumnLabelMap = (sourceColumns, sourceColumnLabels) => {
  const map = {};
  (Array.isArray(sourceColumns) ? sourceColumns : []).forEach((column, index) => {
    if (!column) return;
    map[column] = sourceColumnLabels?.[index] || column;
  });
  return map;
};

const applyOpexExcelGroupedHeader = ({
  worksheet,
  sourceColumns,
  columnLabelMap,
}) => {
  if (!worksheet) return false;

  const headerRows = buildOpexHeaderRows(sourceColumns, columnLabelMap);
  if (!headerRows) return false;

  headerRows.topRowCells.forEach((cell) => {
    if (cell?.rowSpan) {
      const columnIndex = sourceColumns.indexOf(cell.column) + 1;
      if (columnIndex <= 0) return;
      worksheet.mergeCells(1, columnIndex, 2, columnIndex);
      worksheet.getCell(1, columnIndex).value = cell.label;
      return;
    }

    const columnIndexes = (Array.isArray(cell?.columns) ? cell.columns : [])
      .map((column) => sourceColumns.indexOf(column) + 1)
      .filter((columnIndex) => columnIndex > 0);

    if (!columnIndexes.length) return;

    const fromColumn = Math.min(...columnIndexes);
    const toColumn = Math.max(...columnIndexes);
    worksheet.mergeCells(1, fromColumn, 1, toColumn);
    worksheet.getCell(1, fromColumn).value = cell.label;
  });

  headerRows.secondRowCells.forEach((cell) => {
    const columnIndex = sourceColumns.indexOf(cell.column) + 1;
    if (columnIndex <= 0) return;
    worksheet.getCell(2, columnIndex).value = cell.label;
  });

  return true;
};

const summarizeUnsupportedReasons = (reasons) =>
  reasons
    .map((reason) => {
      if (reason === "search bar aktif") {
        return "Search bar masih aktif";
      }

      if (reason === "distinct mode aktif") {
        return "Distinct aktif";
      }

      if (reason.startsWith("distinct mode aktif pada ")) {
        return `Distinct aktif pada ${reason.replace("distinct mode aktif pada ", "")}`;
      }

      if (reason === "sort aktif") {
        return "Sort aktif";
      }

      if (reason.startsWith("sort aktif pada ")) {
        return `Sort aktif pada ${reason.replace("sort aktif pada ", "")}`;
      }

      if (reason.startsWith('operator "')) {
        return reason.replace('operator "', "Operator ").replace('" pada', " pada");
      }

      if (reason === "mode filter tidak didukung") {
        return "Mode filter tidak didukung";
      }

      return reason;
    })
    .join("; ");

const buildListAuditExportDetail = ({
  hasSearch,
  hasFilters,
  hasDistinct,
}) => {
  if (hasDistinct && hasSearch && hasFilters) {
    return "Hasil export mengikuti mode Distinct, Search toolbar, dan Filter Table yang aktif.";
  }

  if (hasDistinct && hasSearch) {
    return "Hasil export mengikuti mode Distinct dan Search toolbar yang aktif.";
  }

  if (hasDistinct && hasFilters) {
    return "Hasil export mengikuti mode Distinct dan Filter Table yang aktif.";
  }

  if (hasDistinct) {
    return "Hasil export mengikuti mode Distinct yang aktif.";
  }

  if (hasSearch && hasFilters) {
    return "Hasil export mengikuti Search toolbar + Filter Table (Filters + Visible Columns) yang aktif.";
  }

  if (hasSearch) {
    return "Hasil export mengikuti Search toolbar + Visible Columns yang aktif.";
  }

  return "Hasil export mengikuti Filter Table (Filters + Visible Columns) yang aktif.";
};

const ExportDropdown = ({
  data,
  fileName,
  exportColumns,
  headerMap = null,
  apiUrl = "",
  endpointName = "",
  filters = null,
  searchTerm = "",
  searchScope = SEARCH_SCOPE_ALL,
}) => {
  const [open, setOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [templateModal, setTemplateModal] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [headerRow, setHeaderRow] = useState(1);

  const toggle = () => setOpen((prev) => !prev);
  const transferProfile = useMemo(
    () =>
      resolveTableTransferProfile({
        endpointName,
        apiUrl,
        checkApiUrl: true,
      }),
    [apiUrl, endpointName],
  );
  const isOfficialBackendExport =
    transferProfile.exportStrategy === "official-backend";
  const isListAuditExport =
    isOfficialBackendExport && transferProfile.id === "listaudit";
  const isWeeklyOfficialExport =
    isOfficialBackendExport && transferProfile.id === "weeklytable";
  const isProcurementOfficialExport =
    isOfficialBackendExport && transferProfile.id === "procurement";
  const isHumanOfficialExport =
    isOfficialBackendExport && transferProfile.id === "human-resource";
  const isOpexOfficialExport =
    isOfficialBackendExport && transferProfile.id === "opex";
  const officialExportFormats = Array.isArray(transferProfile?.exportFormats)
    ? transferProfile.exportFormats
    : ["csv", "xlsx"];
  const isProcurementExport = transferProfile.domain === "procurement";
  const isHumanResourceExport = transferProfile.domain === "human";
  const isOpexExport = transferProfile.domain === "planning-opex";
  const exportBaseName = useMemo(
    () =>
      resolveExportBaseName({
        rawName: fileName || "Export",
        transferProfile,
      }),
    [fileName, transferProfile],
  );

  const allColumns = useMemo(
    () =>
      Array.isArray(exportColumns)
        ? exportColumns.filter((column) => !EXCLUDED_COLUMNS.includes(column))
        : [],
    [exportColumns],
  );

  const listAuditExportColumns = useMemo(
    () =>
      Array.from(
        new Set(
          allColumns.filter(
            (column) =>
              column && !EXCLUDED_COLUMNS.includes(String(column).trim()),
          ),
        ),
      ),
    [allColumns],
  );

  const sourceColumns = isListAuditExport ? listAuditExportColumns : allColumns;
  const sourceColumnLabels = useMemo(
    () =>
      sourceColumns.map((column) => {
        const rawKey = String(column ?? "").trim();
        if (!rawKey) return "";

        const headerCandidates = [
          rawKey,
          rawKey.toLowerCase(),
          rawKey.toUpperCase(),
        ];

        for (const candidate of headerCandidates) {
          const mappedLabel = headerMap?.[candidate];
          if (mappedLabel) {
            return String(mappedLabel).trim();
          }
        }

        return humanizeExportColumnLabel(rawKey);
      }),
    [headerMap, sourceColumns],
  );
  const dataStartRow = headerRow + 1;

  if (!data || data.length === 0) return null;

  const getOfficialListAuditExportMeta = () => {
    const filterItems = Array.isArray(filters?.filters) ? filters.filters : [];
    const reasons = [];
    let derivedType = "all";
    const duplicatedColumns = new Set();
    const seenColumns = new Set();
    const normalizedSearch = normalizeSearchText(searchTerm);
    const visibleColumns = Array.from(
      new Set(
        sourceColumns
          .map((column) => canonicalizeListAuditColumn(column))
          .filter(Boolean),
      ),
    );
    const structuredFilters = {};
    const advancedFilters = [];
    const postFilters = [];
    const selectedColumns = Array.from(
      new Set(
        sourceColumns
          .map((column) => canonicalizeListAuditColumn(column))
          .filter(Boolean),
      ),
    );
    const filterMode = String(filters?.mode ?? "and").toLowerCase();
    const sortColumn = canonicalizeListAuditColumn(filters?.sort?.column);
    const sortDirection = String(filters?.sort?.direction || "asc").toLowerCase();
    const normalizedSort =
      sortColumn && LIST_AUDIT_EXPORT_SORTABLE_COLUMNS.has(sortColumn)
        ? {
            Column: sortColumn,
            Direction: sortDirection === "desc" ? "desc" : "asc",
          }
        : null;
    const distinctColumn = canonicalizeListAuditColumn(filters?.distinct?.column);
    const distinct = distinctColumn ? { Column: distinctColumn } : null;

    if (!["and", "or"].includes(filterMode)) {
      reasons.push("mode filter tidak didukung");
    }

    if (filters?.sort?.column) {
      if (!normalizedSort) {
        reasons.push(
          sortColumn
            ? `sort aktif pada ${sortColumn} (${sortDirection})`
            : "sort aktif",
        );
      }
    }

    filterItems.forEach((filter) => {
      const key = String(filter?.column ?? "").trim();
      const operator = String(filter?.operator ?? "=").trim();
      const value = filter?.value;

      if (!key) return;
      if (value === undefined || value === null || value === "") return;

      const canonicalKey = canonicalizeListAuditColumn(key);
      const normalizedKey = canonicalKey?.toUpperCase() || key.toUpperCase();

      if (seenColumns.has(normalizedKey)) {
        duplicatedColumns.add(key);
      } else {
        seenColumns.add(normalizedKey);
      }

      if (normalizedKey === "JENISAUDIT") {
        const nextType = normalizeAuditType(value);
        if (nextType) {
          derivedType = nextType;
        } else {
          reasons.push(`nilai jenis audit "${value}" tidak didukung`);
        }
        return;
      }

      if (!canonicalKey || !LIST_AUDIT_FILTERABLE_COLUMNS.has(normalizedKey)) {
        reasons.push(`kolom filter "${key}" tidak didukung`);
        return;
      }

      if (!LIST_AUDIT_SUPPORTED_OPERATORS.has(operator)) {
        reasons.push(`operator "${operator}" pada ${key}`);
        return;
      }

      postFilters.push({
        Column: canonicalKey,
        Operator: operator,
        Value: String(value),
      });

      if (operator === "=" && filterMode === "and") {
        structuredFilters[canonicalKey] = String(value);
        return;
      }

      advancedFilters.push({
        Column: canonicalKey,
        Operator: operator,
        Value: String(value),
      });
    });

    if (duplicatedColumns.size > 0) {
      reasons.push(
        `lebih dari satu filter pada kolom ${Array.from(duplicatedColumns).join(", ")}`,
      );
    }

    const searchColumns = [];

    if (normalizedSearch) {
      if (searchScope === SEARCH_SCOPE_ALL) {
        visibleColumns.forEach((column) => {
          if (LIST_AUDIT_SEARCHABLE_COLUMNS.has(column.toUpperCase())) {
            searchColumns.push(column);
          }
        });
      } else {
        const scopedColumn = canonicalizeListAuditColumn(searchScope);

        if (
          !scopedColumn ||
          !LIST_AUDIT_SEARCHABLE_COLUMNS.has(scopedColumn.toUpperCase())
        ) {
          reasons.push(`scope search "${searchScope}" tidak didukung backend export`);
        } else {
          searchColumns.push(scopedColumn);
        }
      }

      if (!searchColumns.length) {
        reasons.push("tidak ada kolom pencarian yang didukung backend");
      }
    }

    return {
      canUseGet:
        !distinct &&
        !normalizedSearch &&
        !normalizedSort &&
        filterMode === "and" &&
        advancedFilters.length === 0,
      canUsePost:
        (filterMode === "and" || filterMode === "or") &&
        !reasons.includes("mode filter tidak didukung"),
      filterMode,
      reasons,
      normalizedSearch,
      selectedColumns:
        selectedColumns.length > 0
          ? selectedColumns
          : LIST_AUDIT_EXPORT_BASE_COLUMNS.filter((column) =>
              !EXCLUDED_COLUMNS.includes(column),
            ),
      advancedFilters,
      postFilters,
      searchColumns,
      sort: normalizedSort,
      structuredFilters,
      distinct,
      type: derivedType,
    };
  };

  const officialExportMeta = isListAuditExport
    ? getOfficialListAuditExportMeta()
    : isWeeklyOfficialExport ||
        isHumanOfficialExport ||
        isProcurementOfficialExport ||
        isOpexOfficialExport
      ? {
          normalizedSearch: normalizeSearchText(searchTerm),
          postFilters: Array.isArray(filters?.filters)
            ? filters.filters.filter((filter) => {
                const key = String(filter?.column || "").trim();
                const value = filter?.value;
                return key && value !== undefined && value !== null && String(value).trim() !== "";
              })
            : [],
          distinct: filters?.distinct?.column
            ? { Column: String(filters.distinct.column).trim() }
            : null,
        }
      : null;

  const officialExportUi = (() => {
    if (!officialExportMeta) return null;

    const hasSearch = Boolean(officialExportMeta.normalizedSearch);
    const hasFilters = officialExportMeta.postFilters.length > 0;
    const hasDistinct = Boolean(officialExportMeta.distinct?.Column);

    if (
      isWeeklyOfficialExport ||
      isHumanOfficialExport ||
      isProcurementOfficialExport ||
      isOpexOfficialExport
    ) {
      return {
        tone: "post",
        title: "Official export via POST",
        detail: buildListAuditExportDetail({
          hasSearch,
          hasFilters,
          hasDistinct,
        }),
      };
    }

    if (officialExportMeta.reasons.length > 0) {
      return {
        tone: "warning",
        title: "Perlu rapikan state tabel",
        detail: summarizeUnsupportedReasons(officialExportMeta.reasons),
      };
    }

    if (officialExportMeta.normalizedSearch) {
      return {
        tone: "post",
        title: "Official export via POST",
        detail: buildListAuditExportDetail({
          hasSearch,
          hasFilters,
          hasDistinct,
        }),
      };
    }

    if (!officialExportMeta.canUseGet) {
      return {
        tone: "post",
        title: "Official export via POST",
        detail: `${buildListAuditExportDetail({
          hasSearch,
          hasFilters,
          hasDistinct,
        })} Operator lanjutan dikirim ke backend lewat POST.`,
      };
    }

    return {
      tone: "get",
      title: "Official export via GET",
      detail: buildListAuditExportDetail({
        hasSearch,
        hasFilters,
        hasDistinct,
      }),
    };
  })();

  const getOfficialExportFormatMeta = (format) => {
    const normalizedFormat = String(format ?? "").trim().toLowerCase();

    if (normalizedFormat === "csv") {
      return {
        title: "CSV",
        detail:
          officialExportUi?.detail ||
          "Export resmi backend mengikuti filter yang sedang aktif.",
      };
    }

    return {
      title: normalizedFormat === "xlsx" ? "Excel" : normalizedFormat.toUpperCase(),
      detail:
        officialExportUi?.detail ||
        "Export resmi backend mengikuti filter yang sedang aktif.",
    };
  };

  const exportWeeklyOfficial = async (format) => {
    const baseUrl = `${process.env.REACT_APP_API_BASE_URL}`.replace(/\/$/, "");
    const requestUrl = new URL(apiUrl || `${baseUrl}/weeklytable`, window.location.origin);
    const periodId = requestUrl.searchParams.get("periodId");
    const tableId = requestUrl.searchParams.get("tableId");
    const normalizedSearch = normalizeSearchText(searchTerm);

    const selectedColumns = Array.from(
      new Set(
        sourceColumns
          .map((column) => String(column ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (selectedColumns.length === 0) {
      toast.warning("Tidak ada kolom yang bisa diexport.");
      return false;
    }

    const searchColumns = normalizedSearch
      ? searchScope === SEARCH_SCOPE_ALL
        ? selectedColumns
        : [String(searchScope || "").trim()].filter(Boolean)
      : undefined;

    const queryParams = new URLSearchParams();
    if (periodId) queryParams.set("periodId", periodId);
    if (tableId) queryParams.set("tableId", tableId);

    const response = await fetch(
      `${baseUrl}/WeeklyTable/export${queryParams.toString() ? `?${queryParams.toString()}` : ""}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Format: format,
          Columns: selectedColumns,
          Filters: Array.isArray(filters?.filters)
            ? filters.filters.filter((filter) => {
                const key = String(filter?.column || "").trim();
                const value = filter?.value;
                return key && value !== undefined && value !== null && String(value).trim() !== "";
              })
            : [],
          Mode: String(filters?.mode || "and").toLowerCase(),
          Sort: filters?.sort?.column ? filters.sort : undefined,
          Distinct: filters?.distinct?.column ? filters.distinct : undefined,
          Search: normalizedSearch || undefined,
          SearchColumns:
            normalizedSearch && Array.isArray(searchColumns) && searchColumns.length > 0
              ? searchColumns
              : undefined,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, "Weekly export failed."),
      );
    }

    const extension = format === "csv" ? "csv" : "xlsx";
    const blob = await response.blob();
    saveAs(blob, buildExportFileName(exportBaseName, extension));
    return true;
  };

  const appendProcurementStatusWorksheet = async (workbook, rowsToExport = []) => {
    if (!isProcurementExport || !Array.isArray(rowsToExport) || rowsToExport.length === 0) {
      return;
    }

    const statusWorksheet = workbook.addWorksheet("Status Pengadaan");
    statusWorksheet.columns = PROCUREMENT_STATUS_SHEET_COLUMNS;

    const baseApiUrl = `${process.env.REACT_APP_API_BASE_URL}`.replace(/\/$/, "");
    let cursorRowNumber = 1;

    for (const row of rowsToExport) {
      const procurementId = row?.Id ?? row?.ID ?? null;
      if (!procurementId) {
        continue;
      }

      const procurementType = resolveProcurementRowType(row, endpointName);
      let checklistRows = [];

      try {
        const response = await fetch(
          `${baseApiUrl}/StatusPengadaan/${procurementType}/${procurementId}`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Failed to load checklist"));
        }

        const payload = await response.json();
        checklistRows = Array.isArray(payload) ? payload : [];
      } catch (error) {
        console.error("Failed to load procurement status for export:", error);
        checklistRows = [];
      }

      const flattenedChecklist = compactProcurementChecklistDisplayRows(
        consolidateProcurementStatusGroups(
          flattenProcurementChecklist(checklistRows),
        ),
      );
      const sourceLabel =
        row?.Source || (procurementType === "existingprocure" ? "Existing" : "New");
      const procurementTitle =
        normalizeCellValue(row?.Perjanjian) ||
        normalizeCellValue(row?.project_id) ||
        `Procurement ${procurementId}`;
      const currentStatus = normalizeCellValue(row?.Status_Pengadaan) || "-";

      statusWorksheet.mergeCells(cursorRowNumber, 1, cursorRowNumber, PROCUREMENT_STATUS_SHEET_COLUMNS.length);
      const titleCell = statusWorksheet.getCell(cursorRowNumber, 1);
      titleCell.value = `${normalizeCellValue(row?.project_id) || "-"} | ${procurementTitle}`;
      titleCell.font = { bold: true, size: 13, color: { argb: "FFF8FAFC" } };
      titleCell.alignment = { vertical: "middle", horizontal: "left" };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF24364A" },
      };
      titleCell.border = {
        top: { style: "thin", color: { argb: "FF24364A" } },
        left: { style: "thin", color: { argb: "FF24364A" } },
        bottom: { style: "thin", color: { argb: "FF24364A" } },
        right: { style: "thin", color: { argb: "FF24364A" } },
      };
      statusWorksheet.getRow(cursorRowNumber).height = 24;
      cursorRowNumber += 1;

      const metaValues = [
        `Source: ${sourceLabel}`,
        `Department: ${normalizeCellValue(row?.Department) || "-"}`,
        `PIC: ${normalizeCellValue(row?.PIC) || "-"}`,
        `Status Pengadaan: ${currentStatus}`,
      ];
      statusWorksheet.mergeCells(cursorRowNumber, 1, cursorRowNumber, PROCUREMENT_STATUS_SHEET_COLUMNS.length);
      const metaCell = statusWorksheet.getCell(cursorRowNumber, 1);
      metaCell.value = metaValues.join("   |   ");
      metaCell.font = { italic: true, color: { argb: "FF475569" } };
      metaCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      metaCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
      metaCell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cursorRowNumber += 1;

      const headerRow = statusWorksheet.getRow(cursorRowNumber);
      PROCUREMENT_STATUS_SHEET_COLUMNS.forEach((column, index) => {
        headerRow.getCell(index + 1).value = column.header;
      });
      applyProcurementStatusSheetHeaderStyles(headerRow);
      cursorRowNumber += 1;

      if (flattenedChecklist.length === 0) {
        const emptyRow = statusWorksheet.getRow(cursorRowNumber);
        emptyRow.getCell(1).value = "Checklist belum tersedia untuk procurement ini.";
        statusWorksheet.mergeCells(cursorRowNumber, 1, cursorRowNumber, PROCUREMENT_STATUS_SHEET_COLUMNS.length);
        emptyRow.eachCell((cell) => {
          cell.alignment = { vertical: "middle", horizontal: "left" };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
        });
        cursorRowNumber += 2;
        continue;
      }

      flattenedChecklist.forEach((entry) => {
        const rowRef = statusWorksheet.getRow(cursorRowNumber);
        PROCUREMENT_STATUS_SHEET_COLUMNS.forEach((column, index) => {
          rowRef.getCell(index + 1).value = entry[column.key] ?? "";
        });

        rowRef.eachCell((cell) => {
          cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
        });

        const statusCell = rowRef.getCell(8);
        const checkpointCell = rowRef.getCell(9);
        const level = String(entry.Level ?? "").trim().toLowerCase();
        const isSectionHeader = level === "section";
        const isStepHeader = level === "step";
        const isItemHeader =
          level === "item" &&
          !String(entry.Status ?? "").trim();
        const isDone = String(entry.Status ?? "").trim().toLowerCase() === "done";
        const isCheckpoint = String(entry.Checkpoint ?? "").trim().toLowerCase() === "aktif";

        if (isSectionHeader) {
          rowRef.eachCell((cell) => {
            cell.font = {
              ...(cell.font || {}),
              bold: true,
              size: 12,
              color: { argb: "FF7C2D12" },
            };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFEDD5" },
            };
            cell.border = {
              top: { style: "medium", color: { argb: "FFF59E0B" } },
              left: { style: "thin", color: { argb: "FFFCD34D" } },
              bottom: { style: "medium", color: { argb: "FFF59E0B" } },
              right: { style: "thin", color: { argb: "FFFCD34D" } },
            };
          });
          rowRef.height = 24;
          cursorRowNumber += 1;
          return;
        }

        if (isStepHeader) {
          rowRef.eachCell((cell) => {
            cell.font = {
              ...(cell.font || {}),
              bold: true,
              color: { argb: "FF24364A" },
            };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFAF5EF" },
            };
          });
        }

        if (isItemHeader) {
          rowRef.eachCell((cell) => {
            cell.font = { ...(cell.font || {}), bold: true, color: { argb: "FF24364A" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          });
          cursorRowNumber += 1;
          return;
        }

        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isDone ? "FFE8F7ED" : "FFFFF1E8" },
        };
        statusCell.font = {
          bold: true,
          color: { argb: isDone ? "FF1F8F4D" : "FFB85B00" },
        };

        if (isCheckpoint) {
          rowRef.eachCell((cell) => {
            cell.font = { ...(cell.font || {}), bold: true };
          });
          checkpointCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFDE68A" },
          };
        }

        cursorRowNumber += 1;
      });

      cursorRowNumber += 1;
    }
  };

  const exportHumanResourceOfficial = async (format) => {
    const exportUrl = `${String(apiUrl || "").replace(/\/$/, "")}/export`;
    const selectedColumns = Array.from(
      new Set(
        sourceColumns
          .map((column) => String(column ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (selectedColumns.length === 0) {
      toast.warning("Tidak ada kolom yang bisa diexport.");
      return false;
    }

    const payload = buildHumanResourceServerQueryPayload({
      endpointName,
      filters,
      searchTerm,
      searchScope: searchScope || HUMAN_RESOURCE_SEARCH_SCOPE_ALL,
      visibleColumns: filters?.visibleColumns,
      allSearchableColumns: allColumns,
      page: 1,
      pageSize: HUMAN_RESOURCE_DEFAULT_PAGE_SIZE,
      focusId: null,
    });

    const response = await fetch(exportUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        Format: format,
        Columns: selectedColumns,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, "Human Resource export failed."),
      );
    }

    const extension = format === "csv" ? "csv" : "xlsx";
    const blob = await response.blob();
    saveAs(blob, buildExportFileName(exportBaseName, extension));
    return true;
  };

  const exportProcurementOfficial = async (format) => {
    const exportUrl = `${String(apiUrl || "").replace(/\/$/, "")}/export`;
    const selectedColumns = Array.from(
      new Set(
        sourceColumns
          .map((column) => String(column ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (selectedColumns.length === 0) {
      toast.warning("Tidak ada kolom yang bisa diexport.");
      return false;
    }

    const payload = buildProcurementServerQueryPayload({
      filters,
      searchTerm,
      searchScope: searchScope || PROCUREMENT_SEARCH_SCOPE_ALL,
      visibleColumns: filters?.visibleColumns,
      allSearchableColumns: allColumns,
      page: 1,
      pageSize: PROCUREMENT_DEFAULT_PAGE_SIZE,
      focusId: null,
    });

    const response = await fetch(exportUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        Format: format,
        Columns: selectedColumns,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, "Procurement export failed."),
      );
    }

    const extension = format === "csv" ? "csv" : "xlsx";
    const blob = await response.blob();
    saveAs(
      blob,
      buildExportFileName(exportBaseName, extension),
    );
    return true;
  };

  const exportOpexOfficial = async (format) => {
    if (format !== "csv" && format !== "xlsx") {
      toast.warning("Format export OPEX tidak didukung.");
      return false;
    }

    const requestUrl = new URL(String(apiUrl || ""), window.location.origin);
    const exportUrl = `${requestUrl.origin}${requestUrl.pathname.replace(/\/$/, "")}/export${requestUrl.search}`;
    const selectedColumns = Array.from(
      new Set(
        sourceColumns
          .map((column) => String(column ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (selectedColumns.length === 0) {
      toast.warning("Tidak ada kolom yang bisa diexport.");
      return false;
    }

    const normalizedSearch = normalizeSearchText(searchTerm);
    const searchColumns = normalizedSearch
      ? searchScope === SEARCH_SCOPE_ALL
        ? selectedColumns
        : [String(searchScope || "").trim()].filter(Boolean)
      : undefined;

    const response = await fetch(exportUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Format: format,
        Columns: selectedColumns,
        Filters: Array.isArray(filters?.filters)
          ? filters.filters.filter((filter) => {
              const key = String(filter?.column || "").trim();
              const value = filter?.value;
              return key && value !== undefined && value !== null && String(value).trim() !== "";
            })
          : [],
        Mode: String(filters?.mode || "and").toLowerCase(),
        Sort: filters?.sort?.column ? filters.sort : undefined,
        Distinct: filters?.distinct?.column ? filters.distinct : undefined,
        Search: normalizedSearch || undefined,
        SearchColumns:
          normalizedSearch && Array.isArray(searchColumns) && searchColumns.length > 0
            ? searchColumns
            : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, "OPEX export failed."),
      );
    }

    const extension = format === "csv" ? "csv" : "xlsx";
    const blob = await response.blob();
    saveAs(blob, buildExportFileName(exportBaseName, extension));
    return true;
  };

  const exportListAuditOfficial = async (format) => {
    const baseUrl = `${process.env.REACT_APP_API_BASE_URL}`.replace(/\/$/, "");
    const {
      advancedFilters,
      canUseGet,
      reasons,
      filterMode,
      normalizedSearch,
      selectedColumns,
      postFilters,
      searchColumns,
      sort,
      structuredFilters,
      distinct,
      type,
    } = getOfficialListAuditExportMeta();

    if (selectedColumns.length === 0) {
      toast.warning("Tidak ada kolom yang bisa diexport.");
      return false;
    }

    if (reasons.length > 0) {
      toast.warning(
        `Export resmi ListAudit ditahan. Backend hanya menerima state yang didukung: ${summarizeUnsupportedReasons(reasons)}.`,
        { autoClose: 6500 },
      );
      return false;
    }

    const useArrayFilters = filterMode === "or" || advancedFilters.length > 0;

    let response;

    if (canUseGet) {
      const params = new URLSearchParams({
        format,
        viewKey: DEFAULT_VIEW_KEY,
        type: type || "all",
      });

      selectedColumns.forEach((column) => params.append("columns", column));

      Object.entries(structuredFilters).forEach(([column, value]) => {
        params.set(column, value);
      });

      response = await fetch(`${baseUrl}/ListAudit/export?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      });
    } else {
      response = await fetch(`${baseUrl}/ListAudit/export`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Format: format,
          ViewKey: DEFAULT_VIEW_KEY,
          Type: type || "all",
          Columns: selectedColumns,
          Filters: useArrayFilters
            ? advancedFilters.length > 0
              ? advancedFilters
              : postFilters
            : structuredFilters,
          Mode: filterMode,
          Sort: sort || undefined,
          Distinct: distinct || undefined,
          Search: normalizedSearch || undefined,
          SearchColumns:
            normalizedSearch && searchColumns.length > 0
              ? searchColumns
              : undefined,
        }),
      });
    }

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(
          response,
          `Export ListAudit failed (HTTP ${response.status})`,
        ),
      );
    }

    const blob = await response.blob();
    saveAs(blob, buildExportFileName(exportBaseName, format));
    return true;
  };

  const prepareData = (rowsToExport = data) => {
    let truncatedCount = 0;

    const result = rowsToExport.map((row) => {
      const filtered = {};

      sourceColumns.forEach((column) => {
        let nextValue = normalizeCellValue(row?.[column]);

        if (typeof nextValue === "string" && nextValue.length > MAX_CELL_LENGTH) {
          truncatedCount += 1;
          nextValue = `${nextValue.slice(0, MAX_CELL_LENGTH)}...`;
        }

        filtered[column] = nextValue;
      });

      return filtered;
    });

    if (truncatedCount > 0) {
      toast.info(`${truncatedCount} cells were truncated during export.`);
    }

    return result;
  };

  const fetchProcurementExportRows = async () => {
    if (!isProcurementExport) {
      return Array.isArray(data) ? data : [];
    }

    if (filters?.distinct?.column) {
      toast.info(
        "Export Procurement saat distinct aktif memakai hasil tampilan saat ini.",
      );
      return Array.isArray(data) ? data : [];
    }

    const pageSize = 100;
    const buildPayloadForPage = (page) =>
      buildProcurementServerQueryPayload({
        filters,
        searchTerm,
        searchScope: searchScope || PROCUREMENT_SEARCH_SCOPE_ALL,
        visibleColumns: filters?.visibleColumns,
        allSearchableColumns: allColumns,
      page,
      pageSize,
      focusId: null,
    });

    const queryUrl = `${String(apiUrl || "").replace(/\/$/, "")}/query`;
    const allRows = [];

    const response = await fetch(queryUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayloadForPage(1)),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(
          response,
          `Export Procurement failed (HTTP ${response.status})`,
        ),
      );
    }

    const payload = await response.json();
    const firstRows = Array.isArray(payload?.Rows) ? payload.Rows : [];
    allRows.push(...firstRows);

    const totalPagesRaw = Number(payload?.TotalPages ?? payload?.totalPages ?? 1);
    const totalPages = Number.isFinite(totalPagesRaw) && totalPagesRaw > 1
      ? Math.floor(totalPagesRaw)
      : 1;

    for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
      const pageResponse = await fetch(queryUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayloadForPage(currentPage)),
      });

      if (!pageResponse.ok) {
        throw new Error(
          await readErrorMessage(
            pageResponse,
            `Export Procurement failed (HTTP ${pageResponse.status})`,
          ),
        );
      }

      const pagePayload = await pageResponse.json();
      if (Array.isArray(pagePayload?.Rows)) {
        allRows.push(...pagePayload.Rows);
      }
    }

    const dedupedRows = [];
    const seenRowIds = new Set();

    allRows.forEach((row) => {
      const rawId = row?.Id ?? row?.id ?? row?.ID;
      if (rawId == null || rawId === "") {
        dedupedRows.push(row);
        return;
      }

      const key = String(rawId);
      if (seenRowIds.has(key)) {
        return;
      }

      seenRowIds.add(key);
      dedupedRows.push(row);
    });

    return dedupedRows;
  };

  const fetchHumanResourceExportRows = async () => {
    if (!isHumanResourceExport) {
      return Array.isArray(data) ? data : [];
    }

    const pageSize = 100;
    const buildPayloadForPage = (page) =>
      buildHumanResourceServerQueryPayload({
        endpointName,
        filters,
        searchTerm,
        searchScope: searchScope || HUMAN_RESOURCE_SEARCH_SCOPE_ALL,
        visibleColumns: filters?.visibleColumns,
        allSearchableColumns: allColumns,
        page,
        pageSize,
        focusId: null,
      });

    const queryUrl = `${String(apiUrl || "").replace(/\/$/, "")}/query`;
    const allRows = [];

    const response = await fetch(queryUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayloadForPage(1)),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(
          response,
          `Export Human Resource failed (HTTP ${response.status})`,
        ),
      );
    }

    const payload = await response.json();
    const firstRows = Array.isArray(payload?.Rows) ? payload.Rows : [];
    allRows.push(...firstRows);

    const totalPagesRaw = Number(payload?.TotalPages ?? payload?.totalPages ?? 1);
    const totalPages =
      Number.isFinite(totalPagesRaw) && totalPagesRaw > 1
        ? Math.floor(totalPagesRaw)
        : 1;

    for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
      const pageResponse = await fetch(queryUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayloadForPage(currentPage)),
      });

      if (!pageResponse.ok) {
        throw new Error(
          await readErrorMessage(
            pageResponse,
            `Export Human Resource failed (HTTP ${pageResponse.status})`,
          ),
        );
      }

      const pagePayload = await pageResponse.json();
      if (Array.isArray(pagePayload?.Rows)) {
        allRows.push(...pagePayload.Rows);
      }
    }

    const dedupedRows = [];
    const seenRowIds = new Set();

    allRows.forEach((row) => {
      const rawId = row?.Id ?? row?.id ?? row?.ID;
      if (rawId == null || rawId === "") {
        dedupedRows.push(row);
        return;
      }

      const key = String(rawId);
      if (seenRowIds.has(key)) {
        return;
      }

      seenRowIds.add(key);
      dedupedRows.push(row);
    });

    return dedupedRows;
  };

  const exportToCSV = (rowsToExport = data) => {
    const headers = sourceColumnLabels;
    const rows = rowsToExport.map((row) =>
      sourceColumns
        .map((column) =>
          `"${normalizeCellValue(row?.[column]).replace(/"/g, '""')}"`,
        )
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    saveAs(
      new Blob([csv], { type: "text/csv" }),
      buildExportFileName(exportBaseName, "csv"),
    );
  };

  const exportToExcel = async (rowsToExport = data) => {
    const safeData = prepareData(rowsToExport);
    const ExcelJS = await loadExcelJs();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");

    workbook.creator = "PGH Frontend";
    workbook.created = new Date();

    const computedColumns = sourceColumns.map((column, index) => {
      const headerLabel = sourceColumnLabels[index] || column;
      const widestCell = safeData.reduce((maxWidth, row) => {
        const cellLength = getTextLineMaxLength(row?.[column] ?? "");
        return Math.max(maxWidth, cellLength);
      }, getTextLineMaxLength(headerLabel));

      return {
        key: column,
        width: Math.min(42, Math.max(12, widestCell + 2)),
      };
    });
    worksheet.columns = computedColumns;

    const columnLabelMap = buildSourceColumnLabelMap(sourceColumns, sourceColumnLabels);
    const hasOpexGroupedHeader =
      isOpexExport &&
      applyOpexExcelGroupedHeader({
        worksheet,
        sourceColumns,
        columnLabelMap,
      });

    let headerRows = 1;
    let dataStartRow = 2;
    let autoFilterRow = 1;
    let freezeRows = 1;
    let groupHeaderRows = [];
    let enableAutoFilter = true;

    if (hasOpexGroupedHeader) {
      // Hidden technical header row for Excel AutoFilter compatibility on merged visual headers.
      const technicalHeaderRow = worksheet.getRow(3);
      sourceColumns.forEach((column, index) => {
        technicalHeaderRow.getCell(index + 1).value =
          sourceColumnLabels[index] || column;
      });
      technicalHeaderRow.hidden = true;
      technicalHeaderRow.commit();

      headerRows = 2;
      dataStartRow = 4;
      autoFilterRow = 3;
      freezeRows = 2;
      groupHeaderRows = [1];
    } else {
      const headerRowRef = worksheet.getRow(1);
      sourceColumns.forEach((column, index) => {
        headerRowRef.getCell(index + 1).value = sourceColumnLabels[index] || column;
      });
      headerRowRef.commit();
    }

    safeData.forEach((row) => {
      const payload = {};
      sourceColumns.forEach((column) => {
        payload[column] = row?.[column] ?? "";
      });
      worksheet.addRow(payload);
    });

    applyStandardWorksheetStyles(worksheet, sourceColumns.length, {
      headerRows,
      dataStartRow,
      autoFilterRow,
      freezeRows,
      groupHeaderRows,
      enableAutoFilter,
    });

    await appendProcurementStatusWorksheet(workbook, rowsToExport);

    const excelBuffer = await workbook.xlsx.writeBuffer();

    saveAs(
      new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      buildExportFileName(exportBaseName, "xlsx"),
    );
  };

  const exportToPDF = async (rowsToExport = data) => {
    const safeData = prepareData(rowsToExport);
    const headers = sourceColumnLabels;
    const { jsPDFConstructor, autoTableFn } = await loadPdfBundle();
    const maxCellLength = Math.max(
      ...safeData.flatMap((row) =>
        sourceColumns.map((column) => String(row[column] ?? "").length),
      ),
      0,
    );

    const needLandscape = headers.length > 8 || maxCellLength > 40;
    const pdf = new jsPDFConstructor(
      needLandscape ? "landscape" : "portrait",
      "pt",
      "a4",
    );

    pdf.text(exportBaseName, 40, 30);
    autoTableFn(pdf, {
      startY: 50,
      head: [headers],
      body: safeData.map((row) => sourceColumns.map((column) => row[column] ?? "")),
      styles: { fontSize: 8, cellWidth: "wrap" },
      theme: "grid",
      tableWidth: "auto",
    });

    pdf.save(buildExportFileName(exportBaseName, "pdf"));
  };

  const exportUsingTemplate = async () => {
    if (!templateFile) {
      toast.warning("Upload template first");
      return;
    }

    const buffer = await templateFile.arrayBuffer();
    const ExcelJS = await loadExcelJs();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      toast.warning("Template sheet not found");
      return;
    }

    const headerMap = {};
    const headerRowNumber = Math.max(1, Number(headerRow) || 1);
    const headerSheetRow = sheet.getRow(headerRowNumber);

    headerSheetRow.eachCell({ includeEmpty: false }, (cell, columnIndex) => {
      const rawHeader = cell.value;
      if (rawHeader == null) return;
      const header = String(rawHeader).trim();
      if (!header) return;
      headerMap[header] = columnIndex;
    });

    data.forEach((row, rowIndex) => {
      Object.entries(headerMap).forEach(([header, columnIndex]) => {
        if (!(header in row)) return;

        const targetRow = sheet.getRow(dataStartRow + rowIndex);
        targetRow.getCell(columnIndex).value = row[header] ?? "";
        targetRow.commit();
      });
    });

    const out = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${fileName}-template.xlsx`,
    );

    setTemplateModal(false);
  };

  const handleDirectExport = async (format) => {
    if (!sourceColumns.length) {
      toast.warning("Tidak ada kolom yang bisa diexport.");
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      toast.warning("Tidak ada hasil filter yang bisa diexport.");
      return;
    }

    try {
      setExportingFormat(format);

      if (isListAuditExport) {
        await exportListAuditOfficial(format);
        return;
      }

      if (isWeeklyOfficialExport) {
        await exportWeeklyOfficial(format);
        return;
      }

      if (isHumanOfficialExport) {
        await exportHumanResourceOfficial(format);
        return;
      }

      if (isProcurementOfficialExport) {
        await exportProcurementOfficial(format);
        return;
      }

      if (isOpexOfficialExport) {
        await exportOpexOfficial(format);
        return;
      }

      const rowsToExport = isProcurementExport
        ? await fetchProcurementExportRows()
        : isHumanResourceExport
          ? await fetchHumanResourceExportRows()
          : data;

      if (!Array.isArray(rowsToExport) || rowsToExport.length === 0) {
        toast.warning("Tidak ada hasil filter yang bisa diexport.");
        return;
      }

      if (format === "csv") {
        exportToCSV(rowsToExport);
      } else if (format === "pdf") {
        await exportToPDF(rowsToExport);
      } else {
        await exportToExcel(rowsToExport);
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(error?.message || "Export failed");
    } finally {
      setExportingFormat(null);
      setOpen(false);
    }
  };

  return (
    <Dropdown isOpen={open} toggle={toggle}>
      <DropdownToggle
        caret
        color="outline-primary"
        size="sm"
        className="export-dropdown-toggle"
      >
        <i className="icon-import" />{" "}
        <span className="btn-import-text">Export</span>
      </DropdownToggle>

    <DropdownMenu className="export-dropdown-menu" style={{ minWidth: 280 }}>
        {isOfficialBackendExport ? (
          <>
            {officialExportFormats.map((format) => {
              const meta = getOfficialExportFormatMeta(format);
              return (
                <DropdownItem
                  key={format}
                  onClick={() => handleDirectExport(format)}
                  disabled={exportingFormat !== null}
                  className="export-dropdown-item"
                >
                  <div className="export-dropdown-item__title">{meta.title}</div>
                  <div className="export-dropdown-item__meta">
                    <span
                      className={`export-dropdown-item__badge export-dropdown-item__badge--${officialExportUi?.tone || "get"}`}
                    >
                      {officialExportUi?.title || "Official export"}
                    </span>
                    <span className="export-dropdown-item__meta-line">
                      {meta.detail}
                    </span>
                  </div>
                </DropdownItem>
              );
            })}
          </>
        ) : (
          <>
            <DropdownItem
              onClick={() => setTemplateModal(true)}
              disabled={exportingFormat !== null}
              className="export-dropdown-item"
            >
              Export with Template
            </DropdownItem>
            <DropdownItem
              onClick={() => handleDirectExport("csv")}
              disabled={exportingFormat !== null}
              className="export-dropdown-item"
            >
              CSV
            </DropdownItem>
            <DropdownItem
              onClick={() => handleDirectExport("xlsx")}
              disabled={exportingFormat !== null}
              className="export-dropdown-item"
            >
              Excel
            </DropdownItem>
            <DropdownItem
              onClick={() => handleDirectExport("pdf")}
              disabled={exportingFormat !== null}
              className="export-dropdown-item"
            >
              PDF
            </DropdownItem>
          </>
        )}
      </DropdownMenu>

      <Modal
        isOpen={!isOfficialBackendExport && templateModal}
        toggle={() => setTemplateModal(false)}
      >
        <ModalHeader toggle={() => setTemplateModal(false)}>
          Export With Template
        </ModalHeader>

        <ModalBody>
          <Input
            type="file"
            accept=".xlsx"
            onChange={(event) => setTemplateFile(event.target.files?.[0] || null)}
          />

          <FormGroup className="mt-3">
            <Label>Header Row</Label>
            <Input
              type="number"
              value={headerRow}
              onChange={(event) => setHeaderRow(Number(event.target.value))}
            />
          </FormGroup>
        </ModalBody>

        <ModalFooter>
          <Button color="primary" onClick={exportUsingTemplate}>
            Export
          </Button>
        </ModalFooter>
      </Modal>
    </Dropdown>
  );
};

export default ExportDropdown;
