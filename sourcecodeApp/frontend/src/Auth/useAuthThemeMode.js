/*
 * PGH-DOC
 * File: src/Auth/useAuthThemeMode.js
 * Apa fungsi bagian ini:
 * - Hook global untuk membaca dan mengganti mode light/dark di halaman autentikasi.
 * Kenapa perlu:
 * - Agar login/signup konsisten dengan theme engine aplikasi tanpa duplikasi logika per halaman.
 * Aturan khususnya apa:
 * - Gunakan key localStorage yang sama dengan layout utama: mix_background_layout.
 * - Selalu pertahankan class layout_type pada body saat theme diganti.
 */

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import ConfigDB from "../Config/ThemeConfig";
import CustomizerContext from "../_helper/Customizer";

const THEME_LIGHT = "light-only";
const THEME_DARK = "dark-only";

const resolveThemeMode = () => {
  if (typeof document !== "undefined") {
    if (document.body.classList.contains(THEME_DARK)) {
      return THEME_DARK;
    }
    if (document.body.classList.contains(THEME_LIGHT)) {
      return THEME_LIGHT;
    }
  }

  try {
    const stored = localStorage.getItem("mix_background_layout");
    return stored === THEME_DARK ? THEME_DARK : THEME_LIGHT;
  } catch {
    return THEME_LIGHT;
  }
};

const resolveLayoutType = () => {
  try {
    return localStorage.getItem("layout_type") || ConfigDB.settings.layout_type || "ltr";
  } catch {
    return ConfigDB.settings.layout_type || "ltr";
  }
};

const useAuthThemeMode = () => {
  const { addMixBackgroundLayout } = useContext(CustomizerContext);
  const [themeMode, setThemeMode] = useState(resolveThemeMode);
  const layoutType = useMemo(() => resolveLayoutType(), []);

  const applyThemeMode = useCallback(
    (nextMode) => {
      const normalizedMode = nextMode === THEME_DARK ? THEME_DARK : THEME_LIGHT;

      addMixBackgroundLayout?.(normalizedMode);

      if (typeof document !== "undefined") {
        document.body.classList.remove(THEME_LIGHT, THEME_DARK, "dark-sidebar");
        document.body.classList.add(normalizedMode);
        if (layoutType) {
          document.body.classList.add(layoutType);
        }
      }

      try {
        localStorage.setItem("mix_background_layout", normalizedMode);
      } catch {}

      setThemeMode(normalizedMode);
    },
    [addMixBackgroundLayout, layoutType],
  );

  const toggleThemeMode = useCallback(() => {
    applyThemeMode(themeMode === THEME_DARK ? THEME_LIGHT : THEME_DARK);
  }, [applyThemeMode, themeMode]);

  // Pastikan login/signup selalu sinkron dengan class tema di body
  // (menghindari kasus label tombol berubah tapi style halaman tidak ikut).
  useEffect(() => {
    applyThemeMode(themeMode);
  }, [applyThemeMode, themeMode]);

  return {
    themeMode,
    isDarkMode: themeMode === THEME_DARK,
    applyThemeMode,
    toggleThemeMode,
  };
};

export default useAuthThemeMode;
