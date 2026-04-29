/*
 * PGH-DOC
 * File: src/Layout/TapTop/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect } from 'react';
import { ChevronsUp } from 'react-feather';
import { useState } from 'react';

const Taptop = (props) => {

    const [tapTopStyle, setTapTopStyle] = useState('none');

    const executeScroll = () => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    };

    const handleScroll = () => {
        if (window.scrollY > 600) {
            setTapTopStyle('block');
        } else {
            setTapTopStyle('none');
        }
    };

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <div className="tap-top" style={{ display: tapTopStyle }}><ChevronsUp onClick={() => executeScroll()} /></div>
    );
};

export default Taptop;