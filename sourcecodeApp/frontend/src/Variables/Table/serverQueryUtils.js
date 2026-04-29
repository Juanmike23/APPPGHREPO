/*
 * PGH-DOC
 * File: src/Variables/Table/serverQueryUtils.js
 * Apa fungsi bagian ini:
 * - Menyediakan utilitas global untuk membangun payload server-side query tabel.
 * Kenapa perlu:
 * - Menghindari duplikasi logic filter/sort/search/distinct per unit dan menjaga perilaku query tetap konsisten.
 * Aturan khususnya apa:
 * - Seluruh unit tetap punya schema kolom masing-masing, tapi proses normalisasi payload harus lewat helper global ini.
 * - Jangan hardcode payload server query baru di halaman jika helper ini sudah bisa dipakai.
 */

const normalizeColumnToken = (value) => String(value ?? "").trim().toLowerCase();

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return Array.from(value);
  return [];
};

const hasColumn = (allowedColumns, column) => {
  if (!column) return false;
  if (allowedColumns instanceof Set) return allowedColumns.has(column);
  if (Array.isArray(allowedColumns)) return allowedColumns.includes(column);
  return false;
};

const normalizeColumnDescriptor = ({ source, canonical, resolveLabel }) => ({
  ...((typeof source === "object" && source) || {}),
  key: canonical,
  accessor: canonical,
  label:
    source?.label ||
    source?.Header ||
    (typeof resolveLabel === "function" ? resolveLabel(canonical, source) : null) ||
    canonical,
});

const mapColumns = (columns, { canonicalize, allowedColumns, resolveLabel }) =>
  asArray(columns)
    .map((column) => {
      const key = column?.key || column?.accessor || column;
      const canonical = canonicalize(key);
      if (!canonical || !hasColumn(allowedColumns, canonical)) {
        return null;
      }

      return normalizeColumnDescriptor({
        source: column,
        canonical,
        resolveLabel,
      });
    })
    .filter(Boolean);

export const createCanonicalMap = (columns) =>
  new Map(
    Array.from(new Set(asArray(columns))).map((column) => [
      normalizeColumnToken(column),
      column,
    ]),
  );

export const canonicalizeColumn = (canonicalMap, value) =>
  canonicalMap?.get(normalizeColumnToken(value)) || null;

export const mapServerFilterColumns = (columns, options) =>
  mapColumns(columns, options);

export const mapServerSortColumns = (columns, options) => {
  const mappedColumns = mapColumns(columns, options);
  const extras = asArray(options?.extras)
    .filter((column) => hasColumn(options?.allowedColumns, column?.key))
    .map((column) => ({ ...column }));

  return Array.from(
    new Map(
      [...mappedColumns, ...extras]
        .filter(Boolean)
        .map((column) => [column.key, column]),
    ).values(),
  );
};

export const buildServerQueryPayload = ({
  filters,
  searchTerm,
  searchScope,
  scopeAllValue = "__all__",
  visibleColumns,
  allSearchableColumns,
  defaultSearchColumns = [],
  canonicalize,
  filterColumns,
  sortColumns,
  searchColumns,
  page,
  pageSize,
  focusId,
  extendPayload = null,
}) => {
  const validFilters = Array.isArray(filters?.filters)
    ? filters.filters
        .map((filter) => {
          const canonical = canonicalize(filter?.column);
          if (!canonical || !hasColumn(filterColumns, canonical)) {
            return null;
          }

          const rawValue = filter?.value;
          const value =
            rawValue === null || rawValue === undefined ? "" : String(rawValue);

          return {
            Column: canonical,
            Operator: filter?.operator || "=",
            Value: value,
          };
        })
        .filter(Boolean)
    : [];

  const sortColumn = canonicalize(filters?.sort?.column);
  const sort =
    sortColumn && hasColumn(sortColumns, sortColumn)
      ? {
          Column: sortColumn,
          Direction:
            String(filters?.sort?.direction ?? "").toLowerCase() === "desc"
              ? "desc"
              : "asc",
        }
      : null;

  const distinctColumn = canonicalize(filters?.distinct?.column);
  const distinct =
    distinctColumn && hasColumn(filterColumns, distinctColumn)
      ? {
          Column: distinctColumn,
        }
      : null;

  const normalizedSearch = String(searchTerm ?? "").trim();
  const candidates =
    Array.isArray(visibleColumns) && visibleColumns.length > 0
      ? visibleColumns
      : Array.isArray(allSearchableColumns) && allSearchableColumns.length > 0
        ? allSearchableColumns
        : asArray(defaultSearchColumns);

  const baseSearchColumns = candidates
    .map((column) => canonicalize(column))
    .filter((column) => column && hasColumn(searchColumns, column));

  const scopedColumn =
    searchScope && searchScope !== scopeAllValue
      ? canonicalize(searchScope)
      : null;

  const resolvedSearchColumns = normalizedSearch
    ? scopedColumn && hasColumn(searchColumns, scopedColumn)
      ? [scopedColumn]
      : Array.from(new Set(baseSearchColumns))
    : [];

  const payload = {
    Page: page,
    PageSize: pageSize,
    FocusId: focusId ?? null,
    Filters: validFilters,
    Mode:
      String(filters?.mode ?? "").toLowerCase() === "or" ? "or" : "and",
    Sort: sort,
    Distinct: distinct,
    Search: normalizedSearch || null,
    SearchColumns: resolvedSearchColumns,
  };

  if (typeof extendPayload === "function") {
    const extraPayload = extendPayload({
      filters,
      canonicalize,
      hasColumn: (column, sourceColumns) =>
        hasColumn(sourceColumns ?? sortColumns, column),
    });

    if (extraPayload && typeof extraPayload === "object") {
      Object.assign(payload, extraPayload);
    }
  }

  return payload;
};
