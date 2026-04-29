/*
 * PGH-DOC

 * File: src/Variables/Table/RenderNestedTable.jsx

 * Apa fungsi bagian ini:

 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).

 * Kenapa perlu:

 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.

 * Aturan khususnya apa:

 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.

 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.

 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import ToggleAllCollapseButton from "./ToggleAllCollapseButton";

import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Table, Input, Button } from "@pgh/ui-bootstrap";
import {
  PlusSquare,
  MinusSquare,
} from "react-feather";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import ActionCell from "../ActionCell/ActionCell";
import EditableTextarea from "../Cells/EditableTextArea";
import {
  getNumericDisplayOptions,
  isEndpointPercentageColumn,
} from "../utils/numericFormatRules";
import { parseNumericValue, formatNumericValue } from "../utils/numericformat";
import {
  buildOpexHeaderRows,
  isOpexEndpoint,
} from "../utils/opexSchema";
import { getGlobalDepartmentSuggestions } from "../utils/departmentSuggestions";
import UploadPhoto from "./TableToolBarElement/ImageUpload.jsx";
const SYSTEM_MANAGED_COLUMNS = new Set(["createdat", "updatedat"]);
const OPEX_TEMPLATE_DATE_INFERENCE_BLOCKED_COLUMNS = new Set([
  "SIT",
  "MATAANGGARANPARENT",
  "MATAANGGARANCHILD",
  "ROWTYPE",
]);
const EMPTY_EDITOR_VALUES = [];
const STICKY_SELECTOR_WIDTH = 46;
const STICKY_DRAG_WIDTH = 28;
const OPEX_COLLAPSE_COLUMN_WIDTH = 36;
const OPEX_FROZEN_COLUMNS = ["SIT", "MATAANGGARANPARENT", "MATAANGGARANCHILD"];

const buildFixedWidthStyle = (width, minWidth = width) => ({
  width,
  minWidth,
  maxWidth: width,
});

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

const getMergedEditorSuggestions = (
  sortedData,
  column,
  suggestionValuesByColumn,
  row = null,
) => {
  const normalizedColumn = String(column ?? "").trim();
  const normalizedToken = normalizeColumnToken(normalizedColumn);
  const useOnlyResolvedSuggestions =
    typeof suggestionValuesByColumn === "function";

  const dataValues = !useOnlyResolvedSuggestions && Array.isArray(sortedData)
    ? sortedData
        .map((item) => item?.[normalizedColumn])
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

/* -------------------------------------------------------------
   🔧 Utility helpers
------------------------------------------------------------- */
const isDateValue = (val) => {
  if (!val) return false;
  if (val instanceof Date) return true;
  if (typeof val === "string") {
    const d = new Date(val);
    return !isNaN(d) && val.includes("T");
  }
  return false;
};

const isDateColumn = (col) => /(^|_)(tgl|date|tempo)($|_)/i.test(col);

const normalizeEndpointToken = (value) =>
  String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

const isPlanningOpexEndpoint = (endpointName) => {
  const endpoint = normalizeEndpointToken(endpointName);
  return endpoint === "opextemplate" || endpoint === "opex";
};

const normalizeColumnToken = (value) => String(value ?? "").trim().toUpperCase();

const OPEX_MONTH_COLUMN_KEYS = new Set([
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
]);

const isOpexMonthColumnKey = (column) =>
  OPEX_MONTH_COLUMN_KEYS.has(normalizeColumnToken(column));

const getOpexSheetColumnStyle = (column) => {
  switch (normalizeColumnToken(column)) {
    case "SIT":
      return buildFixedWidthStyle(132, 124);
    case "MATAANGGARANPARENT":
      return buildFixedWidthStyle(208, 188);
    case "MATAANGGARANCHILD":
      return buildFixedWidthStyle(246, 224);
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
      return buildFixedWidthStyle(136, 128);
    case "ACCUMULATED":
      return buildFixedWidthStyle(208, 188);
    case "REALIZATIONLASTYEARTHISMONTH":
    case "REALIZATIONTHISYEARTHISMONTH":
      return buildFixedWidthStyle(162, 148);
    case "GROWTHRP":
      return buildFixedWidthStyle(148, 138);
    case "GROWTH":
    case "TOANGTHISYEAR":
    case "TOANGYTDTHISYEAR":
      return buildFixedWidthStyle(132, 122);
    case "FULLYEARFY":
    case "YTD":
    case "SISAFY":
      return buildFixedWidthStyle(168, 152);
    default:
      return null;
  }
};

const getOpexStickyBaseLeft = ({ editMode = false, enableRowReorder = false } = {}) =>
  (editMode ? STICKY_SELECTOR_WIDTH : 0) +
  (enableRowReorder ? STICKY_DRAG_WIDTH : 0);

