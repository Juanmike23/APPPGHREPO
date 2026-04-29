/*
 * PGH-DOC
 * File: src/Layout/ThemeCustomizer/Tabs/Sidebar/index.jsx
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
import SidebarType from './SidebarType';
import LayoutType from './LayoutType';
import AnimationFade from './AnimationFade';

const SidebarCusmizer = () => {

    return (
        <Fragment>
            <LayoutType />
            <SidebarType />
            <AnimationFade />
        </Fragment>
    );
};

export default SidebarCusmizer;