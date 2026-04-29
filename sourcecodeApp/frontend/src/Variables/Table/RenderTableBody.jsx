/*
 * PGH-DOC

 * File: src/Variables/Table/RenderTableBody.jsx

 * Apa fungsi bagian ini:

 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).

 * Kenapa perlu:

 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.

 * Aturan khususnya apa:

 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.

 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.

 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { Table, Input, Button } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { MinusSquare, PlusSquare } from "react-feather";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import ActionCell from "../ActionCell/ActionCell";
import DateCell, { isDateValue, isDateColumn } from "../Cells/DateCell";
import EditableTextarea from "../Cells/EditableTextArea";
import {
  getNumericDisplayOptions,
  isEndpointPercentageColumn,
} from "../utils/numericFormatRules";
import { parseNumericValue, formatNumericValue } from "../utils/numericformat";
import { getGlobalDepartmentSuggestions } from "../utils/departmentSuggestions";
import UploadPhoto from "./TableToolBarElement/ImageUpload.jsx";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_ORDER_VIEW_KEY = "default";
const columnOrderCache = new Map();
const columnOrderInflight = new Map();
const SEARCH_SCOPE_ALL = "__all__";
const SYSTEM_MANAGED_COLUMNS = new Set(["createdat", "updatedat"]);
const STICKY_SELECTOR_WIDTH = 46;
const STICKY_DRAG_WIDTH = 28;
const LIST_AUDIT_LOCKED_COLUMN_KEYS = ["ACTION", "NO", "NAMAAUDIT"];
const LIST_AUDIT_ORDERED_COLUMN_PAIRS = [["DEPARTMENT", "PICAPLIKASI"]];
const LIST_AUDIT_PINNED_COLUMN_WIDTHS = {
  Action: 118,
  NO: 82,
  NAMAAUDIT: 200,
};
const LIST_AUDIT_AG_GRID_PINNED_KEYS = new Set(["Action", "NO", "NAMAAUDIT"]);
const LIST_AUDIT_AG_GRID_MULTILINE_COLUMNS = new Set([
  "NAMAAUDIT",
  "RINGKASANAUDIT",
  "PEMANTAUAN",
  "KETERANGAN",
  "LINK",
  "HIGHLIGHTS",
  "WORKINPROGRESS",
  "TARGET",
  "NEXTTODO",
]);
const AG_GRID_ENDPOINT_MULTILINE_COLUMNS = {
  allprocure: new Set(["KETERANGAN"]),
  newprocure: new Set(["KETERANGAN"]),
  existingprocure: new Set(["KETERANGAN"]),
  kebutuhanfte: new Set(["JOB"]),
  bnu: new Set(["USULANTRAINING"]),
  internaltraining: new Set(["USULANTRAINING", "FASILITATOR"]),
  kompetensipegawai: new Set(["JUDULTRAINING"]),
};
const OPEX_TEMPLATE_PINNED_COLUMN_KEYS = new Set([
  "SIT",
  "MATAANGGARANPARENT",
  "MATAANGGARANCHILD",
]);
const OPEX_TEMPLATE_TEXT_COLUMNS = new Set([
  "SIT",
  "MATAANGGARANPARENT",
  "MATAANGGARANCHILD",
  "ROWTYPE",
]);
const OPEX_TEMPLATE_DATE_INFERENCE_BLOCKED_COLUMNS = new Set([
  "SIT",
  "MATAANGGARANPARENT",
  "MATAANGGARANCHILD",
  "ROWTYPE",
]);
const OPEX_TEMPLATE_NUMERIC_COLUMNS = new Set([
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
  "ACCUMULATED",
  "REALIZATIONLASTYEARTHISMONTH",
  "REALIZATIONTHISYEARTHISMONTH",
  "GROWTHRP",
  "GROWTH",
  "FULLYEARFY",
  "YTD",
  "TOANGTHISYEAR",
  "TOANGYTDTHISYEAR",
  "SISAFY",
]);
const LIST_AUDIT_AG_GRID_LEFT_ALIGNED_COLUMNS = new Set([
  "NAMAAUDIT",
  "RINGKASANAUDIT",
  "PEMANTAUAN",
  "KETERANGAN",
  "LINK",
  "SOURCE",
  "PICAUDIT",
  "DEPARTMENT",
  "PICAPLIKASI",
  "JENISAUDIT",
  "HIGHLIGHTS",
  "WORKINPROGRESS",
  "TARGET",
  "NEXTTODO",
]);
const HUMAN_RESOURCE_NUMERIC_COLUMNS = new Set([
  "EXISTING",
  "KEBUTUHAN",
  "GAP",
  "JUMLAHPERSERTA",
  "BIAYA",
  "TAHUNPELAKSANAAN",
]);
const HUMAN_RESOURCE_GRID_COLUMN_CONFIG = {
  fte: {
    NPP: { width: 140, minWidth: 120, flex: 0.8 },
    Nama: { width: 240, minWidth: 180, flex: 1.4 },
    JenjangJabatan: { width: 200, minWidth: 160, flex: 1.1 },
    Posisi: { width: 190, minWidth: 150, flex: 1.05 },
    Department: { width: 180, minWidth: 150, flex: 1.0 },
  },
  nonfte: {
    NPP: { width: 140, minWidth: 120, flex: 0.75 },
    Nama: { width: 220, minWidth: 170, flex: 1.25 },
    JenisKelamin: { width: 150, minWidth: 130, flex: 0.75 },
    TanggalLahir: { width: 170, minWidth: 145, flex: 0.9 },
    TanggalJoinBNI: { width: 180, minWidth: 150, flex: 0.95 },
    ManmonthManagedService: { width: 210, minWidth: 170, flex: 1.15 },
    Department: { width: 180, minWidth: 150, flex: 0.95 },
    Role: { width: 230, minWidth: 190, flex: 1.3 },
    Vendor: { width: 220, minWidth: 180, flex: 1.2 },
  },
  kebutuhanfte: {
    DIREKTORAT: { width: 200, minWidth: 165, flex: 1.2 },
    KODEJOB: { width: 145, minWidth: 120, flex: 0.8 },
    JOB: { width: 280, minWidth: 220, flex: 1.7 },
    Department: { width: 190, minWidth: 155, flex: 1.05 },
    Existing: { width: 130, minWidth: 110, flex: 0.7 },
    Kebutuhan: { width: 130, minWidth: 110, flex: 0.7 },
    Gap: { width: 125, minWidth: 105, flex: 0.65 },
  },
  bnu: {
    UsulanTraining: { width: 320, minWidth: 250, flex: 1.9 },
    BulanTahun: { width: 160, minWidth: 135, flex: 0.9 },
    JumlahPerserta: { width: 155, minWidth: 130, flex: 0.85 },
    SentralDesentral: { width: 190, minWidth: 160, flex: 1.05 },
    DivisiDepartment: { width: 220, minWidth: 180, flex: 1.2 },
    Biaya: { width: 185, minWidth: 155, flex: 0.95 },
  },
  internaltraining: {
    UsulanTraining: { width: 300, minWidth: 240, flex: 1.7 },
    Start: { width: 160, minWidth: 136, flex: 0.9 },
    End: { width: 160, minWidth: 136, flex: 0.9 },
    JumlahPerserta: { width: 155, minWidth: 130, flex: 0.85 },
    DivisiDepartment: { width: 215, minWidth: 176, flex: 1.15 },
    Fasilitator: { width: 240, minWidth: 195, flex: 1.3 },
    Biaya: { width: 185, minWidth: 155, flex: 0.95 },
  },
  kompetensipegawai: {
    NPP: { width: 135, minWidth: 120, flex: 0.75 },
    Nama: { width: 240, minWidth: 190, flex: 1.3 },
    Department: { width: 200, minWidth: 165, flex: 1.05 },
    JudulTraining: { width: 320, minWidth: 255, flex: 1.85 },
    TahunPelaksanaan: { width: 165, minWidth: 140, flex: 0.9 },
    SertifikasiNonSerifikasi: { width: 245, minWidth: 200, flex: 1.35 },
  },
};
const HUMAN_RESOURCE_TABLE_KEYS = new Set(
  Object.keys(HUMAN_RESOURCE_GRID_COLUMN_CONFIG),
);
const isListAuditTable = (value) =>
  String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase() === "listaudit";

const isWeeklyComplianceTable = (value) =>
  String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase() === "weeklytable";

const normalizeEndpointToken = (value) =>
  String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

const isPlanningOpexTable = (value) => {
  const normalized = normalizeEndpointToken(value);
  return normalized === "opextemplate" || normalized === "opex";
};

const isAuditSummaryTable = (value) =>
  normalizeEndpointToken(value) === "auditsummary";

const normalizePinnedColumnKey = (value) =>
  String(value ?? "").trim().toUpperCase();

const resolveNumericDisplayOptionsForCell = (endpointName, column) =>
  getNumericDisplayOptions({ endpointName, column });

const formatRawNumericValueForInspector = (
  value,
  { isPercentage = false } = {},
) => {
  const parsed = parseNumericValue(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  const formatted = formatNumericValue(parsed, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 12,
  });
  return isPercentage ? `${formatted}%` : formatted;
};

const normalizeColumnOrderToken = (value) =>
  String(value ?? "")
    .replace(/[_\s]+/g, "")
    .trim()
    .toUpperCase();

const hasFixedDateColumn = (fixedDateColumns, column) => {
  const normalizedColumn = String(column ?? "").trim().toLowerCase();
  if (!normalizedColumn || !Array.isArray(fixedDateColumns)) return false;
  return fixedDateColumns.some(
    (candidate) =>
      String(candidate ?? "").trim().toLowerCase() === normalizedColumn,
  );
};

const shouldTreatAsDateCell = ({
  endpointName,
  column,
  cellValue,
  fixedDateColumns,
}) => {
  const normalizedEndpoint = normalizeEndpointToken(endpointName);
  const normalizedColumn = normalizePinnedColumnKey(column);
  const isBlockedByEndpoint =
    isPlanningOpexTable(normalizedEndpoint) &&
    OPEX_TEMPLATE_DATE_INFERENCE_BLOCKED_COLUMNS.has(normalizedColumn);

  if (isBlockedByEndpoint) {
    return false;
  }

  return (
    isDateColumn(column) ||
   
    hasFixedDateColumn(fixedDateColumns, column)
  );
};

const isLockedListAuditColumn = (column, endpointName) =>
  isListAuditTable(endpointName) &&
  LIST_AUDIT_LOCKED_COLUMN_KEYS.includes(normalizePinnedColumnKey(column));

const renderSafeValue = (value) => {
  if (Array.isArray(value)) return value[0]?.value ?? "";
  if (typeof value === "object" && value !== null) return value.value ?? "";
  return value ?? "";
};
const EMPTY_EDITOR_SUGGESTIONS = [];

const normalizeEditorSuggestionOption = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === "object") {
    const rawValue = String(value.value ?? value.label ?? "").trim();
    if (!rawValue) return null;

    const rawLabel = String(value.label ?? rawValue).trim() || rawValue;
    return {
      value: rawValue,
      label: rawLabel,
      key:
        String(value.key ?? value.dedupeKey ?? `${rawLabel}__${rawValue}`).trim() ||
        `${rawLabel}__${rawValue}`,
    };
  }

  const text = String(value).trim();
  if (!text) return null;
  return {
    value: text,
    label: text,
    key: `${text}__${text}`,
  };
};

const normalizeOpexDisplayValue = (endpointName, column, value) => {
  if (!isPlanningOpexTable(endpointName)) return value;
  if (normalizePinnedColumnKey(column) !== "FULLYEARFY") return value;
  const parsed = parseNumericValue(value);
  if (parsed === null || Number.isNaN(parsed)) return value;
  return parsed === 0 ? null : value;
};

const getMergedEditorSuggestions = (
  sortedData,
  column,
  suggestionValuesByColumn,
  row = null,
) => {
  const normalizedColumn = String(column ?? "").trim();
  const normalizedToken = normalizePinnedColumnKey(normalizedColumn);
  const useOnlyResolvedSuggestions =
    typeof suggestionValuesByColumn === "function";

  const dataValues = !useOnlyResolvedSuggestions && Array.isArray(sortedData)
    ? sortedData
        .map((row) => row?.[normalizedColumn])
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
    : [];

  const resolvedSuggestions =
    typeof suggestionValuesByColumn === "function"
      ? suggestionValuesByColumn(row, normalizedColumn, normalizedToken)
      : suggestionValuesByColumn;

  const seededValues = resolvedSuggestions && typeof resolvedSuggestions === "object"
    ? [
        ...(Array.isArray(resolvedSuggestions[normalizedColumn])
          ? resolvedSuggestions[normalizedColumn]
          : []),
        ...(Array.isArray(resolvedSuggestions[normalizedToken])
          ? resolvedSuggestions[normalizedToken]
          : []),
        ...(Array.isArray(resolvedSuggestions)
          ? resolvedSuggestions
          : []),
      ]
    : [];

  const globalDepartmentSeeds = getGlobalDepartmentSuggestions(normalizedColumn)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  const mergedSuggestions = [...dataValues, ...seededValues, ...globalDepartmentSeeds]
    .map(normalizeEditorSuggestionOption)
    .filter(Boolean);

  const seen = new Set();
  return mergedSuggestions.filter((item) => {
    const key = String(item.key ?? `${item.label ?? ""}__${item.value ?? ""}`)
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getWeeklyTableGridColumnConfig = (column) => {
  switch (normalizePinnedColumnKey(column)) {
    case "PROGRESS":
      return { width: 134, minWidth: 118, flex: 0.85 };
    case "STATUS":
      return { width: 170, minWidth: 150, flex: 1.05 };
    case "HIGHLIGHTS":
      return { width: 250, minWidth: 210, flex: 1.55 };
    case "WORKINPROGRESS":
      return { width: 300, minWidth: 240, flex: 1.85 };
    case "TARGET":
      return { width: 238, minWidth: 200, flex: 1.45 };
    case "NEXTTODO":
      return { width: 280, minWidth: 230, flex: 1.7 };
    default:
      return { width: 200, minWidth: 170, flex: 1.15 };
  }
};

const getHumanResourceGridColumnConfig = (endpointName, column) => {
  const endpointKey = normalizeEndpointToken(endpointName);
  const endpointConfig = HUMAN_RESOURCE_GRID_COLUMN_CONFIG[endpointKey];
  if (!endpointConfig) {
    return null;
  }

  const requestedToken = normalizePinnedColumnKey(column);
  const matchedColumn = Object.keys(endpointConfig).find(
    (configColumn) => normalizePinnedColumnKey(configColumn) === requestedToken,
  );

  return matchedColumn ? endpointConfig[matchedColumn] : null;
};

const getOpexGridColumnConfig = (column) => {
  switch (normalizePinnedColumnKey(column)) {
    case "SIT":
      return { width: 170, minWidth: 150, flex: 0.9 };
    case "MATAANGGARANPARENT":
      return { width: 300, minWidth: 240, flex: 1.6 };
    case "MATAANGGARANCHILD":
      return { width: 360, minWidth: 300, flex: 2.1 };
    case "JAN":
    case "FEB":
    case "MAR":
    case "APR":
    case "MAY":
    case "JUN":
    case "JUL":
    case "AUG":
    case "SEP":
    case "OCT":
    case "NOV":
    case "DEC":
      return { width: 136, minWidth: 122, flex: 0.78 };
    case "ACCUMULATED":
    case "REALIZATIONLASTYEARTHISMONTH":
    case "REALIZATIONTHISYEARTHISMONTH":
    case "FULLYEARFY":
    case "YTD":
    case "SISAFY":
      return { width: 175, minWidth: 145, flex: 1.05 };
    case "GROWTHRP":
      return { width: 165, minWidth: 140, flex: 0.95 };
    case "GROWTH":
    case "TOANGTHISYEAR":
    case "TOANGYTDTHISYEAR":
      return { width: 145, minWidth: 125, flex: 0.82 };
    default:
      return { width: 176, minWidth: 140, flex: 0.95 };
  }
};

const isAgGridMultilineColumn = (endpointName, column) => {
  const normalizedColumn = normalizePinnedColumnKey(column);
  if (LIST_AUDIT_AG_GRID_MULTILINE_COLUMNS.has(normalizedColumn)) {
    return true;
  }

  const endpointKey = normalizeEndpointToken(endpointName);
  const endpointMultilineConfig = AG_GRID_ENDPOINT_MULTILINE_COLUMNS[endpointKey];
  if (endpointMultilineConfig?.has(normalizedColumn)) {
    return true;
  }

  // Global table behavior: every data cell supports multiline rendering/editor.
  return true;
};

const isDistinctCellValue = (value, distinctConfig) => {
  if (!distinctConfig) return false;
  if (!Array.isArray(value)) return false;

  return value.every(
    (entry) => entry && typeof entry === "object" && "count" in entry && "value" in entry,
  );
};

const getListAuditGridColumnWidth = (column) => {
  switch (normalizePinnedColumnKey(column)) {
    case "ACTION":
      return 118;
    case "NO":
      return 82;
    case "NAMAAUDIT":
      return 188;
    case "RINGKASANAUDIT":
    case "KETERANGAN":
      return 320;
    case "PEMANTAUAN":
      return 280;
    case "LINK":
      return 300;
    case "IN":
    case "JATUHTEMPO":
    case "CREATEDAT":
    case "UPDATEDAT":
      return 172;
    case "STATUS":
    case "JENISAUDIT":
    case "SOURCE":
    case "PICAUDIT":
    case "DEPARTMENT":
    case "PICAPLIKASI":
      return 220;
    case "TAHUN":
      return 108;
    case "RHA":
    case "LHA":
      return 148;
    default:
      return 180;
  }
};

const getListAuditGridMinWidth = (column) => {
  switch (normalizePinnedColumnKey(column)) {
    case "ACTION":
      return 108;
    case "NO":
      return 72;
    case "NAMAAUDIT":
      return 168;
    case "RINGKASANAUDIT":
    case "KETERANGAN":
      return 280;
    case "PEMANTAUAN":
      return 250;
    case "LINK":
      return 260;
    case "STATUS":
    case "JENISAUDIT":
    case "SOURCE":
    case "PICAUDIT":
    case "DEPARTMENT":
    case "PICAPLIKASI":
      return 196;
    case "IN":
    case "JATUHTEMPO":
    case "CREATEDAT":
    case "UPDATEDAT":
      return 156;
    case "TAHUN":
      return 96;
    case "RHA":
    case "LHA":
      return 132;
    default:
      return 160;
  }
};

const normalizeColumnOrder = (columns, endpointName) => {
  const normalizedColumns = [...new Set((columns || []).filter(Boolean))];

  if (!isListAuditTable(endpointName)) {
    return normalizedColumns;
  }

  const lockedColumns = LIST_AUDIT_LOCKED_COLUMN_KEYS.map((lockedKey) =>
    normalizedColumns.find(
      (column) => normalizePinnedColumnKey(column) === lockedKey,
    ),
  ).filter(Boolean);

  const lockedSet = new Set(lockedColumns);
  let remainingColumns = normalizedColumns.filter(
    (column) => !lockedSet.has(column),
  );

  LIST_AUDIT_ORDERED_COLUMN_PAIRS.forEach(([leftKey, rightKey]) => {
    const leftIndex = remainingColumns.findIndex(
      (column) => normalizePinnedColumnKey(column) === leftKey,
    );
    const rightIndex = remainingColumns.findIndex(
      (column) => normalizePinnedColumnKey(column) === rightKey,
    );

    if (leftIndex === -1 || rightIndex === -1 || leftIndex < rightIndex) {
      return;
    }

    const [leftColumn] = remainingColumns.splice(leftIndex, 1);
    const nextRightIndex = remainingColumns.findIndex(
      (column) => normalizePinnedColumnKey(column) === rightKey,
    );

    remainingColumns.splice(nextRightIndex, 0, leftColumn);
  });

  return [...lockedColumns, ...remainingColumns];
};

const buildPinnedColumnMap = (
  uniqueCols,
  {
    endpointName,
    editMode,
    measuredPinnedWidths = {},
    stickySelectorWidth = STICKY_SELECTOR_WIDTH,
    stickyDragWidth = 0,
  },
) => {
  if (!isListAuditTable(endpointName)) {
    return new Map();
  }

  const pinnedOrder = ["Action", "NO", "NAMAAUDIT"];
  const byColumn = new Map();
  let left = (editMode ? stickySelectorWidth : 0) + stickyDragWidth;

  pinnedOrder.forEach((key, index) => {
    const actualColumn = uniqueCols.find(
      (column) => normalizePinnedColumnKey(column) === key,
    );

    if (!actualColumn) return;

    const width =
      measuredPinnedWidths[normalizePinnedColumnKey(actualColumn)] ||
      LIST_AUDIT_PINNED_COLUMN_WIDTHS[key] ||
      LIST_AUDIT_PINNED_COLUMN_WIDTHS.NAMAAUDIT;

    byColumn.set(actualColumn, {
      left,
      width,
      zIndex: 6 - index,
    });

    left += width;
  });

  return byColumn;
};

const arraysEqual = (left = [], right = []) =>
  left.length === right.length && left.every((item, index) => item === right[index]);

const mergeColumnOrder = (savedOrder, fallbackColumns) => {
  if (!Array.isArray(savedOrder) || savedOrder.length === 0) {
    return fallbackColumns;
  }

  const savedSet = new Set(savedOrder);
  const missing = fallbackColumns.filter((column) => !savedSet.has(column));

  return [...new Set([...savedOrder.filter(Boolean), ...missing])];
};

const canonicalizeColumnOrder = (
  orderedColumns,
  fallbackColumns,
  headerMap,
  endpointName,
) => {
  const mergedColumns = mergeColumnOrder(orderedColumns, fallbackColumns);

  if (!isListAuditTable(endpointName)) {
    return normalizeColumnOrder(mergedColumns, endpointName);
  }

  const actualColumns = [...new Set((fallbackColumns || []).filter(Boolean))];
  const actualColumnLookup = actualColumns.reduce((accumulator, column) => {
    const actualKey = String(column);
    accumulator[normalizeColumnOrderToken(actualKey)] = actualKey;

    const displayLabel =
      headerMap?.[actualKey.toLowerCase?.() ? actualKey.toLowerCase() : actualKey] ||
      headerMap?.[actualKey] ||
      "";

    if (displayLabel) {
      accumulator[normalizeColumnOrderToken(displayLabel)] = actualKey;
    }

    return accumulator;
  }, {});

  const normalizedColumns = mergedColumns
    .map((column) => {
      if (column === "Action") return "Action";

      const canonicalColumn =
        actualColumnLookup[normalizeColumnOrderToken(column)] || column;

      return canonicalColumn;
    })
    .filter((column) => column === "Action" || actualColumns.includes(column));

  return normalizeColumnOrder(normalizedColumns, endpointName);
};

/* -------------------------------------------------------------
   ↔️ Sortable Column Header
------------------------------------------------------------- */
const SortableColumnHeader = ({
  col,
  label,
  enableColumnDrag,
  headerStyle,
  locked = false,
  className = "",
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: col });
  const dragEnabled = enableColumnDrag && !locked;
  const headerTitle =
    typeof label === "string"
      ? label
      : label == null
        ? ""
        : String(label);

  return (
    <th
      ref={dragEnabled ? setNodeRef : null}
      data-column-id={col}
      title={headerTitle}
      aria-label={headerTitle || String(col)}
      className={`sortable-column-header ${className}`.trim()}
      style={{
        transform: dragEnabled
          ? CSS.Transform.toString(transform)
          : undefined,
        transition,
        cursor: dragEnabled ? "grab" : "default",
        ...headerStyle,
      }}
      {...(dragEnabled ? attributes : {})}
      {...(dragEnabled ? listeners : {})}
    >
      {label}
    </th>
  );
};