const getOpexDefaultStickyWidths = () => ({
  collapse: OPEX_COLLAPSE_COLUMN_WIDTH,
  sit: getOpexSheetColumnStyle("SIT")?.width ?? 132,
  parent: getOpexSheetColumnStyle("MataAnggaranParent")?.width ?? 208,
  child: getOpexSheetColumnStyle("MataAnggaranChild")?.width ?? 246,
});

const getOpexFrozenColumnLeft = (column, stickyBaseLeft, stickyWidths = null) => {
  const normalizedColumn = normalizeColumnToken(column);
  const frozenIndex = OPEX_FROZEN_COLUMNS.indexOf(normalizedColumn);
  if (frozenIndex < 0) return null;

  const resolvedStickyWidths = stickyWidths || getOpexDefaultStickyWidths();
  const widthByFrozenColumn = {
    SIT: resolvedStickyWidths.sit,
    MATAANGGARANPARENT: resolvedStickyWidths.parent,
    MATAANGGARANCHILD: resolvedStickyWidths.child,
  };

  let left = stickyBaseLeft + resolvedStickyWidths.collapse;
  for (let index = 0; index < frozenIndex; index += 1) {
    const prevColumn = OPEX_FROZEN_COLUMNS[index];
    const width = widthByFrozenColumn[prevColumn] ?? getOpexSheetColumnStyle(prevColumn)?.width ?? 160;
    left += width;
  }

  return left;
};

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

const normalizeOpexDisplayValue = (isOpexTable, column, value) => {
  if (!isOpexTable) return value;
  if (normalizeColumnToken(column) !== "fullyearfy") return value;
  const parsed = parseNumericValue(value);
  if (parsed === null || Number.isNaN(parsed)) return value;
  return parsed === 0 ? null : value;
};

const hasFixedDateColumn = (fixedDateColumns, column) => {
  const normalizedColumn = String(column ?? "").trim().toLowerCase();
  if (!normalizedColumn || !Array.isArray(fixedDateColumns)) return false;
  return fixedDateColumns.some(
    (candidate) =>
      String(candidate ?? "").trim().toLowerCase() === normalizedColumn,
  );
};

const shouldTreatAsDateCell = (
  endpointName,
  column,
  cellValue,
  fixedDateColumns,
) => {
  const normalizedEndpoint = normalizeEndpointToken(endpointName);
  const normalizedColumn = normalizeColumnToken(column);
  const blockedByEndpoint =
    isPlanningOpexEndpoint(normalizedEndpoint) &&
    OPEX_TEMPLATE_DATE_INFERENCE_BLOCKED_COLUMNS.has(normalizedColumn);

  if (blockedByEndpoint) return false;

  return (
    isDateColumn(column) ||
    
    hasFixedDateColumn(fixedDateColumns, column)
  );
};

const hasTimeComponent = (value) => {
  if (!value) return false;

  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}T/.test(value.trim());
  }

  if (value instanceof Date && !isNaN(value)) {
    return (
      value.getHours() !== 0 ||
      value.getMinutes() !== 0 ||
      value.getSeconds() !== 0
    );
  }

  return false;
};

