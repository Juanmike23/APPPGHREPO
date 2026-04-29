/*
 * PGH-DOC

 * File: src/Layout/Layout.jsx

 * Apa fungsi bagian ini:

 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).

 * Kenapa perlu:

 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.

 * Aturan khususnya apa:

 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.

 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.

 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import Loader from "./Loader";
import Taptop from "./TapTop";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import React, { Fragment, useRef, useContext, useEffect, useCallback } from "react";
import ThemeCustomize from "../Layout/ThemeCustomizer";
import CustomizerContext from "../_helper/Customizer";
import { Outlet, useLocation } from "react-router-dom";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import AnimationThemeContext from "../_helper/AnimationTheme";
import ConfigDB from "../Config/ThemeConfig";
import Breadcrumbs from "../Variables/Breadcrumbs/Breadcrumb";

const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const HOME_PATH = PUBLIC_URL || "/";
const AUDIT_PATH = `${PUBLIC_URL}/audit`;
const STYLE_BUNDLES = {
  workspace: () => import("../assets/scss/style-workspace.scss"),
  audit: () => import("../assets/scss/style-audit.scss"),
};

const isHomePath = (path = "") => {
  const normalizedPath = String(path).replace(/\/+$/, "") || "/";
  return normalizedPath === HOME_PATH;
};

const AppLayout = ({ children, classNames, ...rest }) => {
  const location = useLocation();
  const { effectiveSidebarSetting, effectiveSidebarType } =
    useContext(CustomizerContext);
  const queryData = location?.search?.split("=")[1]?.toString();
  const settings1 =
    effectiveSidebarSetting || ConfigDB.settings.sidebar_setting || queryData;
  const sidebar_types1 = effectiveSidebarType || ConfigDB.settings.sidebar.type;
  const { animation } = useContext(AnimationThemeContext);
  const animationTheme =
    localStorage.getItem("animation") || animation || ConfigDB.router_animation;

  const nodeRef = useRef(null);
  const loadedStyleBundlesRef = useRef(new Set());
  const isAuditRoute =
    location.pathname === AUDIT_PATH ||
    location.pathname.startsWith(`${AUDIT_PATH}/`);

  // Prevent noisy warnings
  const error = console.error;
  console.error = (...args) => {
    if (/defaultProps/.test(args[0])) return;
    error(...args);
  };

  // Sidebar state tidak dipaksa saat route berubah.
  // Posisi open/close mengikuti toggle user + bootstrap responsif di Header.

  const ensureStyleBundle = useCallback(async (bundleKey) => {
    if (loadedStyleBundlesRef.current.has(bundleKey)) return;

    const loader = STYLE_BUNDLES[bundleKey];
    if (!loader) return;

    loadedStyleBundlesRef.current.add(bundleKey);

    try {
      await loader();
    } catch (loadError) {
      loadedStyleBundlesRef.current.delete(bundleKey);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error(`Failed to load style bundle '${bundleKey}':`, loadError);
      }
    }
  }, []);

  useEffect(() => {
    if (!isHomePath(location.pathname)) {
      void ensureStyleBundle("workspace");
    }

    if (isAuditRoute) {
      void ensureStyleBundle("audit");
    }
  }, [isAuditRoute, location.pathname, ensureStyleBundle]);

  return (
    <Fragment>
      <Loader />
      <Taptop className />
      <div
        className={`page-wrapper ${sidebar_types1} ${settings1} ${
          isAuditRoute ? "page-wrapper-audit" : ""
        }`}
        id="pageWrapper"
      >
        <Header />
        <div
          className={`page-body-wrapper horizontal-menu ${
            isAuditRoute ? "audit-layout-shell" : ""
          }`}
        >
          <Sidebar />
          <TransitionGroup {...rest}>
            <CSSTransition
              key={location.key}
              timeout={100}
              classNames={animationTheme}
              nodeRef={nodeRef}
              unmountOnExit
            >
              <TransitionGroup {...rest}>
                <CSSTransition
                  key={location.key}
                  timeout={100}
                  classNames={animationTheme}
                  nodeRef={nodeRef}
                  unmountOnExit
                >
                  <div
                    className={`page-body ${isAuditRoute ? "audit-layout-body" : ""}`}
                    ref={nodeRef}
                  >
                    {!isHomePath(location.pathname) ? <Breadcrumbs /> : null}
                    <div className="layout-outlet-shell">
                      <Outlet />
                    </div>
                  </div>
                </CSSTransition>
              </TransitionGroup>
            </CSSTransition>
          </TransitionGroup>
        </div>
      </div>
      <Footer />
      <ThemeCustomize />
    </Fragment>
  );
};

export default AppLayout;
