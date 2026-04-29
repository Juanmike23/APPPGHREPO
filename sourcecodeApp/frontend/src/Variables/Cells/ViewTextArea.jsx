/*
 * PGH-DOC
 * File: src/Variables/Cells/ViewTextArea.jsx
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
import {
  isNumericValue,
  isPercentageValue,
  formatNumericValue,
  formatNumericCompactMillion,
} from "../utils/numericformat";
import {
  isNonFormattableColumn,
  isPercentageColumn,
} from "../utils/numericFormatRules";

const hasExplicitPercentageSymbol = (value) =>
  typeof value === "string" && String(value).trim().endsWith("%");

const toDisplayPercentage = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).replace("%", "").replace(",", ".").trim();
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return String(value);
  return `${numeric.toFixed(2)}%`;
};

const TextCellView = ({
  value,
  column,
  enableMillionFormat = false,
  style = {},
  onClick,
}) => {
  const shouldFormatNumber = (value, column) => {
    if (!isNumericValue(value)) return false;
    if (isNonFormattableColumn(column)) return false;
    return true;
  };

  let displayValue = value ?? "";

  if (
    hasExplicitPercentageSymbol(value) ||
    (isPercentageColumn(column) &&
      (isPercentageValue(value) || isNumericValue(value)))
  ) {
    displayValue = toDisplayPercentage(value);
  } else if (shouldFormatNumber(value, column)) {
    displayValue = enableMillionFormat
      ? formatNumericCompactMillion(value)
      : formatNumericValue(value);
  }

  return (
    <div
      className="text-cell-view"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "1em",

        background: "transparent",
        border: "none",

        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere",

        lineHeight: "1.2",
        fontSize: "14px",
        color: "inherit",

        cursor: onClick ? "text" : "default",
        ...style,
      }}
    >
      {displayValue}
    </div>
  );
};

export default React.memo(TextCellView);