const formatDisplayDate = (value) => {
  if (!value) return "-";

  const parsedDate = value instanceof Date ? value : new Date(value);
  if (isNaN(parsedDate)) return String(value);

  if (hasTimeComponent(value)) {
    return parsedDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/* -------------------------------------------------------------
   📅 Date Cell
------------------------------------------------------------- */
const DateCell = ({ value, onChange, canEdit = true }) => {
  const [showPicker, setShowPicker] = useState(false);
  const parsedDate = value ? new Date(value) : null;

  const handleChange = (date) => {
    onChange(date ? date.toISOString() : null);
    setShowPicker(false);
  };

  if (!canEdit) {
    return (
      <div style={{ minWidth: "140px" }}>
        {formatDisplayDate(value)}
      </div>
    );
  }

  return (
    <div className="position-relative" style={{ minWidth: "140px" }}>
      <Button
        color="light"
        size="sm"
        className="w-100 text-start"
        onClick={() => setShowPicker(!showPicker)}
      >
        {parsedDate
          ? parsedDate.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Set Date"}
      </Button>

      {showPicker && (
        <div
          style={{
            position: "absolute",
            top: "35px",
            zIndex: 9999,
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <DatePicker selected={parsedDate} onChange={handleChange} inline />
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------
   ↔️ Sortable Column Header
------------------------------------------------------------- */
const SortableColumnHeader = ({ col, labelMap, disabled = false }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: col, disabled });

  const label = labelMap?.[col] ?? col;
  const headerTitle =
    typeof label === "string"
      ? label
      : label == null
        ? ""
        : String(label);

  return (
    <th
      ref={setNodeRef}
      title={headerTitle}
      aria-label={headerTitle || String(col)}
      className="sortable-column-header wrap-header"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: disabled ? "default" : "grab",
        background: "#f8f9fa",
        maxWidth: 100,
      }}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
    >
      {label}
    </th>
  );
};

/* -------------------------------------------------------------
   🧩 Sortable Row with Collapsible Children
------------------------------------------------------------- */
const SortableRow = ({
  row,
  rowIdx,
  columns,
  editMode,
  selectedIds,
  setSelectedIds,
  safeEditHandler,
  sortedData,
  actionKeys,
  onStatusClick,
  uploadColumns,
  fixedDateColumns,
  toggleColumns,
  endpointName,
  toggle,
  collapseState,
  canEditCell,
  nonEditableColumns = [],
  cellEditablePredicate = null,
  enableMillionFormat,
  suggestionValuesByColumn = null,

  enableRowReorder,

   isSelecting,
  setIsSelecting,
  selectMode,
  setSelectMode,
  opexStickyWidths = null,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
  useSortable({
  id: row.__key,
  disabled: !enableRowReorder || isSelecting,
});


  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: "#fff",
  };
  const isOpexTable = isOpexEndpoint({ endpointName });
  const stickyBaseLeft = useMemo(
    () => getOpexStickyBaseLeft({ editMode, enableRowReorder }),
    [editMode, enableRowReorder],
  );
  const resolvedOpexStickyWidths = useMemo(
    () => opexStickyWidths || getOpexDefaultStickyWidths(),
    [opexStickyWidths],
  );
  const rowRef = useRef(null);
  const [activeRawColumn, setActiveRawColumn] = useState(null);

  const isCollapsed = collapseState[row.__key];
  const normalizedNonEditableColumns = useMemo(
    () =>
      new Set(
        (Array.isArray(nonEditableColumns) ? nonEditableColumns : []).map((column) =>
          String(column ?? "").trim().toLowerCase(),
        ),
      ),
    [nonEditableColumns],
  );
  useEffect(() => {
    if (!activeRawColumn) return undefined;

    const handlePointerDownOutsideRow = (event) => {
      if (rowRef.current && !rowRef.current.contains(event.target)) {
        setActiveRawColumn(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDownOutsideRow, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDownOutsideRow, true);
    };
  }, [activeRawColumn]);

  return (
    <tr
      ref={(node) => {
        rowRef.current = node;
        setNodeRef(node);
      }}
      className={`level-${row.__level} ${row.isSummary ? "summary-row" : ""} ${
        selectedIds.includes(row.__key) ? "table-active" : ""
      }`}
      style={style}
    >
      {editMode && (
      <td
  className="sticky-selector"
  onPointerDown={(e) => e.stopPropagation()}
>

 <Input
  type="checkbox"
  checked={selectedIds.includes(row.__key)}

  onPointerDown={(e) => {
    e.preventDefault();
    e.stopPropagation();

    const isSelected = selectedIds.includes(row.__key);
    setIsSelecting(true);
    setSelectMode(isSelected ? "remove" : "add");

    setSelectedIds((prev) =>
      isSelected
        ? prev.filter((id) => id !== row.__key)
        : [...prev, row.__key]
    );
  }}

  onPointerEnter={() => {
    if (!isSelecting) return;

    setSelectedIds((prev) => {
      const exists = prev.includes(row.__key);
      if (selectMode === "add" && !exists) return [...prev, row.__key];
      if (selectMode === "remove" && exists)
        return prev.filter((id) => id !== row.__key);
      return prev;
    });
  }}

  onClick={(e) => e.preventDefault()}
  onChange={() => {}}
/>


</td>

      )}

      {enableRowReorder && (
        <td
          {...attributes}
          {...listeners}
          style={{
            cursor: "grab",
            width: "28px",
            textAlign: "center",
            userSelect: "none",
          }}
          onClick={(e) => e.stopPropagation()}
          className="drag-handle"
        >
          ⋮
        </td>
      )}

      {/* Collapse toggle */}
      <td
        className={isOpexTable ? "opex-sheet-sticky-cell opex-sheet-sticky-cell--collapse" : undefined}
        style={{
          textAlign: "center",
          verticalAlign: "middle",
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          ...(isOpexTable
            ? {
              position: "sticky",
              left: stickyBaseLeft,
              zIndex: 40,
              minWidth: resolvedOpexStickyWidths.collapse,
              width: resolvedOpexStickyWidths.collapse,
              maxWidth: resolvedOpexStickyWidths.collapse,
                backgroundColor: "var(--table-surface, #ffffff)",
              }
            : null),
        }}
        onMouseDownCapture={() => {
          if (activeRawColumn) {
            setActiveRawColumn(null);
          }
        }}
      >
        {row.hasChildren && (
          <Button
            color="link"
            size="sm"
            className="p-0 d-inline-flex align-items-center justify-content-center"
            aria-label={isCollapsed ? "Expand row" : "Collapse row"}
            title={isCollapsed ? "Expand row" : "Collapse row"}
            style={{ minWidth: 20, minHeight: 20 }}
            onClick={() => toggle(row.__key)}
          >
            {isCollapsed ? (
              <PlusSquare
                size={16}
                strokeWidth={2.4}
                color="#e0591a"
                className="collapse-icon collapse-icon--visible"
              />
            ) : (
              <MinusSquare size={14} color="#e0591aff" /> // 🩵 Bootstrap “info” cyan
            )}
          </Button>
        )}
      </td>

      {columns.map((col, colIdx) => {
        const rawCellValue = row[col];
        const cellValue = normalizeOpexDisplayValue(isOpexTable, col, rawCellValue);
        const normalizedColumn = normalizeColumnToken(col);
        const opexColumnStyle = isOpexTable
          ? (
            normalizedColumn === "SIT"
              ? buildFixedWidthStyle(resolvedOpexStickyWidths.sit)
              : normalizedColumn === "MATAANGGARANPARENT"
                ? buildFixedWidthStyle(resolvedOpexStickyWidths.parent)
                : normalizedColumn === "MATAANGGARANCHILD"
                  ? buildFixedWidthStyle(resolvedOpexStickyWidths.child)
                  : getOpexSheetColumnStyle(col)
          )
          : null;
        const numericFormatOptions = resolveNumericDisplayOptionsForCell(
          endpointName,
          col,
        );
        const isPercentageMetricColumn = isEndpointPercentageColumn({
          endpointName,
          column: col,
        });
        const canEditCurrentColumn =
          canEditCell &&
          !SYSTEM_MANAGED_COLUMNS.has(String(col ?? "").trim().toLowerCase()) &&
          !normalizedNonEditableColumns.has(String(col ?? "").trim().toLowerCase()) &&
          !(isOpexTable && normalizedColumn !== "FULLYEARFY") &&
          (typeof cellEditablePredicate !== "function" ||
            cellEditablePredicate(row, col));
        const opexEditorProps = isOpexTable
          ? {
              multiline: false,
              saveOnEnter: true,
              shiftEnterNewline: false,
              ctrlEnterSaves: true,
            }
          : {};
        const opexFrozenLeft = isOpexTable
          ? getOpexFrozenColumnLeft(col, stickyBaseLeft, resolvedOpexStickyWidths)
          : null;
        const rawInspectorValue = formatRawNumericValueForInspector(cellValue, {
          isPercentage: isPercentageMetricColumn,
        });
        const canToggleRawInspector =
          !canEditCurrentColumn &&
          isOpexTable &&
          Boolean(numericFormatOptions) &&
          Boolean(rawInspectorValue);
        const isRawInspectorActive = canToggleRawInspector && activeRawColumn === col;
        const inspectorNumericFormatOptions = isRawInspectorActive
          ? { minimumFractionDigits: 0, maximumFractionDigits: 12 }
          : numericFormatOptions;
        const onReadOnlyClick = canToggleRawInspector
          ? () => {
              setActiveRawColumn(col);
            }
          : null;
        const trimmedVal =
          cellValue === null || cellValue === undefined
            ? ""
            : String(cellValue).trim();
        const toggleConfig = toggleColumns && toggleColumns[col];
        const isDateCellColumn = shouldTreatAsDateCell(
          endpointName,
          col,
          cellValue,
          fixedDateColumns,
        );
        const indentLeft = colIdx === 0
          ? 12 + Math.max(0, Number(row.__level || 0)) * 18
          : 10;
        const editorSuggestions = canEditCurrentColumn
          ? getMergedEditorSuggestions(
              sortedData,
              col,
              suggestionValuesByColumn,
              row,
            )
          : EMPTY_EDITOR_VALUES;

        return (
          <td
            key={col}
            className={opexFrozenLeft !== null ? "opex-sheet-sticky-cell opex-sheet-sticky-cell--frozen" : undefined}
            style={{
              paddingLeft: `${indentLeft}px`,
              fontWeight: "normal",
              ...(opexColumnStyle || {}),
              ...(opexFrozenLeft !== null
                ? {
                    position: "sticky",
                    left: opexFrozenLeft,
                    zIndex: 39,
                    backgroundColor: "var(--table-surface, #ffffff)",
                  }
                : null),
              whiteSpace:
                isOpexTable && isOpexMonthColumnKey(col)
                  ? "nowrap"
                  : undefined,
            }}
            onMouseDownCapture={() => {
              if (activeRawColumn && activeRawColumn !== col) {
                setActiveRawColumn(null);
              }
            }}
          >
            {col === "Action" ? (
              <ActionCell
                row={row}
                keys={actionKeys}
                onStatusClick={onStatusClick}
              />
            ) : uploadColumns.includes(col) ? (
              <UploadPhoto
                rowId={row.__key}
                column={col}
                currentValue={cellValue}
                onUploaded={
                  normalizeEndpointToken(endpointName) === "listaudit" &&
                  ["RHA", "LHA"].includes(String(col ?? "").trim().toUpperCase())
                    ? undefined
                    : (url) => safeEditHandler(row.__key, col, url)
                }
                apiUrl={`${process.env.REACT_APP_API_BASE_URL}listaudit`}
              />
            ) : toggleConfig ? (
              trimmedVal ? (
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
                    safeEditHandler(
                      row.__key,
                      col,
                      trimmedVal.toLowerCase() ===
                        toggleConfig.positive.toLowerCase()
                        ? toggleConfig.negative
                        : toggleConfig.positive,
                    );
                  }}
                >
                  {trimmedVal.toLowerCase() ===
                  toggleConfig.positive.toLowerCase()
                    ? `✅ ${toggleConfig.positive}`
                    : `⌛ ${toggleConfig.negative}`}
                </Button>
              ) : (
                <EditableTextarea
                  column={col}
                  value={cellValue}
                  onCommit={(val) =>
                    safeEditHandler(row.id ?? row.Id ?? row.ID, col, val)
                  }
                  allValues={editorSuggestions}
                  canEdit={canEditCurrentColumn}
                  enableMillionFormat={enableMillionFormat}
                  numericFormatOptions={inspectorNumericFormatOptions}
                  onReadOnlyClick={onReadOnlyClick}
                  {...opexEditorProps}
                />
              )
            ) : isDateCellColumn ? (
              <DateCell
                value={cellValue}
                canEdit={canEditCurrentColumn}
                onChange={(newDate) => safeEditHandler(row.__key, col, newDate)}
              />
            ) : (
              <EditableTextarea
                column={col}
                value={cellValue}
                onCommit={(val) =>
                  safeEditHandler(row.id ?? row.Id ?? row.ID, col, val)
                }
                allValues={editorSuggestions}
                canEdit={canEditCurrentColumn}
                enableMillionFormat={enableMillionFormat}
                numericFormatOptions={inspectorNumericFormatOptions}
                onReadOnlyClick={onReadOnlyClick}
                {...opexEditorProps}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
};

/* -------------------------------------------------------------
   🧩 Main Nested Table Component
------------------------------------------------------------- */
const RenderNestedTable = ({
  flatData,
  columns,
  collapseState,
  columnLabelMap,
  tableVariant = null,
  toggle,
  enableColumnDrag = false,
  fixedDateColumns = [],
  editMode = false,
  selectedIds = [],
  setSelectedIds = () => {},
  safeEditHandler = () => {},
  actionKeys = [],
  onStatusClick,
  uploadColumns = [],
  toggleColumns = {},
  endpointName = "NestedTable",
  canEditCell = true,
  nonEditableColumns = [],
  cellEditablePredicate = null,
  setCollapseState, // 👈 ADD
  enableMillionFormat,
  suggestionValuesByColumn = null,

  enableRowReorder = false,
}) => {
  const isOpexTable = isOpexEndpoint({ endpointName });
  const stickyBaseLeft = useMemo(
    () => getOpexStickyBaseLeft({ editMode, enableRowReorder }),
    [editMode, enableRowReorder],
  );
  const tableRef = useRef(null);
  const [opexStickyWidths, setOpexStickyWidths] = useState(() => getOpexDefaultStickyWidths());
  const resolvedOpexStickyWidths = useMemo(
    () => opexStickyWidths || getOpexDefaultStickyWidths(),
    [opexStickyWidths],
  );
  const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // 👈 magic number (6–10 is ideal)
    },
  })
);

  // Always use columns exactly as provided
  const [columnOrder, setColumnOrder] = useState(columns);
  const opexTemplateHeaderRows = useMemo(() => {
    if (!isOpexTable) return null;
    return buildOpexHeaderRows(columnOrder, columnLabelMap);
  }, [isOpexTable, columnOrder, columnLabelMap]);

  const [isSelecting, setIsSelecting] = useState(false);
const [selectMode, setSelectMode] = useState(null); // "add" | "remove"

useEffect(() => {
  const stopSelecting = () => {
    setIsSelecting(false);
    setSelectMode(null);
  };

  window.addEventListener("pointerup", stopSelecting);
  return () => window.removeEventListener("pointerup", stopSelecting);
}, []);


  useEffect(() => {
    // reset to original whenever input columns change
    setColumnOrder(columns);
  }, [columns]);

  useLayoutEffect(() => {
    if (!isOpexTable) return undefined;
    const tableElement = tableRef.current;
    if (!tableElement) return undefined;

    const syncStickyWidths = () => {
      const collapseCell = tableElement.querySelector("thead th[data-opex-col='COLLAPSE']");
      const sitCell = tableElement.querySelector("thead th[data-opex-col='SIT']");
      const parentCell = tableElement.querySelector("thead th[data-opex-col='MATAANGGARANPARENT']");
      const childCell = tableElement.querySelector("thead th[data-opex-col='MATAANGGARANCHILD']");
      const defaults = getOpexDefaultStickyWidths();
      const next = {
        collapse: Math.max(defaults.collapse, Math.ceil(collapseCell?.offsetWidth || defaults.collapse)),
        sit: Math.max(defaults.sit, Math.ceil(sitCell?.offsetWidth || defaults.sit)),
        parent: Math.max(defaults.parent, Math.ceil(parentCell?.offsetWidth || defaults.parent)),
        child: Math.max(defaults.child, Math.ceil(childCell?.offsetWidth || defaults.child)),
      };

      setOpexStickyWidths((prev) => {
        if (
          prev
          && prev.collapse === next.collapse
          && prev.sit === next.sit
          && prev.parent === next.parent
          && prev.child === next.child
        ) {
          return prev;
        }
        return next;
      });
    };

    syncStickyWidths();
    window.requestAnimationFrame(syncStickyWidths);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(syncStickyWidths)
      : null;
    if (resizeObserver) resizeObserver.observe(tableElement);
    window.addEventListener("resize", syncStickyWidths);

    return () => {
      window.removeEventListener("resize", syncStickyWidths);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [columnOrder, editMode, enableRowReorder, flatData, isOpexTable]);

  const [localData, setLocalData] = useState(flatData);

  useEffect(() => {
    setLocalData(flatData);
  }, [flatData]);

  const handleColumnDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = columnOrder.indexOf(active.id);
    const newIndex = columnOrder.indexOf(over.id);

    setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
  };

  const getSubtree = (rows, rootKey) => {
    const root = rows.find((r) => r.__key === rootKey);
    if (!root) return [];

    const subtree = [root];

    const collect = (parentKey) => {
      rows
        .filter((r) => r.parentKey === parentKey)
        .forEach((child) => {
          subtree.push(child);
          collect(child.__key);
        });
    };

    collect(rootKey);
    return subtree;
  };

  const handleRowDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const sourceKey = active.id;
    const targetKey = over.id;

    const sourceSubtree = getSubtree(localData, sourceKey);
    const sourceKeys = sourceSubtree.map((r) => r.__key);

    // Remove subtree
    const remaining = localData.filter((r) => !sourceKeys.includes(r.__key));

    // Insert before target
    const targetIndex = remaining.findIndex((r) => r.__key === targetKey);
    const newFlat = [
      ...remaining.slice(0, targetIndex),
      ...sourceSubtree,
      ...remaining.slice(targetIndex),
    ];

    // 🔥 recompute SortOrder per parent
    const normalized = normalizeNestedOrder(newFlat);

    setLocalData(normalized); // <-- your state
    persistOrder(normalized); // <-- backend
  };
  const normalizeNestedOrder = (rows) => {
    const byParent = {};

    rows.forEach((r) => {
      const pid = r.parentKey ?? null;
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push(r);
    });

    return rows.map((r) => {
      const siblings = byParent[r.parentKey ?? null];
      const sortOrder = siblings.findIndex((s) => s.__key === r.__key) + 1;

      return {
        ...r,
        SortOrder: sortOrder,
      };
    });
  };

  const persistOrder = async (rows) => {
    const payload = rows.map((r) => ({
      TableName: "BudgetTable",
      EntityId: r.EntityId ?? r.Id ?? r.ID, // must match DB
      ParentId: r.parentKey ?? null,
      SortOrder: r.SortOrder,
      Level: r.__level,
      ViewKey: "default",
      ContextId: null, // or real context if needed
    }));

    console.log("Saving order:", payload);

    const res = await fetch(
      `${process.env.REACT_APP_API_BASE_URL}RowOrderNested/update`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      },
    );
    if (res.ok) {
      const result = await res.json();
      console.log("Saved successfully:", result);
    } else {
      const text = await res.text();
      console.error("Failed to save:", text);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={enableColumnDrag ? handleColumnDragEnd : undefined}
    >
      <Table
        ref={tableRef}
        hover
        bordered
        size="sm"
        className={`table sticky-table table-responsive${
          String(tableVariant ?? "").trim().toLowerCase() === "sheet"
            ? " sticky-table--sheet"
            : ""
        }`}
      >
        <thead className="table-light">
          {isOpexTable && opexTemplateHeaderRows ? (
            <>
              <tr className="opex-sheet-header-row opex-sheet-header-row--top">
                {editMode && (
                  <th className="sticky-header" rowSpan={2}>
                    <Input type="checkbox" disabled />
                  </th>
                )}
                {enableRowReorder && (
                  <th style={{ width: "28px", textAlign: "center" }} rowSpan={2}></th>
                )}

                <th
                  className={isOpexTable ? "opex-sheet-sticky-cell opex-sheet-sticky-cell--collapse" : undefined}
                  data-opex-col={isOpexTable ? "COLLAPSE" : undefined}
                  style={{
                    width: `${resolvedOpexStickyWidths.collapse}px`,
                    textAlign: "center",
                    paddingLeft: 0,
                    paddingRight: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    ...(isOpexTable
                      ? {
                          position: "sticky",
                          left: stickyBaseLeft,
                          zIndex: 55,
                          "--opex-sheet-top-z": 55,
                          background: "var(--table-surface-subtle, #f8f9fa)",
                        }
                      : null),
                  }}
                  rowSpan={2}
                >
                  <ToggleAllCollapseButton
                    flatData={flatData}
                    collapseState={collapseState}
                    setCollapseState={setCollapseState}
                  />
                </th>

                {opexTemplateHeaderRows.topRowCells.map((cell) => {
                  if (cell.rowSpan) {
                    const normalizedHeaderColumn = normalizeColumnToken(cell.column);
                    const leafColumnStyle =
                      normalizedHeaderColumn === "SIT"
                        ? buildFixedWidthStyle(resolvedOpexStickyWidths.sit)
                        : normalizedHeaderColumn === "MATAANGGARANPARENT"
                          ? buildFixedWidthStyle(resolvedOpexStickyWidths.parent)
                          : normalizedHeaderColumn === "MATAANGGARANCHILD"
                            ? buildFixedWidthStyle(resolvedOpexStickyWidths.child)
                            : getOpexSheetColumnStyle(cell.column);
                    const frozenLeft = getOpexFrozenColumnLeft(
                      cell.column,
                      stickyBaseLeft,
                      resolvedOpexStickyWidths,
                    );
                    return (
                      <th
                        key={cell.key}
                        rowSpan={cell.rowSpan}
                        data-opex-col={normalizedHeaderColumn}
                        className={`wrap-header opex-sheet-header-cell opex-sheet-header-cell--leaf${
                          frozenLeft !== null ? " opex-sheet-sticky-cell opex-sheet-sticky-cell--frozen" : ""
                        }`}
                        style={{
                          background: "#f8f9fa",
                          maxWidth: "none",
                          whiteSpace: "nowrap",
                          verticalAlign: "middle",
                          textAlign: "center",
                          fontWeight: 600,
                          ...(leafColumnStyle || {}),
                        ...(frozenLeft !== null
                          ? {
                              position: "sticky",
                              left: frozenLeft,
                              zIndex: 54,
                              "--opex-sheet-top-z": 54,
                              background: "var(--table-surface-subtle, #f8f9fa)",
                            }
                            : null),
                        }}
                      >
                        {cell.label}
                      </th>
                    );
                  }

                  const groupedMinWidth = Array.isArray(cell.columns)
                    ? cell.columns.reduce((sum, column) => {
                        const style = getOpexSheetColumnStyle(column);
                        return sum + (style?.minWidth ?? 120);
                      }, 0)
                    : undefined;
                  return (
                    <th
                      key={cell.key}
                      colSpan={cell.colSpan}
                      title={cell.label}
                      aria-label={cell.label}
                      className="wrap-header opex-sheet-header-cell opex-sheet-header-cell--group"
                      style={{
                        background: "#eef2f7",
                        whiteSpace: "nowrap",
                        verticalAlign: "middle",
                        textAlign: "center",
                        fontWeight: 700,
                        minWidth: groupedMinWidth,
                      }}
                    >
                      {cell.label}
                    </th>
                  );
                })}
              </tr>
              <tr className="opex-sheet-header-row opex-sheet-header-row--second">
                {opexTemplateHeaderRows.secondRowCells.map((cell) => {
                  const normalizedHeaderColumn = normalizeColumnToken(cell.column);
                  const childColumnStyle =
                    normalizedHeaderColumn === "SIT"
                      ? buildFixedWidthStyle(resolvedOpexStickyWidths.sit)
                      : normalizedHeaderColumn === "MATAANGGARANPARENT"
                        ? buildFixedWidthStyle(resolvedOpexStickyWidths.parent)
                        : normalizedHeaderColumn === "MATAANGGARANCHILD"
                          ? buildFixedWidthStyle(resolvedOpexStickyWidths.child)
                          : getOpexSheetColumnStyle(cell.column);
                  const frozenLeft = getOpexFrozenColumnLeft(
                    cell.column,
                    stickyBaseLeft,
                    resolvedOpexStickyWidths,
                  );
                  return (
                    <th
                      key={cell.key}
                      title={cell.label}
                      aria-label={cell.label}
                      className={`wrap-header opex-sheet-header-cell opex-sheet-header-cell--child${
                        frozenLeft !== null ? " opex-sheet-sticky-cell opex-sheet-sticky-cell--frozen" : ""
                      }`}
                      style={{
                        background: "#f8f9fa",
                        maxWidth: "none",
                        whiteSpace: "normal",
                        verticalAlign: "middle",
                        textAlign: "center",
                        fontWeight: 600,
                        ...(childColumnStyle || {}),
                        ...(frozenLeft !== null
                          ? {
                              position: "sticky",
                              left: frozenLeft,
                              zIndex: 53,
                              "--opex-sheet-second-z": 53,
                              background: "var(--table-surface-subtle, #f8f9fa)",
                            }
                          : null),
                      }}
                    >
                      {cell.label}
                    </th>
                  );
                })}
              </tr>
            </>
          ) : (
          <tr>
            {editMode && (
              <th className="sticky-header">
                <Input type="checkbox" disabled />
              </th>
            )}
          {enableRowReorder && (
  <th style={{ width: "28px", textAlign: "center" }}></th>
)}

                  <th
                    style={{
                      width: `${resolvedOpexStickyWidths.collapse}px`,
                      textAlign: "center",
                      paddingLeft: 0,
                      paddingRight: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                    }}
                  >
              <ToggleAllCollapseButton
                flatData={flatData}
                collapseState={collapseState}
                setCollapseState={setCollapseState} // 👈 pass setter
              />
            </th>

            {enableColumnDrag ? (
              <SortableContext
                items={columnOrder}
                strategy={horizontalListSortingStrategy}
              >
                {columnOrder.map((col) => (
                  <SortableColumnHeader
                    key={col}
                    col={col}
                    labelMap={columnLabelMap}
                    disabled={!enableColumnDrag}
                  />
                ))}
              </SortableContext>
            ) : (
              columnOrder.map((col) => (
                <th
                  key={col}
                  title={columnLabelMap?.[col] ?? col}
                  aria-label={columnLabelMap?.[col] ?? col}
                  className="wrap-header"
                  style={{ background: "#f8f9fa", maxWidth: 100 }}
                >
                  {columnLabelMap?.[col] ?? col}
                </th>
              ))
            )}
          </tr>
          )}
        </thead>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={enableRowReorder ? handleRowDragEnd : undefined}
        >
          <SortableContext
            items={localData.map((r) => r.__key)}
            strategy={verticalListSortingStrategy}
          >
            <tbody>
              {localData.map((row, i) => {
                const hidden = row.parentKeys?.some((k) => collapseState[k]);
                if (hidden) return null;

                return (
                  <SortableRow
                    key={row.__key}
                    row={row}
                    rowIdx={i}
                    columns={columnOrder}
                    editMode={editMode}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    safeEditHandler={safeEditHandler}
                    sortedData={flatData}
                    actionKeys={actionKeys}
                    onStatusClick={onStatusClick}
                    uploadColumns={uploadColumns}
                    fixedDateColumns={fixedDateColumns}
                    toggleColumns={toggleColumns}
                    endpointName={endpointName}
                    toggle={toggle}
                    collapseState={collapseState}
                    canEditCell={canEditCell}
                    nonEditableColumns={nonEditableColumns}
                    cellEditablePredicate={cellEditablePredicate}
                    enableMillionFormat={enableMillionFormat}
                    suggestionValuesByColumn={suggestionValuesByColumn}
                    enableRowReorder={enableRowReorder}
                    opexStickyWidths={resolvedOpexStickyWidths}


                      /* 👇 NEW */
  isSelecting={isSelecting}
  setIsSelecting={setIsSelecting}
  selectMode={selectMode}
  setSelectMode={setSelectMode}

                  />
                );
              })}
            </tbody>
          </SortableContext>
        </DndContext>
      </Table>
    </DndContext>
  );
};

export default RenderNestedTable;
