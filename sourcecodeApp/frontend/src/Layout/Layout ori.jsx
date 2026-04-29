/*
 * PGH-DOC
 * File: src/Layout/Layout ori.jsx
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
import React, { Fragment, useRef, useContext } from "react";
import ThemeCustomize from "../Layout/ThemeCustomizer";
import { ToastContainer } from "react-toastify";
import CustomizerContext from "../_helper/Customizer";
import { Outlet, useLocation } from "react-router-dom";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import AnimationThemeContext from "../_helper/AnimationTheme";
import ConfigDB from "../Config/ThemeConfig";
import Divider from "./Divider";

// ✅ Import Breadcrumbs
import Breadcrumbs from "../Variables/Breadcrumbs/Breadcrumb"; // adjust path if needed

const AppLayout = ({ children, classNames, ...rest }) => {
  const location = useLocation();
  const { sidebar_types } = useContext(CustomizerContext);
  const queryData = location?.search?.split("=")[1]?.toString();
  const settings1 =
    localStorage.getItem("sidebar_Settings") ||
    ConfigDB.settings.sidebar_setting ||
    queryData;
  const sidebar_types1 =
    localStorage.getItem("sidebar_types") ||
    ConfigDB.settings.sidebar.type ||
    sidebar_types;
  const { animation } = useContext(AnimationThemeContext);
  const animationTheme =
    localStorage.getItem("animation") || animation || ConfigDB.router_animation;

  const nodeRef = useRef(null);

  // Prevent noisy warnings
  const error = console.error;
  console.error = (...args) => {
    if (/defaultProps/.test(args[0])) return;
    error(...args);
  };

  return (
    <Fragment>
      <Loader />
      <Taptop className />
      <div
        className={`page-wrapper ${sidebar_types1} ${settings1}`}
        id="pageWrapper"
      >
        <Header />
        <div className="page-body-wrapper horizontal-menu">
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
                  {/* 👇 Everything must live inside this ONE wrapper */}
                <div className="page-body" ref={nodeRef}>
  {location.pathname !== "/" &&
  location.pathname !== `${process.env.PUBLIC_URL}/` ? (
    <Breadcrumbs />
  ) : null}

  {/* Pull the Outlet upward slightly */}
  <div style={{ marginTop: "-16px" }}>
    <Outlet />
  </div>
</div>

                </CSSTransition>
              </TransitionGroup>
            </CSSTransition>
          </TransitionGroup>
          <Footer />
        </div>
      </div>
      <ThemeCustomize />
      <ToastContainer />
    </Fragment>
  );
};

export default AppLayout;