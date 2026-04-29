/*
 * PGH-DOC
 * File: src/Variables/Table/filters/applyFilters.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { compare } from "./compare";
import { resolveColumnKey } from "./utils";
import { rowMatchesSearch } from "./search";

export const applyFilters = ({
  data,
  search,
  filters = [],
  mode = "and",
  searchableColumns = [],
  excludedSearchColumns = [],
}) => {
  return data.filter((row) => {
    if (
      !rowMatchesSearch({
        row,
        search,
        columns: searchableColumns,
        resolveColumnKey,
        excludedColumns: excludedSearchColumns,
      })
    ) {
      return false;
    }

    if (!filters.length) return true;

    const test = (f) => {
      const key = resolveColumnKey(row, f.column);
      if (!key) return false;
      return compare(row[key], f.operator, f.value);
    };

    return mode === "and"
      ? filters.every(test)
      : filters.some(test);
  });
};
