/*
 * PGH-DOC
 * File: src/Layout/Loader/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useState, useEffect } from 'react';


const Loader = () => {

    const [show, setShow] = useState(true);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setShow(false);
        }, 1000);

        return () => {
            clearTimeout(timeout);
        };

    }, [show]);

    return (
        <Fragment>
            <div className={`loader-wrapper ${show ? '' : 'loderhide'}`}>
                <div className="theme-loader">
                    <div className="loader-p"></div>
                </div>
            </div>
        </Fragment>
    );
};

export default Loader;