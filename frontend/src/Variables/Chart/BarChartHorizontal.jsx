/*
 * PGH-DOC
 * File: src/Variables/Chart/BarChartHorizontal.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactApexChart from "react-apexcharts";
import { Card, Col } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";
import {
  getAuditChartLabel,
  toAuditFilterValue,
} from "../../Components/Audit/Utils/auditValueLabels";

const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${PUBLIC_URL}${normalizedPath}`;
};

const safeId = (s) => String(s ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");

const COUNT_KEYS = ["Count", "count", "Total", "total", "Jumlah", "jumlah"];
const LABEL_KEYS = ["Value", "value", "Label", "label", "Name", "name"];

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

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

const getLabelValue = (item) => {
  if (item == null) return null;
  if (typeof item !== "object") return String(item);

  for (const key of LABEL_KEYS) {
    if (item[key] != null && item[key] !== "") {
      return String(item[key]);
    }
  }

  return null;
};

const getCountValue = (item) => {
  if (item == null || typeof item !== "object") return null;

  for (const key of COUNT_KEYS) {
    if (item[key] != null && item[key] !== "") {
      return toFiniteNumber(item[key]);
    }
  }

  return null;
};

const buildRowsFromArray = (input, chartColumn) => {
  const hasExplicitCount = input.some(
    (item) => getLabelValue(item) !== null && getCountValue(item) !== null,
  );

  if (hasExplicitCount) {
    const aggregated = input.reduce((accumulator, item) => {
      const rawName = getLabelValue(item);
        const count = getCountValue(item);

      if (rawName === null || count === null) return accumulator;

      const name = getAuditChartLabel(rawName, chartColumn);
      accumulator[name] = (accumulator[name] || 0) + count;
      return accumulator;
    }, {});

    return Object.entries(aggregated).map(([name, count]) => ({ name, count }));
  }

  const grouped = {};

  input.forEach((item) => {
    const name = getAuditChartLabel(getLabelValue(item), chartColumn);
    if (name === null) return;
    grouped[name] = (grouped[name] || 0) + 1;
  });

  return Object.entries(grouped).map(([name, count]) => ({ name, count }));
};

const buildRowsFromObject = (input, chartColumn) => {
  const labels = input.Labels || input.labels;
  const values = input.Values || input.values;

  if (Array.isArray(labels) && Array.isArray(values)) {
    const aggregated = labels.reduce((accumulator, label, index) => {
      const name = getAuditChartLabel(label, chartColumn);
      accumulator[name] =
        (accumulator[name] || 0) + toFiniteNumber(values[index]);
      return accumulator;
    }, {});

    return Object.entries(aggregated).map(([name, count]) => ({ name, count }));
  }

  for (const key of ["data", "items", "results", "rows"]) {
    if (Array.isArray(input[key])) {
      return buildRowsFromArray(input[key], chartColumn);
    }
  }

  const aggregated = Object.entries(input)
    .filter(([, value]) => typeof value !== "object")
    .reduce((accumulator, [name, count]) => {
      const normalizedName = getAuditChartLabel(name, chartColumn);
      accumulator[normalizedName] =
        (accumulator[normalizedName] || 0) + toFiniteNumber(count);
      return accumulator;
    }, {});

  return Object.entries(aggregated)
    .map(([name, count]) => ({
      name,
      count: toFiniteNumber(count),
    }))
    .filter((row) => row.count > 0);
};

const normalizeChartRows = (input, chartColumn) => {
  if (Array.isArray(input)) return buildRowsFromArray(input, chartColumn);
  if (input && typeof input === "object") return buildRowsFromObject(input, chartColumn);
  return [];
};

const detectDarkOnlyTheme = () =>
  typeof document !== "undefined" &&
  document.body?.classList?.contains("dark-only");

/* 🌈 RAINBOW SEQUENCE */

/* ─────────────────────────
   COLOR HELPERS
───────────────────────── */


