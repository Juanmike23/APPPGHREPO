/*
 * PGH-DOC
 * File: src/Layout/Sidebar/SidebarLogo.jsx
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
import { Link } from 'react-router-dom';
import { Image } from '../../AbstractElements';
import logo from '../../assets/images/logo/logo.png';

const SidebarLogo = () => {

  return (
    <div className="logo-icon-wrapper">
      <Link to={`${process.env.PUBLIC_URL}/`}>
        <Image
          attrImage={{ className: 'img-fluid for-dark', src: `${logo}`, alt: '' }} />
      </Link>
    </div>
  );
};

export default SidebarLogo;