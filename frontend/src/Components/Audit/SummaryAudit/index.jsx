/*
 * PGH-DOC
 * File: src/Components/Audit/SummaryAudit/index.jsx
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
import Summary from "../../../Variables/Table/TableComponent";
import {
  LIST_AUDIT_SERVER_AREA,
  LIST_AUDIT_SERVER_MODE,
} from "../ListAudit/serverQuery";
import "../Utils/auditArea.scss";

const SUMMARY_COLUMNS = [
  "NAMAAUDIT",
  "TAHUN",
  "SOURCE",
  "PICAUDIT",
  "LINK",
  "STATUS",
];

const SUMMARY_COLUMN_LABEL_OVERRIDES = {
  NAMAAUDIT: "Nama Audit",
  TAHUN: "Tahun",
  SOURCE: "Sumber Audit",
  PICAUDIT: "PIC Audit",
  LINK: "Link",
  STATUS: "Status Audit",
};

const AuditSummary = () => (
  <div className="audit-module-page">
    <Summary
      source="AuditSummary"
      title="Audit Summary"
      columns={SUMMARY_COLUMNS}
      columnLabelOverrides={SUMMARY_COLUMN_LABEL_OVERRIDES}
      apiUrl={`${process.env.REACT_APP_API_BASE_URL}listaudit`}
      fixedDateColumns={["IN", "JATUHTEMPO"]}
      fixedColumnsOnly
      nonEditableColumns={SUMMARY_COLUMNS}
      tableArea={LIST_AUDIT_SERVER_AREA}
      serverQueryMode={LIST_AUDIT_SERVER_MODE}
      useGridRenderer
      enableClientPagination
      allowColumnMutations={false}
      enableColumnDrag={false}
      persistColumnOrder={false}
      forceReadOnly
      hideImport
      showLogTrail={false}
    />
  </div>
);

export default AuditSummary;
