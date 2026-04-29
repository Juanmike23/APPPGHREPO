/*
 * PGH-DOC
 * File: src/Components/Procurement/APS/AllPengadaan.jsx
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
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../Auth/AuthContext";
import { canEditPath, isReadOnlyUser } from "../../../Auth/accessControl";

import TableComponent from "../../../Variables/Table/TableComponent";
import {
  PROCUREMENT_ALL_COLUMNS,
  PROCUREMENT_COLUMN_LABELS,
  PROCUREMENT_FIXED_DATE_COLUMNS,
} from "./procurementListColumns";
import { PROCUREMENT_LIST_SERVER_MODE } from "./serverQuery";

const resolveSourceTypeFromRow = (row) => {
  const explicitSource = String(row?.Source ?? "").trim().toLowerCase();
  if (explicitSource === "existing") {
    return "existingprocure";
  }

  if (explicitSource === "new") {
    return "newprocure";
  }

  const tipeToken = String(row?.TipePengadaan ?? "").trim().toLowerCase();
  if (
    tipeToken.includes("perpanjangan") ||
    tipeToken.includes("existing") ||
    tipeToken.startsWith("exs") ||
    tipeToken.includes("renew")
  ) {
    return "existingprocure";
  }

  return "newprocure";
};

const AllPengadaan = ({
  apiUrl: customApiUrl,
  endpoint = "allprocure/combined",
  onStatusClick,
  columns: userDefinedColumns,
  importSource = "all",
  source = "AllProcure",
  title,
  externalFilters = null,
  onFiltersChange = null,
  reloadKey = 0,
  focusRowRequest = null,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const isReadOnly = isReadOnlyUser(user);
  const canManageProcurement = canEditPath(user, location.pathname);

  const rowsBaseUrl =
    process.env.REACT_APP_API_BASE_URL.replace(/\/$/, "") +
    "/" +
    endpoint.replace(/^\//, "");

  const apiUrl = customApiUrl || rowsBaseUrl;
  const columnsToUse =
    userDefinedColumns?.length ? userDefinedColumns : PROCUREMENT_ALL_COLUMNS;
  const sensitiveValueColumns = [
    "NilaiPengajuanAPS",
    "NilaiApproveSTA",
    "NilaiKontrak",
  ];
  const filteredColumns = isReadOnly
    ? columnsToUse.filter((column) => !sensitiveValueColumns.includes(column))
    : columnsToUse;

  return (
    <TableComponent
      mandatoryValueOf="TipePengadaan"
      mandatorySuggestionValues={["New", "Existing"]}
      source={source}
      importSource={importSource}
      title={title}
      actionKeys={(row) => {
        const actions = ["logtrail"];
        if (canManageProcurement) {
          actions.unshift("status");
        }
        if (row.Source !== "existingX") {
          actions.push("parentrow");
        }
        return actions;
      }}
      onStatusClick={(id, row) => {
        const nextType = resolveSourceTypeFromRow(row);
        onStatusClick?.(id, nextType);
      }}
      columns={filteredColumns}
      columnLabelOverrides={PROCUREMENT_COLUMN_LABELS}
      apiUrl={apiUrl}
      externalFilters={externalFilters}
      onFiltersChange={onFiltersChange}
      reloadKey={reloadKey}
      focusRowRequest={focusRowRequest}
      fixedDateColumns={PROCUREMENT_FIXED_DATE_COLUMNS}
      fixedColumnsOnly
      nonEditableColumns={["project_id", "Status_Pengadaan", "SisaBulan"]}
      tableArea="audit"
      serverQueryMode={PROCUREMENT_LIST_SERVER_MODE}
      useGridRenderer
      enableClientPagination
      allowColumnMutations={false}
      enableColumnDrag={false}
      persistColumnOrder={false}
    />
  );
};

export default AllPengadaan;
