/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/HeaderProfile.jsx
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
import { MARKJENCO, MARKJENCOEMAIL } from '../../../Constant';
import { Link } from 'react-router-dom';
import { H6, Image, P } from '../../../AbstractElements';

const HeaderProfile = () => {
    return (
        <Fragment>
            <div className="media align-items-center">
                <div className="media-size-email">
                    <Image attrImage={{ className: 'me-3 rounded-circle', src: `${require('../../../assets/images/user/user.png')}`, alt: '' }} />
                </div>
                <div className="media-body">
                    <Link to={`${process.env.PUBLIC_URL}/settings`}>
                        <H6 attrH6={{ className: 'f-w-600' }} >{MARKJENCO}</H6></Link>
                    <P>{MARKJENCOEMAIL}</P>
                </div>
            </div>
        </Fragment>
    );
};

export default HeaderProfile;