/* -------------------------------------------------------------
   🧩 Sortable Row with Toggle Logic Enhancements
------------------------------------------------------------- */
const SortableRow = ({
  row,
  rowIdx,
  editMode,
  showSelectorColumn = editMode,
  selectedIds,
  setSelectedIds,
  uniqueCols,
  rowSpanMap,
  unmergedCells,
  getCellKey,
  safeEditHandler,
  sortedData,
  actionKeys,
  onStatusClick,
  uploadColumns,
  fixedDateColumns,
  toggleColumns,
  toggleMode, // 👈 added
  endpointName,
  highlightCondition,
  onParentFilter,
  onNavigateToChange,
  canEditCell,
  cellEditablePredicate = null,
  nonEditableColumns = [],

  enableRowOrder,
  showRowHandle = enableRowOrder,
  enableMillionFormat,
  forcedRowHeight,

  source,

  distinctConfig,
  searchQuery = "",
  searchScope = SEARCH_SCOPE_ALL,
  pinnedColumnMap,
  suggestionValuesByColumn,
}) => {
  const [externalEditMap, setExternalEditMap] = useState({});
  const navigate = useNavigate();

  const shouldHighlight = highlightCondition?.(row);
  const sortableRowId = String(row?.__rowKey ?? row?.Id ?? `row-${rowIdx}`);
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sortableRowId });

  const renderSafeValue = (v) => {
    if (Array.isArray(v)) return v[0]?.value ?? "";
    if (typeof v === "object" && v !== null) return v.value ?? "";
    return v ?? "";
  };

  const isDistinctCell = (value, distinctConfig) => {
    if (!distinctConfig) return false;
    if (!Array.isArray(value)) return false;

    return value.every(
      (v) => v && typeof v === "object" && "count" in v && "value" in v,
    );
  };

  const resolvedActionKeys = useMemo(() => {
    if (typeof actionKeys === "function") {
      return actionKeys(row);
    }
    return Array.isArray(actionKeys) ? actionKeys : [];
  }, [actionKeys, row]);
  const normalizedNonEditableColumns = useMemo(
    () =>
      new Set(
        (Array.isArray(nonEditableColumns) ? nonEditableColumns : []).map((column) =>
          String(column ?? "").trim().toLowerCase(),
        ),
      ),
    [nonEditableColumns],
  );

  return (
    <tr
      ref={enableRowOrder ? setNodeRef : null}
      data-row-id={row.Id}
      className={`${selectedIds.includes(row.Id) ? "table-active" : ""} ${
        shouldHighlight ? "has-gap-row" : ""
      }`}
      style={{
        transform: enableRowOrder
          ? CSS.Transform.toString(transform)
          : undefined,
        transition,
        background: "#fff",
        ...(forcedRowHeight
          ? {
              height: forcedRowHeight,
            }
          : null),
      }}
    >
      {showSelectorColumn && (
        <td
          className="sticky-selector"
          style={{
            width: STICKY_SELECTOR_WIDTH,
            minWidth: STICKY_SELECTOR_WIDTH,
            maxWidth: STICKY_SELECTOR_WIDTH,
          }}
        >
          <Input
            type="checkbox"
            checked={selectedIds.includes(row.Id)}
            onChange={() =>
              setSelectedIds((prev) =>
                prev.includes(row.Id)
                  ? prev.filter((id) => id !== row.Id)
                  : [...prev, row.Id],
              )
            }
          />
        </td>
      )}

      {/* DRAG HANDLE */}
      {showRowHandle && (
        <td
          {...attributes}
          {...listeners}
          className="sticky-row-handle-cell"
          style={{
            ...(isListAuditTable(endpointName)
              ? {
                  position: "sticky",
                  left: editMode ? STICKY_SELECTOR_WIDTH : 0,
                  zIndex: 121,
                  background: "#fff",
                  backgroundClip: "padding-box",
                  boxShadow: "1px 0 0 rgba(69, 90, 100, 0.16)",
                }
              : null),
            cursor: "grab",
            width: STICKY_DRAG_WIDTH,
            minWidth: STICKY_DRAG_WIDTH,
            maxWidth: STICKY_DRAG_WIDTH,
            textAlign: "center",
            userSelect: "none",
            verticalAlign: "middle",
            padding: "0",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transform: "translateY(1px)",
              lineHeight: 1,
              fontSize: "18px",
            }}
          >
            ⋮
          </span>
        </td>
      )}
      {uniqueCols.map((col) => {
        const cellKey = getCellKey(rowIdx, col);
        const isUnmerged = unmergedCells.has(cellKey);
        const mergeMeta = rowSpanMap[col]?.[rowIdx];
        if (mergeMeta?.skip && !isUnmerged) return null;
        const pinnedMeta = pinnedColumnMap?.get(col);
        const canEditCurrentColumn =
          canEditCell &&
          !SYSTEM_MANAGED_COLUMNS.has(String(col ?? "").trim().toLowerCase()) &&
          !normalizedNonEditableColumns.has(String(col ?? "").trim().toLowerCase()) &&
          (typeof cellEditablePredicate !== "function" ||
            cellEditablePredicate(row, col)) &&
          !(isListAuditTable(endpointName) && normalizePinnedColumnKey(col) === "NO") &&
          !(
            isPlanningOpexTable(endpointName) &&
            normalizePinnedColumnKey(col) !== "FULLYEARFY"
          );

        const rawCellValue = row[col];
        const cellValue = normalizeOpexDisplayValue(endpointName, col, rawCellValue);
        const isSyntheticNumberColumn =
          isListAuditTable(endpointName) && normalizePinnedColumnKey(col) === "NO";
        const displayValue = isSyntheticNumberColumn
          ? cellValue ?? rowIdx + 1
          : cellValue;
        const trimmedVal =
          displayValue === null || displayValue === undefined
            ? ""
            : String(displayValue).trim();

        const toggleConfig = toggleColumns && toggleColumns[col];
        const isDateCellColumn = shouldTreatAsDateCell({
          endpointName,
          column: col,
          cellValue,
          fixedDateColumns,
        });
        const editorSuggestions = canEditCurrentColumn
          ? getMergedEditorSuggestions(
              sortedData,
              col,
              suggestionValuesByColumn,
              row,
            )
          : EMPTY_EDITOR_SUGGESTIONS;
        const numericFormatOptions = resolveNumericDisplayOptionsForCell(
          endpointName,
          col,
        );
        const isPercentageMetricColumn = isEndpointPercentageColumn({
          endpointName,
          column: col,
        });
        const rawInspectorValue = formatRawNumericValueForInspector(displayValue, {
          isPercentage: isPercentageMetricColumn,
        });
        const normalizedSource = normalizeEndpointToken(source);
        const isAuditSummaryNameColumn =
          !canEditCurrentColumn &&
          normalizedSource === "auditsummary" &&
          normalizePinnedColumnKey(col) === "NAMAAUDIT" &&
          Number.isFinite(Number(row?.Id)) &&
          Number(row.Id) > 0 &&
          trimmedVal !== "" &&
          trimmedVal.toLowerCase() !== "total";
        const isProcurementSummaryNameColumn =
          !canEditCurrentColumn &&
          normalizedSource === "procurementsummary" &&
          normalizePinnedColumnKey(col) === "PERJANJIAN" &&
          Number.isFinite(Number(row?.Id)) &&
          Number(row.Id) > 0;
        const isHumanSummaryFteColumn =
          !canEditCurrentColumn &&
          normalizedSource === "humansummaryfte" &&
          normalizePinnedColumnKey(col) === "JENJANGJABATAN" &&
          trimmedVal !== "" &&
          trimmedVal.toLowerCase() !== "total";
        const isHumanSummaryManmonthColumn =
          !canEditCurrentColumn &&
          normalizedSource === "humansummarymanmonth" &&
          normalizePinnedColumnKey(col) === "MANMONTHMANAGEDSERVICE" &&
          trimmedVal !== "" &&
          trimmedVal.toLowerCase() !== "total";
        const isOpexRawInspector =
          !canEditCurrentColumn &&
          isPlanningOpexTable(endpointName) &&
          numericFormatOptions &&
          rawInspectorValue;
        const onReadOnlyClick = isAuditSummaryNameColumn
          ? () => {
              navigate(
                `${process.env.PUBLIC_URL}/audit/listAudit?rowId=${encodeURIComponent(
                  row.Id,
                )}`,
              );
            }
          : isProcurementSummaryNameColumn
          ? () => {
              navigate(
                `${process.env.PUBLIC_URL}/procurement/APS?rowId=${encodeURIComponent(
                  row.Id,
                )}`,
              );
            }
          : isHumanSummaryFteColumn
            ? () => {
                const query = new URLSearchParams({
                  tab: "fte",
                  chartcolumn: "JenjangJabatan",
                  label: trimmedVal,
                });
                navigate(`${process.env.PUBLIC_URL}/human/resource?${query.toString()}`);
              }
            : isHumanSummaryManmonthColumn
              ? () => {
                  const query = new URLSearchParams({
                    tab: "nonfte",
                    chartcolumn: "ManmonthManagedService",
                    label: trimmedVal,
                  });
                  navigate(`${process.env.PUBLIC_URL}/human/resource?${query.toString()}`);
                }
          : isOpexRawInspector
            ? () => {
                const toastId = `opex-template-raw-${row.Id ?? rowIdx}-${col}`;
                if (toast.isActive(toastId)) return;
                toast.info(
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Nilai Asli</div>
                    <div>{rawInspectorValue}</div>
                  </div>,
                  { toastId, autoClose: 3200 },
                );
              }
            : null;

        return (
          <td
            key={col}
            data-column-id={col}
            className={pinnedMeta ? "list-audit-pinned-cell" : undefined}
            rowSpan={mergeMeta?.rowSpan || 1}
            style={
              pinnedMeta
                ? {
                    position: "sticky",
                    left: pinnedMeta.left,
                    width: pinnedMeta.width,
                    minWidth: pinnedMeta.width,
                    maxWidth: pinnedMeta.width,
                    background: "#fff",
                    backgroundClip: "padding-box",
                    zIndex: pinnedMeta.zIndex,
                    boxShadow: "1px 0 0 rgba(69, 90, 100, 0.16)",
                  }
                : undefined
            }
            onClick={() => {
    if (!canEditCurrentColumn) {
      return;
    }

    if (!distinctConfig?.column || typeof onParentFilter !== "function") {
      setExternalEditMap((prev) => ({ ...prev, [col]: true }));
      return;
    }

    const distinctColumn = distinctConfig.column;
    const rawDistinctValue = row[distinctColumn];
    const distinctValue = Array.isArray(rawDistinctValue)
      ? rawDistinctValue[0]?.value
      : rawDistinctValue;

    if (distinctValue === undefined || distinctValue === null) return;

    // Show toast confirmation
   toast.info(
  ({ closeToast }) => (
    <div>
      <span>Undistinct to Edit "{distinctValue}"?</span>
      <div style={{ gap: "8px", marginTop: "8px", display: "flex" }}>
        <Button
          className="btn btn-danger"
          onClick={() => {
            // ✅ Apply filter
            onParentFilter({
              filters: [
                {
                  column: distinctColumn,
                  operator: "=",
                  value: distinctValue,
                },
              ],
              mode: "and",
              sort: null,
              distinct: null,
              clearHighlight: true,
            });
            closeToast();
          }}
        >
          Yes
        </Button>
        <Button onClick={() => closeToast()}>No</Button>
      </div>
    </div>
  ),
  {
    autoClose: 5000, // 10 seconds
  }
);
  }}

          >
            {isSyntheticNumberColumn ? (
              <span style={{ fontWeight: 400 }}>{displayValue}</span>
            ) : isDistinctCell(cellValue, distinctConfig) ? (
              cellValue.map((item, idx) => (
                <div key={idx}>
                  <EditableTextarea
                    column={col}
                    value={item.value ?? ""}
                    canEdit={false} // 🔒 IMPORTANT (distinct = read-only)
                    onCommit={() => {}}
                    allValues={[]}
                    externalEdit={false}
                    numericFormatOptions={numericFormatOptions}
                    onReadOnlyClick={onReadOnlyClick}
                    searchQuery={searchQuery}
                    highlightSearch={
                      Boolean(searchQuery) &&
                      (searchScope === SEARCH_SCOPE_ALL || searchScope === col)
                    }
                    style={{
                      cursor: "pointer",
                      padding: 0,
                      minHeight: "unset",
                      fontWeight: 400,
                    }}
                  />

                  {item.count > 1 && (
                    <span className="badge bg-primary">{item.count}</span>
                  )}

                  {idx < cellValue.length - 1 && <span>, </span>}
                </div>
              ))
            ) : col === "Action" ? (
              <ActionCell
                source={source}
                row={row}
                keys={resolvedActionKeys}
                onStatusClick={onStatusClick}
                endpointName={endpointName}
                onParentFilter={onParentFilter}
                onNavigateToChange={onNavigateToChange}
              />
            ) : uploadColumns.includes(col) ? (
              <UploadPhoto
                rowId={row.Id}
                column={col}
                currentValue={cellValue}
                uiVariant={
                  isListAuditTable(endpointName) &&
                  ["RHA", "LHA"].includes(normalizePinnedColumnKey(col))
                    ? "compliance-events"
                    : "default"
                }
                align={
                  isListAuditTable(endpointName) &&
                  ["RHA", "LHA"].includes(normalizePinnedColumnKey(col))
                    ? "center"
                    : "start"
                }
                onUploaded={
                  isListAuditTable(endpointName) &&
                  ["RHA", "LHA"].includes(normalizePinnedColumnKey(col))
                    ? undefined
                    : (url) => safeEditHandler(row.Id, col, url, row[col], row)
                }
                apiUrl={`${process.env.REACT_APP_API_BASE_URL}listaudit`}
              />
            ) : toggleConfig ? (
              // =============================
              //   TOGGLE COLUMN LOGIC
              // =============================

              trimmedVal === "" ? (
                // 🔹 Empty → show text editor
                <EditableTextarea
                  column={col} // 👈 REQUIRED
                  value={renderSafeValue(displayValue)} // ✅ FIX
                  onCommit={(val) =>
                    safeEditHandler(row.Id, col, val, cellValue, row)
                  }
                  allValues={editorSuggestions}
                  canEdit={canEditCurrentColumn}
                  enableMillionFormat={enableMillionFormat}
                  numericFormatOptions={numericFormatOptions}
                  onReadOnlyClick={onReadOnlyClick}
                  externalEdit={
                    canEditCurrentColumn && (externalEditMap[col] || false)
                  }
                  searchQuery={searchQuery}
                  highlightSearch={
                    Boolean(searchQuery) &&
                    (searchScope === SEARCH_SCOPE_ALL || searchScope === col)
                  }
                  onExternalEditConsumed={() =>
                    setExternalEditMap((prev) => ({ ...prev, [col]: false }))
                  }
                />
              ) : (
                // 🔹 Filled → show toggle button
                <Button
                  size="sm"
                  disabled={!canEditCurrentColumn}
                  color={
                    trimmedVal.toLowerCase() ===
                    toggleConfig.positive.toLowerCase()
                      ? "success"
                      : "secondary"
                  }
                  onClick={(e) => {
                    e.stopPropagation();

                    if (!trimmedVal) return;

                    const isPositive =
                      trimmedVal.toLowerCase() ===
                      toggleConfig.positive.toLowerCase();

                    const newValue = isPositive
                      ? toggleConfig.negative // Done → Not Yet
                      : toggleConfig.positive; // Not Yet → Done

                    // Always update the clicked row
                    safeEditHandler(row.Id, col, newValue);

                    if (toggleMode === "single") return;

                    // =====================================================
                    // SMART FILL: STOP WHEN CLASH FOUND
                    // =====================================================

                    if (!isPositive) {
                      // ======================================================================
                      //  CURRENT = NOT YET → fill UP until we hit a row that is already DONE
                      // ======================================================================

                      // NOT YET → fill UP
                      for (let i = rowIdx - 1; i >= 0; i--) {
                        const r = sortedData[i];
                        const v = (r[col] || "").trim().toLowerCase();

                        if (!v) continue; // skip empty rows

                        // STOP when we meet a DONE above
                        if (v === toggleConfig.positive.toLowerCase()) break;

                        safeEditHandler(r.Id, col, newValue);
                      }
                    } else {
                      // ======================================================================
                      // CURRENT = DONE → fill DOWN until we hit a row that is already NOT YET
                      // ======================================================================

                      // DONE → fill DOWN
                      for (let i = rowIdx + 1; i < sortedData.length; i++) {
                        const r = sortedData[i];
                        const v = (r[col] || "").trim().toLowerCase();

                        if (!v) continue; // skip empty rows

                        // STOP when we meet a NOT YET below
                        if (v === toggleConfig.negative.toLowerCase()) break;

                        safeEditHandler(r.Id, col, newValue);
                      }
                    }
                  }}
                >
                  {trimmedVal.toLowerCase() ===
                  toggleConfig.positive.toLowerCase()
                    ? `✅ ${toggleConfig.positive}`
                    : `⌛ ${toggleConfig.negative}`}
                </Button>
              )
            ) : isDateCellColumn ? (
              // =============================
              //   DATE CELL
              // =============================
              <DateCell
                key={`${row.Id}-${cellValue}`} // 👈 force re-create when date changes
                value={cellValue}
                canEdit={canEditCurrentColumn}
                searchQuery={searchQuery}
                highlightSearch={
                  Boolean(searchQuery) &&
                  (searchScope === SEARCH_SCOPE_ALL || searchScope === col)
                }
                onChange={(newDate) =>
                  safeEditHandler(row.Id, col, newDate, cellValue)
                }
              />
            ) : (
              // =============================
              //   DEFAULT: TEXT EDITOR
              // =============================
              <EditableTextarea
                column={col} // 👈 REQUIRED
                value={renderSafeValue(displayValue)} // ✅ FIX
                onCommit={(val) =>
                  safeEditHandler(row.Id, col, val, cellValue, row)
                }
                allValues={editorSuggestions}
                canEdit={canEditCurrentColumn}
                enableMillionFormat={enableMillionFormat}
                numericFormatOptions={numericFormatOptions}
                onReadOnlyClick={onReadOnlyClick}
                externalEdit={
                  canEditCurrentColumn && (externalEditMap[col] || false)
                }
                searchQuery={searchQuery}
                highlightSearch={
                  Boolean(searchQuery) &&
                  (searchScope === SEARCH_SCOPE_ALL || searchScope === col)
                }
                onExternalEditConsumed={() =>
                  setExternalEditMap((prev) => ({ ...prev, [col]: false }))
                }
              />
            )}
          </td>
        );
      })}
    </tr>
  );
};

