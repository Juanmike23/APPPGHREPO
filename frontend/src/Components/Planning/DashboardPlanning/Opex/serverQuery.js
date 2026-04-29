/*
 * PGH-DOC
 * File: src/Components/Planning/DashboardPlanning/Opex/serverQuery.js
 * Apa fungsi bagian ini:
 * - Menyediakan adapter server-side query untuk tabel OPEX.
 * Kenapa perlu:
 * - Agar engine tabel Planning memakai pola global yang sama seperti Audit (filter/sort/search/paging di backend).
 * Aturan khususnya apa:
 * - Jangan buat engine query baru per unit; pakai kontrak TableQuery global.
 * - Kolom yang diizinkan filter/sort/search harus eksplisit agar aman dan stabil.
 */
import {
  buildServerQueryPayload,
  canonicalizeColumn,
  createCanonicalMap,
  mapServerFilterColumns,
  mapServerSortColumns,
} from "../../../../Variables/Table/serverQueryUtils";

export const PLANNING_OPEX_SERVER_MODE = "planningopex";
export const PLANNING_OPEX_DEFAULT_PAGE_SIZE = 25;
export const PLANNING_OPEX_PAGE_SIZE_OPTIONS = [25, 50, 100];
export const PLANNING_OPEX_SEARCH_SCOPE_ALL = "__all__";

const PLANNING_OPEX_ENDPOINTS = new Set(["opex", "opextemplate"]);

const OPEX_TEMPLATE_COLUMNS = new Set([
  "SIT",
  "MataAnggaranParent",
  "MataAnggaranChild",
  "RowType",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Accumulated",
  "RealizationLastYearThisMonth",
  "RealizationThisYearThisMonth",
  "GrowthRp",
  "Growth",
  "FullYearFY",
  "YTD",
  "toAngThisYear",
  "toAngYTDThisYear",
  "SisaFY",
  "CreatedAt",
  "UpdatedAt",
]);

const OPEX_TEMPLATE_SEARCH_COLUMNS = new Set([
  "SIT",
  "MataAnggaranParent",
  "MataAnggaranChild",
  "RowType",
]);

const OPEX_TEMPLATE_CANONICAL_MAP = createCanonicalMap(OPEX_TEMPLATE_COLUMNS);

const canonicalizePlanningOpexColumn = (value) =>
  canonicalizeColumn(OPEX_TEMPLATE_CANONICAL_MAP, value);

export const isPlanningOpexServerQueryEnabled = ({
  serverQueryMode,
  endpointName,
}) =>
  String(serverQueryMode ?? "").trim().toLowerCase() ===
    PLANNING_OPEX_SERVER_MODE &&
  PLANNING_OPEX_ENDPOINTS.has(
    String(endpointName ?? "").trim().toLowerCase(),
  );

export const getPlanningOpexServerFilterColumns = (columns) =>
  mapServerFilterColumns(columns, {
    canonicalize: canonicalizePlanningOpexColumn,
    allowedColumns: OPEX_TEMPLATE_COLUMNS,
  });

export const getPlanningOpexServerSortColumns = (columns) =>
  mapServerSortColumns(columns, {
    canonicalize: canonicalizePlanningOpexColumn,
    allowedColumns: OPEX_TEMPLATE_COLUMNS,
  });

export const buildPlanningOpexServerQueryPayload = ({
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
    scopeAllValue: PLANNING_OPEX_SEARCH_SCOPE_ALL,
    visibleColumns,
    allSearchableColumns,
    defaultSearchColumns: Array.from(OPEX_TEMPLATE_SEARCH_COLUMNS),
    canonicalize: canonicalizePlanningOpexColumn,
    filterColumns: OPEX_TEMPLATE_COLUMNS,
    sortColumns: OPEX_TEMPLATE_COLUMNS,
    searchColumns: OPEX_TEMPLATE_SEARCH_COLUMNS,
    page,
    pageSize,
    focusId,
  });
