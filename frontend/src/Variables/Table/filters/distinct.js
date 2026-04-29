/*
 * PGH-DOC
 * File: src/Variables/Table/filters/distinct.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const buildDistinctData = (
  data,
  column,
  blobColumns = new Set()
) => {
  if (!column) return null;

  const map = {};
  const total = { Total: 0 };

  data.forEach((row) => {
    const key = row[column];
    if (key == null) return;

    map[key] ??= {
      [column]: key,
      __counts: {},
      Total: 0,
    };

    Object.entries(row).forEach(([col, val]) => {
      if (col === "Id" || blobColumns.has(col)) return;

      const v =
        val === null || val === "" ? "__EMPTY__" : val;

      map[key].__counts[col] ??= {};
      map[key].__counts[col][v] =
        (map[key].__counts[col][v] || 0) + 1;
    });

    map[key].Total++;
    total.Total++;
  });

  return Object.values(map).map((g) => ({
    ...g,
    Total: g.Total,
  }));
};
