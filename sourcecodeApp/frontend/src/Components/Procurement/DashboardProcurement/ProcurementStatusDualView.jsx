/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/ProcurementStatusDualView.jsx
 * Apa fungsi bagian ini:
 * - Menampilkan Funnel Tahap status procurement sesuai urutan checkpoint template.
 * Kenapa perlu:
 * - User bisa melihat progres lengkap, termasuk checkpoint yang belum terisi (nilai 0).
 * Aturan khususnya apa:
 * - Urutan kategori diambil dari template status pengadaan.
 * - Klik bar tetap bisa drilldown ke Procurement List jika akses diizinkan.
 */

import React, { useCallback, useMemo } from "react";
import ReactApexChart from "react-apexcharts";
import { Card } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";

const COUNT_KEYS = ["CurrentCount", "currentCount", "Count", "count", "DoneCount", "doneCount", "Jumlah", "jumlah"];
const TOTAL_KEYS = ["Total", "total", "TotalCount", "totalCount"];
const CUMULATIVE_KEYS = ["CumulativeDoneCount", "cumulativeDoneCount", "DoneCount", "doneCount"];
const NOT_YET_KEYS = ["NotYetCount", "notYetCount", "NotDoneCount", "notDoneCount"];
const PERCENTAGE_KEYS = ["Percentage", "percentage", "CurrentPercentage", "currentPercentage"];
const COMPLETION_KEYS = ["CompletionRate", "completionRate"];
const ORDER_KEYS = ["Index", "index", "SortOrder", "sortOrder"];
const LABEL_KEYS = ["Value", "value", "Label", "label", "Name", "name", "Status", "status"];

const normalizeCategoryKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const toCategoryOverrideMap = (value) => {
  if (!value || typeof value !== "object") {
    return new Map();
  }

  return new Map(
    Object.entries(value)
      .map(([key, label]) => [normalizeCategoryKey(key), String(label ?? "").trim()])
      .filter(([, label]) => label.length > 0),
  );
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getLabelValue = (item) => {
  if (item == null) return "";
  if (typeof item !== "object") return String(item);
  for (const key of LABEL_KEYS) {
    const value = item?.[key];
    if (value != null && String(value).trim().length > 0) {
      return String(value);
    }
  }
  return "";
};

const getCountValue = (item) => {
  if (item == null || typeof item !== "object") return 0;
  for (const key of COUNT_KEYS) {
    const value = item?.[key];
    if (value != null && String(value).trim().length > 0) {
      return toFiniteNumber(value);
    }
  }
  return 0;
};

const resolveSeriesColor = (type) => {
  const normalized = String(type ?? "all").trim().toLowerCase();
  if (normalized === "new") return "#f15a22";
  if (normalized === "existing") return "#f47c4c";
  return "#f15a22";
};

const isDarkModeActive = () =>
  typeof document !== "undefined" && document.body?.classList?.contains("dark-only");

const ProcurementStatusDualView = ({
  type = "all",
  title = "Status Pengadaan",
  blockedMessage = "",
  onDrilldown = null,
  labelOverrides = null,
  cardClassName = "",
  externalData = [],
  externalLoading = false,
  externalError = "",
}) => {
  const normalizedLabelOverrides = useMemo(
    () => toCategoryOverrideMap(labelOverrides),
    [labelOverrides],
  );

  const sourceRows = useMemo(
    () => (Array.isArray(externalData) ? externalData : []),
    [externalData],
  );

  const rows = useMemo(() => {
    const aggregate = new Map();

    const readNumberFromKeys = (item, keys) => {
      for (const key of keys) {
        const value = item?.[key];
        if (value != null && String(value).trim().length > 0) {
          return toFiniteNumber(value);
        }
      }
      return null;
    };

    const readOrder = (item, fallbackOrder) => {
      for (const key of ORDER_KEYS) {
        const value = item?.[key];
        if (value != null && String(value).trim().length > 0) {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }
      }

      return fallbackOrder;
    };

    sourceRows.forEach((item, index) => {
      const rawLabel = getLabelValue(item);
      const rawCount = getCountValue(item);
      const rawTotal = readNumberFromKeys(item, TOTAL_KEYS);
      const rawOrder = readOrder(item, index + 1);
      if (!rawLabel) {
        return;
      }

      const override = normalizedLabelOverrides.get(normalizeCategoryKey(rawLabel));
      const finalLabel = override || rawLabel;
      const key = normalizeCategoryKey(finalLabel);

      if (!aggregate.has(key)) {
        aggregate.set(key, {
          key,
          label: finalLabel,
          count: 0,
          total: 0,
          cumulativeDone: 0,
          notYet: 0,
          percentage: null,
          completionRate: null,
          order: rawOrder,
        });
      }

      const current = aggregate.get(key);
      current.count += rawCount;
      const cumulativeDone = readNumberFromKeys(item, CUMULATIVE_KEYS);
      const notYet = readNumberFromKeys(item, NOT_YET_KEYS);
      const percentage = readNumberFromKeys(item, PERCENTAGE_KEYS);
      const completionRate = readNumberFromKeys(item, COMPLETION_KEYS);
      const derivedTotal = rawTotal ?? rawCount;
      current.total = Math.max(current.total, derivedTotal);
      if (cumulativeDone !== null) {
        current.cumulativeDone = Math.max(current.cumulativeDone, cumulativeDone);
      }
      if (notYet !== null) {
        current.notYet = Math.max(current.notYet, notYet);
      }
      if (percentage !== null) {
        current.percentage = percentage;
      }
      if (completionRate !== null) {
        current.completionRate = completionRate;
      }
      current.order = Math.min(current.order, rawOrder);
    });

    return Array.from(aggregate.values())
      .filter((row) => normalizeCategoryKey(row.label) !== "data belum diisi")
      .sort((a, b) => a.order - b.order);
  }, [normalizedLabelOverrides, sourceRows]);

  const seriesColor = resolveSeriesColor(type);
  const darkMode = isDarkModeActive();
  const resolvedLoading = Boolean(externalLoading);
  const resolvedError =
    typeof externalError === "string"
      ? externalError
      : externalError
        ? "Failed to load chart."
        : "";

  const handleClick = useCallback(
    (label) => {
      if (!label) {
        return;
      }

      if (blockedMessage) {
        toast.info(blockedMessage);
        return;
      }

      if (typeof onDrilldown === "function") {
        onDrilldown({ label });
      }
    },
    [blockedMessage, onDrilldown],
  );

  const funnelOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        animations: { enabled: true },
        events: {
          dataPointSelection: (_, __, config) => {
            const label = rows?.[config?.dataPointIndex]?.label;
            handleClick(label);
          },
        },
      },
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: false,
          borderRadius: 4,
          barHeight: "68%",
        },
      },
      colors: [seriesColor],
      dataLabels: {
        enabled: true,
        formatter: (value) => `${Math.round(Number(value) || 0)}`,
        style: {
          colors: [darkMode ? "#ffffff" : "#24364a"],
          fontWeight: 700,
        },
      },
      xaxis: {
        categories: rows.map((row) => row.label),
        labels: {
          formatter: (value) => `${Math.round(Number(value) || 0)}`,
        },
      },
      yaxis: {
        labels: {
          maxWidth: 210,
          style: { fontSize: "11px" },
        },
      },
      tooltip: {
        shared: false,
        intersect: true,
        custom: ({ dataPointIndex }) => {
          const row = rows?.[dataPointIndex];
          const label = row?.label ?? "-";
          const current = toFiniteNumber(row?.count ?? 0);
          const total = Math.max(toFiniteNumber(row?.total ?? 0), current);
          const percentValue = row?.percentage != null
            ? Number(row.percentage)
            : (total > 0 ? (current / total) * 100 : 0);
          const percent = Number.isFinite(percentValue) ? percentValue.toFixed(1) : "0.0";
          return `<div class="px-2 py-1">
            <div><strong>${label}</strong></div>
            <div>Jumlah: ${Math.round(current)}</div>
            <div>Persentase dari total stream: ${percent}% (${Math.round(current)}/${Math.round(total)})</div>
          </div>`;
        },
      },
      grid: {
        borderColor: "rgba(148,163,184,0.2)",
        strokeDashArray: 4,
      },
      legend: {
        show: false,
      },
    }),
    [darkMode, handleClick, rows, seriesColor],
  );

  return (
    <Card className={`${cardClassName} h-100`.trim()}>
      <div className="m-4 procurement-status-dual">
        <h5 className="text-center m-0" style={{ fontSize: 16 }}>
          {title}
        </h5>

        {resolvedLoading ? (
          <div className="audit-dashboard-placeholder audit-dashboard-placeholder--chart mt-4">
            <span className="audit-dashboard-placeholder__line audit-dashboard-placeholder__line--strong" />
            <span className="audit-dashboard-placeholder__line" />
            <span className="audit-dashboard-placeholder__line audit-dashboard-placeholder__line--short" />
          </div>
        ) : resolvedError && rows.length === 0 ? (
          <div
            className="d-flex align-items-center justify-content-center text-muted"
            style={{ minHeight: 180 }}
          >
            <small>{resolvedError}</small>
          </div>
        ) : rows.length === 0 ? (
          <div
            className="d-flex align-items-center justify-content-center text-muted"
            style={{ minHeight: 180 }}
          >
            <small>You haven't input the data yet.</small>
          </div>
        ) : (
          <div className="procurement-status-dual__panel mt-2">
            <div className="procurement-status-dual__title">Distribusi Status Procurement</div>
            <small className="d-block text-muted mb-2">
              Persentase = jumlah status / total procurement pada stream yang sama.
            </small>
            <ReactApexChart
              type="bar"
              height={Math.max(260, rows.length * 38)}
              options={funnelOptions}
              series={[
                {
                  name: "Jumlah",
                  data: rows.map((row) => toFiniteNumber(row.count)),
                },
              ]}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default ProcurementStatusDualView;
