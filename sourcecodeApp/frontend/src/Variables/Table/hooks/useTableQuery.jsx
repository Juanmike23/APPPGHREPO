/*
 * PGH-DOC
 * File: src/Variables/Table/hooks/useTableQuery.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useMemo } from "react";
import { normalizeData } from "../filters/normalize";
import { applyFilters } from "../filters/applyFilters";
import { buildDistinctData } from "../filters/distinct";

export const useTableQuery = ({
  data,
  search,
  filters,
  distinct,
}) => {
  const { normalizedData, extraColumns } = useMemo(
    () => normalizeData(data),
    [data]
  );

  const sourceData = useMemo(() => {
    if (!distinct?.column) return normalizedData;
    return buildDistinctData(normalizedData, distinct.column);
  }, [normalizedData, distinct]);

  const filteredData = useMemo(() => {
    return applyFilters({
      data: sourceData,
      search,
      filters: filters?.filters,
      mode: filters?.mode,
    });
  }, [sourceData, search, filters]);

  return {
    filteredData,
    extraColumns,
  };
};
