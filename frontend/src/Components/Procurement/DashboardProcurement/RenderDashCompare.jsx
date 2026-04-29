/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/RenderDashCompare.jsx
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
import { Disc, PlusCircle } from "react-feather";

import CardDashboard from "../../../Variables/CardDashboard";
import ProcurementStatusDualView from "./ProcurementStatusDualView";
import RemainderCusClass from "./RemainderCusClass";
import { buildProcurementDrilldownUrl } from "../APS/procurementViewState";

const DETAIL_LOCKED_MESSAGE = "Detail hanya tersedia untuk stream pemilik dashboard.";

const STREAM_CONFIGS = [
  {
    key: "new",
    title: "New Procurement",
    icon: <PlusCircle size={24} />,
    linkLabel: "See New",
    valueIndex: 0,
  },
  {
    key: "existing",
    title: "Existing Procurement",
    icon: <Disc size={24} />,
    linkLabel: "See Existing",
    valueIndex: 1,
  },
];

const RenderProcureCompare = ({
  summaryOnly = false,
  summaryPayload = null,
  summaryLoading = false,
  summaryError = "",
}) => {
  const navigate = useNavigate();
  const overviewPayload = summaryPayload;
  const overviewLoading = summaryLoading;
  const overviewError = summaryError;

  const handleStatusDrilldown = useCallback(
    ({ streamKey, label }) => {
      if (summaryOnly) {
        return false;
      }

      navigate(
        buildProcurementDrilldownUrl({
          tab: "all",
          chartColumn: "Status_Pengadaan",
          label,
          secondaryColumn: "Source",
          secondaryLabel: streamKey,
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
        {STREAM_CONFIGS.map((stream) => {
          const navigateTo = summaryOnly
            ? "#"
            : buildProcurementDrilldownUrl({
                tab: "all",
                secondaryColumn: "Source",
                secondaryLabel: stream.key,
              });

          return (
            <Col
              key={`metric-${stream.key}`}
              xl="6"
              md="6"
              className="audit-dashboard-col audit-dashboard-appear"
            >
              <CardDashboard
                title={stream.title}
                icon={stream.icon}
                externalData={overviewPayload}
                externalLoading={overviewLoading}
                externalError={overviewError}
                navigateTo={navigateTo}
                linkLabel="See Detail"
                blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
                extractData={(data) => ({
                  total:
                    data?.Overview?.Values?.[stream.valueIndex] ??
                    data?.overview?.Values?.[stream.valueIndex] ??
                    data?.overview?.values?.[stream.valueIndex] ??
                    (stream.key === "new"
                      ? data?.Overview?.New ?? data?.overview?.New ?? data?.overview?.new
                      : data?.Overview?.Existing ?? data?.overview?.Existing ?? data?.overview?.existing) ??
                    data.Values?.[stream.valueIndex] ??
                    (stream.key === "new" ? data.New : data.Existing) ??
                    0,
                  subInfo: stream.title,
                })}
                fallbackToTitle={false}
                insertheight={365}
                valueFontSize="2.2rem"
              />
            </Col>
          );
        })}
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        {STREAM_CONFIGS.map((stream) => {
          return (
            <Col
              key={`bar-${stream.key}`}
              xl="6"
              md="6"
              className="audit-dashboard-col audit-dashboard-appear"
            >
              <ProcurementStatusDualView
                externalData={
                  summaryPayload?.StatusCounts?.[stream.key] ??
                  summaryPayload?.statusCounts?.[stream.key] ??
                  []
                }
                externalLoading={summaryLoading}
                externalError={summaryError}
                title={`Status Pengadaan ${stream.key === "new" ? "New" : "Existing"}`}
                onDrilldown={({ label }) =>
                  handleStatusDrilldown({ streamKey: stream.key, label })
                }
                blockedMessage={summaryOnly ? DETAIL_LOCKED_MESSAGE : ""}
                cardClassName="audit-dashboard-card audit-dashboard-card--chart"
                type={stream.key}
              />
            </Col>
          );
        })}
      </Row>

      <Row className="audit-dashboard-row g-3 align-items-stretch">
        {STREAM_CONFIGS.map((stream) => (
          <Col
            key={`reminder-${stream.key}`}
            xl="6"
            md="6"
            className="audit-dashboard-col audit-dashboard-appear"
          >
            <RemainderCusClass
              activeTab={stream.key}
              compare
              summaryOnly={summaryOnly}
              externalRows={
                summaryPayload?.Reminders?.[stream.key] ??
                summaryPayload?.reminders?.[stream.key] ??
                []
              }
              externalCounts={
                summaryPayload?.ReminderCounts ?? summaryPayload?.reminderCounts ?? {}
              }
              externalLoading={summaryLoading}
              externalError={summaryError}
            />
          </Col>
        ))}
      </Row>
    </Fragment>
  );
};

export default RenderProcureCompare;
