/*
 * PGH-DOC
 * File: src/Components/Application/Users/UsersProfile/index.jsx
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

import LeftbarProfile from "./LeftbarProfile";
import UserProfile from "../../../Bonus-Ui/Tour/UserProfile";

import { useAuth } from "../../../../Auth/AuthContext";   // ⭐ add this

const UsersProfileContain = () => {
  const { user } = useAuth();     // ⭐ get user from auth context

  return (
    <Fragment>
      

      <Container fluid={true}>
        <div className="user-profile">
          <Row>
            {/* ⭐ Pass user profile info to your component */}
            <UserProfile user={user} />

            <LeftbarProfile user={user} />

            {/* <Col xl="9" lg="12" md="7" className="xl-65">
              <Row>
                <PostFirst />
                <PostSecond />
                <PostThird />
              </Row>
            </Col> */}
          </Row>
        </div>
      </Container>
    </Fragment>
  );
};

export default UsersProfileContain;
