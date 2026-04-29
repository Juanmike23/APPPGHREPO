/*
 * PGH-DOC
 * File: src/Variables/Table/filters/normalize.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const normalizeData = (sourceData) => {
  const extraKeys = new Set();

  const normalized = sourceData.map((row) => {
    const flat = { ...row };

    if (row.ExtraData) {
      let parsed = row.ExtraData;

      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          parsed = {};
        }
      }

      Object.entries(parsed).forEach(([k, v]) => {
        if (String(k ?? "").startsWith("__")) {
          return;
        }
        flat[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
        extraKeys.add(k);
      });

      delete flat.ExtraData;
    }

    return flat;
  });

  return {
    normalizedData: normalized,
    extraColumns: [...extraKeys],
  };
};
