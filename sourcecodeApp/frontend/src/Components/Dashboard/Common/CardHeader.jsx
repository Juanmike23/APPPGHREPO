/*
 * PGH-DOC
 * File: src/Components/Dashboard/Common/CardHeader.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from 'react';
import { H5, P } from '../../../AbstractElements';

const CardHeaderComponent = ({ title, subtitle, settingIcon }) => {
    return (
        <Fragment>
            <div className="header-top d-sm-flex align-items-center">
                <H5>{title}</H5>
                <div className="center-content">
                    <P className="d-flex align-items-center"> 
                        <i className="toprightarrow-primary fa fa-arrow-up me-2"></i>{subtitle}
                    </P>
                </div>
            </div>
        </Fragment>
    )
}

export default CardHeaderComponent;
