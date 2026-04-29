/*
 * PGH-DOC
 * File: src/Variables/TabSwitcher/TabSwitcherPill.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// TabSwitcherPill.jsx
import React, { useState } from "react";
import { Col, Row, Nav, NavItem, NavLink } from "@pgh/ui-bootstrap";
import FilterTahun from "./FilterTahun";
import DropdownMonth from "./DropdownMonth";

const TabSwitcherPill = ({
  tabs,
  position = "top",
  activeTab: controlledTab,
  onTabChange,
  showYearFilter = false,
  showMonthFilter = false,
  value,
  onChange,
  years,
  // 🧩 new props to pass down
  selectedMonth,
  onChangeMonth,
  topStartMargin = false,
  showlength = false,
}) => {
  const [internalTab, setInternalTab] = useState(tabs[0].key);
  const isControlled = controlledTab !== undefined;
  const activeTab = isControlled ? controlledTab : internalTab;
  const setActiveTab = isControlled ? onTabChange : setInternalTab;

  const renderTabs = () => (
    <Nav
      pills
      className="mb-3 d-flex align-items-left gap-2"
      style={{ width: "100%" }}
    >
      <div className="d-flex flex gap-2">
       {tabs.map((tab) => (
  <NavItem key={tab.key}>
    <NavLink
      className={activeTab === tab.key ? "active" : ""}
      onClick={() => setActiveTab(tab.key)}
      style={{ cursor: "pointer" }}
    >
      {tab.label}
      {showlength && typeof tab.length === "number" && (
        <span className="ms-1">({tab.length})</span>
      )}
    </NavLink>
  </NavItem>
))}
      </div>

      <div className=" d-flex align-items-left gap-2">
        {showMonthFilter && (
          <DropdownMonth
            selectedPeriod={selectedMonth}
            onChange={onChangeMonth}
          />
        )}
        {showYearFilter && (
          <FilterTahun value={value} onChange={onChange} years={years} />
        )}
      </div>
    </Nav>
  );

  const activeContent = tabs.find((tab) => tab.key === activeTab)?.content;
  // ✅ clone content and inject shared props
  const renderedContent =
    activeContent && React.isValidElement(activeContent)
      ? React.cloneElement(activeContent, {
          selectedMonth,
          onChangeMonth,
          year: value,
        })
      : activeContent;

  return (
    <Row>
      <Col className={topStartMargin ? "ms-3" : ""}>
        {position === "top" && renderTabs()}
      </Col>

      {renderedContent}
      <Col className="ms-3">{position === "bottom" && renderTabs()}</Col>
    </Row>
  );

};

export default TabSwitcherPill;
