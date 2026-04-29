/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/documentPeriodReport.types.d.ts
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export type DocumentPeriodReportItem = {
  Id: number | null;
  GroupId: number | null;
  Period: string | null;
  PeriodName: string | null;
  DocumentId: number | null;
  DocumentToSubmit: string | null;
  CreatedAt: string | null;
  FileName: string | null;
  Link: string | null;
  DocumentFileUrl: string | null;
  ProgressPercent: number | null;
};