/* ─────────────────────────
   COMPONENT
───────────────────────── */
const BarChart = ({
  apiUrl,
  data: dataOverride,
  title = "barchart",
  chartcolumn,
  navigatePath = `${buildAppPath("/audit/summary")}?chartcolumn={chartcolumn}&label={label}`,
  containerHeight = 255,
  dynamicHeight = false,
  rowMinHeight = 36,
  maxDynamicHeight = null,
  blockedMessage = "",
  cardClassName = "",
  onDrilldown = null,
  requiredCategories = [],
  labelOverrides = null,
  wrapCategoryLabel = true,
  singleBarColor = null,
  barColorByLabel = null,
  externalLoading = false,
  externalError = false,
  prefetchedOnly = false,
}) => {
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const usesExternalState =
    dataOverride !== undefined || externalLoading || Boolean(externalError);
  const [loading, setLoading] = useState(Boolean(apiUrl) && !usesExternalState);
  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [labelWidth, setLabelWidth] = useState(0);
  const [chartsReady, setChartsReady] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(detectDarkOnlyTheme);

  const getCssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;

  /* ─────────────────────────
     FETCH DATA
  ───────────────────────── */
  useEffect(() => {
    if (usesExternalState) {
      setLoading(false);
      return undefined;
    }

    if (dataOverride != null) {
      setLoading(false);
      return undefined;
    }

    if (prefetchedOnly || !apiUrl) return undefined;

    setLoading(true);
    fetch(apiUrl, { credentials: "include" })
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return undefined;
  }, [apiUrl, dataOverride, prefetchedOnly, usesExternalState]);

  /* ─────────────────────────
     GROUP DATA
  ───────────────────────── */
  const normalizedLabelOverrides = useMemo(
    () => toCategoryOverrideMap(labelOverrides),
    [labelOverrides],
  );
  const normalizedBarColorOverrides = useMemo(
    () => toCategoryOverrideMap(barColorByLabel),
    [barColorByLabel],
  );

  const rows = useMemo(() => {
    const baseRows = normalizeChartRows(dataOverride ?? data, chartcolumn).map((row) => {
      const override = normalizedLabelOverrides.get(normalizeCategoryKey(row.name));
      return {
        ...row,
        name: override || row.name,
      };
    });

    if (!Array.isArray(requiredCategories) || requiredCategories.length === 0) {
      return baseRows;
    }

    const existingNames = new Set(baseRows.map((row) => normalizeCategoryKey(row.name)));
    const enrichedRows = [...baseRows];

    requiredCategories.forEach((category) => {
      const categoryName = String(category ?? "").trim();
      if (!categoryName) {
        return;
      }

      const categoryKey = normalizeCategoryKey(categoryName);
      if (existingNames.has(categoryKey)) {
        return;
      }

      existingNames.add(categoryKey);
      enrichedRows.push({
        name: categoryName,
        count: 0,
      });
    });

    return enrichedRows;
  }, [
    chartcolumn,
    data,
    dataOverride,
    normalizedLabelOverrides,
    requiredCategories,
  ]);

  const maxCount = useMemo(
    () => Math.max(...rows.map((r) => r.count), 1),
    [rows],
  );

  /* ─────────────────────────
     MEASURE LABEL WIDTH
  ───────────────────────── */
  useEffect(() => {
    if (!rows.length) return;

    const measurer = document.createElement("span");
    measurer.style.visibility = "hidden";
    measurer.style.position = "absolute";
    measurer.style.whiteSpace = "nowrap";
    measurer.style.fontSize = "12px";
    measurer.style.padding = "4px 6px";
    document.body.appendChild(measurer);

    let max = 0;
    rows.forEach(({ name }) => {
      measurer.textContent = name;
      max = Math.max(max, measurer.offsetWidth);
    });

    document.body.removeChild(measurer);
    setLabelWidth(Math.min(max, 160));
  }, [rows]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) {
      return undefined;
    }

    const syncThemeMode = () => {
      setIsDarkTheme(detectDarkOnlyTheme());
    };

    syncThemeMode();

    const observer = new MutationObserver(syncThemeMode);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const chartTextPalette = useMemo(
    () =>
      isDarkTheme
        ? {
            valueFill: "#F8FAFC",
            valueStroke: "rgba(15, 23, 42, 0.94)",
            categoryText: "#E2E8F0",
            categoryHover: "rgba(148, 163, 184, 0.16)",
            axisText: "#CBD5E1",
            axisLine: "rgba(148, 163, 184, 0.38)",
            axisTick: "rgba(148, 163, 184, 0.62)",
          }
        : {
            valueFill: "#FFF7ED",
            valueStroke: "rgba(36, 54, 74, 0.94)",
            categoryText: "#24364A",
            categoryHover: "rgba(36, 58, 95, 0.08)",
            axisText: "#44556B",
            axisLine: "rgba(36, 54, 74, 0.22)",
            axisTick: "rgba(36, 54, 74, 0.38)",
          },
    [isDarkTheme],
  );

  /* ─────────────────────────
     NAVIGATION
  ───────────────────────── */
  const handleClick = (label) => {
    const filterValue = toAuditFilterValue(label, { chartColumn: chartcolumn });

    if (
      typeof onDrilldown === "function" &&
      onDrilldown({
        chartcolumn,
        label: filterValue,
        source: "bar",
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

    const path = navigatePath
      .replace("{chartcolumn}", encodeURIComponent(chartcolumn ?? ""))
      .replace("{label}", encodeURIComponent(filterValue));

    navigate(path, { state: { label: filterValue, chartcolumn } });
  };
  const canInteract = Boolean(navigatePath || blockedMessage);

  /* ─────────────────────────
     LAYOUT
  ───────────────────────── */
  const GAP = 6;
  const effectiveContainerHeight = useMemo(() => {
    if (!dynamicHeight || !rows.length) {
      return containerHeight;
    }

    const minimumHeight =
      rows.length * Math.max(Number(rowMinHeight) || 0, 1) +
      GAP * Math.max(rows.length - 1, 0);

    let resolvedHeight = Math.max(containerHeight, minimumHeight);

    if (Number.isFinite(Number(maxDynamicHeight))) {
      resolvedHeight = Math.min(resolvedHeight, Number(maxDynamicHeight));
    }

    return resolvedHeight;
  }, [containerHeight, dynamicHeight, maxDynamicHeight, rowMinHeight, rows.length]);

  const rowHeight =
    rows.length > 0
      ? Math.floor((effectiveContainerHeight - GAP * (rows.length - 1)) / rows.length)
      : 0;

  /* ─────────────────────────
     BASE CHART OPTIONS (CLEAN AXIS)
  ───────────────────────── */
  const baseChartOptions = useMemo(
    () => ({
      chart: {
        sparkline: { enabled: true },
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 920,
          animateGradually: { enabled: true, delay: 110 },
          dynamicAnimation: { enabled: true, speed: 420 },
        },
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "100%",
          borderRadius: 4,
        },
      },
      stroke: { width: 0 },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: true,
        custom: ({ series, seriesIndex, dataPointIndex, w }) => {
          const value = series[seriesIndex][dataPointIndex];
          const label = w.globals.labels?.[dataPointIndex] || "";
          const tooltipBackground = isDarkTheme ? "#111827" : "#FFF7ED";
          const tooltipText = isDarkTheme ? "#F8FAFC" : "#24364A";
          const tooltipBorder = isDarkTheme
            ? "rgba(148, 163, 184, 0.24)"
            : "rgba(36, 54, 74, 0.14)";

          return `
      <div style="
        padding:8px 10px;
        background:${tooltipBackground};
        color:${tooltipText};
        border:1px solid ${tooltipBorder};
        border-radius:10px;
        box-shadow:none;
        font-size:12px;
        font-weight:600;
      ">
        ${label} : ${value}
      </div>
    `;
        },
      },

      dataLabels: {
        enabled: false,
        style: {
          fontSize: "12px",
        },
      },
      xaxis: {
        min: 0,
        max: maxCount,
      },

      grid: {
        show: false,
      },
    }),
    [isDarkTheme, maxCount],
  );

  /* ─────────────────────────
     RENDER
  ───────────────────────── */
  if (usesExternalState ? externalLoading : loading) {
    return (
      <Card className={`${cardClassName} h-100`.trim()}>
        <Col className="m-4">
          <h5 className="text-center m-0" style={{ fontSize: 16 }}>
            {title}
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

  if ((usesExternalState ? externalError : false) && !rows.length) {
    return (
      <Card className={`${cardClassName} h-100`.trim()}>
        <Col className="m-4">
          <h5 className="text-center m-0" style={{ fontSize: 16 }}>
            {title}
          </h5>
          <div
            className="d-flex align-items-center justify-content-center text-muted"
            style={{ height: "100%", minHeight: 220 }}
          >
            <small>Failed to load chart.</small>
          </div>
        </Col>
      </Card>
    );
  }

  return (
    <>
      <Card className={`${cardClassName} h-100`.trim()}>
        {!rows.length ? (<>
           <h5 className="text-center " style={{ fontSize: 16 ,marginTop:"32px"}}>
          {title}
        </h5>
          <div
            className="d-flex align-items-center justify-content-center text-muted"
            style={{ height: "100%" }}
          >
            <small>You haven't input the data yet.</small>
          </div>
          </>
        ) : (
          <Col className="m-4">
            <h5 className="text-center m-0" style={{ fontSize: 16 }}>
              {title}
            </h5>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: effectiveContainerHeight,
                marginTop: 24,
                gap: GAP,
              }}
            >
              {rows.map(({ name, count }, index) => {
                const colorIndex = (index % 10) + 1; // 1–10 loop
                const colorOverride = normalizedBarColorOverrides.get(
                  normalizeCategoryKey(name),
                );
                const barColor =
                  colorOverride ||
                  singleBarColor ||
                  getCssVar(
                    `--chart-bar-h-${colorIndex}`,
                    "#343A5F", // safe fallback
                  );

                const labelId = `label-${safeId(name)}`; // 👈 HERE

                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: rowHeight,
                    }}
                  >
                    {/* LABEL */}
                    <div
                      title={name}
                      id={labelId}
                      onClick={() => handleClick(name)}
                      onMouseEnter={() => setHoveredLabel(name)}
                      onMouseLeave={() => setHoveredLabel(null)}
                      style={{
                        minWidth: labelWidth || 30,
                        maxWidth: labelWidth || 160,
                        textAlign: "left",
                        fontSize: 12,
                        color: chartTextPalette.categoryText,
                        cursor: canInteract ? "pointer" : "default",
                        overflow: "hidden",
                        textOverflow: wrapCategoryLabel ? "clip" : "ellipsis",
                        whiteSpace: wrapCategoryLabel ? "normal" : "nowrap",
                        display: wrapCategoryLabel ? "-webkit-box" : "block",
                        WebkitLineClamp: wrapCategoryLabel ? 2 : "unset",
                        WebkitBoxOrient: wrapCategoryLabel ? "vertical" : "unset",
                        lineHeight: wrapCategoryLabel ? 1.25 : 1.1,
                        wordBreak: wrapCategoryLabel ? "break-word" : "normal",
                        padding: "4px 6px",
                        borderRadius: 4,
                        backgroundColor:
                          hoveredLabel === name
                            ? chartTextPalette.categoryHover
                            : "transparent",
                      }}
                      className="me-2"
                    >
                      {name}
                    </div>

                    {/* BAR */}
                    <div
                      style={{
                        flexGrow: 1,
                        minWidth: 0,
                        position: "relative",
                      }}
                    >
                      <svg
                        width="100%"
                        height="100%"
                        style={{
                          position: "absolute",
                          inset: 0,
                          pointerEvents: "none",
                          zIndex: 3,
                        }}
                      >
                        <text
                          x="50%"
                          y="50%"
                          dominantBaseline="middle"
                          textAnchor="middle"
                          fill={chartTextPalette.valueFill}
                          stroke={chartTextPalette.valueStroke}
                          strokeWidth="2"
                          paintOrder="stroke fill"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {count}
                        </text>
                      </svg>

                      {chartsReady && (
                        <ReactApexChart
                          type="bar"
                          height={rowHeight}
                          series={[{ data: [count] }]}
                          options={{
                            ...baseChartOptions,
                            colors: [barColor],
                            xaxis: {
                              ...baseChartOptions.xaxis,
                              categories: [name],
                            },
                            chart: {
                              ...baseChartOptions.chart,
                              events: {
                                dataPointMouseEnter: (event, chartContext) => {
                                  chartContext.el.style.cursor = canInteract
                                    ? "pointer"
                                    : "default";
                                },
                                dataPointMouseLeave: (event, chartContext) => {
                                  chartContext.el.style.cursor = "default";
                                },
                                dataPointSelection: () => handleClick(name),
                              },
                            },
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* ✅ SHARED X AXIS */}
            <div
              style={{
                marginLeft: labelWidth + 8,
                marginTop: 8,
              }}
            >
              {/* Axis line */}
              <div
                style={{
                  position: "relative",
                  height: 12,
                  borderTop: `1px solid ${chartTextPalette.axisLine}`,
                }}
              >
                {[0, 0.5, 1].map((t) => (
                  <span
                    key={t}
                    style={{
                      position: "absolute",
                      left: `${t * 100}%`,
                      top: -6,
                      height: 12,
                      width: 1,
                      backgroundColor: chartTextPalette.axisTick,
                      transform: "translateX(-0.5px)",
                    }}
                  />
                ))}
              </div>

              {/* Labels */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: chartTextPalette.axisText,
                  marginTop: 2,
                }}
              >
                <span>0</span>
                <span>{Math.floor(maxCount / 2)}</span>
                <span>{maxCount}</span>
              </div>
            </div>
          </Col>
        )}
      </Card>
    </>
  );
};

export default BarChart;
