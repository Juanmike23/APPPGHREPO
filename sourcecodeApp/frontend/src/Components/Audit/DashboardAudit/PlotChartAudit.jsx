/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/PlotChartAudit.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import { Card, Col } from "@pgh/ui-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import FeedbackState from "../../Common/FeedbackState";
import {
  getAuditChartLabel,
  toAuditFilterValue,
} from "../Utils/auditValueLabels";

const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${PUBLIC_URL}${normalizedPath}`;
};

const COUNT_KEYS = ["Count", "count", "Total", "total", "Jumlah", "jumlah"];
const LABEL_KEYS = ["Value", "value", "Label", "label", "Name", "name"];

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizePayloadRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const labels = payload.Labels || payload.labels;
  const values = payload.Values || payload.values;

  if (Array.isArray(labels) && Array.isArray(values)) {
    return labels.map((label, index) => ({
      label: String(label),
      count: toFiniteNumber(values[index]),
    }));
  }

  for (const key of ["rows", "data", "items", "results", "result", "value"]) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return Object.entries(payload)
    .filter(([, value]) => typeof value !== "object")
    .map(([label, count]) => ({
      label: String(label),
      count: toFiniteNumber(count),
    }));
};

const buildSeriesRows = (payload) => {
  const rows = normalizePayloadRows(payload);
  const hasExplicitCounts = rows.some((item) => {
    if (!item || typeof item !== "object") return false;

    return (
      LABEL_KEYS.some((key) => item[key] != null && item[key] !== "") &&
      COUNT_KEYS.some((key) => item[key] != null && item[key] !== "")
    );
  });

  if (hasExplicitCounts) {
    return rows
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        const labelKey = LABEL_KEYS.find((key) => item[key] != null && item[key] !== "");
        const countKey = COUNT_KEYS.find((key) => item[key] != null && item[key] !== "");

        if (!labelKey || !countKey) return null;

        return {
          label: String(item[labelKey]),
          count: toFiniteNumber(item[countKey]),
        };
      })
      .filter(Boolean);
  }

  if (
    rows.every(
      (item) =>
        item &&
        typeof item === "object" &&
        item.label != null &&
        item.count != null,
    )
  ) {
    return rows.map((item) => ({
      label: String(item.label),
      count: toFiniteNumber(item.count),
    }));
  }

  const grouped = {};

  rows.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const label =
      getAuditChartLabel(
        item.Value ??
          item.value ??
          item.Label ??
          item.label ??
          item.Name ??
          item.name,
        "TAHUN",
      );

    const count = COUNT_KEYS.reduce((found, key) => {
      if (found != null) return found;
      return item[key] != null ? toFiniteNumber(item[key]) : null;
    }, null);

    grouped[label] = (grouped[label] || 0) + (count ?? 1);
  });

  return Object.entries(grouped).map(([label, count]) => ({
    label: String(label),
    count: toFiniteNumber(count),
  }));
};

const PlotChartTahun = ({
  data: dataOverride,
  type,
  title = "Year",
  navigatePath = `${buildAppPath("/audit/listAudit")}?chartcolumn=TAHUN&label={label}&type=${type}`,
  blockedMessage = "",
  cardClassName = "",
  chartcolumn = "TAHUN",
  onDrilldown = null,
  externalLoading = false,
  externalError = "",
}) => {
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const resolvedLoading = externalLoading;
  const resolvedError = externalError;

  const { labels, counts } = useMemo(() => {
    const map = {};

    buildSeriesRows(dataOverride ?? []).forEach(({ label, count }) => {
      const key = getAuditChartLabel(label, "TAHUN");
      map[key] = (map[key] || 0) + count;
    });

    return {
      labels: Object.keys(map),
      counts: Object.values(map),
    };
  }, [dataOverride]);

  const handleClick = useCallback(
    (year) => {
      const normalizedYear = toAuditFilterValue(year, { chartColumn: chartcolumn });

      if (
        typeof onDrilldown === "function" &&
        onDrilldown({
          chartcolumn,
          label: normalizedYear,
          source: "line",
        }) === true
      ) {
        return;
      }

      if (!navigatePath) {
        if (blockedMessage) {
          toast.info(blockedMessage);
        }
        return;
      }

      const path = navigatePath.replace(
        "{label}",
        encodeURIComponent(normalizedYear || "null"),
      );

      navigate(path);
    },
    [blockedMessage, chartcolumn, navigate, navigatePath, onDrilldown],
  );

  useEffect(() => {
    if (!labels.length || !chartRef.current) return undefined;

    const bind = () => {
      const axisLabels = chartRef.current.querySelectorAll(
        ".apexcharts-xaxis-texts-g text",
      );

      axisLabels.forEach((element, index) => {
        element.style.cursor = navigatePath || blockedMessage ? "pointer" : "default";
        element.style.pointerEvents = navigatePath || blockedMessage ? "auto" : "none";

        element.onclick = () => {
          const year = labels[index];
          if (year) handleClick(year);
        };
      });

      const dataLabels = chartRef.current.querySelectorAll(
        ".apexcharts-data-labels text",
      );

      dataLabels.forEach((element, index) => {
        element.style.cursor = navigatePath || blockedMessage ? "pointer" : "default";
        element.style.pointerEvents = navigatePath || blockedMessage ? "auto" : "none";

        element.onclick = () => {
          const year = labels[index];
          if (year) handleClick(year);
        };
      });
    };

    const raf = requestAnimationFrame(bind);
    return () => cancelAnimationFrame(raf);
  }, [blockedMessage, handleClick, labels, navigatePath]);

  const options = useMemo(
    () => ({
      chart: {
        type: "line",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 620,
          animateGradually: { enabled: true, delay: 80 },
          dynamicAnimation: { enabled: true, speed: 280 },
        },
        events: {
          dataPointSelection: (_, __, config) => {
            const year = labels[config.dataPointIndex];
            handleClick(year);
          },
        },
      },

      xaxis: {
        categories: labels,
        labels: {
          style: { fontSize: "11px", cursor: "pointer" },
        },
      },

      yaxis: {
        min: 0,
        labels: { style: { fontSize: "11px" } },
      },

      stroke: { curve: "smooth", width: 3 },

      markers: {
        size: 6,
        strokeWidth: 3,
        hover: { size: 9 },
        strokeColors: "#fff",
        colors: ["#F15A22"],
      },

      tooltip: {
        intersect: false,
        shared: false,
      },

      dataLabels: {
        enabled: true,
        style: { fontSize: "11px" },
      },

      colors: ["#efbaa6"],

      grid: {
        borderColor: "#e0e0e0",
        strokeDashArray: 3,
      },
    }),
    [handleClick, labels],
  );

  const series = useMemo(() => [{ name: "Jumlah", data: counts }], [counts]);

  if (resolvedLoading) {
    return (
      <Card className={`${cardClassName} h-100`.trim()}>
        <Col className="m-4">
          <h5 className="m-0 f-w-400 text-center" style={{ fontSize: "16px" }}>
            {title} {type}
          </h5>
          <div className="audit-dashboard-placeholder audit-dashboard-placeholder--chart">
            <span className="audit-dashboard-placeholder__line audit-dashboard-placeholder__line--strong" />
            <span className="audit-dashboard-placeholder__line" />
            <span className="audit-dashboard-placeholder__line audit-dashboard-placeholder__line--short" />
          </div>
        </Col>
      </Card>
    );
  }

  if (!labels.length) {
    return (
      <Card className={`${cardClassName} h-100`.trim()}>
        <Col className="m-4">
          <h5 className="m-0 f-w-400 text-center" style={{ fontSize: "16px" }}>
            {title} {type}
          </h5>
          <FeedbackState
            variant={resolvedError ? "error" : "empty"}
            title={resolvedError ? "Failed to load chart" : "No data available"}
            description={
              resolvedError
                ? resolvedError
                : "Belum ada data yang bisa ditampilkan untuk chart ini."
            }
            compact
          />
        </Col>
      </Card>
    );
  }

  return (
    <Card className={`${cardClassName} h-100`.trim()}>
      <Col className="m-4">
        <h5
          className="m-0 f-w-400 text-center"
          style={{ fontSize: "16px" }}
        >
          {title} {type}
        </h5>
        <div ref={chartRef}>
          <ReactApexChart
            options={options}
            series={series}
            type="line"
            height={300}
          />
        </div>
      </Col>
    </Card>
  );
};

export default PlotChartTahun;
