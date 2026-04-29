/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/PieChartAudit.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// PieChartContainer.jsx
import React, { useMemo } from "react";
import PieChartView from "../../../Variables/Chart/PieChartMultiple";
import FeedbackState from "../../Common/FeedbackState";
import { getAuditChartCanonicalColumn } from "../Utils/columnHelpers";
import { getAuditChartLabel } from "../Utils/auditValueLabels";

const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${PUBLIC_URL}${normalizedPath}`;
};

const normalizeRows = (payload) =>
  Array.isArray(payload) ? payload : payload?.rows || payload?.data || payload?.value || [];

const buildChartData = (payload, chartcolumn) => {
  const rows = normalizeRows(payload);

  const hasExplicitCount = rows.some(
    (row) =>
      row &&
      typeof row === "object" &&
      (row.Count != null || row.count != null || row.Total != null || row.total != null) &&
      (row.Label != null ||
        row.label != null ||
        row.Value != null ||
        row.value != null ||
        row.Name != null ||
        row.name != null ||
        (chartcolumn && row[chartcolumn] != null)),
  );

  if (hasExplicitCount) {
    const aggregated = rows.reduce((accumulator, row) => {
      const key =
        getAuditChartLabel(
          row?.Label ??
            row?.label ??
            row?.Value ??
            row?.value ??
            row?.Name ??
            row?.name ??
            (chartcolumn ? row?.[chartcolumn] : null),
          chartcolumn,
        );

      const amount = Number(
        row?.Count ?? row?.count ?? row?.Total ?? row?.total ?? 0,
      );

      accumulator[key] = (accumulator[key] || 0) + (Number.isFinite(amount) ? amount : 0);
      return accumulator;
    }, {});

    return [["Label", "Count"], ...Object.entries(aggregated)];
  }

  const counts = rows.reduce((accumulator, row) => {
    const key = getAuditChartLabel(
      row?.[chartcolumn] ?? row?.Value ?? row?.value,
      chartcolumn,
    );
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return [["Label", "Count"], ...Object.entries(counts)];
};

const PieChartAudit = ({
  data,
  title = "Audit Chart",
  colClass,
  chartcolumn,
  is3D = true,
  pieHole = 0.3,
  onSelect,
  type,
  navigatePath = `${buildAppPath("/audit/listAudit")}?chartcolumn={chartcolumn}&label={label}&type=${type}`,
  clickable = true,
  blockedMessage = "",
  showLegend = true,
  showLine = true,
  compact = false,
  pieSizeOverride = null,
  onDrilldown,
  dashboardLayout = false,
  externalLoading = false,
  externalError = "",
}) => {
  const safeChartColumn = getAuditChartCanonicalColumn(chartcolumn);
  const chartData = useMemo(
    () => (data != null ? buildChartData(data, chartcolumn) : [["Label", "Count"]]),
    [chartcolumn, data],
  );
  const invalidState = false;
  const resolvedLoading = externalLoading;
  const resolvedError = externalError;

  if (!safeChartColumn && chartcolumn) {
    return (
      <FeedbackState
        variant="restricted"
        title="Invalid chart state"
        description="Kolom chart ini sudah tidak tersedia. Silakan pilih kolom bisnis Audit yang valid."
        compact
      />
    );
  }

  if (resolvedLoading) {
    return (
      <FeedbackState
        variant="loading"
        title="Loading chart"
        description="Chart sedang dimuat."
        compact
      />
    );
  }

  if (invalidState) {
    return (
      <FeedbackState
        variant="restricted"
        title="Invalid chart state"
        description="Kolom chart ini sudah tidak tersedia. Pilih ulang chart Audit dari kolom bisnis yang valid."
        compact
      />
    );
  }

  if (resolvedError && chartData.length <= 1) {
    return (
      <FeedbackState
        variant="error"
        title="Failed to load chart"
        description={resolvedError}
        compact
      />
    );
  }

  return (
    <div
      className={colClass}
      onClick={clickable && typeof onSelect === "function" ? () => onSelect(chartcolumn) : undefined}
      style={{ cursor: clickable && typeof onSelect === "function" ? "pointer" : "default" }}
    >
      <PieChartView
        title={title}
        chartcolumn={chartcolumn}
        chartData={chartData}
        showLegend={showLegend}
        showLine={showLine}
        compact={compact}
        pieSizeOverride={pieSizeOverride}
        is3D={is3D}
        pieHole={pieHole}
        navigatePath={navigatePath}
        blockedMessage={blockedMessage}
        onDrilldown={onDrilldown}
        dashboardLayout={dashboardLayout}
      />
    </div>
  );
};

export default PieChartAudit;
