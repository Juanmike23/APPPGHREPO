/*
 * PGH-DOC
 * File: src/Components/Audit/Timeline/TimelineTabs.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

  import React from "react";
  import {
    Grid,
    Info,
    Clock,
    CheckCircle,
    AlertTriangle,
  } from "react-feather";

const BOTTOM_TABS = [
  {
    key: "open",
    label: "Open",
    icon: Info,
    color: "#fff1e8",
    colorActive: "#f15a22",
  },
  {
    key: "inprogress",
    label: "In Progress",
    icon: Clock,
    color: "#fef3c7",
    colorActive: "#f59e0b",
  },
  {
    key: "closed",
    label: "Closed",
    icon: CheckCircle,
    color: "#dcfce7",
    colorActive: "#22c55e",
  },
  {
    key: "anomaly",
    label: "Status Tidak Valid",
    icon: AlertTriangle,
    color: "#fee2e2",
    colorActive: "#ef4444",
  },
];


  export default function TimelineTabs({  counts ,  isAllActive,
  activeStatuses,
  
  onAllClick,
  onStatusToggle, }) {
    
const isStatusActive = (k) => activeStatuses.has(k);

    const baseBtn = {
      cursor: "pointer",
      userSelect: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      transition: "background 0.15s ease",
    };

    return (
      <div
        style={{
          border: "1px solid #d6d6d6",
          borderRadius: "16px",
          overflow: "hidden",
          background: "#eef3f6",
          width: "100%",
          fontFamily: "inherit",
          
        }}
      >
        {/* ALL */}
     <div
  role="button"
  onClick={onAllClick}
  style={{
    ...baseBtn,
    padding: "4px",
    paddingTop:"4px",
    fontWeight: isAllActive ? 700 : 500,
    background: isAllActive ? "#dde5ea" : "transparent",
  }}
>
  <Grid size={14} />
  All ({counts.all ?? 0})
</div>


        {/* DIVIDER */}
        <div
          style={{
            height: "1px",
            background: "#cfd8dd",
          }}
        />

        {/* BOTTOM ROW */}
        <div className="mb-3">
        <div style={{ display: "flex",}}>
      {BOTTOM_TABS.map(({ key, label, icon: Icon, color, colorActive }, i) => {
  const active = isStatusActive(key);

  return (
    <div
      key={key}
      role="button"
      onClick={() => onStatusToggle(key)}
      style={{
        ...baseBtn,
        padding: "4px 8px",
        flex: 1,
        fontSize: "14px",
        fontWeight: active ? 600 : 400,
        background: active ? colorActive : color,
        color: active ? "#fff" : "#000",
        opacity: isAllActive ? 0.4 : 1,
        
        borderRight:
          i !== BOTTOM_TABS.length - 1
            ? "1px solid #cfd8dd"
            : "none",
      }}
    >
      <Icon size={13} />
      {label} ({counts[key] ?? 0})
    </div>
  );
})}

        </div>
        </div>
      </div>
    );
  }
