/*
 * PGH-DOC
 * File: src/Components/Planning/Common/KnobChart.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from "react";
import { Card, CardBody, Col } from "@pgh/ui-bootstrap";
import { H5, P } from "../../../AbstractElements";
import Chart from "react-apexcharts";
import { progressDonutChart, progressDonutChart1 } from "../../Common/Data/ApexChart";

const KnobChart = () => {
  return (
    <Fragment>
      <Col xl="3" sm="6" className="box-col-3 chart_data_right">
        <Card className="income-card card-secondary">
          <CardBody>
            <div className="round-progress knob-block text-center">
              <Chart options={progressDonutChart.options} series={progressDonutChart.series} type="radialBar" height={200} />
              <H5>{"$9,84,235"}</H5>
              <P>{"Our Annual Income"}</P>
            </div>
          </CardBody>
        </Card>
      </Col>
      <Col xl="3" sm="6" className="box-col-3 chart_data_right second">
        <Card className="income-card card-secondary">
          <CardBody>
            <div className="round-progress knob-block text-center">
              <Chart options={progressDonutChart1.options} series={progressDonutChart1.series} type="radialBar" height={200} />
              <H5>{"$4,55,462"}</H5>
              <P>{"Our Annual Income"}</P>
            </div>
          </CardBody>
        </Card>
      </Col>
    </Fragment>
  );
};

export default KnobChart;
