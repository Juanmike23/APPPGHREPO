/*
 * PGH-DOC
 * File: src/Components/Audit/Default/IncomechartCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { Currentlysale } from "../../Common/Data/ApexChart";
import CardHeaderComponent from "../Common/CardHeader";
import React, { Fragment } from "react";
import { Card, CardBody, CardHeader, Col } from "@pgh/ui-bootstrap";
import Chart from "react-apexcharts";

const IncomeChartClass = () => {
  return (
    <Fragment>
      <Col xl="7" className="box-col-12 des-xl-100 dashboard-sec">
        <Card className="income-card">
          <CardHeader>
            <CardHeaderComponent title="Sales overview" subtitle="86% More than last year" settingIcon={true} />
          </CardHeader>
          <CardBody className="p-0">
            <div id="chart-timeline-dashbord">
              <Chart options={Currentlysale.options} series={Currentlysale.series} height="395" width="100%" type="area" />
            </div>
          </CardBody>
        </Card>
      </Col>
    </Fragment>
  );
};

export default IncomeChartClass;
