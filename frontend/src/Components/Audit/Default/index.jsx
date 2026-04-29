/*
 * PGH-DOC
 * File: src/Components/Audit/Default/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import { Col, Container, Row } from "@pgh/ui-bootstrap";
import { Icon1, Icon2 } from "../../Common/Data/SvgIcons";
import GrowthOverview from "./GrownCard";
import IncomeCard from "./IncomeCard";
import IncomeChartClass from "./IncomechartCard";
import LatestActivityClass from "./LatestActivityCard";
import ProfileGreeting from "./ProfileGreetingCard";
import RecentOrderClass from "./RecentOrderCard";
import TransactionCard from "./TransactionCard";
import UserCard from "./UserCard";

const Dashboard = () => {
  return (
    <Container fluid={true} className="dashboard-default-sec">
      <Row>
        <Col xl="5" className="box-col-12 des-xl-100">
          <Row>
            <Col xl="12" md="6" className="box-col-6 des-xl-50">
              <ProfileGreeting />
            </Col>
            <Col xl="6" md="3" sm="6" className="box-col-3 des-xl-25 rate-sec">
              <IncomeCard iconClass={<Icon1 />} amount="8,50,49" title="Our Annual Income" percent="95.54%" />
            </Col>
            <Col xl="6" md="3" sm="6" className="box-col-3 des-xl-25 rate-sec">
              <IncomeCard iconClass={<Icon2 />} amount="2,03,59" title="Our Annual Losses" percent="90.54%" />
            </Col>
          </Row>
        </Col>
        <IncomeChartClass />
        <Col xl="8" className="box-col-12 des-xl-100">
          <Row>
            <Col xl="6" className="col-50 box-col-6 des-xl-50">
              <GrowthOverview />
            </Col>
            <Col xl="6" className="col-50 box-col-6 des-xl-50">
              <LatestActivityClass />
            </Col>
            <Col xl="12" className="recent-order-sec">
              <RecentOrderClass />
            </Col>
          </Row>
        </Col>
        <Col xl="4" className="box-col-12 des-xl-100">
          <Row>
            <Col xl="12" className="box-col-6 des-xl-50">
              <UserCard />
            </Col>
            <Col xl="12" className="box-col-6 des-xl-50">
              <TransactionCard />
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;
