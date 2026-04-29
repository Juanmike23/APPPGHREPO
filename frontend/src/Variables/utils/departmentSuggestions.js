/*
 * PGH-DOC
 * File: src/Variables/utils/departmentSuggestions.js
 * Apa fungsi bagian ini:
 * - Menyediakan seed suggestion global untuk kolom department lintas unit.
 * Kenapa perlu:
 * - Menghindari duplikasi suggestion per halaman dan menjaga konsistensi input.
 * Aturan khususnya apa:
 * - Selalu gabungkan seed global dengan nilai real data tabel.
 * - Jika kode department resmi berubah, update hanya di file ini.
 */

const GLOBAL_DEPARTMENT_CODES = ["TSC", "CBS", "DCP", "BOA", "IDS"];

const NORMALIZED_DEPARTMENT_TOKENS = new Set([
  "DEPARTMENT",
  "DIVISIDEPARTMENT",
  "DIVISI/DEPARTMENT",
  "DEPT",
]);

const normalizeToken = (value) =>
  String(value ?? "")
    .replace(/[_\s]+/g, "")
    .trim()
    .toUpperCase();

export const getGlobalDepartmentSuggestions = (column) => {
  const normalized = normalizeToken(column);
  if (!NORMALIZED_DEPARTMENT_TOKENS.has(normalized)) {
    return [];
  }

  return [...GLOBAL_DEPARTMENT_CODES];
};

