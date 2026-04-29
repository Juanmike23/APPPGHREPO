/*
 * PGH-DOC
 * File: src/Components/Audit/Utils/columnHelpers.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

const humanizeColumnName = (name) =>
  String(name ?? "")
    .replace(/[_\s]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

export const LIST_AUDIT_COLUMN_LABELS = {
  Id: "ID",
  NO: "Nomor",
  TAHUN: "Tahun",
  NAMAAUDIT: "Nama Audit",
  RINGKASANAUDIT: "Ringkasan Audit",
  PEMANTAUAN: "Pemantauan",
  JENISAUDIT: "Jenis Audit",
  SOURCE: "Sumber Audit",
  PICAUDIT: "PIC Audit",
  DEPARTMENT: "Department",
  PICAPLIKASI: "PIC Aplikasi",
  IN: "Tanggal Mulai",
  JATUHTEMPO: "Jatuh Tempo",
  LINK: "Link",
  STATUS: "Status Audit",
  KETERANGAN: "Keterangan",
  RHA: "Evidence RHA",
  LHA: "Evidence LHA",
  CreatedAt: "CreatedAt",
  UpdatedAt: "UpdatedAt",
};

export const AUDIT_CHART_ALLOWED_COLUMNS = [
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
];

const AUDIT_CHART_ALLOWED_SET = new Set(AUDIT_CHART_ALLOWED_COLUMNS);

const normalizeColumnToken = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const LIST_AUDIT_CANONICAL_LOOKUP = Object.entries(LIST_AUDIT_COLUMN_LABELS).reduce(
  (acc, [column, label]) => {
    acc[normalizeColumnToken(column)] = column;
    acc[normalizeColumnToken(label)] = column;
    return acc;
  },
  {},
);

export const isListAuditTarget = (value) =>
  String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase() === "listaudit";

export const getListAuditColumnLabel = (column) => {
  const raw = String(column ?? "").trim();
  if (!raw) return "";

  return (
    LIST_AUDIT_COLUMN_LABELS[raw] ||
    LIST_AUDIT_COLUMN_LABELS[raw.toUpperCase()] ||
    humanizeColumnName(raw)
  );
};

export const getListAuditCanonicalColumn = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  return (
    LIST_AUDIT_CANONICAL_LOOKUP[normalizeColumnToken(raw)] ||
    LIST_AUDIT_CANONICAL_LOOKUP[normalizeColumnToken(raw.toUpperCase())] ||
    null
  );
};

export const getAuditChartCanonicalColumn = (value) => {
  const canonical = getListAuditCanonicalColumn(value);
  if (!canonical) return null;

  return AUDIT_CHART_ALLOWED_SET.has(canonical) ? canonical : null;
};

export const isAuditChartColumn = (value) =>
  Boolean(getAuditChartCanonicalColumn(value));
