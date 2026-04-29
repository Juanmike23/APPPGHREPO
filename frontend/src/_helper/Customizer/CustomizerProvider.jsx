/*
 * PGH-DOC
 * File: src/_helper/Customizer/CustomizerProvider.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ConfigDB from "../../Config/ThemeConfig";
import Context from "./index";

const DEFAULT_SIDEBAR_TYPE = ConfigDB.settings.sidebar.type || "compact-wrapper";
const DEFAULT_SIDEBAR_SETTING =
  ConfigDB.settings.sidebar_setting || "default-sidebar";
const LOCKED_SIDEBAR_TYPE = "compact-wrapper";
const LOCKED_SIDEBAR_SETTING = "default-sidebar";
const MOBILE_VIEWPORT_BREAKPOINT = 992;

const normalizeSidebarType = () => LOCKED_SIDEBAR_TYPE;
const normalizeSidebarSetting = () => LOCKED_SIDEBAR_SETTING;

const readStoredSidebarType = () =>
  normalizeSidebarType(localStorage.getItem("sidebar_types") || DEFAULT_SIDEBAR_TYPE);

const readStoredSidebarSetting = () =>
  normalizeSidebarSetting(localStorage.getItem("sidebar_Settings") || DEFAULT_SIDEBAR_SETTING);

const CustomizerProvider = (props) => {
  const [sidebar_types, setSidebarTypes] = useState(() => readStoredSidebarType());
  const [settings, setSettings] = useState(() => readStoredSidebarSetting());
  const [layout, setLayout] = useState("");
  const [mix_background_layout, setMixBackgroundLayout] = useState("");
  const [toggleIcon, setToggleIcon] = useState(false);
  const [mixLayout, setMixLayout] = useState(false);
  const [sidebarResponsive, setSidebarResponsive] = useState(false);
  const [IsOpen, setIsClose] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => window.innerWidth < MOBILE_VIEWPORT_BREAKPOINT,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < MOBILE_VIEWPORT_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const addSidebarTypes = (type) => {
    const nextType = normalizeSidebarType(String(type || "").trim());

    if (!nextType) {
      localStorage.removeItem("sidebar_types");
      setSidebarTypes(LOCKED_SIDEBAR_TYPE);
      return;
    }

    ConfigDB.settings.sidebar.type = nextType;
    localStorage.setItem("sidebar_types", nextType);
    setSidebarTypes(nextType);
  };

  const addSidebarSettings = (sidebarSetting) => {
    const nextSetting = normalizeSidebarSetting(String(sidebarSetting || "").trim());

    if (!nextSetting) {
      localStorage.removeItem("sidebar_Settings");
      setSettings(LOCKED_SIDEBAR_SETTING);
      return;
    }

    ConfigDB.settings.sidebar_setting = nextSetting;
    localStorage.setItem("sidebar_Settings", nextSetting);
    setSettings(nextSetting);
  };

  const addLayout = (nextLayout) => {
    ConfigDB.settings.layout_type = nextLayout;
    localStorage.setItem("layout_type", nextLayout);
    setLayout(nextLayout);
  };

  const addMixBackgroundLayout = (nextMixBackgroundLayout) => {
    ConfigDB.color.mix_background_layout = nextMixBackgroundLayout;
    localStorage.setItem("mix_background_layout", nextMixBackgroundLayout);
    setMixLayout(nextMixBackgroundLayout === "light-only");
    setMixBackgroundLayout(nextMixBackgroundLayout);
  };

  const addColor = (default_color, secondary_color) => {
    ConfigDB.color.primary_color = default_color;
    ConfigDB.color.secondary_color = secondary_color;
    localStorage.setItem("default_color", default_color);
    localStorage.setItem("secondary_color", secondary_color);
  };

  // Single source of truth untuk status sidebar:
  // true = close_icon aktif (sidebar collapsed), false = sidebar terbuka.
  const sidebarOpen = toggleIcon;
  const toggleSidebar = useCallback((value) => {
    setToggleIcon((prev) =>
      typeof value === "boolean" ? value : !prev,
    );
  }, []);

  const toggleSidebarResponsive = useCallback((toggle) => {
    setSidebarResponsive(toggle);
  }, []);

  const effectiveSidebarType = useMemo(
    () => normalizeSidebarType(isMobileViewport ? "compact-wrapper" : sidebar_types || DEFAULT_SIDEBAR_TYPE),
    [isMobileViewport, sidebar_types],
  );

  const effectiveSidebarSetting = useMemo(
    () => normalizeSidebarSetting(isMobileViewport ? "default-sidebar" : settings || DEFAULT_SIDEBAR_SETTING),
    [isMobileViewport, settings],
  );

  useEffect(() => {
    ConfigDB.settings.sidebar.type = effectiveSidebarType;
    ConfigDB.settings.sidebar_setting = effectiveSidebarSetting;
    localStorage.setItem("sidebar_types", effectiveSidebarType);
    localStorage.setItem("sidebar_Settings", effectiveSidebarSetting);
  }, [effectiveSidebarSetting, effectiveSidebarType]);

  return (
    <Context.Provider
      value={{
        ...props,
        sidebarOpen,
        sidebar_types,
        effectiveSidebarType,
        settings,
        effectiveSidebarSetting,
        layout,
        mix_background_layout,
        toggleIcon,
        toggleSidebar,
        mixLayout,
        isMobileViewport,
        sidebarResponsive,
        IsOpen,
        setIsClose,
        setToggleIcon,
        toggleSidebarResponsive,
        setMixLayout,
        addSidebarTypes,
        addSidebarSettings,
        addLayout,
        addMixBackgroundLayout,
        addColor,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default CustomizerProvider;
