/*
 * PGH-DOC
 * File: src/CommonElements/Breadcrumbs/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from 'react';
import { Container, Row, Col } from '@pgh/ui-bootstrap';
import { Link } from 'react-router-dom';
import H3 from '../Headings/H3Element';

const Breadcrumbs = (props) => {
  return (
    <Fragment>
      <Container fluid={true}>
        <div className="page-header">
          <Row>
            <Col sm="6">
              <H3>{props.mainTitle}</H3>
            </Col>
            <Col sm="6">
              <ol className="breadcrumb">
                <li className="breadcrumb-item"><Link to={`${process.env.PUBLIC_URL}/`}>Home</Link></li>
                <li className="breadcrumb-item">{props.parent}</li>
                {props.subParent ? <li className="breadcrumb-item">{props.subParent}</li> : ''}
                <li className="breadcrumb-item active">{props.title}</li>
              </ol>
            </Col>

          </Row>
        </div>
      </Container>
    </Fragment>
  );
};

export default Breadcrumbs;