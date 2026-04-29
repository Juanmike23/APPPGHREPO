/*
 * PGH-DOC
 * File: src/Layout/Sidebar/SidebarIcon.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from 'react';
import { Image } from '../../AbstractElements';
import logo from '../../assets/images/logo/logo.png';

const SidebarIcon = () => {

  return (
    <div className="logo-wrapper">
      <a href="#javascript">
        <Image attrImage={{ className: 'img-fluid', src: `${logo}`, alt: '' }} />
      </a>
    </div>
  );
};
export default SidebarIcon;