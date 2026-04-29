/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/DepartmentChart.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { Card, CardBody, CardHeader, Col } from "@pgh/ui-bootstrap";
import { getAuditDisplayValue } from "../Utils/auditValueLabels";

const PRESENTATION_MUTED_30 = [
  "#4E79A7",
  "#F28E2B",
  "#E15759",
  "#76B7B2",
  "#59A14F",
  "#EDC948",
  "#B07AA1",
  "#FF9DA7",
  "#9C755F",
  "#BAB0AC",
  "#A0CBE8",
  "#FFBE7D",
  "#FF9D9A",
  "#B2DFE0",
  "#8CD17D",
  "#F1CE63",
  "#D4A6C8",
  "#FFBDC5",
  "#D7B5A6",
  "#D7D7D7",
  "#3B5D7A",
  "#C98B4E",
  "#B6474A",
  "#5F9C98",
  "#478645",
  "#D5B74A",
  "#8E5E8A",
  "#D97A8C",
  "#7B6658",
  "#9FA4A7",
];

const normalizeRows = (payload) =>
  Array.isArray(payload) ? payload : payload?.rows || payload?.value || payload?.data || [];

const PicAplikasiChart = () => {
  const [series, setSeries] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = `${process.env.REACT_APP_API_BASE_URL}ListAudit`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const rows = normalizeRows(await res.json());
        const counts = new Map();

        rows.forEach((row) => {
          const key = getAuditDisplayValue(
            row?.DEPARTMENT ??
              row?.Department ??
              row?.PICAPLIKASI ??
              row?.PicAplikasi,
          ).toUpperCase();
          const value = Number(row?.VALUE ?? row?.Value ?? 1);

          counts.set(key, (counts.get(key) || 0) + (Number.isFinite(value) ? value : 1));
        });

        setCategories(Array.from(counts.keys()));
        setSeries([{ name: "Total", data: Array.from(counts.values()) }]);
      } catch (err) {
        console.error("Fetch error:", err);
        setCategories([]);
        setSeries([]);
      }
    };

    fetchData();
  }, []);

  const chartOptions = {
    chart: {
      type: "bar",
      background: "transparent",
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    colors: PRESENTATION_MUTED_30,
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 8,
        borderRadiusApplication: "end",
        distributed: true,
      },
    },
    fill: { opacity: 1 },
    states: {
      normal: { filter: { type: "none", value: 0 } },
      hover: { filter: { type: "none", value: 0 } },
      active: { filter: { type: "none", value: 0 } },
    },
    dataLabels: {
      enabled: true,
      style: { fontSize: "12px", colors: ["#333"] },
      offsetY: -4,
    },
    xaxis: {
      categories,
      labels: { style: { colors: "#555", fontSize: "12px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: "#555", fontSize: "12px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    grid: {
      borderColor: "rgba(0,0,0,.06)",
      strokeDashArray: 4,
      padding: { left: 8, right: 8, top: 8, bottom: 8 },
    },
    tooltip: {
      theme: "light",
      y: { formatter: (val) => `${val} value` },
    },
    legend: { show: false },
  };

  return (
    <Col sm="12" xl="6">
      <Card className="chart-block opex-chart">
        <Col>
          <CardHeader className="pb-0 text-center">
            <h5 className="mb-0 text-center">Audit Department</h5>
          </CardHeader>
          <CardBody className="d-flex flex-column pt-0">
            <Chart options={chartOptions} series={series} type="bar" height={360} />
          </CardBody>
        </Col>
      </Card>
    </Col>
  );
};

export default PicAplikasiChart;
