/*
 * PGH-DOC
 * File: src/Components/Audit/Timeline/StatusBadge.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useRef, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  Info,
} from "react-feather";
import {
  getAuditStatusDisplayLabel,
  normalizeAuditStatusCategory,
} from "../Utils/auditValueLabels";

const statusStyles = {
  closed: { color: "success", icon: <CheckCircle size={12} /> },
  open: { color: "secondary", icon: <Info size={12} /> },
  inprogress: { color: "warning", icon: <Clock size={12} /> },
  unknown: { color: "info", icon: <HelpCircle size={12} /> },
  invalid: { color: "danger", icon: <AlertTriangle size={12} /> },
};

export const StatusBadge = ({ status }) => {
  const category = normalizeAuditStatusCategory(status);
  const displayLabel = getAuditStatusDisplayLabel(status);
  const { color, icon } = statusStyles[category] || statusStyles.unknown;

  const measureRef = useRef(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const check = () => {
      setTruncated(el.scrollWidth > el.clientWidth);
    };

    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayLabel]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: `var(--bs-${color})`,
        color: color === "light" ? "black" : "white",
        borderRadius: "8px",
        padding: "2px 6px",
        fontSize: "10px",
        fontWeight: 500,
        maxWidth: "100%",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <span
        ref={measureRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {icon} {displayLabel}
      </span>

      {truncated ? (
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          {icon}
        </span>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {icon} {displayLabel}
        </span>
      )}
    </span>
  );
};
