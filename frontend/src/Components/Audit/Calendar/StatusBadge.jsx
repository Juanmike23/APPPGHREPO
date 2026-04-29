/*
 * PGH-DOC
 * File: src/Components/Audit/Calendar/StatusBadge.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { CheckCircle, Circle, Play, Minus, XCircle, HelpCircle } from "react-feather";

const statusStyles = {
  CLOSED: { color: "success", icon: <CheckCircle size={12} /> },
  OPEN: { color: "info", icon: <Circle size={12} /> },
  INPROGRESS: { color: "warning", icon: <Play size={12} /> },
  BLANK: { color: "secondary", icon: <Minus size={12} /> },
  X: { color: "danger", icon: <XCircle size={12} /> },
  "": { color: "light", icon: <HelpCircle size={12} /> }, // empty string
};

export const StatusBadge = ({ status }) => {
  const normalized = (status || "").toUpperCase().trim();
  const { color, icon } = statusStyles[normalized] || {
    color: "secondary",
    icon: <HelpCircle size={12} />,
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: `var(--bs-${color})`,
        color: color === "light" ? "black" : "white",
        borderRadius: "8px",
        padding: "2px 6px",
        fontSize: "10px",
        fontWeight: 500,
      }}
    >
      {icon}
      {normalized || "EMPTY"}
    </span>
  );
};