const ListAuditAgGridCell = ({
  data,
  node,
  colDef,
  columnKey,
  sortedData,
  safeEditHandler,
  canEditCell,
  cellEditablePredicate = null,
  actionKeys,
  onStatusClick,
  endpointName,
  onParentFilter,
  onNavigateToChange,
  uploadColumns,
  fixedDateColumns,
  toggleColumns,
  toggleMode,
  enableMillionFormat,
  source,
  distinctConfig,
  searchQuery,
  searchScope,
  suggestionValuesByColumn,
  multilineEditor = false,
  nonEditableColumns = [],
  treeMode = false,
  onTreeToggle = null,
}) => {
  const [externalEdit, setExternalEdit] = useState(false);
  const navigate = useNavigate();
  const rowData = useMemo(() => data || {}, [data]);
  const col = columnKey || colDef?.colId || colDef?.field;
  const normalizedCol = normalizePinnedColumnKey(col);
  const isTreeToggleColumn = normalizedCol === "__TREE__";
  const rowIndex = node?.rowIndex ?? 0;
  const rawCellValue = rowData[col];
  const cellValue = normalizeOpexDisplayValue(endpointName, col, rawCellValue);
  const syntheticNumberColumn = normalizedCol === "NO";
  const treeLevel = Number.isFinite(Number(rowData?.__level))
    ? Number(rowData.__level)
    : 0;
  const displayValue = syntheticNumberColumn ? cellValue ?? rowIndex + 1 : cellValue;
  const trimmedVal =
    displayValue === null || displayValue === undefined
      ? ""
      : String(displayValue).trim();
  const normalizedNonEditableColumns = useMemo(
    () =>
      new Set(
        (Array.isArray(nonEditableColumns) ? nonEditableColumns : []).map((column) =>
          String(column ?? "").trim().toLowerCase(),
        ),
      ),
    [nonEditableColumns],
  );
  const canEditCurrentColumn =
    canEditCell &&
    !SYSTEM_MANAGED_COLUMNS.has(String(col ?? "").trim().toLowerCase()) &&
    !normalizedNonEditableColumns.has(String(col ?? "").trim().toLowerCase()) &&
    (typeof cellEditablePredicate !== "function" ||
      cellEditablePredicate(rowData, col)) &&
    normalizedCol !== "NO" &&
    !(
      isPlanningOpexTable(endpointName) &&
      normalizedCol !== "FULLYEARFY"
    );
  const highlightSearch =
    Boolean(searchQuery) &&
    (searchScope === SEARCH_SCOPE_ALL || searchScope === col);
  const editorSuggestions = useMemo(
    () =>
      canEditCurrentColumn
        ? getMergedEditorSuggestions(sortedData, col, suggestionValuesByColumn, rowData)
        : EMPTY_EDITOR_SUGGESTIONS,
    [canEditCurrentColumn, col, rowData, sortedData, suggestionValuesByColumn],
  );
  const numericFormatOptions = useMemo(
    () => resolveNumericDisplayOptionsForCell(endpointName, col),
    [endpointName, col],
  );
  const isPercentageMetricColumn = useMemo(
    () => isEndpointPercentageColumn({ endpointName, column: col }),
    [endpointName, col],
  );
  const rawInspectorValue = useMemo(
    () =>
      formatRawNumericValueForInspector(displayValue, {
        isPercentage: isPercentageMetricColumn,
      }),
    [displayValue, isPercentageMetricColumn],
  );
  const onReadOnlyClick = useMemo(() => {
    if (canEditCurrentColumn) return null;

    const normalizedSource = normalizeEndpointToken(source);
    const trimmedValue =
      displayValue === null || displayValue === undefined
        ? ""
        : String(displayValue).trim();
    const isAuditSummaryNameColumn =
      normalizedSource === "auditsummary" &&
      normalizePinnedColumnKey(col) === "NAMAAUDIT" &&
      Number.isFinite(Number(rowData?.Id)) &&
      Number(rowData.Id) > 0 &&
      trimmedValue !== "" &&
      trimmedValue.toLowerCase() !== "total";
    if (isAuditSummaryNameColumn) {
      return () => {
        navigate(
          `${process.env.PUBLIC_URL}/audit/listAudit?rowId=${encodeURIComponent(
            rowData.Id,
          )}`,
        );
      };
    }

    const isProcurementSummaryNameColumn =
      normalizedSource === "procurementsummary" &&
      normalizePinnedColumnKey(col) === "PERJANJIAN" &&
      Number.isFinite(Number(rowData?.Id)) &&
      Number(rowData.Id) > 0;
    if (isProcurementSummaryNameColumn) {
      return () => {
        navigate(
          `${process.env.PUBLIC_URL}/procurement/APS?rowId=${encodeURIComponent(
            rowData.Id,
          )}`,
        );
      };
    }

    const isHumanSummaryFteColumn =
      normalizedSource === "humansummaryfte" &&
      normalizePinnedColumnKey(col) === "JENJANGJABATAN" &&
      trimmedValue !== "" &&
      trimmedValue.toLowerCase() !== "total";
    if (isHumanSummaryFteColumn) {
      return () => {
        const query = new URLSearchParams({
          tab: "fte",
          chartcolumn: "JenjangJabatan",
          label: trimmedValue,
        });
        navigate(`${process.env.PUBLIC_URL}/human/resource?${query.toString()}`);
      };
    }

    const isHumanSummaryManmonthColumn =
      normalizedSource === "humansummarymanmonth" &&
      normalizePinnedColumnKey(col) === "MANMONTHMANAGEDSERVICE" &&
      trimmedValue !== "" &&
      trimmedValue.toLowerCase() !== "total";
    if (isHumanSummaryManmonthColumn) {
      return () => {
        const query = new URLSearchParams({
          tab: "nonfte",
          chartcolumn: "ManmonthManagedService",
          label: trimmedValue,
        });
        navigate(`${process.env.PUBLIC_URL}/human/resource?${query.toString()}`);
      };
    }

    if (!isPlanningOpexTable(endpointName)) return null;
    if (treeMode) return null;
    if (!numericFormatOptions || !rawInspectorValue) return null;

    return () => {
      const rowKey = rowData.Id ?? rowData.id ?? rowIndex;
      const toastId = `opex-template-raw-grid-${rowKey}-${col}`;
      if (toast.isActive(toastId)) return;
      toast.info(
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Nilai Asli</div>
          <div>{rawInspectorValue}</div>
        </div>,
        { toastId, autoClose: 3200 },
      );
    };
  }, [
    canEditCurrentColumn,
    endpointName,
    numericFormatOptions,
    rawInspectorValue,
    rowData,
    rowIndex,
    col,
    source,
    navigate,
    treeMode,
  ]);
  const toggleConfig = toggleColumns?.[col];
  const isDateCellColumn = shouldTreatAsDateCell({
    endpointName,
    column: col,
    cellValue,
    fixedDateColumns,
  });
  const resolvedActionKeys = useMemo(() => {
    if (typeof actionKeys === "function") {
      return actionKeys(rowData);
    }

    return Array.isArray(actionKeys) ? actionKeys : [];
  }, [actionKeys, rowData]);

  const handleEditableCellClick = useCallback(() => {
    if (!canEditCurrentColumn) {
      return;
    }

    if (!distinctConfig?.column || typeof onParentFilter !== "function") {
      setExternalEdit(true);
      return;
    }

    const distinctColumn = distinctConfig.column;
    const rawDistinctValue = rowData[distinctColumn];
    const distinctValue = Array.isArray(rawDistinctValue)
      ? rawDistinctValue[0]?.value
      : rawDistinctValue;

    if (distinctValue === undefined || distinctValue === null) return;

    toast.info(
      ({ closeToast }) => (
        <div>
          <span>Undistinct to Edit "{distinctValue}"?</span>
          <div style={{ gap: "8px", marginTop: "8px", display: "flex" }}>
            <Button
              className="btn btn-danger"
              onClick={() => {
                onParentFilter({
                  filters: [
                    {
                      column: distinctColumn,
                      operator: "=",
                      value: distinctValue,
                    },
                  ],
                  mode: "and",
                  sort: null,
                  distinct: null,
                  clearHighlight: true,
                });
                closeToast();
              }}
            >
              Yes
            </Button>
            <Button onClick={() => closeToast()}>No</Button>
          </div>
        </div>
      ),
      { autoClose: 5000 },
    );
  }, [canEditCurrentColumn, rowData, distinctConfig, onParentFilter]);

  if (!data) return null;

  if (isTreeToggleColumn) {
    const rowTypeToken = String(rowData?.RowType ?? "").trim().toLowerCase();
    const hasTreeChildren = Boolean(rowData?.hasChildren) || rowTypeToken === "group";
    if (!hasTreeChildren) {
      return <span aria-hidden="true">&nbsp;</span>;
    }
    const isCollapsed = Boolean(rowData?.isCollapsed);
    return (
      <button
        type="button"
        className="btn btn-link p-0 d-inline-flex align-items-center justify-content-center"
        aria-label={isCollapsed ? "Expand row" : "Collapse row"}
        title={isCollapsed ? "Expand" : "Collapse"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof onTreeToggle === "function") {
            onTreeToggle(rowData.__key);
          }
        }}
      >
        {isCollapsed ? <PlusSquare size={14} /> : <MinusSquare size={14} />}
      </button>
    );
  }

  const withTreeIndent = (content) => {
    if (!treeMode || normalizedCol !== "SIT") {
      return content;
    }
    const paddingLeft = Math.max(0, treeLevel) * 14;
    return <div style={{ paddingLeft: `${paddingLeft}px` }}>{content}</div>;
  };

  if (syntheticNumberColumn) {
    return withTreeIndent(
      <span className="list-audit-ag-grid-number">{displayValue}</span>,
    );
  }

  if (isDistinctCellValue(cellValue, distinctConfig)) {
    return withTreeIndent(
      <div className="list-audit-ag-grid-distinct" onClick={handleEditableCellClick}>
        {cellValue.map((item, index) => (
          <div key={`${col}-${index}`} className="list-audit-ag-grid-distinct-item">
            <EditableTextarea
              column={col}
              value={item.value ?? ""}
              canEdit={false}
              multiline={multilineEditor}
              onCommit={() => {}}
              allValues={[]}
              externalEdit={false}
              numericFormatOptions={numericFormatOptions}
              onReadOnlyClick={onReadOnlyClick}
              searchQuery={searchQuery}
              highlightSearch={highlightSearch}
                style={{
                  cursor: "pointer",
                  padding: 0,
                  minHeight: "unset",
                  fontWeight: 400,
                }}
              />
            {item.count > 1 && <span className="badge bg-primary ms-1">{item.count}</span>}
          </div>
        ))}
      </div>
    );
  }

  if (col === "Action") {
    return withTreeIndent(
      <ActionCell
        source={source}
        row={rowData}
        keys={resolvedActionKeys}
        onStatusClick={onStatusClick}
        endpointName={endpointName}
        onParentFilter={onParentFilter}
        onNavigateToChange={onNavigateToChange}
      />,
    );
  }

  if (uploadColumns.includes(col)) {
    return withTreeIndent(
      <UploadPhoto
        rowId={rowData.Id}
        column={col}
        currentValue={cellValue}
        uiVariant={
          isListAuditTable(endpointName) &&
          ["RHA", "LHA"].includes(normalizePinnedColumnKey(col))
            ? "compliance-events"
            : "default"
        }
        align={
          isListAuditTable(endpointName) &&
          ["RHA", "LHA"].includes(normalizePinnedColumnKey(col))
            ? "center"
            : "start"
        }
        onUploaded={
          isListAuditTable(endpointName) &&
          ["RHA", "LHA"].includes(normalizePinnedColumnKey(col))
            ? undefined
            : (url) => safeEditHandler(rowData.Id, col, url, rowData[col], rowData)
        }
        apiUrl={`${process.env.REACT_APP_API_BASE_URL}listaudit`}
      />,
    );
  }

  if (toggleConfig) {
    return withTreeIndent(trimmedVal === "" ? (
      <div className="list-audit-ag-grid-click-target" onClick={handleEditableCellClick}>
        <EditableTextarea
          column={col}
          value={renderSafeValue(displayValue)}
          multiline={multilineEditor}
          onCommit={(value) => safeEditHandler(rowData.Id, col, value, cellValue, rowData)}
          allValues={editorSuggestions}
          canEdit={canEditCurrentColumn}
          enableMillionFormat={enableMillionFormat}
          numericFormatOptions={numericFormatOptions}
          onReadOnlyClick={onReadOnlyClick}
          externalEdit={canEditCurrentColumn && externalEdit}
          searchQuery={searchQuery}
          highlightSearch={highlightSearch}
          onExternalEditConsumed={() => setExternalEdit(false)}
        />
      </div>
    ) : (
      <Button
        size="sm"
        disabled={!canEditCurrentColumn}
        color={
          trimmedVal.toLowerCase() === toggleConfig.positive.toLowerCase()
            ? "success"
            : "secondary"
        }
        onClick={(event) => {
          event.stopPropagation();

          if (!trimmedVal) return;

          const isPositive =
            trimmedVal.toLowerCase() === toggleConfig.positive.toLowerCase();
          const newValue = isPositive
            ? toggleConfig.negative
            : toggleConfig.positive;

          safeEditHandler(rowData.Id, col, newValue);

          if (toggleMode === "single") return;

          if (!isPositive) {
            for (let index = rowIndex - 1; index >= 0; index -= 1) {
              const row = sortedData[index];
              const value = (row[col] || "").trim().toLowerCase();

              if (!value) continue;
              if (value === toggleConfig.positive.toLowerCase()) break;

              safeEditHandler(row.Id, col, newValue);
            }
          } else {
            for (let index = rowIndex + 1; index < sortedData.length; index += 1) {
              const row = sortedData[index];
              const value = (row[col] || "").trim().toLowerCase();

              if (!value) continue;
              if (value === toggleConfig.negative.toLowerCase()) break;

              safeEditHandler(row.Id, col, newValue);
            }
          }
        }}
      >
        {trimmedVal.toLowerCase() === toggleConfig.positive.toLowerCase()
          ? `✅ ${toggleConfig.positive}`
          : `⌛ ${toggleConfig.negative}`}
      </Button>
    ));
  }

  if (isDateCellColumn) {
    return withTreeIndent(
      <div className="list-audit-ag-grid-click-target">
        <DateCell
          key={`${rowData.Id}-${col}-${cellValue}`}
          value={cellValue}
          canEdit={canEditCurrentColumn}
          searchQuery={searchQuery}
          highlightSearch={highlightSearch}
          onChange={(newDate) => safeEditHandler(rowData.Id, col, newDate, cellValue)}
        />
      </div>,
    );
  }

  return withTreeIndent(
    <div className="list-audit-ag-grid-click-target" onClick={handleEditableCellClick}>
      <EditableTextarea
        column={col}
        value={renderSafeValue(displayValue)}
        multiline={multilineEditor}
        onCommit={(value) => safeEditHandler(rowData.Id, col, value, cellValue, rowData)}
        allValues={editorSuggestions}
        canEdit={canEditCurrentColumn}
        enableMillionFormat={enableMillionFormat}
        numericFormatOptions={numericFormatOptions}
        onReadOnlyClick={onReadOnlyClick}
        externalEdit={canEditCurrentColumn && externalEdit}
        searchQuery={searchQuery}
        highlightSearch={highlightSearch}
        onExternalEditConsumed={() => setExternalEdit(false)}
      />
    </div>,
  );
};

