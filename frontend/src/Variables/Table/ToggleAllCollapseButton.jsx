/*
 * PGH-DOC
 * File: src/Variables/Table/ToggleAllCollapseButton.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useMemo } from "react";
import { Button } from "@pgh/ui-bootstrap";
import { PlusSquare, MinusSquare } from "react-feather";

const ToggleAllCollapseButton = ({
  flatData = [],
  collapseState = {},
   setCollapseState,
   treeData,
}) => {
  const allCollapsed = useMemo(() => {
    return (
      flatData.length > 0 &&
      flatData.every(
        (r) => !r.hasChildren || collapseState[r.__key]
      )
    );
  }, [flatData, collapseState]);

  const hasExpandableRows = useMemo(
    () => flatData.some((r) => r.hasChildren),
    [flatData]
  );

const handleToggleAll = () => {
  const shouldCollapse = !allCollapsed;

  const next = {};
  Object.keys(collapseState).forEach((key) => {
    next[key] = shouldCollapse;
  });

  setCollapseState(next);
};




  if (!hasExpandableRows) return null;

  return (
    <Button
      color="link"
      size="sm"
      className="p-0"
      onClick={handleToggleAll}
      title={allCollapsed ? "Expand all" : "Collapse all"}
    >
      {allCollapsed ? (
        <PlusSquare size={14} />
      ) : (
        <MinusSquare size={14} color="#e0591aff" />
      )}
    </Button>
  );
};

export default ToggleAllCollapseButton;
