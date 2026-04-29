/*
 * PGH-DOC
 * File: src/Components/Common/Component/HeaderCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { H5 } from '../../../AbstractElements';
import React, { Fragment } from 'react';
import { CardHeader } from '@pgh/ui-bootstrap';

const HeaderCard = ({ title, span1, span2 }) => {
    return (
        <Fragment>
            <CardHeader className="pb-0">
                <H5>{title}</H5>
                {span1 ? <span>{span1}</span> : ''}
                {span2 ? <span>{span2}</span> : ''}
            </CardHeader>
        </Fragment>
    );
};

export default HeaderCard;