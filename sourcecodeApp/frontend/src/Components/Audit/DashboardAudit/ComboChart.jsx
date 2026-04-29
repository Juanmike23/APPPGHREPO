/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/ComboChart.jsx
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
import { Card, CardBody, Col } from '@pgh/ui-bootstrap';
import { ComboChart } from '../../../Constant';
import { Chart } from "react-google-charts";
import HeaderCard from '../../Common/Component/HeaderCard';
import FeedbackState from '../../Common/FeedbackState';

const ComboChartClass = ({ data }) => {

    return (
        <Fragment>
            <Col sm="12" >
                <Card>
                    <HeaderCard title={ComboChart} />
                    <CardBody className="chart-block">
                        <div className="chart-overflow" id="pie-chart1">
                            <Chart
                                width={data?.width}
                                height={data?.height}
                                chartType={data?.chartType}
                                loader={
                                    <FeedbackState
                                        variant="loading"
                                        title="Loading chart"
                                        description="Ringkasan audit sedang dimuat."
                                        compact
                                    />
                                }
                                data={[
                                    [
                                        'Month',
                                        "Open",
                                        "Closed",
                                        // 'Average',
                                    ],
                                    ['BOA', 43, 55],
                                    ['CBS', 20, 75],
                                    ['DCP', 50, 55],
                                    ['IAD', 80, 30],
                                    ['IDS', 77, 50],
                                ]}
                                options={{
                                    title: 'Berdasarkan status open dan closed',
                                    vAxis: { title: 'Total Audit' },
                                    hAxis: { title: 'Departmen' },
                                    seriesType: 'bars',
                                    colors: ["#dc3912", "#51bb25"],
                                    series: { 2: { type: 'line' } },
                                    backgroundColor: 'transparent',
                                }}
                                rootProps={data?.rootProps}
                            />
                        </div>
                    </CardBody>
                </Card>
            </Col>
        </Fragment>
    )
}

export default ComboChartClass;
