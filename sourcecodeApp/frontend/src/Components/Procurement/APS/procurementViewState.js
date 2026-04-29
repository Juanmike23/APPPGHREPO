/*
 * PGH-DOC
 * File: src/Components/Procurement/APS/procurementViewState.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import {
  PROCUREMENT_ALL_COLUMNS,
  PROCUREMENT_COLUMN_LABELS,
  PROCUREMENT_SHARED_COLUMNS,
} from "./procurementListColumns";

const APP_PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");

const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${APP_PUBLIC_URL}${normalizedPath}`;
};

const ALL_PROCUREMENT_COLUMNS = Array.from(
  new Set(["Source", ...PROCUREMENT_SHARED_COLUMNS, ...PROCUREMENT_ALL_COLUMNS]),
);

const normalizeToken = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[_\s-]+/g, "")
    .toLowerCase();

const PROCUREMENT_CANONICAL_COLUMN_MAP = (() => {
  const map = new Map();

  const register = (alias, actualColumn) => {
    const normalizedAlias = normalizeToken(alias);
    if (!normalizedAlias || !actualColumn) return;
    if (!map.has(normalizedAlias)) {
      map.set(normalizedAlias, actualColumn);
    }
  };

  ALL_PROCUREMENT_COLUMNS.forEach((column) => register(column, column));
  register("Status_Pengadaan", "Status_Pengadaan");

  Object.entries(PROCUREMENT_COLUMN_LABELS).forEach(([key, label]) => {
    const actualColumn =
      ALL_PROCUREMENT_COLUMNS.find(
        (column) => normalizeToken(column) === normalizeToken(key),
      ) || key;
    register(key, actualColumn);
    register(label, actualColumn);
  });

  register("status", "Status_Pengadaan");
  register("dept", "Department");
  register("duedate", "JatuhTempo");
  register("jatuh tempo", "JatuhTempo");
  register("project id", "project_id");

  return map;
})();

const toPositiveInteger = (value) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

export const normalizeProcurementTabKey = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "new" || normalized === "newprocure") {
    return "new";
  }

  if (
    normalized === "existing" ||
    normalized === "exist" ||
    normalized === "existingprocure" ||
    normalized === "exs"
  ) {
    return "existing";
  }

  return "all";
};

export const getProcurementTabLabel = (value) => {
  const normalized = normalizeProcurementTabKey(value);
  if (normalized === "new") return "New";
  if (normalized === "existing") return "Existing";
  return "All";
};

export const getProcurementDefaultTitle = (tabKey) => {
  const normalized = normalizeProcurementTabKey(tabKey);
  if (normalized === "new") return "New Procurement";
  if (normalized === "existing") return "Existing Procurement";
  return "Procurement List";
};

export const getProcurementSourceLabel = (value) => {
  const normalized = normalizeProcurementTabKey(value);
  if (normalized === "new") return "New";
  if (normalized === "existing") return "Existing";
  return "All";
};

export const getProcurementCanonicalColumn = (value) => {
  const normalized = normalizeToken(value);
  return PROCUREMENT_CANONICAL_COLUMN_MAP.get(normalized) || null;
};

export const getProcurementColumnLabel = (column) => {
  const canonicalColumn = getProcurementCanonicalColumn(column) || column;
  return PROCUREMENT_COLUMN_LABELS[String(canonicalColumn ?? "").toUpperCase()] || canonicalColumn;
};

export const normalizeProcurementFilterValue = (value, column = null) => {
  if (value == null) {
    return "";
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return "";
  }

  const lowered = rawValue.toLowerCase();
  if (
    lowered === "undefined" ||
    lowered === "null" ||
    lowered === "empty" ||
    lowered === "__empty__"
  ) {
    return "";
  }

  const canonicalColumn = getProcurementCanonicalColumn(column);
  if (canonicalColumn === "Source") {
    return getProcurementSourceLabel(rawValue);
  }

  return rawValue;
};

export const buildProcurementDrilldownUrl = ({
  basePath = buildAppPath("/procurement/aps"),
  tab = "all",
  chartColumn = null,
  label = null,
  distinctColumn = null,
  countdown = null,
  countdownStart = null,
  secondaryColumn = null,
  secondaryLabel = null,
  rowId = null,
}) => {
  const normalizedTab = normalizeProcurementTabKey(tab);
  const normalizedChartColumn =
    chartColumn === "{chartcolumn}"
      ? chartColumn
      : getProcurementCanonicalColumn(chartColumn) || chartColumn;
  const normalizedSecondaryColumn =
    secondaryColumn === "{chartcolumn2}"
      ? secondaryColumn
      : getProcurementCanonicalColumn(secondaryColumn) || secondaryColumn;
  const normalizedLabel = String(label ?? "");
  const normalizedSecondaryLabel = String(secondaryLabel ?? "");
  const query = new URLSearchParams();

  query.set("tab", normalizedTab);
  query.set("type", normalizedTab);

  if (rowId != null && rowId !== "") {
    query.set("rowId", String(rowId));
  }

  if (normalizedChartColumn) {
    query.set("chartcolumn", String(normalizedChartColumn));
  }

  if (normalizedLabel) {
    query.set("label", normalizedLabel);
  }

  if (distinctColumn) {
    query.set(
      "distinct",
      getProcurementCanonicalColumn(distinctColumn) || String(distinctColumn),
    );
  }

  if (countdown != null && countdown !== "") {
    query.set("countdown", String(countdown));
  }

  if (countdownStart != null && countdownStart !== "") {
    query.set("countdownStart", String(countdownStart));
  }

  if (normalizedSecondaryColumn) {
    query.set("chartcolumn2", String(normalizedSecondaryColumn));
  }

  if (normalizedSecondaryLabel) {
    query.set("label2", normalizedSecondaryLabel);
  }

  const queryString = query.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
};

export const resolveProcurementDrilldownState = ({
  search = "",
  visibleColumns = null,
  allowDistinct = true,
  forceTabAll = false,
}) => {
  const query = new URLSearchParams(search);
  const tabKey = forceTabAll
    ? "all"
    : normalizeProcurementTabKey(query.get("tab") || query.get("type"));
  const chartColumn = getProcurementCanonicalColumn(
    query.get("chartcolumn") || query.get("column"),
  );
  const secondaryColumn = getProcurementCanonicalColumn(query.get("chartcolumn2"));
  const normalizedLabel = normalizeProcurementFilterValue(
    query.get("label"),
    chartColumn,
  );
  const normalizedSecondaryLabel = normalizeProcurementFilterValue(
    query.get("label2"),
    secondaryColumn,
  );
  const rawDistinctColumn = allowDistinct
    ? getProcurementCanonicalColumn(query.get("distinct"))
    : null;
  const legacyDistinctColumn =
    allowDistinct && normalizedLabel.toLowerCase() === "distinct" && chartColumn
      ? chartColumn
      : null;
  const distinctColumn = rawDistinctColumn || legacyDistinctColumn || null;
  const countdown = toPositiveInteger(query.get("countdown"));
  const countdownStart = toPositiveInteger(query.get("countdownStart"));
  const rowId = query.get("rowId");
  const filters = [];
  const today = new Date().toISOString().slice(0, 10);

  if (chartColumn === "JatuhTempo" && countdown) {
    const hasRangeStart =
      countdownStart != null && countdownStart > 0 && countdownStart < countdown;

    filters.push({
      column: "JatuhTempo",
      operator: ">=",
      value: today,
    });
    filters.push({
      column: "SisaBulan",
      operator: hasRangeStart ? ">" : ">=",
      value: hasRangeStart ? String(countdownStart) : "0",
    });
    filters.push({
      column: "SisaBulan",
      operator: "<=",
      value: String(countdown),
    });
  }

  if (chartColumn && normalizedLabel && normalizedLabel.toLowerCase() !== "distinct") {
    filters.push({
      column: chartColumn,
      operator: "=",
      value: normalizedLabel,
    });
  }

  if (
    secondaryColumn &&
    normalizedSecondaryLabel &&
    !(tabKey !== "all" && secondaryColumn === "Source")
  ) {
    filters.push({
      column: secondaryColumn,
      operator: "=",
      value: normalizedSecondaryLabel,
    });
  }

  return {
    tabKey,
    rowId: rowId ? String(rowId) : null,
    chartColumn,
    secondaryColumn,
    normalizedLabel,
    normalizedSecondaryLabel,
    distinctColumn,
    countdown,
    countdownStart,
    externalFilters: {
      filters,
      mode: "and",
      sort: null,
      visibleColumns,
      distinct: distinctColumn
        ? {
            column: distinctColumn,
          }
        : null,
    },
  };
};

export const buildProcurementListTitle = ({
  tabKey = "all",
  chartColumn = null,
  secondaryColumn = null,
  normalizedLabel = "",
  normalizedSecondaryLabel = "",
  distinctColumn = null,
  countdown = null,
  countdownStart = null,
}) => {
  const normalizedTab = normalizeProcurementTabKey(tabKey);
  const tabLabel = getProcurementTabLabel(normalizedTab);
  const tabSuffix = normalizedTab !== "all" ? ` (${tabLabel})` : "";

  if (distinctColumn) {
    return `Distinct ${getProcurementColumnLabel(distinctColumn)}${tabSuffix}`;
  }

  if (chartColumn === "JatuhTempo" && countdown) {
    const sourceSuffix =
      secondaryColumn && normalizedSecondaryLabel
        ? `, ${getProcurementColumnLabel(secondaryColumn)} = ${normalizedSecondaryLabel}`
        : "";
    if (countdownStart && countdownStart > 0 && countdownStart < countdown) {
      return `Jatuh Tempo > ${countdownStart} sampai <= ${countdown} Bulan${sourceSuffix}${tabSuffix}`;
    }
    return `Jatuh Tempo <= ${countdown} Bulan${sourceSuffix}${tabSuffix}`;
  }

  if (chartColumn && normalizedLabel) {
    return `${getProcurementColumnLabel(chartColumn)} = ${normalizedLabel}${tabSuffix}`;
  }

  if (secondaryColumn && normalizedSecondaryLabel) {
    return `${getProcurementColumnLabel(secondaryColumn)} = ${normalizedSecondaryLabel}${tabSuffix}`;
  }

  return getProcurementDefaultTitle(normalizedTab);
};
