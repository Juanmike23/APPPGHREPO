/*
 * PGH-DOC
 * File: src/Variables/Chart/PieChartMultipleDetail.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { ArrowLeft } from "react-feather";

const PRESENTATION_MUTED_30 = [
  "#3f435d",
  "#eaca80",
  "#ffaf59",
  "#F15A22",
  "#d5392eff",
  "#9d2393ff",
];

const ChartAuditDynamic = ({
  mainColumn = "Type",
  secondColumn,
  secondValue,
  defaultDetail = "Status",
  title = "Dynamic Audit Chart",
  refreshInterval = 0,
  onBack,
  chartsize = 120,
  legendposition = "left",
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailColumn, setDetailColumn] = useState(defaultDetail);

  const apiUrl = `${process.env.REACT_APP_API_BASE_URL}ListAudit`;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl, {
        credentials: "include",
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const normalized = Array.isArray(data) ? data : data?.rows || [];
      setRows(normalized);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      const timer = setInterval(fetchData, refreshInterval);
      return () => clearInterval(timer);
    }

    return undefined;
  }, [fetchData, refreshInterval]);

  const distinctCounts = useMemo(() => {
    if (!rows.length) return {};

    const columns = Object.keys(rows[0]);
    const counts = {};

    for (const column of columns) {
      const unique = new Set(
        rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean),
      );
      counts[column] = unique.size;
    }

    return counts;
  }, [rows]);

  const filteredColumns = useMemo(
    () =>
      Object.keys(distinctCounts).filter(
        (column) =>
          distinctCounts[column] > 0 &&
          distinctCounts[column] < 7 &&
          !["Id", "ExtraData"].includes(column),
      ),
    [distinctCounts],
  );

  const filteredRows = useMemo(() => {
    if (!rows.length) return [];
    if (!secondColumn || !secondValue) return rows;

    return rows.filter(
      (row) =>
        String(row[secondColumn] ?? "").toLowerCase() ===
        String(secondValue).toLowerCase(),
    );
  }, [rows, secondColumn, secondValue]);

  useEffect(() => {
    if (rows.length) {
      console.log("sample row:", rows[0]);
    }
  }, [rows]);

  const chartData = useMemo(() => {
    if (!filteredRows.length || !mainColumn || !detailColumn) return [];

    const grouped = {};

    for (const row of filteredRows) {
      const mainValue = row[mainColumn] || "Unknown";
      const detailValue = row[detailColumn] || "Unknown";

      if (!grouped[mainValue]) grouped[mainValue] = {};
      grouped[mainValue][detailValue] = (grouped[mainValue][detailValue] || 0) + 1;
    }

    return Object.entries(grouped).map(([label, breakdown]) => ({
      Label: label,
      Breakdown: breakdown,
    }));
  }, [detailColumn, filteredRows, mainColumn]);

  const labels = chartData.map((item) => item.Label);
  const series = chartData.map((item) =>
    Object.values(item.Breakdown || {}).reduce((accumulator, value) => accumulator + value, 0),
  );
  const legendMap = Object.fromEntries(
    chartData.map((item) => [item.Label, item.Breakdown]),
  );

  const options = {
    chart: { type: "pie", background: "transparent", toolbar: { show: false } },
    labels,
    colors: PRESENTATION_MUTED_30,
    stroke: {
      show: true,
      width: 0,
      colors: ["transparent"],
    },
    legend: {
      width: 220,
      position: legendposition,
      formatter: (seriesName, opts) => {
        const total = opts?.w?.globals?.series?.[opts.seriesIndex];
        const breakdown = legendMap[seriesName] || {};
        const breakdownText = Object.entries(breakdown)
          .map(([key, value]) => `${key}: ${value}`)
          .join(" | ");
        return `${seriesName}: ${total} (${breakdownText})`;
      },
    },
    dataLabels: {
      enabled: false,
      formatter: (value) => `${value.toFixed(1)}%`,
    },
  };

  useEffect(() => {
    if (
      filteredColumns.length > 0 &&
      (!detailColumn || !filteredColumns.includes(detailColumn))
    ) {
      setDetailColumn(filteredColumns[0]);
    }
  }, [detailColumn, filteredColumns]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        {onBack && (
          <i
            onClick={onBack}
            role="button"
            tabIndex={0}
            aria-label="Back"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onBack();
            }}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={16} />
          </i>
        )}

        <h6 className="mb-0 text-center">{title}</h6>

        <select
          value={detailColumn}
          onChange={(event) => setDetailColumn(event.target.value)}
          className="form-select form-select-sm"
          style={{ width: "200px" }}
        >
          {filteredColumns.map((column) => (
            <option key={column} value={column}>
              {column} ({distinctCounts[column]})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div>Loading chart...</div>
      ) : series.length > 0 ? (
        <ReactApexChart
          key={`${mainColumn}-${detailColumn}`}
          options={options}
          series={series}
          type="pie"
          height={chartsize}
        />
      ) : (
        <div>No data available</div>
      )}
    </>
  );
};

export default ChartAuditDynamic;
