/*
 * PGH-DOC
 * File: src/Variables/Dashboard/DashboardChartCard.jsx
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
import { Card, CardBody } from "@pgh/ui-bootstrap";

const DashboardChartCard = ({
  children,
  variant = "primary",
  cardClassName = "",
  bodyClassName = "",
}) => (
  <Card
    className={[
      "income-card",
      `card-${variant}`,
      "audit-dashboard-card",
      "audit-dashboard-card--chart",
      "dashboard-shared-card",
      "dashboard-shared-card--chart",
      cardClassName,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <CardBody
      className={[
        "audit-dashboard-mini-card-body",
        "audit-dashboard-mini-card-body--pie",
        "dashboard-shared-card__body",
        "dashboard-shared-card__body--chart",
        bodyClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </CardBody>
  </Card>
);

export default DashboardChartCard;
