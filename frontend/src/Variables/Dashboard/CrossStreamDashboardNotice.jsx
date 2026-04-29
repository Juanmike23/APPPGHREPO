/*
 * PGH-DOC
 * File: src/Variables/Dashboard/CrossStreamDashboardNotice.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import { Alert } from "@pgh/ui-bootstrap";

const CrossStreamDashboardNotice = ({
  moduleLabel,
  userStream,
  detailOwnerLabel = "stream pemilik",
  summaryLabel = "summary only",
}) => (
  <Alert color="info" className="mb-4">
    Anda sedang membuka dashboard <strong>{moduleLabel}</strong> di luar stream utama Anda.
    Tampilan ini dibatasi ke mode <strong>{summaryLabel}</strong>. Detail hanya tersedia untuk{" "}
    <strong>{detailOwnerLabel}</strong>, dan aksi operasional tetap hanya tersedia penuh di stream{" "}
    <strong>{userStream || "-"}</strong>.
  </Alert>
);

export default CrossStreamDashboardNotice;
