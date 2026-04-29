/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useState } from "react";
import { Container, Row } from "@pgh/ui-bootstrap";
import { Shuffle, Target } from "react-feather";

import DashboardHeader from "../../../Variables/Dashboard/DashboardHeader";
import RenderProcureAll from "./RenderDashAll";
import RenderDashCompare from "./RenderDashCompare";
import { useAuth } from "../../../Auth/AuthContext";
import { isSummaryOnlyMode } from "../../../Auth/accessControl";
import CrossStreamDashboardNotice from "../../../Variables/Dashboard/CrossStreamDashboardNotice";
import useHeaderTabRefreshToken from "../../../Variables/Dashboard/useHeaderTabRefreshToken";
import "../../../Variables/Dashboard/dashboardShared.scss";
import "./procurementDashboard.scss";
import "../../Audit/Utils/auditArea.scss";
import "../../Audit/DashboardAudit/auditDashboard.scss";

const DashboardProcurement = () => {
  const { user } = useAuth();
  const summaryOnly = isSummaryOnlyMode(user, "procurement");
  const [activeTab, setActiveTab] = useState("all");
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [dashboardSummaryLoading, setDashboardSummaryLoading] = useState(true);
  const [dashboardSummaryError, setDashboardSummaryError] = useState("");
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const headerRefreshToken = useHeaderTabRefreshToken(activeTab);
  const dashboardSummaryApi = `${process.env.REACT_APP_API_BASE_URL}apschart/dashboard-summary`;
  const tabs = summaryOnly
    ? [
        { key: "all", label: "All", abbrev: "All", icon: Target },
        { key: "compare", label: "Compare", icon: Shuffle },
      ]
    : [
        { key: "all", label: "All", abbrev: "All", icon: Target },
        { key: "compare", label: "Compare", icon: Shuffle },
      ];

  useEffect(() => {
    if (summaryOnly && !["all", "compare"].includes(activeTab)) {
      setActiveTab("all");
    }
  }, [activeTab, summaryOnly]);

  useEffect(() => {
    const triggerRefresh = () => {
      setDashboardRefreshToken((current) => current + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerRefresh();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        triggerRefresh();
      }
    }, 30000);

    window.addEventListener("focus", triggerRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", triggerRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadDashboardSummary = async () => {
      setDashboardSummaryLoading(true);
      setDashboardSummaryError("");

      try {
        const response = await fetch(dashboardSummaryApi, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        setDashboardSummary(payload);
      } catch (error) {
        if (!active) {
          return;
        }

        console.error("Procurement dashboard summary fetch error:", error);
        setDashboardSummary(null);
        setDashboardSummaryError(
          error instanceof Error ? error.message : "Failed to load dashboard summary.",
        );
      } finally {
        if (active) {
          setDashboardSummaryLoading(false);
        }
      }
    };

    loadDashboardSummary();

    return () => {
      active = false;
    };
  }, [dashboardRefreshToken, dashboardSummaryApi, headerRefreshToken]);

  return (
    <Fragment>
      <Container fluid className="dashboard-default-sec audit-dashboard-page procurement-dashboard-page">
        <Row className="audit-dashboard-shell g-3">
          {summaryOnly && (
            <div className="col-12">
              <CrossStreamDashboardNotice
                moduleLabel="Procurement"
                userStream={user?.stream}
              />
            </div>
          )}

          <DashboardHeader
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            rightActiveTab={activeTab}
            onRightTabChange={setActiveTab}
          />

          {activeTab === "all" && (
            <RenderProcureAll
              key={`procurement-all-${headerRefreshToken}`}
              activeTab={activeTab}
              summaryOnly={summaryOnly}
              summaryPayload={dashboardSummary}
              summaryLoading={dashboardSummaryLoading}
              summaryError={dashboardSummaryError}
            />
          )}
          {activeTab === "compare" && (
            <RenderDashCompare
              key={`procurement-compare-${headerRefreshToken}`}
              summaryOnly={summaryOnly}
              summaryPayload={dashboardSummary}
              summaryLoading={dashboardSummaryLoading}
              summaryError={dashboardSummaryError}
            />
          )}
        </Row>
      </Container>
    </Fragment>
  );
};

export default DashboardProcurement;
