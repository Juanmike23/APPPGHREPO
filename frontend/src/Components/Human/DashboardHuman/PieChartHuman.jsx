/*
 * PGH-DOC
 * File: src/Components/Human/DashboardHuman/PieChartHuman.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useMemo } from "react";
import PieChartView from "../../../Variables/Chart/PieChartMultiple";
import FeedbackState from "../../Common/FeedbackState";
import { canonicalizeHumanDepartment } from "../shared/departmentCanonical";

const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${PUBLIC_URL}${normalizedPath}`;
};

const TAB_ALIASES = {
  allresource: "fte",
  fte: "fte",
  nonfte: "nonfte",
  kebutuhanfte: "kebutuhanfte",
};

const pickCaseInsensitive = (source, key) => {
  if (!source || typeof source !== "object") return undefined;
  const targetKey = String(key || "").toLowerCase();
  return Object.entries(source).find(
    ([entryKey]) => String(entryKey).toLowerCase() === targetKey,
  )?.[1];
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    if (Array.isArray(value.$values)) return value.$values;
    if (Array.isArray(value.values)) return value.values;
    if (Array.isArray(value.items)) return value.items;
  }
  return [];
};

const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = trimmed
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  return 0;
};

const rankRows = (mapValueByLabel, take = 5) =>
  Object.entries(mapValueByLabel)
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, take)
    .map(([label, value]) => [label, Number(value)]);

const PieChartHuman = ({
  data,
  title = "Human Chart",
  colClass,
  chartcolumn,
  is3D = true,
  pieHole = 0.3,
  onSelect,
  activeTab,
  mode,
  blockedMessage = "",
  showLegend = true,
  showLine = true,
  compact = false,
  pieSizeOverride = null,
  dashboardLayout = false,
  externalLoading = false,
  externalError = false,
}) => {
  const resolvedTab = TAB_ALIASES[chartcolumn?.toLowerCase()] || "?";
  const titleNavigatePath = `${buildAppPath("/human/resource")}?tab=${resolvedTab}`;

  const chartData = useMemo(() => {
    if (!data) {
      return [["Label", "Count"]];
    }

    const lowerColumn = String(mode ?? chartcolumn ?? "total")
      .trim()
      .toLowerCase();
    const keyMap = {
      allresource: "TotalEmployeeChart",
      total: "TotalEmployeeChart",
      fte: "FteChart",
      nonfte: "NonFteChart",
      gap: "GapChart",
      kebutuhanfte: "GapChart",
    };

    const targetKey = keyMap[lowerColumn];
    const selectedChart =
      data[targetKey] ?? pickCaseInsensitive(data, targetKey) ?? data;

    const labels = asArray(
      selectedChart?.Labels ??
        selectedChart?.labels ??
        pickCaseInsensitive(selectedChart, "labels"),
    );
    const values = asArray(
      selectedChart?.Values ??
        selectedChart?.values ??
        pickCaseInsensitive(selectedChart, "values"),
    );

    let rows = [];

    if (labels.length > 0 && values.length > 0) {
      const safeLength = Math.min(labels.length, values.length);
      rows = labels.slice(0, safeLength).map((label, index) => [
        String(label ?? "").trim(),
        toFiniteNumber(values[index]),
      ]);
    } else if (Array.isArray(selectedChart)) {
      rows = selectedChart.map((row) => [
        String(
          row?.Label ??
            row?.label ??
            row?.Name ??
            row?.name ??
            row?.Department ??
            row?.department ??
            "",
        ).trim(),
        toFiniteNumber(
          row?.Value ?? row?.value ?? row?.Count ?? row?.count ?? 0,
        ),
      ]);
    } else if (selectedChart && typeof selectedChart === "object") {
      const objectRows = asArray(
        selectedChart?.Rows ??
          selectedChart?.rows ??
          selectedChart?.Data ??
          selectedChart?.data ??
          pickCaseInsensitive(selectedChart, "rows") ??
          pickCaseInsensitive(selectedChart, "data"),
      );

      if (objectRows.length > 0) {
        rows = objectRows.map((row) => [
          String(
            row?.Label ??
              row?.label ??
              row?.Name ??
              row?.name ??
              row?.Department ??
              row?.department ??
              "",
          ).trim(),
          toFiniteNumber(
            row?.Value ?? row?.value ?? row?.Count ?? row?.count ?? 0,
          ),
        ]);
      } else {
        rows = Object.entries(selectedChart).map(([label, value]) => [
          String(label ?? "").trim(),
          toFiniteNumber(value),
        ]);
      }
    }

    const canonicalRows = rows.reduce((accumulator, [rawLabel, rawValue]) => {
      const label = canonicalizeHumanDepartment(rawLabel);
      const value = toFiniteNumber(rawValue);
      if (!label || value <= 0) {
        return accumulator;
      }

      accumulator[label] = (accumulator[label] || 0) + value;
      return accumulator;
    }, {});

    let normalizedRows = rankRows(canonicalRows, 5);
    const normalizedActiveTab = String(activeTab ?? "")
      .trim()
      .toUpperCase();

    if (normalizedActiveTab && normalizedActiveTab !== "ALL") {
      normalizedRows = normalizedRows.filter(
        ([label]) =>
          String(label ?? "").trim().toUpperCase() === normalizedActiveTab,
      );
    }

    return [["Label", "Count"], ...normalizedRows];
  }, [activeTab, chartcolumn, data, mode]);

  const loading = Boolean(externalLoading);
  const error = externalError
    ? typeof externalError === "string"
      ? externalError
      : "Failed to load chart."
    : "";

  if (loading) {
    return (
      <FeedbackState
        variant="loading"
        title="Loading chart"
        description="Chart sedang dimuat."
        compact
      />
    );
  }

  if (error && chartData.length <= 1) {
    return (
      <FeedbackState
        variant="error"
        title="Failed to load chart"
        description={error}
        compact
      />
    );
  }

  return (
    <div
      className={colClass}
      onClick={() => {
        if (!blockedMessage) {
          onSelect?.(chartcolumn, mode);
        }
      }}
      style={{
        cursor:
          typeof onSelect === "function" && !blockedMessage
            ? "pointer"
            : "default",
      }}
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
        titleNavigatePath={blockedMessage ? null : titleNavigatePath}
        navigatePath={
          blockedMessage
            ? null
            : `${buildAppPath("/human/resource")}?tab=${resolvedTab}&chartcolumn=Department&table={chartcolumn}&label={label}`
        }
        blockedMessage={blockedMessage}
        normalizeDrilldownValue={false}
        dashboardLayout={dashboardLayout}
        enableTitleNavigation={false}
      />
    </div>
  );
};

export default PieChartHuman;
