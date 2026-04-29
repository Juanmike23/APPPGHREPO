/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/RemainderCusClass.jsx
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
import { Card, CardBody } from "@pgh/ui-bootstrap";
import { Disc, PlusCircle, Target } from "react-feather";

import CusClassProcure from "./CusClassProcure";
import FeedbackState from "../../Common/FeedbackState";
import { buildProcurementDrilldownUrl } from "../APS/procurementViewState";

const BAND_OPTIONS = [
  { value: 1, label: "<= 1 Bulan", tone: "danger" },
  { value: 3, label: "<= 3 Bulan", tone: "warning" },
  { value: 6, label: "<= 6 Bulan", tone: "success" },
];

const resolveReminderDrilldownConfig = (activeTab, selectedBand) => ({
  tab: "all",
  chartColumn: "JatuhTempo",
  countdown: selectedBand,
  ...(activeTab !== "all"
    ? {
        secondaryColumn: "Source",
        secondaryLabel: activeTab,
      }
    : {}),
});

const resolveCountsBucket = (counts, activeTab) => {
  const bands = counts?.bands ?? counts?.Bands ?? {};

  if (activeTab === "new") {
    return bands?.newproc ?? bands?.Newproc ?? {};
  }

  if (activeTab === "existing") {
    return bands?.existingproc ?? bands?.Existingproc ?? {};
  }

  return bands?.all ?? bands?.All ?? {};
};

const RemainderCusClass = ({
  activeTab,
  compare = false,
  summaryOnly = false,
  externalRows = [],
  externalCounts = {},
  externalLoading = false,
  externalError = "",
}) => {
  const [selectedBand, setSelectedBand] = useState(6);

  const Icon =
    activeTab === "all" ? Target : activeTab === "new" ? PlusCircle : Disc;

  useEffect(() => {
    setSelectedBand(6);
  }, [activeTab]);

  const resolvedRows = useMemo(
    () => (Array.isArray(externalRows) ? externalRows : []),
    [externalRows],
  );

  const resolvedCounts = useMemo(
    () => externalCounts || {},
    [externalCounts],
  );

  const resolvedProgressMap = useMemo(() => {
    return Object.fromEntries(
      resolvedRows.map((item) => {
        const itemId = Number(item?.Id ?? item?.id ?? 0);
        return [
          itemId,
          {
            progress: Number(item?.Progress ?? item?.progress ?? 0),
            currentStep:
              item?.CurrentStep ??
              item?.currentStep ??
              item?.Status_Pengadaan ??
              item?.statusPengadaan ??
              "Not Started",
          },
        ];
      }),
    );
  }, [resolvedRows]);

  const resolvedLoading = Boolean(externalLoading);
  const resolvedError =
    typeof externalError === "string"
      ? externalError
      : externalError
        ? "Failed to load reminders."
        : "";

  const bandCounts = useMemo(() => {
    const bucket = resolveCountsBucket(resolvedCounts, activeTab);

    return {
      1: Number(bucket.month1 ?? bucket.Month1 ?? 0),
      3: Number(bucket.month3 ?? bucket.Month3 ?? 0),
      6: Number(bucket.month6 ?? bucket.Month6 ?? 0),
    };
  }, [activeTab, resolvedCounts]);

  const filteredRows = useMemo(
    () =>
      resolvedRows.filter((row) => {
        const monthsRemaining = Number(row?.SisaBulan ?? row?.sisaBulan);
        return Number.isFinite(monthsRemaining) && monthsRemaining >= 0 && monthsRemaining <= selectedBand;
      }),
    [resolvedRows, selectedBand],
  );

  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort(
        (left, right) =>
          Number(left?.DaysRemaining ?? left?.daysRemaining ?? 0) -
          Number(right?.DaysRemaining ?? right?.daysRemaining ?? 0),
      ),
    [filteredRows],
  );

  const headerCount = bandCounts[selectedBand] ?? filteredRows.length;

  const cardSubtitle = compare
    ? "Reminder stream procurement berdasarkan jarak jatuh tempo."
    : "Pilih bucket 1, 3, atau 6 bulan untuk melihat procurement yang segera jatuh tempo.";

  return (
    <Card className="procurement-dashboard-panel procurement-dashboard-panel--reminder procurement-reminder-card h-100">
      <CardBody className="procurement-dashboard-panel__body procurement-dashboard-panel__body--chart d-flex flex-column">
        <div className="procurement-dashboard-card-header">
          <div className="procurement-dashboard-card-header__copy">
            <span className="procurement-dashboard-card-eyebrow">Reminder</span>
            <h5 className="procurement-dashboard-card-title">
              <Icon size={16} className="me-2" />
              Jatuh Tempo {activeTab === "all" ? "Procurement" : activeTab === "new" ? "New" : "Existing"} ({headerCount})
            </h5>
            <p className="procurement-dashboard-card-subtitle">{cardSubtitle}</p>
          </div>
        </div>

        <div className="procurement-reminder-band-group">
          {BAND_OPTIONS.map((band) => {
            const isActive = selectedBand === band.value;
            const countValue = bandCounts[band.value] ?? 0;

            return (
              <button
                key={band.value}
                type="button"
                className={`procurement-reminder-band ${isActive ? "procurement-reminder-band--active" : ""}`}
                data-tone={band.tone}
                onClick={summaryOnly ? undefined : () => setSelectedBand(band.value)}
                style={{ cursor: summaryOnly ? "default" : "pointer" }}
              >
                <span>{band.label}</span>
                <span className="procurement-reminder-band__count">{countValue}</span>
              </button>
            );
          })}
        </div>

        {summaryOnly ? (
          <div className="procurement-reminder-empty mt-auto">
            <div>
              <strong>Ringkasan tersedia.</strong>
              <div>Detail reminder hanya tersedia untuk stream pemilik dashboard.</div>
            </div>
          </div>
        ) : resolvedLoading ? (
          <FeedbackState
            variant="loading"
            title="Loading reminders"
            description="Reminder procurement sedang disiapkan dari data jatuh tempo."
            compact
          />
        ) : resolvedError && sortedRows.length === 0 ? (
          <FeedbackState
            variant="error"
            title="Failed to load reminders"
            description={resolvedError}
            compact
          />
        ) : sortedRows.length === 0 ? (
          <div className="procurement-reminder-empty mt-auto">
            Tidak ada procurement dengan jatuh tempo {selectedBand} bulan ke depan.
          </div>
        ) : (
          <div className="procurement-reminder-scroll mt-auto">
            <div className="procurement-reminder-list">
              {sortedRows.map((row) => {
                const rowId = Number(row?.Id ?? row?.id ?? 0);
                const progressState = resolvedProgressMap[rowId] || {};

                return (
                    <CusClassProcure
                      key={rowId}
                    item={{
                      id: rowId,
                      badge: (row?.Type ?? row?.type) === "new" ? "New" : "Existing",
                      perjanjian: row?.Perjanjian ?? row?.perjanjian,
                      statusPengadaan:
                        progressState.currentStep ??
                        row?.Status_Pengadaan ??
                        row?.status_Pengadaan ??
                        row?.statusPengadaan ??
                        "Not Started",
                      progress: progressState.progress ?? 0,
                      type: row?.Type ?? row?.type,
                      daysRemaining: row?.DaysRemaining ?? row?.daysRemaining,
                      monthsRemaining: row?.SisaBulan ?? row?.sisaBulan,
                      colorCode: row?.ColorCode ?? row?.colorCode,
                      }}
                      to={buildProcurementDrilldownUrl(
                        resolveReminderDrilldownConfig(activeTab, selectedBand),
                      )}
                    />
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default RemainderCusClass;
