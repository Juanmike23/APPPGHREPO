/*
 * PGH-DOC
 * File: src/Components/Procurement/APS/procurementListColumns.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const PROCUREMENT_SHARED_COLUMNS = [
  "project_id",
  "Status_Pengadaan",
  "Department",
  "PIC",
  "Vendor",
  "TipePengadaan",
  "Perjanjian",
  "NilaiPengajuanAPS",
  "NilaiApproveSTA",
  "NilaiKontrak",
  "JenisAnggaran",
  "NoPKS",
  "TglPKS",
  "NoSPK",
  "TglSPK",
  "WaktuMulai",
  "JatuhTempo",
  "PICPFA",
  "TglKirimkePFA",
  "Keterangan",
  "SisaBulan",
];

export const PROCUREMENT_ALL_COLUMNS = [...PROCUREMENT_SHARED_COLUMNS];

export const PROCUREMENT_FIXED_DATE_COLUMNS = [
  "TglKirimkePFA",
  "TglPKS",
  "TglSPK",
  "WaktuMulai",
  "JatuhTempo",
];

export const PROCUREMENT_COLUMN_LABELS = {
  SOURCE: "Source",
  NO: "Nomor",
  PROJECT_ID: "Project ID",
  DEPARTMENT: "Department",
  PIC: "PIC",
  VENDOR: "Vendor",
  TIPEPENGADAAN: "Tipe Pengadaan",
  PERJANJIAN: "Perjanjian",
  NILAIPENGAJUANAPS: "Nilai Pengadaan (Pengajuan APS)",
  NILAIAPPROVESTA: "Nilai di Approve STA",
  STATUS_PENGADAAN: "Status Pengadaan",
  TGLKIRIMKEPFA: "Tgl Kirim ke PFA",
  KETERANGAN: "Keterangan",
  PICPFA: "PIC PFA",
  JENISANGGARAN: "Jenis Anggaran",
  NILAIKONTRAK: "Nilai Kontrak (PFA)",
  NOPKS: "No PKS",
  TGLPKS: "Tgl PKS",
  NOSPK: "No SPK",
  TGLSPK: "Tgl SPK",
  WAKTUMULAI: "Waktu Mulai",
  JATUHTEMPO: "Jatuh Tempo",
  SISABULAN: "Sisa Bulan",
  CREATEDAT: "Created At",
  UPDATEDAT: "Updated At",
};
