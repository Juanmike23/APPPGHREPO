/*
 * PGH-DOC
 * File: src/Components/Audit/Utils/auditViewState.js
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
  getAuditChartCanonicalColumn,
  getListAuditColumnLabel,
} from "./columnHelpers";
import {
  AUDIT_EMPTY_FILTER_TOKEN,
  AUDIT_EMPTY_LABEL,
  AUDIT_INVALID_STATUS_FILTER_TOKEN,
  AUDIT_INVALID_STATUS_LABEL,
  toAuditFilterValue,
} from "./auditValueLabels";

const APP_PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${APP_PUBLIC_URL}${normalizedPath}`;
};

export const AUDIT_DEFAULT_SORT_PARAM = "latest";
export const AUDIT_OLDEST_SORT_PARAM = "oldest";

export const normalizeAuditTypeKey = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "internal") return "internal";
  if (normalized === "external" || normalized === "eksternal") return "external";
  return "all";
};

export const getAuditTypeValue = (value) => {
  const normalizedType = normalizeAuditTypeKey(value);

  if (normalizedType === "internal") return "Internal";
  if (normalizedType === "external") return "Eksternal";
  return "all";
};

export const getAuditTypeLabel = (value) => {
  const normalizedType = normalizeAuditTypeKey(value);

  if (normalizedType === "internal") return "Internal";
  if (normalizedType === "external") return "Eksternal";
  return "all";
};

export const normalizeAuditLabelValue = (value, chartColumn = null) => {
  if (value == null) {
    return "";
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return "";
  }

  const lowered = rawValue.toLowerCase();
  if (lowered === AUDIT_EMPTY_FILTER_TOKEN.toLowerCase()) {
    return AUDIT_EMPTY_FILTER_TOKEN;
  }
  if (lowered === AUDIT_INVALID_STATUS_FILTER_TOKEN.toLowerCase()) {
    return AUDIT_INVALID_STATUS_FILTER_TOKEN;
  }
  if (["undefined", "null", "empty"].includes(lowered)) {
    return "";
  }
  if (lowered === "external" || lowered === "eksternal") return "Eksternal";
  if (lowered === "internal") return "Internal";

  return toAuditFilterValue(rawValue, { chartColumn });
};

export const resolveAuditSortState = (rawSort) => {
  const sortKey = String(rawSort ?? "").trim().toLowerCase();

  if (sortKey === AUDIT_OLDEST_SORT_PARAM) {
    return {
      queryValue: AUDIT_OLDEST_SORT_PARAM,
      tableSort: {
        column: "CreatedAt",
        direction: "asc",
      },
    };
  }

  return {
    queryValue: AUDIT_DEFAULT_SORT_PARAM,
    tableSort: null,
  };
};

export const buildAuditDrilldownUrl = ({
  basePath = buildAppPath("/audit/listAudit"),
  chartColumn = null,
  label = null,
  type = "all",
  mode = null,
  distinctColumn = null,
  sort = AUDIT_DEFAULT_SORT_PARAM,
}) => {
  const normalizedType = normalizeAuditTypeKey(type);
  const normalizedChartColumn =
    String(chartColumn ?? "").trim().toLowerCase() === "id"
      ? "Id"
      : getAuditChartCanonicalColumn(chartColumn) || chartColumn;
  const normalizedLabel =
    String(label ?? "").includes("{") || String(normalizedChartColumn ?? "").trim().toLowerCase() === "id"
      ? label
      : normalizeAuditLabelValue(label, normalizedChartColumn);
  const resolvedSort =
    String(sort ?? "").trim().toLowerCase() === AUDIT_OLDEST_SORT_PARAM
      ? AUDIT_OLDEST_SORT_PARAM
      : AUDIT_DEFAULT_SORT_PARAM;
  const entries = [];
  const append = (key, value) => {
    if (value == null || value === "") return;
    const rawValue = String(value);
    const encodedValue = rawValue.includes("{")
      ? rawValue
      : encodeURIComponent(rawValue);
    entries.push(`${encodeURIComponent(key)}=${encodedValue}`);
  };

  if (String(normalizedChartColumn ?? "").trim().toLowerCase() === "id") {
    append("rowId", normalizedLabel);
  } else {
    append("chartcolumn", normalizedChartColumn);
    append("label", normalizedLabel);
  }

  append("distinct", distinctColumn);
  append("mode", mode);

  if (normalizedType !== "all") {
    append("type", normalizedType);
  }

  if (resolvedSort === AUDIT_OLDEST_SORT_PARAM) {
    append("sort", AUDIT_OLDEST_SORT_PARAM);
  }

  const query = entries.join("&");
  return query ? `${basePath}?${query}` : basePath;
};

export const resolveAuditDrilldownState = ({
  search = "",
  visibleColumns = null,
  allowDistinct = true,
}) => {
  const query = new URLSearchParams(search);
  const chartColumn = getAuditChartCanonicalColumn(query.get("chartcolumn"));
  const normalizedLabel = normalizeAuditLabelValue(query.get("label"), chartColumn);
  const normalizedTypeKey = normalizeAuditTypeKey(query.get("type"));
  const normalizedType = getAuditTypeValue(normalizedTypeKey);
  const mode = String(query.get("mode") ?? "").trim().toLowerCase() || null;
  const rawDistinctColumn = allowDistinct
    ? getAuditChartCanonicalColumn(query.get("distinct"))
    : null;
  const legacyDistinctColumn =
    allowDistinct &&
    normalizedLabel === "distinct" &&
    chartColumn
      ? chartColumn
      : null;
  const distinctColumn = rawDistinctColumn || legacyDistinctColumn || null;
  const sortState = resolveAuditSortState(query.get("sort"));

  const filters = [];

  if (chartColumn && normalizedLabel && normalizedLabel !== "distinct" && !distinctColumn) {
    filters.push({
      column: chartColumn,
      operator: "=",
      value: normalizedLabel,
    });
  }

  if (normalizedType !== "all") {
    filters.push({
      column: "JENISAUDIT",
      operator: "=",
      value: normalizedType,
    });
  }

  const externalFilters = {
    filters,
    mode: "and",
    sort: sortState.tableSort,
    visibleColumns,
    distinct: distinctColumn
      ? {
          column: distinctColumn,
        }
      : null,
  };

  return {
    chartColumn,
    distinctColumn,
    externalFilters,
    mode,
    normalizedLabel,
    normalizedType,
    normalizedTypeKey,
    sort: sortState,
  };
};

export const buildAuditListTitle = ({
  chartColumn,
  distinctColumn,
  normalizedLabel,
  normalizedType,
}) => {
  if (distinctColumn) {
    const label = getListAuditColumnLabel(distinctColumn);
    return normalizedType !== "all"
      ? `Distinct ${label} (${normalizedType})`
      : `Distinct ${label}`;
  }

  if (chartColumn && normalizedLabel) {
    const displayChartColumn = getListAuditColumnLabel(chartColumn);
    const displayLabel =
      normalizedLabel === AUDIT_EMPTY_FILTER_TOKEN
        ? AUDIT_EMPTY_LABEL
        : normalizedLabel === AUDIT_INVALID_STATUS_FILTER_TOKEN
          ? AUDIT_INVALID_STATUS_LABEL
          : normalizedLabel === ""
            ? "(empty)"
            : normalizedLabel;
    return `${displayChartColumn} = ${
      displayLabel
    }${normalizedType !== "all" ? ` (${normalizedType})` : ""}`;
  }

  if (normalizedType !== "all") {
    return `Data (${normalizedType})`;
  }

  return "Data";
};
