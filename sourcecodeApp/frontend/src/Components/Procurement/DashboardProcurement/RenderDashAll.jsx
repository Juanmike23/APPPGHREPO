/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/RenderDashAll.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Col, Row } from "@pgh/ui-bootstrap";
import { Target } from "react-feather";

import CardDashboard from "../../../Variables/CardDashboard";
import RemainderCusClass from "./RemainderCusClass";
import ProcurementStatusDualView from "./ProcurementStatusDualView";
import { buildProcurementDrilldownUrl } from "../APS/procurementViewState";

const DETAIL_LOCKED_MESSAGE = "Detail hanya tersedia untuk stream pemilik dashboard.";

const RenderProcureAll = ({
  activeTab,
  summaryOnly = false,
  summaryPayload = null,
  summaryLoading = false,
  summaryError = "",
}) => {
  const navigate = useNavigate();
  const detailNavigateTo = summaryOnly ? "#" : buildProcurementDrilldownUrl({ tab: "all" });
  const reminderCounts = summaryPayload?.ReminderCounts ?? summaryPayload?.reminderCounts ?? {};
  const reminderRows = summaryPayload?.Reminders?.all ?? summaryPayload?.reminders?.all ?? [];
  const statusRows =
    summaryPayload?.StatusCounts?.all ??
    summaryPayload?.statusCounts?.all ??
    [];

  const handleStatusDrilldown = useCallback(
    ({ label }) => {
      if (summaryOnly) {
        return false;
      }

      navigate(
        buildProcurementDrilldownUrl({
          tab: "all",
          chartColumn: "Status_Pengadaan",
          label,
        }),
        {
          state: {
            chartcolumn: "Status_Pengadaan",
            label,
          },
        },
      );

      return true;
    },
    [navigate, summaryOnly],
  );

  return (
    <Fragment>
      <Row className="audit-dashboard-row g-3 align-items-stretch">
        <Col
          xl="12"
          md="12"
          className="audit-dashboard-col audit-dashboard-appear"
        >
          <CardDashboard
            title="All Procurement"
            icon={<Target size={24} />}
            externalData={summaryPayload}
            externalLoading={summaryLoading}
            externalError={summaryError}
            navigateTo={detailNavigateTo}
            linkLabel="See Detail"
            blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
            extractData={(data) => ({
              total: data?.Overview?.Total ?? data?.overview?.total ?? data?.overview?.Total ?? data.Total ?? data.total ?? 0,
              subInfo: "All Procurement",
            })}
            fallbackToTitle={false}
            insertheight={365}
            valueFontSize="2.2rem"
          />
        </Col>
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        <Col
          xl="12"
          md="12"
          className="audit-dashboard-col audit-dashboard-appear"
        >
          <ProcurementStatusDualView
            externalData={statusRows}
            externalLoading={summaryLoading}
            externalError={summaryError}
            title="Status Pengadaan"
            onDrilldown={handleStatusDrilldown}
            blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
            cardClassName="audit-dashboard-card audit-dashboard-card--chart"
            type="all"
          />
        </Col>
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        <Col
          xl="12"
          md="12"
          className="audit-dashboard-col audit-dashboard-appear"
        >
          <RemainderCusClass
            activeTab="all"
            summaryOnly={summaryOnly}
            externalRows={reminderRows}
            externalCounts={reminderCounts}
            externalLoading={summaryLoading}
            externalError={summaryError}
          />
        </Col>
      </Row>
    </Fragment>
  );
};

export default RenderProcureAll;
