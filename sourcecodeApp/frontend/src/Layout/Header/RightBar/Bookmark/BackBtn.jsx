/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/Bookmark/BackBtn.jsx
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
import { Btn, LI } from '../../../../AbstractElements';
import { Back } from '../../../../Constant';

const BackBtns = () => {
    const backtobookmark = () => {
        document.querySelector('.flip-card-inner').classList.remove('flipped');
    };
    return (
        <Fragment>
            <LI>
                <Btn attrBtn={{ className: 'd-block flip-back', onClick: backtobookmark }}>{Back}</Btn>
            </LI>
        </Fragment>
    );
};
export default BackBtns;