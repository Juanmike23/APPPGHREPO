/*
 * PGH-DOC
 * File: src/Layout/Header/LeftBar.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useContext } from "react";
import { AlignCenter } from "react-feather";
import { Link } from "react-router-dom";
import { Image } from "../../AbstractElements";
import CheckContext from "../../_helper/Customizer";
import logoImg from "../../assets/images/logo/logo.png";
import darkLogoImg from "../../assets/images/logo/dark-logo.png";

const Leftbar = () => {
  const { mixLayout, sidebarOpen, toggleSidebar } = useContext(CheckContext);

  return (
    <Fragment>
      <div className={`main-header-left ${sidebarOpen ? "closed" : "open"}`}>
        {!sidebarOpen &&
          (mixLayout ? (
            <div className="logo-wrapper">
              <Link
                to={`${process.env.PUBLIC_URL}`}
                  onClick={() => toggleSidebar()}
              >
                <Image
                  attrImage={{
                    className: "img-fluid d-inline",
                    src: logoImg,
                    alt: "",
                  }}
                />
              </Link>
            </div>
          ) : (
            <div className="dark-logo-wrapper">
              <Link to={`${process.env.PUBLIC_URL}`}>
                <Image
                  attrImage={{
                    className: "img-fluid d-inline",
                    src: darkLogoImg,
                    alt: "",
                  }}
                />
              </Link>
            </div>
          ))}

        <div
          className="toggle-sidebar"
          onClick={() => toggleSidebar()}
          role="button"
          tabIndex={0}
          title={sidebarOpen ? "Buka Sidebar" : "Tutup Sidebar"}
          aria-label={sidebarOpen ? "Buka Sidebar" : "Tutup Sidebar"}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleSidebar();
            }
          }}
        >
          <AlignCenter className="status_toggle middle" />
        </div>
      </div>
    </Fragment>
  );
};

export default Leftbar;
