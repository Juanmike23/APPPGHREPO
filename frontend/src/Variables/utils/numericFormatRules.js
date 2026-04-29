/*
 * PGH-DOC
 * File: src/Variables/utils/numericFormatRules.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// utils/numericFormatRules.js

export const isNonFormattableColumn = (column) => {
  if (!column) return false;
  return /(^|_)(year|id|no|seq|index|Tahun|NPP|MataAnggaranParent|MataAnggaranChild)($|_)/i.test(column);
};

const normalizeEndpointToken = (value) =>
  String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

const normalizeColumnToken = (value) =>
  String(value ?? "").replace(/\s+/g, "").trim().toUpperCase();

const isPlanningOpexEndpoint = (endpointName) => {
  const endpoint = normalizeEndpointToken(endpointName);
  return endpoint === "opextemplate" || endpoint === "opex";
};

const OPEX_TEMPLATE_PERCENTAGE_COLUMNS = new Set([
  "GROWTH",
  "TOANGTHISYEAR",
  "TOANGYTDTHISYEAR",
]);

export const isPercentageColumn = (column) => {
  if (!column) return false;
  const normalized = normalizeColumnToken(column);
  if (OPEX_TEMPLATE_PERCENTAGE_COLUMNS.has(normalized)) {
    return true;
  }

  return /(percent|percentage|persen|progresspercent|allocationpercentage|growthpercentage|runrate)/i.test(
    String(column),
  );
};

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

const OPEX_TEMPLATE_NUMERIC_DISPLAY_OPTIONS = Object.freeze({
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const OPEX_TEMPLATE_PERCENTAGE_DISPLAY_OPTIONS = Object.freeze({
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const isEndpointPercentageColumn = ({ endpointName, column }) => {
  const endpoint = normalizeEndpointToken(endpointName);
  const normalizedColumn = normalizeColumnToken(column);

  if (
    isPlanningOpexEndpoint(endpoint) &&
    OPEX_TEMPLATE_PERCENTAGE_COLUMNS.has(normalizedColumn)
  ) {
    return true;
  }

  return isPercentageColumn(column);
};

export const getNumericDisplayOptions = ({ endpointName, column }) => {
  const endpoint = normalizeEndpointToken(endpointName);
  const normalizedColumn = normalizeColumnToken(column);

  if (
    isPlanningOpexEndpoint(endpoint) &&
    OPEX_TEMPLATE_PERCENTAGE_COLUMNS.has(normalizedColumn)
  ) {
    return OPEX_TEMPLATE_PERCENTAGE_DISPLAY_OPTIONS;
  }

  if (
    isPlanningOpexEndpoint(endpoint) &&
    OPEX_TEMPLATE_NUMERIC_COLUMNS.has(normalizedColumn)
  ) {
    return OPEX_TEMPLATE_NUMERIC_DISPLAY_OPTIONS;
  }

  return null;
};

