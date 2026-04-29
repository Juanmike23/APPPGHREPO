/*
 * PGH-DOC
 * File: src/Components/Application/Users/UsersCards/index.jsx
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
import { Container, Row } from '@pgh/ui-bootstrap';
import { Breadcrumbs } from '../../../../AbstractElements';
import AllCards from './AllCards';

const UsersCardssContain = () => {
    return (
        <Fragment>
            <Breadcrumbs mainTitle="User Cards" parent="Users" title="User Cards" />
            <Container fluid className="user-card">
                <Row>
                    <AllCards />
                </Row>
            </Container>
        </Fragment>
    );
};
export default UsersCardssContain;