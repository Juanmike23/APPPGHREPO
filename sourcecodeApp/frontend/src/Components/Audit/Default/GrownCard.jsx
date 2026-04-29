/*
 * PGH-DOC
 * File: src/Components/Audit/Default/GrownCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { Growthchart } from '../../Common/Data/ApexChart';
import CardHeaderComponent from '../Common/CardHeader';
import React from 'react';
import { Card, CardBody, CardHeader } from '@pgh/ui-bootstrap';
import Chart from 'react-apexcharts';

const GrowthOverview = () => {
    return (
        <Card>
            <CardHeader>
                <CardHeaderComponent title='Growth Overview' subtitle="80% Growth" />
            </CardHeader>
            <CardBody className="p-0 growth-overview">
                <div id="chart-dashbord">
                    <Chart options={Growthchart.options} series={Growthchart.series} type="radialBar" height={380} />
                </div>
            </CardBody>
        </Card>
    );
};

export default GrowthOverview;