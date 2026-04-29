/*
 * PGH-DOC
 * File: src/Auth/Nav.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur autentikasi, login flow, dan kontrol akses user.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import { Nav, NavItem, NavLink } from "@pgh/ui-bootstrap";
import { Image } from "../AbstractElements";
import simpleLogin from "../assets/images/simple-login.svg";

const NavAuth = ({ callbackNav, selected }) => {
  return (
    <Nav className="border-tab flex-column" tabs>
      <NavItem>
        <NavLink className={selected === "simpleLogin" ? "active" : ""} onClick={() => callbackNav("simpleLogin")}>
          <Image attrImage={{ src: `${simpleLogin}`, alt: "" }} />
          <span>Simple Login</span>
        </NavLink>
      </NavItem>
    </Nav>
  );
};

export default NavAuth;
