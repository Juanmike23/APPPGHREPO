/*
 * PGH-DOC
 * File: src/Layout/ThemeCustomizer/NavCustomizer.jsx
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

const NavCustomizer = () => {
    return (
        <Fragment>
            {/* <Nav className="flex-column nac-pills" id="c-pills-tab" role="tablist" aria-orientation="vertical">
                <NavItem>
                    <NavLink className={selected === 'check-layout' ? 'active' : ''} onClick={() => callbackNav('check-layout', true)}>
                        <div className="settings"><i className="icofont icofont-laptop-alt"></i></div>
                        <span>Check Layout</span>
                    </NavLink>
                </NavItem>
                <NavItem>
                    <NavLink className={selected === 'sidebar-type' ? 'active' : ''} onClick={() => callbackNav('sidebar-type', true)}>
                        <div className="settings"><i className="icofont icofont-ui-settings"></i></div>
                        <span>Sidebar Type</span>
                    </NavLink>
                </NavItem>
                <NavItem>
                    <NavLink className={selected === 'color-picker' ? 'active' : ''} onClick={() => callbackNav('color-picker', true)}>
                        <div className="settings color-settings">
                            <i className="icofont icofont-color-bucket"></i></div>
                        <span>Color Picker</span>
                    </NavLink>
                </NavItem>
            </Nav> */}
        </Fragment>
    );
};

export default NavCustomizer;
