/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/CusClassProcure.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useState } from "react";
import { Progress } from "@pgh/ui-bootstrap";
import { useNavigate } from "react-router-dom";

const resolveCountdownLabel = (monthsRemaining, daysRemaining) => {
  if (!Number.isFinite(daysRemaining)) {
    return {
      primary: "Tanpa jatuh tempo",
      secondary: "",
    };
  }

  if (monthsRemaining <= 0) {
    return {
      primary: "Jatuh tempo bulan ini",
      secondary: `${daysRemaining} hari lagi`,
    };
  }

  if (monthsRemaining <= 1) {
    return {
      primary: "<= 1 bulan",
      secondary: `${daysRemaining} hari lagi`,
    };
  }

  if (monthsRemaining <= 3) {
    return {
      primary: "<= 3 bulan",
      secondary: `${daysRemaining} hari lagi`,
    };
  }

  if (monthsRemaining <= 6) {
    return {
      primary: "<= 6 bulan",
      secondary: `${daysRemaining} hari lagi`,
    };
  }

  return {
    primary: "> 6 bulan",
    secondary: `${daysRemaining} hari lagi`,
  };
};

const CusClassProcure = ({ item, to }) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const openAPS = useCallback(
    () =>
      navigate(to, {
        state: {
          row: item,
          highlightRowId: item?.id ?? item?.Id ?? item?.ID ?? null,
        },
      }),
    [item, navigate, to],
  );

  const colorRules = ["danger", "warning", "success", "secondary"].includes(item.colorCode)
    ? item.colorCode
    : "success";
  const countdown = resolveCountdownLabel(item.monthsRemaining, item.daysRemaining);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`procurement-reminder-item procurement-reminder-item--${colorRules}`}
      onClick={openAPS}
      onKeyDown={(event) => event.key === "Enter" && openAPS()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: "pointer",
        transform: isHovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div className="procurement-reminder-item__top">
        <div className="procurement-reminder-item__identity">
          <div className="procurement-reminder-item__topline">
            <span className="procurement-reminder-item__eyebrow">
              {item.badge} Procurement
            </span>
            <span className={`badge rounded-pill bg-${colorRules}`}>{item.badge}</span>
          </div>
          <h6 className="procurement-reminder-item__title">
            {item.perjanjian || "-"}
          </h6>
        </div>
        <div className="procurement-reminder-item__countdown-pill">
          <span className={`procurement-reminder-item__countdown-value text-${colorRules}`}>
            {countdown.primary}
          </span>
          {countdown.secondary ? (
            <span className="procurement-reminder-item__countdown-days">
              {countdown.secondary}
            </span>
          ) : null}
        </div>
      </div>

      <div className="procurement-reminder-item__status-row">
        <div className="procurement-reminder-item__status">
          <span className="procurement-reminder-item__status-label">
            Checkpoint Saat Ini
          </span>
          <span className="procurement-reminder-item__status-value">
            {item.statusPengadaan || "Not Started"}
          </span>
        </div>
      </div>

      <div className="procurement-reminder-item__progress-label">
        <span>Progress Checklist</span>
        <span>{item.progress}%</span>
      </div>
      <div className="procurement-reminder-item__progress">
        <Progress
          striped={item.progress !== 100}
          color={colorRules}
          value={item.progress}
        />
      </div>
    </div>
  );
};

export default CusClassProcure;
