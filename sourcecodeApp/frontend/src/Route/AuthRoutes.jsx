/*
 * PGH-DOC
 * File: src/Route/AuthRoutes.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur peta routing dan alur navigasi halaman.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import Signup from "../Auth/Signup";

export const authRoutes = [
  { path: `${process.env.PUBLIC_URL}/signup`, Component: <Signup /> },
];
