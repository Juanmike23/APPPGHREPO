/*
 * PGH-DOC
 * File: src/Components/Audit/Timeline/index.jsx
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
import { Container, Row } from "@pgh/ui-bootstrap";

import FullCalendarTM from "./FullCalendarResourceTM";
import "../Utils/auditArea.scss";
// import Knob from 'knob';

const ListAudit = () => {
  return (
    <Fragment>
      <div className="audit-module-page">
      {/* <Breadcrumbs
        mainTitle="Time Line Audit"
        parent="Audit"
        title="Time LineAudit"
      /> */}
      <Container fluid={true}>
        <Row>
          <Row>
            <FullCalendarTM/>
          </Row>
          
        </Row>
      </Container>
      </div>
    </Fragment>

    
  );
};

export default ListAudit;
