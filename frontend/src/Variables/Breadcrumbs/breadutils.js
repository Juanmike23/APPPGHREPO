/*
 * PGH-DOC
 * File: src/Variables/Breadcrumbs/breadutils.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// // utils.js (optional helper)
// export const formatLabel = (segment) => {
//   const lower = segment.toLowerCase();

//   // If it's in routeNameMap, use that
//   if (routeNameMap[lower]) return routeNameMap[lower];

//   // Otherwise auto-format:
//   // 1. Insert space before capital letters (for camelCase)
//   let formatted = segment.replace(/([a-z])([A-Z])/g, "$1 $2");

//   // 2. Replace dashes/underscores with spaces
//   formatted = formatted.replace(/[-_]/g, " ");

//   // 3. Capitalize first letter
//   formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

//   return formatted;
// };
