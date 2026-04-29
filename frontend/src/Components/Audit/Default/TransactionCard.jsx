/*
 * PGH-DOC
 * File: src/Components/Audit/Default/TransactionCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { TransactionChart } from '../../Common/Data/ApexChart';
import CardHeaderComponent from '../Common/CardHeader';
import { H2, P } from '../../../AbstractElements';
import React from 'react';
import { Card, CardBody, CardHeader } from '@pgh/ui-bootstrap';
import Chart from 'react-apexcharts';

const TransactionCard = () => {
    return (
        <Card className="trasaction-sec">
            <CardHeader>
                <CardHeaderComponent title="Transaction" subtitle="5878 Suceessfull Transaction" settingIcon={true} />
            </CardHeader>
            <div className="transaction-totalbal">
                <H2> $2,09,352k <span className="ms-3"> <a className="btn-arrow arrow-secondary" href="#javascript"><i className="toprightarrow-secondary fa fa-arrow-up me-2"></i>98.54%</a></span></H2>
                <P>Total Balance</P>
            </div>
            <CardBody className="p-0">
                <div id="chart-3dash">
                    <Chart options={TransactionChart.options} series={TransactionChart.series} type="area" height={430} />
                </div>
            </CardBody>
        </Card>
    );
};

export default TransactionCard;