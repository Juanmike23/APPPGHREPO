/*
 * PGH-DOC
 * File: src/Variables/Dashboard/DashboardHeader.jsx
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
import { Row, Col, Nav, NavItem, NavLink } from "@pgh/ui-bootstrap";
import classnames from "classnames";
import TabSwitcherPillDashboard from "../TabSwitcher/TabSwitcherPillDashboard";
import "./DashboardHeader.scss";

const DashboardHeader = ({
  tabs,
  activeTab,
  onTabChange,
  rightTabs,
  rightActiveTab,
  onRightTabChange,
  getTabYear,
  getTabMonth,
  onYearChange,
  onMonthChange,
  years,
  maxValue,
  rightLead = null,

  toMonthMode,
  setToMonthMode,
}) => {
  const hasRightControls = Array.isArray(rightTabs) && rightTabs.length > 0;

  return (
    <Col md="12" className="project-list">
      <div className="card mb-4">
        <Row className="header-row dashboard-header-row align-items-center justify-content-between">
          {/* LEFT TABS */}
          <Col
            className={`left-side d-flex dashboard-header-left ${
              hasRightControls ? "" : "col-12"
            }`}
          >

            <Nav tabs className="border-tab">
              {tabs.map(({ key, label, icon: Icon }) => (
                <NavItem key={key}>
                  <NavLink
                    onClick={() => onTabChange(key)}
                    style={{ cursor: "pointer" }}
                    className={classnames({ active: activeTab === key })}
                  >
                    {Icon && <Icon size={16} />}{" "}
                    <span className="audit-dashboard-tab-text">{label}</span>
                  </NavLink>
                </NavItem>
              ))}
            </Nav>
          </Col>

          {hasRightControls && (
            <Col xs="auto" className="dashboard-header-right d-flex justify-content-end">
              <div className="dashboard-header-right-content">
                {rightLead ? (
                  <div className="dashboard-header-right-lead">{rightLead}</div>
                ) : null}
                <TabSwitcherPillDashboard
                  tabs={rightTabs}
                  activeTab={rightActiveTab}
                  onTabChange={onRightTabChange}
                  getTabYear={getTabYear}
                  getTabMonth={getTabMonth}
                  onYearChange={onYearChange}
                  onMonthChange={onMonthChange}
                  years={years}
                  maxValue={maxValue}
                  groupTabs
                  toMonthMode={toMonthMode}
                  setToMonthMode={setToMonthMode}
                />
              </div>
            </Col>
          )}
        </Row>
      </div>
    </Col>
  );
};

export default DashboardHeader;
