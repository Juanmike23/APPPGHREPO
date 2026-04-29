/*
 * PGH-DOC
 * File: src/Components/Human/DashboardHuman/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useState } from "react";
import { Col, Container, Row, Card, CardBody } from "@pgh/ui-bootstrap";
import {
  Grid,
  Database,
  DollarSign,
  ToggleRight,
  CreditCard,
  Briefcase,
  User,
  UserPlus,
  Activity,
} from "react-feather";

import DashboardHeader from "../../../Variables/Dashboard/DashboardHeader";
import CardDashboard from "../../../Variables/CardDashboard";
import useHeaderTabRefreshToken from "../../../Variables/Dashboard/useHeaderTabRefreshToken";
import PieChartHuman from "./PieChartHuman";
import { useAuth } from "../../../Auth/AuthContext";
import { isCrossStreamManager } from "../../../Auth/accessControl";
import CrossStreamDashboardNotice from "../../../Variables/Dashboard/CrossStreamDashboardNotice";
import "../../Audit/DashboardAudit/auditDashboard.scss";

const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${PUBLIC_URL}${normalizedPath}`;
};

const DEPT_API_MAP = {
  ALL: "",
  IDS: "IDS",
  CBS: "CBS",
  TSC: "TSC",
  DCP: "DCP",
  BOA: "BOA",
};

const ICON_MAP = {
  ALL: Grid,
  IDS: Database,
  CBS: DollarSign,
  TSC: ToggleRight,
  DCP: CreditCard,
  BOA: Briefcase,
};

const HUMAN_CHARTS = [
  { title: "ALL", column: "total", derivedColumn: "fte" },
  { title: "FTE", column: "fte", derivedColumn: "fte" },
  { title: "Non-FTE", column: "nonfte", derivedColumn: "nonfte" },
  { title: "Gap", column: "gap", derivedColumn: "kebutuhanfte" },
];

const DETAIL_LOCKED_MESSAGE =
  "Manager hanya dapat melihat chart dashboard unit lain. Detail Human Resource hanya bisa dibuka pada unit sendiri.";

const DashboardHuman = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("ALL");
  const headerRefreshToken = useHeaderTabRefreshToken(activeTab);
  const crossStreamReadOnly = isCrossStreamManager(user, "human");

  const humanTabs = Object.keys(DEPT_API_MAP).map((key) => ({
    key,
    label: key === "ALL" ? "All" : key,
    abbrev: key === "ALL" ? "All" : key.substring(0, 3),
  }));

  const baseUrl = process.env.REACT_APP_API_BASE_URL?.replace(/\/$/, "") || "";

  const selectedDept = DEPT_API_MAP[activeTab];
  const dashboardApi = selectedDept
    ? `${baseUrl}/charthuman/dashboard/${selectedDept}`
    : `${baseUrl}/charthuman/dashboard`;
  const [dashboardPayload, setDashboardPayload] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setDashboardLoading(true);
      setDashboardError("");

      try {
        const response = await fetch(dashboardApi, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!active) return;
        setDashboardPayload(payload);
      } catch (error) {
        if (!active) return;
        console.error("Human dashboard fetch error:", error);
        setDashboardPayload(null);
        setDashboardError(
          error instanceof Error ? error.message : "Failed to load dashboard.",
        );
      } finally {
        if (active) {
          setDashboardLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [dashboardApi]);

  const summaryNavigateTo = buildAppPath("/human/resource");
  const nonFteNavigateTo = `${buildAppPath("/human/resource")}?tab=nonfte`;
  const gapNavigateTo = `${buildAppPath("/human/resource")}?tab=kebutuhanfte`;

  return (
    <Container fluid className="dashboard-default-sec audit-dashboard-page audit-dashboard-page--ready">
      <Row className="audit-dashboard-shell g-3">
        {crossStreamReadOnly && (
          <Col sm="12">
            <CrossStreamDashboardNotice
              moduleLabel="Human Resource"
              userStream={user?.stream}
            />
          </Col>
        )}

        <DashboardHeader
          tabs={humanTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <Col>
          <CardDashboard
            key={`human-overview-all-${activeTab}-${headerRefreshToken}`}
            icon={React.createElement(ICON_MAP[activeTab], { size: 24 })}
            externalData={dashboardPayload?.Overview}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            navigateTo={crossStreamReadOnly ? "#" : summaryNavigateTo}
            linkLabel={crossStreamReadOnly ? "Summary Only" : "See Resources"}
            blockedMessage={crossStreamReadOnly ? DETAIL_LOCKED_MESSAGE : ""}
            extractData={(data) => ({
              total: data.TotalEmployees ?? 0,
              subInfo: "Employees APS",
            })}
          />
        </Col>

        <Col>
          <CardDashboard
            key={`human-overview-fte-${activeTab}-${headerRefreshToken}`}
            icon={<User size={24} />}
            externalData={dashboardPayload?.Overview}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            navigateTo={crossStreamReadOnly ? "#" : summaryNavigateTo}
            linkLabel={crossStreamReadOnly ? "Summary Only" : "See FTE"}
            blockedMessage={crossStreamReadOnly ? DETAIL_LOCKED_MESSAGE : ""}
            extractData={(data) => ({
              total: data.FTE ?? 0,
              subInfo: "FTE Total",
            })}
            variant="secondary"
          />
        </Col>

        <Col>
          <CardDashboard
            key={`human-overview-nonfte-${activeTab}-${headerRefreshToken}`}
            icon={<UserPlus size={24} />}
            externalData={dashboardPayload?.Overview}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            navigateTo={crossStreamReadOnly ? "#" : nonFteNavigateTo}
            linkLabel={crossStreamReadOnly ? "Summary Only" : "See Non-FTE"}
            blockedMessage={crossStreamReadOnly ? DETAIL_LOCKED_MESSAGE : ""}
            extractData={(data) => ({
              total: data.NonFTE ?? 0,
              subInfo: "Non-FTE Total",
            })}
            variant="secondary"
          />
        </Col>

        <Col>
          <CardDashboard
            key={`human-overview-gap-${activeTab}-${headerRefreshToken}`}
            icon={<Activity size={24} />}
            externalData={dashboardPayload?.Overview}
            externalLoading={dashboardLoading}
            externalError={dashboardError}
            navigateTo={crossStreamReadOnly ? "#" : gapNavigateTo}
            linkLabel={crossStreamReadOnly ? "Summary Only" : "See Gap"}
            blockedMessage={crossStreamReadOnly ? DETAIL_LOCKED_MESSAGE : ""}
            extractData={(data) => ({
              total: data.TotalGap ?? 0,
              subInfo: "Need",
            })}
            variant="secondary"
          />
        </Col>

        <Row className="audit-dashboard-row g-3 align-items-stretch">
          {HUMAN_CHARTS.map((chart, index) => (
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
                    <PieChartHuman
                      key={`human-pie-${chart.column}-${activeTab}-${headerRefreshToken}`}
                      data={dashboardPayload}
                      externalLoading={dashboardLoading}
                      externalError={dashboardError}
                      title={chart.title}
                      chartcolumn={chart.derivedColumn}
                      activeTab={activeTab}
                      mode={chart.column}
                      blockedMessage={
                        crossStreamReadOnly
                          ? DETAIL_LOCKED_MESSAGE
                          : chart.column === "total"
                          ? "Detail chart ALL tidak tersedia karena ini agregasi FTE + Non-FTE. Gunakan chart FTE atau Non-FTE untuk drilldown detail."
                          : ""
                      }
                      showLegend
                      showLine
                      compact={false}
                      pieSizeOverride={212}
                      dashboardLayout
                    />
                  </div>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>
      </Row>
    </Container>
  );
};

export default DashboardHuman;
