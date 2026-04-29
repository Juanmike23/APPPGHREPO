/*
 * PGH-DOC
 * File: src/Layout/ThemeCustomizer/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from 'react';
import { useState } from 'react';
import NavCustomizer from './NavCustomizer';
import TabCustomizer from './TabCustomizer';

const Themecustomizer = () => {
  const [selected, setSelected] = useState('check-layout');
  const [openCus, setOpenCus] = useState(false);

  const callbackNav = ((select, open) => {
    setSelected(select);
    setOpenCus(open);
  });

  return (
    <Fragment>
      <div className={`customizer-links ${openCus ? 'open' : ''}`}>
        <NavCustomizer callbackNav={callbackNav} selected={selected} />
        <div className={`customizer-contain ${openCus ? 'open' : ''}`}>
          <TabCustomizer selected={selected} callbackNav={callbackNav} />
        </div>
      </div>
    </Fragment>
  );
};

export default Themecustomizer;
