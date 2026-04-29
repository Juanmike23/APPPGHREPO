/*
 * PGH-DOC
 * File: src/Components/Procurement/SummaryProcurement/index.jsx
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
import TableComponent from "../../../Variables/Table/TableComponent";
import {
  PROCUREMENT_COLUMN_LABELS,
  PROCUREMENT_FIXED_DATE_COLUMNS,
} from "../APS/procurementListColumns";
import { PROCUREMENT_LIST_SERVER_MODE } from "../APS/serverQuery";

const PROCUREMENT_SUMMARY_COLUMNS = [
  "Department",
  "Perjanjian",
  "JenisAnggaran",
  "TipePengadaan",
  "Vendor",
  "NilaiKontrak",
  "JatuhTempo",
];

const PROCUREMENT_SUMMARY_LABELS = {
  ...PROCUREMENT_COLUMN_LABELS,
  PERJANJIAN: "Nama Pengadaan",
};

const ProcurementSummary = () => (
  <TableComponent
    source="ProcurementSummary"
    title="Procurement Summary"
    columns={PROCUREMENT_SUMMARY_COLUMNS}
    columnLabelOverrides={PROCUREMENT_SUMMARY_LABELS}
    apiUrl={`${process.env.REACT_APP_API_BASE_URL}allprocure/combined`}
    fixedDateColumns={PROCUREMENT_FIXED_DATE_COLUMNS}
    fixedColumnsOnly
    nonEditableColumns={PROCUREMENT_SUMMARY_COLUMNS}
    tableArea="audit"
    serverQueryMode={PROCUREMENT_LIST_SERVER_MODE}
    useGridRenderer
    enableClientPagination
    allowColumnMutations={false}
    enableColumnDrag={false}
    persistColumnOrder={false}
    forceReadOnly
    hideImport
  />
);

export default ProcurementSummary;
