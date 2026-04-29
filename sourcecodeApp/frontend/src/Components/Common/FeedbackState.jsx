/*
 * PGH-DOC
 * File: src/Components/Common/FeedbackState.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import { Button, Spinner } from "@pgh/ui-bootstrap";
import { AlertTriangle, Inbox, Lock } from "react-feather";
import "./FeedbackState.scss";

const DEFAULT_COPY = {
  loading: {
    title: "Loading",
    description: "Data sedang dimuat. Mohon tunggu sebentar.",
  },
  empty: {
    title: "No data",
    description: "Belum ada data untuk ditampilkan.",
  },
  error: {
    title: "Failed to load",
    description: "Terjadi kendala saat memuat data.",
  },
  restricted: {
    title: "Access restricted",
    description: "Anda hanya memiliki akses terbatas untuk area ini.",
  },
};

const ICON_MAP = {
  empty: Inbox,
  error: AlertTriangle,
  restricted: Lock,
};

const FeedbackState = ({
  variant = "empty",
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  className = "",
}) => {
  const copy = DEFAULT_COPY[variant] || DEFAULT_COPY.empty;
  const Icon = ICON_MAP[variant] || Inbox;

  return (
    <div
      className={`feedback-state feedback-state--${variant} ${
        compact ? "feedback-state--compact" : ""
      } ${className}`.trim()}
    >
      <div className="feedback-state__icon">
        {variant === "loading" ? (
          <Spinner size="sm" color="warning" />
        ) : (
          <Icon size={20} />
        )}
      </div>
      <div className="feedback-state__title">{title || copy.title}</div>
      <div className="feedback-state__description">
        {description || copy.description}
      </div>
      {actionLabel && onAction ? (
        <Button
          color="primary"
          size="sm"
          className="feedback-state__action"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default FeedbackState;
