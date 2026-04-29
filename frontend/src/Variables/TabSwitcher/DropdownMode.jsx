/*
 * PGH-DOC
 * File: src/Variables/TabSwitcher/DropdownMode.jsx
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
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "@pgh/ui-bootstrap";

const DropdownMode = ({
  value,
  options = [],
  onChange,
  variant = "pill",
  active = false,
  textColor = null,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const current = options.find((o) => o.key === value);

  return (
    <div
      onMouseEnter={() => setDropdownOpen(true)}
      onMouseLeave={() => setDropdownOpen(false)}
      style={{ display: "inline-block" }}
    >
        <Dropdown
        isOpen={dropdownOpen}
        toggle={() => setDropdownOpen((v) => !v)}
        direction="down"
      >
     
<DropdownToggle
  caret
  color={variant === "pill" ? "transparent" : "light"}
  container="body"
  className={
    variant === "pill"
      ? "badge bg-transparent rounded-pill dashboard-pill-subtoggle"
      : "dashboard-pill-subtoggle"
  }
  style={{
    border: "none",
    padding: "2px 6px",
    display: "flex",
    alignItems: "center", // ✅ ensures icon+label+caret are aligned
    gap: "4px",
    backgroundColor: "transparent",
    backgroundImage: "none",
    borderColor: "transparent",
    boxShadow: "none",
    color: textColor ?? (active ? "#fff" : "#b84a1c"),
  }}
>
 {current?.icon && (
  <current.icon style={{ width: "14px", height: "14px" }} />
)}
  <span>{current?.label ?? "Select"}</span>
</DropdownToggle>

        <DropdownMenu
          container="body"
          className="dashboard-pill-submenu"
          style={{ minWidth: "140px" }}
        >
          {options.map((opt) => {
            const Icon = opt.icon;

            return (
              <DropdownItem
                key={opt.key}
                onClick={() => onChange(opt.key)}
                className="d-flex align-items-center gap-2 dashboard-pill-submenu-item"
              >
                {/* ✅ ICON + LABEL in menu */}
               {Icon && <Icon size={14} />}
                <span> {opt.label}</span>
              </DropdownItem>
            );
          })}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
};

export default DropdownMode;
