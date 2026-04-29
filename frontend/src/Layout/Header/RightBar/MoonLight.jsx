/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/MoonLight.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useState, useContext, useCallback, useEffect } from "react";
import { LI } from "../../../AbstractElements";
import ConfigDB from "../../../Config/ThemeConfig";
import CustomizerContext from "../../../_helper/Customizer";
import { Moon, Sun } from "react-feather";

const THEME_LIGHT = "light-only";
const THEME_DARK = "dark-only";

const resolveThemeFromDomOrStorage = () => {
  if (typeof document !== "undefined" && document.body.classList.contains(THEME_DARK)) {
    return THEME_DARK;
  }
  if (typeof document !== "undefined" && document.body.classList.contains(THEME_LIGHT)) {
    return THEME_LIGHT;
  }
  const stored = localStorage.getItem("mix_background_layout");
  return stored === THEME_DARK ? THEME_DARK : THEME_LIGHT;
};

const MoonLight = () => {
  const { addMixBackgroundLayout } = useContext(CustomizerContext);
  const [themeMode, setThemeMode] = useState(resolveThemeFromDomOrStorage);
  const localStorageLayout = localStorage.getItem("layout_type") || ConfigDB.settings.layout_type;

  const applyThemeMode = useCallback(
    (nextMode) => {
      addMixBackgroundLayout(nextMode);
      document.body.classList.remove(THEME_LIGHT, THEME_DARK, "dark-sidebar");
      document.body.classList.add(nextMode);
      if (localStorageLayout) {
        document.body.classList.add(localStorageLayout);
      }
      setThemeMode(nextMode);
    },
    [addMixBackgroundLayout, localStorageLayout],
  );

  useEffect(() => {
    const initialMode = resolveThemeFromDomOrStorage();
    if (!document.body.classList.contains(initialMode)) {
      document.body.classList.remove(THEME_LIGHT, THEME_DARK, "dark-sidebar");
      document.body.classList.add(initialMode);
      if (localStorageLayout) {
        document.body.classList.add(localStorageLayout);
      }
    }
    setThemeMode(initialMode);

    const observer = new MutationObserver(() => {
      const nextMode = resolveThemeFromDomOrStorage();
      setThemeMode((prevMode) => (prevMode === nextMode ? prevMode : nextMode));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [localStorageLayout]);

  const isDarkMode = themeMode === THEME_DARK;
  const handleMoonlightToggle = () => {
    applyThemeMode(isDarkMode ? THEME_LIGHT : THEME_DARK);
  };

  return (
    <Fragment>
      <LI attrLI={{ className: "onhover-dropdown p-0 theme-toggle-item" }}>
        <button
          type="button"
          className="header-theme-toggle"
          onClick={handleMoonlightToggle}
          aria-label={isDarkMode ? "Ubah ke Light Mode" : "Ubah ke Dark Mode"}
          title={isDarkMode ? "Light Mode" : "Dark Mode"}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          <span>{isDarkMode ? "Light" : "Dark"}</span>
        </button>
      </LI>
    </Fragment>
  );
};

export default MoonLight;