const ListAuditSelectionHeader = ({ api }) => {
  const checkboxRef = useRef(null);
  const [selectionState, setSelectionState] = useState({
    allSelected: false,
    partiallySelected: false,
  });

  useEffect(() => {
    if (!api) return undefined;

    const syncSelectionState = () => {
      let selectableCount = 0;
      let selectedCount = 0;

      api.forEachNodeAfterFilterAndSort((node) => {
        if (!node?.selectable) return;
        selectableCount += 1;
        if (node.isSelected()) {
          selectedCount += 1;
        }
      });

      setSelectionState({
        allSelected: selectableCount > 0 && selectedCount === selectableCount,
        partiallySelected:
          selectedCount > 0 && selectedCount < selectableCount,
      });
    };

    syncSelectionState();
    api.addEventListener("selectionChanged", syncSelectionState);
    api.addEventListener("modelUpdated", syncSelectionState);

    return () => {
      api.removeEventListener("selectionChanged", syncSelectionState);
      api.removeEventListener("modelUpdated", syncSelectionState);
    };
  }, [api]);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = selectionState.partiallySelected;
    }
  }, [selectionState]);

  const handleChange = (event) => {
    event.stopPropagation();

    if (!api) return;

    if (event.target.checked) {
      api.selectAll();
      return;
    }

    api.deselectAll();
  };

  return (
    <div className="list-audit-ag-grid-selection-checkbox-wrap">
      <input
        ref={checkboxRef}
        type="checkbox"
        className="list-audit-ag-grid-selection-checkbox"
        checked={selectionState.allSelected}
        onChange={handleChange}
        aria-label="Select all rows"
      />
    </div>
  );
};

