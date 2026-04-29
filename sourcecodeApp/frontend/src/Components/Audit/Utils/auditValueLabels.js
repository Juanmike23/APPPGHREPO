/*
 * PGH-DOC
 * File: src/Components/Audit/Utils/auditValueLabels.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const AUDIT_EMPTY_LABEL = "Belum Diisi";
export const AUDIT_INVALID_STATUS_LABEL = "Status Tidak Valid";
export const AUDIT_EMPTY_FILTER_TOKEN = "__EMPTY__";
export const AUDIT_INVALID_STATUS_FILTER_TOKEN = "__INVALID_STATUS__";

const EMPTY_ALIASES = new Set([
  "",
  "-",
  "unknown",
  AUDIT_EMPTY_FILTER_TOKEN.toLowerCase(),
  "belum diisi",
  "data belum diisi",
  "kosong",
  "empty",
  "null",
  "undefined",
  "n/a",
  "na",
]);

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const normalizeStatusToken = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ");

export const isAuditEmptyValue = (value) =>
  EMPTY_ALIASES.has(normalizeText(value).toLowerCase());

export const getAuditDisplayValue = (value, fallback = AUDIT_EMPTY_LABEL) => {
  const text = normalizeText(value);
  return isAuditEmptyValue(text) ? fallback : text;
};

export const getAuditChartLabel = (value, chartColumn) => {
  const normalizedColumn = String(chartColumn ?? "").trim().toUpperCase();
  if (normalizedColumn === "STATUS") {
    return getAuditStatusDisplayLabel(value);
  }

  return getAuditDisplayValue(value);
};

export const normalizeAuditStatusCategory = (value) => {
  const normalized = normalizeStatusToken(value);

  if (EMPTY_ALIASES.has(normalized)) return "unknown";
  if (normalized === "open" || normalized.includes("belum")) return "open";
  if (
    normalized === "in progress" ||
    normalized === "inprogress" ||
    normalized === "progress" ||
    normalized === "berjalan"
  ) {
    return "inprogress";
  }
  if (
    normalized === "closed" ||
    normalized === "close" ||
    normalized === "selesai" ||
    normalized === "done"
  ) {
    return "closed";
  }

  return "invalid";
};

export const getAuditStatusDisplayLabel = (value) => {
  switch (normalizeAuditStatusCategory(value)) {
    case "open":
      return "Open";
    case "inprogress":
      return "In Progress";
    case "closed":
      return "Closed";
    case "unknown":
      return AUDIT_EMPTY_LABEL;
    default:
      return AUDIT_INVALID_STATUS_LABEL;
  }
};

export const toAuditFilterValue = (value, { chartColumn } = {}) => {
  const normalizedColumn = String(chartColumn ?? "").trim().toUpperCase();
  const text = normalizeText(value);

  if (isAuditEmptyValue(text)) {
    return AUDIT_EMPTY_FILTER_TOKEN;
  }

  if (
    normalizedColumn === "STATUS" &&
    normalizeAuditStatusCategory(text) === "invalid"
  ) {
    return AUDIT_INVALID_STATUS_FILTER_TOKEN;
  }

  return text;
};
