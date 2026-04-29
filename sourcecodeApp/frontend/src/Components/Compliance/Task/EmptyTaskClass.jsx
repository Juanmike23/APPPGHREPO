/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/EmptyTaskClass.jsx
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
import { Printer } from 'react-feather';
import { Card, CardBody, CardHeader, Row } from '@pgh/ui-bootstrap';
import { H6 } from '../../../AbstractElements';
import { NoTaskDueToday, Print } from '../../../Constant';

const EmptyTaskClass = ({ title }) => {
    return (
        <Fragment>
            <Card className="mb-0">
                <CardHeader className="d-flex">
                    <H6 attrH6={{ className: 'mb-0' }} >{title}</H6><a href="#javascript">
                        <Printer className="me-2" />{Print}</a>
                </CardHeader>
                <CardBody>
                    <div className="details-bookmark text-center">
                        <Row></Row>
                        <div className="no-favourite"><span>{NoTaskDueToday}</span></div>
                    </div>
                </CardBody>
            </Card>
        </Fragment>
    );
};
export default EmptyTaskClass;