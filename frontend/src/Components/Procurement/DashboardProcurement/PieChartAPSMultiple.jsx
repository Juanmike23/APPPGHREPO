/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/PieChartAPSMultiple.jsx
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
import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "@pgh/ui-bootstrap";

import PieChartClass from "../../../Variables/Chart/PieChartMultiple";
import FeedbackState from "../../Common/FeedbackState";
import { buildProcurementDrilldownUrl } from "../APS/procurementViewState";

const baseUrl = `${process.env.REACT_APP_API_BASE_URL}apschart/chart`;

const buildCombinedReminderChartData = (countsBucket) => {
  const month1 = Number(countsBucket?.month1 ?? 0);
  const month3 = Number(countsBucket?.month3 ?? 0);
  const month6 = Number(countsBucket?.month6 ?? 0);

  return [
    ["Label", "Count"],
    ["<= 1 Bulan", month1],
    ["<= 3 Bulan", Math.max(month3 - month1, 0)],
    ["<= 6 Bulan", Math.max(month6 - month3, 0)],
  ].filter((row, index) => index === 0 || row[1] > 0);
};

const resolveReminderBucket = (payload, activeTab) => {
  if (activeTab === "new") {
    return payload?.bands?.newproc ?? {};
  }

  if (activeTab === "existing") {
    return payload?.bands?.existingproc ?? {};
  }

  return payload?.bands?.all ?? {};
};

const resolveCombinedBandConfig = (label) => {
  const normalizedLabel = String(label ?? "").toLowerCase();
  if (normalizedLabel.includes("<= 1")) {
    return { countdown: 1, countdownStart: null };
  }
  if (normalizedLabel.includes("<= 3")) {
    return { countdown: 3, countdownStart: 1 };
  }
  if (normalizedLabel.includes("<= 6")) {
    return { countdown: 6, countdownStart: 3 };
  }
  return null;
};

