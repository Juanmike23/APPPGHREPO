/*
 * PGH-DOC
 * File: src/Components/Application/Users/UsersProfile/LeftbarProfile.jsx
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
import { Row, Col } from '@pgh/ui-bootstrap';
import AboutMe from '../../../Bonus-Ui/Tour/Leftbar/AboutMe';

const LeftbarProfile = () => {
    return (
        <Fragment>
            <Col xl="3" lg="12" md="5" className="xl-35">
                <div className="default-according style-1 faq-accordion job-accordion">
                    <Row>
                        <AboutMe colClass="col-xl-12"/>
                        {/* <Followers colClass="col-xl-12 col-lg-6 col-md-12 col-sm-6" />
                        <Followings colClass="col-xl-12 col-lg-6 col-md-12 col-sm-6" />
                        <LatestPhotos colClass="col-xl-12 col-lg-6 col-md-12 col-sm-6" />
                        <Friends colClass="col-xl-12 col-lg-6 col-md-12 col-sm-6" /> */}
                    </Row>
                </div>
            </Col>
        </Fragment>
    );
};

export default LeftbarProfile;
