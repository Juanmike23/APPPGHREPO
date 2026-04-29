/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useMemo, useState } from "react";
import { Container, Row } from "@pgh/ui-bootstrap";
import { Grid, Shuffle } from "react-feather";

import DashboardHeader from "../../../Variables/Dashboard/DashboardHeader";
import RenderDashAll from "./RenderDashAll";
import RenderDashCompare from "./RenderDashCompare";
import { useAuth } from "../../../Auth/AuthContext";
import { isAuditSummaryOnly } from "../../../Auth/accessControl";
import CrossStreamDashboardNotice from "../../../Variables/Dashboard/CrossStreamDashboardNotice";
import { AUDIT_CHART_ALLOWED_COLUMNS } from "../Utils/columnHelpers";
import useHeaderTabRefreshToken from "../../../Variables/Dashboard/useHeaderTabRefreshToken";
import "../Utils/auditArea.scss";
import "./auditDashboard.scss";

const DashboardAudit = () => {
  const { user } = useAuth();
  const baseUrl = process.env.REACT_APP_API_BASE_URL?.replace(/\/$/, "") || "";

  // ONE unified state for ALL tabs
  const [activeTab, setActiveTab] = useState("All");
  const headerRefreshToken = useHeaderTabRefreshToken(activeTab);
  const summaryOnly = isAuditSummaryOnly(user);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const auditCharts = useMemo(
    () => [
      { title: "Source Audit", column: "SOURCE" },
      { title: "PIC Audit", column: "PICAUDIT" },
    ].filter((chart) => AUDIT_CHART_ALLOWED_COLUMNS.includes(chart.column)),
    [],
  );

  const tabs = summaryOnly
    ? [
        { key: "All", label: "All", abbrev: "All", icon: Grid },
        { key: "Compare", label: "Internal-External", abbrev: "I-E", icon: Shuffle },
      ]
    : [
        { key: "All", label: "All", abbrev: "All", icon: Grid },
        { key: "Compare", label: "Internal-External", abbrev: "I-E", icon: Shuffle },
      ];

  useEffect(() => {
    if (summaryOnly && !["All", "Compare"].includes(activeTab)) {
      setActiveTab("All");
    }
  }, [activeTab, summaryOnly]);

  return (
    <Fragment>
      <Container fluid className="dashboard-default-sec audit-dashboard-page audit-dashboard-page--ready">
        <Row className="audit-dashboard-shell g-3">
          {summaryOnly && (
            <div className="col-12">
              <CrossStreamDashboardNotice
                moduleLabel="Audit"
                userStream={user?.stream}
                detailOwnerLabel="stream Audit"
                summaryLabel="Summary only"
              />
            </div>
          )}

          <DashboardHeader
           tabs={tabs}

            activeTab={activeTab}
            onTabChange={setActiveTab}
            //    rightTabs={[
            //    {
            //      key: "Compare",
            //      label: "Compare",
                
            //      icon: Shuffle,
            //    },
            //  ]}
            rightActiveTab={activeTab}
            onRightTabChange={setActiveTab}
          />

          {/* LEFT TAB CONTENT */}
          {["All", "Internal", "External"].includes(activeTab) && (
            <RenderDashAll
              key={`audit-all-${activeTab}-${headerRefreshToken}`}
              baseUrl={baseUrl}
              auditCharts={auditCharts}
              activeTab={activeTab}
              summaryOnly={summaryOnly}
            />
          )}

          {/* RIGHT TAB CONTENT */}
          {activeTab === "Compare" && (
            <RenderDashCompare
              key={`audit-compare-${headerRefreshToken}`}
              baseUrl={baseUrl}
              auditCharts={auditCharts}
              activeTab={activeTab}
              summaryOnly={summaryOnly}
            />
          )}

        </Row>
      </Container>
    </Fragment>
  );
};

export default DashboardAudit;
