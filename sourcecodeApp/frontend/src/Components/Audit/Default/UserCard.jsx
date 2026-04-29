/*
 * PGH-DOC
 * File: src/Components/Audit/Default/UserCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { UserChart } from '../../Common/Data/ApexChart';
import CardHeaderComponent from '../Common/CardHeader';
import React from 'react';
import { Card, CardBody, CardHeader } from '@pgh/ui-bootstrap';
import Chart from 'react-apexcharts';

const UserCard = () => {
    return (
        <Card>
            <CardHeader>
                <CardHeaderComponent title='User Activations' subtitle="Yearly User 24.65k" settingIcon={true} />
            </CardHeader>
            <CardBody className="p-0">
                <div id="user-activation-dash-2">
                    <Chart options={UserChart.options} series={UserChart.series} type="bar" height={240} />
                </div>
            </CardBody>
        </Card>
    );
};

export default UserCard;