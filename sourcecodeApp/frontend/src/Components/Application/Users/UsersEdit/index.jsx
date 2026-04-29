/*
 * PGH-DOC
 * File: src/Components/Application/Users/UsersEdit/index.jsx
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
import { Col, Container, Row } from '@pgh/ui-bootstrap';
import { Breadcrumbs } from '../../../../AbstractElements';
import EditMyProfile from './EditmyProfile';
import MyProfileEdit from './MyProfile';

const UsersEditContain = () => {
    return (
        <Fragment>
            <Breadcrumbs mainTitle="User Edit" parent="Users" title="User Edit" />
            <Container fluid={true}>
                <div className="edit-profile">
                    <Row>
                        <Col xl="4">
                            <MyProfileEdit />
                        </Col>
                        <Col xl="8">
                            <EditMyProfile />
                        </Col>
                    </Row>
                </div>
            </Container>
        </Fragment>
    );
};
export default UsersEditContain;