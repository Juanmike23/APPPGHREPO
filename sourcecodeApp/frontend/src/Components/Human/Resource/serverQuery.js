/*
 * PGH-DOC
 * File: src/Components/Human/Resource/serverQuery.js
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
  buildServerQueryPayload,
  canonicalizeColumn,
  createCanonicalMap,
  mapServerFilterColumns,
  mapServerSortColumns,
} from "../../../Variables/Table/serverQueryUtils";

export const HUMAN_RESOURCE_SERVER_AREA = "audit";
export const HUMAN_RESOURCE_SERVER_MODE = "humanresource";
export const HUMAN_RESOURCE_DEFAULT_PAGE_SIZE = 25;
export const HUMAN_RESOURCE_PAGE_SIZE_OPTIONS = [25, 50, 100];
export const HUMAN_RESOURCE_SEARCH_SCOPE_ALL = "__all__";

const HUMAN_RESOURCE_SERVER_ENDPOINTS = new Set([
  "fte",
  "nonfte",
  "kebutuhanfte",
  "bnu",
  "internaltraining",
  "kompetensipegawai",
]);

const HUMAN_RESOURCE_SCHEMA = {
  fte: {
    filterColumns: new Set([
      "NPP",
      "Nama",
      "JenjangJabatan",
      "Posisi",
      "Department",
      "CreatedAt",
      "UpdatedAt",
    ]),
    searchColumns: new Set(["NPP", "Nama", "JenjangJabatan", "Posisi", "Department"]),
    sortColumns: new Set([
      "NPP",
      "Nama",
      "JenjangJabatan",
      "Posisi",
      "Department",
      "CreatedAt",
      "UpdatedAt",
    ]),
  },
  nonfte: {
    filterColumns: new Set([
      "NPP",
      "Nama",
      "JenisKelamin",
      "TanggalLahir",
      "TanggalJoinBNI",
      "ManmonthManagedService",
      "Department",
      "Role",
      "Vendor",
      "CreatedAt",
      "UpdatedAt",
    ]),
    searchColumns: new Set([
      "NPP",
      "Nama",
      "JenisKelamin",
      "ManmonthManagedService",
      "Department",
      "Role",
      "Vendor",
    ]),
    sortColumns: new Set([
      "NPP",
      "Nama",
      "JenisKelamin",
      "TanggalLahir",
      "TanggalJoinBNI",
      "ManmonthManagedService",
      "Department",
      "Role",
      "Vendor",
      "CreatedAt",
      "UpdatedAt",
    ]),
  },
  kebutuhanfte: {
    filterColumns: new Set([
      "DIREKTORAT",
      "KODEJOB",
      "JOB",
      "Department",
      "Existing",
      "Kebutuhan",
      "Gap",
      "CreatedAt",
      "UpdatedAt",
    ]),
    searchColumns: new Set(["DIREKTORAT", "KODEJOB", "JOB", "Department"]),
    sortColumns: new Set([
      "DIREKTORAT",
      "KODEJOB",
      "JOB",
      "Department",
      "Existing",
      "Kebutuhan",
      "Gap",
      "CreatedAt",
      "UpdatedAt",
    ]),
  },
  bnu: {
    filterColumns: new Set([
      "UsulanTraining",
      "BulanTahun",
      "JumlahPerserta",
      "SentralDesentral",
      "DivisiDepartment",
      "Biaya",
    ]),
    searchColumns: new Set([
      "UsulanTraining",
      "BulanTahun",
      "JumlahPerserta",
      "SentralDesentral",
      "DivisiDepartment",
      "Biaya",
    ]),
    sortColumns: new Set([
      "UsulanTraining",
      "BulanTahun",
      "JumlahPerserta",
      "SentralDesentral",
      "DivisiDepartment",
      "Biaya",
    ]),
  },
  internaltraining: {
    filterColumns: new Set([
      "UsulanTraining",
      "Start",
      "End",
      "JumlahPerserta",
      "DivisiDepartment",
      "Fasilitator",
      "Biaya",
    ]),
    searchColumns: new Set([
      "UsulanTraining",
      "Start",
      "End",
      "JumlahPerserta",
      "DivisiDepartment",
      "Fasilitator",
      "Biaya",
    ]),
    sortColumns: new Set([
      "UsulanTraining",
      "Start",
      "End",
      "JumlahPerserta",
      "DivisiDepartment",
      "Fasilitator",
      "Biaya",
    ]),
  },
  kompetensipegawai: {
    filterColumns: new Set([
      "NPP",
      "Nama",
      "Department",
      "JudulTraining",
      "TahunPelaksanaan",
      "SertifikasiNonSerifikasi",
    ]),
    searchColumns: new Set([
      "NPP",
      "Nama",
      "Department",
      "JudulTraining",
      "TahunPelaksanaan",
      "SertifikasiNonSerifikasi",
    ]),
    sortColumns: new Set([
      "NPP",
      "Nama",
      "Department",
      "JudulTraining",
      "TahunPelaksanaan",
      "SertifikasiNonSerifikasi",
    ]),
  },
};

const LABEL_OVERRIDES = {
  CreatedAt: "Waktu Dibuat",
  UpdatedAt: "Waktu Diperbarui",
};

const SERVER_SORT_EXTRAS = [
  { key: "CreatedAt", accessor: "CreatedAt", label: LABEL_OVERRIDES.CreatedAt },
  { key: "UpdatedAt", accessor: "UpdatedAt", label: LABEL_OVERRIDES.UpdatedAt },
];

const normalizeEndpointName = (endpointName) =>
  String(endpointName ?? "").trim().toLowerCase();

const getSchema = (endpointName) =>
  HUMAN_RESOURCE_SCHEMA[normalizeEndpointName(endpointName)] || null;

const HUMAN_RESOURCE_CANONICAL_MAPS = Object.entries(HUMAN_RESOURCE_SCHEMA).reduce(
  (result, [endpointName, schema]) => {
    result[endpointName] = createCanonicalMap([
      ...schema.filterColumns,
      ...schema.searchColumns,
      ...schema.sortColumns,
    ]);
    return result;
  },
  {},
);

const canonicalizeHumanResourceColumn = (endpointName, value) => {
  const map = HUMAN_RESOURCE_CANONICAL_MAPS[normalizeEndpointName(endpointName)];
  return canonicalizeColumn(map, value);
};

export const isHumanResourceServerQueryEnabled = ({
  tableArea,
  serverQueryMode,
  endpointName,
}) =>
  String(tableArea ?? "").trim().toLowerCase() === HUMAN_RESOURCE_SERVER_AREA &&
  String(serverQueryMode ?? "").trim().toLowerCase() ===
    HUMAN_RESOURCE_SERVER_MODE &&
  HUMAN_RESOURCE_SERVER_ENDPOINTS.has(normalizeEndpointName(endpointName));

export const getHumanResourceServerFilterColumns = (endpointName, columns) => {
  const schema = getSchema(endpointName);
  if (!schema) return Array.isArray(columns) ? columns : [];

  return mapServerFilterColumns(columns, {
    canonicalize: (value) => canonicalizeHumanResourceColumn(endpointName, value),
    allowedColumns: schema.filterColumns,
    resolveLabel: (column) => LABEL_OVERRIDES[column] || column,
  });
};

export const getHumanResourceServerSortColumns = (endpointName, columns) => {
  const schema = getSchema(endpointName);
  if (!schema) return Array.isArray(columns) ? columns : [];

  return mapServerSortColumns(columns, {
    canonicalize: (value) => canonicalizeHumanResourceColumn(endpointName, value),
    allowedColumns: schema.sortColumns,
    resolveLabel: (column) => LABEL_OVERRIDES[column] || column,
    extras: SERVER_SORT_EXTRAS,
  });
};

export const buildHumanResourceServerQueryPayload = ({
  endpointName,
  filters,
  searchTerm,
  searchScope,
  visibleColumns,
  allSearchableColumns,
  page,
  pageSize,
  focusId,
}) => {
  const schema = getSchema(endpointName);
  if (!schema) {
    return {
      Page: page,
      PageSize: pageSize,
      FocusId: focusId ?? null,
      Filters: [],
      Mode: "and",
      Sort: null,
      Distinct: null,
      Search: null,
      SearchColumns: [],
    };
  }

  return buildServerQueryPayload({
    filters,
    searchTerm,
    searchScope,
    scopeAllValue: HUMAN_RESOURCE_SEARCH_SCOPE_ALL,
    visibleColumns,
    allSearchableColumns,
    defaultSearchColumns: Array.from(schema.searchColumns),
    canonicalize: (value) => canonicalizeHumanResourceColumn(endpointName, value),
    filterColumns: schema.filterColumns,
    sortColumns: schema.sortColumns,
    searchColumns: schema.searchColumns,
    page,
    pageSize,
    focusId,
  });
};
