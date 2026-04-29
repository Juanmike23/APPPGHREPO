/*
 * PGH-DOC
 * File: src/Variables/TabSwitcher/FilterTahun.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// FilterTahun.jsx
import React, { useState, useMemo } from "react";
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from "@pgh/ui-bootstrap";

const FilterTahun = ({ value, onChange, years, variant = "default",active = false}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const options = useMemo(() => {
    if (Array.isArray(years) && years.length) return years;
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now + i); // e.g., 2025..2030
  }, [years]);

  return (
    <div
      onMouseEnter={() => setDropdownOpen(true)} // 🧩 open on hover
      onMouseLeave={() => setDropdownOpen(false)} // 🧩 close when leaving
      style={{ display: "inline-block" }}
    >
      <Dropdown
        isOpen={dropdownOpen}
        toggle={() => setDropdownOpen((v) => !v)} // 🧩 still supports click
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
            height: variant === "pill" ? "auto" : "37px",
            border: variant === "pill" ? "none" : undefined,
            backgroundColor: "transparent",
            backgroundImage: "none",
            borderColor: "transparent",
            boxShadow: "none",
           color: active ? "#fff" : "#b84a1c",
          }}
        >
          {value ?? "Select year"}
        </DropdownToggle>
        <DropdownMenu
          container="body"
          className="dashboard-pill-submenu"
          style={{
            minWidth: "100px",
            width: "auto",
          }}
        >
          {options
            .filter((y) => y !== value)
            .map((y) => (
              <DropdownItem
                key={y}
                onClick={() => {
                  onChange?.(y);
                }}
                className="text-center dashboard-pill-submenu-item"
              >
                {y}
              </DropdownItem>
            ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
};

export default FilterTahun;
