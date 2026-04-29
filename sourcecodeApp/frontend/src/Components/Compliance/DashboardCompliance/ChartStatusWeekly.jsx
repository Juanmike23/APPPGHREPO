/*
 * PGH-DOC
 *
 * File: src/Components/Compliance/DashboardCompliance/ChartStatusWeekly.jsx
 *
 * Apa fungsi bagian ini:
 *
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 *
 * Kenapa perlu:
 *
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 *
 * Aturan khususnya apa:
 *
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 *
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 *
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useMemo, useState } from "react";
import PieChartClass from "../../../Variables/Chart/PieChartMultiple";
import { Card, CardBody } from "@pgh/ui-bootstrap";
import FeedbackState from "../../Common/FeedbackState";
import { buildWeeklyScopeApiUrl } from "../Weekly/useWeeklyPeriods";

const WeeklyStatusPie = ({
  blockedMessage = "",
  selectedTableId = null,
  refreshKey = 0,
  onDrilldown = null,
}) => {
  const [dataMap, setDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasData = Object.keys(dataMap).length > 0;

  useEffect(() => {
    let isCancelled = false;

    const fetchStatusSummary = async () => {
      try {
        setLoading(true);
        setError("");

        const baseUrl = String(process.env.REACT_APP_API_BASE_URL || "").replace(
          /\/$/,
          "",
        );
        const summaryUrl = buildWeeklyScopeApiUrl(
          baseUrl,
          "WeeklyTable/status-summary",
          {
            tableId: selectedTableId,
          },
        );
        const res = await fetch(summaryUrl, { credentials: "include" });
        const json = await res.json();

        if (isCancelled) {
          return;
        }

        setDataMap(json || {});
      } catch (e) {
        if (isCancelled) {
          return;
        }

        console.error("Failed to load status summary", e);
        setError(
          e instanceof Error ? e.message : "Gagal memuat status compliance.",
        );

        if (!hasData) {
          setDataMap({});
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchStatusSummary();

    return () => {
      isCancelled = true;
    };
  }, [hasData, refreshKey, selectedTableId]);

  const chartData = useMemo(() => {
    const entries = Object.entries(dataMap);
    if (entries.length === 0) {
      return [["Label", "Count"]];
    }

    return [
      ["Label", "Count"],
      ...entries.map(([status, count]) => [status, count]),
    ];
  }, [dataMap]);

  if (loading && !hasData) {
    return (
      <FeedbackState
        variant="loading"
        title="Loading status summary"
        description="Ringkasan status compliance sedang dimuat."
        compact
      />
    );
  }

  if (error && !hasData) {
    return (
      <FeedbackState
        variant="error"
        title="Failed to load status summary"
        description={error}
        compact
      />
    );
  }

  return (
    <Card className="compliance-dashboard-card compliance-dashboard-card--chart h-100">
      <CardBody className="compliance-dashboard-mini-card-body compliance-dashboard-mini-card-body--pie d-flex flex-column">
        <div className="compliance-dashboard-clickable-tile">
          <PieChartClass
            title="Status Compliance"
            chartcolumn="Status"
            chartData={chartData}
            legendPosition="left"
            showLegend
            showLine
            compact={false}
            pieSizeOverride={212}
            dashboardLayout
            navigatePath={null}
            onDrilldown={blockedMessage ? null : onDrilldown}
            blockedMessage={blockedMessage}
            normalizeDrilldownValue={false}
          />
        </div>
        {loading && hasData ? (
          <div
            style={{
              marginTop: "0.5rem",
              textAlign: "center",
              fontSize: "0.78rem",
              color: "#64748b",
            }}
          >
            Memperbarui status compliance...
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
};

export default WeeklyStatusPie;
