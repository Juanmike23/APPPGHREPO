/*
 * PGH-DOC
 * File: src/Components/Compliance/Weekly/weeklyTableColumns.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const WEEKLY_TABLE_COLUMN_LABELS = {
  Progress: "Progress",
  Status: "Status",
  Highlights: "Highlights",
  WorkInProgress: "Work In Progress",
  Target: "Target",
  NextToDo: "Next To Do",
};

export const WEEKLY_TABLE_COLUMNS = Object.keys(WEEKLY_TABLE_COLUMN_LABELS);
