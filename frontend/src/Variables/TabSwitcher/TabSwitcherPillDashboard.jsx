/*
 * PGH-DOC
 * File: src/Variables/TabSwitcher/TabSwitcherPillDashboard.jsx
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
import { Button, ButtonGroup } from "@pgh/ui-bootstrap";
import FilterTahun from "./FilterTahun";
import DropdownMonth from "./DropdownMonth";
import DropdownMode from "./DropdownMode";

const TabSwitcherPillDashboard = ({
  tabs = [],
  activeTab,
  onTabChange,
  showYearFilter = true,
  showMonthFilter = true,

  getTabYear,
  getTabMonth,
  onYearChange,
  onMonthChange,

  years = [],
  groupTabs = true,
  maxValue,

  toMonthMode,
  setToMonthMode,
}) => {
  return (
    <ButtonGroup className="dashboard-pill-switcher">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;

        const tabYear = getTabYear(tab.key);
        const tabMonth = getTabMonth(tab.key);
        const hasMonthControl = showMonthFilter && !tab.hideDropdownMonth;
        const showQuarterOptions =
          tab.showQuarters ??
          !(
            tab.modeDropdown &&
            String(tab.modeDropdown.value ?? "")
              .trim()
              .toLowerCase() === "monthly"
          );
        const hasYearControl = showYearFilter;
        const hasDetailControls = hasMonthControl || hasYearControl;

        return (
          <Button
            key={tab.key}
            className="dashboard-pill-switcher__tab"
            color={active ? "primary" : "outline-primary"}
            active={active}
            style={{ height: 64, minWidth: 180 }}
            onClick={() => onTabChange(tab.key)}
          >
            <div className="d-flex flex-column align-items-center lh-sm">
              {tab.modeDropdown ? (
                <DropdownMode
                  value={tab.modeDropdown.value}
                  options={tab.modeDropdown.options}
                  onChange={setToMonthMode}
                  compact
                  variant="pill"
                  active={active}
                  textColor={tab.modeDropdown.textColor ?? null}
                />
              ) : (
                <span className="fw-semibold d-flex align-items-center gap-1">
                  {tab.icon && <tab.icon size={14} />}
                  {tab.label}
                </span>
              )}

              {hasDetailControls && (
                <>
                  <div
                    style={{
                      width: "100%",
                      height: 1,
                      backgroundColor: active
                        ? "rgba(255,255,255,0.35)"
                        : "rgba(241, 90, 34, 0.24)",
                      margin: "4px 0",
                    }}
                  />

                  <div
                    className={`d-flex gap-1 small ${
                      active ? "text-white-50" : "text-muted"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasMonthControl && (
                      <DropdownMonth
                        selectedPeriod={tabMonth}
                        onChange={(m) => onMonthChange(tab.key, m)}
                        showQuarters={showQuarterOptions}
                        maxValue={maxValue}
                        compact
                        variant="pill"
                        active={active}
                        textColor={tab.monthTextColor ?? null}
                      />
                    )}

                    {hasYearControl && (
                      <FilterTahun
                        value={tabYear}
                        onChange={(y) => onYearChange(tab.key, y)}
                        years={years}
                        compact
                        variant="pill"
                        active={active}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </Button>
        );
      })}
    </ButtonGroup>
  );
};

export default TabSwitcherPillDashboard;
