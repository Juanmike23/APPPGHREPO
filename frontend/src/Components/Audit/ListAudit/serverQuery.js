/*
 * PGH-DOC
 * File: src/Components/Audit/ListAudit/serverQuery.js
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
  LIST_AUDIT_COLUMN_LABELS,
  getListAuditCanonicalColumn,
  isListAuditTarget,
} from "../Utils/columnHelpers";
import {
  buildServerQueryPayload,
  mapServerFilterColumns,
  mapServerSortColumns,
} from "../../../Variables/Table/serverQueryUtils";

export const LIST_AUDIT_SERVER_AREA = "audit";
export const LIST_AUDIT_SERVER_MODE = "listaudit";
export const LIST_AUDIT_DEFAULT_PAGE_SIZE = 25;
export const LIST_AUDIT_PAGE_SIZE_OPTIONS = [25, 50, 100];
export const LIST_AUDIT_SEARCH_SCOPE_ALL = "__all__";

const LIST_AUDIT_SERVER_FILTER_COLUMNS = new Set([
  "TAHUN",
  "NAMAAUDIT",
  "RINGKASANAUDIT",
  "PEMANTAUAN",
  "JENISAUDIT",
  "SOURCE",
  "PICAUDIT",
  "DEPARTMENT",
  "PICAPLIKASI",
  "IN",
  "JATUHTEMPO",
  "LINK",
  "STATUS",
  "KETERANGAN",
]);

const LIST_AUDIT_SERVER_SEARCH_COLUMNS = new Set([
  "TAHUN",
  "NAMAAUDIT",
  "RINGKASANAUDIT",
  "PEMANTAUAN",
  "JENISAUDIT",
  "SOURCE",
  "PICAUDIT",
  "DEPARTMENT",
  "PICAPLIKASI",
  "LINK",
  "STATUS",
  "KETERANGAN",
]);

const LIST_AUDIT_SERVER_SORT_COLUMNS = new Set([
  "CreatedAt",
  "UpdatedAt",
  "TAHUN",
  "NAMAAUDIT",
  "RINGKASANAUDIT",
  "PEMANTAUAN",
  "JENISAUDIT",
  "SOURCE",
  "PICAUDIT",
  "DEPARTMENT",
  "PICAPLIKASI",
  "IN",
  "JATUHTEMPO",
  "LINK",
  "STATUS",
  "KETERANGAN",
]);

const LIST_AUDIT_SERVER_SORT_EXTRAS = [
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

export const isListAuditServerQueryEnabled = ({
  tableArea,
  serverQueryMode,
  endpointName,
}) =>
  String(tableArea ?? "").trim().toLowerCase() === LIST_AUDIT_SERVER_AREA &&
  String(serverQueryMode ?? "").trim().toLowerCase() ===
    LIST_AUDIT_SERVER_MODE &&
  isListAuditTarget(endpointName);

const canonicalizeListAuditColumn = (value) =>
  getListAuditCanonicalColumn(value) || null;

const normalizeListAuditFilterOperator = (column, operator) => {
  const normalizedColumn = canonicalizeListAuditColumn(column);
  const normalizedOperator = String(operator ?? "contains").trim();

  if (normalizedColumn === "TAHUN" && normalizedOperator === "contains") {
    return "=";
  }

  return normalizedOperator || "contains";
};

export const getListAuditServerFilterColumns = (columns) =>
  mapServerFilterColumns(columns, {
    canonicalize: canonicalizeListAuditColumn,
    allowedColumns: LIST_AUDIT_SERVER_FILTER_COLUMNS,
    resolveLabel: (column) => LIST_AUDIT_COLUMN_LABELS[column] || column,
  });

export const getListAuditServerSortColumns = (columns) =>
  mapServerSortColumns(columns, {
    canonicalize: canonicalizeListAuditColumn,
    allowedColumns: LIST_AUDIT_SERVER_SORT_COLUMNS,
    resolveLabel: (column) => LIST_AUDIT_COLUMN_LABELS[column] || column,
    extras: LIST_AUDIT_SERVER_SORT_EXTRAS,
  });

export const buildListAuditServerQueryPayload = ({
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
    filters: {
      ...(filters || {}),
      filters: Array.isArray(filters?.filters)
        ? filters.filters.map((filter) => ({
            ...filter,
            operator: normalizeListAuditFilterOperator(
              filter?.column,
              filter?.operator,
            ),
          }))
        : [],
    },
    searchTerm,
    searchScope,
    scopeAllValue: LIST_AUDIT_SEARCH_SCOPE_ALL,
    visibleColumns,
    allSearchableColumns,
    defaultSearchColumns: Object.keys(LIST_AUDIT_COLUMN_LABELS),
    canonicalize: canonicalizeListAuditColumn,
    filterColumns: LIST_AUDIT_SERVER_FILTER_COLUMNS,
    sortColumns: LIST_AUDIT_SERVER_SORT_COLUMNS,
    searchColumns: LIST_AUDIT_SERVER_SEARCH_COLUMNS,
    page,
    pageSize,
    focusId,
  });
