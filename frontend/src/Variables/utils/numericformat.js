/*
 * PGH-DOC
 * File: src/Variables/utils/numericformat.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// ✅ Check if a value is numeric (ignoring spaces, dots, or commas)
// export const isNumericValue = (val) => {
//   if (val === null || val === undefined) return false;
//   const num = String(val).replace(/[.,\s]/g, "");
//   return /^\d+$/.test(num);
// };

// // ✅ Format only if numeric string is longer than 5 digits
// export const formatNumericValue = (val) => {
//   if (val === null || val === undefined || val === "") return "";

//   const num = String(val).replace(/[^\d]/g, "");
//   const intVal = parseInt(num, 10);

//   // 🧠 Only format if number length > 5 (e.g. > 99,999)
//   if (num.length <= 4) return String(intVal);

//   return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// };

// utils/numericformat.js
export const isPercentageValue = (val) => {
  if (val === null || val === undefined) return false;

  const str = String(val).trim();

  // ±xx.xx or ±xx.x
  return /^-?\d+\.\d{1,2}$/.test(str);
};

const parseFlexibleNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const compact = String(value).trim().replace(/\s+/g, "");
  if (!compact) return null;

  if (compact.includes(".") && compact.includes(",")) {
    const normalized = compact.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (compact.includes(",")) {
    const parsed = Number(compact.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (compact.includes(".")) {
    if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
      const parsedThousands = Number(compact.replace(/\./g, ""));
      return Number.isFinite(parsedThousands) ? parsedThousands : null;
    }

    const parsedDecimal = Number(compact);
    if (Number.isFinite(parsedDecimal)) return parsedDecimal;

    const parsedFallback = Number(compact.replace(/\./g, ""));
    return Number.isFinite(parsedFallback) ? parsedFallback : null;
  }

  const parsed = Number(compact);
  return Number.isFinite(parsed) ? parsed : null;
};


export const isNumericValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return true;

  if (typeof value === "string") {
    // allow: 1000 | 1.000 | 19.17 | -12.5
    return /^-?\d+([.,]\d+)?$/.test(value.trim());
  }

  return false;
};

export const formatPercentageValue = (value, decimals = 2) => {
  if (value === null || value === undefined) return "";

  const num =
    typeof value === "number"
      ? value
      : Number(String(value).replace(",", "."));

  if (isNaN(num)) return value;

  return `${num.toFixed(decimals)}%`;
};


const clampFractionDigits = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(12, Math.trunc(parsed)));
};

export const formatNumericValue = (value, options = {}) => {
  if (value === null || value === undefined) return "";
  const num = parseFlexibleNumber(value);
  if (num === null) return value;

  const safeOptions =
    options && typeof options === "object" ? options : {};
  const hasFraction = !Number.isInteger(num);
  const maximumFractionDigits = clampFractionDigits(
    safeOptions.maximumFractionDigits,
    hasFraction ? 4 : 0,
  );
  const minimumFractionDigits = clampFractionDigits(
    safeOptions.minimumFractionDigits,
    0,
  );
  const useGrouping =
    typeof safeOptions.useGrouping === "boolean"
      ? safeOptions.useGrouping
      : true;

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: Math.min(minimumFractionDigits, maximumFractionDigits),
    maximumFractionDigits,
    useGrouping,
  }).format(num);
};

export const parseNumericValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;

  return parseFlexibleNumber(value);
};


export const formatNumericCompactMillion = (value, decimals = 0) => {
  if (value === null || value === undefined) return "";

  const num = parseFlexibleNumber(value);
  if (num === null) return value;

  // Only scale if >= 1,000,000 (7 digits)
  if (Math.abs(num) < 1_000_000) {
    const hasFraction = !Number.isInteger(num);
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: hasFraction ? 4 : 0,
    }).format(num);
  }

  const scaled = num / 1_000_000;

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(scaled);
};
