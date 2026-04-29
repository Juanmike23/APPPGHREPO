/*
 * PGH-DOC
 * File: src/Components/Planning/DashboardPlanning/Opex/OpexLegacyCharts.jsx
 * Apa fungsi bagian ini:
 * - Menjaga chart bawaan OPEX (overview lama) tetap tampil.
 * Kenapa perlu:
 * - Supaya histori visual yang sudah dipakai user tidak hilang saat chart baru ditambahkan.
 * Aturan khususnya apa:
 * - Komponen ini read-only dan tetap menggunakan payload overview dari endpoint OPEX.
 */

import React, { useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { Button, Card, CardBody, CardHeader, Col, Row, Spinner } from "@pgh/ui-bootstrap";
import OpexBudgetGuardrailModal from "./OpexBudgetGuardrailModal";

const OVERVIEW_CATEGORY_ORDER = [
  "Beban Kantor",
  "Beban Teknologi & Telekomunikasi",
  "Beban Penyusutan dan Amortisasi",
  "Beban Personalia",
  "Beban Lainnya",
  "Jumlah Beban Operasional Lainnya",
];
const fmtMoney = (value) =>
  Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });

const wrapAxisLabel = (value, maxChars = 16) => {
  const text = String(value ?? "").trim();
  if (!text) return "-";

  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if ((`${current} ${word}`).trim().length <= maxChars) {
      current = `${current} ${word}`.trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);

  return lines.join("\n");
};

const formatOverviewAxisLabel = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return wrapAxisLabel(text, 11);
};

