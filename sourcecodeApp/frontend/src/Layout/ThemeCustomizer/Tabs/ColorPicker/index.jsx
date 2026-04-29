/*
 * PGH-DOC
 * File: src/Layout/ThemeCustomizer/Tabs/ColorPicker/index.jsx
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
import ColorsComponent from './Color';
import MixLayoutComponent from './MixLayout';

const ColorPicker = () => {
    return (
        <Fragment>
            <ColorsComponent />
            <MixLayoutComponent />
        </Fragment >
    );
};

export default ColorPicker;