/*
 * PGH-DOC
 * File: src/Components/Audit/Calendar/constants.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const START_YEAR = 2020;
export const NUM_OF_YEARS = 3;
export const MONTH_NAMES = [
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
  "Dec"
];
export const MONTHS_PER_YEAR = 12;
export const QUARTERS_PER_YEAR = 4;
export const MONTHS_PER_QUARTER = 3;
export const NUM_OF_MONTHS = NUM_OF_YEARS * MONTHS_PER_YEAR;
export const MAX_TRACK_START_GAP = 4;
export const MAX_ELEMENT_GAP = 8;
export const MAX_MONTH_SPAN = 8;
export const MIN_MONTH_SPAN = 2;
export const NUM_OF_TRACKS = 20;
export const MAX_NUM_OF_SUBTRACKS = 5;
