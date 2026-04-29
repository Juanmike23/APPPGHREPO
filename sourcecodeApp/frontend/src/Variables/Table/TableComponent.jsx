/*
 * PGH-DOC
 * File: src/Variables/Table/TableComponent.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useAuth } from "../../Auth/AuthContext";
import { canEditPath, isExecutive, isReadOnlyUser } from "../../Auth/accessControl";
// import useParentChild from "./ParentChild";
import { toast } from "react-toastify";

import TableToolbar from "./TableToolBar";

import React, {
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  Fragment,
  useRef,
} from "react";

import {
  Container,
  Col,
  Card,
  CardBody,
  CardHeader,
  Modal,
  ModalHeader,
  ModalBody,
} from "@pgh/ui-bootstrap";

import "./StickyTable.scss";
import "./TableToolBarElement/Mobile.scss";

import { H5 } from "../../AbstractElements";
import FeedbackState from "../../Components/Common/FeedbackState";

import ZoomControl from "./ZoomControl";
import { normalizeSearchText, rowMatchesSearch } from "./filters/search";
import {
  LIST_AUDIT_COLUMN_LABELS,
  getListAuditCanonicalColumn,
  isListAuditTarget,
} from "../../Components/Audit/Utils/columnHelpers";
import {
  LIST_AUDIT_DEFAULT_PAGE_SIZE,
  LIST_AUDIT_PAGE_SIZE_OPTIONS,
  buildListAuditServerQueryPayload,
  getListAuditServerFilterColumns,
  getListAuditServerSortColumns,
  isListAuditServerQueryEnabled,
} from "../../Components/Audit/ListAudit/serverQuery";
import {
  PROCUREMENT_DEFAULT_PAGE_SIZE,
  PROCUREMENT_PAGE_SIZE_OPTIONS,
  buildProcurementServerQueryPayload,
  getProcurementServerFilterColumns,
  getProcurementServerSortColumns,
  isProcurementServerQueryEnabled,
} from "../../Components/Procurement/APS/serverQuery";
import {
  HUMAN_RESOURCE_DEFAULT_PAGE_SIZE,
  HUMAN_RESOURCE_PAGE_SIZE_OPTIONS,
  buildHumanResourceServerQueryPayload,
  getHumanResourceServerFilterColumns,
  getHumanResourceServerSortColumns,
  isHumanResourceServerQueryEnabled,
} from "../../Components/Human/Resource/serverQuery";
import {
  COMPLIANCE_WEEKLY_DEFAULT_PAGE_SIZE,
  COMPLIANCE_WEEKLY_PAGE_SIZE_OPTIONS,
  buildComplianceWeeklyServerQueryPayload,
  getComplianceWeeklyServerFilterColumns,
  getComplianceWeeklyServerSortColumns,
  isComplianceWeeklyServerQueryEnabled,
} from "../../Components/Compliance/Weekly/serverQuery";
import {
  PLANNING_OPEX_DEFAULT_PAGE_SIZE,
  PLANNING_OPEX_PAGE_SIZE_OPTIONS,
  buildPlanningOpexServerQueryPayload,
  getPlanningOpexServerFilterColumns,
  getPlanningOpexServerSortColumns,
  isPlanningOpexServerQueryEnabled,
} from "../../Components/Planning/DashboardPlanning/Opex/serverQuery";
import { resolveTableColumnLabel } from "./columnLabels";

import useCellMerging from "../Cells/CellConfig.jsx";

import ChangeLogModal from "../ActionCell/ChangeLogModal.jsx";
import { useLocation } from "react-router-dom";

const RenderTableCollapse = React.lazy(() => import("./RenderNestedTable.jsx"));
const RenderTableBody = React.lazy(() => import("./RenderTableBody.jsx"));

const BLOB_COLUMNS = new Set([
  "Image",
  "ImageData",
  "BinaryData",
  "File",
  "FileContent",
  "Photo",
  "Attachment",
  "RHA",
  "LHA",
]);

const EMPTY_ARRAY = [];
const SYSTEM_MANAGED_COLUMNS = new Set(["createdat", "updatedat"]);
const INTERNAL_EXTRA_DATA_PREFIX = "__";
const normalizeColumnToken = (value) =>
  String(value ?? "").trim().toLowerCase();
const SEARCH_SCOPE_ALL = "__all__";
const TABLE_REFRESH_MIN_MS = 820;
const NUMERIC_THOUSANDS_COMMA_PATTERN = /^-?\d{1,3}(,\d{3})+$/;
const NUMERIC_THOUSANDS_DOT_PATTERN = /^-?\d{1,3}(\.\d{3})+$/;
const STRICT_NORMALIZED_NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;
const hasOwnProp = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj ?? {}, key);
const cloneTableViewFilters = (value) => ({
  filters: Array.isArray(value?.filters)
    ? value.filters.map((filter) => ({ ...filter }))
    : [],
  mode: String(value?.mode ?? "").toLowerCase() === "or" ? "or" : "and",
  sort: value?.sort ? { ...value.sort } : null,
  visibleColumns: Array.isArray(value?.visibleColumns)
    ? [...value.visibleColumns]
    : null,
  distinct: value?.distinct ? { ...value.distinct } : null,
  priorityTopNullColumn:
    typeof value?.priorityTopNullColumn === "string" &&
    value.priorityTopNullColumn.trim()
      ? value.priorityTopNullColumn.trim()
      : null,
  priorityBottomIds: Array.isArray(value?.priorityBottomIds)
    ? Array.from(
        new Set(
          value.priorityBottomIds
            .map((entry) => Number(entry))
            .filter((entry) => Number.isFinite(entry) && entry > 0),
        ),
      )
    : [],
});
const normalizeViewStateForCompare = (viewState) =>
  JSON.stringify({
    searchTerm: String(viewState?.searchTerm ?? "").trim(),
    searchScope: String(viewState?.searchScope ?? SEARCH_SCOPE_ALL),
    filters: cloneTableViewFilters(viewState?.filters),
  });
const LIST_AUDIT_LOCKED_VISIBLE_COLUMNS = new Set(["Action", "NAMAAUDIT"]);
const isInternalExtraDataKey = (key) =>
  String(key ?? "").trim().startsWith(INTERNAL_EXTRA_DATA_PREFIX);
const normalizeLooseNumericToken = (raw) => {
  if (raw == null) return "";
  const token = String(raw).trim();
  if (!token) return "";

  const hasDot = token.includes(".");
  const hasComma = token.includes(",");

  if (hasDot && hasComma) {
    const lastDot = token.lastIndexOf(".");
    const lastComma = token.lastIndexOf(",");
    return lastComma > lastDot
      ? token.replaceAll(".", "").replaceAll(",", ".")
      : token.replaceAll(",", "");
  }

  if (hasComma) {
    if (NUMERIC_THOUSANDS_COMMA_PATTERN.test(token)) {
      return token.replaceAll(",", "");
    }

    return token.replaceAll(",", ".");
  }

  if (hasDot && NUMERIC_THOUSANDS_DOT_PATTERN.test(token)) {
    return token.replaceAll(".", "");
  }

  return token;
};
const parseLooseNumericInput = (value) => {
  if (value === null || value === undefined) {
    return { valid: true, hasValue: false, value: null };
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { valid: true, hasValue: true, value }
      : { valid: false, hasValue: false, value: null };
  }

  const raw = String(value)
    .replace(/Rp/gi, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/\u00A0/g, "")
    .trim();
  if (!raw) {
    return { valid: true, hasValue: false, value: null };
  }

  const normalized = normalizeLooseNumericToken(raw);
  if (!STRICT_NORMALIZED_NUMERIC_PATTERN.test(normalized)) {
    return { valid: false, hasValue: false, value: null };
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return { valid: false, hasValue: false, value: null };
  }

  return { valid: true, hasValue: true, value: parsed };
};
const DISTINCT_EMPTY_TOKEN = "__EMPTY__";
const DISTINCT_TOTAL_TOKEN = "__TOTAL__";
const normalizeDistinctGroupToken = (value) => {
  if (value === null || value === undefined) {
    return DISTINCT_EMPTY_TOKEN;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : DISTINCT_EMPTY_TOKEN;
  }

  if (value instanceof Date) {
    const epoch = value.getTime();
    return Number.isFinite(epoch) ? value.toISOString() : DISTINCT_EMPTY_TOKEN;
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};
const buildDistinctUiRowKey = (column, token) => {
  const normalizedColumn = normalizeColumnToken(column) || "unknown";
  const normalizedToken =
    token === null || token === undefined || token === ""
      ? DISTINCT_EMPTY_TOKEN
      : String(token);
  return `distinct:${encodeURIComponent(normalizedColumn)}:${encodeURIComponent(
    normalizedToken,
  )}`;
};
const attachDistinctUiRowKeys = (rows, distinctColumn) => {
  if (!distinctColumn || !Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  return rows.map((row, index) => {
    if (!row || typeof row !== "object") {
      return row;
    }

    if (row.__rowKey) {
      return row;
    }

    const rawValue = row[distinctColumn];
    const token =
      row.__isTotalRow || String(rawValue ?? "").trim().toLowerCase() === "total"
        ? DISTINCT_TOTAL_TOKEN
        : normalizeDistinctGroupToken(rawValue);
    const fallbackToken =
      token === DISTINCT_EMPTY_TOKEN ? `${DISTINCT_EMPTY_TOKEN}-${index}` : token;

    return {
      ...row,
      __rowKey: buildDistinctUiRowKey(distinctColumn, fallbackToken),
    };
  });
};
const appendServerDistinctTotalRow = (rows, distinctColumn) => {
  if (!distinctColumn || !Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  if (rows.some((row) => row?.__isTotalRow)) {
    return rows;
  }

  const total = rows.reduce((accumulator, row) => {
    const parsed = Number(row?.Total ?? 0);
    return accumulator + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  const firstRow =
    rows.find((row) => row && typeof row === "object" && !Array.isArray(row)) || {};
  const fillerColumns = Object.keys(firstRow).filter(
    (key) =>
      key !== "Id" &&
      key !== "id" &&
      key !== "ID" &&
      key !== "__rowKey" &&
      key !== "__isTotalRow" &&
      key !== "Total" &&
      key !== distinctColumn,
  );

  const totalRow = {
    Id: null,
    __isTotalRow: true,
    [distinctColumn]: "Total",
    Total: total,
  };

  fillerColumns.forEach((key) => {
    const sampleValue = firstRow[key];
    totalRow[key] = Array.isArray(sampleValue)
      ? []
      : sampleValue && typeof sampleValue === "object"
        ? null
        : "";
  });

  return [...rows, totalRow];
};
const ensureTotalColumnAtEnd = (columns) => {
  if (!Array.isArray(columns) || columns.length === 0) return [];
  const normalized = columns.filter(Boolean);
  if (!normalized.includes("Total")) return normalized;
  return [...normalized.filter((column) => column !== "Total"), "Total"];
};
const normalizeTableArea = (value) => String(value ?? "").trim().toLowerCase();
const appendPathSegmentToUrl = (baseUrl, segment) => {
  const raw = String(baseUrl || "").trim();
  if (!raw) return "";

  const [path, queryString = ""] = raw.split("?");
  const normalizedPath = path.replace(/\/$/, "");
  const normalizedSegment = String(segment ?? "").replace(/^\/+/, "");
  const nextPath = `${normalizedPath}/${normalizedSegment}`;
  return queryString ? `${nextPath}?${queryString}` : nextPath;
};
const isHiddenListAuditFrontendColumn = (column, endpointName) =>
  isListAuditTarget(endpointName) &&
  SYSTEM_MANAGED_COLUMNS.has(normalizeColumnToken(column));

const normalizeListAuditVisibleColumns = (columns) => {
  if (!Array.isArray(columns)) return columns;

  return columns
    .map((column) => {
      if (column === "Action") return "Action";
      return getListAuditCanonicalColumn(column) || column;
    })
    .filter(Boolean)
    .filter((column) => !SYSTEM_MANAGED_COLUMNS.has(normalizeColumnToken(column)));
};

const TableComponent = ({
  title,
  data = EMPTY_ARRAY,
  columns = EMPTY_ARRAY, // ✅ SAFE DEFAULT

  groupMap,
  allColumns,
  onEdit,
  onUpdateSuccess,
  collapsible = false,
  endpoint,
  groupKey = "x",
  actionKeys = [],
  uploadColumns = [],
  fixedDateColumns = [],
  apiUrl = "", // 👈 existing prop (GET)
  patchUrlBase = "", // 👈 new optional prop (PATCH)
  useTextarea = false,
  onStatusClick,
  toggleColumns,
  toggleMode,
  treeData, // 👈 ADD
  setCollapseState, // 👈 ADD THIS

  reloadKey = 0,
  columnStyles,
  highlightCondition,
  showRowCount = true,
  enableColumnDrag,
  showLogTrail = true,
  changeLogTableName = null,
  changeLogTitleLabel = null,
  changeLogTriggerLabel = "Riwayat Perubahan",
  changeLogScopeTableName = null,
  changeLogScopeEntityId = null,
  allowChangeLogNavigation = true,

  flatData,
  collapseState,
  toggle,

  YearImportValue,
  hideImport = false, // 👈 ADD THIS
  hideExport = false,

  externalFilters = null, // 👈 NEW
  onFiltersChange = null, // 👈 NEW (optional)

  normalizedint = false,

  columnMap,
  reverseColumnMap,

  enableRowOrder = false,
  enableMillionFormat = false,

  hideColumnYear = false,

  source,
  mandatoryValueOf,
  mandatorySuggestionValues,

  addColumnUrl,
  tableArea = null,
  serverQueryMode = null,
  columnLabelOverrides = null,
  suggestionValuesByColumn = null,
  forceReloadAfterMutation = false,
  forceReadOnly = false,
  onMutationSuccess = null,
  allowColumnMutations = true,
  allowDistinct = true,
  persistColumnOrder = true,
  buildCollapsibleRows = null,
  layoutPreset = null,
  useGridRenderer = false,
  fixedColumnsOnly = false,
  nonEditableColumns = EMPTY_ARRAY,
  allowInlineEditWhenReadOnly = false,
  cellEditablePredicate = null,
  enableClientPagination = false,
  focusRowRequest = null,
  disableAutoFetch = false,
  onRowsReplaced = null,
  transferActions = null,
}) => {
  const auth = useAuth();
  const user = auth?.user;
  const location = useLocation();
  const isReadOnly = isReadOnlyUser(user);
  const isRestrictedReadOnly = isReadOnly && !isExecutive(user);
  const canManageCurrentPath = canEditPath(user, location.pathname);
  const canManageTable = !forceReadOnly && !isReadOnly && canManageCurrentPath;
  const canEditCells =
    !isReadOnly &&
    canManageCurrentPath &&
    (!forceReadOnly || allowInlineEditWhenReadOnly);
  const rowIdFromLocation = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("rowId");
  }, [location.search]);
  const endpointName = useMemo(() => {
    if (endpoint && typeof endpoint === "string") {
      return endpoint.replace(/_/g, " ");
    }

    if (apiUrl && typeof apiUrl === "string") {
      const match = apiUrl.match(/\/api\/([^/?]+)/i);
      if (match?.[1]) {
        return match[1].replace(/_/g, " ");
      }
    }

    if (title) return title;
    return "Data Table";
  }, [endpoint, apiUrl, title]);
  const rowOrderEnabled = false;
  const isAuditListAuditServerMode = isListAuditServerQueryEnabled({
    tableArea,
    serverQueryMode,
    endpointName,
  });
  const isProcurementListServerMode = isProcurementServerQueryEnabled({
    serverQueryMode,
    endpointName,
  });
  const isHumanResourceServerMode = isHumanResourceServerQueryEnabled({
    tableArea,
    serverQueryMode,
    endpointName,
  });
  const isComplianceWeeklyServerMode = isComplianceWeeklyServerQueryEnabled({
    serverQueryMode,
    endpointName,
  });
  const isPlanningOpexServerMode = isPlanningOpexServerQueryEnabled({
    serverQueryMode,
    endpointName,
  });
  const isServerQueryEnabled =
    isAuditListAuditServerMode ||
    isProcurementListServerMode ||
    isHumanResourceServerMode ||
    isComplianceWeeklyServerMode ||
    isPlanningOpexServerMode;
  const activeServerDefaultPageSize = isProcurementListServerMode
    ? PROCUREMENT_DEFAULT_PAGE_SIZE
    : isHumanResourceServerMode
      ? HUMAN_RESOURCE_DEFAULT_PAGE_SIZE
      : isComplianceWeeklyServerMode
        ? COMPLIANCE_WEEKLY_DEFAULT_PAGE_SIZE
      : isPlanningOpexServerMode
        ? PLANNING_OPEX_DEFAULT_PAGE_SIZE
      : LIST_AUDIT_DEFAULT_PAGE_SIZE;
  const activeServerPageSizeOptions = isProcurementListServerMode
    ? PROCUREMENT_PAGE_SIZE_OPTIONS
    : isHumanResourceServerMode
      ? HUMAN_RESOURCE_PAGE_SIZE_OPTIONS
      : isComplianceWeeklyServerMode
        ? COMPLIANCE_WEEKLY_PAGE_SIZE_OPTIONS
      : isPlanningOpexServerMode
        ? PLANNING_OPEX_PAGE_SIZE_OPTIONS
      : LIST_AUDIT_PAGE_SIZE_OPTIONS;

  //const apiUrl = `${process.env.REACT_APP_API_BASE_URL}${endpoint}`; // 👈 build base + endpoint

  // ✅ Refs separated
  const wrapperRef = useRef();
  const tableRef = useRef();
  const tbodyRef = useRef();
  const lastCompletedFetchSignatureRef = useRef("");
  const suppressNextRevealRef = useRef(false);
  const tableDataRef = useRef([]);
  const hasInlineData = data !== EMPTY_ARRAY;

  // ✅ State
  const [tableData, setTableData] = useState(() =>
    hasInlineData && Array.isArray(data) ? data : [],
  );

  const [hasHighlight, setHasHighlight] = useState(false);

  const finalTableData = useMemo(() => {
    return tableData;
  }, [tableData]);

  const [sortConfig, setSortConfig] = useState({
    column: null,
    direction: "asc",
  });

  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchScope, setSearchScope] = useState(SEARCH_SCOPE_ALL);
  const [internalFilters, setInternalFilters] = useState({
    filters: [],
    mode: "and",
    sort: null,
    visibleColumns: null,
    distinct: null,
    priorityTopNullColumn: null,
    priorityBottomIds: [],
  });

  // 🔁 source of truth
  const filters = externalFilters ?? internalFilters;
  const setFilters = onFiltersChange ?? setInternalFilters;

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  const [sortedData, setSortedData] = useState([]);
  const [priorityBottomIds, setPriorityBottomIds] = useState([]);
  const [priorityTopNullColumn, setPriorityTopNullColumn] = useState(null);
  const [serverPage, setServerPage] = useState(1);
  const [serverPageSize, setServerPageSize] = useState(
    activeServerDefaultPageSize,
  );
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverHasPreviousPage, setServerHasPreviousPage] = useState(false);
  const [serverHasNextPage, setServerHasNextPage] = useState(false);

  //zoom
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [loading, setLoading] = useState(() => !disableAutoFetch);
  const [tableReveal, setTableReveal] = useState(false);
  const [error, setError] = useState(null);
  const [listAuditHorizontalControl, setListAuditHorizontalControl] = useState({
    max: 0,
    value: 0,
  });
  const [listAuditVerticalControl, setListAuditVerticalControl] = useState({
    max: 0,
    value: 0,
  });
  const handleListAuditHorizontalControlChange = useCallback((nextState) => {
    setListAuditHorizontalControl((prev) => {
      const normalizedNext =
        typeof nextState === "function" ? nextState(prev) : nextState;

      if (
        prev.max === normalizedNext?.max &&
        prev.value === normalizedNext?.value
      ) {
        return prev;
      }

      return {
        max: normalizedNext?.max ?? 0,
        value: normalizedNext?.value ?? 0,
      };
    });
  }, []);
  const handleListAuditVerticalControlChange = useCallback((nextState) => {
    setListAuditVerticalControl((prev) => {
      const normalizedNext =
        typeof nextState === "function" ? nextState(prev) : nextState;

      if (
        prev.max === normalizedNext?.max &&
        prev.value === normalizedNext?.value
      ) {
        return prev;
      }

      return {
        max: normalizedNext?.max ?? 0,
        value: normalizedNext?.value ?? 0,
      };
    });
  }, []);

  //hover highlight

  const [highlightRowId, setHighlightRowId] = useState(null);
  const [focusColumnKey, setFocusColumnKey] = useState(null);
  const [pendingServerFocusId, setPendingServerFocusId] = useState(
    rowIdFromLocation || null,
  );
  const initialViewCaptureKeyRef = useRef("");
  const initialViewStateRef = useRef({
    searchTerm: "",
    searchScope: SEARCH_SCOPE_ALL,
    filters: cloneTableViewFilters(filters),
  });

  const [hasDistinct, setHasDistinct] = useState(false);

  useEffect(() => {
    if (!hasInlineData || !Array.isArray(data)) return;
    setTableData(data);
  }, [data, hasInlineData]);

  useEffect(() => {
    tableDataRef.current = Array.isArray(tableData) ? tableData : [];
  }, [tableData]);

  useEffect(() => {
    if (!disableAutoFetch) return;
    setError(null);
    setLoading(false);
  }, [disableAutoFetch]);

  useEffect(() => {
    if (apiUrl) return;

    setError(null);
    setLoading(false);
  }, [apiUrl, data]);

  const resolveColumnKey = useCallback((row, column) => {
    if (!row || !column) return null;

    const normalized = column.trim().toLowerCase();

    return Object.keys(row).find((k) => k.toLowerCase() === normalized);
  }, []);

  const compare = (cellValue, operator, filterValue) => {
    // ✅ explicit empty-string filtering
    if (filterValue === "") {
      return cellValue === "" || cellValue == null;
    }

    // 🚫 null / undefined never match non-empty filters
    if (cellValue == null) return false;

    const cellStr = String(cellValue).toLowerCase();
    const filterStr = String(filterValue).toLowerCase();

    const numCell = Number(cellValue);
    const numFilter = Number(filterValue);
    const bothNumber = !isNaN(numCell) && !isNaN(numFilter);

    const dateCell = new Date(cellValue);
    const dateFilter = new Date(filterValue);
    const bothDate = !isNaN(dateCell) && !isNaN(dateFilter);

    switch (operator) {
      case "=":
        if (bothNumber) return numCell === numFilter;
        if (bothDate) return dateCell.getTime() === dateFilter.getTime();
        return cellStr === filterStr;

      case "!=":
        if (bothNumber) return numCell !== numFilter;
        if (bothDate) return dateCell.getTime() !== dateFilter.getTime();
        return cellStr !== filterStr;

      case "contains":
        return cellStr.includes(filterStr);

      case ">":
        if (bothNumber) return numCell > numFilter;
        if (bothDate) return dateCell > dateFilter;
        return cellStr > filterStr;

      case "<":
        if (bothNumber) return numCell < numFilter;
        if (bothDate) return dateCell < dateFilter;
        return cellStr < filterStr;

      case ">=":
        if (bothNumber) return numCell >= numFilter;
        if (bothDate) return dateCell >= dateFilter;
        return cellStr >= filterStr;

      case "<=":
        if (bothNumber) return numCell <= numFilter;
        if (bothDate) return dateCell <= dateFilter;
        return cellStr <= filterStr;

      default:
        return cellStr.includes(filterStr);
    }
  };

  const resolvePatchField = useCallback(
    (field) => reverseColumnMap?.[field] || field,
    [reverseColumnMap],
  );

  const headerMap = useMemo(() => {
    const baseMap = isListAuditTarget(endpointName) ? LIST_AUDIT_COLUMN_LABELS : {};
    return {
      ...baseMap,
      ...(columnLabelOverrides && typeof columnLabelOverrides === "object"
        ? columnLabelOverrides
        : {}),
    };
  }, [columnLabelOverrides, endpointName]);
  const shouldDisableZoomForSticky = isListAuditTarget(endpointName) || useGridRenderer;
  const usesListAuditGridRenderer =
    (isListAuditTarget(endpointName) || useGridRenderer) && !rowOrderEnabled;
  const isAuditTableArea = normalizeTableArea(tableArea) === "audit";
  const isSpreadsheetLayout =
    String(layoutPreset ?? "").trim().toLowerCase() === "spreadsheet";
  const shouldUseStableAuditLayout = isAuditTableArea;
  const stableAuditCardHeight = expanded
    ? "clamp(760px, 84vh, 980px)"
    : "clamp(620px, 76vh, 820px)";
  const spreadsheetCardHeight = expanded
    ? "clamp(820px, 92vh, 1100px)"
    : "clamp(700px, 86vh, 980px)";
  const tableCardHeight = shouldUseStableAuditLayout
    ? stableAuditCardHeight
    : isSpreadsheetLayout
      ? spreadsheetCardHeight
    : isListAuditTarget(endpointName)
      ? expanded
        ? "88vh"
        : "clamp(560px, 74vh, 780px)"
      : expanded
        ? "85vh"
        : "66vh";
  const tableCardMaxHeight = shouldUseStableAuditLayout
    ? stableAuditCardHeight
    : isSpreadsheetLayout
      ? spreadsheetCardHeight
    : expanded
      ? isListAuditTarget(endpointName)
        ? "88vh"
        : "85vh"
      : isListAuditTarget(endpointName)
        ? "clamp(560px, 74vh, 780px)"
        : "66vh";
  const zoomControlHiddenButtons = useMemo(() => [], []);
  const modalZoomControlHiddenButtons = useMemo(
    () => [...new Set([...zoomControlHiddenButtons, "fullscreen"])],
    [zoomControlHiddenButtons],
  );
  const tableWrapperSpacingClass = isSpreadsheetLayout ? "" : "ms-3 me-3";
  const tableZoomStyle = useMemo(
    () => ({
      zoom: zoomLevel,
      transformOrigin: "top left",
    }),
    [zoomLevel],
  );
  const stickyRenderHostStyle = useMemo(
    () => ({
      height: "100%",
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      ...tableZoomStyle,
    }),
    [tableZoomStyle],
  );

  useEffect(() => {
    if (!shouldDisableZoomForSticky) {
      setListAuditHorizontalControl({ max: 0, value: 0 });
      setListAuditVerticalControl({ max: 0, value: 0 });
    }
  }, [shouldDisableZoomForSticky]);

  useEffect(() => {
    if (!canManageTable && editMode) {
      setEditMode(false);
    }
  }, [canManageTable, editMode, setEditMode]);

  useEffect(() => {
    if (loading) return;

    const captureKey = `${endpointName}::${location.pathname}::${location.search}`;
    if (initialViewCaptureKeyRef.current === captureKey) {
      return;
    }

    initialViewStateRef.current = {
      searchTerm: searchTerm ?? "",
      searchScope: searchScope ?? SEARCH_SCOPE_ALL,
      filters: cloneTableViewFilters(filters),
    };
    initialViewCaptureKeyRef.current = captureKey;
  }, [
    endpointName,
    filters,
    loading,
    location.pathname,
    location.search,
    searchScope,
    searchTerm,
  ]);

  const applyFilterFromEdit = useCallback(
    (column, value) => {
      if (!onFiltersChange) return;

      onFiltersChange({
        filters: [
          {
            column,
            operator: "=",
            value,
          },
        ],
        mode: "and",
        sort: null,
        visibleColumns: filters?.visibleColumns ?? null,
        distinct: null, // optional: turn off distinct automatically
      });

      toast.info(`Filtered: ${column} = ${value}`);
    },
    [onFiltersChange, filters?.visibleColumns],
  );

  // ðŸ” Helper to log changes
  const handleChangeLog = useCallback(
    async (
      tableName,
      id,
      changeType,
      field = null,
      oldValue = null,
      newValue = null,
    ) => {
      try {
        let changeSummary;

        if (changeType === "POST") {
          changeSummary = `Row added Id: ${id}`;
        } else if (changeType === "DELETE") {
          changeSummary = `Row deleted Id: ${id}`;
        } else {
          changeSummary = `Field '${field}' changed from '${oldValue}' to '${newValue}'`;
        }

        const payload = {
          tableName,
          entityId: id,
          changeType,
          changedBy: user?.name || "Unknown",
          changeSummary,
          ipAddress: window.location.hostname,
        };

        const res = await fetch(
          `${process.env.REACT_APP_API_BASE_URL}ChangeLog`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) throw new Error(await res.text());
        console.log("ðŸ§¾ Change logged:", payload);
      } catch (err) {
        console.error("âŒ ChangeLog failed:", err);
      }
    },
    [user],
  );
  void handleChangeLog;

  const getRowExtraDataObject = useCallback((row) => {
    const rawExtraData = row?.__rawExtraData ?? row?.ExtraData;

    if (!rawExtraData) {
      return {};
    }

    if (typeof rawExtraData === "string") {
      try {
        const parsed = JSON.parse(rawExtraData);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }

    return rawExtraData && typeof rawExtraData === "object" ? rawExtraData : {};
  }, []);

  const buildPatchedRow = useCallback(
    (row, payload) => {
      const nextRow = { ...row };
      const nextExtraData = { ...getRowExtraDataObject(row) };

      Object.entries(payload || {}).forEach(([rawKey, rawValue]) => {
        const key = String(rawKey ?? "");

        if (isInternalExtraDataKey(key) || !(key in nextRow)) {
          if (
            rawValue == null ||
            (typeof rawValue === "object" &&
              !Array.isArray(rawValue) &&
              Object.keys(rawValue).length === 0)
          ) {
            delete nextExtraData[key];
          } else {
            nextExtraData[key] = rawValue;
          }
          return;
        }

        nextRow[key] = rawValue;
      });

      nextRow.__rawExtraData = nextExtraData;
      nextRow.ExtraData = nextExtraData;

      return nextRow;
    },
    [getRowExtraDataObject],
  );

  const extractReturnedPatchedRow = useCallback((payload, fallbackRow) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const candidate =
      payload.row ||
      payload.updated ||
      payload.weeklyTable ||
      payload.newprocure ||
      payload.existingprocure ||
      (Object.prototype.hasOwnProperty.call(payload, "Id") ||
      Object.prototype.hasOwnProperty.call(payload, "id") ||
      Object.prototype.hasOwnProperty.call(payload, "ID")
        ? payload
        : null);

    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }

    const { Id, id, ID, ...rest } = candidate;
    const resolvedId = Id ?? id ?? ID ?? fallbackRow?.Id ?? null;

    return {
      ...(fallbackRow || {}),
      ...rest,
      Id: resolvedId,
    };
  }, []);

  const extractReturnedPatchedRows = useCallback((payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const candidates = Array.isArray(payload.rows)
      ? payload.rows
      : Array.isArray(payload.Rows)
        ? payload.Rows
        : null;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const normalized = candidates
      .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => {
        const { Id, id, ID, ...rest } = entry;
        const resolvedId = Id ?? id ?? ID ?? null;
        return { Id: resolvedId, ...rest };
      });

    return normalized.length > 0 ? normalized : null;
  }, []);

  const extractReturnedUpdatedRows = useCallback((payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const candidates = Array.isArray(payload.updatedRows)
      ? payload.updatedRows
      : Array.isArray(payload.UpdatedRows)
        ? payload.UpdatedRows
        : null;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const normalized = candidates
      .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => {
        const { Id, id, ID, ...rest } = entry;
        const resolvedId = Id ?? id ?? ID ?? null;
        return { Id: resolvedId, ...rest };
      })
      .filter((row) => row.Id !== null && row.Id !== undefined);

    return normalized.length > 0 ? normalized : null;
  }, []);

  const applyReturnedMutationPayload = useCallback(
    (responsePayload, previousRowSnapshot, id) => {
      const returnedPatchedRows = extractReturnedPatchedRows(responsePayload);
      const returnedUpdatedRows = extractReturnedUpdatedRows(responsePayload);
      const returnedPatchedRow = extractReturnedPatchedRow(
        responsePayload,
        previousRowSnapshot,
      );

      if (returnedPatchedRows) {
        setTableData(returnedPatchedRows);
        if (typeof onRowsReplaced === "function") {
          onRowsReplaced(returnedPatchedRows);
        }
        return true;
      }

      if (returnedUpdatedRows) {
        setTableData((prev) => {
          const updatesById = new Map(
            returnedUpdatedRows.map((updatedRow) => [String(updatedRow.Id), updatedRow]),
          );

          const merged = prev.map((currentRow) => {
            const updated = updatesById.get(String(currentRow.Id));
            return updated ? { ...currentRow, ...updated } : currentRow;
          });

          if (typeof onRowsReplaced === "function") {
            onRowsReplaced(merged);
          }

          return merged;
        });
        return true;
      }

      if (returnedPatchedRow) {
        setTableData((prev) => {
          const merged = prev.map((currentRow) =>
            currentRow.Id === id ? returnedPatchedRow : currentRow,
          );

          if (typeof onRowsReplaced === "function") {
            onRowsReplaced(merged);
          }

          return merged;
        });
        return true;
      }

      return false;
    },
    [
      extractReturnedPatchedRows,
      extractReturnedUpdatedRows,
      extractReturnedPatchedRow,
      onRowsReplaced,
    ],
  );

  // ---------------- Safe Edit Handler PATCH ----------------
  const defaultEditHandler = useCallback(
    async (id, field, value) => {
      let changePayload =
        field && typeof field === "object" && !Array.isArray(field)
          ? field
          : { [field]: value };

      console.log("✏️ Edit request:", { id, changePayload });

      const blockedField = Object.keys(changePayload).find((key) =>
        SYSTEM_MANAGED_COLUMNS.has(normalizeColumnToken(key)),
      );
      if (blockedField) {
        toast.info(`${blockedField} diisi otomatis oleh sistem dan tidak bisa diedit.`);
        return;
      }

      const normalizedEndpointName = normalizeColumnToken(endpointName);
      const isPlanningOpexEndpoint =
        normalizedEndpointName === "opex" || normalizedEndpointName === "opextemplate";
      const fullYearKey = Object.keys(changePayload).find(
        (key) => normalizeColumnToken(key) === "fullyearfy",
      );

      if (isPlanningOpexEndpoint && fullYearKey) {
        const parsed = parseLooseNumericInput(changePayload[fullYearKey]);
        if (!parsed.valid) {
          toast.warning("Nilai FY harus angka valid (contoh: 1234,56 atau 1.234,56).");
          return;
        }

        changePayload = {
          ...changePayload,
          [fullYearKey]: parsed.hasValue ? parsed.value : null,
        };
      }

      // 🚫 BLOCK EDIT IN DISTINCT MODE
      // 🚫 DISTINCT MODE → FILTER INSTEAD OF EDIT
      if (filters?.distinct?.column) {
        const distinctColumn = filters.distinct.column;

        // 🔥 get row from rendered data, NOT tableData
        const renderedRow =
          sortedData.find((r) => r.Id === id) ||
          tableData.find((r) => r.Id === id);

        const distinctValue = renderedRow?.[distinctColumn];

        if (distinctValue == null) {
          console.warn("Distinct column:", distinctColumn);
          console.warn("Rendered row:", renderedRow);
          toast.warning("Cannot apply filter: distinct value not found.");
          return;
        }

        toast.info(
          `Distinct mode → filtering ${distinctColumn} = ${distinctValue}`,
        );

        applyFilterFromEdit(distinctColumn, distinctValue);
        return;
      }

      if (!canEditCells) {
        toast.warning("You only have view access for this module.");
        return;
      }
      if (!apiUrl) return;

      const row = tableData.find((r) => r.Id === id);

      if (!row) {
        console.warn("⚠️ Could not find row with ID:", id);
        return;
      }

      const hasMeaningfulChange = Object.entries(changePayload).some(
        ([key, nextValue]) => {
          if (isInternalExtraDataKey(key) || !(key in row)) {
            const currentExtraValue = getRowExtraDataObject(row)?.[key];
            return JSON.stringify(currentExtraValue ?? null) !== JSON.stringify(nextValue ?? null);
          }

          return String(row[key] ?? "") !== String(nextValue ?? "");
        },
      );

      if (!hasMeaningfulChange) return;

      const previousRowSnapshot = row;

      if (!isPlanningOpexEndpoint) {
        setTableData((prev) =>
          prev.map((currentRow) =>
            currentRow.Id === id
              ? buildPatchedRow(currentRow, changePayload)
              : currentRow,
          ),
        );
      }

      try {
        const cleanBase = (patchUrlBase || apiUrl)
          .replace(/\/year\/\d+$/, "")
          .replace(/\/$/, "");

        const patchUrl = appendPathSegmentToUrl(cleanBase, id);
        // ✅ DEBUG LOG
        console.log("🔧 PATCH URL:", patchUrl);
        console.log("📦 PATCH payload:", changePayload);

        const realPayload = Object.entries(changePayload).reduce(
          (accumulator, [key, nextValue]) => {
            const resolvedKey = isInternalExtraDataKey(key)
              ? key
              : resolvePatchField(key);
            accumulator[resolvedKey] = nextValue;
            return accumulator;
          },
          {},
        );

        const res = await fetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(realPayload),
          credentials: "include",
        });

        if (!res.ok) throw new Error(await res.text());

        let responsePayload = null;
        const responseContentType = res.headers.get("content-type") || "";
        if (responseContentType.toLowerCase().includes("application/json")) {
          try {
            responsePayload = await res.json();
          } catch (parseError) {
            console.warn("Failed to parse PATCH response JSON:", parseError);
          }
        }

        applyReturnedMutationPayload(responsePayload, previousRowSnapshot, id);

        console.log("✅ Updated row payload", realPayload);
        onUpdateSuccess?.();
        onMutationSuccess?.();

        // 🧾 Log change (after success)
      } catch (err) {
        console.error("❌ PATCH failed:", err);
        toast.error(
          String(err?.message || "Gagal menyimpan perubahan.")
            .replace(/^Error:\s*/i, "")
            .slice(0, 280),
        );
        setTableData((prev) =>
          prev.map((currentRow) =>
            currentRow.Id === id ? previousRowSnapshot : currentRow,
          ),
        );
      }
    },
    [
      apiUrl,
      applyFilterFromEdit,
      canEditCells,
      filters?.distinct?.column,
      onUpdateSuccess,
      patchUrlBase,
      applyReturnedMutationPayload,
      buildPatchedRow,
      getRowExtraDataObject,
      resolvePatchField,
      sortedData,
      tableData,
      endpointName,
      onRowsReplaced,
    ],
  );

  const safeEditHandler = useCallback(
    async (...args) => {
      if (!canEditCells) {
        toast.warning("You only have view access for this module.");
        return;
      }

      if (!onEdit) {
        return defaultEditHandler(...args);
      }

      const [id, , , , rowArg] = args;
      const previousRowSnapshot =
        rowArg ||
        sortedData.find((row) => row.Id === id) ||
        tableData.find((row) => row.Id === id) ||
        null;

      const responsePayload = await onEdit(...args);
      const applied = applyReturnedMutationPayload(
        responsePayload,
        previousRowSnapshot,
        id,
      );

      if (applied) {
        onUpdateSuccess?.();
        onMutationSuccess?.();
      }

      return responsePayload;
    },
    [
      canEditCells,
      onEdit,
      defaultEditHandler,
      sortedData,
      tableData,
      applyReturnedMutationPayload,
      onUpdateSuccess,
      onMutationSuccess,
    ],
  );

  const serializedServerFilters = useMemo(
    () => JSON.stringify(debouncedFilters?.filters ?? []),
    [debouncedFilters?.filters],
  );
  const serializedServerDistinct = useMemo(
    () => JSON.stringify(debouncedFilters?.distinct ?? null),
    [debouncedFilters?.distinct],
  );
  const serializedServerPriorityBottomIds = useMemo(
    () => JSON.stringify(debouncedFilters?.priorityBottomIds ?? []),
    [debouncedFilters?.priorityBottomIds],
  );
  const fetchSignature = useMemo(
    () =>
      JSON.stringify({
        apiUrl: apiUrl || "",
        server: Boolean(isServerQueryEnabled),
        page: serverPage,
        pageSize: serverPageSize,
        search: debouncedSearch || "",
        scope: searchScope || SEARCH_SCOPE_ALL,
        filters: debouncedFilters ?? null,
        refreshTrigger,
        reloadKey,
      }),
    [
      apiUrl,
      debouncedFilters,
      debouncedSearch,
      isServerQueryEnabled,
      refreshTrigger,
      reloadKey,
      searchScope,
      serverPage,
      serverPageSize,
    ],
  );

  useEffect(() => {
    if (!isServerQueryEnabled) return;
    setServerPage(1);
  }, [
    isServerQueryEnabled,
    debouncedSearch,
    searchScope,
    debouncedFilters?.mode,
    serializedServerFilters,
    serializedServerDistinct,
    debouncedFilters?.sort?.column,
    debouncedFilters?.sort?.direction,
    debouncedFilters?.priorityTopNullColumn,
    serializedServerPriorityBottomIds,
  ]);

  useEffect(() => {
    if (disableAutoFetch) return undefined;
    if (!apiUrl) return;
    if (lastCompletedFetchSignatureRef.current === fetchSignature) return undefined;

    let cancelled = false;
    const abortController = new AbortController();

    const fetchData = async () => {
      const startedAt = Date.now();
      const minLoadingMs = isServerQueryEnabled ? 0 : TABLE_REFRESH_MIN_MS;
      const hadVisibleRowsBeforeFetch =
        Array.isArray(tableDataRef.current) && tableDataRef.current.length > 0;
      const waitForGridSettle = async () => {
        await new Promise((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(resolve),
          ),
        );

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minLoadingMs - elapsed);
        if (remaining > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remaining));
        }

        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      };

      try {
        suppressNextRevealRef.current = hadVisibleRowsBeforeFetch;
        setLoading(true);
        setError(null);

        let rows = [];
        let totalCount = 0;
        let totalPages = 1;
        let page = serverPage;
        let hasPreviousPage = false;
        let hasNextPage = false;

        let res;
        if (isServerQueryEnabled) {
          const queryPayload = isProcurementListServerMode
            ? buildProcurementServerQueryPayload({
                filters: debouncedFilters,
                searchTerm: debouncedSearch,
                searchScope,
                visibleColumns: debouncedFilters?.visibleColumns,
                allSearchableColumns: columns,
                page: serverPage,
                pageSize: serverPageSize,
                focusId: pendingServerFocusId ? Number(pendingServerFocusId) : null,
              })
            : isHumanResourceServerMode
              ? buildHumanResourceServerQueryPayload({
                  endpointName,
                  filters: debouncedFilters,
                  searchTerm: debouncedSearch,
                  searchScope,
                  visibleColumns: debouncedFilters?.visibleColumns,
                  allSearchableColumns: columns,
                  page: serverPage,
                  pageSize: serverPageSize,
                  focusId: pendingServerFocusId ? Number(pendingServerFocusId) : null,
                })
            : isComplianceWeeklyServerMode
              ? buildComplianceWeeklyServerQueryPayload({
                  filters: debouncedFilters,
                  searchTerm: debouncedSearch,
                  searchScope,
                  visibleColumns: debouncedFilters?.visibleColumns,
                  allSearchableColumns: columns,
                  page: serverPage,
                  pageSize: serverPageSize,
                  focusId: pendingServerFocusId ? Number(pendingServerFocusId) : null,
                })
            : isPlanningOpexServerMode
              ? buildPlanningOpexServerQueryPayload({
                  filters: debouncedFilters,
                  searchTerm: debouncedSearch,
                  searchScope,
                  visibleColumns: debouncedFilters?.visibleColumns,
                  allSearchableColumns: columns,
                  page: serverPage,
                  pageSize: serverPageSize,
                  focusId: pendingServerFocusId ? Number(pendingServerFocusId) : null,
                })
            : buildListAuditServerQueryPayload({
                filters: debouncedFilters,
                searchTerm: debouncedSearch,
                searchScope,
                visibleColumns: debouncedFilters?.visibleColumns,
                allSearchableColumns: columns,
                page: serverPage,
                pageSize: serverPageSize,
                focusId: pendingServerFocusId ? Number(pendingServerFocusId) : null,
              });

          res = await fetch(appendPathSegmentToUrl(apiUrl, "query"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(queryPayload),
            signal: abortController.signal,
          });
        } else {
          res = await fetch(apiUrl, {
            credentials: "include",
            signal: abortController.signal,
          });
        }

        if (res.status === 403) {
          if (cancelled) return;
          console.error("Backend returned 403 for:", apiUrl);
          setError("You don't have access to view this table.");
          setLoading(false);
          return;
        }

        if (isRestrictedReadOnly) {
          if (cancelled) return;
          console.error("Blocked in the Front end");
          setError("You don't have access to view this table.");
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error(await res.text());

        if (isServerQueryEnabled) {
          const payload = await res.json();
          rows = (Array.isArray(payload?.Rows) ? payload.Rows : []).map((o) => {
            const { Id, id, ID, ...rest } = o;
            const finalId = Id ?? id ?? ID ?? null;
            return { Id: finalId, ...rest };
          });
          totalCount = Number(payload?.TotalCount ?? 0);
          totalPages = Math.max(1, Number(payload?.TotalPages ?? 1));
          page = Math.max(1, Number(payload?.Page ?? 1));
          hasPreviousPage = Boolean(payload?.HasPreviousPage);
          hasNextPage = Boolean(payload?.HasNextPage);
        } else {
          rows = await res.json();
          rows = rows.map((o) => {
            const { Id, id, ID, ...rest } = o;
            const finalId = Id ?? id ?? ID ?? null;
            return { Id: finalId, ...rest };
          });
        }

        if (isServerQueryEnabled) {
          rows = appendServerDistinctTotalRow(rows, debouncedFilters?.distinct?.column);
        }
        rows = attachDistinctUiRowKeys(rows, debouncedFilters?.distinct?.column);

        if (cancelled) return;
        setTableData(rows);
        if (isServerQueryEnabled) {
          setServerTotalCount(totalCount);
          setServerTotalPages(totalPages);
          setServerHasPreviousPage(hasPreviousPage);
          setServerHasNextPage(hasNextPage);
          if (page !== serverPage) {
            setServerPage(page);
          }
          if (
            pendingServerFocusId &&
            rows.some((row) => String(row?.Id ?? "") === String(pendingServerFocusId))
          ) {
            setPendingServerFocusId(null);
          }
        }
        await waitForGridSettle();
        if (cancelled) return;
        lastCompletedFetchSignatureRef.current = fetchSignature;
        setLoading(false);
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minLoadingMs - elapsed);
        if (remaining > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remaining));
        }
        if (cancelled) return;
        console.error("❌ Fetch failed:", err);
        setError(err?.message || "Failed to load data.");
        lastCompletedFetchSignatureRef.current = fetchSignature;
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    apiUrl,
    columns,
    debouncedFilters,
    debouncedSearch,
    isProcurementListServerMode,
    isHumanResourceServerMode,
    isComplianceWeeklyServerMode,
    isPlanningOpexServerMode,
    isServerQueryEnabled,
    isRestrictedReadOnly,
    endpointName,
    pendingServerFocusId,
    refreshTrigger,
    reloadKey,
    searchScope,
    serverPage,
    serverPageSize,
    disableAutoFetch,
    fetchSignature,
  ]);

  useEffect(() => {
    if (loading || error) {
      setTableReveal(false);
      return undefined;
    }

    if (suppressNextRevealRef.current) {
      suppressNextRevealRef.current = false;
      setTableReveal(false);
      return undefined;
    }

    setTableReveal(true);
    const timer = window.setTimeout(() => {
      setTableReveal(false);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [loading, error, tableData]);

  // //get Table Headers from backend
  // useEffect(() => {
  //   const fetchHeaders = async () => {
  //     try {
  //       if (!endpointName) return;

  //       const res = await fetch(
  //         `${process.env.REACT_APP_API_BASE_URL}TableHeaders/${endpointName}/all-columns`,
  //         {
  //           credentials: "include",
  //         },
  //       );
  //       if (!res.ok) throw new Error(await res.text());

  //       const headers = await res.json();

  //       // turn into { ColumnName: DisplayName }
  //       const map = {};
  //       headers.forEach((h) => {
  //         map[h.ColumnName.toUpperCase()] = h.DisplayName || h.ColumnName;
  //       });

  //       setHeaderMap(map);
  //     } catch (err) {
  //       console.error("❌ Failed to fetch headers", err);
  //     }
  //   };

  //   fetchHeaders();
  // }, [apiUrl]); // 👈 re-run when apiUrl changes
  const applyTableFilter = (payload) => {
    // 🧹 CLEAR HIGHLIGHT
    if (payload.clearHighlight) {
      setHighlightRowId(null);
      setHasHighlight(false);
    }

    // 🔥 HIGHLIGHT ONLY
    if (payload.highlightOnly) {
      handleHighlightFromFilter(payload);
      setHasHighlight(true);
      return;
    }

    // 🔁 NORMAL APPLY
    const nextFilters = hasOwnProp(payload, "filters")
      ? payload.filters ?? []
      : filters?.filters ?? [];
    const nextMode = hasOwnProp(payload, "mode")
      ? payload.mode || "and"
      : filters?.mode ?? "and";
    const nextSort = hasOwnProp(payload, "sort")
      ? payload.sort ?? null
      : filters?.sort ?? null;
    const nextVisibleColumns = hasOwnProp(payload, "visibleColumns")
      ? payload.visibleColumns ?? null
      : filters?.visibleColumns ?? null;
    const nextDistinct = hasOwnProp(payload, "distinct")
      ? payload.distinct ?? null
      : filters?.distinct ?? null;
    const nextPriorityBottomIds = hasOwnProp(payload, "priorityBottomIds")
      ? Array.from(
          new Set(
            (Array.isArray(payload.priorityBottomIds)
              ? payload.priorityBottomIds
              : [])
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value) && value > 0),
          ),
        )
      : [];
    const nextPriorityTopNullColumn = hasOwnProp(payload, "priorityTopNullColumn")
      ? typeof payload.priorityTopNullColumn === "string" &&
        payload.priorityTopNullColumn.trim()
        ? payload.priorityTopNullColumn.trim()
        : null
      : null;
    const distinctActive = !!nextDistinct?.column;

    setHasHighlight(false);
    setHasDistinct(distinctActive);
    setPriorityBottomIds(nextPriorityBottomIds);
    setPriorityTopNullColumn(nextPriorityTopNullColumn);

    setFilters({
      filters: nextFilters,
      mode: nextMode,
      sort: nextSort,
      visibleColumns: nextVisibleColumns,
      distinct: nextDistinct,
      priorityTopNullColumn: nextPriorityTopNullColumn,
      priorityBottomIds: nextPriorityBottomIds,
    });

    if (hasOwnProp(payload, "sort")) {
      setSortConfig(payload.sort ?? { column: null, direction: "asc" });
    }
  };

  const resetToInitialView = ({ ensureVisibleColumn = null } = {}) => {
    const snapshot = initialViewStateRef.current ?? {
      searchTerm: "",
      searchScope: SEARCH_SCOPE_ALL,
      filters: cloneTableViewFilters(filters),
    };

    const nextVisibleColumns =
      ensureVisibleColumn &&
      Array.isArray(snapshot.filters.visibleColumns) &&
      snapshot.filters.visibleColumns.length > 0
        ? Array.from(new Set([...snapshot.filters.visibleColumns, ensureVisibleColumn]))
        : snapshot.filters.visibleColumns;

    const nextView = {
      searchTerm: snapshot.searchTerm ?? "",
      searchScope: snapshot.searchScope ?? SEARCH_SCOPE_ALL,
      filters: {
        ...cloneTableViewFilters(snapshot.filters),
        visibleColumns: nextVisibleColumns,
      },
    };

    const currentView = {
      searchTerm,
      searchScope,
      filters: cloneTableViewFilters(filters),
    };

    const viewWasCustomized =
      normalizeViewStateForCompare(currentView) !==
      normalizeViewStateForCompare(nextView);

    setSearchTerm(nextView.searchTerm);
    setSearchScope(nextView.searchScope);
    setSelectedIds([]);
    setPendingServerFocusId(null);
    setFocusColumnKey(null);

    applyTableFilter({
      ...nextView.filters,
      clearHighlight: true,
    });

    if (isServerQueryEnabled) {
      setServerPage(1);
    }

    return viewWasCustomized;
  };

  const clearToDefaultView = useCallback(() => {
    const nextView = {
      searchTerm: "",
      searchScope: SEARCH_SCOPE_ALL,
      filters: {
        filters: [],
        mode: "and",
        sort: null,
        visibleColumns: null,
        distinct: null,
      },
    };

    const currentView = {
      searchTerm,
      searchScope,
      filters: cloneTableViewFilters(filters),
    };

    const viewWasCustomized =
      normalizeViewStateForCompare(currentView) !==
      normalizeViewStateForCompare(nextView);

    setSearchTerm(nextView.searchTerm);
    setSearchScope(nextView.searchScope);
    setSelectedIds([]);
    setPendingServerFocusId(null);
    setFocusColumnKey(null);

    applyTableFilter({
      ...nextView.filters,
      clearHighlight: true,
    });

    if (isServerQueryEnabled) {
      setServerPage(1);
    }

    return viewWasCustomized;
  }, [
    applyTableFilter,
    filters,
    isServerQueryEnabled,
    searchScope,
    searchTerm,
  ]);

  const handleRowCreated = useCallback(
    (row) => {
      const rowId = row?.Id ?? row?.id ?? row?.ID ?? null;
      if (!rowId) return;

      setHighlightRowId(String(rowId));
      setHasHighlight(false);

      if (isServerQueryEnabled) {
        setPendingServerFocusId(String(rowId));
        setServerPage(1);
      }
    },
    [isServerQueryEnabled],
  );

  const handleColumnCreated = useCallback(
    (columnKey) => {
      if (columnKey) {
        setFocusColumnKey(String(columnKey));
      }

      if (isServerQueryEnabled) {
        setServerPage(1);
      }
    },
    [isServerQueryEnabled],
  );

  const handleNavigateToChange = ({ recordId, field, changeType }) => {
    if (!recordId) {
      toast.info("Record tujuan perubahan tidak tersedia.");
      return;
    }

    if (String(changeType ?? "").toUpperCase() === "DELETE") {
      toast.info("Perubahan DELETE tidak bisa diarahkan karena row sudah terhapus.");
      return;
    }

    setSearchTerm("");
    setSearchScope(SEARCH_SCOPE_ALL);
    if (isServerQueryEnabled) {
      setPendingServerFocusId(String(recordId));
    }

    applyTableFilter({
      filters: [],
      mode: "and",
      sort: filters?.sort ?? null,
      visibleColumns: filters?.visibleColumns ?? null,
      distinct: null,
      clearHighlight: true,
    });

    setHighlightRowId(String(recordId));
    if (field) {
      setFocusColumnKey(String(field));
    }
  };

  // 🔍 Helper to log changes
  //hover highlight effect
  useEffect(() => {
    setHighlightRowId(rowIdFromLocation || null);
    setPendingServerFocusId(rowIdFromLocation || null);
  }, [rowIdFromLocation]);

  useEffect(() => {
    const nextFocusId = focusRowRequest?.id;
    if (nextFocusId === null || nextFocusId === undefined || nextFocusId === "") {
      return;
    }

    const normalizedFocusId = String(nextFocusId);
    setHighlightRowId(normalizedFocusId);

    if (isServerQueryEnabled) {
      setPendingServerFocusId(normalizedFocusId);
      setServerPage(1);
    }
  }, [focusRowRequest, isServerQueryEnabled]);

  useEffect(() => {
    if (usesListAuditGridRenderer) return;
    if (!highlightRowId || tableData.length === 0) return;

    const timer = setTimeout(() => {
      const targetRow = document.querySelector(
        `tr[data-row-id="${highlightRowId}"]`,
      );
      if (targetRow) {
        console.log("🎯 Highlighting row:", highlightRowId);

        // Scroll to the row
        targetRow.scrollIntoView({ behavior: "smooth", block: "center" });

        // Add CSS class for highlight
        targetRow.classList.add("highlighted-row");

        // Remove highlight after 4 seconds
        // setTimeout(() => {
        //   targetRow.classList.remove("highlighted-row");
        // }, 4000);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [highlightRowId, tableData, usesListAuditGridRenderer]);

  useEffect(() => {
    if (usesListAuditGridRenderer) return;
    if (highlightRowId !== null) return;

    // 🧹 REMOVE ALL HIGHLIGHT CLASSES
    document
      .querySelectorAll(".highlighted-row")
      .forEach((el) => el.classList.remove("highlighted-row"));
  }, [highlightRowId, usesListAuditGridRenderer]);

  //filter
  useEffect(() => {
    if (filters.sort?.column) {
      setSortConfig(filters.sort);
      return;
    }

    setSortConfig({ column: null, direction: "asc" });
  }, [filters.sort]);

  const distinctConfig = filters.distinct;
  const { baseNormalizedData, extraColumns } = useMemo(() => {
    const extraKeys = new Set();
    const normalized = finalTableData.map((row) => {
      const flat = { ...row };

      if (row.ExtraData) {
        let parsed = row.ExtraData;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            parsed = {};
          }
        }

        flat.__rawExtraData =
          parsed && typeof parsed === "object" ? { ...parsed } : {};

        Object.entries(parsed).forEach(([k, v]) => {
          if (isInternalExtraDataKey(k)) {
            return;
          }
          flat[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
          extraKeys.add(k);
        });

        delete flat.ExtraData;
      }

      return flat;
    });

    return {
      baseNormalizedData: normalized,
      extraColumns: Array.from(extraKeys),
    };
  }, [finalTableData]);

  const inferredColumns = useMemo(() => {
    const discovered = new Set();

    (Array.isArray(baseNormalizedData) ? baseNormalizedData : []).forEach((row) => {
      Object.keys(row || {}).forEach((key) => {
        if (key !== "__isTotalRow" && !isInternalExtraDataKey(key)) {
          discovered.add(key);
        }
      });
    });

    return Array.from(discovered);
  }, [baseNormalizedData]);

  const resolvedColumns = useMemo(() => {
    const configured = Array.isArray(columns) ? columns.filter(Boolean) : [];
    if (fixedColumnsOnly) {
      if (!isListAuditTarget(endpointName)) {
        return configured;
      }

      return configured.filter(
        (column) => !isHiddenListAuditFrontendColumn(column, endpointName),
      );
    }

    const configuredSet = new Set(configured);
    const missing = inferredColumns.filter((column) => !configuredSet.has(column));
    const merged = [...configured, ...missing];

    if (!isListAuditTarget(endpointName)) {
      return merged;
    }

    return merged.filter(
      (column) => !isHiddenListAuditFrontendColumn(column, endpointName),
    );
  }, [columns, endpointName, fixedColumnsOnly, inferredColumns]);

  const searchableColumns = useMemo(() => {
    const excludedColumns = new Set([
      "action",
      "id",
      "extradata",
      "__istotalrow",
      "__rawextradata",
    ]);
    if (hideColumnYear) {
      excludedColumns.add("year");
    }
    if (isListAuditTarget(endpointName)) {
      SYSTEM_MANAGED_COLUMNS.forEach((column) => excludedColumns.add(column));
    }

    BLOB_COLUMNS.forEach((column) =>
      excludedColumns.add(String(column).trim().toLowerCase()),
    );

    const baseColumns = resolvedColumns.filter(
      (column) =>
        !excludedColumns.has(String(column ?? "").trim().toLowerCase()),
    );

    const configuredVisibleColumns =
      Array.isArray(filters.visibleColumns) && filters.visibleColumns.length > 0
        ? fixedColumnsOnly
          ? filters.visibleColumns.filter((column) => baseColumns.includes(column))
          : filters.visibleColumns
        : fixedColumnsOnly
          ? [...baseColumns]
          : [...baseColumns, ...extraColumns];

    const withDistinctColumn = distinctConfig?.column
      ? [distinctConfig.column, ...configuredVisibleColumns]
      : configuredVisibleColumns;

    return Array.from(new Set(withDistinctColumn)).filter(
      (column) =>
        !excludedColumns.has(String(column ?? "").trim().toLowerCase()) &&
        !isInternalExtraDataKey(column),
    );
  }, [
    endpointName,
    resolvedColumns,
    distinctConfig?.column,
    extraColumns,
    fixedColumnsOnly,
    filters.visibleColumns,
    hideColumnYear,
  ]);

  const searchScopeOptions = useMemo(
    () =>
      searchableColumns.map((column) => ({
        key: column,
        label: resolveTableColumnLabel(column, headerMap),
      })),
    [headerMap, searchableColumns],
  );

  useEffect(() => {
    if (searchScope === SEARCH_SCOPE_ALL) return;

    const hasSelectedScope = searchableColumns.some(
      (column) => normalizeColumnToken(column) === normalizeColumnToken(searchScope),
    );

    if (!hasSelectedScope) {
      setSearchScope(SEARCH_SCOPE_ALL);
    }
  }, [searchScope, searchableColumns]);

  const rawFilteredData = useMemo(() => {
    if (isServerQueryEnabled) {
      return baseNormalizedData;
    }

    const { filters: fltrs = [], mode = "and" } = debouncedFilters || {};
    const effectiveSearchColumns =
      searchScope === SEARCH_SCOPE_ALL ? searchableColumns : [searchScope];

    return baseNormalizedData.filter((row) => {
      const matchesSearch = rowMatchesSearch({
        row,
        search: debouncedSearch,
        columns: effectiveSearchColumns,
        resolveColumnKey,
        excludedColumns: ["Action", "Id", "ExtraData", "__isTotalRow"],
      });

      if (!matchesSearch) return false;
      if (fltrs.length === 0) return true;

      if (mode === "and") {
        return fltrs.every((filter) => {
          const key = resolveColumnKey(row, filter.column);
          if (!key) return false;

          return compare(row[key], filter.operator || "contains", filter.value);
        });
      }

      return fltrs.some((filter) => {
        const key = resolveColumnKey(row, filter.column);
        if (!key) return false;

        return compare(row[key], filter.operator || "contains", filter.value);
      });
    });
  }, [
    baseNormalizedData,
    debouncedFilters,
    debouncedSearch,
    isServerQueryEnabled,
    resolveColumnKey,
    searchScope,
    searchableColumns,
  ]);

  const distinctData = useMemo(() => {
    if (isServerQueryEnabled) return null;
    if (!distinctConfig?.column) return null;

    const groupedRows = new Map();
    const grandTotals = { Total: 0 };

    rawFilteredData.forEach((row) => {
      const rawGroupValue = row[distinctConfig.column];
      const groupToken = normalizeDistinctGroupToken(rawGroupValue);
      if (groupToken === DISTINCT_EMPTY_TOKEN) return;

      if (!groupedRows.has(groupToken)) {
        groupedRows.set(groupToken, {
          groupValue: rawGroupValue,
          rowKey: buildDistinctUiRowKey(distinctConfig.column, groupToken),
          counts: {},
          total: 0,
        });
      }

      const group = groupedRows.get(groupToken);
      if (!group) return;

      Object.entries(row).forEach(([col, val]) => {
        if (
          col === "Id" ||
          col === "__rowKey" ||
          isInternalExtraDataKey(col) ||
          BLOB_COLUMNS.has(col)
        ) {
          return;
        }
        if (typeof val === "string" && val.length > 500) return;

        const normalizedVal =
          val === null || val === undefined || val === ""
            ? DISTINCT_EMPTY_TOKEN
            : val;

        group.counts[col] ??= {};
        group.counts[col][normalizedVal] =
          (group.counts[col][normalizedVal] || 0) + 1;
      });

      group.total += 1;
      grandTotals.Total += 1;
    });

    let nextDistinctRowId = 1;
    const rows = Array.from(groupedRows.values()).map((group) => {
      const row = {
        Id: nextDistinctRowId++,
        __rowKey: group.rowKey,
        [distinctConfig.column]: group.groupValue,
      };

      Object.entries(group.counts).forEach(([col, values]) => {
        row[col] = Object.entries(values).map(([value, count]) => ({
          value: value === DISTINCT_EMPTY_TOKEN ? null : value,
          count,
        }));
      });

      row.Total = group.total;
      return row;
    });

    rows.push({
      Id: nextDistinctRowId,
      __rowKey: buildDistinctUiRowKey(distinctConfig.column, DISTINCT_TOTAL_TOKEN),
      [distinctConfig.column]: "Total",
      ...grandTotals,
      __isTotalRow: true,
    });

    return rows;
  }, [distinctConfig, isServerQueryEnabled, rawFilteredData]);

  const normalizedData = distinctData ?? rawFilteredData;
  // 2. Derive columns (base + dynamic extras)
  
  const derivedColumns = useMemo(() => {
    if (distinctConfig?.column) {
      const allowedDistinctColumns = fixedColumnsOnly
        ? new Set(
            [
              ...resolvedColumns,
              distinctConfig.column,
              "Total",
              "Action",
            ].filter(Boolean),
          )
        : null;
      const cols =
        normalizedData.length > 0
          ? Object.keys(normalizedData[0]).filter(
              (c) =>
                c !== "__isTotalRow" &&
                c !== "Id" &&
                !isInternalExtraDataKey(c) &&
                (!allowedDistinctColumns || allowedDistinctColumns.has(c)) &&
                (!Array.isArray(filters.visibleColumns) ||
                  filters.visibleColumns.includes(c) ||
                  c === distinctConfig.column ||
                  c === "Total"),
            )
          : [];

      return ensureTotalColumnAtEnd(cols);
    }

    // ─────────────────────────────
    // NORMAL MODE
    // ─────────────────────────────
    const hidden = ["id", "extradata"];
    if (hideColumnYear) hidden.push("year"); // ✅ hide year if flag is true
    if (isListAuditTarget(endpointName)) {
      hidden.push("createdat", "updatedat");
    }
    const baseCols = resolvedColumns.filter(
      (c) => !hidden.includes(String(c ?? "").toLowerCase()),
    );

    let allCols =
      actionKeys.length > 0
        ? [
            "Action",
            ...baseCols,
            ...(fixedColumnsOnly ? [] : extraColumns),
          ]
        : [...baseCols, ...(fixedColumnsOnly ? [] : extraColumns)];

    const normalizedVisibleColumns = isListAuditTarget(endpointName)
      ? normalizeListAuditVisibleColumns(filters.visibleColumns)
      : filters.visibleColumns;

    if (isListAuditTarget(endpointName)) {
      const nextCols = [...allCols];
      const allowNumberColumn = baseCols.includes("NO");

      if (allowNumberColumn && !nextCols.includes("NO")) {
        if (nextCols.includes("Action")) {
          nextCols.splice(1, 0, "NO");
        } else {
          nextCols.unshift("NO");
        }
      }

      if (!nextCols.includes("NAMAAUDIT") && baseCols.includes("NAMAAUDIT")) {
        const noIndex = nextCols.indexOf("NO");
        const actionIndex = nextCols.indexOf("Action");
        const insertIndex =
          noIndex >= 0 ? noIndex + 1 : actionIndex >= 0 ? actionIndex + 1 : 0;
        nextCols.splice(insertIndex, 0, "NAMAAUDIT");
      }

      allCols = nextCols;
    }

    if (
      Array.isArray(normalizedVisibleColumns) &&
      normalizedVisibleColumns.length
    ) {
      return allCols.filter(
        (c) =>
          c === "Action" ||
          (isListAuditTarget(endpointName) &&
            LIST_AUDIT_LOCKED_VISIBLE_COLUMNS.has(c)) ||
          normalizedVisibleColumns.includes(c),
      );
    }

    return allCols;
  }, [
    actionKeys,
    endpointName,
    extraColumns,
    filters.visibleColumns,
    fixedColumnsOnly,
    distinctConfig,
    hideColumnYear,
    normalizedData,
    resolvedColumns,
  ]);

  useEffect(() => {
    if (!focusColumnKey || !wrapperRef.current) return;
    if (
      !derivedColumns.some(
        (column) =>
          normalizeColumnToken(column) === normalizeColumnToken(focusColumnKey),
      )
    ) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;

    const tryFocusColumn = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return false;

      const headers = Array.from(
        wrapper.querySelectorAll("[data-column-id]"),
      );

      const target = headers.find(
        (header) =>
          normalizeColumnToken(header.getAttribute("data-column-id")) ===
          normalizeColumnToken(focusColumnKey),
      );

      if (!target) return false;

      const wrapperRect = wrapper.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const currentLeft = wrapper.scrollLeft;
      const desiredLeft =
        currentLeft +
        (targetRect.left - wrapperRect.left) -
        wrapper.clientWidth / 2 +
        targetRect.width / 2;

      wrapper.scrollTo({
        left: Math.max(0, desiredLeft),
        behavior: "smooth",
      });

      const previousOutline = target.style.outline;
      const previousOutlineOffset = target.style.outlineOffset;
      const previousBackground = target.style.backgroundColor;
      const isDarkMode =
        typeof document !== "undefined" &&
        document.body?.classList?.contains("dark-only");
      target.style.outline = isDarkMode
        ? "2px solid rgba(244, 124, 76, 0.95)"
        : "2px solid rgba(241, 90, 34, 0.92)";
      target.style.outlineOffset = "-2px";
      target.style.backgroundColor = isDarkMode
        ? "rgba(241, 90, 34, 0.2)"
        : "#fdeee7";

      window.setTimeout(() => {
        target.style.outline = previousOutline;
        target.style.outlineOffset = previousOutlineOffset;
        target.style.backgroundColor = previousBackground;
        setFocusColumnKey(null);
      }, 2200);

      return true;
    };

    const interval = window.setInterval(() => {
      attempts += 1;

      if (tryFocusColumn() || attempts >= maxAttempts) {
        window.clearInterval(interval);

        if (attempts >= maxAttempts) {
          setFocusColumnKey(null);
        }
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, [focusColumnKey, sortedData, derivedColumns]);

  // Debounce search so typing stays fluid and the table updates only after pause.
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(normalizeSearchText(searchTerm));
    }, 650);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Filters update instantly
  useEffect(() => {
    setDebouncedFilters(filters);
  }, [filters]);

  // ---------------- Filtering + Sorting ----------------
  const filteredData = normalizedData;

  const allFilterableColumns = useMemo(() => {
    if (!resolvedColumns.length) return [];

    return resolvedColumns
      .filter((key) => !isHiddenListAuditFrontendColumn(key, endpointName))
      .map((key) => ({
        key,
        label: resolveTableColumnLabel(key, headerMap),
      }));
  }, [endpointName, headerMap, resolvedColumns]);

  const toolbarFilterColumns = useMemo(
    () =>
      isAuditListAuditServerMode
        ? getListAuditServerFilterColumns(allFilterableColumns)
        : isProcurementListServerMode
          ? getProcurementServerFilterColumns(allFilterableColumns)
          : isHumanResourceServerMode
            ? getHumanResourceServerFilterColumns(endpointName, allFilterableColumns)
            : isComplianceWeeklyServerMode
              ? getComplianceWeeklyServerFilterColumns(allFilterableColumns)
              : isPlanningOpexServerMode
                ? getPlanningOpexServerFilterColumns(allFilterableColumns)
        : allFilterableColumns,
    [
      allFilterableColumns,
      endpointName,
      isAuditListAuditServerMode,
      isComplianceWeeklyServerMode,
      isHumanResourceServerMode,
      isPlanningOpexServerMode,
      isProcurementListServerMode,
    ],
  );

  const toolbarSortColumns = useMemo(
    () =>
      isAuditListAuditServerMode
        ? getListAuditServerSortColumns(allFilterableColumns)
        : isProcurementListServerMode
          ? getProcurementServerSortColumns(allFilterableColumns)
          : isHumanResourceServerMode
            ? getHumanResourceServerSortColumns(endpointName, allFilterableColumns)
            : isComplianceWeeklyServerMode
              ? getComplianceWeeklyServerSortColumns(allFilterableColumns)
              : isPlanningOpexServerMode
                ? getPlanningOpexServerSortColumns(allFilterableColumns)
        : allFilterableColumns,
    [
      allFilterableColumns,
      endpointName,
      isAuditListAuditServerMode,
      isComplianceWeeklyServerMode,
      isHumanResourceServerMode,
      isPlanningOpexServerMode,
      isProcurementListServerMode,
    ],
  );

  const effectiveResultCount = isServerQueryEnabled
    ? serverTotalCount
    : sortedData.length;
  const isClientPaginationEnabled =
    enableClientPagination && !isServerQueryEnabled;
  const clientTotalPages = useMemo(() => {
    if (!isClientPaginationEnabled) return 1;
    return Math.max(1, Math.ceil(sortedData.length / serverPageSize));
  }, [isClientPaginationEnabled, serverPageSize, sortedData.length]);
  const paginatedSortedData = useMemo(() => {
    if (!isClientPaginationEnabled) {
      return sortedData;
    }

    const startIndex = Math.max(0, (serverPage - 1) * serverPageSize);
    return sortedData.slice(startIndex, startIndex + serverPageSize);
  }, [isClientPaginationEnabled, serverPage, serverPageSize, sortedData]);
  const renderedRows = isClientPaginationEnabled ? paginatedSortedData : sortedData;

  const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  const applyPriorityTopNullOrder = useCallback((rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return rows;
    }

    if (!priorityTopNullColumn) {
      return rows;
    }

    const activeSortColumn = String(sortConfig?.column ?? "");
    const activeSortDirection = String(sortConfig?.direction ?? "asc").toLowerCase();
    if (!activeSortColumn || activeSortDirection !== "asc") {
      return rows;
    }

    if (activeSortColumn !== priorityTopNullColumn) {
      return rows;
    }

    const topRows = [];
    const normalRows = [];
    rows.forEach((row) => {
      const value = row?.[priorityTopNullColumn];
      const isEmptyDate = value === null || value === undefined || String(value).trim() === "";
      if (isEmptyDate) {
        topRows.push(row);
      } else {
        normalRows.push(row);
      }
    });

    return [...topRows, ...normalRows];
  }, [priorityTopNullColumn, sortConfig?.column, sortConfig?.direction]);

  const applyPriorityBottomOrder = useCallback((rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return rows;
    }

    if (!Array.isArray(priorityBottomIds) || priorityBottomIds.length === 0) {
      return rows;
    }

    const bottomIdSet = new Set(
      priorityBottomIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    );
    if (bottomIdSet.size === 0) {
      return rows;
    }

    const normalRows = [];
    const bottomRows = [];

    rows.forEach((row) => {
      const rowId = Number(row?.Id);
      if (Number.isFinite(rowId) && bottomIdSet.has(rowId)) {
        bottomRows.push(row);
      } else {
        normalRows.push(row);
      }
    });

    return [...normalRows, ...bottomRows];
  }, [priorityBottomIds]);

  const handleHighlightFromFilter = ({ filters, mode }) => {
    if (!filters?.length) return;

    // 🧹 ENSURE SINGLE HIGHLIGHT
    document
      .querySelectorAll(".highlighted-row")
      .forEach((el) => el.classList.remove("highlighted-row"));

    const matched = sortedData.filter((row) =>
      filters[mode === "and" ? "every" : "some"]((f) => {
        const key = resolveColumnKey(row, f.column);
        if (!key) return false;
        return compare(row[key], f.operator, f.value);
      }),
    );

    if (!matched.length) {
      toast.info("No rows matched");
      return;
    }

    // 🎯 highlight ONLY ONE row
    setHighlightRowId(String(matched[0].Id));
    toast.success("Highlighted first match");
  };
  useLayoutEffect(() => {
    // 🚫 DO NOT auto-sort when row ordering is enabled
    if (rowOrderEnabled) return;

    if (isServerQueryEnabled) {
      setSortedData(
        applyPriorityBottomOrder(applyPriorityTopNullOrder(filteredData)),
      );
      return;
    }

    if (!sortConfig.column) {
      setSortedData(
        applyPriorityBottomOrder(applyPriorityTopNullOrder(filteredData)),
      );
      return;
    }

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];

      // 1️⃣ Date comparison
      const aDate = parseDate(aVal);
      const bDate = parseDate(bVal);
      if (aDate !== null && bDate !== null) {
        return sortConfig.direction === "asc" ? aDate - bDate : bDate - aDate;
      }

      // 2️⃣ Number comparison
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // 3️⃣ String fallback
      return sortConfig.direction === "asc"
        ? String(aVal ?? "").localeCompare(String(bVal ?? ""))
        : String(bVal ?? "").localeCompare(String(aVal ?? ""));
    });

    setSortedData(applyPriorityBottomOrder(applyPriorityTopNullOrder(sorted)));
  }, [
    applyPriorityTopNullOrder,
    applyPriorityBottomOrder,
    rowOrderEnabled,
    filteredData,
    isServerQueryEnabled,
    sortConfig,
  ]);

  useEffect(() => {
    if (!isClientPaginationEnabled) return;
    setServerPage(1);
  }, [
    apiUrl,
    isClientPaginationEnabled,
    debouncedSearch,
    debouncedFilters,
    refreshTrigger,
    reloadKey,
    searchScope,
  ]);

  useEffect(() => {
    if (!isClientPaginationEnabled) return;
    setServerPage((prev) => Math.min(prev, clientTotalPages));
  }, [clientTotalPages, isClientPaginationEnabled]);

  useEffect(() => {
    if (!rowOrderEnabled) return;

    // 🔥 INITIALIZE row order from current filtered data
    setSortedData(filteredData);
  }, [rowOrderEnabled, filteredData]);

  // ---------------- Cell Merging ----------------
  const {
    getCellKey,
    unmergedCells,
    selectedCells,
    setSelectedCells,
    lastSelectedCell,
    setLastSelectedCell,
    rowSpanMap,
  } = useCellMerging(finalTableData, derivedColumns, tableRef);

  const collapsibleRows = useMemo(() => {
    if (!collapsible) return EMPTY_ARRAY;

    const hasActiveSearchOrFilter =
      Boolean(debouncedSearch) || (debouncedFilters?.filters?.length ?? 0) > 0;
    const baseRows = hasActiveSearchOrFilter
      ? sortedData
      : Array.isArray(tableData) && tableData.length > 0
        ? tableData
        : flatData;

    if (typeof buildCollapsibleRows === "function") {
      const transformed = buildCollapsibleRows(baseRows);
      return Array.isArray(transformed) ? transformed : EMPTY_ARRAY;
    }

    return Array.isArray(baseRows) ? baseRows : EMPTY_ARRAY;
  }, [
    buildCollapsibleRows,
    collapsible,
    debouncedFilters?.filters?.length,
    debouncedSearch,
    flatData,
    sortedData,
    tableData,
  ]);

  const hasTableRows = useMemo(() => {
    if (collapsible) {
      return collapsibleRows.length > 0;
    }

    return renderedRows.length > 0;
  }, [
    collapsibleRows,
    collapsible,
    renderedRows,
  ]);
  const isPlanningOpexEndpoint =
    normalizeColumnToken(endpointName) === "opex" ||
    normalizeColumnToken(endpointName) === "opextemplate";
  const useCollapsibleGridRenderer =
    collapsible && useGridRenderer && isPlanningOpexEndpoint;
  const handleToggleAllCollapsibleRows = useCallback(() => {
    if (!useCollapsibleGridRenderer || typeof setCollapseState !== "function") {
      return;
    }
    const rows = Array.isArray(collapsibleRows) ? collapsibleRows : [];
    const expandableRows = rows.filter((row) => Boolean(row?.hasChildren));
    if (expandableRows.length === 0) {
      return;
    }
    const allCollapsed = expandableRows.every((row) =>
      Boolean(collapseState?.[row.__key]),
    );
    const shouldCollapse = !allCollapsed;
    setCollapseState((prev) => {
      const next = { ...(prev && typeof prev === "object" ? prev : {}) };
      expandableRows.forEach((row) => {
        if (row?.__key) {
          next[row.__key] = shouldCollapse;
        }
      });
      return next;
    });
  }, [
    collapseState,
    collapsibleRows,
    setCollapseState,
    useCollapsibleGridRenderer,
  ]);

  const paginatedResultRange = useMemo(() => {
    if (isServerQueryEnabled) {
      if (serverTotalCount <= 0) {
        return { from: 0, to: 0 };
      }

      const from = (serverPage - 1) * serverPageSize + 1;
      const to = Math.min(serverTotalCount, from + sortedData.length - 1);
      return { from, to };
    }

    if (!isClientPaginationEnabled || sortedData.length <= 0) {
      return { from: 0, to: 0 };
    }

    const from = (serverPage - 1) * serverPageSize + 1;
    const to = Math.min(sortedData.length, from + renderedRows.length - 1);
    return { from, to };
  }, [
    isClientPaginationEnabled,
    isServerQueryEnabled,
    serverPage,
    serverPageSize,
    serverTotalCount,
    renderedRows.length,
    sortedData.length,
  ]);

  const renderPaginationFooter = () => {
    if (!isServerQueryEnabled && !isClientPaginationEnabled) return null;
    if (loading && tableData.length === 0) return null;

    const totalCount = isServerQueryEnabled
      ? serverTotalCount
      : sortedData.length;
    const totalPages = isServerQueryEnabled
      ? serverTotalPages
      : clientTotalPages;
    const hasPreviousPage = isServerQueryEnabled
      ? serverHasPreviousPage
      : serverPage > 1;
    const hasNextPage = isServerQueryEnabled
      ? serverHasNextPage
      : serverPage < clientTotalPages;

    return (
      <div className="table-pagination-footer d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top">
        <div className="table-pagination-footer__summary small text-muted">
          Menampilkan {paginatedResultRange.from}-{paginatedResultRange.to} dari{" "}
          {totalCount} data
        </div>

        <div className="table-pagination-footer__controls d-flex flex-wrap align-items-center gap-2">
          <span className="table-pagination-footer__label small text-muted">Baris</span>
          <select
            className="table-pagination-footer__select form-select form-select-sm"
            style={{ width: "auto" }}
            value={serverPageSize}
            disabled={loading}
            onChange={(event) => {
              const nextSize =
                Number(event.target.value) || activeServerDefaultPageSize;
              setServerPageSize(nextSize);
              setServerPage(1);
            }}
          >
            {activeServerPageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="table-pagination-footer__button btn btn-outline-secondary btn-sm"
            disabled={loading || !hasPreviousPage}
            onClick={() => setServerPage((prev) => Math.max(1, prev - 1))}
          >
            Sebelumnya
          </button>

          <span className="table-pagination-footer__page small text-muted">
            Halaman {serverPage} / {totalPages}
          </span>

          <button
            type="button"
            className="table-pagination-footer__button btn btn-outline-secondary btn-sm"
            disabled={loading || !hasNextPage}
            onClick={() =>
              setServerPage((prev) => Math.min(totalPages, prev + 1))
            }
          >
            Berikutnya
          </button>
        </div>
      </div>
    );
  };

  const renderHeaderSupplementalActions = (hideFullscreenButton = false) => (
    <>
      {showLogTrail ? (
        <ChangeLogModal
          tableName={changeLogTableName || endpointName}
          titleLabel={changeLogTitleLabel || title || endpointName}
          triggerLabel={changeLogTriggerLabel}
          scopeTableName={changeLogScopeTableName}
          scopeEntityId={changeLogScopeEntityId}
          onNavigateToChange={allowChangeLogNavigation ? handleNavigateToChange : null}
          allowNavigateToChange={allowChangeLogNavigation}
          triggerMode="header"
        />
      ) : null}

      <ZoomControl
        zoom={zoomLevel}
        setZoom={setZoomLevel}
        expanded={expanded}
        setExpanded={setExpanded}
        fullscreen={fullscreen}
        setFullscreen={setFullscreen}
        onRefresh={() => {
          setHighlightRowId(null);
          setPendingServerFocusId(null);
          setRefreshTrigger((prev) => prev + 1);
        }}
        refreshDisabled={loading}
        hideButtons={
          hideFullscreenButton
            ? modalZoomControlHiddenButtons
            : zoomControlHiddenButtons
        }
      />
    </>
  );

  const showTableRefreshOverlay = loading && !error && tableData.length === 0;

  // ---------------- Modal ----------------
  // if (loading) {
  //   return <div className="p-4">Loading table...</div>;
  // }

  if (error) {
    const isRestrictedError = /don't have access|access|403/i.test(
      String(error),
    );

    return (
      <Container fluid className="datatables">
        <Card className="card">
          <CardBody className="p-4">
            <FeedbackState
              variant={isRestrictedError ? "restricted" : "error"}
              title={isRestrictedError ? "Access restricted" : "Failed to load table"}
              description={error}
            />
          </CardBody>
        </Card>
      </Container>
    );
  }

  // ---------------- Render ----------------

  return (
    <Fragment>
      <Container fluid className="datatables">
        <Card
          className={`card ${shouldUseStableAuditLayout ? "table-card--stable" : ""}${
            isSpreadsheetLayout ? " table-card--spreadsheet" : ""
          }`}
          style={{
            display: "flex",
            flexDirection: "column",
            ...(shouldUseStableAuditLayout
              ? {
                  height: tableCardHeight,
                  maxHeight: tableCardMaxHeight,
                  minHeight: tableCardHeight,
                }
              : isSpreadsheetLayout
              ? {
                  height: tableCardHeight,
                  maxHeight: tableCardMaxHeight,
                  minHeight: tableCardHeight,
                }
              : isListAuditTarget(endpointName)
              ? {
                  height: expanded ? "88vh" : "clamp(560px, 74vh, 780px)",
                  maxHeight: expanded ? "88vh" : "clamp(560px, 74vh, 780px)",
                  minHeight: expanded ? "88vh" : "clamp(560px, 74vh, 780px)",
                }
              : {
                  height: tableCardHeight,
                  maxHeight: expanded ? "85vh" : "66vh",
                  minHeight: tableCardHeight,
                }),
          }}
        >
          <CardHeader
            className={`table-header py-2 ${shouldUseStableAuditLayout ? "table-header--stable" : ""}`}
          >
            <div className="table-header__inner">
              <div className="table-header__toolbar table-header__toolbar--full">
                <TableToolbar
                  derivedColumns={useCollapsibleGridRenderer ? columns : derivedColumns}
                  endpointName={endpointName}
                  searchTerm={searchTerm}
                  appliedSearchTerm={debouncedSearch}
                  setSearchTerm={setSearchTerm}
                  searchScope={searchScope}
                  setSearchScope={setSearchScope}
                  searchScopeOptions={searchScopeOptions}
                  isReadOnly={isReadOnly}
                  canManageTable={canManageTable}
                  editMode={editMode}
                  setEditMode={setEditMode}
                  apiUrl={apiUrl}
                  patchUrlBase={patchUrlBase}
                  tableData={tableData}
                  setTableData={setTableData}
                  title={endpointName}
                  headerMap={headerMap}
                  setRefreshTrigger={setRefreshTrigger}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds} // ← ADD
                  tableRef={tableRef}
                  columns={allFilterableColumns}
                  filterColumns={toolbarFilterColumns}
                  sortColumns={toolbarSortColumns}
                  allowDistinct={allowDistinct}
                  allowColumnMutations={allowColumnMutations}
                  serverQueryEnabled={isServerQueryEnabled}
                  hasHighlight={hasHighlight} // 👈 ADD
                  hasDistinct={hasDistinct} // 👈 ADD THIS
                  rows={baseNormalizedData}
                  filters={filters} // <---- ADD THIS
                  YearImportValue={YearImportValue}
                  hideImport={hideImport} // 👈 ADD THIS
                  hideExport={hideExport}
                  transferActions={transferActions}
                  onApply={applyTableFilter}
                  sortedData={useCollapsibleGridRenderer ? collapsibleRows : sortedData}
                  onImported={() => {
                    setRefreshTrigger((p) => p + 1);
                    onMutationSuccess?.();
                  }}
                  setSortedData={setSortedData}
                  mandatoryValueOf={mandatoryValueOf}
                  mandatorySuggestionValues={mandatorySuggestionValues}
                  addColumnUrl={addColumnUrl}
                  resultCount={effectiveResultCount}
                  activeFilterCount={filters?.filters?.length || 0}
                  showRowCount={showRowCount}
                  resetToDefaultView={resetToInitialView}
                  clearToDefaultView={clearToDefaultView}
                  onRowCreated={handleRowCreated}
                  onColumnCreated={handleColumnCreated}
                  supplementalActions={renderHeaderSupplementalActions(false)}
                  forceReloadAfterMutation={forceReloadAfterMutation}
                  onMutationSuccess={onMutationSuccess}
                />
              </div>
            </div>
          </CardHeader>

          <div
            className={`${tableWrapperSpacingClass} sticky-table-wrapper${
              shouldDisableZoomForSticky && !usesListAuditGridRenderer
                ? " list-audit-split-wrapper"
              : ""
            }${
              isSpreadsheetLayout ? " table-content--spreadsheet" : ""
            } table-content-shell${
              showTableRefreshOverlay ? " table-content-shell--refreshing" : ""
            }${tableReveal ? " table-content-shell--revealing" : ""}`}
            ref={wrapperRef}
            style={{
              flex: 1,
              overflow: shouldDisableZoomForSticky ? "hidden" : "auto",
              minHeight: 0,
            }}
          >
            {showTableRefreshOverlay && (
              <div className="table-refresh-overlay" aria-live="polite">
                <div className="table-refresh-overlay__loader-shell">
                  <div className="theme-loader table-refresh-overlay__theme-loader">
                    <div className="loader-p"></div>
                  </div>
                </div>
              </div>
            )}
            {hasTableRows ? (
            <>
            <div
              ref={tableRef}
              className={
                shouldDisableZoomForSticky ? "list-audit-render-host" : undefined
              }
              style={
                shouldDisableZoomForSticky
                  ? stickyRenderHostStyle
                  : tableZoomStyle
              }
            >
              <React.Suspense
                fallback={
                  <div className="p-3 text-center text-muted">Loading table view...</div>
                }
              >
              {collapsible && !useCollapsibleGridRenderer ? (
                <RenderTableCollapse
                  flatData={collapsibleRows}
                  columns={columns}
                  columnLabelMap={columnMap} // DISPLAY ONLY
                  tableVariant={isSpreadsheetLayout ? "sheet" : null}
                  enableColumnDrag={Boolean(enableColumnDrag)}
                  fixedDateColumns={fixedDateColumns}
                  collapseState={collapseState}
                  toggle={toggle}
                  patchUrlBase={patchUrlBase}
                  safeEditHandler={safeEditHandler}
                  endpointName={endpointName}
                  treeData={treeData}
                  setCollapseState={setCollapseState} // 👈 ADD
                  normalizedint={normalizedint}
                  enableMillionFormat={enableMillionFormat}
                  canEditCell={canEditCells}
                  nonEditableColumns={nonEditableColumns}
                  cellEditablePredicate={cellEditablePredicate}
                  suggestionValuesByColumn={suggestionValuesByColumn}
                />
              ) : (
                <RenderTableBody
                  canEditCell={canEditCells}
                  highlightRowId={highlightRowId} // 👈 add this
                  editMode={editMode}
                  derivedColumns={derivedColumns}
                  headerMap={headerMap}
                  sortedData={sortedData}
                  setSortedData={setSortedData}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  safeEditHandler={safeEditHandler}
                  actionKeys={actionKeys}
                  onStatusClick={onStatusClick}
                  uploadColumns={uploadColumns}
                  fixedDateColumns={fixedDateColumns}
                  nonEditableColumns={nonEditableColumns}
                  cellEditablePredicate={cellEditablePredicate}
                  toggleColumns={toggleColumns}
                  toggleMode={toggleMode} // 👈 NEW
                  useTextarea={useTextarea}
                  getCellKey={getCellKey}
                  onParentFilter={applyTableFilter} // <-- HERE
                  rowSpanMap={rowSpanMap}
                  unmergedCells={unmergedCells}
                  selectedCells={selectedCells}
                  setSelectedCells={setSelectedCells}
                  lastSelectedCell={lastSelectedCell}
                  setLastSelectedCell={setLastSelectedCell}
                  tbodyRef={tbodyRef}
                  tableRef={tableRef}
                  endpointName={endpointName}
                  columnStyles={columnStyles}
                  highlightCondition={highlightCondition}
                  enableColumnDrag={enableColumnDrag}
                  normalizedint={normalizedint}
                  enableRowOrder={rowOrderEnabled}
                  enableMillionFormat={enableMillionFormat}
                  source={source}

                  distinctConfig={filters?.distinct || null}
                  searchQuery={debouncedSearch}
                  searchScope={searchScope}
                  listAuditHorizontalControl={listAuditHorizontalControl}
                  onListAuditHorizontalControlChange={handleListAuditHorizontalControlChange}
                  listAuditVerticalControl={listAuditVerticalControl}
                  onListAuditVerticalControlChange={handleListAuditVerticalControlChange}
                  onNavigateToChange={handleNavigateToChange}
                  useGridRenderer={useCollapsibleGridRenderer ? true : useGridRenderer}
                  persistColumnOrder={persistColumnOrder}
                  suggestionValuesByColumn={suggestionValuesByColumn}
                  treeMode={useCollapsibleGridRenderer}
                  onTreeToggle={useCollapsibleGridRenderer ? toggle : null}
                  treeRows={useCollapsibleGridRenderer ? collapsibleRows : EMPTY_ARRAY}
                  treeCollapseState={useCollapsibleGridRenderer ? collapseState : null}
                  onTreeToggleAll={
                    useCollapsibleGridRenderer ? handleToggleAllCollapsibleRows : null
                  }
                />
              )}
              </React.Suspense>
            </div>
            {shouldDisableZoomForSticky && !usesListAuditGridRenderer && hasTableRows && (
              <>
                <div className="list-audit-host-horizontal-scrollbar" aria-label="Horizontal table scroll">
                  <input
                    type="range"
                    min={0}
                    max={listAuditHorizontalControl.max}
                    step={1}
                    value={Math.min(
                      listAuditHorizontalControl.value,
                      listAuditHorizontalControl.max,
                    )}
                    disabled={listAuditHorizontalControl.max <= 0}
                    className="list-audit-host-scroll-range list-audit-host-scroll-range--horizontal"
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setListAuditHorizontalControl((prev) => ({
                        ...prev,
                        value: nextValue,
                      }));
                    }}
                  />
                </div>
                <div className="list-audit-host-vertical-scrollbar" aria-label="Vertical table scroll">
                  <input
                    type="range"
                    min={0}
                    max={listAuditVerticalControl.max}
                    step={1}
                    value={Math.min(
                      listAuditVerticalControl.value,
                      listAuditVerticalControl.max,
                    )}
                    disabled={listAuditVerticalControl.max <= 0}
                    className="list-audit-host-scroll-range list-audit-host-scroll-range--vertical"
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setListAuditVerticalControl((prev) => ({
                        ...prev,
                        value: nextValue,
                      }));
                    }}
                  />
                </div>
              </>
            )}
            </>
            ) : (
              <div className="py-3">
                <FeedbackState
                  variant="empty"
                  title="No rows to display"
                  description={
                    debouncedSearch || debouncedFilters?.filters?.length
                      ? "Tidak ada data yang cocok dengan search atau filter yang sedang dipakai."
                      : "Belum ada data untuk ditampilkan pada tabel ini."
                  }
                  compact
                />
              </div>
            )}
          </div>
          {renderPaginationFooter()}
        </Card>

        {/* FULLSCREEN MODAL */}
        <Modal
          isOpen={fullscreen}
          toggle={() => setFullscreen(false)}
          size="xl"
          fullscreen={false} // force XL, not native fullscreen
          className="p-0 table-fullscreen-modal"
          zIndex={1300}
        >
          <ModalHeader toggle={() => setFullscreen(false)}>
            <div className="table-header table-header--modal w-100">
              {/* LEFT — TITLE */}
              <div className="table-header__title">
                <H5 className="mb-0">
                  {title || endpointName}
                </H5>
              </div>

              {/* RIGHT — TOOLBAR */}
              <div className="table-header__inner">
                <div className="table-header__toolbar table-header__toolbar--modal">
                    <TableToolbar
                  derivedColumns={useCollapsibleGridRenderer ? columns : derivedColumns}
                  endpointName={endpointName}
                  searchTerm={searchTerm}
                  appliedSearchTerm={debouncedSearch}
                  setSearchTerm={setSearchTerm}
                  searchScope={searchScope}
                  setSearchScope={setSearchScope}
                  searchScopeOptions={searchScopeOptions}
                  isReadOnly={isReadOnly}
                  canManageTable={canManageTable}
                  editMode={editMode}
                  setEditMode={setEditMode}
                  apiUrl={apiUrl}
                  patchUrlBase={patchUrlBase}
                  tableData={tableData}
                  setTableData={setTableData}
                  title={endpointName}
                  headerMap={headerMap}
                  setRefreshTrigger={setRefreshTrigger}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  tableRef={tableRef}
                  columns={allFilterableColumns}
                  filterColumns={toolbarFilterColumns}
                  sortColumns={toolbarSortColumns}
                  allowDistinct={allowDistinct}
                  allowColumnMutations={allowColumnMutations}
                  serverQueryEnabled={isServerQueryEnabled}
                  rows={baseNormalizedData}
                  filters={filters}
                  YearImportValue={YearImportValue}
                  hideImport={hideImport}
                  hideExport={hideExport}
                  transferActions={transferActions}
                  onApply={applyTableFilter}
                  hasHighlight={hasHighlight} // 👈 ADD
                  sortedData={useCollapsibleGridRenderer ? collapsibleRows : sortedData}
                  setSortedData={setSortedData}
                  mandatoryValueOf={mandatoryValueOf}
                  mandatorySuggestionValues={mandatorySuggestionValues}
                  addColumnUrl={addColumnUrl}
                  resultCount={effectiveResultCount}
                  activeFilterCount={filters?.filters?.length || 0}
                  showRowCount={showRowCount}
                  resetToDefaultView={resetToInitialView}
                  clearToDefaultView={clearToDefaultView}
                  onRowCreated={handleRowCreated}
                  onColumnCreated={handleColumnCreated}
                  supplementalActions={renderHeaderSupplementalActions(true)}
                  forceReloadAfterMutation={forceReloadAfterMutation}
                  onMutationSuccess={onMutationSuccess}
                />
                </div>
              </div>
            </div>
          </ModalHeader>

          <ModalBody
            style={{
              padding: 0,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              className={`${tableWrapperSpacingClass} sticky-table-wrapper table-fullscreen-body${
                shouldDisableZoomForSticky && !usesListAuditGridRenderer
                  ? " list-audit-split-wrapper"
                  : ""
              }${
                isSpreadsheetLayout ? " table-content--spreadsheet" : ""
              } table-content-shell${
                showTableRefreshOverlay ? " table-content-shell--refreshing" : ""
              }${tableReveal ? " table-content-shell--revealing" : ""}`}
              style={{
                flex: "1 1 auto",
                height: "100%",
                overflow: shouldDisableZoomForSticky ? "hidden" : "auto",
                background: "var(--table-surface, #ffffff)",
                padding: 0,
                minHeight: 0,
              }}
            >
              {showTableRefreshOverlay && (
                <div className="table-refresh-overlay" aria-live="polite">
                  <div className="table-refresh-overlay__loader-shell">
                    <div className="theme-loader table-refresh-overlay__theme-loader">
                      <div className="loader-p"></div>
                    </div>
                  </div>
                </div>
              )}
              {/* RENDER THE SAME TABLE HERE */}
              <div
                className={
                  shouldDisableZoomForSticky ? "list-audit-render-host" : undefined
                }
                style={
                  shouldDisableZoomForSticky
                    ? stickyRenderHostStyle
                    : tableZoomStyle
                }
              >
                <React.Suspense
                  fallback={
                    <div className="p-3 text-center text-muted">Loading table view...</div>
                  }
                >
                {collapsible && !useCollapsibleGridRenderer ? (
                  <RenderTableCollapse
                    flatData={collapsibleRows}
                    columns={columns}
                    columnLabelMap={columnMap}
                    tableVariant={isSpreadsheetLayout ? "sheet" : null}
                    enableColumnDrag={Boolean(enableColumnDrag)}
                    fixedDateColumns={fixedDateColumns}
                    collapseState={collapseState}
                    toggle={toggle}
                    patchUrlBase={patchUrlBase}
                    safeEditHandler={safeEditHandler}
                    endpointName={endpointName}
                    setCollapseState={setCollapseState}
                    enableMillionFormat={enableMillionFormat}
                    canEditCell={canEditCells}
                    nonEditableColumns={nonEditableColumns}
                    cellEditablePredicate={cellEditablePredicate}
                    suggestionValuesByColumn={suggestionValuesByColumn}
                  />
                ) : (
                   <RenderTableBody
                  canEditCell={canEditCells}
                  highlightRowId={highlightRowId} // 👈 add this
                  editMode={editMode}
                  derivedColumns={derivedColumns}
                  headerMap={headerMap}
                  sortedData={sortedData}
                  setSortedData={setSortedData}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  safeEditHandler={safeEditHandler}
                  actionKeys={actionKeys}
                  onStatusClick={onStatusClick}
                  uploadColumns={uploadColumns}
                  fixedDateColumns={fixedDateColumns}
                  nonEditableColumns={nonEditableColumns}
                  cellEditablePredicate={cellEditablePredicate}
                  toggleColumns={toggleColumns}
                  toggleMode={toggleMode} // 👈 NEW
                  useTextarea={useTextarea}
                  getCellKey={getCellKey}
                  onParentFilter={applyTableFilter} // <-- HERE
                  rowSpanMap={rowSpanMap}
                  unmergedCells={unmergedCells}
                  selectedCells={selectedCells}
                  setSelectedCells={setSelectedCells}
                  lastSelectedCell={lastSelectedCell}
                  setLastSelectedCell={setLastSelectedCell}
                  tbodyRef={tbodyRef}
                  tableRef={tableRef}
                  endpointName={endpointName}
                  columnStyles={columnStyles}
                  highlightCondition={highlightCondition}
                  enableColumnDrag={enableColumnDrag}
                  normalizedint={normalizedint}
                  enableRowOrder={rowOrderEnabled}
                  enableMillionFormat={enableMillionFormat}
                  source={source}

                  distinctConfig={filters?.distinct || null}
                  searchQuery={debouncedSearch}
                  searchScope={searchScope}
                  listAuditHorizontalControl={listAuditHorizontalControl}
                  onListAuditHorizontalControlChange={handleListAuditHorizontalControlChange}
                  listAuditVerticalControl={listAuditVerticalControl}
                  onListAuditVerticalControlChange={handleListAuditVerticalControlChange}
                  onNavigateToChange={handleNavigateToChange}
                  useGridRenderer={useCollapsibleGridRenderer ? true : useGridRenderer}
                  persistColumnOrder={persistColumnOrder}
                  suggestionValuesByColumn={suggestionValuesByColumn}
                  treeMode={useCollapsibleGridRenderer}
                  onTreeToggle={useCollapsibleGridRenderer ? toggle : null}
                  treeRows={useCollapsibleGridRenderer ? collapsibleRows : EMPTY_ARRAY}
                  treeCollapseState={useCollapsibleGridRenderer ? collapseState : null}
                  onTreeToggleAll={
                    useCollapsibleGridRenderer ? handleToggleAllCollapsibleRows : null
                  }
                />
                )}
                </React.Suspense>
              </div>
              {shouldDisableZoomForSticky &&
                !usesListAuditGridRenderer &&
                hasTableRows &&
                !fullscreen && (
                <>
                  <div className="list-audit-host-horizontal-scrollbar" aria-label="Horizontal table scroll">
                    <input
                      type="range"
                      min={0}
                      max={listAuditHorizontalControl.max}
                      step={1}
                      value={Math.min(
                        listAuditHorizontalControl.value,
                        listAuditHorizontalControl.max,
                      )}
                      disabled={listAuditHorizontalControl.max <= 0}
                      className="list-audit-host-scroll-range list-audit-host-scroll-range--horizontal"
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setListAuditHorizontalControl((prev) => ({
                          ...prev,
                          value: nextValue,
                        }));
                      }}
                    />
                  </div>
                  <div className="list-audit-host-vertical-scrollbar" aria-label="Vertical table scroll">
                    <input
                      type="range"
                      min={0}
                      max={listAuditVerticalControl.max}
                      step={1}
                      value={Math.min(
                        listAuditVerticalControl.value,
                        listAuditVerticalControl.max,
                      )}
                      disabled={listAuditVerticalControl.max <= 0}
                      className="list-audit-host-scroll-range list-audit-host-scroll-range--vertical"
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setListAuditVerticalControl((prev) => ({
                          ...prev,
                          value: nextValue,
                        }));
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            {renderPaginationFooter()}
          </ModalBody>
        </Modal>
      </Container>
    </Fragment>
  );
};

export default TableComponent;
