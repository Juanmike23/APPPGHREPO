/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/RenderDashCompare.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Row, Col, Card, CardBody, Button } from "@pgh/ui-bootstrap";
import { Home, Globe } from "react-feather";

import PieChartAudit from "./PieChartAudit";
import CardDashboard from "../../../Variables/CardDashboard";
import PlotChartAudit from "./PlotChartAudit";
import BarChartAudit from "./BarChartAudit";
import Timeline from "../Timeline/FullCalendarResourceTM";
import { buildAuditDrilldownUrl } from "../Utils/auditViewState";

const DETAIL_LOCKED_MESSAGE = "Detail hanya tersedia untuk stream Audit.";
const sections = [
  {
    key: "internal",
    label: "Internal",
    dataValue: "Internal",
    icon: <Home size={24} />,
    extract: (data) => data?.Internal ?? 0,
  },
  {
    key: "external",
    label: "External",
    dataValue: "Eksternal",
    icon: <Globe size={24} />,
    extract: (data) => data?.External ?? 0,
  },
];

const summaryColumns = ["STATUS", "DEPARTMENT", "TAHUN"];

const RenderDashCompare = ({
  baseUrl,
  auditCharts,
  summaryOnly = false,
}) => {
  const requestedColumns = useMemo(
    () =>
      Array.from(
        new Set([...auditCharts.map((chart) => chart.column), ...summaryColumns]),
      ).join(","),
    [auditCharts],
  );
  const [dashboardPayload, setDashboardPayload] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [activeTimelineSection, setActiveTimelineSection] = useState(sections[0].key);

  useEffect(() => {
    let active = true;

    setDashboardLoading(true);
    setDashboardError("");

    fetch(
      `${baseUrl}/chartaudit/dashboard-compare?columns=${encodeURIComponent(
        requestedColumns,
      )}`,
      { credentials: "include" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!active) return;
        setDashboardPayload(payload ?? null);
      })
      .catch((error) => {
        if (!active) return;
        setDashboardPayload(null);
        setDashboardError(
          error instanceof Error ? error.message : "Failed to load audit dashboard.",
        );
      })
      .finally(() => {
        if (active) {
          setDashboardLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [baseUrl, requestedColumns]);

  const activeTimelineConfig =
    sections.find((section) => section.key === activeTimelineSection) || sections[0];

  return (
    <>
      <Row className="audit-dashboard-row g-3 align-items-stretch">
        <Col xl="12" className="audit-dashboard-col audit-dashboard-appear">
          <Card className="audit-dashboard-card audit-dashboard-card--compare-guide">
            <CardBody className="audit-dashboard-compare-guide-body">
              <div className="audit-dashboard-compare-guide">
                {sections.map((section, index) => (
                  <div
                    key={`compare-guide-${section.key}`}
                    className="audit-dashboard-compare-guide__item"
                  >
                    <span className="audit-dashboard-compare-guide__eyebrow">
                      {index === 0 ? "Sisi kiri" : "Sisi kanan"}
                    </span>
                    <div className="audit-dashboard-compare-guide__title-wrap">
                      <span className="audit-dashboard-compare-guide__icon">
                        {section.icon}
                      </span>
                      <span className="audit-dashboard-compare-guide__title">
                        {section.label}
                      </span>
                    </div>
                    <span className="audit-dashboard-compare-guide__description">
                      {index === 0
                        ? "Panel kiri selalu menampilkan audit internal."
                        : "Panel kanan selalu menampilkan audit external."}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        {sections.map((section) => {
          const sharedBlockedMessage = summaryOnly ? DETAIL_LOCKED_MESSAGE : "";
          const detailNavigateTo = summaryOnly
            ? "#"
            : buildAuditDrilldownUrl({
                chartColumn: "JENISAUDIT",
                label: section.dataValue,
                type: "all",
              });

          return (
            <Col
              key={`total-${section.key}`}
              xl="6"
              md="6"
              className="audit-dashboard-col audit-dashboard-appear"
            >
              <CardDashboard
                insertheight={365}
                valueFontSize="2.2rem"
                icon={section.icon}
                navigateTo={detailNavigateTo}
                blockedMessage={sharedBlockedMessage}
                linkLabel={summaryOnly ? "Summary Only" : "See Audits"}
                externalData={dashboardPayload?.Overview}
                externalLoading={dashboardLoading}
                externalError={dashboardError}
                extractData={(data) => ({
                  total: section.extract(data),
                  subInfo: `${section.label} Audits`,
                })}
              />
            </Col>
          );
        })}
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        {sections.map((section) => {
          const sharedBlockedMessage = summaryOnly ? DETAIL_LOCKED_MESSAGE : "";

          return (
            <Col
              key={`distinct-${section.key}`}
              xl="6"
              md="6"
              className="audit-dashboard-col audit-dashboard-appear"
            >
              <CardDashboard
                insertheight={365}
                valueFontSize="2.2rem"
                icon={section.icon}
                navigateTo={
                  summaryOnly
                    ? "#"
                    : buildAuditDrilldownUrl({
                        distinctColumn: "NAMAAUDIT",
                        type: section.key,
                      })
                }
                blockedMessage={sharedBlockedMessage}
                linkLabel={summaryOnly ? "Summary Only" : "See Distinct Audits"}
                externalData={dashboardPayload?.Distinct}
                externalLoading={dashboardLoading}
                externalError={dashboardError}
                extractData={(data) => ({
                  total: section.extract(data),
                  subInfo: `${section.label} Distinct`,
                })}
                variant="secondary"
              />
            </Col>
          );
        })}
      </Row>

      {auditCharts.map((chart) => {
        const showAuditLegend =
          chart.column === "SOURCE" || chart.column === "PICAUDIT";

        return (
          <Row
            key={`compare-pie-${chart.column}`}
            className="audit-dashboard-row g-3 align-items-stretch"
          >
            {sections.map((section) => {
              const sharedBlockedMessage = summaryOnly ? DETAIL_LOCKED_MESSAGE : "";

              return (
                <Col
                  key={`${section.key}-${chart.column}`}
                  xl="6"
                  md="6"
                  className="audit-dashboard-col audit-dashboard-appear"
                >
                  <Card
                    className={`income-card ${
                      section.key === "internal" ? "card-primary" : "card-secondary"
                    } audit-dashboard-card audit-dashboard-card--chart h-100`}
                  >
                    <CardBody className="audit-dashboard-mini-card-body audit-dashboard-mini-card-body--pie d-flex flex-column">
                      <div className="audit-dashboard-clickable-tile">
                        <PieChartAudit
                          data={
                            dashboardPayload?.Sections?.[section.key]?.[chart.column] ?? []
                          }
                          title={`${chart.title} ${section.label}`}
                          chartcolumn={chart.column}
                          type={section.key}
                          clickable={!summaryOnly}
                          blockedMessage={sharedBlockedMessage}
                          showLegend={showAuditLegend}
                          showLine={showAuditLegend}
                          compact={false}
                          pieSizeOverride={212}
                          dashboardLayout
                          externalLoading={dashboardLoading}
                          externalError={dashboardError}
                          navigatePath={
                            summaryOnly
                              ? null
                              : buildAuditDrilldownUrl({
                                  chartColumn: "{chartcolumn}",
                                  label: "{label}",
                                  type: section.key,
                                })
                          }
                        />
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              );
            })}
          </Row>
        );
      })}

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        {sections.map((section) => {
          const sharedBlockedMessage = summaryOnly ? DETAIL_LOCKED_MESSAGE : "";

          return (
            <Col
              key={`status-${section.key}`}
              xl="6"
              lg="6"
              md="12"
              className="audit-dashboard-col audit-dashboard-appear"
            >
              <BarChartAudit
                data={dashboardPayload?.Sections?.[section.key]?.STATUS ?? []}
                title={`Status ${section.label}`}
                chartcolumn="STATUS"
                type={section.key}
                cardClassName="audit-dashboard-card audit-dashboard-card--chart"
                blockedMessage={sharedBlockedMessage}
                externalLoading={dashboardLoading}
                externalError={dashboardError}
                navigatePath={
                  summaryOnly
                    ? null
                    : buildAuditDrilldownUrl({
                        chartColumn: "{chartcolumn}",
                        label: "{label}",
                        type: section.key,
                      })
                }
              />
            </Col>
          );
        })}
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        {sections.map((section) => {
          const sharedBlockedMessage = summaryOnly ? DETAIL_LOCKED_MESSAGE : "";

          return (
            <Col
              key={`department-${section.key}`}
              xl="6"
              lg="6"
              md="12"
              className="audit-dashboard-col audit-dashboard-appear"
            >
              <BarChartAudit
                data={dashboardPayload?.Sections?.[section.key]?.DEPARTMENT ?? []}
                title={`Department ${section.label}`}
                chartcolumn="DEPARTMENT"
                type={section.key}
                cardClassName="audit-dashboard-card audit-dashboard-card--chart"
                blockedMessage={sharedBlockedMessage}
                externalLoading={dashboardLoading}
                externalError={dashboardError}
                navigatePath={
                  summaryOnly
                    ? null
                    : buildAuditDrilldownUrl({
                        chartColumn: "{chartcolumn}",
                        label: "{label}",
                        type: section.key,
                      })
                }
              />
            </Col>
          );
        })}
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        {sections.map((section) => {
          const sharedBlockedMessage = summaryOnly ? DETAIL_LOCKED_MESSAGE : "";

          return (
            <Col
              key={`year-${section.key}`}
              xl="6"
              lg="6"
              md="12"
              className="audit-dashboard-col audit-dashboard-appear"
            >
              <PlotChartAudit
                data={dashboardPayload?.Sections?.[section.key]?.TAHUN ?? []}
                chartcolumn="TAHUN"
                title={`Year Audit ${section.label}`}
                type={section.key}
                cardClassName="audit-dashboard-card audit-dashboard-card--chart"
                blockedMessage={sharedBlockedMessage}
                externalLoading={dashboardLoading}
                externalError={dashboardError}
                navigatePath={
                  summaryOnly
                    ? null
                    : buildAuditDrilldownUrl({
                        chartColumn: "TAHUN",
                        label: "{label}",
                        type: section.key,
                      })
                }
              />
            </Col>
          );
        })}
      </Row>

      {!summaryOnly && (
        <Row className="audit-dashboard-row g-3 align-items-stretch">
          <Col
            xl="12"
            lg="12"
            md="12"
            className="audit-dashboard-col audit-dashboard-appear"
          >
            <Card className="audit-dashboard-card audit-dashboard-card--timeline p-3">
              <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-3">
                <div className="d-flex flex-column gap-1">
                  <h5 className="mb-0">Audit Timeline Compare</h5>
                  <span className="audit-dashboard-compare-timeline-note">
                    Kiri untuk Internal dan kanan untuk External berlaku juga di area compare
                    ini. Gunakan tombol di bawah untuk fokus ke timeline yang dipilih.
                  </span>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  {sections.map((section) => {
                    const isActive = section.key === activeTimelineSection;

                    return (
                      <Button
                        key={`timeline-toggle-${section.key}`}
                        color={isActive ? "primary" : "light"}
                        className="d-flex align-items-center gap-2 px-3"
                        onClick={() => setActiveTimelineSection(section.key)}
                      >
                        {section.icon}
                        <span>{section.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Timeline
                apiUrl={`${baseUrl}/listaudit?type=${activeTimelineConfig.key}`}
                type={activeTimelineConfig.key}
              />
            </Card>
          </Col>
        </Row>
      )}
    </>
  );
};

export default RenderDashCompare;
