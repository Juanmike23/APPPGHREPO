/*
 * PGH-DOC
 * File: src/Components/Human/shared/humanLabelOverrides.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const HUMAN_TABLE_COLUMN_LABELS = {
  Action: "Detail",
  NPP: "NPP",
  Nama: "Nama",
  JenjangJabatan: "Jenjang Jabatan",
  Posisi: "Posisi",
  Department: "Department",
  JenisKelamin: "Jenis Kelamin",
  TanggalLahir: "Tanggal Lahir",
  TanggalJoinBNI: "Tanggal Join BNI",
  ManmonthManagedService: "Manmonth Managed Service",
  Role: "Role",
  Vendor: "Vendor",
  DIREKTORAT: "Direktorat",
  KODEJOB: "Kode Job",
  JOB: "Job",
  Existing: "Existing",
  Kebutuhan: "Kebutuhan",
  Gap: "Gap",
  UsulanTraining: "Usulan Training",
  BulanTahun: "Bulan/Tahun",
  JumlahPerserta: "Jumlah Peserta",
  SentralDesentral: "Sentral/Desentral",
  DivisiDepartment: "Divisi/Department",
  Fasilitator: "Fasilitator",
  Biaya: "Biaya",
  JudulTraining: "Judul Training",
  TahunPelaksanaan: "Tahun Pelaksanaan",
  SertifikasiNonSerifikasi: "Sertifikasi/Non-Sertifikasi",
  CreatedAt: "Waktu Dibuat",
  UpdatedAt: "Waktu Diperbarui",
};
