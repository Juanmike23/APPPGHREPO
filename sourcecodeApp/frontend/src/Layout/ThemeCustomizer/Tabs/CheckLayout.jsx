/*
 * PGH-DOC
 * File: src/Layout/ThemeCustomizer/Tabs/CheckLayout.jsx
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
import { useNavigate } from "react-router-dom";
import { H6, Image, UL, LI } from "../../../AbstractElements";
import ConfigDB from "../../../Config/ThemeConfig";
import CustomizerContext from "../../../_helper/Customizer";
import demoLayout1 from "../../../assets/images/landing/demo/1.jpg";
import demoLayout2 from "../../../assets/images/landing/demo/2.jpg";
import demoLayout3 from "../../../assets/images/landing/demo/3.jpg";

const CheckLayout = () => {
  const navigate = useNavigate();
  const { addSidebarSettings } = useContext(CustomizerContext);
  const sidebarSettings = ConfigDB.sidebar_setting || localStorage.getItem("sidebar_Settings");

  useEffect(() => {
    ConfigDB.settings.sidebar_setting = sidebarSettings;
  }, []);

  const handleSttings = (sidebar_Settings) => {
    addSidebarSettings(sidebar_Settings);
    navigate({
      search: `?layout=${sidebar_Settings}`,
    });
  };

  return (
    <Fragment>
      <UL attrUL={{ className: "sidebar-type layout-grid layout-types" }}>
        <LI attrLI={{ dataattr: "defaul-layout" }}>
          <div className="layout-img" onClick={() => handleSttings("default-sidebar")}>
            <Image attrImage={{ className: "img-fluid", src: demoLayout1, alt: "" }} />
            <H6>Default layout</H6>
          </div>
        </LI>
        <LI attrLI={{ dataattr: "compact-layout" }}>
          <div className="layout-img" onClick={() => handleSttings("compact-sidebar")}>
            <Image attrImage={{ className: "img-fluid", src: demoLayout2, alt: "" }} />
            <H6>Compact layout</H6>
          </div>
        </LI>
        <LI attrLI={{ dataattr: "modern-layout" }}>
          <div className="layout-img" onClick={() => handleSttings("modern-sidebar")}>
            <Image attrImage={{ className: "img-fluid", src: demoLayout3, alt: "" }} />
            <H6>Modern layout</H6>
          </div>
        </LI>
      </UL>
    </Fragment>
  );
};

export default CheckLayout;
