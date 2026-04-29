/*
 * PGH-DOC
 * File: src/Variables/Cells/CellConfig.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useState, useMemo, useEffect } from "react";

// Utility: unique key for each cell
export const getCellKey = (rowIdx, col) => `${rowIdx}|${col}`;

// Row span calculation for merged cells
const getMultiColumnRowSpanMap = (
  data,
  mergeColumns,
  unmergedSet,
  autoMerge
) => {
  const result = {};

  mergeColumns.forEach((col) => {
    let lastValue = null;
    let count = 0;
    let startIndex = 0;
    result[col] = {};

    data.forEach((row, idx) => {
      if (row.isGroupHeader) {
        // ✅ Don't merge group headers
        result[col][idx] = { rowSpan: 1 };
        lastValue = null;
        count = 0;
        startIndex = idx + 1;
        return;
      }

      const cellKey = `${idx}|${col}`;
      const currentValue = row[col]?.toString().trim();

      const spanBlocked = () => {
        for (let i = startIndex; i < idx; i++) {
          if (unmergedSet.has(`${i}|${col}`)) return true;
        }
        return unmergedSet.has(cellKey);
      };

      const allowMerge = autoMerge && !unmergedSet.has(cellKey);

      if (
        currentValue === lastValue &&
        currentValue !== "" &&
        currentValue !== undefined &&
        !spanBlocked() &&
        allowMerge
      ) {
        count++;
        result[col][startIndex].rowSpan = count;
        result[col][idx] = { skip: true };
      } else {
        lastValue = currentValue;
        count = 1;
        startIndex = idx;
        result[col][idx] = { rowSpan: 1 };
      }
    });
  });

  return result;
};

// 🔧 Main hook
const useCellMerging = (groupedData, derivedColumns, containerRef) => {

  const [unmergedCells, setUnmergedCells] = useState(new Set());
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [lastSelectedCell, setLastSelectedCell] = useState(null);
  const [autoMergeEnabled, setAutoMergeEnabled] = useState(false);

  const mergedColumns = useMemo(
    () => derivedColumns.filter((col) => col !== "Action"),
    [derivedColumns]
  );

  const rowSpanMap = useMemo(() => {
    return getMultiColumnRowSpanMap(
      groupedData,
      mergedColumns,
      unmergedCells,
      autoMergeEnabled
    );
  }, [groupedData, mergedColumns, unmergedCells, autoMergeEnabled]);

  const mergeSelectedCells = () => {
    setUnmergedCells((prev) => {
      const next = new Set(prev);
      selectedCells.forEach((key) => next.delete(key));
      return next;
    });
  };

  const unmergeSelectedCells = () => {
    setUnmergedCells((prev) => {
      const next = new Set(prev);
      selectedCells.forEach((cellKey) => {
        const [rowIdx, col] = cellKey.split("|");
        const rowSpan = rowSpanMap[col]?.[+rowIdx]?.rowSpan || 1;

        for (let i = +rowIdx; i < +rowIdx + rowSpan; i++) {
          next.add(`${i}|${col}`);
        }
      });
      return next;
    });
  };

  // useEffect(() => {
  //   if (unmergedCells.size === 0) {
  //     console.log("✅ All cells are currently merged.");
  //   } else {
  //     console.log("❌ There are unmerged cells:", Array.from(unmergedCells));
  //   }
  // }, [unmergedCells]);

useEffect(() => {
  const handleClickOutside = (event) => {
    if (
      containerRef?.current &&
      !containerRef.current.contains(event.target)
    ) {
      // ✅ Optionally clear selection if clicked outside
      setSelectedCells(new Set());
      setLastSelectedCell(null);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [containerRef]);


  return {
    getCellKey,
    unmergedCells,
    selectedCells,
    setSelectedCells,
    lastSelectedCell,
    setLastSelectedCell,
    autoMergeEnabled,
    setAutoMergeEnabled,
    rowSpanMap,
    mergeSelectedCells,
    unmergeSelectedCells,
  };
};

export default useCellMerging;
