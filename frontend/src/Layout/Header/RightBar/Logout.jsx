/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/Logout.jsx
 * Apa fungsi bagian ini:
 * - Tombol logout global di header aplikasi.
 * Kenapa perlu:
 * - Agar flow keluar akun konsisten di semua unit, termasuk pembersihan sesi lokal.
 * Aturan khususnya apa:
 * - Logout selalu melalui AuthContext agar sinkron dengan cookie-based session di backend.
 */

import React, { Fragment } from "react";
import { Btn, LI } from "../../../AbstractElements";
import { LogOut } from "react-feather";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../Auth/AuthContext";

const LogoutClass = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    localStorage.removeItem("profileURL");
    localStorage.removeItem("token");
    localStorage.removeItem("auth0_profile");
    localStorage.removeItem("Name");
    localStorage.removeItem("authenticated");
    await logout();
    navigate(`${process.env.PUBLIC_URL}/login`, { replace: true });
  };

  return (
    <Fragment>
      <LI attrLI={{ className: "onhover-dropdown p-0" }}>
        <Btn
          attrBtn={{
            tag: "button",
            type: "button",
            className: "btn btn-primary-light header-logout-btn",
            color: "light",
            onClick: handleLogout,
            title: "Log out",
            "aria-label": "Log out",
          }}
        >
          <LogOut />
          <span className="header-logout-label">Log out</span>
        </Btn>
      </LI>
    </Fragment>
  );
};

export default LogoutClass;
