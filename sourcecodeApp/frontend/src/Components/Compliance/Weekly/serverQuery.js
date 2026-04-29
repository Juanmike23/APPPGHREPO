/*
 * PGH-DOC
 * File: src/Components/Compliance/Weekly/serverQuery.js
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
  WEEKLY_TABLE_COLUMNS,
  WEEKLY_TABLE_COLUMN_LABELS,
} from "./weeklyTableColumns";
import {
  buildServerQueryPayload,
  canonicalizeColumn,
  createCanonicalMap,
  mapServerFilterColumns,
  mapServerSortColumns,
} from "../../../Variables/Table/serverQueryUtils";

export const COMPLIANCE_WEEKLY_SERVER_MODE = "complianceweekly";
export const COMPLIANCE_WEEKLY_DEFAULT_PAGE_SIZE = 25;
export const COMPLIANCE_WEEKLY_PAGE_SIZE_OPTIONS = [25, 50, 100];
export const COMPLIANCE_WEEKLY_SEARCH_SCOPE_ALL = "__all__";

const COMPLIANCE_WEEKLY_SERVER_ENDPOINTS = new Set(["weeklytable"]);

const COMPLIANCE_WEEKLY_FILTER_COLUMNS = new Set([
  ...WEEKLY_TABLE_COLUMNS,
  "CreatedAt",
  "UpdatedAt",
]);

const COMPLIANCE_WEEKLY_SEARCH_COLUMNS = new Set([...WEEKLY_TABLE_COLUMNS]);

const COMPLIANCE_WEEKLY_SORT_COLUMNS = new Set([
  ...WEEKLY_TABLE_COLUMNS,
  "CreatedAt",
  "UpdatedAt",
]);

const COMPLIANCE_WEEKLY_SORT_EXTRAS = [
  { key: "CreatedAt", accessor: "CreatedAt", label: "Waktu Dibuat" },
  { key: "UpdatedAt", accessor: "UpdatedAt", label: "Waktu Diperbarui" },
];

const COMPLIANCE_CANONICAL_COLUMN_MAP = createCanonicalMap([
  ...WEEKLY_TABLE_COLUMNS,
  "CreatedAt",
  "UpdatedAt",
]);

const canonicalizeComplianceWeeklyColumn = (value) =>
  canonicalizeColumn(COMPLIANCE_CANONICAL_COLUMN_MAP, value);

export const isComplianceWeeklyServerQueryEnabled = ({
  serverQueryMode,
  endpointName,
}) =>
  String(serverQueryMode ?? "").trim().toLowerCase() ===
    COMPLIANCE_WEEKLY_SERVER_MODE &&
  COMPLIANCE_WEEKLY_SERVER_ENDPOINTS.has(
    String(endpointName ?? "").trim().toLowerCase(),
  );

export const getComplianceWeeklyServerFilterColumns = (columns) =>
  mapServerFilterColumns(columns, {
    canonicalize: canonicalizeComplianceWeeklyColumn,
    allowedColumns: COMPLIANCE_WEEKLY_FILTER_COLUMNS,
    resolveLabel: (column) => WEEKLY_TABLE_COLUMN_LABELS[column] || column,
  });

export const getComplianceWeeklyServerSortColumns = (columns) =>
  mapServerSortColumns(columns, {
    canonicalize: canonicalizeComplianceWeeklyColumn,
    allowedColumns: COMPLIANCE_WEEKLY_SORT_COLUMNS,
    resolveLabel: (column) => WEEKLY_TABLE_COLUMN_LABELS[column] || column,
    extras: COMPLIANCE_WEEKLY_SORT_EXTRAS,
  });

export const buildComplianceWeeklyServerQueryPayload = ({
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
    scopeAllValue: COMPLIANCE_WEEKLY_SEARCH_SCOPE_ALL,
    visibleColumns,
    allSearchableColumns,
    defaultSearchColumns: WEEKLY_TABLE_COLUMNS,
    canonicalize: canonicalizeComplianceWeeklyColumn,
    filterColumns: COMPLIANCE_WEEKLY_FILTER_COLUMNS,
    sortColumns: COMPLIANCE_WEEKLY_SORT_COLUMNS,
    searchColumns: COMPLIANCE_WEEKLY_SEARCH_COLUMNS,
    page,
    pageSize,
    focusId,
  });
