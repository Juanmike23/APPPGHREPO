/*
 * PGH-DOC
 * File: src/Layout/Sidebar/SidebarMenu.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useContext, useEffect, useState } from "react";
import SidebarMenuItems from "./SidebarMenuItems";
import { ArrowLeft, ArrowRight } from "react-feather";
import ConfigDB from "../../Config/ThemeConfig";
import CustomizerContext from "../../_helper/Customizer";

const SidebarMenu = ({ props, sidebartoogle, width }) => {
  const [rightArrow, setRightArrow] = useState(false);
  const [leftArrow, setLeftArrow] = useState(false);
  const [margin, setMargin] = useState(0);
  const { effectiveSidebarType } = useContext(CustomizerContext);

  const wrapper = effectiveSidebarType || ConfigDB.settings.sidebar.type;

  useEffect(() => {
    setLeftArrow(true);
  }, []);

  const scrollToRight = () => {
    if (margin <= -2598 || margin <= -2034) {
      if (width === 492) {
        setMargin(-3570);
      } else {
        setMargin(-3464);
      }
      setRightArrow(true);
      setLeftArrow(false);
    } else {
      setLeftArrow(false);
      setMargin((margin) => (margin += -width));
    }
  };

  const scrollToLeft = () => {
    if (margin >= -width) {
      setMargin(0);
      setLeftArrow(true);
      setRightArrow(false);
    } else {
      setMargin((margin) => (margin += width));
      setRightArrow(false);
    }
  };

  return (
    <Fragment>
      <nav>
        <div className="main-navbar">
          {/* Left Scroll */}
          <div
            className={`left-arrow ${leftArrow ? "d-none" : ""}`}
            id="left-arrow"
            onClick={scrollToLeft}
          >
            <ArrowLeft />
          </div>

          {/* Sidebar Menu */}
          <div
            id="sidebar-menu"
            style={
              wrapper.split(" ").includes("horizontal-wrapper")
                ? { marginLeft: margin + "px" }
                : { margin: "0px" }
            }
          >
            <SidebarMenuItems
              props={props}
              sidebartoogle={sidebartoogle}
            />
          </div>

          {/* Right Scroll */}
          <div
            className={`right-arrow ${rightArrow ? "d-none" : ""}`}
            onClick={scrollToRight}
          >
            <ArrowRight />
          </div>
        </div>
      </nav>
    </Fragment>
  );
};

export default SidebarMenu;
