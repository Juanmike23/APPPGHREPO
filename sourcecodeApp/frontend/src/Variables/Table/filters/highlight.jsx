/*
 * PGH-DOC
 * File: src/Variables/Table/filters/highlight.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const renderHighlightedText = (value, query) => {
  const text = String(value ?? "");
  const normalizedQuery = String(query ?? "").trim();

  if (!text || !normalizedQuery) {
    return text;
  }

  const matcher = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "ig");
  const parts = text.split(matcher);

  if (parts.length <= 1) {
    return text;
  }

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedQuery.toLowerCase() ? (
      <mark
        key={`${part}-${index}`}
        style={{
          backgroundColor: "rgba(241, 90, 34, 0.2)",
          color: "inherit",
          padding: "0 0.08em",
          borderRadius: "0.2rem",
        }}
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ),
  );
};
