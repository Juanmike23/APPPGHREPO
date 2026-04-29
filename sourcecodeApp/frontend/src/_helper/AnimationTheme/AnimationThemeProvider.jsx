/*
 * PGH-DOC
 * File: src/_helper/AnimationTheme/AnimationThemeProvider.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useState } from "react";
import ConfigDB from "../../Config/ThemeConfig";
import Context from "./index";

const AnimationThemeProvider = (props) => {
  const [animation, setAnimation] = useState("");

  const routerAnimation = (layout_anim) => {
    ConfigDB.router_animation = layout_anim;
    localStorage.setItem("animation", layout_anim);
    setAnimation(layout_anim);
  };

  return (
    <Context.Provider
      value={{
        ...props,
        animation,
        routerAnimation,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default AnimationThemeProvider;
