/*
 * PGH-DOC
 * File: src/Variables/Table/filters/search.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

const DATE_DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
export const SEARCH_INPUT_MAX_LENGTH = 200;

const stripControlCharacters = (value) =>
  String(value ?? "")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return (code >= 0 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127
        ? " "
        : char;
    })
    .join("");

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === "[object Object]";

const looksLikeDateString = (value) => {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return false;
  }

  return (
    /^\d{4}-\d{2}-\d{2}(?:[t\s].*)?$/i.test(raw) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(raw) ||
    /^\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4}$/i.test(raw)
  );
};

export const sanitizeSearchInput = (
  value,
  maxLength = SEARCH_INPUT_MAX_LENGTH,
) => {
  const normalized = stripControlCharacters(value)
    .replace(/\s+/g, " ");

  return normalized.length > maxLength
    ? normalized.slice(0, maxLength)
    : normalized;
};

export const normalizeSearchText = (value) =>
  sanitizeSearchInput(value)
    .trim()
    .toLowerCase();

const addToken = (bucket, value) => {
  const normalized = normalizeSearchText(value);

  if (normalized) {
    bucket.add(normalized);
  }
};

export const buildSearchTokens = (value) => {
  const tokens = new Set();

  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      buildSearchTokens(item).forEach((token) => tokens.add(token));
    });
    return Array.from(tokens);
  }

  if (isPlainObject(value)) {
    Object.values(value).forEach((item) => {
      buildSearchTokens(item).forEach((token) => tokens.add(token));
    });
    return Array.from(tokens);
  }

  const raw = String(value).trim();
  if (!raw) {
    return [];
  }

  addToken(tokens, raw);

  const numericValue =
    typeof value === "number"
      ? value
      : raw !== "" && !Number.isNaN(Number(raw))
        ? Number(raw)
        : null;

  if (numericValue !== null && Number.isFinite(numericValue)) {
    addToken(tokens, numericValue.toLocaleString("id-ID"));
    addToken(tokens, numericValue.toLocaleString("en-US"));
  }

  const dateValue =
    value instanceof Date
      ? value
      : looksLikeDateString(raw)
        ? new Date(raw)
        : null;

  if (dateValue && !Number.isNaN(dateValue.getTime())) {
    addToken(tokens, DATE_DISPLAY_FORMATTER.format(dateValue));
    addToken(tokens, dateValue.toISOString().slice(0, 10));
  }

  return Array.from(tokens);
};

export const cellMatchesSearch = (value, search) => {
  const normalizedSearch = normalizeSearchText(search);

  if (!normalizedSearch) {
    return true;
  }

  return buildSearchTokens(value).some((token) =>
    token.includes(normalizedSearch),
  );
};

export const rowMatchesSearch = ({
  row,
  search,
  columns = [],
  resolveColumnKey,
  excludedColumns = [],
}) => {
  const normalizedSearch = normalizeSearchText(search);

  if (!normalizedSearch) {
    return true;
  }

  const excluded = new Set(
    (excludedColumns || []).map((column) => String(column).trim().toLowerCase()),
  );

  const candidateColumns =
    Array.isArray(columns) && columns.length > 0 ? columns : Object.keys(row || {});

  const visitedKeys = new Set();

  return candidateColumns.some((column) => {
    const normalizedColumn = String(column ?? "").trim().toLowerCase();

    if (!normalizedColumn || excluded.has(normalizedColumn)) {
      return false;
    }

    const resolvedKey = resolveColumnKey?.(row, column) ?? column;
    if (!resolvedKey || visitedKeys.has(resolvedKey)) {
      return false;
    }

    visitedKeys.add(resolvedKey);
    return cellMatchesSearch(row?.[resolvedKey], normalizedSearch);
  });
};
