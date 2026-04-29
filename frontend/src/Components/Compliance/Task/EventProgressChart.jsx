/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/EventProgressChart.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import {
  Card,
  CardBody,
  CardHeader,
  Col,
  FormGroup,
  Input,
  Label,
  Row,
} from "@pgh/ui-bootstrap";
import FeedbackState from "../../Common/FeedbackState";

const detectDarkOnlyTheme = () =>
  typeof document !== "undefined" &&
  document.body?.classList?.contains("dark-only");

const clampProgress = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, numeric));
};

const parseProgressValue = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .replace("%", "")
    .replace(",", ".");

  if (!normalized) {
    return 0;
  }

  return clampProgress(normalized);
};

const formatProgressLabel = (value) =>
  `${parseProgressValue(value).toFixed(1)}%`;

const getProgressPercent = (row) =>
  row?.ProgressPercent ?? row?.progressPercent ?? row?.Status ?? row?.status ?? 0;

const pickFirst = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] != null && source[key] !== "") {
      return source[key];
    }
  }

  return null;
};

const normalizeEventId = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const normalizeSummaryPayload = (payload) => {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.rows || payload?.data || payload?.items || payload?.results || [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((item) => {
      const eventName = String(
        pickFirst(item, ["periodName", "PeriodName", "eventName", "EventName"]) || "",
      ).trim();

      if (!eventName) {
        return null;
      }

      return {
        groupId: normalizeEventId(
          pickFirst(item, ["groupId", "GroupId", "eventGroupId", "EventGroupId"]),
        ),
        eventName,
        period: String(pickFirst(item, ["period", "Period"]) || "").trim(),
        averageProgress: parseProgressValue(
          pickFirst(item, [
            "averageProgress",
            "AverageProgress",
            "avgProgress",
            "AvgProgress",
            "progressPercent",
            "ProgressPercent",
          ]),
        ),
        documentCount: Number(
          pickFirst(item, [
            "documentCount",
            "DocumentCount",
            "totalDocuments",
            "TotalDocuments",
            "count",
            "Count",
          ]) || 0,
        ),
      };
    })
    .filter(Boolean);
};

const getDocumentLabel = (row, index) => {
  const title = String(row?.DocumentToSubmit || "").trim();
  const fileName = String(row?.FileName || "").trim();

  if (title) {
    return title;
  }

  if (fileName) {
    return fileName;
  }

  return `Document ${index + 1}`;
};

const buildBarColor = (progress) => {
  if (progress >= 100) return "#15803d";
  if (progress >= 75) return "#22c55e";
  if (progress >= 50) return "#f59e0b";
  if (progress > 0) return "#f47c4c";
  return "#cbd5e1";
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ALL_EVENTS_VALUE = "__all_events__";

const EventProgressChart = ({
  reports = [],
  activeEventId = null,
  activeEventLabel = "",
  onSelectEvent,
  onSelectDocument,
  summaryOnly = false,
  showSearch = true,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryEventFilter, setSummaryEventFilter] = useState(ALL_EVENTS_VALUE);
  const [isDarkTheme, setIsDarkTheme] = useState(detectDarkOnlyTheme);
  const [loadingSummary, setLoadingSummary] = useState(summaryOnly);
  const [summaryError, setSummaryError] = useState("");

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

  useEffect(() => {
    if (!summaryOnly) {
      setSummaryRows([]);
      setSummaryError("");
      setLoadingSummary(false);
      return undefined;
    }

    let cancelled = false;

    const fetchSummary = async () => {
      setLoadingSummary(true);
      setSummaryError("");

      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_BASE_URL}DocumentPeriodReport/progress-summary`,
          { credentials: "include" },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setSummaryRows(normalizeSummaryPayload(payload));
        }
      } catch (error) {
        if (!cancelled) {
          setSummaryRows([]);
          setSummaryError(
            error instanceof Error
              ? error.message
              : "Gagal memuat ringkasan progress event.",
          );
        }
        console.error("Failed to fetch progress summary:", error);
      } finally {
        if (!cancelled) {
          setLoadingSummary(false);
        }
      }
    };

    fetchSummary();

    return () => {
      cancelled = true;
    };
  }, [summaryOnly]);

  const eventOptions = useMemo(
    () =>
      summaryRows
        .filter((item) => item.groupId)
        .map((item) => ({
          id: item.groupId,
          eventName: item.eventName,
          period: item.period,
        })),
    [summaryRows],
  );

  const selectedSummaryEvent =
    summaryOnly &&
    summaryEventFilter !== ALL_EVENTS_VALUE &&
    eventOptions.some((item) => String(item.id) === String(summaryEventFilter))
      ? String(summaryEventFilter)
      : ALL_EVENTS_VALUE;

  const activeEventName =
    activeEventLabel ||
    String(reports[0]?.PeriodName || reports[0]?.periodName || "").trim();

  const summaryChartRows = useMemo(() => {
    const loweredTerm = searchTerm.trim().toLowerCase();

    return summaryRows.filter((row) => {
      if (
        selectedSummaryEvent !== ALL_EVENTS_VALUE &&
        String(row.groupId ?? "") !== String(selectedSummaryEvent)
      ) {
        return false;
      }

      if (!loweredTerm) {
        return true;
      }

      return row.eventName.toLowerCase().includes(loweredTerm);
    });
  }, [searchTerm, selectedSummaryEvent, summaryRows]);

  const filteredRows = useMemo(() => {
    const loweredTerm = searchTerm.trim().toLowerCase();

    return reports.filter((row) => {
        if (!loweredTerm) {
          return true;
        }

        const haystacks = [
          row?.DocumentToSubmit,
          row?.FileName,
          row?.Link,
        ]
          .filter(Boolean)
          .map((item) => String(item).toLowerCase());

        return haystacks.some((item) => item.includes(loweredTerm));
      });
  }, [reports, searchTerm]);

  const chartRows = useMemo(
    () =>
      filteredRows.map((row, index) => ({
        id: row.Id,
        groupId: normalizeEventId(row?.GroupId ?? row?.groupId) ?? activeEventId,
        label: getDocumentLabel(row, index),
        fileName: row.FileName || "",
        progress: parseProgressValue(getProgressPercent(row)),
      })),
    [activeEventId, filteredRows],
  );

  const selectedSummary = useMemo(() => {
    if (summaryOnly && selectedSummaryEvent === ALL_EVENTS_VALUE) {
      return null;
    }

    return summaryRows.find(
      (item) => String(item.groupId ?? "") === String(selectedSummaryEvent),
    ) || null;
  }, [selectedSummaryEvent, summaryOnly, summaryRows]);

  const averageProgress = selectedSummary?.averageProgress ?? (() => {
    if (!chartRows.length) {
      return 0;
    }

    const total = chartRows.reduce((sum, row) => sum + row.progress, 0);
    return Number((total / chartRows.length).toFixed(2));
  })();

  const summaryAverageProgress = useMemo(() => {
    if (!summaryChartRows.length) {
      return 0;
    }

    const weighted = summaryChartRows.reduce(
      (accumulator, row) => {
        const documentCount = Math.max(0, Number(row.documentCount || 0));
        return {
          totalWeight: accumulator.totalWeight + documentCount,
          totalProgress:
            accumulator.totalProgress + row.averageProgress * documentCount,
        };
      },
      { totalWeight: 0, totalProgress: 0 },
    );

    if (weighted.totalWeight > 0) {
      return Number((weighted.totalProgress / weighted.totalWeight).toFixed(2));
    }

    const total = summaryChartRows.reduce(
      (sum, row) => sum + row.averageProgress,
      0,
    );

    return Number((total / summaryChartRows.length).toFixed(2));
  }, [summaryChartRows]);

  const chartPalette = useMemo(
    () =>
      isDarkTheme
        ? {
            dataLabel: "#E2E8F0",
            grid: "rgba(148, 163, 184, 0.18)",
            yAxisText: "#CBD5E1",
            tooltipBackground: "#111827",
            tooltipText: "#F8FAFC",
            tooltipBorder: "rgba(148, 163, 184, 0.22)",
            averageBackground: "rgba(15, 23, 42, 0.9)",
            averageBorder: "rgba(148, 163, 184, 0.18)",
            averageLabel: "#94A3B8",
            averageValue: "#F8FAFC",
          }
        : {
            dataLabel: "#0F172A",
            grid: "#eef2f7",
            yAxisText: "#334155",
            tooltipBackground: "#FFF7ED",
            tooltipText: "#24364A",
            tooltipBorder: "rgba(36, 54, 74, 0.14)",
            averageBackground: "#f8fafc",
            averageBorder: "#e2e8f0",
            averageLabel: "#64748B",
            averageValue: "#0F172A",
          },
    [isDarkTheme],
  );

  const options = useMemo(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        animations: { easing: "easeout", speed: 300 },
        events: {
          dataPointSelection: (_event, _chartContext, config) => {
            const row = chartRows[config.dataPointIndex];
            if (row) {
              onSelectDocument?.(row.groupId ?? activeEventId, row.id);
            }
          },
        },
      },
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: true,
          borderRadius: 6,
          barHeight: "62%",
        },
      },
      colors: chartRows.map((row) => buildBarColor(row.progress)),
      dataLabels: {
        enabled: true,
        formatter: (value) => formatProgressLabel(value),
        style: {
          fontSize: "11px",
          fontWeight: 600,
          colors: [chartPalette.dataLabel],
        },
        offsetX: 12,
      },
      grid: {
        borderColor: chartPalette.grid,
      },
      xaxis: {
        categories: chartRows.map((row) => row.label),
        min: 0,
        max: 100,
        tickAmount: 5,
        labels: {
          show: false,
        },
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        },
      },
      yaxis: {
        labels: {
          align: "left",
          minWidth: 0,
          maxWidth: 260,
          offsetX: -6,
          style: {
            fontSize: "12px",
            colors: chartPalette.yAxisText,
          },
        },
      },
      tooltip: {
        custom: ({ dataPointIndex }) => {
          const row = chartRows[dataPointIndex];
          if (!row) {
            return "";
          }

          return `
            <div style="
              padding:10px 12px;
              background:${chartPalette.tooltipBackground};
              color:${chartPalette.tooltipText};
              border:1px solid ${chartPalette.tooltipBorder};
              border-radius:10px;
            ">
              <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(row.label)}</div>
              <div>Progress: ${escapeHtml(formatProgressLabel(row.progress))}</div>
              <div>File: ${escapeHtml(row.fileName || "-")}</div>
            </div>
          `;
        },
      },
      legend: {
        show: false,
      },
    }),
    [activeEventId, chartPalette, chartRows, onSelectDocument],
  );

  const chartHeight = Math.max(280, chartRows.length * 54 + 40);
  const summaryChartHeight = Math.max(280, summaryChartRows.length * 54 + 40);
  const hasDetailSelection =
    activeEventId !== null && activeEventId !== undefined;

  const summaryOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        animations: { easing: "easeout", speed: 300 },
        events: {
          dataPointSelection: (_event, _chartContext, config) => {
            const row = summaryChartRows[config.dataPointIndex];
            if (row?.groupId) {
              setSummaryEventFilter(String(row.groupId));
              onSelectEvent?.(row.groupId);
            }
          },
        },
      },
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: true,
          borderRadius: 6,
          barHeight: "62%",
        },
      },
      colors: summaryChartRows.map((row) => buildBarColor(row.averageProgress)),
      dataLabels: {
        enabled: true,
        formatter: (value) => formatProgressLabel(value),
        style: {
          fontSize: "11px",
          fontWeight: 600,
          colors: [chartPalette.dataLabel],
        },
        offsetX: 12,
      },
      grid: {
        borderColor: chartPalette.grid,
      },
      xaxis: {
        categories: summaryChartRows.map((row) => row.eventName),
        min: 0,
        max: 100,
        labels: {
          show: false,
        },
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        },
      },
      yaxis: {
        labels: {
          align: "left",
          minWidth: 0,
          maxWidth: 260,
          offsetX: -6,
          style: {
            fontSize: "12px",
            colors: chartPalette.yAxisText,
          },
        },
      },
      tooltip: {
        custom: ({ dataPointIndex }) => {
          const row = summaryChartRows[dataPointIndex];
          if (!row) {
            return "";
          }

          return `
            <div style="
              padding:10px 12px;
              background:${chartPalette.tooltipBackground};
              color:${chartPalette.tooltipText};
              border:1px solid ${chartPalette.tooltipBorder};
              border-radius:10px;
            ">
              <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(row.eventName)}</div>
              <div>Average Progress: ${escapeHtml(formatProgressLabel(row.averageProgress))}</div>
              <div>Documents: ${escapeHtml(String(row.documentCount || 0))}</div>
            </div>
          `;
        },
      },
      legend: {
        show: false,
      },
    }),
    [chartPalette, onSelectEvent, summaryChartRows],
  );

  return (
    <Col sm="12" className="compliance-events-chart-col">
      <Card className="compliance-dashboard-card compliance-dashboard-card--chart compliance-events-chart-card">
        <CardHeader
          className="pb-0 compliance-events-chart-card__header"
          style={{ background: "transparent", textAlign: "left" }}
        >
          <h5 className="mb-1">
            {summaryOnly
              ? "Events Progress Summary"
              : activeEventName
                ? `Document Progress Chart - ${activeEventName}`
                : "Document Progress Chart"}
          </h5>
          <p className="text-muted mb-0">
            {summaryOnly
              ? "Ringkasan rata-rata progress per event untuk akses lintas-stream Manager."
              : "Lihat progress masing-masing dokumen. Klik salah satu bar untuk fokus ke row dokumen tersebut."}
          </p>
        </CardHeader>
        <CardBody className="compliance-events-chart-card__body">
          <Row className="g-3 align-items-end mb-3 compliance-events-chart-card__filters">
            {summaryOnly && (
              <Col md="5">
                <FormGroup className="mb-0">
                  <Label>Event</Label>
                  <Input
                    type="select"
                    value={selectedSummaryEvent}
                    onChange={(event) => setSummaryEventFilter(event.target.value)}
                  >
                    <option value={ALL_EVENTS_VALUE}>All Events</option>
                    {eventOptions.map((eventOption) => (
                      <option key={eventOption.id} value={eventOption.id}>
                        {eventOption.eventName}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
            )}
            {showSearch ? (
              <Col md={summaryOnly ? "5" : "8"}>
                <FormGroup className="mb-0">
                  <Label>{summaryOnly ? "Search Event" : "Search Document"}</Label>
                  <Input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={
                      summaryOnly
                        ? "Search by event name"
                        : "Search by title or file name"
                    }
                  />
                </FormGroup>
              </Col>
            ) : null}
            <Col md={summaryOnly ? "2" : showSearch ? "4" : "3"}>
              <div
                style={{
                  borderRadius: "12px",
                  padding: "10px 12px",
                  background: chartPalette.averageBackground,
                  border: `1px solid ${chartPalette.averageBorder}`,
                  boxShadow: "inset 4px 0 0 rgba(241, 90, 34, 0.72)",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: chartPalette.averageLabel }}>
                  {summaryOnly
                    ? selectedSummary
                      ? "Avg Selected Event"
                      : "Avg All Events"
                    : "Avg Progress"}
                </div>
                <div style={{ fontWeight: 700, color: chartPalette.averageValue }}>
                  {formatProgressLabel(
                    summaryOnly && selectedSummary
                      ? selectedSummary.averageProgress
                      : summaryOnly
                        ? summaryAverageProgress
                        : averageProgress,
                  )}
                </div>
                {(summaryOnly
                  ? summaryChartRows.length
                  : selectedSummary?.documentCount) ? (
                  <div style={{ fontSize: "0.75rem", color: chartPalette.averageLabel }}>
                    {summaryOnly
                      ? selectedSummary
                        ? `${selectedSummary.documentCount || 0} docs`
                        : `${summaryChartRows.length} events`
                      : `${selectedSummary.documentCount} docs`}
                  </div>
                ) : null}
              </div>
            </Col>
          </Row>

          {summaryOnly ? (
            loadingSummary ? (
              <FeedbackState
                variant="loading"
                title="Loading event summary"
                description="Ringkasan average progress per event sedang dimuat."
                compact
              />
            ) : summaryError ? (
              <FeedbackState
                variant="error"
                title="Failed to load event summary"
                description={summaryError}
                compact
              />
            ) : summaryChartRows.length ? (
              <ReactApexChart
                options={summaryOptions}
                series={[
                  {
                    name: "Average Progress",
                    data: summaryChartRows.map((row) => row.averageProgress),
                  },
                ]}
                type="bar"
                height={summaryChartHeight}
              />
            ) : (
              <FeedbackState
                variant="empty"
                title="No event summary"
                description="Belum ada event yang bisa ditampilkan untuk filter saat ini."
                compact
              />
            )
          ) : hasDetailSelection && chartRows.length ? (
            <ReactApexChart
              options={options}
              series={[{ name: "Progress", data: chartRows.map((row) => row.progress) }]}
              type="bar"
              height={chartHeight}
            />
          ) : (
            <FeedbackState
              variant="empty"
              title={hasDetailSelection ? "No matching documents" : "No event available"}
              description={
                hasDetailSelection
                  ? "Tidak ada dokumen yang cocok dengan filter yang sedang dipakai."
                  : "Belum ada event untuk ditampilkan."
              }
              compact
            />
          )}
        </CardBody>
      </Card>
    </Col>
  );
};

export default EventProgressChart;