const MultiPieChartDashboard = ({
  activeTab,
  blockedMessage = "",
  combined = false,
  pieSizeOverride = null,
  cardClassName = "",
}) => {
  const navigate = useNavigate();
  const [chartDataMap, setChartDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const combinedTitle = useMemo(() => {
    if (activeTab === "all") {
      return "Jatuh Tempo";
    }

    return `Jatuh Tempo ${activeTab === "new" ? "New" : "Existing"}`;
  }, [activeTab]);

  const chartConfigs = useMemo(
    () => [
      {
        title: "<= 1 Bulan",
        api: `${baseUrl}/duedue?months=1&type=${activeTab}`,
        countdown: 1,
      },
      {
        title: "<= 3 Bulan",
        api: `${baseUrl}/duedue?months=3&type=${activeTab}`,
        countdown: 3,
      },
      {
        title: "<= 6 Bulan",
        api: `${baseUrl}/duedue?months=6&type=${activeTab}`,
        countdown: 6,
      },
    ],
    [activeTab],
  );

  useEffect(() => {
    let active = true;

    const fetchAll = async () => {
      setLoading(true);
      setError("");

      try {
        let formattedData = {};

        if (combined) {
          const response = await fetch(
            `${process.env.REACT_APP_API_BASE_URL}apschart/reminders/counts`,
            { credentials: "include" },
          );
          const payload = response.ok ? await response.json() : null;
          const bucket = resolveReminderBucket(payload, activeTab);

          formattedData = {
            Combined: buildCombinedReminderChartData(bucket),
          };
        } else {
          const responses = await Promise.all(
            chartConfigs.map(async (config) => {
              const response = await fetch(config.api, { credentials: "include" });
              const data = response.ok ? await response.json() : null;
              return { key: config.title, data };
            }),
          );

          responses.forEach(({ key, data }) => {
            if (data?.Labels && data?.Values) {
              formattedData[key] = [
                ["Label", "Count"],
                ...data.Labels.map((label, index) => [
                  label,
                  Number(data.Values[index] || 0),
                ]),
              ];
            } else {
              formattedData[key] = [["Label", "Count"]];
            }
          });
        }

        if (!active) {
          return;
        }

        setChartDataMap(formattedData);
      } catch (fetchError) {
        if (!active) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load charts.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      active = false;
    };
  }, [activeTab, chartConfigs, combined]);

  const handleCombinedDrilldown = ({ label }) => {
    if (blockedMessage) {
      return false;
    }

    const bandConfig = resolveCombinedBandConfig(label);
    if (!bandConfig) {
      return false;
    }

    const nextUrl = buildProcurementDrilldownUrl({
      tab: "all",
      chartColumn: "JatuhTempo",
      countdown: bandConfig.countdown,
      countdownStart: bandConfig.countdownStart,
      ...(activeTab !== "all"
        ? {
            secondaryColumn: "Source",
            secondaryLabel: activeTab,
          }
        : {}),
    });

    navigate(nextUrl, {
      state: {
        chartcolumn: "JatuhTempo",
        label: String(label ?? ""),
      },
    });

    return true;
  };

  return (
    <Card
      className={[
        "income-card",
        "card-primary",
        "audit-dashboard-card",
        "audit-dashboard-card--chart",
        cardClassName,
        "h-100",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CardBody className="audit-dashboard-mini-card-body audit-dashboard-mini-card-body--pie d-flex flex-column">
        {loading ? (
          <FeedbackState
            variant="loading"
            title="Loading charts"
            description="Ringkasan jatuh tempo procurement sedang dimuat."
            compact
          />
        ) : error && !Object.keys(chartDataMap).length ? (
          <FeedbackState
            variant="error"
            title="Failed to load charts"
            description={error}
            compact
          />
        ) : (
          combined ? (
            <div className="audit-dashboard-clickable-tile h-100">
              <PieChartClass
                title={combinedTitle}
                chartcolumn="JatuhTempo"
                chartData={chartDataMap.Combined || [["Label", "Count"]]}
                legendPosition="left"
                showLegend
                showLine
                blockedMessage={blockedMessage}
                dashboardLayout
                pieSizeOverride={pieSizeOverride ?? 212}
                normalizeDrilldownValue={false}
                navigatePath={null}
                titleNavigatePath={
                  blockedMessage
                    ? null
                    : buildProcurementDrilldownUrl({
                        tab: "all",
                        chartColumn: "JatuhTempo",
                        countdown: 6,
                        ...(activeTab !== "all"
                          ? {
                              secondaryColumn: "Source",
                              secondaryLabel: activeTab,
                            }
                          : {}),
                      })
                }
                onDrilldown={handleCombinedDrilldown}
              />
            </div>
          ) : (
            <div className="audit-dashboard-mini-grid">
              {chartConfigs.map((config) => {
                const chartData = chartDataMap[config.title] || [["Label", "Count"]];
                const labelCount = Math.max(0, chartData.length - 1);

                return (
                  <div key={config.title} className="audit-dashboard-clickable-tile">
                    <PieChartClass
                      title={config.title}
                      chartcolumn={`reminder-${config.countdown}`}
                      chartData={chartData}
                      legendPosition="left"
                      showLegend={labelCount > 1}
                      showLine
                      blockedMessage={blockedMessage}
                      dashboardLayout
                      pieSizeOverride={pieSizeOverride ?? 212}
                      normalizeDrilldownValue={false}
                      navigatePath={
                        blockedMessage
                          ? null
                          : buildProcurementDrilldownUrl({
                              tab: "all",
                              chartColumn: "JatuhTempo",
                              countdown: config.countdown,
                              secondaryColumn: "Source",
                              secondaryLabel:
                                activeTab === "all" ? "{label}" : activeTab,
                            })
                      }
                      titleNavigatePath={
                        blockedMessage
                          ? null
                          : buildProcurementDrilldownUrl({
                              tab: "all",
                              chartColumn: "JatuhTempo",
                              countdown: config.countdown,
                              ...(activeTab !== "all"
                                ? {
                                    secondaryColumn: "Source",
                                    secondaryLabel: activeTab,
                                  }
                                : {}),
                            })
                      }
                    />
                  </div>
                );
              })}
            </div>
          )
        )}
      </CardBody>
    </Card>
  );
};

export default MultiPieChartDashboard;
