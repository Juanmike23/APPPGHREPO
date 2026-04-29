/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/BarChartAudit.jsx
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
import BarChartHorizontal from "../../../Variables/Chart/BarChartHorizontal";

const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${PUBLIC_URL}${normalizedPath}`;
};

const PlotChartStatus = ({
  data,
  title = "Status",
  chartcolumn,
  type,
  navigatePath = `${buildAppPath("/audit/listAudit")}?chartcolumn={chartcolumn}&label={label}&type=${type}`,
  blockedMessage = "",
  cardClassName = "",
  onDrilldown,
  externalLoading = false,
  externalError = false,
}) => {
  return (
   
        <BarChartHorizontal
          data={data}
          chartcolumn={chartcolumn}
           type={type}
           title={title}
           navigatePath={navigatePath}
           blockedMessage={blockedMessage}
           cardClassName={cardClassName}
           onDrilldown={onDrilldown}
           externalLoading={externalLoading}
           externalError={externalError}
           prefetchedOnly
        />
  );
};

export default PlotChartStatus;
