/*
 * PGH-DOC
 * File: src/Variables/utils/useColumnSort.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// useColumnSort.js
import { useState, useMemo } from "react";

export default function useColumnSort(data) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const safeData = Array.isArray(data) ? data : []; // ✅ guard against undefined

  const handleSort = (col) => {
    setSortConfig((prev) => {
      if (prev.key === col) {
        if (prev.direction === "asc") return { key: col, direction: "desc" };
        if (prev.direction === "desc") return { key: null, direction: null };
      }
      return { key: col, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return safeData;

    return [...safeData].sort((a, b) => {
      const valA = a?.[sortConfig.key];
      const valB = b?.[sortConfig.key];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      return sortConfig.direction === "asc"
        ? valA > valB
          ? 1
          : -1
        : valA < valB
        ? 1
        : -1;
    });
  }, [safeData, sortConfig]);

  return { sortedData, sortConfig, handleSort };
}
