/*
 * PGH-DOC
 * File: src/Variables/FullscreenOverlay.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// import Loader from "./Loader";
// import Taptop from "./TapTop";
// import Header from "./Header";
// import Sidebar from "./Sidebar";
// import Footer from "./Footer";
// import React, { Fragment, useRef, useContext } from "react";
// import ThemeCustomize from "../Layout/ThemeCustomizer";
// import { ToastContainer } from "react-toastify";
// import CustomizerContext from "../_helper/Customizer";
// import { Outlet, useLocation } from "react-router-dom";
// import { CSSTransition, TransitionGroup } from "react-transition-group";
// import AnimationThemeContext from "../_helper/AnimationTheme";
// import ConfigDB from "../Config/ThemeConfig";
// import Divider from "./Divider";
// import LayoutContext from "./LayoutContext";

// // ✅ Import Breadcrumbs
// import Breadcrumbs from "../Variables/Breadcrumbs/Breadcrumb"; // adjust path if needed

// const AppLayout = ({ children, classNames, ...rest }) => {
//   const [fullscreen, setFullscreen] = React.useState(false);

//   const location = useLocation();
//   const { sidebar_types } = useContext(CustomizerContext);
//   const queryData = location?.search?.split("=")[1]?.toString();
//   const settings1 =
//     localStorage.getItem("sidebar_Settings") ||
//     ConfigDB.settings.sidebar_setting ||
//     queryData;
//   const sidebar_types1 =
//     localStorage.getItem("sidebar_types") ||
//     ConfigDB.settings.sidebar.type ||
//     sidebar_types;
//   const { animation } = useContext(AnimationThemeContext);
//   const animationTheme =
//     localStorage.getItem("animation") || animation || ConfigDB.router_animation;

//   const nodeRef = useRef(null);

//   // Prevent noisy warnings
//   const error = console.error;
//   console.error = (...args) => {
//     if (/defaultProps/.test(args[0])) return;
//     error(...args);
//   };

//   return (
//      <LayoutContext.Provider value={{ fullscreen, setFullscreen }}>
//     <Fragment>
//       <Loader />
//       <Taptop className />
//      <div
//   className={`page-wrapper ${sidebar_types1} ${settings1} ${
//     fullscreen ? "layout-fullscreen" : ""
//   }`}
//   id="pageWrapper"
// >

//         <Header />
//         <div className="page-body-wrapper horizontal-menu">
//           <Sidebar />
//           <div className="page-body">
//             {" "}
//             {/* <-- layout container stays stable */}
//             <TransitionGroup>
//               <CSSTransition
//                 key={location.key}
//                 timeout={120}
//                 classNames={animationTheme}
//                 nodeRef={nodeRef}
//                 unmountOnExit
//               >
//                 <div ref={nodeRef}>
//                   {location.pathname !==
//                     `${process.env.PUBLIC_URL}/` && (
//                     <Breadcrumbs />
//                   )}

//                   <Outlet />
//                 </div>
//               </CSSTransition>
//             </TransitionGroup>
//           </div>
//           <Footer /> {/* <-- must be OUTSIDE the transition */}
//         </div>
//       </div>
//       <ThemeCustomize />
//       <ToastContainer />
//     </Fragment>
//     </LayoutContext.Provider>
//   );
// };

// export default AppLayout;
