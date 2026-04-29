/*
 * PGH-DOC
 * File: src/Components/Planning/DashboardPlanning/Opex/OpexCharts.jsx
 * Apa fungsi bagian ini:
 * - Menyajikan chart interaktif OPEX yang dipakai di dashboard (Load Plot).
 * Kenapa perlu:
 * - Agar visual utama tetap fokus ke monitoring serapan dan tidak terlalu ramai.
 * Aturan khususnya apa:
 * - Sumber data tetap dari payload OPEX (overview + rows), tanpa endpoint chart lama.
 */

import React, { Fragment, useMemo } from "react";
import Charts from "react-apexcharts";
import { Card, CardBody, CardHeader, Col } from "@pgh/ui-bootstrap";
import "../OpexChar.scss";

const CATEGORY_ORDER = [
  "Beban Kantor",
  "Beban Teknologi & Telekomunikasi",
  "Beban Penyusutan dan Amortisasi",
  "Beban Personalia",
  "Beban Lainnya",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const QUARTER_END_MONTH = {
  Q1: "Mar",
  Q2: "Jun",
  Q3: "Sep",
  Q4: "Dec",
};

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const LOAD_PLOT_FALLBACK_COLORS = ["#309e3f", "#B6D96C", "#ffc107", "#F15A22", "#d22d3d"];

const getComputedChartColors = () =>
  Array.from({ length: 5 }, (_, index) => {
    const resolved =
      typeof document !== "undefined"
        ? getComputedStyle(document.documentElement)
            .getPropertyValue(`--chart-bar-p-${index + 1}`)
            .trim()
        : "";

    return resolved || LOAD_PLOT_FALLBACK_COLORS[index] || "#999";
  });

const wrapAxisLabel = (value, maxChars = 16) => {
  const text = String(value ?? "").trim();
  if (!text) return "-";

  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = `${current} ${word}`.trim();
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }

    if (current) lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.join("\n");
};

const OpexPlotCard = ({
  year,
  selectedMonth,
  seriesByParent = {},
  onDrilldown = null,
  wrapInCol = true,
}) => {
  const periodIndex = useMemo(() => {
    const token = String(selectedMonth ?? "").trim();
    if (!token) return 11;
    const monthToken = QUARTER_END_MONTH[token] || token;
    const index = MONTHS.findIndex((month) => month.toLowerCase() === monthToken.toLowerCase());
    if (index < 0) return 11;
    return index;
  }, [selectedMonth]);

  const visibleMonthIndexes = useMemo(() => {
    return Array.from({ length: periodIndex + 1 }, (_, index) => index);
  }, [periodIndex]);
  const visibleMonths = useMemo(
    () => visibleMonthIndexes.map((index) => MONTHS[index]),
    [visibleMonthIndexes],
  );
  const chartColors = useMemo(getComputedChartColors, []);

  const hasData = useMemo(
    () =>
      Object.values(seriesByParent).some((series) =>
        Array.isArray(series) ? series.some((value) => Number(value) > 0) : false,
      ),
    [seriesByParent],
  );

  const baseOptions = useMemo(
    () => ({
      chart: {
        type: "line",
        sparkline: { enabled: true },
        toolbar: { show: false },
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      markers: {
        size: 2,
        strokeWidth: 0,
      },
      legend: { show: false },
      xaxis: {
        categories: visibleMonths,
        labels: { show: false },
      },
      yaxis: { show: false },
      tooltip: {
        y: {
          formatter: (value) =>
            Number(value || 0).toLocaleString("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
        },
      },
      grid: {
        padding: { left: 0, right: 0, top: 0, bottom: 0 },
      },
    }),
    [visibleMonths],
  );

  const content = (
    <Card className="mb-0 overflow-visible planning-opex-legacy-chart-card planning-opex-chart-card planning-opex-plot-card">
        <CardHeader>
          <h6 className="mb-0">Load Plot {year}</h6>
        </CardHeader>
      <CardBody className="px-4 py-2 overflow-visible planning-opex-chart-card__body">
        <ul className="small text-muted mb-2 ps-3 planning-opex-chart-note-list">
          <li>Menampilkan tren realisasi per beban dari Januari sampai bulan aktif.</li>
          <li>Klik titik bulan untuk fokus ke detail beban pada periode itu.</li>
        </ul>
        {!hasData ? (
          <div className="d-flex align-items-center justify-content-center text-muted planning-opex-chart-card__loading">
            <small>Data plot belum tersedia.</small>
          </div>
        ) : (
          <div
            className="planning-opex-plot-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(210px, 30%) 1fr",
              rowGap: 10,
              columnGap: 12,
              alignItems: "center",
            }}
          >
            {CATEGORY_ORDER.map((parent, index) => (
              <Fragment key={parent}>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6c757d",
                    lineHeight: 1.35,
                    textAlign: "left",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  }}
                >
                  {parent}
                </div>
                <div style={{ width: "100%", minWidth: 0, overflow: "visible" }}>
                  <Charts
                    options={{
                      ...baseOptions,
                      chart: {
                        ...(baseOptions?.chart || {}),
                        events: {
                          dataPointSelection: (event, chartContext, config) => {
                            const indexToken = Number(config?.dataPointIndex ?? -1);
                            if (indexToken < 0) return;
                            const monthToken = visibleMonths[indexToken];
                            if (!monthToken || typeof onDrilldown !== "function") return;
                            onDrilldown({
                              chartcolumn: "MataAnggaranParent",
                              label: parent,
                              month: monthToken,
                              source: "plot",
                            });
                          },
                        },
                      },
                      colors: [chartColors[index] || "#999"],
                    }}
                    series={[
                      {
                        name: parent,
                        data: visibleMonthIndexes.map(
                          (monthIndex) => Number((seriesByParent[parent] || Array(12).fill(0))[monthIndex] || 0),
                        ),
                      },
                    ]}
                    type="line"
                    height={42}
                  />
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );

  if (!wrapInCol) return content;

  return (
    <Col xs="12" className="mb-3 planning-opex-chart-grid-col">
      {content}
    </Col>
  );
};

const OpexCharts = ({ rows, year, selectedMonth, onDrilldown = null, wrapInCol = true }) => {
  const rowByParent = useMemo(() => {
    const map = new Map();
    const sourceRows = Array.isArray(rows) ? rows : [];

    sourceRows.forEach((row) => {
      const parent = String(row?.MataAnggaranParent ?? "").trim();
      if (!parent) return;
      const canonicalParent = CATEGORY_ORDER.find(
        (label) => String(label).trim().toLowerCase() === parent.toLowerCase(),
      );
      if (!canonicalParent) return;

      const current = map.get(canonicalParent);
      const candidateHasChild = String(row?.MataAnggaranChild ?? "").trim().length > 0;
      const currentHasChild = String(current?.MataAnggaranChild ?? "").trim().length > 0;

      if (!current || (currentHasChild && !candidateHasChild)) {
        map.set(canonicalParent, row);
      }
    });

    return map;
  }, [rows]);

  const plotSeriesByParent = useMemo(() => {
    const result = {};
    CATEGORY_ORDER.forEach((parent) => {
      const row = rowByParent.get(parent);
      result[parent] = MONTHS.map((month) => toNumber(row?.[month]));
    });
    return result;
  }, [rowByParent]);

  return (
    <OpexPlotCard
      year={year}
      selectedMonth={selectedMonth}
      seriesByParent={plotSeriesByParent}
      onDrilldown={onDrilldown}
      wrapInCol={wrapInCol}
    />
  );
};

export default OpexCharts;
