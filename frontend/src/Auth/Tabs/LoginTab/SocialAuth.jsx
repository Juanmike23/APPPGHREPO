/*
 * PGH-DOC
 * File: src/Auth/Tabs/LoginTab/SocialAuth.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur autentikasi, login flow, dan kontrol akses user.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from 'react';
import { H6, P } from '../../../AbstractElements';
import { CreateAccount } from '../../../Constant';
import FacebookCus from './Facebook';
import GithubCus from './Github';
import GoogleCus from './Google';

const SocialAuth = () => {
    return (
        <Fragment>
            <H6 attrH6={{ className: 'text-muted mt-4 or' }} >{'Or Sign in with'}</H6>
            <div className="social mt-4">
                <div className="btn-showcase">
                    <FacebookCus />
                    <GoogleCus />
                    <GithubCus />
                </div>
            </div>
            <P attrPara={{ className: 'mt-4 mb-0' }} >{'Don\'t have account?'}<a className="ms-2" href="#javascript">{CreateAccount}</a></P>
        </Fragment>
    );
};

export default SocialAuth;