/*
 * PGH-DOC
 * File: src/Components/Human/shared/departmentCanonical.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const HUMAN_DEPARTMENT_CODES = ["TSC", "CBS", "DCP", "BOA", "IDS"];

const DEPARTMENT_ALIASES = [
  { pattern: "TSC", code: "TSC" },
  { pattern: "TESTING", code: "TSC" },
  { pattern: "TEST", code: "TSC" },
  { pattern: "QUALITY ASSURANCE", code: "TSC" },
  { pattern: "CBS", code: "CBS" },
  { pattern: "CORE", code: "CBS" },
  { pattern: "CORE BANKING", code: "CBS" },
  { pattern: "DCP", code: "DCP" },
  { pattern: "PAYMENT", code: "DCP" },
  { pattern: "PAYMENTS", code: "DCP" },
  { pattern: "DIGITAL CHANNEL", code: "DCP" },
  { pattern: "CHANNEL", code: "DCP" },
  { pattern: "BOA", code: "BOA" },
  { pattern: "OPERATION", code: "BOA" },
  { pattern: "OPERATIONS", code: "BOA" },
  { pattern: "ONBOARDING", code: "BOA" },
  { pattern: "IDS", code: "IDS" },
  { pattern: "DATA", code: "IDS" },
  { pattern: "INFORMATION DATA", code: "IDS" },
];

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

export const canonicalizeHumanDepartment = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  if (HUMAN_DEPARTMENT_CODES.includes(normalized)) {
    return normalized;
  }

  const matched = DEPARTMENT_ALIASES.find(({ pattern }) =>
    normalized.includes(pattern),
  );

  return matched?.code ?? "";
};

export const HUMAN_DEPARTMENT_SUGGESTIONS_BY_COLUMN = {
  Department: [...HUMAN_DEPARTMENT_CODES],
  DivisiDepartment: [...HUMAN_DEPARTMENT_CODES],
};

