/*
 * PGH-DOC
 * File: src/Layout/ThemeCustomizer/Tabs/Sidebar/SidebarType.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

/* eslint-disable react-hooks/exhaustive-deps */
import React, { Fragment, useContext, useEffect } from "react";
import { H6, LI, UL } from "../../../../AbstractElements";
import ConfigDB from "../../../../Config/ThemeConfig";
import CustomizerContext from "../../../../_helper/Customizer";
import CommenUL from "./CommenUL";

const SidebarType = () => {
  const { addSidebarTypes } = useContext(CustomizerContext);
  const sidebarType = localStorage.getItem("sidebar_types") || ConfigDB.settings.sidebar.type;

  useEffect(() => {
    ConfigDB.settings.sidebar.type = sidebarType;
  }, []);

  const handleSidebarType = (e, type) => {
    e.preventDefault();
    addSidebarTypes(type);
  };

  return (
    <Fragment>
      <H6>Sidebar Type</H6>
      <UL attrUL={{ className: "sidebar-type layout-grid" }}>
        <LI
          attrLI={{
            className: "normal-sidebar",
            onClick: (e) => handleSidebarType(e, "horizontal-wrapper"),
          }}
        >
          <div className="header bg-light">
            <CommenUL />
          </div>
          <div className="body">
            <UL attrUL={{ className: "flex-row" }}>
              <LI attrLI={{ className: "bg-dark sidebar" }}></LI>
              <LI attrLI={{ className: "bg-light body" }}></LI>
            </UL>
          </div>
        </LI>
        <LI
          attrLI={{
            dataattr: "compact-sidebar",
            onClick: (e) => handleSidebarType(e, "compact-wrapper"),
          }}
        >
          <div className="header bg-light">
            <CommenUL />
          </div>
          <div className="body">
            <UL attrUL={{ className: "flex-row" }}>
              <LI attrLI={{ className: "bg-dark sidebar compact" }}></LI>
              <LI attrLI={{ className: "bg-light body" }}></LI>
            </UL>
          </div>
        </LI>
      </UL>
    </Fragment>
  );
};

export default SidebarType;