const ListAuditSelectionCell = ({ node }) => {
  const [checked, setChecked] = useState(Boolean(node?.isSelected?.()));

  useEffect(() => {
    if (!node) return undefined;

    const syncChecked = () => {
      setChecked(node.isSelected());
    };

    syncChecked();
    node.addEventListener("rowSelected", syncChecked);

    return () => {
      node.removeEventListener("rowSelected", syncChecked);
    };
  }, [node]);

  const handleChange = (event) => {
    event.stopPropagation();
    node?.setSelected?.(event.target.checked);
  };

  return (
    <div className="list-audit-ag-grid-selection-checkbox-wrap">
      <input
        type="checkbox"
        className="list-audit-ag-grid-selection-checkbox"
        checked={checked}
        onChange={handleChange}
        aria-label="Select row"
      />
    </div>
  );
};

const ListAuditTreeToggleHeader = ({
  treeRows = [],
  treeCollapseState = {},
  onTreeToggleAll = null,
}) => {
  const rows = Array.isArray(treeRows) ? treeRows : [];
  const hasExpandableRows = rows.some(
    (row) =>
      Boolean(row?.hasChildren) ||
      String(row?.RowType ?? "").trim().toLowerCase() === "group",
  );
  const allCollapsed =
    hasExpandableRows &&
    rows.every((row) => {
      const isExpandable =
        Boolean(row?.hasChildren) ||
        String(row?.RowType ?? "").trim().toLowerCase() === "group";
      if (!isExpandable) return true;
      const key = row?.__key;
      return key ? Boolean(treeCollapseState?.[key]) : false;
    });

  if (!hasExpandableRows) {
    return <span aria-hidden="true">&nbsp;</span>;
  }

  return (
    <button
      type="button"
      className="btn btn-link p-0 d-inline-flex align-items-center justify-content-center"
      aria-label={allCollapsed ? "Expand all rows" : "Collapse all rows"}
      title={allCollapsed ? "Expand all" : "Collapse all"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onTreeToggleAll === "function") {
          onTreeToggleAll();
        }
      }}
    >
      {allCollapsed ? <PlusSquare size={14} /> : <MinusSquare size={14} />}
    </button>
  );
};

