/*
 * PGH-DOC
 * File: src/Components/Audit/ListAudit/index.jsx
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
import { Container, Row, Col } from "@pgh/ui-bootstrap";

import TableListAudit from "./TableListAudit"
import "../Utils/auditArea.scss";
// import Knob from 'knob';

const ListAudit = () => {
  return (
  
    <Fragment>
      <div className="audit-module-page">
          {/* <Breadcrumbs
            mainTitle="List Audit"
            parent="Audit"
            title="List Audit"
          /> */}
          <Container fluid={true}>
            <Row>
              <Col xs="12">
                <TableListAudit />
              </Col>
            </Row>
          </Container>
      </div>
    </Fragment>
  );
};

export default ListAudit;
