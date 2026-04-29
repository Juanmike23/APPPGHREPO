/*
 * PGH-DOC
 * File: src/Variables/Table/ZoomControl.jsx
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
import { Row } from "@pgh/ui-bootstrap";
import {
  ChevronsDown,
  ChevronsUp,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
} from "react-feather";

const baseButtonStyle = {
  width: 38,
  height: 38,
  minWidth: 38,
  padding: 0,
};

const ZoomControl = ({
  setZoom,
  expanded,
  setExpanded,
  defaultZoom = 1,
  setFullscreen,
  onRefresh,
  refreshDisabled = false,
  onZoomIn,
  onZoomOut,
  onReset,
  onToggleExpand,
  hideButtons = [],
}) => {
  const hidden = (key) => hideButtons.includes(key);

  const handleZoomIn = () =>
    onZoomIn ? onZoomIn() : setZoom((value) => Math.min(value + 0.05, 2));
  const handleZoomOut = () =>
    onZoomOut ? onZoomOut() : setZoom((value) => Math.max(value - 0.05, 0.5));
  const handleReset = () => (onReset ? onReset() : setZoom(defaultZoom));
  const handleToggleExpand = () =>
    onToggleExpand ? onToggleExpand() : setExpanded((value) => !value);

  return (
    <Row className="zoom-control d-flex gap-2 flex-nowrap align-items-center justify-content-end mb-2 mt-2">
      {!hidden("refresh") && (
        <button
          type="button"
          className="table-header-action"
          style={baseButtonStyle}
          onClick={onRefresh}
          aria-label="Refresh table"
          disabled={refreshDisabled || typeof onRefresh !== "function"}
        >
          <RefreshCw size={16} />
        </button>
      )}

      {!hidden("expand") && (
        <button
          type="button"
          className={`table-header-action ${expanded ? "is-active" : ""}`}
          style={baseButtonStyle}
          onClick={handleToggleExpand}
          aria-label={expanded ? "Collapse table" : "Expand table"}
        >
          {expanded ? <ChevronsUp size={16} /> : <ChevronsDown size={16} />}
        </button>
      )}

      {!hidden("zoom") && (
        <>
          <button
            type="button"
            className="table-header-action"
            style={baseButtonStyle}
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            className="table-header-action"
            style={baseButtonStyle}
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
        </>
      )}

      {!hidden("reset") && (
        <button
          type="button"
          className="table-header-action"
          style={baseButtonStyle}
          onClick={handleReset}
          aria-label="Reset zoom"
        >
          <RotateCcw size={16} />
        </button>
      )}

      {!hidden("fullscreen") && (
        <button
          type="button"
          className="table-header-action"
          style={baseButtonStyle}
          onClick={() => setFullscreen((value) => !value)}
          aria-label="Toggle fullscreen"
        >
          <Maximize2 size={16} />
        </button>
      )}
    </Row>
  );
};

export default ZoomControl;