const ListAuditAgGridTable = ({
  tableRef,
  sortedData,
  selectedIds,
  setSelectedIds,
  uniqueCols,
  normalizedHeaderMap,
  editMode,
  actionKeys,
  onStatusClick,
  uploadColumns,
  fixedDateColumns,
  toggleColumns,
  toggleMode,
  endpointName,
  highlightCondition,
  onParentFilter,
  onNavigateToChange,
  canEditCell,
  cellEditablePredicate = null,
  enableMillionFormat,
  source,
  distinctConfig,
  searchQuery,
  searchScope,
  safeEditHandler,
  highlightRowId,
  suggestionValuesByColumn,
  nonEditableColumns = [],
  treeMode = false,
  onTreeToggle = null,
  treeRows = [],
  treeCollapseState = {},
  onTreeToggleAll = null,
}) => {
  const gridRef = useRef(null);
  const gridShellRef = useRef(null);
  const lastScrollPositionRef = useRef({ left: 0, top: 0 });
  const defaultColDef = useMemo(
    () => ({
      sortable: false,
      filter: false,
      resizable: true,
      suppressMovable: true,
      wrapHeaderText: true,
      autoHeaderHeight: false,
      wrapText: true,
      autoHeight: true,
    }),
    [],
  );
  const { gridRows, pinnedBottomRows } = useMemo(() => {
    const rows = Array.isArray(sortedData) ? sortedData : [];
    const pinned = rows.filter((row) => row?.__isTotalRow);
    const dataRows = rows.filter((row) => !row?.__isTotalRow);
    return {
      gridRows: dataRows,
      pinnedBottomRows: pinned,
    };
  }, [sortedData]);
  const isAuditSummary = isAuditSummaryTable(endpointName);

  const columnDefs = useMemo(() => {
    const useWeeklySizing = isWeeklyComplianceTable(endpointName);
    const isHumanResourceTable = HUMAN_RESOURCE_TABLE_KEYS.has(
      normalizeEndpointToken(endpointName),
    );
    const isOpexTable = isPlanningOpexTable(endpointName);
    const isOpexTreeMode =
      isOpexTable && treeMode && typeof onTreeToggle === "function";
    const dataColumnDefs = uniqueCols.map((col) => {
        const normalizedKey = normalizePinnedColumnKey(col);
        const pinned =
          LIST_AUDIT_AG_GRID_PINNED_KEYS.has(col)
            ? "left"
            : isOpexTable && OPEX_TEMPLATE_PINNED_COLUMN_KEYS.has(normalizedKey)
              ? "left"
              : undefined;
        const isMasterColumn =
          normalizedKey === "ACTION" ||
          normalizedKey === "NO";
        const isOpexTextColumn =
          isOpexTable && OPEX_TEMPLATE_TEXT_COLUMNS.has(normalizedKey);
        const isOpexNumericColumn =
          isOpexTable && OPEX_TEMPLATE_NUMERIC_COLUMNS.has(normalizedKey);
        const isHumanResourceNumericColumn =
          isHumanResourceTable && HUMAN_RESOURCE_NUMERIC_COLUMNS.has(normalizedKey);
        const isHumanResourceTextColumn =
          isHumanResourceTable &&
          normalizedKey !== "ACTION" &&
          !isHumanResourceNumericColumn;
        const useAutoHeight = isOpexTable
          ? isOpexTextColumn
          : (isAgGridMultilineColumn(endpointName, col) || isHumanResourceTextColumn);
        const isLeftAlignedColumn =
          LIST_AUDIT_AG_GRID_LEFT_ALIGNED_COLUMNS.has(normalizedKey) &&
          !isMasterColumn ||
          isHumanResourceTextColumn ||
          isOpexTextColumn;
        const isRightAlignedColumn = isOpexNumericColumn;
        const isCompactColumn =
          !isMasterColumn && !isLeftAlignedColumn && !isRightAlignedColumn && !useAutoHeight;
        const weeklyColumnConfig = useWeeklySizing
          ? getWeeklyTableGridColumnConfig(col)
          : null;
        const humanResourceColumnConfig = getHumanResourceGridColumnConfig(endpointName, col);
        const opexColumnConfig = isOpexTable
          ? getOpexGridColumnConfig(col)
          : null;

        return {
          colId: col,
          field: col,
          headerName: normalizedHeaderMap[col.toLowerCase()] || col,
          headerTooltip: normalizedHeaderMap[col.toLowerCase()] || col,
          headerClass: [
            "list-audit-ag-grid-header--center",
          ]
            .filter(Boolean)
            .join(" "),
          headerStyle: {
            textAlign: "center",
            justifyContent: "center",
            alignItems: "center",
          },
          pinned,
          lockPinned: Boolean(pinned),
          lockPosition: pinned ? "left" : undefined,
          suppressMovable: true,
          resizable: true,
          width:
            opexColumnConfig?.width ??
            weeklyColumnConfig?.width ??
            humanResourceColumnConfig?.width ??
            getListAuditGridColumnWidth(col),
          minWidth:
            opexColumnConfig?.minWidth ??
            weeklyColumnConfig?.minWidth ??
            humanResourceColumnConfig?.minWidth ??
            getListAuditGridMinWidth(col),
          flex:
            opexColumnConfig?.flex ??
            weeklyColumnConfig?.flex ??
            humanResourceColumnConfig?.flex ??
            (isAuditSummary ? 1 : undefined),
          autoHeight: useAutoHeight,
          wrapText: useAutoHeight,
          valueGetter:
            normalizedKey === "NO"
              ? (params) =>
                  params.data?.NO ?? (params.node?.rowIndex ?? 0) + 1
              : undefined,
          cellClass: [
            pinned ? "list-audit-ag-grid-cell--pinned" : "",
            normalizedKey === "ACTION" ? "list-audit-ag-grid-cell--action" : "",
            normalizedKey === "NO" ? "list-audit-ag-grid-cell--number" : "",
            normalizedKey === "NAMAAUDIT" ? "list-audit-ag-grid-cell--name" : "",
            useAutoHeight ? "list-audit-ag-grid-cell--multiline" : "",
            isLeftAlignedColumn ? "list-audit-ag-grid-cell--text" : "",
            isRightAlignedColumn ? "list-audit-ag-grid-cell--right" : "",
            isCompactColumn ? "list-audit-ag-grid-cell--compact" : "",
          ]
            .filter(Boolean)
            .join(" "),
          cellStyle: isMasterColumn
            ? {
                textAlign: "center",
                justifyContent: "center",
                alignItems: "center",
              }
            : isLeftAlignedColumn
              ? {
                  textAlign: "left",
                  justifyContent: "flex-start",
                  alignItems: useAutoHeight ? "flex-start" : "center",
                }
              : isRightAlignedColumn
                ? {
                    textAlign: "right",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }
              : isCompactColumn
                ? {
                    textAlign: "center",
                    justifyContent: "center",
                    alignItems: "center",
                  }
            : undefined,
          cellRenderer: ListAuditAgGridCell,
          cellRendererParams: {
            columnKey: col,
            sortedData: gridRows,
            safeEditHandler,
            canEditCell,
            cellEditablePredicate,
            nonEditableColumns,
            actionKeys,
            onStatusClick,
            endpointName,
            onParentFilter,
            onNavigateToChange,
            uploadColumns,
            fixedDateColumns,
            toggleColumns,
            toggleMode,
            enableMillionFormat,
            source,
            distinctConfig,
            searchQuery,
            searchScope,
            suggestionValuesByColumn,
            multilineEditor: useAutoHeight,
            treeMode: isOpexTreeMode,
            onTreeToggle,
          },
        };
      });

    const treeToggleColumn = isOpexTreeMode
      ? [
          {
            colId: "__TREE__",
            field: "__TREE__",
            headerName: "",
            pinned: "left",
            lockPinned: true,
            lockPosition: "left",
            suppressMovable: true,
            suppressHeaderMenuButton: true,
            sortable: false,
            resizable: false,
            width: 42,
            minWidth: 42,
            maxWidth: 42,
            autoHeight: false,
            wrapText: false,
            suppressSizeToFit: true,
            suppressAutoSize: true,
            headerClass: "list-audit-ag-grid-header--center",
            cellClass: "list-audit-ag-grid-cell--compact",
            headerComponent: ListAuditTreeToggleHeader,
            headerComponentParams: {
              treeRows,
              treeCollapseState,
              onTreeToggleAll,
            },
            cellRenderer: ListAuditAgGridCell,
            cellRendererParams: {
              columnKey: "__TREE__",
              sortedData: gridRows,
              safeEditHandler,
              canEditCell,
              cellEditablePredicate,
              nonEditableColumns,
              actionKeys,
              onStatusClick,
              endpointName,
              onParentFilter,
              onNavigateToChange,
              uploadColumns,
              fixedDateColumns,
              toggleColumns,
              toggleMode,
              enableMillionFormat,
              source,
              distinctConfig,
              searchQuery,
              searchScope,
              suggestionValuesByColumn,
              multilineEditor: false,
              treeMode: true,
              onTreeToggle,
            },
          },
        ]
      : [];

    if (!editMode) {
      return [...treeToggleColumn, ...dataColumnDefs];
    }

    return [
      {
        colId: "__selection__",
        field: "__selection__",
        headerName: "",
        pinned: "left",
        lockPinned: true,
        lockPosition: "left",
        suppressMovable: true,
        suppressHeaderMenuButton: true,
        sortable: false,
        resizable: false,
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        autoHeight: false,
        wrapText: false,
        suppressSizeToFit: true,
        suppressAutoSize: true,
        headerClass: "list-audit-ag-grid-selection-header",
        cellClass: "list-audit-ag-grid-selection-cell",
        headerComponent: ListAuditSelectionHeader,
        cellRenderer: ListAuditSelectionCell,
      },
      ...treeToggleColumn,
      ...dataColumnDefs,
    ];
  }, [
      uniqueCols,
      editMode,
      normalizedHeaderMap,
      gridRows,
      safeEditHandler,
      canEditCell,
      cellEditablePredicate,
      actionKeys,
      onStatusClick,
      endpointName,
      onParentFilter,
      onNavigateToChange,
      uploadColumns,
      fixedDateColumns,
      nonEditableColumns,
      toggleColumns,
      toggleMode,
      enableMillionFormat,
      source,
      distinctConfig,
      searchQuery,
      searchScope,
      suggestionValuesByColumn,
      endpointName,
      isAuditSummary,
      treeMode,
      onTreeToggle,
      treeRows,
      treeCollapseState,
      onTreeToggleAll,
    ]);

  const getRowId = useCallback(
    (params) =>
      String(
        params.data?.__rowKey ??
          params.data?.Id ??
          params.data?.id ??
          params.data?.ID ??
          "",
      ),
    [],
  );

  const getRowClass = useCallback(
    (params) => {
      const rowClasses = [];

      if (highlightCondition?.(params.data)) {
        rowClasses.push("list-audit-ag-grid-row--gap");
      }

      if (
        highlightRowId != null &&
        String(params.data?.Id ?? "") === String(highlightRowId)
      ) {
        rowClasses.push("highlighted-row");
      }

      if (isPlanningOpexTable(endpointName)) {
        const rowType = String(params.data?.RowType ?? "").trim().toUpperCase();
        const childLabel = String(params.data?.MataAnggaranChild ?? "").trim();
        if (rowType === "GROUP" || childLabel.length === 0) {
          rowClasses.push("list-audit-ag-grid-row--opex-template-group");
        }
      }

      return rowClasses.join(" ");
    },
    [endpointName, highlightCondition, highlightRowId],
  );

  const restoreGridViewportScroll = useCallback(() => {
    const gridRoot =
      gridShellRef.current ||
      gridRef.current?.eGridDiv ||
      gridRef.current?.api?.getGui?.() ||
      null;

    if (!gridRoot) return;

    requestAnimationFrame(() => {
      const nextLeft = Math.max(0, lastScrollPositionRef.current.left || 0);
      const nextTop = Math.max(0, lastScrollPositionRef.current.top || 0);

      gridRoot
        .querySelectorAll(
          ".ag-center-cols-viewport, .ag-body-horizontal-scroll-viewport",
        )
        .forEach((element) => {
          if (typeof element.scrollLeft === "number") {
            element.scrollLeft = nextLeft;
          }
        });

      gridRoot
        .querySelectorAll(
          ".ag-body-viewport, .ag-body-vertical-scroll-viewport, .ag-pinned-left-cols-viewport",
        )
        .forEach((element) => {
          if (typeof element.scrollTop === "number") {
            element.scrollTop = nextTop;
          }
        });
    });
  }, []);

  const handleGridBodyScroll = useCallback((event) => {
    lastScrollPositionRef.current = {
      left:
        typeof event?.left === "number"
          ? event.left
          : lastScrollPositionRef.current.left,
      top:
        typeof event?.top === "number"
          ? event.top
          : lastScrollPositionRef.current.top,
    };
  }, []);

  const rowSelection = useMemo(
    () =>
      editMode
        ? {
            mode: "multiRow",
            checkboxes: false,
            headerCheckbox: false,
            enableClickSelection: false,
          }
        : undefined,
    [editMode],
  );

  const syncSelectedRowsFromGrid = useCallback(() => {
    if (!editMode) {
      if (selectedIds.length) {
        setSelectedIds?.([]);
      }
      return;
    }

    const api = gridRef.current?.api;
    if (!api) return;

    const nextSelectedIds = api
      .getSelectedNodes()
      .map((node) => node.data?.Id)
      .filter(Boolean);
    const currentIds = Array.isArray(selectedIds) ? [...selectedIds].map(String).sort() : [];
    const nextIds = nextSelectedIds.map(String).sort();
    if (
      nextIds.length === currentIds.length &&
      nextIds.every((id, index) => id === currentIds[index])
    ) {
      return;
    }

    setSelectedIds?.(nextSelectedIds);
  }, [editMode, selectedIds, setSelectedIds]);

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    if (!editMode) {
      api.deselectAll();
      return;
    }

    const selectedSet = new Set((selectedIds || []).map((id) => String(id)));
    api.forEachNode((node) => {
      const shouldBeSelected = selectedSet.has(String(node.data?.Id ?? ""));
      if (node.isSelected() !== shouldBeSelected) {
        node.setSelected(shouldBeSelected);
      }
    });
  }, [editMode, selectedIds, gridRows]);

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api || !highlightRowId) return;

    const targetIndex = gridRows.findIndex(
      (row) => String(row?.Id ?? "") === String(highlightRowId),
    );

    if (targetIndex >= 0) {
      api.ensureIndexVisible(targetIndex, "middle");
    }
  }, [highlightRowId, gridRows]);

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.redrawRows();
  }, [highlightRowId]);

  return (
    <div ref={tableRef} className="list-audit-ag-grid-shell">
      <div ref={gridShellRef} className="ag-theme-quartz list-audit-ag-grid">
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          enableBrowserTooltips
          rowData={gridRows}
          pinnedBottomRowData={pinnedBottomRows.length ? pinnedBottomRows : undefined}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          getRowClass={getRowClass}
          alwaysShowHorizontalScroll
          alwaysShowVerticalScroll
          onGridSizeChanged={restoreGridViewportScroll}
          onBodyScroll={handleGridBodyScroll}
          onFirstDataRendered={restoreGridViewportScroll}
          reactiveCustomComponents
          suppressCellFocus
          suppressColumnMoveAnimation
          suppressDragLeaveHidesColumns
          rowSelection={rowSelection}
          onSelectionChanged={syncSelectedRowsFromGrid}
          animateRows={false}
          domLayout="normal"
          overlayNoRowsTemplate='<span class="list-audit-ag-grid-empty">There is no data to be shown.</span>'
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------
   🧩 Main Table Component (with toggleMode selector)
------------------------------------------------------------- */
const ListAuditFrozenTable = ({
  sensors,
  sortedData,
  selectedIds,
  setSelectedIds,
  uniqueCols,
  headerStyleBase,
  normalizedHeaderMap,
  editMode,
  enableRowOrder,
  enableColumnDrag,
  actionKeys,
  onStatusClick,
  uploadColumns,
  fixedDateColumns,
  toggleColumns,
  toggleMode,
  endpointName,
  highlightCondition,
  onParentFilter,
  onNavigateToChange,
  canEditCell,
  cellEditablePredicate = null,
  enableMillionFormat,
  source,
  distinctConfig,
  searchQuery,
  searchScope,
  rowSpanMap,
  unmergedCells,
  getCellKey,
  safeEditHandler,
  handleRowDragEnd,
  handleColumnDragEnd,
  hasData,
  pinnedMeasurements,
  listAuditHorizontalControl,
  onListAuditHorizontalControlChange,
  listAuditVerticalControl,
  onListAuditVerticalControlChange,
  suggestionValuesByColumn,
}) => {
  const leftPaneRef = useRef(null);
  const rightPaneRef = useRef(null);
  const rightTableRef = useRef(null);
  const leftHeaderRowRef = useRef(null);
  const rightHeaderRowRef = useRef(null);
  const syncingScrollRef = useRef(false);
  const [rowHeights, setRowHeights] = useState({});
  const [headerHeight, setHeaderHeight] = useState(null);
  const [detailScrollMetrics, setDetailScrollMetrics] = useState({
    scrollWidth: 0,
    clientWidth: 0,
    scrollLeft: 0,
  });

  const masterCols = useMemo(
    () =>
      uniqueCols.filter((column) =>
        ["ACTION", "NO", "NAMAAUDIT"].includes(
          normalizePinnedColumnKey(column),
        ),
      ),
    [uniqueCols],
  );
  const detailCols = useMemo(
    () =>
      uniqueCols.filter(
        (column) =>
          !["ACTION", "NO", "NAMAAUDIT"].includes(
            normalizePinnedColumnKey(column),
          ),
      ),
    [uniqueCols],
  );

  const allIds = sortedData
    .filter((row) => !row?.__isTotalRow)
    .map((row) => row.Id);
  const isAllSelected = selectedIds.length === allIds.length;
  const isIndeterminate = selectedIds.length > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(allIds);
  };

  const masterPaneWidth = useMemo(() => {
    const selectorWidth = editMode
      ? pinnedMeasurements?.selectorWidth || STICKY_SELECTOR_WIDTH
      : 0;
    const dragWidth = enableRowOrder
      ? pinnedMeasurements?.dragWidth || STICKY_DRAG_WIDTH
      : 0;
    const actionWidth =
      pinnedMeasurements?.columnWidths?.ACTION ||
      LIST_AUDIT_PINNED_COLUMN_WIDTHS.Action;
    const noWidth =
      pinnedMeasurements?.columnWidths?.NO || LIST_AUDIT_PINNED_COLUMN_WIDTHS.NO;
    const nameWidth =
      pinnedMeasurements?.columnWidths?.NAMAAUDIT ||
      LIST_AUDIT_PINNED_COLUMN_WIDTHS.NAMAAUDIT;

    return selectorWidth + dragWidth + actionWidth + noWidth + nameWidth;
  }, [editMode, enableRowOrder, pinnedMeasurements]);

  const maxHorizontalScroll = Math.max(
    0,
    detailScrollMetrics.scrollWidth - detailScrollMetrics.clientWidth,
  );

  useEffect(() => {
    const leftPane = leftPaneRef.current;
    const rightPane = rightPaneRef.current;

    if (!leftPane || !rightPane) return undefined;

    const syncLeftFromRight = () => {
      if (syncingScrollRef.current) return;
      syncingScrollRef.current = true;
      leftPane.scrollTop = rightPane.scrollTop;
      setDetailScrollMetrics((prev) => ({
        ...prev,
        clientWidth: rightPane.clientWidth,
        scrollWidth: Math.max(prev.scrollWidth, rightPane.scrollWidth),
        scrollLeft: rightPane.scrollLeft,
      }));
      onListAuditHorizontalControlChange?.({
        max: Math.max(0, rightPane.scrollWidth - rightPane.clientWidth),
        value: rightPane.scrollLeft,
      });
      onListAuditVerticalControlChange?.({
        max: Math.max(0, rightPane.scrollHeight - rightPane.clientHeight),
        value: rightPane.scrollTop,
      });
      requestAnimationFrame(() => {
        syncingScrollRef.current = false;
      });
    };

    const syncRightFromLeft = () => {
      if (syncingScrollRef.current) return;
      syncingScrollRef.current = true;
      rightPane.scrollTop = leftPane.scrollTop;
      onListAuditVerticalControlChange?.({
        max: Math.max(0, rightPane.scrollHeight - rightPane.clientHeight),
        value: leftPane.scrollTop,
      });
      requestAnimationFrame(() => {
        syncingScrollRef.current = false;
      });
    };

    const forwardWheel = (event) => {
      rightPane.scrollTop += event.deltaY;
      rightPane.scrollLeft += event.deltaX;
      event.preventDefault();
    };

    rightPane.addEventListener("scroll", syncLeftFromRight);
    leftPane.addEventListener("scroll", syncRightFromLeft);
    leftPane.addEventListener("wheel", forwardWheel, { passive: false });

    return () => {
      rightPane.removeEventListener("scroll", syncLeftFromRight);
      leftPane.removeEventListener("scroll", syncRightFromLeft);
      leftPane.removeEventListener("wheel", forwardWheel);
    };
  }, [onListAuditHorizontalControlChange, onListAuditVerticalControlChange]);

  useEffect(() => {
    const rightPane = rightPaneRef.current;
    if (!rightPane) return;

    const requestedLeft = Math.max(
      0,
      Math.min(listAuditHorizontalControl?.value || 0, maxHorizontalScroll),
    );

    if (Math.abs(rightPane.scrollLeft - requestedLeft) > 1) {
      rightPane.scrollLeft = requestedLeft;
    }
  }, [listAuditHorizontalControl?.value, maxHorizontalScroll]);

  useEffect(() => {
    const rightPane = rightPaneRef.current;
    const leftPane = leftPaneRef.current;
    if (!rightPane || !leftPane) return;

    const maxVerticalScroll = Math.max(
      0,
      rightPane.scrollHeight - rightPane.clientHeight,
    );
    const requestedTop = Math.max(
      0,
      Math.min(listAuditVerticalControl?.value || 0, maxVerticalScroll),
    );

    if (Math.abs(rightPane.scrollTop - requestedTop) > 1) {
      rightPane.scrollTop = requestedTop;
    }

    if (Math.abs(leftPane.scrollTop - requestedTop) > 1) {
      leftPane.scrollTop = requestedTop;
    }
  }, [listAuditVerticalControl?.value, sortedData.length]);

  useLayoutEffect(() => {
    const leftPane = leftPaneRef.current;
    const rightPane = rightPaneRef.current;

    if (!leftPane || !rightPane || !sortedData.length) {
      setRowHeights((prev) => (Object.keys(prev).length ? {} : prev));
      return undefined;
    }

    const measureHeights = () => {
      const nextHeaderHeight = Math.max(
        Math.ceil(leftHeaderRowRef.current?.getBoundingClientRect().height || 0),
        Math.ceil(rightHeaderRowRef.current?.getBoundingClientRect().height || 0),
      );

      setHeaderHeight((prev) => {
        if (nextHeaderHeight <= 0 || prev === nextHeaderHeight) {
          return prev;
        }

        return nextHeaderHeight;
      });

      const leftRows = Array.from(
        leftPane.querySelectorAll("tbody tr[data-row-id]"),
      );
      const rightRows = Array.from(
        rightPane.querySelectorAll("tbody tr[data-row-id]"),
      );
      const nextHeights = {};

      sortedData.forEach((row, index) => {
        const leftHeight = Math.ceil(
          leftRows[index]?.getBoundingClientRect().height || 0,
        );
        const rightHeight = Math.ceil(
          rightRows[index]?.getBoundingClientRect().height || 0,
        );
        const height = Math.max(leftHeight, rightHeight);

        if (height > 0) {
          nextHeights[row.Id] = height;
        }
      });

      setRowHeights((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(nextHeights);

        if (
          prevKeys.length === nextKeys.length &&
          nextKeys.every((key) => prev[key] === nextHeights[key])
        ) {
          return prev;
        }

        return nextHeights;
      });

      const measuredScrollWidth = Math.max(
        rightPane.scrollWidth,
        measureTableContentWidth(rightTableRef.current),
      );

      setDetailScrollMetrics({
        scrollWidth: measuredScrollWidth,
        clientWidth: rightPane.clientWidth,
        scrollLeft: rightPane.scrollLeft,
      });
      onListAuditHorizontalControlChange?.({
        max: Math.max(0, measuredScrollWidth - rightPane.clientWidth),
        value: rightPane.scrollLeft,
      });
      onListAuditVerticalControlChange?.({
        max: Math.max(0, rightPane.scrollHeight - rightPane.clientHeight),
        value: rightPane.scrollTop,
      });
    };

    const frameId = requestAnimationFrame(measureHeights);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            requestAnimationFrame(measureHeights);
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(leftPane);
      resizeObserver.observe(rightPane);
      if (rightTableRef.current) {
        resizeObserver.observe(rightTableRef.current);
      }
    }

    window.addEventListener("resize", measureHeights);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureHeights);
    };
  }, [
    sortedData,
    masterCols,
    detailCols,
    editMode,
    enableRowOrder,
    enableColumnDrag,
    onListAuditHorizontalControlChange,
    onListAuditVerticalControlChange,
  ]);

  const leftColSpan =
    masterCols.length + (editMode ? 1 : 0) + (enableRowOrder ? 1 : 0);
  const rightColSpan = Math.max(detailCols.length, 1);
  const measureTableContentWidth = (tableElement) => {
    if (!tableElement) return 0;

    const headerCells = Array.from(tableElement.querySelectorAll("thead th"));
    const headerWidth = headerCells.reduce(
      (total, cell) => total + Math.ceil(cell.getBoundingClientRect().width || 0),
      0,
    );

    return Math.max(
      headerWidth,
      Math.ceil(tableElement.scrollWidth || 0),
      Math.ceil(tableElement.getBoundingClientRect?.().width || 0),
    );
  };

  return (
    <div className="list-audit-split-shell">
      <div
        ref={leftPaneRef}
        className="list-audit-split-master-pane"
        style={{ width: masterPaneWidth, minWidth: masterPaneWidth }}
      >
        <Table
          hover
          className="table sticky-table list-audit-split-master-table"
          style={{ width: "max-content", minWidth: "100%" }}
        >
          <thead>
            <tr
              ref={leftHeaderRowRef}
              style={headerHeight ? { height: headerHeight } : undefined}
            >
              {editMode && (
                <th
                  className="sticky-selector"
                  style={{
                    zIndex: 20,
                    width: STICKY_SELECTOR_WIDTH,
                    minWidth: STICKY_SELECTOR_WIDTH,
                    maxWidth: STICKY_SELECTOR_WIDTH,
                  }}
                >
                  <Input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    innerRef={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                  />
                </th>
              )}
              {enableRowOrder && (
                <th
                  className="sticky-row-handle-header"
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 19,
                    width: STICKY_DRAG_WIDTH,
                    minWidth: STICKY_DRAG_WIDTH,
                    maxWidth: STICKY_DRAG_WIDTH,
                    background: "#f8f9fa",
                  }}
                />
              )}
              {masterCols.map((col) => (
                <th
                  key={`master-head-${col}`}
                  data-column-id={col}
                  style={{ ...headerStyleBase, background: "#f8f9fa" }}
                >
                  {normalizedHeaderMap[col.toLowerCase()] || col}
                </th>
              ))}
            </tr>
          </thead>
          {enableRowOrder ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleRowDragEnd}
            >
              <SortableContext
                items={sortedData.map((row) => row.Id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {hasData ? (
                    sortedData.map((row, idx) => (
                      <SortableRow
                        key={`master-${row.Id}`}
                        row={row}
                        rowIdx={idx}
                        editMode={editMode}
                        showSelectorColumn={editMode}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                        uniqueCols={masterCols}
                        rowSpanMap={rowSpanMap}
                        unmergedCells={unmergedCells}
                        getCellKey={getCellKey}
                        safeEditHandler={safeEditHandler}
                        sortedData={sortedData}
                        actionKeys={actionKeys}
                        onStatusClick={onStatusClick}
                        uploadColumns={uploadColumns}
                        fixedDateColumns={fixedDateColumns}
                        toggleColumns={toggleColumns}
                        toggleMode={toggleMode}
                        endpointName={endpointName}
                        highlightCondition={highlightCondition}
                        onParentFilter={onParentFilter}
                        onNavigateToChange={onNavigateToChange}
                        canEditCell={canEditCell}
                        cellEditablePredicate={cellEditablePredicate}
                        enableRowOrder={enableRowOrder}
                        showRowHandle={enableRowOrder}
                        enableMillionFormat={enableMillionFormat}
                        forcedRowHeight={rowHeights[row.Id]}
                        source={source}
                        distinctConfig={distinctConfig}
                        searchQuery={searchQuery}
                        searchScope={searchScope}
                        suggestionValuesByColumn={suggestionValuesByColumn}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={leftColSpan} style={{ textAlign: "center", color: "#6c757d", padding: "24px 0", fontStyle: "italic" }}>
                        <span title="You may not have access to the data, or the data hasn’t been input yet.">
                          There is no data to be shown.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </DndContext>
          ) : (
            <tbody>
              {hasData ? (
                sortedData.map((row, idx) => (
                  <SortableRow
                    key={`master-${row.Id}`}
                    row={row}
                    rowIdx={idx}
                    editMode={editMode}
                    showSelectorColumn={editMode}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    uniqueCols={masterCols}
                    rowSpanMap={rowSpanMap}
                    unmergedCells={unmergedCells}
                    getCellKey={getCellKey}
                    safeEditHandler={safeEditHandler}
                    sortedData={sortedData}
                    actionKeys={actionKeys}
                    onStatusClick={onStatusClick}
                    uploadColumns={uploadColumns}
                    fixedDateColumns={fixedDateColumns}
                    toggleColumns={toggleColumns}
                    toggleMode={toggleMode}
                    endpointName={endpointName}
                    highlightCondition={highlightCondition}
                    onParentFilter={onParentFilter}
                    onNavigateToChange={onNavigateToChange}
                    canEditCell={canEditCell}
                    cellEditablePredicate={cellEditablePredicate}
                    enableRowOrder={false}
                    showRowHandle={false}
                    enableMillionFormat={enableMillionFormat}
                    forcedRowHeight={rowHeights[row.Id]}
                    source={source}
                    distinctConfig={distinctConfig}
                    searchQuery={searchQuery}
                    searchScope={searchScope}
                    suggestionValuesByColumn={suggestionValuesByColumn}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={leftColSpan} style={{ textAlign: "center", color: "#6c757d", padding: "24px 0", fontStyle: "italic" }}>
                    <span title="You may not have access to the data, or the data hasn’t been input yet.">
                      There is no data to be shown.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </Table>
      </div>

      <div
        ref={rightPaneRef}
        className="list-audit-split-detail-pane"
      >
        <Table
          innerRef={rightTableRef}
          hover
          className="table sticky-table list-audit-split-detail-table"
          style={{ width: "max-content", minWidth: "100%" }}
        >
          <thead>
            <tr
              ref={rightHeaderRowRef}
              style={headerHeight ? { height: headerHeight } : undefined}
            >
              {enableColumnDrag && detailCols.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleColumnDragEnd}
                >
                  <SortableContext
                    items={detailCols}
                    strategy={horizontalListSortingStrategy}
                  >
                    {detailCols.map((col) => (
                      <SortableColumnHeader
                        key={`detail-head-${col}`}
                        col={col}
                        label={normalizedHeaderMap[col.toLowerCase()] || col}
                        enableColumnDrag={enableColumnDrag}
                        headerStyle={{ ...headerStyleBase, background: "#f8f9fa" }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : detailCols.length > 0 ? (
                detailCols.map((col) => (
                  <th
                    key={`detail-head-${col}`}
                    data-column-id={col}
                    style={{ ...headerStyleBase, background: "#f8f9fa" }}
                  >
                    {normalizedHeaderMap[col.toLowerCase()] || col}
                  </th>
                ))
              ) : (
                <th style={{ ...headerStyleBase, background: "#f8f9fa" }}>
                  Details
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {hasData ? (
              sortedData.map((row, idx) => (
                <SortableRow
                  key={`detail-${row.Id}`}
                  row={row}
                  rowIdx={idx}
                  editMode={false}
                  showSelectorColumn={false}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  uniqueCols={detailCols}
                  rowSpanMap={rowSpanMap}
                  unmergedCells={unmergedCells}
                  getCellKey={getCellKey}
                  safeEditHandler={safeEditHandler}
                  sortedData={sortedData}
                  actionKeys={actionKeys}
                  onStatusClick={onStatusClick}
                  uploadColumns={uploadColumns}
                  fixedDateColumns={fixedDateColumns}
                  toggleColumns={toggleColumns}
                  toggleMode={toggleMode}
                  endpointName={endpointName}
                  highlightCondition={highlightCondition}
                  onParentFilter={onParentFilter}
                  onNavigateToChange={onNavigateToChange}
                  canEditCell={canEditCell}
                  cellEditablePredicate={cellEditablePredicate}
                  enableRowOrder={false}
                  showRowHandle={false}
                  enableMillionFormat={enableMillionFormat}
                  forcedRowHeight={rowHeights[row.Id]}
                  source={source}
                  distinctConfig={distinctConfig}
                  searchQuery={searchQuery}
                  searchScope={searchScope}
                  suggestionValuesByColumn={suggestionValuesByColumn}
                />
              ))
            ) : (
              <tr>
                <td colSpan={rightColSpan} style={{ textAlign: "center", color: "#6c757d", padding: "24px 0", fontStyle: "italic" }}>
                  <span title="You may not have access to the data, or the data hasn’t been input yet.">
                    There is no data to be shown.
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

const RenderTableBody = ({
  canEditCell,
  cellEditablePredicate = null,
  highlightRowId,
  editMode,
  derivedColumns,
  headerMap,
  sortedData,
  setSortedData,
  selectedIds,
  setSelectedIds,
  safeEditHandler,
  actionKeys,
  onStatusClick,
  uploadColumns,
  fixedDateColumns,
  nonEditableColumns = [],
  toggleColumns,
  toggleMode: toggleModeProp = "single", // <— rename it
  getCellKey,
  rowSpanMap,
  unmergedCells,
  endpointName,
  onParentFilter,
  onNavigateToChange,
  highlightCondition,
  enableColumnDrag = true,
  enableRowOrder, // 👈 default disabled
  enableMillionFormat,

  source,

  distinctConfig,
  searchQuery = "",
  searchScope = SEARCH_SCOPE_ALL,
  listAuditHorizontalControl,
  onListAuditHorizontalControlChange,
  useGridRenderer = false,
  persistColumnOrder = true,
  suggestionValuesByColumn = null,
  treeMode = false,
  onTreeToggle = null,
  treeRows = [],
  treeCollapseState = {},
  onTreeToggleAll = null,
}) => {
  const sensors = useSensors(useSensor(PointerSensor));
  const tableRef = useRef(null);

  /* -------------------------------------------------------------
     🆕 Toggle Mode State
  ------------------------------------------------------------- */
  const [toggleMode] = useState(toggleModeProp);
  const [pinnedMeasurements, setPinnedMeasurements] = useState({
    selectorWidth: STICKY_SELECTOR_WIDTH,
    dragWidth: STICKY_DRAG_WIDTH,
    columnWidths: {},
  });
  const isAuditListAuditTable = isListAuditTable(endpointName) || useGridRenderer;
  const getSuggestionValuesForColumn = useCallback(
    (column, row = null) =>
      getMergedEditorSuggestions(sortedData, column, suggestionValuesByColumn, row),
    [sortedData, suggestionValuesByColumn],
  );

  const headerStyleBase = {
    background: "inherit",
    color: "inherit",
    fontWeight: 400,
    whiteSpace: "normal",
    borderBottom: "2px solid #dee2e6",
    padding: "8px 10px",
  };

  const [columnOrder, setColumnOrder] = useState(() =>
    normalizeColumnOrder(
      Array.isArray(derivedColumns) ? derivedColumns : [],
      endpointName,
    ),
  );
  const derivedColumnsKey = useMemo(
    () => (Array.isArray(derivedColumns) ? derivedColumns.join("|") : ""),
    [derivedColumns],
  );

  useEffect(() => {
    let cancelled = false;

    const fallbackColumns = Array.isArray(derivedColumns) ? derivedColumns : [];
    if (!persistColumnOrder) {
      setColumnOrder(fallbackColumns);
      return () => {
        cancelled = true;
      };
    }
    const requestKey = `${endpointName}::${COLUMN_ORDER_VIEW_KEY}`;

    const applyColumnOrder = (savedOrder) => {
      const nextOrder = canonicalizeColumnOrder(
        savedOrder,
        fallbackColumns,
        headerMap,
        endpointName,
      );

      if (!cancelled) {
        setColumnOrder((prev) => (arraysEqual(prev, nextOrder) ? prev : nextOrder));
      }
    };

    if (!endpointName) {
      applyColumnOrder(fallbackColumns);
      return () => {
        cancelled = true;
      };
    }

    if (columnOrderCache.has(requestKey)) {
      applyColumnOrder(columnOrderCache.get(requestKey));
      return () => {
        cancelled = true;
      };
    }

    const fetchColumnOrder = async () => {
      try {
        let request = columnOrderInflight.get(requestKey);

        if (!request) {
          request = fetch(
            `${process.env.REACT_APP_API_BASE_URL}columnorder?tableName=${endpointName}&viewKey=${COLUMN_ORDER_VIEW_KEY}`,
            {
              credentials: "include",
            },
          ).then(async (response) => {
            if (!response.ok) {
              throw new Error(`Column order request failed: ${response.status}`);
            }

            return response.json();
          });

          columnOrderInflight.set(requestKey, request);
        }

        const savedOrder = await request;
        columnOrderCache.set(requestKey, Array.isArray(savedOrder) ? savedOrder : []);
        applyColumnOrder(savedOrder);
      } catch {
        applyColumnOrder(fallbackColumns);
      } finally {
        columnOrderInflight.delete(requestKey);
      }
    };

    fetchColumnOrder();

    return () => {
      cancelled = true;
    };
  }, [endpointName, derivedColumnsKey, derivedColumns, headerMap, isAuditListAuditTable, persistColumnOrder]);

  // useEffect(() => {
  //   setColumnOrder((prev) => {
  //     const missing = derivedColumns.filter((c) => !prev.includes(c));
  //     return missing.length > 0 ? [...prev, ...missing] : prev;
  //   });
  // }, [derivedColumns, endpointName]);

  const allIds = sortedData
    .filter((row) => !row?.__isTotalRow)
    .map((row) => row.Id);
  const isAllSelected = selectedIds.length === allIds.length;
  const isIndeterminate = selectedIds.length > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(allIds);
  };

  // 🔥 order always respects currently-derived columns
  const uniqueCols = useMemo(() => {
    const visible = new Set(derivedColumns);
    const orderedColumns =
      Array.isArray(columnOrder) && columnOrder.length > 0
        ? columnOrder
        : derivedColumns;
    const normalizedOrderedColumns = canonicalizeColumnOrder(
      orderedColumns,
      derivedColumns,
      headerMap,
      endpointName,
    );

    return [
      ...new Set(
        normalizedOrderedColumns
          .filter(Boolean)
          .map((c) => c.trim())
          .filter((c) => visible.has(c) || c === "Action"),
      ),
    ];
  }, [columnOrder, derivedColumns, endpointName, headerMap]);

  useLayoutEffect(() => {
    if (!isAuditListAuditTable || !tableRef.current) {
      return undefined;
    }

    const tableElement = tableRef.current;
    let frameId = 0;

    const measurePinnedColumns = () => {
      const nextColumnWidths = {};
      LIST_AUDIT_LOCKED_COLUMN_KEYS.forEach((columnKey) => {
        const matchingCells = Array.from(
          tableElement.querySelectorAll(`[data-column-id]`),
        ).filter(
          (cell) =>
            normalizePinnedColumnKey(cell.getAttribute("data-column-id")) ===
            columnKey,
        );

        const measuredWidth = matchingCells.reduce((maxWidth, cell) => {
          const currentWidth = Math.ceil(cell.getBoundingClientRect().width);
          return currentWidth > maxWidth ? currentWidth : maxWidth;
        }, 0);

        nextColumnWidths[columnKey] =
          measuredWidth || LIST_AUDIT_PINNED_COLUMN_WIDTHS[columnKey] || 0;
      });

      const selectorCell = editMode
        ? tableElement.querySelector("thead th.sticky-selector")
        : null;
      const nextSelectorWidth = editMode
        ? Math.ceil(
            selectorCell?.getBoundingClientRect().width || STICKY_SELECTOR_WIDTH,
          )
        : 0;
      const dragCell = enableRowOrder
        ? tableElement.querySelector("thead th.sticky-row-handle-header")
        : null;
      const nextDragWidth = enableRowOrder
        ? Math.ceil(
            dragCell?.getBoundingClientRect().width || STICKY_DRAG_WIDTH,
          )
        : 0;

      setPinnedMeasurements((prev) => {
        const prevWidths = prev.columnWidths || {};
        const sameSelectorWidth = prev.selectorWidth === nextSelectorWidth;
        const sameDragWidth = prev.dragWidth === nextDragWidth;
        const sameColumnWidths = LIST_AUDIT_LOCKED_COLUMN_KEYS.every(
          (key) => prevWidths[key] === nextColumnWidths[key],
        );

        if (sameSelectorWidth && sameDragWidth && sameColumnWidths) {
          return prev;
        }

        return {
          selectorWidth: nextSelectorWidth,
          dragWidth: nextDragWidth,
          columnWidths: nextColumnWidths,
        };
      });
    };

    const scheduleMeasure = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(measurePinnedColumns);
    };

    scheduleMeasure();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleMeasure();
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(tableElement);
      tableElement.querySelectorAll("thead th").forEach((cell) => {
        resizeObserver.observe(cell);
      });
    }

    window.addEventListener("resize", scheduleMeasure);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [isAuditListAuditTable, uniqueCols, editMode, enableRowOrder, sortedData.length]);

  const pinnedColumnMap = useMemo(
    () =>
      buildPinnedColumnMap(uniqueCols, {
        endpointName,
        editMode,
        measuredPinnedWidths: pinnedMeasurements.columnWidths,
        stickySelectorWidth: pinnedMeasurements.selectorWidth,
        stickyDragWidth: enableRowOrder ? pinnedMeasurements.dragWidth || 0 : 0,
      }),
    [uniqueCols, endpointName, editMode, enableRowOrder, pinnedMeasurements],
  );
  const listAuditFreezeStyle = useMemo(() => {
    if (!isAuditListAuditTable) {
      return undefined;
    }

    const selectorWidth = editMode ? pinnedMeasurements.selectorWidth || 0 : 0;
    const dragWidth = enableRowOrder ? pinnedMeasurements.dragWidth || 0 : 0;
    const measuredWidths = pinnedMeasurements.columnWidths || {};
    const actionWidth =
      measuredWidths.ACTION || LIST_AUDIT_PINNED_COLUMN_WIDTHS.Action;
    const noWidth = measuredWidths.NO || LIST_AUDIT_PINNED_COLUMN_WIDTHS.NO;
    const nameWidth =
      measuredWidths.NAMAAUDIT || LIST_AUDIT_PINNED_COLUMN_WIDTHS.NAMAAUDIT;

    return {
      "--list-audit-freeze-drag-left": `${selectorWidth}px`,
      "--list-audit-freeze-drag-width": `${dragWidth}px`,
      "--list-audit-freeze-action-left": `${selectorWidth + dragWidth}px`,
      "--list-audit-freeze-no-left": `${selectorWidth + dragWidth + actionWidth}px`,
      "--list-audit-freeze-name-left": `${selectorWidth + dragWidth + actionWidth + noWidth}px`,
      "--list-audit-freeze-action-width": `${actionWidth}px`,
      "--list-audit-freeze-no-width": `${noWidth}px`,
      "--list-audit-freeze-name-width": `${nameWidth}px`,
    };
  }, [isAuditListAuditTable, editMode, enableRowOrder, pinnedMeasurements]);

  const normalizedHeaderMap = Object.keys(headerMap || {}).reduce((acc, k) => {
    if (!k || typeof k !== "string" || k.trim() === "") return acc; // skip bad keys
    acc[k.toLowerCase()] = headerMap[k];
    return acc;
  }, {});

  const handleRowDragEnd = async ({ active, over }) => {
    // Row-order deprecated globally. Keep handler as a no-op for compatibility.
    return;
  };

  const handleColumnDragEnd = async ({ active, over }) => {
    if (!persistColumnOrder) return;
    if (!over || active.id === over.id) return;
    if (
      isLockedListAuditColumn(active.id, endpointName) ||
      isLockedListAuditColumn(over.id, endpointName)
    ) {
      return;
    }

    const oldIndex = columnOrder.indexOf(active.id);
    const newIndex = columnOrder.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = normalizeColumnOrder(
      arrayMove(columnOrder, oldIndex, newIndex),
      endpointName,
    );
    setColumnOrder(newOrder);

    const payload = newOrder.map((col, index) => ({
      tableName: endpointName,
      columnKey: col,
      columnIndex: index + 1,
      viewKey: COLUMN_ORDER_VIEW_KEY,
    }));

    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}columnorder/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      columnOrderCache.set(`${endpointName}::${COLUMN_ORDER_VIEW_KEY}`, newOrder);
    } catch (err) {
      console.error("Column order save failed", err);
    }
  };

  // if (!sortedData || sortedData.length === 0) {
  //   return <p className="text-center text-muted mt-3">Loading table...</p>;
  // }

  const hasData = Array.isArray(sortedData) && sortedData.length > 0;
  if (isAuditListAuditTable && !enableRowOrder) {
    return (
      <ListAuditAgGridTable
        tableRef={tableRef}
        sortedData={sortedData}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        uniqueCols={uniqueCols}
        normalizedHeaderMap={normalizedHeaderMap}
        editMode={editMode}
        actionKeys={actionKeys}
        onStatusClick={onStatusClick}
        uploadColumns={uploadColumns}
        fixedDateColumns={fixedDateColumns}
        toggleColumns={toggleColumns}
        toggleMode={toggleMode}
        endpointName={endpointName}
        highlightCondition={highlightCondition}
        onParentFilter={onParentFilter}
        onNavigateToChange={onNavigateToChange}
        canEditCell={canEditCell}
        cellEditablePredicate={cellEditablePredicate}
        enableMillionFormat={enableMillionFormat}
        source={source}
        distinctConfig={distinctConfig}
        searchQuery={searchQuery}
        searchScope={searchScope}
        safeEditHandler={safeEditHandler}
        highlightRowId={highlightRowId}
        suggestionValuesByColumn={suggestionValuesByColumn}
        nonEditableColumns={nonEditableColumns}
        treeMode={treeMode}
        onTreeToggle={onTreeToggle}
        treeRows={treeRows}
        treeCollapseState={treeCollapseState}
        onTreeToggleAll={onTreeToggleAll}
      />
    );
  }

  if (isAuditListAuditTable) {
    return (
      <ListAuditFrozenTable
        tableRef={tableRef}
        sensors={sensors}
        sortedData={sortedData}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        uniqueCols={uniqueCols}
        headerStyleBase={headerStyleBase}
        normalizedHeaderMap={normalizedHeaderMap}
        editMode={editMode}
        enableRowOrder={enableRowOrder}
        enableColumnDrag={enableColumnDrag}
        actionKeys={actionKeys}
        onStatusClick={onStatusClick}
        uploadColumns={uploadColumns}
        fixedDateColumns={fixedDateColumns}
        toggleColumns={toggleColumns}
        toggleMode={toggleMode}
        endpointName={endpointName}
        highlightCondition={highlightCondition}
        onParentFilter={onParentFilter}
        onNavigateToChange={onNavigateToChange}
        canEditCell={canEditCell}
        cellEditablePredicate={cellEditablePredicate}
        enableMillionFormat={enableMillionFormat}
        source={source}
        distinctConfig={distinctConfig}
        searchQuery={searchQuery}
        searchScope={searchScope}
        rowSpanMap={rowSpanMap}
        unmergedCells={unmergedCells}
        getCellKey={getCellKey}
        safeEditHandler={safeEditHandler}
        handleRowDragEnd={handleRowDragEnd}
        handleColumnDragEnd={handleColumnDragEnd}
        hasData={hasData}
        pinnedMeasurements={pinnedMeasurements}
        listAuditHorizontalControl={listAuditHorizontalControl}
        onListAuditHorizontalControlChange={onListAuditHorizontalControlChange}
        suggestionValuesByColumn={suggestionValuesByColumn}
      />
    );
  }
  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
      >
        <Table
          innerRef={tableRef}
          hover
          className={
            isAuditListAuditTable
              ? "table sticky-table list-audit-freeze-table"
              : "table sticky-table table-responsive"
          }
          style={listAuditFreezeStyle}
        >
          <thead>
            <tr>
              {editMode && (
                <th
                  className="sticky-selector"
                  style={{
                    zIndex: "5",
                    width: STICKY_SELECTOR_WIDTH,
                    minWidth: STICKY_SELECTOR_WIDTH,
                    maxWidth: STICKY_SELECTOR_WIDTH,
                  }}
                >
                  <Input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    innerRef={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                  />
                </th>
              )}
              {enableRowOrder && (
                <th
                  className="sticky-row-handle-header"
                  style={{
                    ...(isAuditListAuditTable
                      ? {
                          position: "sticky",
                          top: 0,
                          left: editMode ? STICKY_SELECTOR_WIDTH : 0,
                          zIndex: 221,
                          background: "#f8f9fa",
                          backgroundClip: "padding-box",
                          boxShadow: "1px 0 0 rgba(69, 90, 100, 0.16)",
                        }
                      : null),
                    width: STICKY_DRAG_WIDTH,
                    minWidth: STICKY_DRAG_WIDTH,
                    maxWidth: STICKY_DRAG_WIDTH,
                  }}
                ></th>
              )}

              {enableColumnDrag ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleColumnDragEnd}
                >
                  <SortableContext
                    items={uniqueCols}
                    strategy={horizontalListSortingStrategy}
                  >
                    {uniqueCols.map((col) => {
                      const locked = isLockedListAuditColumn(
                        col,
                        endpointName,
                      );

                      return (
                        <SortableColumnHeader
                          key={col}
                          col={col}
                          label={normalizedHeaderMap[col.toLowerCase()] || col}
                          enableColumnDrag={enableColumnDrag}
                          locked={locked}
                          className={
                            pinnedColumnMap.get(col)
                              ? "sticky-col-header list-audit-pinned-header"
                              : ""
                          }
                          headerStyle={
                            pinnedColumnMap.get(col)
                              ? {
                                  ...headerStyleBase,
                                  position: "sticky",
                                  top: 0,
                                  left: pinnedColumnMap.get(col).left,
                                  width: pinnedColumnMap.get(col).width,
                                  minWidth: pinnedColumnMap.get(col).width,
                                  maxWidth: pinnedColumnMap.get(col).width,
                                  background: "#f8f9fa",
                                  zIndex: pinnedColumnMap.get(col).zIndex + 8,
                                  backgroundClip: "padding-box",
                                  boxShadow: "1px 0 0 rgba(69, 90, 100, 0.16)",
                                }
                              : headerStyleBase
                          }
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              ) : (
                uniqueCols.map((col) => (
                  <th
                    key={col}
                    data-column-id={col}
                    title={normalizedHeaderMap[col.toLowerCase()] || col}
                    aria-label={normalizedHeaderMap[col.toLowerCase()] || col}
                    style={{
                      ...headerStyleBase,
                      ...(pinnedColumnMap.get(col)
                        ? {
                            position: "sticky",
                            top: 0,
                            left: pinnedColumnMap.get(col).left,
                            width: pinnedColumnMap.get(col).width,
                            minWidth: pinnedColumnMap.get(col).width,
                            maxWidth: pinnedColumnMap.get(col).width,
                            background: "#f8f9fa",
                            zIndex: pinnedColumnMap.get(col).zIndex + 8,
                            backgroundClip: "padding-box",
                            boxShadow: "1px 0 0 rgba(69, 90, 100, 0.16)",
                          }
                        : null),
                    }}
                    className={
                      pinnedColumnMap.get(col) && isAuditListAuditTable
                        ? "sticky-col-header list-audit-pinned-header"
                        : undefined
                    }
                  >
                    {normalizedHeaderMap[col.toLowerCase()] || col}
                  </th>
                ))
              )}
            </tr>
          </thead>

          {/* ROWS */}
          {enableRowOrder ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleRowDragEnd}
            >
              <SortableContext
                items={sortedData.map((r) => r.Id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {!Array.isArray(sortedData) ? (
                    <tr>
                      <td
                        colSpan={
                          uniqueCols.length +
                          1 + // drag handle
                          (editMode ? 1 : 0) // checkbox
                        }
                        style={{
                          textAlign: "center",
                          padding: "24px 0",
                        }}
                      >
                        <div
                          className="spinner-border text-primary"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : hasData ? (
                    sortedData.map((row, idx) => (
                      <SortableRow
                        key={String(row?.__rowKey ?? row?.Id ?? `row-${idx}`)}
                        row={row}
                        rowIdx={idx}
                        editMode={editMode}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                        uniqueCols={uniqueCols}
                        rowSpanMap={rowSpanMap}
                        unmergedCells={unmergedCells}
                        getCellKey={getCellKey}
                        safeEditHandler={safeEditHandler}
                        sortedData={sortedData}
                        actionKeys={actionKeys}
                        onStatusClick={onStatusClick}
                        uploadColumns={uploadColumns}
                        fixedDateColumns={fixedDateColumns}
                        toggleColumns={toggleColumns}
                        toggleMode={toggleMode} // 👈 NEW
                        endpointName={endpointName}
                        highlightCondition={highlightCondition}
                        onParentFilter={onParentFilter}
                        onNavigateToChange={onNavigateToChange}
                        canEditCell={canEditCell}
                        cellEditablePredicate={cellEditablePredicate}
                        nonEditableColumns={nonEditableColumns}
                        enableRowOrder={enableRowOrder}
                        source={source}
                        pinnedColumnMap={pinnedColumnMap}
                        distinctConfig={distinctConfig}
                        searchQuery={searchQuery}
                        searchScope={searchScope}
                        suggestionValuesByColumn={suggestionValuesByColumn}
                      />
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={
                          uniqueCols.length +
                          1 + // drag handle
                          (editMode ? 1 : 0) // checkbox
                        }
                        style={{
                          textAlign: "center",
                          color: "#6c757d",
                          padding: "24px 0",
                          fontStyle: "italic",
                        }}
                      >
                        <span title="You may not have access to the data, or the data hasn’t been input yet.">
                          There is no data to be shown.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </DndContext>
          ) : (
            <tbody>
              {hasData ? (
                sortedData.map((row, idx) => (
                  <SortableRow
                    key={String(row?.__rowKey ?? row?.Id ?? `row-${idx}`)}
                    row={row}
                    rowIdx={idx}
                    editMode={editMode}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    uniqueCols={uniqueCols}
                    rowSpanMap={rowSpanMap}
                    unmergedCells={unmergedCells}
                    getCellKey={getCellKey}
                    safeEditHandler={safeEditHandler}
                    sortedData={sortedData}
                    actionKeys={actionKeys}
                    onStatusClick={onStatusClick}
                    uploadColumns={uploadColumns}
                    fixedDateColumns={fixedDateColumns}
                    toggleColumns={toggleColumns}
                    toggleMode={toggleMode} // 👈 NEW
                    endpointName={endpointName}
                    highlightCondition={highlightCondition}
                    onParentFilter={onParentFilter}
                    onNavigateToChange={onNavigateToChange}
                    canEditCell={canEditCell}
                    cellEditablePredicate={cellEditablePredicate}
                    nonEditableColumns={nonEditableColumns}
                    enableMillionFormat={enableMillionFormat}
                    source={source}
                    pinnedColumnMap={pinnedColumnMap}
                    distinctConfig={distinctConfig}
                    searchQuery={searchQuery}
                    searchScope={searchScope}
                    suggestionValuesByColumn={suggestionValuesByColumn}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={
                      uniqueCols.length +
                      1 + // drag handle
                      (editMode ? 1 : 0) // checkbox
                    }
                    style={{
                      textAlign: "center",
                      color: "#6c757d",
                      padding: "24px 0",
                      fontStyle: "italic",
                    }}
                  >
                    <span title="You may not have access to the data, or the data hasn’t been input yet.">
                      There is no data to be shown.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </Table>
      </DndContext>
    </>
  );
};

export default RenderTableBody;
