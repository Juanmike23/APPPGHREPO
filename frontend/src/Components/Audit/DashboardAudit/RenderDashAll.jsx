/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/RenderDashAll.jsx
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
import { Row, Col, Card, CardBody } from "@pgh/ui-bootstrap";
import { Layers, Grid, Home, Globe } from "react-feather";

import PieChartAudit from "./PieChartAudit";
import PlotChartAudit from "./PlotChartAudit";
import BarChartAudit from "./BarChartAudit";
import Timeline from "../Timeline/FullCalendarResourceTM";
import CardDashboard from "../../../Variables/CardDashboard";
import { buildAuditDrilldownUrl } from "../Utils/auditViewState";

const DETAIL_LOCKED_MESSAGE = "Detail hanya tersedia untuk stream pemilik dashboard.";
const SUMMARY_COLUMNS = ["STATUS", "DEPARTMENT", "TAHUN"];

const RenderDashAll = ({
  baseUrl,
  auditCharts,
  activeTab,
  summaryOnly = false,
}) => {
  const titleByTab =
    activeTab === "Internal"
      ? "Internal Audits"
      : activeTab === "External"
        ? "External Audits"
        : "Total Audits";
  const titleByTabDis =
    activeTab === "Internal"
      ? "Internal Distinct"
      : activeTab === "External"
        ? "External Distinct"
        : "Total Distinct";

  const iconByTab = {
    All: <Grid size={24} />,
    Internal: <Home size={24} />,
    External: <Globe size={24} />,
  };

  const activeIcon = iconByTab[activeTab] || <Grid size={24} />;
  const requestedColumns = useMemo(
    () =>
      Array.from(
        new Set([...auditCharts.map((chart) => chart.column), ...SUMMARY_COLUMNS]),
      ).join(","),
    [auditCharts],
  );
  const [dashboardPayload, setDashboardPayload] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    let active = true;

    setDashboardLoading(true);
    setDashboardError("");

    fetch(
      `${baseUrl}/chartaudit/dashboard-all?type=${encodeURIComponent(
        activeTab.toLowerCase(),
      )}&columns=${encodeURIComponent(requestedColumns)}`,
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
  }, [activeTab, baseUrl, requestedColumns]);

  const detailNavigateTo = summaryOnly ? "#" : buildAuditDrilldownUrl({});
  const distinctNavigateTo = summaryOnly
    ? "#"
    : buildAuditDrilldownUrl({
        distinctColumn: "NAMAAUDIT",
        type: activeTab,
      });

  return (
    <>
      <Row className="audit-dashboard-row g-3 align-items-stretch">
        <Col xl="6" md="6" className="audit-dashboard-col audit-dashboard-appear">
          <CardDashboard
            insertheight={365}
            valueFontSize="2.2rem"
            icon={activeIcon}
            navigateTo={detailNavigateTo}
            blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
            linkLabel="See Audits"
            externalData={dashboardPayload?.Overview}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            extractData={(data) => {
              const keyMap = {
                All: "Total",
                Internal: "Internal",
                External: "External",
              };
              const key = keyMap[activeTab] || "Total";

              return {
                total: data[key] ?? 0,
                subInfo: titleByTab,
              };
            }}
          />
        </Col>

        <Col xl="6" md="6" className="audit-dashboard-col audit-dashboard-appear">
          <CardDashboard
            insertheight={365}
            valueFontSize="2.2rem"
            icon={<Layers size={24} />}
            navigateTo={distinctNavigateTo}
            blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
            linkLabel="See Distinct Audits"
            externalData={dashboardPayload?.Distinct}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            extractData={(data) => {
              const keyMap = {
                All: "Total",
                Internal: "Internal",
                External: "External",
              };
              const key = keyMap[activeTab] || "Total";

              return {
                total: data[key] ?? 0,
                subInfo: titleByTabDis,
              };
            }}
            variant="secondary"
          />
        </Col>
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        {auditCharts.map((chart, index) => {
          const showAuditLegend =
            chart.column === "SOURCE" || chart.column === "PICAUDIT";

          return (
            <Col
              key={chart.column}
              xl="6"
              md="6"
              className="audit-dashboard-col audit-dashboard-appear"
            >
              <Card
                className={`income-card ${
                  index % 2 === 0 ? "card-primary" : "card-secondary"
                } audit-dashboard-card audit-dashboard-card--chart h-100`}
              >
                <CardBody className="audit-dashboard-mini-card-body audit-dashboard-mini-card-body--pie d-flex flex-column">
                  <div className="audit-dashboard-clickable-tile">
                    <PieChartAudit
                      data={dashboardPayload?.Charts?.[chart.column] ?? []}
                      title={chart.title}
                      chartcolumn={chart.column}
                      clickable={!summaryOnly}
                      blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
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
                              type: activeTab,
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

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        <Col xl="6" className="audit-dashboard-col audit-dashboard-appear">
          <BarChartAudit
            data={dashboardPayload?.Charts?.STATUS ?? []}
            title="Status"
            chartcolumn="STATUS"
            type={activeTab}
            cardClassName="audit-dashboard-card audit-dashboard-card--chart"
            blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            navigatePath={
              summaryOnly
                ? null
                : buildAuditDrilldownUrl({
                    chartColumn: "{chartcolumn}",
                    label: "{label}",
                    type: activeTab,
                  })
            }
          />
        </Col>

        <Col xl="6" className="audit-dashboard-col audit-dashboard-appear">
          <BarChartAudit
            data={dashboardPayload?.Charts?.DEPARTMENT ?? []}
            title="Department"
            chartcolumn="DEPARTMENT"
            type={activeTab}
            cardClassName="audit-dashboard-card audit-dashboard-card--chart"
            blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            navigatePath={
              summaryOnly
                ? null
                : buildAuditDrilldownUrl({
                    chartColumn: "{chartcolumn}",
                    label: "{label}",
                    type: activeTab,
                  })
            }
          />
        </Col>
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        <Col xl="12" className="audit-dashboard-col audit-dashboard-appear">
          <PlotChartAudit
            data={dashboardPayload?.Charts?.TAHUN ?? []}
            chartcolumn="TAHUN"
            title="Year"
            type={activeTab === "All" ? "" : activeTab}
            cardClassName="audit-dashboard-card audit-dashboard-card--chart"
            blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            navigatePath={
              summaryOnly
                ? null
                : buildAuditDrilldownUrl({
                    chartColumn: "TAHUN",
                    label: "{label}",
                    type: activeTab,
                  })
            }
          />
        </Col>
      </Row>

      {!summaryOnly && (
        <div className="audit-dashboard-appear">
          <Timeline
            apiUrl={`${baseUrl}/listaudit?type=${activeTab.toLowerCase()}`}
            type={activeTab.toLowerCase()}
          />
        </div>
      )}
    </>
  );
};

export default RenderDashAll;
