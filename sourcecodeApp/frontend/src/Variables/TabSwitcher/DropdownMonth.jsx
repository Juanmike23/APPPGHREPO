/*
 * PGH-DOC
 * File: src/Variables/TabSwitcher/DropdownMonth.jsx
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
import { Dropdown, DropdownToggle, DropdownMenu } from "@pgh/ui-bootstrap";

const DropdownMonth = ({
  selectedPeriod = "Q1",
  onChange,
  months = [],
  showQuarters = true,
  compact = false,
  maxValue = null,
  variant = "default", // "default" | "pill"
  active = false,
  textColor = null,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredQuarter, setHoveredQuarter] = useState(null);
  const [hoveredMonth, setHoveredMonth] = useState(null);

  /* ------------------ DATA ------------------ */
  const defaultMonths = [
    { label: "Jan", quarter: "Q1" },
    { label: "Feb", quarter: "Q1" },
    { label: "Mar", quarter: "Q1" },
    { label: "Apr", quarter: "Q2" },
    { label: "May", quarter: "Q2" },
    { label: "Jun", quarter: "Q2" },
    { label: "Jul", quarter: "Q3" },
    { label: "Aug", quarter: "Q3" },
    { label: "Sep", quarter: "Q3" },
    { label: "Oct", quarter: "Q4" },
    { label: "Nov", quarter: "Q4" },
    { label: "Dec", quarter: "Q4" },
  ];

  const monthOrder = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const quarterToLastMonthIndex = {
    Q1: 2,
    Q2: 5,
    Q3: 8,
    Q4: 11,
  };

  /* ------------------ HELPERS ------------------ */
  const getMaxMonthIndex = (value) => {
    if (!value) return 11;
    if (value.startsWith("Q")) return quarterToLastMonthIndex[value];
    return monthOrder.indexOf(value);
  };

  const maxMonthIndex = getMaxMonthIndex(maxValue);

  /* ------------------ ✅ FIXED LOGIC ------------------ */

  // 1️⃣ Filter MONTHS by maxValue
  const allMonths = months.length ? months : defaultMonths;

  const effectiveMonths = allMonths.filter(
    (m) => monthOrder.indexOf(m.label) <= maxMonthIndex,
  );

  // 2️⃣ Derive QUARTERS from visible months (CRITICAL FIX)
  const visibleQuarters = ["Q1", "Q2", "Q3", "Q4"].filter((q) =>
    effectiveMonths.some((m) => m.quarter === q),
  );


  const getResolvedPeriod = (value) => {
  if (value !== null && value !== undefined && value !== "") {
    return value;
  }

  // fallback → today's month
  const todayIndex = new Date().getMonth(); // 0–11
  return monthOrder[todayIndex];
};

  const getDisplayLabel = (value) => {
  if (typeof value === "number") {
    return monthOrder[value - 1] ?? "—";
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return "month"; // 👈 critical fallback
};


const resolvedPeriod = getResolvedPeriod(selectedPeriod);

  /* ------------------ UI ------------------ */
  return (
    <div
      onMouseEnter={() => setDropdownOpen(true)}
      onMouseLeave={() => setDropdownOpen(false)}
      style={{ display: "inline-block" }}
    >
      <Dropdown
        isOpen={dropdownOpen}
        toggle={() => setDropdownOpen((p) => !p)}
        direction="down"
        className={compact ? "dropdown-compact" : ""}
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
             color: textColor ?? (active ? "#fff" : "#b84a1c"),
              
          }}
        >
       {getDisplayLabel(resolvedPeriod)}


        </DropdownToggle>

        <DropdownMenu
          container="body"
          className="period-menu dashboard-pill-submenu"
          style={{
            padding: "4px 6px",
            margin: 0,
            minWidth: "auto",
            width: "fit-content",
            borderRadius: "6px",
            backgroundColor: "#fff",
            border: "1px solid rgba(241, 90, 34, 0.24)",
            boxShadow:
              "0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08)",
            zIndex: 1000,
          }}
        >
          {visibleQuarters.map((q, index) => {
            const quarterMonths = effectiveMonths.filter(
              (m) => m.quarter === q,
            );

            return (
              <div
                key={q}
                className="quarter-section"
                style={{
                  position: "relative",
                  marginBottom: "6px",
                  paddingBottom: "8px",
                }}
              >
                <div
                  className="d-flex align-items-stretch"
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: "6px",
                  }}
                >
                  {showQuarters && (
                   <div
  className={`quarter-tab ${
    hoveredQuarter === q ? "is-hovered" : ""
  }`}
  onClick={() => onChange(q)}
  onMouseEnter={() => setHoveredQuarter(q)}
  onMouseLeave={() => setHoveredQuarter(null)}
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    borderRadius: "4px",
    fontWeight: 600,
    backgroundColor:
      hoveredQuarter === q ? "rgba(241, 90, 34, 0.14)" : "transparent",
    color: hoveredQuarter === q ? "#9f3e14" : "#b84a1c",
    flex: "0 0 28px",
    transition: "all 0.2s ease",
  }}
>
  <span
    style={{
      display: "inline-block",
      writingMode: "vertical-rl",
      transform: "rotate(90deg)", // 👈 ONLY TEXT
      lineHeight: 1,
    }}
  >
    {q}
  </span>
</div>

                  )}
                  {/* | SEPARATOR */}
                  <div
                    style={{
                      width: "1px",
                      backgroundColor: "rgba(241, 90, 34, 0.25)",
                    }}
                  />
                  <div
                    className="months-wrap"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                    }}
                  >
                    {quarterMonths.map(({ label }) => (
                      <div
                        key={label}
                        onClick={() => onChange(label)}
                        onMouseEnter={() => setHoveredMonth(label)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        style={{
                          cursor: "pointer",
                          borderRadius: "3px",
                          fontSize: "15px",
                          padding: "6px 8px",
                          backgroundColor:
                            hoveredMonth === label
                              ? "rgba(241, 90, 34, 0.14)"
                              : "transparent",
                          color: hoveredMonth === label ? "#9f3e14" : "#b84a1c",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {index < visibleQuarters.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "0",
                      left: "0",
                      right: "0",
                      height: "1px",
                      backgroundColor: "rgba(241, 90, 34, 0.25)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
};

export default DropdownMonth;
