/*
 * PGH-DOC
 * File: src/Components/Planning/DashboardPlanning/utils/formatMoney.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const toMillion = (value, digits = 0) => {
  if (value == null || isNaN(value)) return "0";

  const abs = Math.abs(value);

  // ≥ 10 Billion → Billion
  if (abs >= 1_000_000_000_000) {
    return (
      (value / 1_000_000_000).toLocaleString("id-ID", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }) + " M"
    );
  }

  // otherwise → Million
  return (
    (value / 1_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }) + " Jt"
  );
};