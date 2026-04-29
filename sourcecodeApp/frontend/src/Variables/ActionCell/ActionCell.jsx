/*
 * PGH-DOC
 * File: src/Variables/ActionCell/ActionCell.jsx
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
import { Eye } from "react-feather";
import { useNavigate } from "react-router-dom";

import ChangeLogModal from "./ChangeLogModal";
import ParentRowModal from "./APSParentRowModal";

const ActionCell = ({
  row,
  keys = [],
  onStatusClick,
  endpointName,
  onParentFilter,
  onNavigateToChange,
  source,
}) => {
  const navigate = useNavigate();

  const isTotalLabel = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase() === "total";

  const sourceToken = String(source ?? "")
    .trim()
    .toLowerCase();

  const buildViewDetailTarget = () => {
    if (sourceToken === "humansummaryfte") {
      const label = row?.JenjangJabatan;
      if (!label || isTotalLabel(label)) return null;
      const query = new URLSearchParams({
        tab: "fte",
        chartcolumn: "JenjangJabatan",
        label: String(label),
      });
      return `${process.env.PUBLIC_URL}/human/resource?${query.toString()}`;
    }

    if (sourceToken === "humansummarymanmonth") {
      const label = row?.ManmonthManagedService;
      if (!label || isTotalLabel(label)) return null;
      const query = new URLSearchParams({
        tab: "nonfte",
        chartcolumn: "ManmonthManagedService",
        label: String(label),
      });
      return `${process.env.PUBLIC_URL}/human/resource?${query.toString()}`;
    }

    if (!row?.Id) return null;
    return `${process.env.PUBLIC_URL}/audit/listAudit?rowId=${encodeURIComponent(row.Id)}`;
  };

  const detailTarget = buildViewDetailTarget();
  const detailTitle =
    sourceToken === "humansummaryfte" || sourceToken === "humansummarymanmonth"
      ? "Lihat detail di Resource"
      : "Lihat detail di Audit List";

  return (
    <div
      className="d-flex gap-2 justify-content-center align-items-center"
      style={{ width: "100%", minHeight: 24 }}
    >
      {keys.includes("viewdetail") && (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center"
          title={detailTitle}
          disabled={!detailTarget}
          onClick={() => {
            if (!detailTarget) return;
            navigate(detailTarget);
          }}
          style={{ padding: "4px 8px", lineHeight: 1 }}
        >
          <Eye size={14} />
        </button>
      )}

      {keys.includes("status") && (
        <i
          className="icon-check-box"
          title="Status Pengadaan"
          style={{
            cursor: "pointer",
            opacity: 1,
            color: "#898989",
            transition: "all 0.2s ease",
          }}
          onClick={() => onStatusClick?.(row.Id, row)}
          onMouseOver={(event) => {
            event.currentTarget.style.opacity = "0.7";
            event.currentTarget.style.color = "#f15a22";
          }}
          onMouseOut={(event) => {
            event.currentTarget.style.opacity = "1";
            event.currentTarget.style.color = "#898989";
          }}
        />
      )}

      {keys.includes("status_penga") && (
        <i
          className="icon-check-box"
          title="Status Pengadaan"
          style={{
            cursor: "pointer",
            opacity: 1,
            color: "#898989",
            transition: "all 0.2s ease",
          }}
          onClick={() => onStatusClick?.(row.Id, row)}
          onMouseOver={(event) => {
            event.currentTarget.style.opacity = "0.7";
            event.currentTarget.style.color = "#f15a22";
          }}
          onMouseOut={(event) => {
            event.currentTarget.style.opacity = "1";
            event.currentTarget.style.color = "#898989";
          }}
        />
      )}

      {keys.includes("logtrail") && (
        <ChangeLogModal
          tableName={endpointName}
          recordId={row.Id}
          showLastUpdated={false}
          onNavigateToChange={onNavigateToChange}
        />
      )}

      {keys.includes("parentrow") && (
        <ParentRowModal
          source={row.Source || source}
          tableName={endpointName}
          recordId={row.Id}
          title={row.Perjanjian || row.Judul}
          showLastUpdated
          onApplyFilter={onParentFilter}
        />
      )}
    </div>
  );
};

export default ActionCell;
