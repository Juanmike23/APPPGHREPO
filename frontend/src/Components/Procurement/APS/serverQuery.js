/*
 * PGH-DOC
 * File: src/Components/Procurement/APS/serverQuery.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import {
  PROCUREMENT_ALL_COLUMNS,
  PROCUREMENT_COLUMN_LABELS,
  PROCUREMENT_SHARED_COLUMNS,
} from "./procurementListColumns";
import {
  buildServerQueryPayload,
  canonicalizeColumn,
  createCanonicalMap,
  mapServerFilterColumns,
  mapServerSortColumns,
} from "../../../Variables/Table/serverQueryUtils";

export const PROCUREMENT_LIST_SERVER_MODE = "procurementlist";
export const PROCUREMENT_DEFAULT_PAGE_SIZE = 25;
export const PROCUREMENT_PAGE_SIZE_OPTIONS = [25, 50, 100];
export const PROCUREMENT_SEARCH_SCOPE_ALL = "__all__";

const PROCUREMENT_SERVER_ENDPOINTS = new Set([
  "newprocure",
  "existingprocure",
  "allprocure",
]);

const PROCUREMENT_SERVER_FILTER_COLUMNS = new Set([
  "Id",
  ...PROCUREMENT_ALL_COLUMNS,
  "Source",
  "Status_Pengadaan",
  "CreatedAt",
  "UpdatedAt",
]);

const PROCUREMENT_SERVER_SEARCH_COLUMNS = new Set([
  "project_id",
  "Department",
  "PIC",
  "Vendor",
  "TipePengadaan",
  "Perjanjian",
  "NilaiPengajuanAPS",
  "NilaiApproveSTA",
  "NilaiKontrak",
  "Status_Pengadaan",
  "TglKirimkePFA",
  "Keterangan",
  "PICPFA",
  "JenisAnggaran",
  "NoPKS",
  "NoSPK",
]);

const PROCUREMENT_SERVER_SORT_COLUMNS = new Set([
  "Id",
  ...PROCUREMENT_ALL_COLUMNS,
  "Source",
  "Status_Pengadaan",
  "CreatedAt",
  "UpdatedAt",
]);

const PROCUREMENT_SERVER_SORT_EXTRAS = [
  {
    key: "CreatedAt",
    accessor: "CreatedAt",
    label: "Waktu Dibuat",
  },
  {
    key: "UpdatedAt",
    accessor: "UpdatedAt",
    label: "Waktu Diperbarui",
  },
];

const PROCUREMENT_CANONICAL_COLUMN_MAP = createCanonicalMap([
  "Id",
  "Source",
  ...PROCUREMENT_SHARED_COLUMNS,
  ...PROCUREMENT_ALL_COLUMNS,
  "Status_Pengadaan",
  "CreatedAt",
  "UpdatedAt",
]);

const canonicalizeProcurementColumn = (value) =>
  canonicalizeColumn(PROCUREMENT_CANONICAL_COLUMN_MAP, value);

export const isProcurementServerQueryEnabled = ({
  serverQueryMode,
  endpointName,
}) =>
  String(serverQueryMode ?? "").trim().toLowerCase() ===
    PROCUREMENT_LIST_SERVER_MODE &&
  PROCUREMENT_SERVER_ENDPOINTS.has(
    String(endpointName ?? "").trim().toLowerCase(),
  );

export const getProcurementServerFilterColumns = (columns) =>
  mapServerFilterColumns(columns, {
    canonicalize: canonicalizeProcurementColumn,
    allowedColumns: PROCUREMENT_SERVER_FILTER_COLUMNS,
    resolveLabel: (column) =>
      PROCUREMENT_COLUMN_LABELS[String(column).toUpperCase()] || column,
  });

export const getProcurementServerSortColumns = (columns) =>
  mapServerSortColumns(columns, {
    canonicalize: canonicalizeProcurementColumn,
    allowedColumns: PROCUREMENT_SERVER_SORT_COLUMNS,
    resolveLabel: (column) =>
      PROCUREMENT_COLUMN_LABELS[String(column).toUpperCase()] || column,
    extras: PROCUREMENT_SERVER_SORT_EXTRAS,
  });

export const buildProcurementServerQueryPayload = ({
  filters,
  searchTerm,
  searchScope,
  visibleColumns,
  allSearchableColumns,
  page,
  pageSize,
  focusId,
}) =>
  buildServerQueryPayload({
    filters,
    searchTerm,
    searchScope,
    scopeAllValue: PROCUREMENT_SEARCH_SCOPE_ALL,
    visibleColumns,
    allSearchableColumns,
    defaultSearchColumns: PROCUREMENT_ALL_COLUMNS,
    canonicalize: canonicalizeProcurementColumn,
    filterColumns: PROCUREMENT_SERVER_FILTER_COLUMNS,
    sortColumns: PROCUREMENT_SERVER_SORT_COLUMNS,
    searchColumns: PROCUREMENT_SERVER_SEARCH_COLUMNS,
    page,
    pageSize,
    focusId,
    extendPayload: ({ filters: queryFilters, canonicalize, hasColumn }) => {
      const priorityTopNullColumn = canonicalize(
        queryFilters?.priorityTopNullColumn,
      );
      const normalizedPriorityTopNullColumn =
        priorityTopNullColumn &&
        hasColumn(priorityTopNullColumn, PROCUREMENT_SERVER_SORT_COLUMNS)
          ? priorityTopNullColumn
          : null;

      const priorityBottomIds = Array.isArray(queryFilters?.priorityBottomIds)
        ? Array.from(
            new Set(
              queryFilters.priorityBottomIds
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value) && value > 0),
            ),
          )
        : [];

      return {
        PriorityTopNullColumn: normalizedPriorityTopNullColumn,
        PriorityBottomIds: priorityBottomIds,
      };
    },
  });