const OpexLegacyCharts = ({
  overview,
  loading = false,
  monitorSideContent = null,
  budgetGuardrailConfig = null,
  budgetGuardrailConfigLoading = false,
  budgetGuardrailConfigSaving = false,
  canManageBudgetGuardrail = true,
  onSaveBudgetGuardrailConfig = null,
}) => {
  const [isBudgetGuardrailModalOpen, setIsBudgetGuardrailModalOpen] = useState(false);
  const isDarkMode =
    typeof document !== "undefined" && document.body?.classList?.contains("dark-only");
  const axisLabelColor = isDarkMode ? "#f8fafc" : "#334155";

  const orderedCategories = useMemo(() => {
    const categories = Array.isArray(overview?.categories) ? overview.categories : [];
    const orderMap = new Map(OVERVIEW_CATEGORY_ORDER.map((label, index) => [label.toLowerCase(), index]));
    return [...categories].sort((left, right) => {
      const leftLabel = String(left?.label ?? "").toLowerCase();
      const rightLabel = String(right?.label ?? "").toLowerCase();
      const leftIndex = orderMap.has(leftLabel) ? orderMap.get(leftLabel) : Number.MAX_SAFE_INTEGER;
      const rightIndex = orderMap.has(rightLabel) ? orderMap.get(rightLabel) : Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return leftLabel.localeCompare(rightLabel);
    });
  }, [overview?.categories]);

  const chartOptions = useMemo(() => {
    const categories = orderedCategories.map((item) => item?.label ?? "-");

    return {
      chart: {
        type: "bar",
        toolbar: { show: false },
        foreColor: axisLabelColor,
      },
      plotOptions: {
        bar: {
          borderRadius: 10,
          columnWidth: "52%",
        },
      },
      xaxis: {
        categories,
        labels: {
          rotate: 0,
          trim: false,
          maxHeight: 188,
          hideOverlappingLabels: false,
          formatter: (value) => formatOverviewAxisLabel(value),
          style: {
            fontSize: "10px",
            colors: axisLabelColor,
          },
        },
      },
      yaxis: {
        labels: {
          formatter: (value) => fmtMoney(value),
          style: {
            colors: [axisLabelColor],
          },
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        followCursor: true,
        x: {
          formatter: (value) => String(value ?? ""),
        },
        y: {
          formatter: (value) => fmtMoney(value),
        },
      },
      dataLabels: { enabled: false },
      legend: {
        position: "top",
        labels: {
          colors: isDarkMode ? "#f8fafc" : "#1f2937",
        },
      },
    };
  }, [axisLabelColor, isDarkMode, orderedCategories]);

  const chartSeries = useMemo(() => {
    return [
      {
        name: "Realisasi Tahun Aktif",
        data: orderedCategories.map((item) => Number(item?.currValue || 0)),
      },
      {
        name: "Realisasi Tahun Sebelumnya",
        data: orderedCategories.map((item) => Number(item?.prevValue || 0)),
      },
    ];
  }, [orderedCategories]);

  const monthlyActualRows = useMemo(
    () => (Array.isArray(overview?.monthlyActual?.rows) ? overview.monthlyActual.rows : []),
    [overview?.monthlyActual?.rows],
  );

  const monthlyActualChartOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        foreColor: axisLabelColor,
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: "50%",
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: monthlyActualRows.map((row) => row?.month ?? "-"),
        labels: {
          rotate: 0,
          trim: false,
          style: {
            colors: axisLabelColor,
          },
        },
      },
      yaxis: {
        labels: {
          formatter: (value) => fmtMoney(value),
          style: {
            colors: [axisLabelColor],
          },
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        followCursor: true,
        y: { formatter: (value) => fmtMoney(value) },
      },
      legend: {
        position: "top",
        labels: {
          colors: isDarkMode ? "#f8fafc" : "#1f2937",
        },
      },
    }),
    [axisLabelColor, isDarkMode, monthlyActualRows],
  );

  const monthlyActualChartSeries = useMemo(
    () => [
      {
        name: "Realisasi Bulanan Aktual",
        data: monthlyActualRows.map((row) => Number(row?.realization || 0)),
      },
    ],
    [monthlyActualRows],
  );

  const budgetGuardrailRows = useMemo(
    () => (Array.isArray(overview?.budgetGuardrailMonitor?.rows) ? overview.budgetGuardrailMonitor.rows : []),
    [overview?.budgetGuardrailMonitor?.rows],
  );

  const budgetGuardrailMissingFyCount = useMemo(
    () =>
      budgetGuardrailRows.filter(
        (row) => String(row?.status ?? "").toLowerCase() === "no-fy",
      ).length,
    [budgetGuardrailRows],
  );

  const hasAnyBudgetGuardrailFy = useMemo(
    () =>
      budgetGuardrailRows.some(
        (row) => String(row?.status ?? "").toLowerCase() !== "no-fy" && row?.actualPct != null,
      ),
    [budgetGuardrailRows],
  );

  const budgetGuardrailMax = useMemo(() => {
    const actualMax = budgetGuardrailRows.reduce(
      (max, row) => Math.max(max, Number(row?.actualPct || 0)),
      0,
    );
    const targetMax = budgetGuardrailRows.reduce(
      (max, row) => Math.max(max, Number(row?.targetPct || 0)),
      0,
    );
    const ceiling = Math.max(actualMax, targetMax, 100);
    return Math.ceil(ceiling / 10) * 10;
  }, [budgetGuardrailRows]);

  const budgetGuardrailColors = useMemo(
    () =>
      budgetGuardrailRows.map((row) => {
        const status = String(row?.status ?? "").toLowerCase();
        if (status === "over-target") return "#ef4444";
        if (status === "within-target") return "#22c55e";
        return "#94a3b8";
      }),
    [budgetGuardrailRows],
  );

  const budgetGuardrailChartHeight = useMemo(
    () => Math.max(330, budgetGuardrailRows.length * 72),
    [budgetGuardrailRows.length],
  );

  const budgetGuardrailChartOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        foreColor: axisLabelColor,
      },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 10,
          barHeight: "68%",
          distributed: true,
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (value, options) => {
          const row = budgetGuardrailRows[options?.dataPointIndex ?? -1];
          if (!row) return `${Number(value || 0).toFixed(1)}%`;
          if (String(row?.status ?? "").toLowerCase() === "no-fy") return "FY kosong";
          return `${Number(value || 0).toFixed(1)}%`;
        },
        style: {
          fontSize: "10px",
          fontWeight: 600,
          colors: budgetGuardrailRows.map(() => (isDarkMode ? "#f8fafc" : "#1f2937")),
        },
      },
      xaxis: {
        min: 0,
        max: budgetGuardrailMax,
        categories: budgetGuardrailRows.map((row) => row?.label ?? "-"),
        labels: {
          formatter: (value) => `${Number(value || 0).toFixed(0)}%`,
          style: {
            fontSize: "10px",
            colors: axisLabelColor,
          },
        },
      },
      yaxis: {
        labels: {
          formatter: (value) => wrapAxisLabel(value, 20),
          style: {
            colors: [axisLabelColor],
          },
        },
      },
      annotations: Number.isFinite(Number(overview?.budgetGuardrailMonitor?.targetPct))
        ? {
            xaxis: [
              {
                x: Number(overview?.budgetGuardrailMonitor?.targetPct || 0),
                borderColor: isDarkMode ? "#fde68a" : "#f59e0b",
                strokeDashArray: 6,
                label: {
                  text: `Target ${Number(overview?.budgetGuardrailMonitor?.targetPct || 0).toFixed(1)}%`,
                  orientation: "horizontal",
                  offsetY: -10,
                  borderColor: isDarkMode ? "#fde68a" : "#f59e0b",
                  style: {
                    background: isDarkMode ? "#1e293b" : "#fff7ed",
                    color: isDarkMode ? "#f8fafc" : "#9a3412",
                    fontSize: "11px",
                    fontWeight: 600,
                  },
                },
              },
            ],
          }
        : undefined,
      tooltip: {
        shared: false,
        intersect: false,
        followCursor: true,
        x: {
          formatter: (value) => String(value ?? ""),
        },
        y: {
          formatter: (value) => `${Number(value || 0).toFixed(1)}%`,
        },
      },
      legend: { show: false },
      colors: budgetGuardrailColors,
    }),
    [axisLabelColor, budgetGuardrailColors, budgetGuardrailMax, budgetGuardrailRows, isDarkMode, overview?.budgetGuardrailMonitor?.targetPct],
  );

  const budgetGuardrailChartSeries = useMemo(
    () => [
      {
        name: "Actual YTD",
        data: budgetGuardrailRows.map((row) =>
          String(row?.status ?? "").toLowerCase() === "no-fy"
            ? null
            : Number(row?.actualPct || 0),
        ),
      },
    ],
    [budgetGuardrailRows],
  );

  return (
    <>
      <OpexBudgetGuardrailModal
        isOpen={isBudgetGuardrailModalOpen}
        toggle={() => setIsBudgetGuardrailModalOpen((prev) => !prev)}
        config={budgetGuardrailConfig}
        loading={budgetGuardrailConfigLoading}
        saving={budgetGuardrailConfigSaving}
        onSave={onSaveBudgetGuardrailConfig}
      />

      <Row className="g-3">
        <Col xl="6" md="6" sm="12">
          <Card className="mb-0">
            <CardBody>
              <small className="text-muted">Current Realization</small>
              <div className="h5 mb-0">{fmtMoney(overview?.totals?.curr || 0)}</div>
            </CardBody>
          </Card>
        </Col>
        <Col xl="6" md="6" sm="12">
          <Card className="mb-0">
            <CardBody>
              <small className="text-muted">Previous Realization</small>
              <div className="h5 mb-0">{fmtMoney(overview?.totals?.prev || 0)}</div>
            </CardBody>
          </Card>
        </Col>
        <Col xs="12">
          <Row className="g-3">
            <Col xs="12" className="planning-opex-chart-grid-col">
              <Card className="mb-0 planning-opex-legacy-chart-card planning-opex-chart-card">
                <CardHeader>
                  <h6 className="mb-0">OPEX Overview</h6>
                </CardHeader>
                <CardBody className="planning-opex-chart-card__body">
                  <ul className="small text-muted mb-2 ps-3 planning-opex-chart-note-list">
                    <li>Menampilkan komposisi beban utama sesuai filter aktif.</li>
                    <li>Mode Monthly membaca snapshot bulan yang sedang dibuka.</li>
                  </ul>
                  {loading ? (
                    <div className="text-muted planning-opex-chart-card__loading">Loading chart...</div>
                  ) : (
                    <div className="planning-opex-chart-card__chart">
                      <ReactApexChart options={chartOptions} series={chartSeries} type="bar" height={410} />
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>

            <Col md="6" xs="12" className="planning-opex-chart-grid-col">
              <Card className="mb-0 planning-opex-chart-card">
                <CardHeader>
                  <h6 className="mb-0">Tren Realisasi Bulanan (Aktual)</h6>
                </CardHeader>
                <CardBody className="planning-opex-chart-card__body">
                  <ul className="small text-muted mb-2 ps-3 planning-opex-chart-note-list">
                    <li>Menampilkan realisasi aktual dari Januari sampai bulan aktif.</li>
                    <li>Tetap berbentuk tren walau filter Monthly dipilih.</li>
                  </ul>
                  {loading ? (
                    <div className="text-muted planning-opex-chart-card__loading">Loading chart...</div>
                  ) : (
                    <div className="planning-opex-chart-card__chart">
                      <ReactApexChart options={monthlyActualChartOptions} series={monthlyActualChartSeries} type="bar" height={300} />
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>

            <Col md="6" xs="12" className="planning-opex-chart-grid-col">
              {monitorSideContent}
            </Col>
            <Col xs="12" className="planning-opex-chart-grid-col">
              <Card className="mb-0 planning-opex-chart-card">
                <CardHeader className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <h6 className="mb-0">Monitor Batas Penggunaan vs Target YTD</h6>
                  {canManageBudgetGuardrail ? (
                    <Button
                      color="light"
                      size="sm"
                      onClick={() => setIsBudgetGuardrailModalOpen(true)}
                      disabled={budgetGuardrailConfigLoading || budgetGuardrailConfigSaving}
                    >
                      {budgetGuardrailConfigLoading ? (
                        <>
                          <Spinner size="sm" className="me-2" />
                          Memuat...
                        </>
                      ) : (
                        "Atur Target"
                      )}
                    </Button>
                  ) : null}
                </CardHeader>
                <CardBody className="planning-opex-chart-card__body">
                  <ul className="small text-muted mb-2 ps-3 planning-opex-chart-note-list">
                    <li>
                      Target bulan
                      {" "}
                      <strong>{overview?.budgetGuardrailMonitor?.reportMonth || "-"}</strong>
                      {" "}=
                      {" "}
                      <strong>
                        {Number(overview?.budgetGuardrailMonitor?.targetPct || 0).toLocaleString("id-ID", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </strong>
                      {" "}dari FY.
                    </li>
                    <li>Actual memakai YTD Januari sampai bulan aktif.</li>
                    <li>Hijau ≤ target, merah &gt; target bulan ini.</li>
                    <li>Over bulan ini tidak otomatis buruk untuk setahun penuh.</li>
                    {canManageBudgetGuardrail ? (
                      <li>Target bisa diubah per table dan per tahun lewat <strong>Atur Target</strong>.</li>
                    ) : null}
                    {budgetGuardrailMissingFyCount > 0 ? (
                      <li>{budgetGuardrailMissingFyCount} beban belum punya FY bulan aktif, jadi tidak dibandingkan di chart.</li>
                    ) : null}
                    {overview?.budgetGuardrailMonitor?.note ? (
                      <li>{overview.budgetGuardrailMonitor.note}</li>
                    ) : null}
                  </ul>
                  {loading ? (
                    <div className="text-muted planning-opex-chart-card__loading">Loading chart...</div>
                  ) : !hasAnyBudgetGuardrailFy ? (
                    <div className="text-muted planning-opex-chart-card__loading">
                      FY bulan aktif belum tersedia. Target bulan tetap ada, tetapi perbandingan actual vs target belum bisa dihitung.
                    </div>
                  ) : (
                    <div className="planning-opex-chart-card__chart planning-opex-budget-guardrail-chart">
                      <ReactApexChart
                        options={budgetGuardrailChartOptions}
                        series={budgetGuardrailChartSeries}
                        type="bar"
                        height={budgetGuardrailChartHeight}
                      />
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

    </>
  );
};

export default OpexLegacyCharts;
