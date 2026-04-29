/*
 * PGH-DOC
 * File: src/Layout/ThemeCustomizer/Tabs/Sidebar/AnimationFade.jsx
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
import React, { Fragment, useEffect, useContext } from "react";
import { Input } from "@pgh/ui-bootstrap";
import { H6 } from "../../../../AbstractElements";
import ConfigDB from "../../../../Config/ThemeConfig";
import { Fade, FadeBottom, None, RouterAnimation, SildeFade, ZoomFade, ZoomOut } from "../../../../Constant";
import AnimationThemeContext from "../../../../_helper/AnimationTheme";

const AnimationFade = () => {
  const { routerAnimation } = useContext(AnimationThemeContext);
  const layout_animation = localStorage.getItem("animation") || ConfigDB.router_animation;

  useEffect(() => {
    ConfigDB.router_animation = layout_animation;
  }, []);

  const selectAnimation = (e) => {
    routerAnimation(e.target.value);
  };
  return (
    <Fragment>
      <H6>
        {RouterAnimation} {layout_animation}
      </H6>
      <Input type="select" defaultValue={layout_animation} name="selectMulti" onChange={(e) => selectAnimation(e)}>
        <option value="zoomfade">{ZoomFade}</option>
        <option value="slidefade">{SildeFade}</option>
        <option value="fadebottom">{FadeBottom}</option>
        <option value="fade">{Fade}</option>
        <option value="zoomout">{ZoomOut}</option>
        <option value="none">{None}</option>
      </Input>
    </Fragment>
  );
};

export default AnimationFade;
