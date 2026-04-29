/*
 * PGH-DOC
 * File: src/Variables/Table/TableCollapse.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useState } from "react";
import { Table } from "@pgh/ui-bootstrap";

const estimateColumnWidth = (
  col,
  rows,
  averageCharWidth = 8,
  padding = 40,
  maxWidth = 350
) => {
  if (!rows || rows.length === 0) return "150px";
  const values = rows.map((row) => `${row[col] ?? ""}`);
  const longestValue = values.reduce(
    (a, b) => (a.length > b.length ? a : b),
    ""
  );
  const base = Math.max(col.length, longestValue.length);
  const calculated = base * averageCharWidth + padding;
  return `${Math.min(calculated, maxWidth)}px`;
};

const TableCollapse = ({ rows = [], allColumns = [], onEdit }) => {
  const [openRows, setOpenRows] = useState({});

  const levelColors = {
    0: { bg: "#333f4f", color: "white" },
    1.5: { bg: "#8496b0", color: "white" },
    2: { bg: "#eef6ff", color: "black" },
    default: { bg: "#ffffff", color: "black" },
  };

  const toggleRow = (id) => {
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const visibleColumns = (allColumns || []).filter((c) => c !== "Id");

  const renderRow = (row, level = 0) => {
    const isSecondParent =
      [
        "Beban Kantor",
        "Beban Teknologi & Telekomunikasi",
        "Beban Penyusutan dan Amortisasi",
      ].includes(row.MataAnggaranParent);

    const appliedLevel = isSecondParent ? 1.5 : level;
    const styleDef = levelColors[appliedLevel] || levelColors.default;
    const hasChildren = row.children && row.children.length > 0;
    const isOpen = openRows[row.ID];

    return (
      <React.Fragment key={row.ID}>
        <tr
          style={{
            backgroundColor: styleDef.bg,
            color: styleDef.color,
          }}
        >
          {/* Always show collapse column */}
          <td
            style={{
              width: "40px",
              textAlign: "center",
              verticalAlign: "middle",
              backgroundColor: styleDef.bg,
              color: styleDef.color,
            }}
          >
            <button
              onClick={() => hasChildren && toggleRow(row.ID)}
              style={{
                border: "none",
                background: "transparent",
                cursor: hasChildren ? "pointer" : "default",
                color: styleDef.color,
                fontSize: "14px",
                opacity: hasChildren ? 1 : 0.3, // faded for leaf nodes
              }}
            >
              {hasChildren ? (isOpen ? "▼" : "▶") : "▶"}
            </button>
          </td>

          {visibleColumns.map((col) => (
            <td
              key={col}
              style={{
                paddingLeft:
                  col === "MataAnggaranParent"
                    ? `${appliedLevel * 20 + 10}px`
                    : undefined,
                backgroundColor: styleDef.bg,
                color: styleDef.color,
                fontWeight: appliedLevel === 0 ? "bold" : "normal",
              }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => onEdit?.(row.ID, col, e.target.textContent)}
            >
              {row[col]}
            </td>
          ))}
        </tr>

        {/* Recursively render children if open */}
        {isOpen &&
          hasChildren &&
          row.children.map((child) =>
            renderRow(child, isSecondParent ? 2 : level + 1)
          )}
      </React.Fragment>
    );
  };

  if (!rows || rows.length === 0) {
    return <div>No data available</div>;
  }

  return (
    <div style={{ maxHeight: "70vh", overflowY: "auto", overflowX: "auto" }}>
      <Table bordered hover responsive>
        <thead>
          <tr>
            <th style={{ width: "40px", textAlign: "center" }}>▶</th>
            {visibleColumns.map((col) => (
              <th key={col} style={{ width: estimateColumnWidth(col, rows) }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((row) => renderRow(row))}</tbody>
      </Table>
    </div>
  );
};

export default TableCollapse;
