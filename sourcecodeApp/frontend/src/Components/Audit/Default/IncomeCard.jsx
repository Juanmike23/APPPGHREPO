/*
 * PGH-DOC
 * File: src/Components/Audit/Default/IncomeCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { H5, P } from '../../../AbstractElements';
import React from 'react';
import { Card, CardBody } from '@pgh/ui-bootstrap';

const IncomeCard = ({ iconClass, amount, title, percent }) => {
    return (
        <Card className="income-card card-primary">
            <CardBody className="text-center">
                <div className="round-box">
                    {iconClass}
                </div>
                <H5>{amount}</H5>
                <P>{title}</P>
                <a className="btn-arrow arrow-primary" href="#javascript">
                    <i className="toprightarrow-primary fa fa-arrow-up me-2"></i>{percent} </a>
                <div className="parrten">
                    {iconClass}
                </div>
            </CardBody>
        </Card>
    );
};

export default IncomeCard;