/*
 * PGH-DOC
 * File: src/Variables/Chart/PieChartMultiple.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import ReactApexChart from "react-apexcharts";
import { toast } from "react-toastify";
import "./_chartColors.scss";
import { toAuditFilterValue } from "../../Components/Audit/Utils/auditValueLabels";

import { cssVar } from "./chartColors";

const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${PUBLIC_URL}${normalizedPath}`;
};

const DEFAULT_PIE_COLORS = [
  "#343A5F",
  "#FFAF59",
  "#EACA80",
  "#F15A22",
  "#4E8098",
  "#7A3E6E",
  "#DB5B78",
  "#59A14F",
  "#76B7B2",
  "#B07AA1",
];

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
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const PieChartClass = ({
  title = "",
  chartcolumn,
  chartData = [["Label", "Count"]],
  legendPosition = "left",
  showLegend = true,
  showLine = true,
  navigatePath = `${buildAppPath("/audit/summary")}?chartcolumn={chartcolumn}&label={label}`,
  titleNavigatePath = null,
  reversedColors = false,
  money = false,
  noUserInput = false,
  remainingLabel = "Remaining",
  differentRemainingColor = false,
  blockedMessage = "",
  compact = false,
  pieSizeOverride = null,
  onDrilldown = null,
  dashboardLayout = false,
  normalizeDrilldownValue = true,
  enableTitleNavigation = true,
}) => {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (label) => {
      const filterValue = normalizeDrilldownValue
        ? toAuditFilterValue(label, { chartColumn: chartcolumn })
        : String(label ?? "").trim();

      if (
        typeof onDrilldown === "function" &&
        onDrilldown({
          chartcolumn,
          label: filterValue,
          source: "pie",
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

      const finalPath = navigatePath
        .replace("{chartcolumn}", encodeURIComponent(chartcolumn ?? ""))
        .replace("{label}", encodeURIComponent(filterValue ?? ""));

      navigate(finalPath, { state: { label: filterValue, chartcolumn } });
    },
    [
      blockedMessage,
      chartcolumn,
      navigate,
      navigatePath,
      normalizeDrilldownValue,
      onDrilldown,
    ],
  );

  const handleTitleClick = useCallback(() => {
    if (!enableTitleNavigation) {
      return;
    }

    if (!titleNavigatePath) {
      if (blockedMessage) {
        toast.info(blockedMessage);
      }
      return;
    }

    const finalPath = titleNavigatePath.replace(
      "{chartcolumn}",
      encodeURIComponent(chartcolumn ?? ""),
    );

    navigate(finalPath);
  }, [blockedMessage, chartcolumn, enableTitleNavigation, navigate, titleNavigatePath]);

  const filteredData = useMemo(() => chartData.slice(1), [chartData]);
  const hasData = filteredData.length > 0;

  const labels = useMemo(
    () => filteredData.map(([label]) => label),
    [filteredData],
  );

  const series = useMemo(
    () => filteredData.map(([, value]) => toFiniteNumber(value)),
    [filteredData],
  );

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const gapLabel = remainingLabel;
  const baseColors = useMemo(() => {
    const paletteSize = 20;

    return labels.map((_, index) => {
      const cssColor = cssVar(`--chart-bar-h-${(index % paletteSize) + 1}`);
      if (cssColor) return cssColor;
      return DEFAULT_PIE_COLORS[index % DEFAULT_PIE_COLORS.length];
    });
  }, [labels]);

  const formatValue = (value) => {
    if (!money) {
      return Number(value).toLocaleString("id-ID");
    }

    return `${Math.round(Number(value) / 1_000_000).toLocaleString("id-ID")} Jt`;
  };

  const colors = useMemo(() => {
    let computed = reversedColors ? [...baseColors].reverse() : baseColors;

    if (
      differentRemainingColor &&
      labels[labels.length - 1] === gapLabel
    ) {
      computed = [
        ...computed.slice(0, labels.length - 1),
        "rgb(242, 242, 242)",
      ];
    }

    return computed;
  }, [reversedColors, labels, baseColors, gapLabel, differentRemainingColor]);

  const options = useMemo(
    () => ({
      chart: {
        type: "pie",
        toolbar: { show: false },
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 1040,
          animateGradually: { enabled: true, delay: 120 },
          dynamicAnimation: { enabled: true, speed: 440 },
        },
        events: {
          dataPointSelection: (event, chartContext, config) => {
            const label = labels[config.dataPointIndex];
            if (label) handleClick(label);
          },
        },
      },
      labels,
      colors,
      stroke: { show: true, width: 0 },
      legend: { show: false },
      dataLabels: { enabled: false },
      tooltip: {
        y: {
          formatter: (value) => formatValue(value),
        },
      },
    }),
    [colors, handleClick, labels],
  );

  const isSide = legendPosition === "left" || legendPosition === "right";

  const legend = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: dashboardLayout ? "6px" : "2px",
      }}
    >
      {labels.map((label, index) => (
        <div
          key={index}
          onClick={() => handleClick(label)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: dashboardLayout ? "6px" : "4px",
            fontSize: dashboardLayout ? "12px" : "11px",
            cursor:
              navigatePath || blockedMessage || typeof onDrilldown === "function"
                ? "pointer"
                : "default",
            padding: dashboardLayout ? "4px 6px" : "1px 3px",
            whiteSpace: "nowrap",
            borderRadius: "6px",
            transition: "background 0.2s",
            width: dashboardLayout ? "100%" : "auto",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "rgba(36, 54, 74, 0.06)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "transparent";
          }}
        >
          <span
            style={{
              width: "9px",
              height: "9px",
              backgroundColor: colors[index],
              borderRadius: "2px",
            }}
          />
          <span>{`${label}: ${formatValue(series[index])}`}</span>
        </div>
      ))}
    </div>
  );

  const hasPieSizeOverride = Number.isFinite(Number(pieSizeOverride));
  const hasTitle = String(title ?? "").trim().length > 0;
  const pieSize = hasPieSizeOverride
    ? Number(pieSizeOverride)
    : compact
      ? 96
      : dashboardLayout
        ? isSide && !isMobile
          ? 180
          : 160
        : isSide && !isMobile
          ? 120
          : 130;
  const titleFontSize = compact ? "15px" : "16px";
  const emptyState = (
    <div
      style={{
        width: "100%",
        minHeight: `${pieSize}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "6px",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          fontSize: "12px",
          color: "#888",
          textAlign: "center",
        }}
      >
        {noUserInput ? "You haven't input the data" : "No data"}
      </span>
    </div>
  );

  return (
    <Fragment>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: dashboardLayout ? "stretch" : "center",
          width: "100%",
          gap: 0,
        }}
      >
        {hasTitle ? (
          <h5
            className="m-0 f-w-400 text-center"
            style={{
              fontSize: titleFontSize,
              width: "100%",
              cursor:
                enableTitleNavigation && (titleNavigatePath || blockedMessage)
                  ? "pointer"
                  : "default",
              padding:
                enableTitleNavigation && (titleNavigatePath || blockedMessage)
                  ? "4px 8px"
                  : 0,
              borderRadius: "6px",
              transition: "background-color 0.2s ease, color 0.2s ease",
            }}
            onClick={handleTitleClick}
            onMouseEnter={(event) => {
              if (!enableTitleNavigation || (!titleNavigatePath && !blockedMessage)) return;
              event.currentTarget.style.backgroundColor = "#f15a22";
              event.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(event) => {
              if (!enableTitleNavigation) return;
              event.currentTarget.style.backgroundColor = "transparent";
              event.currentTarget.style.color = "inherit";
            }}
          >
            {title}
          </h5>
        ) : null}

        {showLine && hasTitle && (
          <div
            style={{
              width: "100%",
              height: "1px",
              backgroundColor: "#c3c4c8ff",
              margin: "10px 0 0 0",
            }}
          />
        )}

        <div
          style={{
            width: "100%",
            marginTop: hasTitle ? (dashboardLayout ? "22px" : "10px") : 0,
          }}
        >
          {hasData ? (
            isSide && !isMobile ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: dashboardLayout ? "14px" : "10px",
                  width: "100%",
                  justifyContent: dashboardLayout ? "space-between" : "center",
                }}
              >
                {legendPosition === "left" && showLegend && (
                  <div
                    style={{
                      flex: dashboardLayout ? "1 1 0" : "0 0 auto",
                      minWidth: 0,
                      alignSelf: "stretch",
                    }}
                  >
                    {legend}
                  </div>
                )}

                <div
                  className="pie-wrapper"
                  style={{
                    width: `${pieSize}px`,
                    height: `${pieSize}px`,
                    flex: "0 0 auto",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ReactApexChart
                    options={options}
                    series={series}
                    type="pie"
                    width={pieSize}
                    height={pieSize}
                  />
                </div>

                {legendPosition === "right" && showLegend && (
                  <div
                    style={{
                      flex: dashboardLayout ? "1 1 0" : "0 0 auto",
                      minWidth: 0,
                      alignSelf: "stretch",
                    }}
                  >
                    {legend}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  className="pie-wrapper"
                  style={{
                    width: `${pieSize}px`,
                    height: `${pieSize}px`,
                  }}
                >
                  <ReactApexChart
                    options={options}
                    series={series}
                    type="pie"
                    width={pieSize}
                    height={pieSize}
                  />
                </div>

                {showLegend && legend}
              </div>
            )
          ) : (
            emptyState
          )}
        </div>
      </div>
    </Fragment>
  );
};

export default PieChartClass;
