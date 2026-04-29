/*
 * PGH-DOC
 * File: src/Variables/Table/TableToolBarElement/Import.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Label,
  FormGroup,
  Spinner,
  Alert,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "@pgh/ui-bootstrap";
import { UploadCloud, Plus, RefreshCcw } from "react-feather";
import { useAuth } from "../../../Auth/AuthContext";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  normalizeEndpointTarget,
  resolveTableTransferProfile,
} from "../tableTargetProfiles";

ModuleRegistry.registerModules([AllCommunityModule]);

const LIST_AUDIT_PROMOTE_TARGET = "ListAudit";
const LIST_AUDIT_DISPLAY_NAME = "Audit List";
const WEEKLY_TABLE_PROMOTE_TARGET = "WeeklyTable";
const WEEKLY_TABLE_DISPLAY_NAME = "Weekly Table";
const HUMAN_IMPORT_DISPLAY_NAMES = {
  fte: "FTE Resource",
  nonfte: "Non-FTE Resource",
  kebutuhanfte: "FTE Requirement",
  bnu: "Training Plan",
  internaltraining: "Training Class",
  kompetensipegawai: "Employee Competency",
};
const HUMAN_IMPORT_COMPARE_COLUMNS_BY_TARGET = {
  fte: [
    "NPP",
    "Nama",
    "JenjangJabatan",
    "Posisi",
    "Department",
  ],
  nonfte: [
    "NPP",
    "Nama",
    "JenisKelamin",
    "TanggalLahir",
    "TanggalJoinBNI",
    "ManmonthManagedService",
    "Department",
    "Role",
  ],
  kebutuhanfte: [
    "DIREKTORAT",
    "KODEJOB",
    "JOB",
    "Department",
    "Existing",
    "Kebutuhan",
    "Gap",
  ],
  bnu: [
    "UsulanTraining",
    "BulanTahun",
    "JumlahPerserta",
    "SentralDesentral",
    "DivisiDepartment",
    "Biaya",
  ],
  internaltraining: [
    "UsulanTraining",
    "Start",
    "End",
    "JumlahPerserta",
    "DivisiDepartment",
    "Fasilitator",
    "Biaya",
  ],
  kompetensipegawai: [
    "NPP",
    "Nama",
    "Department",
    "JudulTraining",
    "TahunPelaksanaan",
    "SertifikasiNonSerifikasi",
  ],
};

const LIST_AUDIT_IGNORED_HEADER_ALIASES = new Set([
  "__unused__",
  "no",
  "nomor",
]);

const LIST_AUDIT_FORBIDDEN_HEADER_ALIASES = new Set([
  "id",
  "createdat",
  "updatedat",
  "extradata",
]);
const LIST_AUDIT_DISALLOWED_IMPORT_COLUMNS = new Set([
  "NO",
  "CreatedAt",
  "UpdatedAt",
  "ExtraData",
  "Id",
]);
const PROCUREMENT_FORBIDDEN_HEADER_ALIASES = new Set([
  "id",
  "action",
  "no",
  "nomor",
  "projectid",
  "statuspengadaan",
  "sisabulan",
  "source",
  "sourcetype",
  "createdat",
  "updatedat",
  "extradata",
]);
const HUMAN_RESOURCE_FORBIDDEN_HEADER_ALIASES = new Set([
  "id",
  "action",
  "createdat",
  "updatedat",
  "extradata",
]);
const HUMAN_RESOURCE_DEFAULT_UPSERT_KEY_BY_TARGET = {
  fte: "NPP",
  nonfte: "NPP",
  kebutuhanfte: "KODEJOB",
  bnu: "UsulanTraining",
  internaltraining: "UsulanTraining",
  kompetensipegawai: "NPP",
};

const SUPPORTED_IMPORT_EXTENSIONS = new Set(["xlsx"]);
const LIST_AUDIT_EVIDENCE_COLUMNS = new Set(["RHA", "LHA"]);
const LIST_AUDIT_EVIDENCE_ALLOWED_EXTENSIONS = new Set(["xlsx"]);
const LIST_AUDIT_COMPARE_COLUMNS = [
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
const LIST_AUDIT_COMPARE_COLUMN_KEYS = new Set(
  LIST_AUDIT_COMPARE_COLUMNS.map((column) => column.toLowerCase()),
);

const normalizeImportHeaderToken = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "")
    .replace(/[^a-z0-9]/g, "");

const resolveDefaultUpsertKey = (normalizedTarget) =>
  HUMAN_RESOURCE_DEFAULT_UPSERT_KEY_BY_TARGET[normalizedTarget] || "";

const LIST_AUDIT_HEADER_ALIASES = {
  tahun: "TAHUN",
  namaaudit: "NAMAAUDIT",
  ringkasanaudit: "RINGKASANAUDIT",
  pemantauan: "PEMANTAUAN",
  jenisaudit: "JENISAUDIT",
  source: "SOURCE",
  sumberaudit: "SOURCE",
  picaudit: "PICAUDIT",
  department: "DEPARTMENT",
  departement: "DEPARTMENT",
  departemen: "DEPARTMENT",
  picaplikasi: "PICAPLIKASI",
  in: "IN",
  tanggalmulai: "IN",
  jatuhtempo: "JATUHTEMPO",
  link: "LINK",
  status: "STATUS",
  statusaudit: "STATUS",
  keterangan: "KETERANGAN",
  rha: "RHA",
  lha: "LHA",
};

const classifyListAuditHeader = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return { mapped: "", state: "empty" };

  const token = normalizeImportHeaderToken(raw);
  if (LIST_AUDIT_FORBIDDEN_HEADER_ALIASES.has(token)) {
    return { mapped: null, state: "forbidden" };
  }

  if (LIST_AUDIT_HEADER_ALIASES[token]) {
    return { mapped: LIST_AUDIT_HEADER_ALIASES[token], state: "mapped" };
  }

  if (LIST_AUDIT_IGNORED_HEADER_ALIASES.has(token)) {
    return { mapped: "", state: "ignored" };
  }

  return { mapped: null, state: "unknown" };
};

const parsePreviewRows = (payload) =>
  (Array.isArray(payload) ? payload : [])
    .map((item) => {
      if (Array.isArray(item)) return item;

      if (typeof item?.Data === "string") {
        try {
          return JSON.parse(item.Data);
        } catch {
          return null;
        }
      }

      if (typeof item === "string") {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      }

      if (Array.isArray(item?.data)) return item.data;

      return null;
    })
    .filter(Array.isArray);

const normalizePromoteSummary = (summary) => {
  if (!summary || typeof summary !== "object") return null;

  return {
    totalRows: Number(summary.totalRows ?? summary.TotalRows ?? 0),
    processed: Number(summary.processed ?? summary.Processed ?? 0),
    inserted: Number(summary.inserted ?? summary.Inserted ?? 0),
    updated: Number(summary.updated ?? summary.Updated ?? 0),
    skipped: Number(summary.skipped ?? summary.Skipped ?? 0),
    duplicate: Number(summary.duplicate ?? summary.Duplicate ?? 0),
  };
};

const normalizePreviewRowStates = (rowStates) =>
  (Array.isArray(rowStates) ? rowStates : [])
    .map((item) => ({
      index: Number(item?.index ?? item?.Index ?? -1),
      rowNumber:
        item?.rowNumber ??
        item?.RowNumber ??
        item?.rownumber ??
        null,
      status: String(item?.status ?? item?.Status ?? "")
        .trim()
        .toLowerCase(),
      label: String(item?.label ?? item?.Label ?? "")
        .trim(),
      existingValues: Array.isArray(
        item?.existingValues ?? item?.ExistingValues,
      )
        ? (item?.existingValues ?? item?.ExistingValues).map((value) =>
            String(value ?? ""),
          )
        : null,
    }))
    .filter((item) => Number.isInteger(item.index) && item.index >= 0);

const isNoOpPromoteMessage = (message, summary) => {
  if (/promotion completed with 0 applied rows/i.test(String(message || ""))) {
    return true;
  }

  return Boolean(
    summary &&
      summary.processed === 0 &&
      summary.inserted === 0 &&
      summary.updated === 0,
  );
};

const buildNoOpPromoteMessage = (message, summary) => {
  const duplicateCount = Number(summary?.duplicate ?? 0);
  const skippedCount = Number(summary?.skipped ?? 0);

  if (duplicateCount > 0 && duplicateCount === skippedCount) {
    return `No changes. ${duplicateCount} duplicate row(s).`;
  }

  if (duplicateCount > 0) {
    const otherSkipped = Math.max(skippedCount - duplicateCount, 0);
    return otherSkipped > 0
      ? `No changes. Duplicate: ${duplicateCount}. Skipped: ${otherSkipped}.`
      : `No changes. Duplicate: ${duplicateCount}.`;
  }

  return String(message || "No changes.");
};

const LIST_AUDIT_PREVIEW_PALETTE = {
  default: {
    row: "#ffffff",
    sticky: "#ffffff",
    text: "#212529",
  },
  new: {
    row: "#d1e7dd",
    sticky: "#b7dfc8",
    text: "#0f5132",
  },
  updated: {
    row: "#fff3cd",
    sticky: "#ffe69c",
    text: "#664d03",
  },
  skipped: {
    row: "#eef2f7",
    sticky: "#dde5ef",
    text: "#495057",
  },
};

const getListAuditPreviewPalette = (status, variant = "row") => {
  const palette =
    LIST_AUDIT_PREVIEW_PALETTE[status] || LIST_AUDIT_PREVIEW_PALETTE.default;

  if (variant === "sticky") return palette.sticky;
  if (variant === "text") return palette.text;
  return palette.row;
};

const PREVIEW_ROW_INDEX_WIDTH = 92;
const PREVIEW_ROW_STATUS_WIDTH = 132;

const getPreviewRowStatusLabel = (status, fallbackLabel = "") => {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  switch (normalizedStatus) {
    case "new":
      return "Baru";
    case "updated":
      return "Update";
    case "duplicate":
      return "Duplikat";
    case "skipped":
      return "Lewati";
    default:
      return String(fallbackLabel || "Siap");
  }
};

const getPreviewRowDisplayNumber = (rowState, index, headerRowNumber) => {
  const sourceRowNumber = Number(rowState?.rowNumber);
  if (Number.isFinite(sourceRowNumber) && sourceRowNumber > 0) {
    return sourceRowNumber;
  }

  return Number(headerRowNumber || 1) + index + 1;
};

const toImportPreviewFieldName = (index) => `__col_${index}__`;

const LIST_AUDIT_DUPLICATE_GROUP_COLORS = [
  { row: "#fff3bf", sticky: "#ffe08a", text: "#7c5700", badgeBg: "#d97706", badgeText: "#fff" },
  { row: "#ffe8dc", sticky: "#ffd7c7", text: "#f15a22", badgeBg: "#f15a22", badgeText: "#fff" },
  { row: "#fce7f3", sticky: "#fbcfe8", text: "#9d174d", badgeBg: "#db2777", badgeText: "#fff" },
  { row: "#dcfce7", sticky: "#bbf7d0", text: "#166534", badgeBg: "#16a34a", badgeText: "#fff" },
  { row: "#ede9fe", sticky: "#ddd6fe", text: "#6d28d9", badgeBg: "#7c3aed", badgeText: "#fff" },
  { row: "#fee2e2", sticky: "#fecaca", text: "#991b1b", badgeBg: "#dc2626", badgeText: "#fff" },
  { row: "#cffafe", sticky: "#a5f3fc", text: "#155e75", badgeBg: "#0891b2", badgeText: "#fff" },
];

const buildPreviewRowSignature = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("\u001f");

const buildListAuditHeaderMapPayload = (headers, suggestedHeaderMap) => {
  const headerMap = {};

  (Array.isArray(headers) ? headers : []).forEach((_, index) => {
    headerMap[`__col_${index}__`] = "";
  });

  Object.entries(suggestedHeaderMap || {}).forEach(([key, value]) => {
    headerMap[key] = value;
  });

  return headerMap;
};

const getSessionField = (session, keys) =>
  keys.map((key) => session?.[key]).find((value) => value !== undefined && value !== null);

const getSessionTimestamp = (session) =>
  new Date(
    getSessionField(session, ["UploadedAt", "CreatedAt", "ImportedAt", "Timestamp"]) || 0,
  ).getTime();

const pickLatestImportSession = (sessions, targetTable, user) => {
  const targetMatches = (Array.isArray(sessions) ? sessions : []).filter((session) => {
    const target =
      getSessionField(session, ["TargetTable", "targetTable", "TableName", "tableName"]) || "";

    return String(target).trim().toLowerCase() === String(targetTable).trim().toLowerCase();
  });

  if (!targetMatches.length) return null;

  const currentEmail = String(user?.email ?? "").trim().toLowerCase();
  const currentName = String(user?.name ?? "").trim().toLowerCase();
  const currentStream = String(user?.stream ?? "").trim().toLowerCase();

  const scopedMatches = targetMatches.filter((session) => {
    const sessionEmail = String(
      getSessionField(session, [
        "UploadedByEmail",
        "UserEmail",
        "CreatedByEmail",
        "Email",
      ]) || "",
    )
      .trim()
      .toLowerCase();
    const sessionName = String(
      getSessionField(session, [
        "UploadedByName",
        "UserName",
        "CreatedByName",
        "Name",
      ]) || "",
    )
      .trim()
      .toLowerCase();
    const sessionStream = String(
      getSessionField(session, [
        "Stream",
        "TargetStream",
        "UploadedByStream",
        "UserStream",
      ]) || "",
    )
      .trim()
      .toLowerCase();

    const actorMatch =
      (currentEmail && sessionEmail && currentEmail === sessionEmail) ||
      (currentName && sessionName && currentName === sessionName);

    const streamMatch =
      !currentStream || !sessionStream || currentStream === sessionStream;

    return actorMatch && streamMatch;
  });

  const candidates = scopedMatches.length > 0 ? scopedMatches : targetMatches;

  return [...candidates].sort((left, right) => getSessionTimestamp(right) - getSessionTimestamp(left))[0];
};

const getImportTargetDisplayName = ({
  isListAuditImport,
  isWeeklyStrictImport,
  isHumanResourceImport,
  target,
}) => {
  if (isListAuditImport) return LIST_AUDIT_DISPLAY_NAME;
  if (isWeeklyStrictImport) return WEEKLY_TABLE_DISPLAY_NAME;
  if (isHumanResourceImport) {
    const normalizedTarget = normalizeEndpointTarget(target);
    return HUMAN_IMPORT_DISPLAY_NAMES[normalizedTarget] || String(target || "");
  }
  return String(target || "");
};


// ================================
// Import Mode Selector
// ================================
const ImportModeSelector = ({ importMode, setImportMode, disabled }) => {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen(!open);

  const modes = [
    { value: "append", label: "Insert New Row", icon: <Plus size={14} /> },
    {
      value: "upsert",
      label: "Update by Key (Upsert)",
      icon: <RefreshCcw size={14} />,
    },
    {
      value: "rewrite",
      label: "Rewrite All Data",
      icon: <RefreshCcw size={14} />,
    },
  ];

  const currentMode = modes.find((m) => m.value === importMode);

  return (
    <Dropdown
      isOpen={open}
      toggle={toggle}
      disabled={disabled}
      className="w-100"
    >
      <DropdownToggle
        caret
        color="light"
        className="w-100 d-flex align-items-center justify-content-between"
      >
        <span className="d-flex align-items-center">
          {currentMode?.icon}
          <span className="ms-2">{currentMode?.label}</span>
        </span>
      </DropdownToggle>

      <DropdownMenu className="w-100">
        {modes.map((mode) => (
          <DropdownItem
            key={mode.value}
            active={importMode === mode.value}
            onClick={() => setImportMode(mode.value)}
            className="d-flex align-items-center"
          >
            {mode.icon}
            <span className="ms-2">{mode.label}</span>
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

// ================================
// MAIN MODAL COMPONENT
// ================================
const ImportModal = ({
  apiUrl,
  onImported,
  endpointName,
  YearImportValue ,
}) => {
  const auth = useAuth();
  const user = auth?.user;
  const [modalOpen, setModalOpen] = useState(false);
  const normalizedEndpointTarget = useMemo(
    () => normalizeEndpointTarget(endpointName),
    [endpointName],
  );
  const transferProfile = useMemo(
    () =>
      resolveTableTransferProfile({
        endpointName,
        apiUrl,
        checkApiUrl: true,
      }),
    [apiUrl, endpointName],
  );
  const isListAuditImport = transferProfile.importStrategy === "staging-audit";
  const isWeeklyStrictImport =
    transferProfile.importStrategy === "staging-weekly";
  const isHumanStrictImport =
    transferProfile.importStrategy === "staging-human";
  const isProcurementImport = transferProfile.domain === "procurement";
  const isHumanResourceImport = transferProfile.domain === "human";
  const isHumanStructuredImport = false;
  const isGuidedDetectImport = transferProfile.importStrategy === "staging-guided";
  const defaultUpsertKey =
    transferProfile.defaultUpsertKey ||
    resolveDefaultUpsertKey(normalizedEndpointTarget);
  const isStrictDetectImport =
    isListAuditImport || isWeeklyStrictImport || isHumanStrictImport;
  const isDuplicateOnlyStrictPreview =
    isListAuditImport || isWeeklyStrictImport || isHumanStrictImport;
  const isAuditLikeImport =
    transferProfile.importStrategy === "staging-audit" ||
    transferProfile.importStrategy === "staging-weekly" ||
    transferProfile.importStrategy === "staging-human" ||
    transferProfile.importStrategy === "staging-guided";
  const isWeeklyTableImport = transferProfile.id === "weeklytable";
  const target = isListAuditImport
    ? LIST_AUDIT_PROMOTE_TARGET
    : isWeeklyStrictImport
      ? WEEKLY_TABLE_PROMOTE_TARGET
      : endpointName;
  const targetDisplayName = useMemo(
    () =>
      getImportTargetDisplayName({
        isListAuditImport,
        isWeeklyStrictImport,
        isHumanResourceImport,
        target,
      }),
    [isHumanResourceImport, isListAuditImport, isWeeklyStrictImport, target],
  );
  const weeklyImportScope = useMemo(() => {
    const raw = String(apiUrl || "");
    const queryIndex = raw.indexOf("?");
    if (queryIndex < 0) {
      return { periodId: null, tableId: null };
    }

    const params = new URLSearchParams(raw.slice(queryIndex + 1));
    return {
      periodId: params.get("periodId"),
      tableId: params.get("tableId"),
    };
  }, [apiUrl]);
  const weeklyStrictFixedFields = useMemo(() => {
    if (!isWeeklyStrictImport) {
      return {};
    }

    const fixedFields = {};
    if (weeklyImportScope.periodId) {
      fixedFields.WeeklyPeriodId = Number(weeklyImportScope.periodId);
    }
    if (weeklyImportScope.tableId) {
      fixedFields.WeeklyTableInstanceId = Number(weeklyImportScope.tableId);
    }
    return fixedFields;
  }, [isWeeklyStrictImport, weeklyImportScope.periodId, weeklyImportScope.tableId]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importSummaryMode, setImportSummaryMode] = useState(null);
  const [previewRowStates, setPreviewRowStates] = useState([]);

  const [latestImportId, setLatestImportId] = useState(null);
  const [importMode, setImportMode] = useState("append");
  const [newTableName, setNewTableName] = useState("");

  const [primaryKey, setPrimaryKey] = useState("");

  //EDIT HEADER
  const [headerEdits, setHeaderEdits] = useState({});
  const [selectedImportColumns, setSelectedImportColumns] = useState({});

  const [headerDisplayMap, setHeaderDisplayMap] = useState({});

  const [dbDisplayMap, setDbDisplayMap] = useState({});
  const [listAuditDetectionColumns, setListAuditDetectionColumns] = useState(
    [],
  );
  const [listAuditSuggestedHeaderMap, setListAuditSuggestedHeaderMap] =
    useState({});
  const [procurementSuggestedColumns, setProcurementSuggestedColumns] =
    useState({});


  const updateHeader = (index, value) => {
    setHeaderEdits((prev) => ({ ...prev, [index]: value }));
  };
  const setImportColumnSelected = (index, checked) => {
    setSelectedImportColumns((prev) => ({ ...prev, [index]: checked }));
  };
const injectLabelByMode = {
  append: "Insert Rows",
  upsert: "Upsert Rows",
  rewrite: YearImportValue
    ? "Rewrite Selected Year"
    : "Rewrite Table",
};

  // PREVIEW STATES
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [headerRowNumber, setHeaderRowNumber] = useState(1);

  const [showPreview, setShowPreview] = useState(true);
  const isDarkMode =
    typeof document !== "undefined" &&
    document.body?.classList?.contains("dark-only");
  const importPopupTheme = isDarkMode
    ? {
        panelBg: "#1e1e2d",
        panelHeaderBg: "#2c2c3b",
        border: "#444a57",
        text: "#f5f5f5",
        muted: "#94a3b8",
        success: "#86efac",
        danger: "#fca5a5",
        warning: "#fcd34d",
      }
    : {
        panelBg: "#ffffff",
        panelHeaderBg: "#f8fafc",
        border: "#ddd",
        text: "#1f2937",
        muted: "#6b7280",
        success: "green",
        danger: "#dc3545",
        warning: "#b8860b",
      };
  const importPreviewPalette = isDarkMode
    ? {
        duplicateBg: "#1e1e2d",
        duplicateText: "#f5f5f5",
        forbiddenBg: "#1e1e2d",
        forbiddenText: "#f5f5f5",
        matchedBg: "#1e1e2d",
        matchedText: "#f5f5f5",
        inactiveBg: "#2c2c3b",
        inactiveText: "#f8fafc",
        ignoredBg: "#2c2c3b",
        ignoredText: "#f8fafc",
        extraBg: "#2c2c3b",
        extraText: "#f8fafc",
        defaultHeaderBg: "#2c2c3b",
        defaultHeaderText: "#f8fafc",
        defaultRowBg: "#1e1e2d",
        badgeBg: "#2c2c3b",
        badgeText: "#f8fafc",
      }
    : {
        duplicateBg: "#f8d7da",
        duplicateText: "#842029",
        forbiddenBg: "#f8d7da",
        forbiddenText: "#842029",
        matchedBg: "#c8f7c5",
        matchedText: "#064b15",
        inactiveBg: "#f3f4f6",
        inactiveText: "#6b7280",
        ignoredBg: "#e9ecef",
        ignoredText: "#495057",
        extraBg: "#ffe7a6",
        extraText: "#8a5a00",
        defaultHeaderBg: "#ffffff",
        defaultHeaderText: "#1f2937",
        defaultRowBg: "#ffffff",
        badgeBg: "#e9ecef",
        badgeText: "#495057",
      };
  // DB column list
  const [dbColumns, setDbColumns] = useState([]);

  // Matching states
  const [matchedColumns, setMatchedColumns] = useState([]);
  const [missingColumns, setMissingColumns] = useState([]);
  const [extraColumns, setExtraColumns] = useState([]);
  const [duplicateColumns, setDuplicateColumns] = useState([]);
  const [forbiddenHeaders, setForbiddenHeaders] = useState([]);

  // Sheet management
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFileExtension, setSelectedFileExtension] = useState("");

  const previewRowStateMap = useMemo(() => {
    const map = new Map();
    previewRowStates.forEach((item) => {
      if (Number.isInteger(item.index) && item.index >= 0) {
        map.set(item.index, item);
      }
    });
    return map;
  }, [previewRowStates]);

  const displayedPreviewRows = useMemo(() => {
    const rows = previewData.map((row, index) => ({
      row,
      index,
      rowState: previewRowStateMap.get(index) || null,
    }));

    return isStrictDetectImport
      ? isDuplicateOnlyStrictPreview
        ? rows.filter((item) => item.rowState?.status === "duplicate")
        : rows
      : rows;
  }, [isDuplicateOnlyStrictPreview, isStrictDetectImport, previewData, previewRowStateMap]);

  const humanPreviewGridRows = useMemo(() => {
    if (!isHumanStructuredImport) return [];

    return displayedPreviewRows.map(({ row, index, rowState }) => {
      const importRowNumber = getPreviewRowDisplayNumber(
        rowState,
        index,
        headerRowNumber,
      );

      const gridRow = {
        __previewRowId: `human-${index}`,
        __previewRowNumber: String(importRowNumber),
        __previewStatus: getPreviewRowStatusLabel(
          rowState?.status,
          rowState?.label,
        ),
        __previewStatusVariant: rowState?.status || "new",
      };

      previewHeaders.forEach((_, headerIndex) => {
        gridRow[toImportPreviewFieldName(headerIndex)] = String(
          row?.[headerIndex] ?? "",
        );
      });

      return gridRow;
    });
  }, [
    displayedPreviewRows,
    headerRowNumber,
    isHumanStructuredImport,
    previewHeaders,
  ]);

  const humanPreviewGridColumns = useMemo(() => {
    if (!isHumanStructuredImport) return [];

    return [
      {
        field: "__previewRowNumber",
        headerName: "Baris",
        width: PREVIEW_ROW_INDEX_WIDTH,
        minWidth: PREVIEW_ROW_INDEX_WIDTH,
        maxWidth: PREVIEW_ROW_INDEX_WIDTH,
        suppressMovable: true,
        headerClass: "list-audit-ag-grid-header--center",
        cellClass:
          "import-preview-ag-grid-cell import-preview-ag-grid-cell--meta import-preview-ag-grid-cell--row-number list-audit-ag-grid-cell--compact",
      },
      {
        field: "__previewStatus",
        headerName: "Status",
        width: PREVIEW_ROW_STATUS_WIDTH,
        minWidth: PREVIEW_ROW_STATUS_WIDTH,
        maxWidth: PREVIEW_ROW_STATUS_WIDTH,
        suppressMovable: true,
        headerClass: "list-audit-ag-grid-header--center",
        cellClass:
          "import-preview-ag-grid-cell import-preview-ag-grid-cell--meta list-audit-ag-grid-cell--compact",
        cellRenderer: (params) => (
          <span className="import-preview-status-pill">
            {params.value || ""}
          </span>
        ),
      },
      ...previewHeaders.map((header, index) => ({
        field: toImportPreviewFieldName(index),
        headerName: String(header || `Column ${index + 1}`),
        minWidth: 180,
        flex: 1,
        autoHeight: true,
        wrapText: true,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        suppressMovable: false,
        headerClass: "list-audit-ag-grid-header--center",
        cellClass:
          "import-preview-ag-grid-cell list-audit-ag-grid-cell--multiline list-audit-ag-grid-cell--text",
      })),
    ];
  }, [isHumanStructuredImport, previewHeaders]);

  const duplicateGroupPaletteByIndex = useMemo(() => {
    const paletteBySignature = new Map();
    const paletteByIndex = new Map();
    let nextPalette = 0;

    previewData.forEach((row, index) => {
      const rowState = previewRowStateMap.get(index);
      if (rowState?.status !== "duplicate") return;

      const signature = buildPreviewRowSignature(
        rowState.existingValues?.length ? rowState.existingValues : row,
      );

      if (!signature) return;

      if (!paletteBySignature.has(signature)) {
        paletteBySignature.set(
          signature,
          LIST_AUDIT_DUPLICATE_GROUP_COLORS[
            nextPalette % LIST_AUDIT_DUPLICATE_GROUP_COLORS.length
          ],
        );
        nextPalette += 1;
      }

      paletteByIndex.set(index, paletteBySignature.get(signature));
    });

    return paletteByIndex;
  }, [previewData, previewRowStateMap]);

  const listAuditPreviewGridRows = useMemo(() => {
    if (!isStrictDetectImport) return [];

    return displayedPreviewRows.flatMap(({ row, index, rowState }) => {
      const duplicatePalette = duplicateGroupPaletteByIndex.get(index);
      const importRowNumber = getPreviewRowDisplayNumber(
        rowState,
        index,
        headerRowNumber,
      );
      const importRow = {
        __previewRowId: `import-${index}`,
        __previewRowNumber: String(importRowNumber),
        __previewStatus: getPreviewRowStatusLabel(rowState?.status, rowState?.label),
        __previewStatusVariant: rowState?.status || "duplicate",
        __previewPalette: duplicatePalette || null,
      };

      previewHeaders.forEach((_, headerIndex) => {
        importRow[toImportPreviewFieldName(headerIndex)] = String(
          row?.[headerIndex] ?? "",
        );
      });

      const rows = [importRow];
      const existingValues = Array.isArray(rowState?.existingValues)
        ? rowState.existingValues
        : null;

      if (existingValues) {
        const existingRow = {
          __previewRowId: `existing-${index}`,
          __previewRowNumber: "Referensi",
          __previewStatus: "Data saat ini",
          __previewStatusVariant: "existing",
          __previewPalette: duplicatePalette || null,
        };

        previewHeaders.forEach((_, headerIndex) => {
          existingRow[toImportPreviewFieldName(headerIndex)] = String(
            existingValues?.[headerIndex] ?? "",
          );
        });

        rows.push(existingRow);
      }

      return rows;
    });
  }, [
    displayedPreviewRows,
    duplicateGroupPaletteByIndex,
    headerRowNumber,
    isStrictDetectImport,
    previewHeaders,
  ]);

  const listAuditPreviewGridColumns = useMemo(() => {
    if (!isStrictDetectImport) return [];

    return [
      {
        field: "__previewRowNumber",
        headerName: "Baris",
        width: PREVIEW_ROW_INDEX_WIDTH,
        minWidth: PREVIEW_ROW_INDEX_WIDTH,
        maxWidth: PREVIEW_ROW_INDEX_WIDTH,
        suppressMovable: true,
        headerClass: "list-audit-ag-grid-header--center",
        cellClass:
          "import-preview-ag-grid-cell import-preview-ag-grid-cell--meta import-preview-ag-grid-cell--row-number list-audit-ag-grid-cell--compact",
      },
      {
        field: "__previewStatus",
        headerName: "Status",
        width: PREVIEW_ROW_STATUS_WIDTH,
        minWidth: PREVIEW_ROW_STATUS_WIDTH,
        maxWidth: PREVIEW_ROW_STATUS_WIDTH,
        suppressMovable: true,
        headerClass: "list-audit-ag-grid-header--center",
        cellClass:
          "import-preview-ag-grid-cell import-preview-ag-grid-cell--meta list-audit-ag-grid-cell--compact",
        cellRenderer: (params) => {
          const palette = params.data?.__previewPalette;
          const isDarkVariant = isDarkMode;
          const badgeBg = isDarkVariant
            ? importPreviewPalette.badgeBg
            : palette?.badgeBg ?? importPreviewPalette.badgeBg;
          const badgeText = isDarkVariant
            ? importPreviewPalette.badgeText
            : palette?.badgeText ?? importPreviewPalette.badgeText;

          return (
            <span
              className="import-preview-status-pill"
              style={{
                background: badgeBg,
                color: badgeText,
              }}
            >
              {params.value || ""}
            </span>
          );
        },
      },
      ...previewHeaders.map((header, index) => ({
        field: toImportPreviewFieldName(index),
        headerName: String(header || `Column ${index + 1}`),
        minWidth: 180,
        flex: 1,
        autoHeight: true,
        wrapText: true,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        suppressMovable: false,
        headerClass: "list-audit-ag-grid-header--center",
        cellClass:
          "import-preview-ag-grid-cell list-audit-ag-grid-cell--multiline list-audit-ag-grid-cell--text",
      })),
    ];
  }, [
    importPreviewPalette.badgeBg,
    importPreviewPalette.badgeText,
    isDarkMode,
    isStrictDetectImport,
    previewHeaders,
  ]);

  const pkSafety = React.useMemo(() => {
    if (isAuditLikeImport) return { status: "safe" };
    if (!primaryKey) return { status: "idle" };

    // 1️⃣ Must exist in DB
    if (!dbColumns.includes(primaryKey))
      return { status: "error", reason: "Column not found in table" };

    // 2️⃣ Must exist in Excel headers
    const pkIndex = previewHeaders
      .map((h, i) => (headerEdits[i] ?? h ?? "").toLowerCase())
      .indexOf(primaryKey);

    if (pkIndex === -1)
      return { status: "error", reason: "Column not found in Excel" };

    // 3️⃣ Extract PK values from preview data
    const values = previewData
      .map((row) => row[pkIndex])
      .filter((v) => v !== null && v !== undefined && v !== "");

    if (values.length !== previewData.length)
      return { status: "warning", reason: "Some rows have empty key" };

    // 4️⃣ Check duplicates
    const unique = new Set(values.map((v) => v.toString().trim()));
    if (unique.size !== values.length)
      return { status: "error", reason: "Duplicate key values detected" };

    return { status: "safe" };
  }, [isAuditLikeImport, primaryKey, previewHeaders, previewData, headerEdits, dbColumns]);

  const listAuditHasBlockingIssues =
    (isStrictDetectImport || isHumanStructuredImport) && matchedColumns.length === 0;

  const listAuditDetectionBySourceIndex = useMemo(() => {
    if (!isStrictDetectImport) return {};

    return listAuditDetectionColumns.reduce((accumulator, column) => {
      if (Number.isInteger(column.sourceIndex)) {
        accumulator[column.sourceIndex] = column;
      }
      return accumulator;
    }, {});
  }, [isStrictDetectImport, listAuditDetectionColumns]);

  const selectedFileSupportsEvidence = useMemo(
    () => LIST_AUDIT_EVIDENCE_ALLOWED_EXTENSIONS.has(selectedFileExtension),
    [selectedFileExtension],
  );

  const listAuditMappedEvidenceColumns = useMemo(() => {
    if (!isListAuditImport) return [];

    return Array.from(
      new Set(
        listAuditDetectionColumns
          .filter((column) => column.status === "green")
          .map((column) => column.column)
          .filter((column) => LIST_AUDIT_EVIDENCE_COLUMNS.has(column)),
      ),
    );
  }, [isListAuditImport, listAuditDetectionColumns]);

  const listAuditEvidenceMismatch =
    isListAuditImport &&
    listAuditMappedEvidenceColumns.length > 0 &&
    !selectedFileSupportsEvidence;

  const listAuditMissingCompareColumns = useMemo(() => {
    const strictCompareColumns = isListAuditImport
      ? LIST_AUDIT_COMPARE_COLUMNS
      : isHumanStrictImport
        ? HUMAN_IMPORT_COMPARE_COLUMNS_BY_TARGET[normalizedEndpointTarget] || []
        : [];

    if (strictCompareColumns.length === 0 || listAuditDetectionColumns.length === 0) {
      return [];
    }

    const strictCompareColumnKeys = new Set(
      strictCompareColumns.map((column) => column.toLowerCase()),
    );

    return listAuditDetectionColumns
      .filter(
        (column) =>
          column.status !== "green" &&
          strictCompareColumnKeys.has(column.column.toLowerCase()),
      )
      .map((column) => column.column.toLowerCase());
  }, [isHumanStrictImport, isListAuditImport, listAuditDetectionColumns, normalizedEndpointTarget]);

  const listAuditFullTemplateIssue = useMemo(() => {
    if (
      (!isListAuditImport && !isHumanStrictImport) ||
      listAuditDetectionColumns.length === 0 ||
      listAuditMissingCompareColumns.length === 0
    ) {
      return "";
    }

    const missingLabels = listAuditMissingCompareColumns
      .map((column) => dbDisplayMap[column] || column.toUpperCase())
      .join(", ");

    if (isListAuditImport) {
      return `Full ${LIST_AUDIT_DISPLAY_NAME} compare template is required for accurate upsert dedup/no-op behavior. Missing or ignored compare columns right now: ${missingLabels}. RHA and LHA may still be imported from Excel, but they do not participate in no-op comparison.`;
    }

    return `Full ${targetDisplayName} compare template is required for accurate duplicate detection. Missing or ignored compare columns right now: ${missingLabels}.`;
  }, [
    dbDisplayMap,
    isHumanStrictImport,
    isListAuditImport,
    listAuditDetectionColumns.length,
    listAuditMissingCompareColumns,
    targetDisplayName,
  ]);

  const auditDuplicatePreviewCount = useMemo(
    () =>
      isStrictDetectImport && importSummaryMode === "preview"
        ? Number(importSummary?.duplicate ?? 0)
        : 0,
    [importSummary?.duplicate, importSummaryMode, isStrictDetectImport],
  );
  const auditPreviewHasDuplicates = useMemo(
    () =>
      isStrictDetectImport &&
      previewRowStates.some((item) => item?.status === "duplicate"),
    [isStrictDetectImport, previewRowStates],
  );

  const statusTone = useMemo(() => {
    const normalizedStatus = String(status || "").toLowerCase();

    if (
      /failed|error|unknown|duplicate|not found|invalid|reject|missing/i.test(
        normalizedStatus,
      )
    ) {
      return "danger";
    }

    if (
      /warning|unsupported|skip|0 applied rows|no-op|no changes/i.test(
        normalizedStatus,
      )
    ) {
      return "warning";
    }

    return "success";
  }, [status]);

  const shouldHideAuditPreviewNoOpSummary =
    isStrictDetectImport &&
    importSummaryMode === "preview" &&
    Number(importSummary?.processed ?? 0) === 0 &&
    Number(importSummary?.inserted ?? 0) === 0 &&
    Number(importSummary?.updated ?? 0) === 0;
  const shouldHideAuditPreviewSuccessFeedback =
    isStrictDetectImport &&
    importSummaryMode === "preview";
  const auditPreviewTotalRows =
    Number(importSummary?.totalRows ?? 0) || previewData.length;
  const auditHasDuplicatePromoteOptions =
    isStrictDetectImport && auditPreviewHasDuplicates;
  const auditWithoutDuplicatesNoop =
    isStrictDetectImport &&
    importSummaryMode === "preview" &&
    auditDuplicatePreviewCount > 0 &&
    Number(importSummary?.processed ?? 0) === 0;

  const importSummaryLabels = useMemo(
    () =>
      importSummaryMode === "preview"
        ? {
            title: "Perkiraan hasil import",
            processed: "Akan diproses",
            inserted: "Akan ditambah",
            updated: "Akan diperbarui",
            skipped: "Akan dilewati",
            duplicate: "Duplikat",
          }
        : {
            title: "Ringkasan import",
            processed: "Diproses",
            inserted: "Tambah",
            updated: "Update",
            skipped: "Lewati",
            duplicate: "Duplikat",
          },
    [importSummaryMode],
  );

  // Detect target from URL
  // useEffect(() => {
  //   if (apiUrl) {
  //     const parts = apiUrl.split("/");
  //     const last = parts.filter(Boolean).pop();
  //     setTarget(last || "default");
  //   }
  // }, [apiUrl]);

  const toggleModal = () => {
    setModalOpen(!modalOpen);
    setStatus("");
    setImportSummary(null);
    setImportSummaryMode(null);
    setLatestImportId(null);

    setPreviewHeaders([]);
    setPreviewData([]);
    setPreviewRowStates([]);

    setImportMode(isAuditLikeImport ? "upsert" : "append");
    setDbColumns([]);
    setListAuditDetectionColumns([]);
    setListAuditSuggestedHeaderMap({});
    setProcurementSuggestedColumns({});

    setMatchedColumns([]);
    setMissingColumns([]);
    setExtraColumns([]);
    setDuplicateColumns([]);
    setForbiddenHeaders([]);

    setSheetNames([]);
    setSelectedSheet(null);
    setSelectedFileName("");
    setSelectedFileExtension("");

    setShowPreview(true);
    setHeaderEdits({});
    setSelectedImportColumns({});
    setPrimaryKey("");
    setHeaderRowNumber(1);
  };

  // STEP 1 — File Upload
  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setStatus("");
    setImportSummary(null);
    setImportSummaryMode(null);
    setPreviewRowStates([]);
    setLoading(true);
    setSelectedImportColumns({});
    const extension = String(selected.name || "").split(".").pop()?.toLowerCase() || "";
    setSelectedFileName(selected.name || "");
    setSelectedFileExtension(extension);

    if (!SUPPORTED_IMPORT_EXTENSIONS.has(extension)) {
      setStatus("Import hanya mendukung file .xlsx.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", selected);

      const base = process.env.REACT_APP_API_BASE_URL;
      const uploadResponse = await axios.post(`${base}import/${target}`, formData, {
        withCredentials: true,
      });

      let importId =
        uploadResponse?.data?.importId ??
        uploadResponse?.data?.ImportId ??
        null;

      if (!importId) {
        const sessionsResponse = await axios.get(`${base}import/sessions`, {
          withCredentials: true,
        });
        const latestSession = pickLatestImportSession(
          sessionsResponse.data,
          target,
          user,
        );
        importId = latestSession?.ImportId ?? latestSession?.importId;
      }

      if (!importId) {
        throw new Error(`Import session for ${target} not found`);
      }

      setLatestImportId(importId);

      setStatus("Uploaded to staging.");

      const sheetsRes = await axios.get(
        `${base}import/sheets/${importId}`,
        { withCredentials: true },
      );
      const availableSheets = Array.isArray(sheetsRes.data)
        ? sheetsRes.data
        : [];
      setSheetNames(availableSheets);
      const first = availableSheets[0] || null;
      setSelectedSheet(first);

      await loadPreview(importId, first);
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // STEP 1b — Load preview data
  const loadPreview = async (importId, sheet) => {
    if (!importId) return;

    try {
      const base = process.env.REACT_APP_API_BASE_URL;
      const param = sheet ? `?sheet=${encodeURIComponent(sheet)}` : "";
      const res = await axios.get(`${base}import/data/${importId}${param}`, {
        withCredentials: true,
      });

      const rows = parsePreviewRows(res.data);
      setPreviewRowStates([]);

      const colRes = await axios.get(`${base}import/columns/${target}`, {
        withCredentials: true,
      });
      const displayMap = {};
      const lower = [];

      (Array.isArray(colRes.data) ? colRes.data : []).forEach((column) => {
        const rawColumn = String(column ?? "").trim();
        if (!rawColumn || rawColumn.toLowerCase() === "id") return;
        if (rawColumn.toLowerCase() === "action") return;
        if (
          isListAuditImport &&
          LIST_AUDIT_DISALLOWED_IMPORT_COLUMNS.has(rawColumn)
        ) {
          return;
        }

        const normalized = rawColumn.toLowerCase();
        displayMap[normalized] = rawColumn;
        lower.push(normalized);
      });

      setDbColumns(lower);
      setDbDisplayMap(displayMap);
      let resolvedHeaderRowNumber = 1;
      let resolvedPreviewHeaders = rows[0] || [];
      let resolvedPreviewData = rows.slice(1);

      if (isStrictDetectImport) {
        const detectRes = await axios.get(
          `${base}import/detect/${target}/${importId}${param}`,
          { withCredentials: true },
        );
        resolvedHeaderRowNumber = Math.max(
          1,
          Number(
            detectRes.data?.headerRowNumber ??
              detectRes.data?.HeaderRowNumber ??
              1,
          ) || 1,
        );
        const safeHeaderIndex = Math.min(
          Math.max(resolvedHeaderRowNumber - 1, 0),
          Math.max(rows.length - 1, 0),
        );
        resolvedPreviewHeaders = rows[safeHeaderIndex] || [];
        resolvedPreviewData = rows.slice(safeHeaderIndex + 1);

        const detectionColumns = Array.isArray(detectRes.data?.columns)
          ? detectRes.data.columns
              .map((item) => ({
                column: String(item?.column ?? item?.Column ?? "").trim(),
                label: String(
                  item?.label ??
                    item?.Label ??
                    item?.column ??
                    item?.Column ??
                    "",
                ).trim(),
                status:
                  String(
                    item?.status ?? item?.Status ?? "gray",
                  ).toLowerCase() === "green"
                    ? "green"
                    : "gray",
                detected: Boolean(item?.detected ?? item?.Detected),
                hasData: Boolean(item?.hasData ?? item?.HasData),
                sourceIndex:
                  item?.sourceIndex ??
                  item?.SourceIndex ??
                  item?.sourceindex,
                rawHeader: item?.rawHeader ?? item?.RawHeader ?? null,
              }))
              .filter((column) => Boolean(column.column))
          : [];
        const suggestedHeaderMap =
          detectRes.data?.suggestedHeaderMap ??
          detectRes.data?.SuggestedHeaderMap ??
          {};
        const unknownHeaders = Array.isArray(detectRes.data?.unknownHeaders)
          ? detectRes.data.unknownHeaders
          : Array.isArray(detectRes.data?.UnknownHeaders)
            ? detectRes.data.UnknownHeaders
            : [];
        const duplicateDetectedColumns = Array.isArray(
          detectRes.data?.duplicateDetectedColumns,
        )
          ? detectRes.data.duplicateDetectedColumns
          : Array.isArray(detectRes.data?.DuplicateDetectedColumns)
            ? detectRes.data.DuplicateDetectedColumns
            : [];
        const managedHeaders = isListAuditImport
          ? resolvedPreviewHeaders
              .map((header) => String(header ?? "").trim())
              .filter(
                (header) => classifyListAuditHeader(header).state === "forbidden",
              )
          : [];

        setListAuditDetectionColumns(detectionColumns);
        setListAuditSuggestedHeaderMap(suggestedHeaderMap);
        setMatchedColumns(
          detectionColumns
            .filter((column) => column.status === "green")
            .map((column) => column.column.toLowerCase()),
        );
        setMissingColumns(
          detectionColumns
            .filter((column) => column.status !== "green")
            .map((column) => column.column.toLowerCase()),
        );
        setExtraColumns(unknownHeaders.map((header) => String(header)));
        setDuplicateColumns(
          duplicateDetectedColumns.map((column) =>
            String(column).toLowerCase(),
          ),
        );
        setForbiddenHeaders(Array.from(new Set(managedHeaders)));
        setHeaderRowNumber(resolvedHeaderRowNumber);

        const previewPayload = {
          HeaderMap: buildListAuditHeaderMapPayload(
            resolvedPreviewHeaders,
            suggestedHeaderMap,
          ),
          SheetName: sheet || null,
          HeaderRowNumber: resolvedHeaderRowNumber,
          ...(Object.keys(weeklyStrictFixedFields).length > 0
            ? { FixedFields: weeklyStrictFixedFields }
            : {}),
        };

        try {
          const previewRes = await axios.post(
            `${base}import/preview/${target}/${importId}?mode=upsert`,
            previewPayload,
            { withCredentials: true },
          );
          const previewMessage =
            previewRes.data?.message ??
            previewRes.data?.Message ??
            "Preview complete.";
          const previewSummary = normalizePromoteSummary(
            previewRes.data?.summary ?? previewRes.data?.Summary,
          );
          const previewRows = normalizePreviewRowStates(
            previewRes.data?.rowStates ?? previewRes.data?.RowStates,
          );
          setImportSummary(previewSummary);
          setImportSummaryMode("preview");
          setPreviewRowStates(previewRows);
          setStatus(
            isStrictDetectImport &&
            isNoOpPromoteMessage(previewMessage, previewSummary)
              ? ""
              : isNoOpPromoteMessage(previewMessage, previewSummary)
              ? buildNoOpPromoteMessage(previewMessage, previewSummary)
              : previewMessage,
          );
        } catch (previewErr) {
          const previewPayloadError = previewErr?.response?.data;
          const previewMessage =
            previewPayloadError?.message ||
            previewPayloadError?.Message ||
            `Preview summary failed: ${previewErr.message}`;
          const previewSummary = normalizePromoteSummary(
            previewPayloadError?.summary ?? previewPayloadError?.Summary,
          );
          const previewRows = normalizePreviewRowStates(
            previewPayloadError?.rowStates ?? previewPayloadError?.RowStates,
          );
          setImportSummary(previewSummary);
          setImportSummaryMode(previewSummary ? "preview" : null);
          setPreviewRowStates(previewRows);
          setStatus(
            isStrictDetectImport &&
            isNoOpPromoteMessage(previewMessage, previewSummary)
              ? ""
              : isNoOpPromoteMessage(previewMessage, previewSummary)
              ? buildNoOpPromoteMessage(previewMessage, previewSummary)
              : previewMessage,
          );
        }
      } else if (isGuidedDetectImport) {
        const detectRes = await axios.get(
          `${base}import/detect/${target}/${importId}${param}`,
          { withCredentials: true },
        );
        resolvedHeaderRowNumber = Math.max(
          1,
          Number(
            detectRes.data?.headerRowNumber ??
              detectRes.data?.HeaderRowNumber ??
              1,
          ) || 1,
        );
        const safeHeaderIndex = Math.min(
          Math.max(resolvedHeaderRowNumber - 1, 0),
          Math.max(rows.length - 1, 0),
        );
        resolvedPreviewHeaders = rows[safeHeaderIndex] || [];
        resolvedPreviewData = rows.slice(safeHeaderIndex + 1);

        const detectionColumns = Array.isArray(detectRes.data?.columns)
          ? detectRes.data.columns
              .map((item) => ({
                column: String(item?.column ?? item?.Column ?? "").trim(),
                label: String(
                  item?.label ??
                    item?.Label ??
                    item?.column ??
                    item?.Column ??
                    "",
                ).trim(),
                status:
                  String(item?.status ?? item?.Status ?? "gray").toLowerCase() ===
                  "green"
                    ? "green"
                    : "gray",
                detected: Boolean(item?.detected ?? item?.Detected),
                hasData: Boolean(item?.hasData ?? item?.HasData),
                sourceIndex:
                  item?.sourceIndex ??
                  item?.SourceIndex ??
                  item?.sourceindex,
                rawHeader: item?.rawHeader ?? item?.RawHeader ?? null,
              }))
              .filter((column) => Boolean(column.column))
          : [];

        const suggestedHeaderMap =
          detectRes.data?.suggestedHeaderMap ??
          detectRes.data?.SuggestedHeaderMap ??
          {};

        const unknownHeaders = Array.isArray(detectRes.data?.unknownHeaders)
          ? detectRes.data.unknownHeaders
          : Array.isArray(detectRes.data?.UnknownHeaders)
            ? detectRes.data.UnknownHeaders
            : [];

        const duplicateDetectedColumns = Array.isArray(
          detectRes.data?.duplicateDetectedColumns,
        )
          ? detectRes.data.duplicateDetectedColumns
          : Array.isArray(detectRes.data?.DuplicateDetectedColumns)
            ? detectRes.data.DuplicateDetectedColumns
            : [];

        const forbiddenHeaders = resolvedPreviewHeaders
          .map((header) => String(header ?? "").trim())
          .filter((header) =>
            (isHumanResourceImport
              ? HUMAN_RESOURCE_FORBIDDEN_HEADER_ALIASES
              : PROCUREMENT_FORBIDDEN_HEADER_ALIASES
            ).has(normalizeImportHeaderToken(header)),
          );

        const nextHeaderEdits = {};
        const nextSelectedImportColumns = {};
        const nextProcurementSuggestedColumns = {};
        resolvedPreviewHeaders.forEach((header, index) => {
          nextHeaderEdits[index] = String(header ?? "");
          nextSelectedImportColumns[index] = false;
          nextProcurementSuggestedColumns[index] = false;
        });

        Object.entries(suggestedHeaderMap).forEach(([sourceKey, mappedColumn]) => {
          const match = String(sourceKey).match(/^__col_(\d+)__$/i);
          if (!match) return;

          const columnIndex = Number(match[1]);
          if (!Number.isInteger(columnIndex) || columnIndex < 0) return;

          const mapped = String(mappedColumn ?? "").trim();
          nextHeaderEdits[columnIndex] = mapped;
          nextSelectedImportColumns[columnIndex] = Boolean(mapped);
          nextProcurementSuggestedColumns[columnIndex] = Boolean(mapped);
        });

        const guidedForbiddenAliases = isHumanResourceImport
          ? HUMAN_RESOURCE_FORBIDDEN_HEADER_ALIASES
          : PROCUREMENT_FORBIDDEN_HEADER_ALIASES;
        resolvedPreviewHeaders.forEach((header, index) => {
          if (
            guidedForbiddenAliases.has(
              normalizeImportHeaderToken(String(header ?? "").trim()),
            )
          ) {
            nextSelectedImportColumns[index] = false;
            nextProcurementSuggestedColumns[index] = false;
          }
        });

        setHeaderEdits(nextHeaderEdits);
        setSelectedImportColumns(nextSelectedImportColumns);
        setProcurementSuggestedColumns(nextProcurementSuggestedColumns);
        setMatchedColumns(
          detectionColumns
            .filter((column) => column.status === "green")
            .map((column) => column.column.toLowerCase()),
        );
        setMissingColumns(
          detectionColumns
            .filter((column) => column.status !== "green")
            .map((column) => column.column.toLowerCase()),
        );
        setExtraColumns(unknownHeaders.map((header) => String(header)));
        setDuplicateColumns(
          duplicateDetectedColumns.map((column) =>
            String(column).toLowerCase(),
          ),
        );
        setForbiddenHeaders(Array.from(new Set(forbiddenHeaders)));
        setHeaderRowNumber(resolvedHeaderRowNumber);

        const procurementPreviewHeaderMap = {};
        resolvedPreviewHeaders.forEach((_, index) => {
          const key = `__col_${index}__`;
          const selected = Boolean(nextSelectedImportColumns[index]);
          procurementPreviewHeaderMap[key] = selected
            ? String(nextHeaderEdits[index] ?? "").trim()
            : "";
        });

        const procurementPreviewPayload = {
          headerMap: procurementPreviewHeaderMap,
          sheetName: sheet || null,
          headerRowNumber: resolvedHeaderRowNumber,
          ...(defaultUpsertKey ? { upsertKey: defaultUpsertKey } : {}),
        };

        try {
          const previewRes = await axios.post(
            `${base}import/preview/${target}/${importId}?mode=upsert`,
            procurementPreviewPayload,
            { withCredentials: true },
          );
          const previewMessage =
            previewRes.data?.message ??
            previewRes.data?.Message ??
            "Preview complete.";
          const previewSummary = normalizePromoteSummary(
            previewRes.data?.summary ?? previewRes.data?.Summary,
          );
          const previewRows = normalizePreviewRowStates(
            previewRes.data?.rowStates ?? previewRes.data?.RowStates,
          );

          setImportSummary(previewSummary);
          setImportSummaryMode("preview");
          setPreviewRowStates(previewRows);
          setStatus(
            isNoOpPromoteMessage(previewMessage, previewSummary)
              ? buildNoOpPromoteMessage(previewMessage, previewSummary)
              : previewMessage,
          );
        } catch (previewErr) {
          const previewPayloadError = previewErr?.response?.data;
          const previewMessage =
            previewPayloadError?.message ||
            previewPayloadError?.Message ||
            `Preview summary failed: ${previewErr.message}`;
          const previewSummary = normalizePromoteSummary(
            previewPayloadError?.summary ?? previewPayloadError?.Summary,
          );
          const previewRows = normalizePreviewRowStates(
            previewPayloadError?.rowStates ?? previewPayloadError?.RowStates,
          );

          setImportSummary(previewSummary);
          setImportSummaryMode(previewSummary ? "preview" : null);
          setPreviewRowStates(previewRows);
          setStatus(
            isNoOpPromoteMessage(previewMessage, previewSummary)
              ? buildNoOpPromoteMessage(previewMessage, previewSummary)
              : previewMessage,
          );
        }
      } else {
        setHeaderRowNumber(1);
      }

      const nextHeaderDisplayMap = {};
      resolvedPreviewHeaders.forEach((header) => {
        const rawHeader = String(header ?? "").trim();
        const token = normalizeImportHeaderToken(rawHeader);

        if (rawHeader) {
          nextHeaderDisplayMap[rawHeader] = rawHeader;
          nextHeaderDisplayMap[rawHeader.toLowerCase()] = rawHeader;
        }

        if (token) {
          nextHeaderDisplayMap[token] = rawHeader;
          nextHeaderDisplayMap[token.toUpperCase()] = rawHeader;
        }
      });
      setHeaderDisplayMap(nextHeaderDisplayMap);
      setPreviewHeaders(resolvedPreviewHeaders);
      setPreviewData(resolvedPreviewData);

      setShowPreview(true);
    } catch (err) {
      setStatus(`Preview load failed: ${err.message}`);
    }
  };

  // STEP 1c — Reactively apply START ROW when headers/data change




  // STEP 1d — Recompute header/data from startRow
  const recalculatePreviewHeaderState = useCallback(() => {
    if (isStrictDetectImport || previewHeaders.length === 0 || dbColumns.length === 0) {
      return;
    }

    const displayMap = {};

    const headerValues = previewHeaders.map((h, i) => {
      const display = String(headerEdits[i] ?? h ?? "").trim();
      const normalizedDisplay = display.toLowerCase();

      if (normalizedDisplay) {
        displayMap[normalizedDisplay] = display;
      }

      const selected = Object.prototype.hasOwnProperty.call(
        selectedImportColumns,
        i,
      )
        ? selectedImportColumns[i]
        : Boolean(display);

      return {
        selected,
        display,
        mapped: normalizedDisplay,
        state: normalizedDisplay ? "mapped" : "empty",
      };
    });

    setHeaderDisplayMap(displayMap);

    const matched = Array.from(
      new Set(
        headerValues
          .filter((item) => item.selected)
          .map((item) => item.mapped?.toLowerCase?.() || "")
          .filter((column) => dbColumns.includes(column)),
      ),
    );

    const duplicates = Array.from(
      new Set(
        headerValues
          .filter((item) => item.selected)
          .map((item) => item.mapped?.toLowerCase?.() || "")
          .filter(
            (column, index, all) =>
              column && all.indexOf(column) !== index,
          ),
      ),
    );

    setMatchedColumns(matched);
    setMissingColumns(dbColumns.filter((column) => !matched.includes(column)));
    setExtraColumns(
      headerValues
        .filter((item) => item.selected && item.display && item.state === "unknown")
        .map((item) => item.display),
    );
    setDuplicateColumns(duplicates);
    setForbiddenHeaders([]);
  }, [dbColumns, headerEdits, isStrictDetectImport, previewHeaders, selectedImportColumns]);

  useEffect(() => {
    recalculatePreviewHeaderState();
  }, [recalculatePreviewHeaderState]);

  // STEP 2 — Injection
  const handleInject = async ({ includeDuplicates = false } = {}) => {
    const effectiveImportMode = isAuditLikeImport ? "upsert" : importMode;
    const headerMap = {};
    const mappedEvidenceColumns = [];
    let hasSelectedColumn = false;

    if (isStrictDetectImport) {
      previewHeaders.forEach((_, index) => {
        headerMap[`__col_${index}__`] = "";
      });

      Object.entries(listAuditSuggestedHeaderMap).forEach(([key, value]) => {
        headerMap[key] = value;
      });

      listAuditDetectionColumns
        .filter((column) => column.status === "green")
        .forEach((column) => {
          hasSelectedColumn = true;
          if (isListAuditImport && LIST_AUDIT_EVIDENCE_COLUMNS.has(column.column)) {
            mappedEvidenceColumns.push(column.column);
          }
        });
    } else {
      previewHeaders.forEach((h, i) => {
        const key = `__col_${i}__`; // stable identity
        const display = String(
          headerEdits.hasOwnProperty(i) ? headerEdits[i] : h ?? "",
        ).trim();
        const isSelected = Object.prototype.hasOwnProperty.call(
          selectedImportColumns,
          i,
        )
          ? selectedImportColumns[i]
          : Boolean(display);

        if (!isSelected) {
          headerMap[key] = "";
          return;
        }

        hasSelectedColumn = true;
        headerMap[key] = display;
      });
    }

    if (!latestImportId) {
      setStatus("No import session found.");
      return;
    }

    if (isStrictDetectImport && previewData.length === 0) {
      setStatus(
        `No staged ${targetDisplayName} rows found. Check the selected sheet and detected columns before promote.`,
      );
      return;
    }

    if (isListAuditImport && listAuditFullTemplateIssue) {
      setStatus(listAuditFullTemplateIssue);
      return;
    }

    if (!hasSelectedColumn) {
      setStatus("Select at least one column to import before promote.");
      return;
    }

    if (
      isHumanResourceImport &&
      !isHumanStrictImport &&
      effectiveImportMode === "upsert" &&
      defaultUpsertKey
    ) {
      const hasUpsertColumn = Object.values(headerMap).some(
        (column) =>
          String(column ?? "").trim().toLowerCase() ===
          defaultUpsertKey.toLowerCase(),
      );

      if (!hasUpsertColumn) {
        setStatus(
          `Column ${defaultUpsertKey} wajib ada untuk import upsert ${target}.`,
        );
        return;
      }
    }

    if (
      isListAuditImport &&
      mappedEvidenceColumns.length > 0 &&
      !selectedFileSupportsEvidence
    ) {
      setStatus(
        `Columns ${Array.from(new Set(mappedEvidenceColumns)).join(", ")} require Excel xlsx/xlsm. CSV does not support embedded evidence import.`,
      );
      return;
    }

    setLoading(true);
    setStatus(isAuditLikeImport ? "Promoting staged import..." : "Injecting...");
    setImportSummary(null);
    setImportSummaryMode(null);

    try {
      const base = process.env.REACT_APP_API_BASE_URL;
      let url = `${base}import/promote/${target}/${latestImportId}`;
      let payload = null;

      if (isStrictDetectImport) {
        url = `${base}import/promote/${target}/${latestImportId}?mode=upsert`;
        payload = {
          HeaderMap: headerMap,
          SheetName: selectedSheet || null,
          HeaderRowNumber: headerRowNumber,
          IncludeDuplicates: includeDuplicates,
          ...(Object.keys(weeklyStrictFixedFields).length > 0
            ? { FixedFields: weeklyStrictFixedFields }
            : {}),
        };
      } else {
        if (effectiveImportMode !== "append") {
          url += `?mode=${effectiveImportMode}`;
        }

        if (effectiveImportMode === "newTable") {
          if (!newTableName.trim()) {
            setStatus("Enter new table name.");
            setLoading(false);
            return;
          }
          url = `${base}import/promote/${newTableName}/${latestImportId}?mode=newtable`;
        }

        const fixedFields = {
          ...(YearImportValue ? { Year: year } : {}),
          ...(isWeeklyTableImport && weeklyImportScope.periodId
            ? { WeeklyPeriodId: Number(weeklyImportScope.periodId) }
            : {}),
          ...(isWeeklyTableImport && weeklyImportScope.tableId
            ? { WeeklyTableInstanceId: Number(weeklyImportScope.tableId) }
            : {}),
        };

        payload = {
          headerMap,
          sheetName: selectedSheet,
          headerRowNumber: headerRowNumber,
          ...(!isAuditLikeImport && effectiveImportMode === "upsert"
            ? { upsertKey: primaryKey }
            : {}),
          ...(isHumanResourceImport &&
          effectiveImportMode === "upsert" &&
          defaultUpsertKey
            ? { upsertKey: defaultUpsertKey }
            : {}),
          ...(Object.keys(fixedFields).length > 0 ? { fixedFields } : {}),
        };
      }


      const res = await axios.post(url, payload, { withCredentials: true });
      if (isAuditLikeImport) {
        const responsePayload = res.data ?? {};
        const message =
          responsePayload?.message ??
          responsePayload?.Message ??
          "Import promoted successfully.";
        const summary = normalizePromoteSummary(
          responsePayload?.summary ?? responsePayload?.Summary,
        );

        setStatus(
          isStrictDetectImport && isNoOpPromoteMessage(message, summary)
            ? buildNoOpPromoteMessage(message, summary)
            : message,
        );
        setImportSummary(summary);
        setImportSummaryMode("result");

        if (isNoOpPromoteMessage(message, summary)) {
          return;
        }

        setTimeout(() => {
          onImported?.();
          toggleModal();
        }, 500);
      } else {
        setStatus(
          typeof res.data === "string"
            ? res.data
            : res.data?.message ?? res.data?.Message ?? "Import completed.",
        );

        setTimeout(() => {
          onImported?.();
          toggleModal();
        }, 400);
      }
    } catch (err) {
      const responsePayload = err?.response?.data;
      const message =
        responsePayload?.message ||
        responsePayload?.Message ||
        responsePayload ||
        `Inject failed: ${err.message}`;
      const summary = normalizePromoteSummary(
        responsePayload?.summary ?? responsePayload?.Summary,
      );

      setImportSummary(summary);
      setImportSummaryMode(summary ? "result" : null);
      if (isAuditLikeImport && isNoOpPromoteMessage(message, summary)) {
        setStatus(buildNoOpPromoteMessage(message, summary));
        return;
      }
      setStatus(
        typeof message === "string" ? message : `Inject failed: ${err.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteWithoutDuplicates = () => {
    if (auditWithoutDuplicatesNoop) {
      return;
    }

    handleInject({ includeDuplicates: false });
  };

  const handlePromoteWithDuplicates = () => {
    handleInject({ includeDuplicates: true });
  };

  return (
    <>
      <Button
        type="button"
        color="outline-primary"
        size="sm"
        onClick={toggleModal}
        className="d-inline-flex align-items-center"
      >
        <UploadCloud size={14} />
        <span className="btn-import-text ms-1">Import</span>
      </Button>

      <Modal
        isOpen={modalOpen}
        toggle={toggleModal}
        centered
        size="xl"
        className="table-utility-modal table-utility-modal--import"
        backdropClassName="table-utility-backdrop"
        zIndex={1400}
      >
        <ModalHeader toggle={toggleModal}>
          <UploadCloud className="me-2" /> Import Table: {targetDisplayName}
        </ModalHeader>

        <ModalBody>
          {!isAuditLikeImport ? (
            <FormGroup className="d-flex align-items-center">
              <Label className="me-2" style={{ minWidth: "140px" }}>
                Mode:
              </Label>
              <div className="flex-grow-1">
                <ImportModeSelector
                  importMode={importMode}
                  setImportMode={setImportMode}
                  disabled={loading}
                />
              </div>
            </FormGroup>
          ) : null}

          {YearImportValue && (
            <FormGroup>
              <Label>Year</Label>
              <Input
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={(e) => setYear(+e.target.value)}
              />
            </FormGroup>
          )}

          {importMode === "newTable" && (
            <FormGroup>
              <Label>New Table Name</Label>
              <Input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
              />
            </FormGroup>
          )}

          {!isAuditLikeImport && importMode === "upsert" && (
            <FormGroup>
              <Label>Primary Key Column</Label>
              <Input
                type="select"
                value={primaryKey}
                onChange={(e) => setPrimaryKey(e.target.value)}
              >
                <option value="">-- Select Column --</option>
                {previewHeaders.map((h, i) => {
                  const col = (headerEdits[i] ?? h ?? "").toLowerCase();
                  return col ? (
                    <option key={i} value={col}>
                      {col}
                    </option>
                  ) : null;
                })}
              </Input>
            </FormGroup>
          )}

          {!isAuditLikeImport && importMode === "upsert" && primaryKey && (
            <div className="mt-2">
              {pkSafety.status === "safe" && (
                <Alert color="success" className="py-2">
                  Primary key is valid - updates and inserts are safe
                </Alert>
              )}

              {false && pkSafety.status === "safe" && (
                <Alert color="success" className="py-2">
                  ✅ Primary key is valid — updates & inserts are safe
                </Alert>
              )}

              {pkSafety.status === "warning" && (
                <Alert color="warning" className="py-2">
                  Warning: {pkSafety.reason}
                </Alert>
              )}

              {false && pkSafety.status === "warning" && (
                <Alert color="warning" className="py-2">
                  ⚠ {pkSafety.reason}
                </Alert>
              )}

              {pkSafety.status === "error" && (
                <Alert color="danger" className="py-2">
                  Error: {pkSafety.reason}
                </Alert>
              )}

              {false && pkSafety.status === "error" && (
                <Alert color="danger" className="py-2">
                  ❌ {pkSafety.reason}
                </Alert>
              )}
            </div>
          )}

          {/* Upload */}
          <FormGroup className="d-flex align-items-center">
            <Label className="me-2" style={{ minWidth: "140px" }}>
              File Import:
            </Label>
            <Input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={loading}
            />
          </FormGroup>

          {isListAuditImport && selectedFileName && (
            <Alert
              color={selectedFileSupportsEvidence ? "secondary" : "warning"}
              className="mt-3 py-2"
            >
              File: <strong>{selectedFileName}</strong>
              {selectedFileSupportsEvidence ? (
                <span> - Evidence columns RHA/LHA didukung untuk file .xlsx.</span>
              ) : (
                <span>
                  {" "}
                  - Hanya file .xlsx yang didukung untuk import.
                </span>
              )}
            </Alert>
          )}

          {/* SHEET SELECTOR */}
          {sheetNames.length > 1 && (
            <FormGroup className="mt-3">
              <Label>Select Sheet:</Label>
              <Input
                type="select"
                value={selectedSheet}
                onChange={async (e) => {
                  const sheet = e.target.value;
                  setSelectedSheet(sheet);
                  await loadPreview(latestImportId, sheet);
                }}
              >
                {sheetNames.map((s, i) => (
                  <option key={i} value={s}>
                    {s}
                  </option>
                ))}
              </Input>
            </FormGroup>
          )}

          {(isStrictDetectImport || isHumanStructuredImport) && listAuditHasBlockingIssues && (
            <Alert color="warning" className="mt-3">
              No {targetDisplayName} columns with data were detected yet.
              Backend only promotes green columns from the detected{" "}
              {targetDisplayName} column list.
            </Alert>
          )}

          {listAuditEvidenceMismatch && (
            <Alert color="danger" className="mt-3">
              Columns {listAuditMappedEvidenceColumns.join(", ")} require file
              .xlsx. File selain .xlsx tidak didukung untuk import.
            </Alert>
          )}

          {isListAuditImport && listAuditFullTemplateIssue && (
            <Alert color="danger" className="mt-3">
              {listAuditFullTemplateIssue}
            </Alert>
          )}

          {(isStrictDetectImport || isHumanStructuredImport) && listAuditDetectionColumns.length > 0 && (
            <div className="mb-3">
                <div className="fw-semibold mb-2">
                  {isListAuditImport
                    ? "Kolom Audit Terdeteksi"
                    : isWeeklyStrictImport
                      ? "Kolom Weekly Table Terdeteksi"
                      : `Kolom ${targetDisplayName} Terdeteksi`}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {listAuditDetectionColumns.map((column) => (
                  <div
                    key={column.column}
                    className="import-detection-card border rounded px-3 py-2"
                    style={{
                      minWidth: "220px",
                      background:
                        column.status === "green"
                          ? (isDarkMode ? "#1f3a2f" : "#c8f7c5")
                          : (isDarkMode ? "#2c2c3b" : "#f3f4f6"),
                      color:
                        column.status === "green"
                          ? (isDarkMode ? "#bbf7d0" : "#064b15")
                          : (isDarkMode ? "#94a3b8" : "#4b5563"),
                    }}
                  >
                    <div className="fw-semibold">
                      {column.label ||
                        dbDisplayMap[column.column.toLowerCase()] ||
                        column.column}
                    </div>
                    <div className="small">
                      {column.status === "green"
                        ? `Siap diimport dari "${column.rawHeader || column.column}"`
                        : column.detected
                          ? `Header ada, tetapi semua nilainya kosong`
                          : "Kolom tidak ditemukan di file"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABLE PREVIEW */}
          {showPreview && previewHeaders.length > 0 && (
            <div
              className="import-preview-shell"
              style={{
                maxHeight: "80vh",
                overflow: "auto",
                border: `1px solid ${importPopupTheme.border}`,
                borderRadius: "6px",
                background: importPopupTheme.panelBg,
              }}
            >
              <div
                className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom"
                style={{
                  background: importPopupTheme.panelHeaderBg,
                  borderBottomColor: importPopupTheme.border,
                }}
              >
                <div className="d-flex flex-wrap align-items-center gap-2">
                  {isStrictDetectImport || isHumanStructuredImport ? (
                    <span
                      className={`import-preview-meta-pill${
                        auditHasDuplicatePromoteOptions
                          ? " import-preview-meta-pill--warning"
                          : ""
                      }`}
                    >
                      {`Total baris: ${auditPreviewTotalRows}`}
                    </span>
                  ) : (
                    <span className="import-preview-meta-pill">
                      {previewData.length} baris data
                    </span>
                  )}
                  {headerRowNumber > 1 && (
                    <span className="import-preview-meta-pill">
                      Header baris {headerRowNumber}
                    </span>
                  )}
                  {!isStrictDetectImport && importSummary?.duplicate > 0 && (
                    <span className="import-preview-meta-pill import-preview-meta-pill--warning">
                      {`${importSummary?.duplicate || 0} duplikat`}
                    </span>
                  )}
                </div>
                {isHumanStructuredImport ? (
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <small style={{ color: importPopupTheme.muted }}>
                      {defaultUpsertKey
                        ? `Preview ${targetDisplayName} menampilkan hasil sinkronisasi berdasarkan kunci ${defaultUpsertKey}.`
                        : `Preview ${targetDisplayName} menampilkan hasil sinkronisasi data.`}
                    </small>
                  </div>
                ) : isStrictDetectImport ? (
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <small style={{ color: importPopupTheme.muted }}>
                      {isListAuditImport
                        ? "Preview Audit hanya menampilkan baris yang terdeteksi duplikat. Jika grid kosong, file tetap berhasil dibaca tetapi tidak ada duplikat."
                        : isWeeklyStrictImport
                          ? "Preview Weekly Table hanya menampilkan baris yang terdeteksi duplikat. Jika grid kosong, file tetap berhasil dibaca tetapi tidak ada duplikat."
                          : `Preview ${targetDisplayName} hanya menampilkan baris yang terdeteksi duplikat. Jika grid kosong, file tetap berhasil dibaca tetapi tidak ada duplikat.`}
                    </small>
                  </div>
                ) : (
                  <div className="d-flex gap-2">
                    <Button
                      type="button"
                      color="light"
                      size="sm"
                      onClick={() => {
                        const next = {};
                        previewHeaders.forEach((header, index) => {
                          if (isGuidedDetectImport) {
                            next[index] = Boolean(procurementSuggestedColumns[index]);
                            return;
                          }

                          const display = String(
                            headerEdits.hasOwnProperty(index)
                              ? headerEdits[index]
                              : header ?? "",
                          ).trim();

                          next[index] = Boolean(display);
                        });
                        setSelectedImportColumns(next);
                      }}
                    >
                      Select valid columns
                    </Button>
                    <Button
                      type="button"
                      color="light"
                      size="sm"
                      onClick={() => {
                        const next = {};
                        previewHeaders.forEach((_, index) => {
                          next[index] = false;
                        });
                        setSelectedImportColumns(next);
                      }}
                    >
                      Clear selection
                    </Button>
                  </div>
                )}
              </div>
              {isHumanStructuredImport ? (
                <div
                  className="ag-theme-quartz list-audit-ag-grid import-preview-ag-grid"
                  style={{
                    height: "66vh",
                    width: "100%",
                  }}
                >
                  <AgGridReact
                    rowData={humanPreviewGridRows}
                    columnDefs={humanPreviewGridColumns}
                    defaultColDef={{
                      sortable: false,
                      filter: false,
                      resizable: true,
                      suppressHeaderMenuButton: true,
                      suppressMovable: false,
                      cellStyle: {
                        whiteSpace: "normal",
                        lineHeight: 1.4,
                      },
                    }}
                    animateRows={false}
                    rowSelection={undefined}
                    suppressCellFocus
                    suppressRowClickSelection
                    headerHeight={58}
                    rowHeight={48}
                    getRowId={(params) => params.data.__previewRowId}
                    getRowStyle={(params) => ({
                      background: getListAuditPreviewPalette(
                        params.data?.__previewStatusVariant,
                      ),
                      color: getListAuditPreviewPalette(
                        params.data?.__previewStatusVariant,
                        "text",
                      ),
                    })}
                    overlayNoRowsTemplate={`<span class="import-preview-ag-grid-empty">Tidak ada data ${targetDisplayName} yang siap dipreview.</span>`}
                  />
                </div>
              ) : isStrictDetectImport ? (
                <div
                  className="ag-theme-quartz list-audit-ag-grid import-preview-ag-grid"
                  style={{
                    height: "66vh",
                    width: "100%",
                  }}
                >
                  <AgGridReact
                    rowData={listAuditPreviewGridRows}
                    columnDefs={listAuditPreviewGridColumns}
                    defaultColDef={{
                      sortable: false,
                      filter: false,
                      resizable: true,
                      suppressHeaderMenuButton: true,
                      suppressMovable: false,
                      cellStyle: {
                        whiteSpace: "normal",
                        lineHeight: 1.4,
                      },
                    }}
                    animateRows={false}
                    rowSelection={undefined}
                    suppressCellFocus
                    suppressRowClickSelection
                    headerHeight={58}
                    rowHeight={48}
                    getRowId={(params) => params.data.__previewRowId}
                    getRowStyle={(params) => {
                      const palette = params.data?.__previewPalette;
                      const variant = params.data?.__previewStatusVariant;

                      if (isDarkMode) {
                        return {
                          background:
                            variant === "duplicate"
                              ? importPreviewPalette.duplicateBg
                              : importPreviewPalette.defaultRowBg,
                          color:
                            variant === "duplicate"
                              ? importPreviewPalette.duplicateText
                              : importPopupTheme.text,
                        };
                      }

                      return {
                        background:
                          palette?.row ??
                          getListAuditPreviewPalette(
                            variant === "existing" ? "duplicate" : variant,
                          ),
                        color:
                          palette?.text ??
                          getListAuditPreviewPalette(
                            variant === "existing" ? "duplicate" : variant,
                            "text",
                          ),
                      };
                    }}
                    overlayNoRowsTemplate={`<span class="import-preview-ag-grid-empty">File berhasil dipreview. Tidak ada baris duplikat pada ${targetDisplayName} ini.</span>`}
                  />
                </div>
              ) : (
                <table
                  className="table table-sm table-bordered mb-0 import-preview-table"
                  style={{
                    background: importPopupTheme.panelBg,
                    color: importPopupTheme.text,
                    borderColor: importPopupTheme.border,
                    borderCollapse: "separate",
                    borderSpacing: 0,
                  }}
                >
                  <thead>
                    <tr>
                      {previewHeaders.map((h, i) => {
                        const rawHeader = String(h || "").trim();
                        const display = String(
                          headerEdits.hasOwnProperty(i) ? headerEdits[i] : h || "",
                        ).trim();
                        const isSystemManaged = (
                          isHumanResourceImport
                            ? HUMAN_RESOURCE_FORBIDDEN_HEADER_ALIASES
                            : PROCUREMENT_FORBIDDEN_HEADER_ALIASES
                        ).has(normalizeImportHeaderToken(rawHeader));
                        const isProcurementSuggested = Boolean(
                          procurementSuggestedColumns[i],
                        );
                        const normalizedMapped = display.toLowerCase();
                        const isMatched = Boolean(
                          normalizedMapped && dbColumns.includes(normalizedMapped),
                        );
                        const isExtra = Boolean(display && !isMatched);
                        const defaultSelected = isGuidedDetectImport
                          ? isProcurementSuggested
                          : Boolean(display);
                        const isSelected = Object.prototype.hasOwnProperty.call(
                          selectedImportColumns,
                          i,
                        )
                          ? selectedImportColumns[i]
                          : defaultSelected;
                        const isDuplicate = Boolean(
                          normalizedMapped &&
                            duplicateColumns.includes(normalizedMapped),
                        );

                        return (
                          <th
                            key={i}
                            style={{
                              background: isDuplicate
                                ? importPreviewPalette.duplicateBg
                                : isSystemManaged
                                  ? importPreviewPalette.forbiddenBg
                                  : !isSelected
                                    ? importPreviewPalette.inactiveBg
                                    : isMatched
                                      ? importPreviewPalette.matchedBg
                                      : isExtra
                                        ? importPreviewPalette.extraBg
                                        : importPreviewPalette.defaultHeaderBg,
                              color: isDuplicate
                                ? importPreviewPalette.duplicateText
                                : isSystemManaged
                                  ? importPreviewPalette.forbiddenText
                                  : !isSelected
                                    ? importPreviewPalette.inactiveText
                                    : isMatched
                                      ? importPreviewPalette.matchedText
                                      : isExtra
                                        ? importPreviewPalette.extraText
                                        : importPreviewPalette.defaultHeaderText,
                              fontWeight: 600,
                            }}
                          >
                            <div className="d-flex align-items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                checked={Boolean(isSelected)}
                                disabled={
                                  isSystemManaged ||
                                  (isGuidedDetectImport && !isProcurementSuggested)
                                }
                                onChange={(e) =>
                                  setImportColumnSelected(i, e.target.checked)
                                }
                              />
                              <small className="text-muted">Import</small>
                            </div>
                            <input
                              value={
                                headerEdits.hasOwnProperty(i)
                                  ? headerEdits[i]
                                  : h ?? ""
                              }
                              onChange={(e) => updateHeader(i, e.target.value)}
                              style={{
                                width: "100%",
                                borderRadius: 6,
                                border: `1px solid ${isDarkMode ? "#444a57" : "#d1d5db"}`,
                                background: isDarkMode ? "#1e1e2d" : "#ffffff",
                                color: isDarkMode ? "#f5f5f5" : "#111827",
                                padding: "4px 8px",
                              }}
                            />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {displayedPreviewRows.map(({ row, index }) => (
                      <tr key={index}>
                        {row.map((col, c) => (
                          <td key={c}>{col || ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {status && !shouldHideAuditPreviewSuccessFeedback && (
            <Alert className="mt-3" color={statusTone}>
              {status}
            </Alert>
          )}

          {importSummary &&
            !shouldHideAuditPreviewNoOpSummary &&
            !shouldHideAuditPreviewSuccessFeedback && (
            <Alert className="mt-3" color={statusTone === "danger" ? "danger" : "secondary"}>
              <div className="fw-semibold mb-2">
                {importSummaryLabels.title}
              </div>
              <div className="small d-flex flex-wrap gap-3">
                <span>Total baris: <strong>{importSummary.totalRows}</strong></span>
                <span>{importSummaryLabels.processed}: <strong>{importSummary.processed}</strong></span>
                <span>{importSummaryLabels.inserted}: <strong>{importSummary.inserted}</strong></span>
                <span>{importSummaryLabels.updated}: <strong>{importSummary.updated}</strong></span>
                <span>{importSummaryLabels.skipped}: <strong>{importSummary.skipped}</strong></span>
                {importSummary.duplicate > 0 && (
                  <span>{importSummaryLabels.duplicate}: <strong>{importSummary.duplicate}</strong></span>
                )}
              </div>
            </Alert>
          )}

          {false && status && (
            <Alert
              className="mt-3"
              color={status.includes("❌") ? "danger" : "success"}
            >
              {status}
            </Alert>
          )}
        </ModalBody>

        <ModalFooter>
          {isHumanStructuredImport ? (
            <Button
              type="button"
              color="success"
              onClick={() => handleInject()}
              disabled={
                !latestImportId ||
                loading ||
                listAuditHasBlockingIssues ||
                listAuditEvidenceMismatch ||
                Boolean(listAuditFullTemplateIssue)
              }
            >
              {loading ? (
                <Spinner size="sm" />
              ) : (
                `Promote to ${targetDisplayName}`
              )}
            </Button>
          ) : isStrictDetectImport ? (
            <div className="d-flex flex-wrap justify-content-end gap-2 w-100">
              {auditHasDuplicatePromoteOptions ? (
                <>
                  <span
                    title={
                      auditWithoutDuplicatesNoop
                        ? `Semua baris pada file ini terdeteksi duplikat. Promote tanpa duplikat tidak menambahkan data baru ke ${targetDisplayName}.`
                        : undefined
                    }
                  >
                    <Button
                      type="button"
                      color="success"
                      onClick={handlePromoteWithoutDuplicates}
                      disabled={
                        !latestImportId ||
                        loading ||
                        auditWithoutDuplicatesNoop ||
                        listAuditHasBlockingIssues ||
                        listAuditEvidenceMismatch ||
                        Boolean(listAuditFullTemplateIssue)
                      }
                    >
                      {loading ? <Spinner size="sm" /> : "Promote tanpa duplikat"}
                    </Button>
                  </span>
                  <Button
                    type="button"
                    color="outline-warning"
                    onClick={handlePromoteWithDuplicates}
                    disabled={
                      !latestImportId ||
                      loading ||
                      listAuditHasBlockingIssues ||
                      listAuditEvidenceMismatch ||
                      Boolean(listAuditFullTemplateIssue)
                    }
                  >
                    {loading ? <Spinner size="sm" /> : "Promote dengan duplikat"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  color="success"
                  onClick={() => handleInject()}
                  disabled={
                    !latestImportId ||
                    loading ||
                    listAuditHasBlockingIssues ||
                    listAuditEvidenceMismatch ||
                    Boolean(listAuditFullTemplateIssue)
                  }
                >
                  {loading ? (
                    <Spinner size="sm" />
                  ) : (
                    `Promote to ${targetDisplayName}`
                  )}
                </Button>
              )}
            </div>
          ) : (
            <Button
              color={importMode === "rewrite" ? "danger" : "success"}
              onClick={() => handleInject()}
              disabled={
                !latestImportId ||
                loading ||
                listAuditHasBlockingIssues ||
                listAuditEvidenceMismatch ||
                Boolean(listAuditFullTemplateIssue)
              }
            >
              {loading ? (
                <Spinner size="sm" />
              ) : (
                injectLabelByMode[importMode] || "Inject to Table"
              )}
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
};
export default ImportModal;
