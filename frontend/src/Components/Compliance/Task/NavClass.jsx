/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/NavClass.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

/* eslint-disable react-hooks/exhaustive-deps */
import React, { Fragment } from "react";
import { Col, Card, CardBody, Nav, NavItem } from "@pgh/ui-bootstrap";
import NewTaskClass from "./NewTask";

const NavClass = ({
  reports = [],
  activeEvent,
  setActiveEvent,
  onAddPeriod,
  canManageCompliance,
}) => {
  const uniquePeriods = [...new Set(reports.map((row) => row.PeriodName).filter(Boolean))];

  const getIndicatorColor = (period) => {
    const rows = reports.filter((row) => row.PeriodName === period);
    if (rows.length === 0) return "#94a3b8";
    return rows.every((row) => row.DocumentId) ? "#16a34a" : "#ef4444";
  };

  return (
    <Fragment>
      <Col xl="12" className="compliance-events-list-col">
        <Card className="compliance-dashboard-card compliance-events-list-card mb-0">
          <CardBody className="compliance-events-list-card__body">
            <div className="compliance-events-list-header">
              <div className="compliance-events-list-header__copy">
                <span className="compliance-events-list-title">
                  Compliance Events <span>({uniquePeriods.length})</span>
                </span>
                <p className="compliance-events-list-subtitle mb-0">
                  Pilih event untuk langsung diarahkan ke tabel detail di bawah.
                </p>
              </div>
              {canManageCompliance && (
                <div className="compliance-events-list-header__actions">
                  <NewTaskClass onAddPeriod={onAddPeriod} />
                </div>
              )}
            </div>

            <Nav className="compliance-events-list-nav" role="tablist">
              {uniquePeriods.map((period) => (
                <NavItem key={period} className="compliance-events-list-item">
                  <a
                    href={`#period-${encodeURIComponent(period)}`}
                    className={`compliance-events-list-link ${
                      activeEvent === period ? "active" : ""
                    }`}
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveEvent(period);
                    }}
                  >
                    <span
                      className="compliance-events-list-link__dot"
                      style={{ backgroundColor: getIndicatorColor(period) }}
                    />
                    <span className="compliance-events-list-link__title">{period}</span>
                  </a>
                </NavItem>
              ))}
            </Nav>
          </CardBody>
        </Card>
      </Col>
    </Fragment>
  );
};

export default NavClass;
