/*
 * PGH-DOC
 * File: src/Route/Routes.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur peta routing dan alur navigasi halaman.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { lazy } from "react";
import { Navigate } from "react-router-dom";

const lazyElement = (loader) => {
  const LazyComponent = lazy(loader);
  return <LazyComponent />;
};

const redirectElement = (to) => <Navigate to={to} replace />;

export const routes = [
  {
    path: `${process.env.PUBLIC_URL}`,
    Component: lazyElement(() => import("../Components/Dashboard/Default")),
  },
  {
    path: `${process.env.PUBLIC_URL}/admin/user-access`,
    Component: lazyElement(
      () => import("../Components/Application/Users/UserAccessAdmin"),
    ),
  },
  {
    path: `${process.env.PUBLIC_URL}/settings`,
    Component: lazyElement(
      () => import("../Components/Application/Users/Settings"),
    ),
  },
  {
    path: `${process.env.PUBLIC_URL}/audit`,
    Component: lazyElement(() => import("../Components/Audit/DashboardAudit")),
  },
  {
    path: `${process.env.PUBLIC_URL}/audit/summary`,
    Component: lazyElement(() => import("../Components/Audit/SummaryAudit")),
  },
  {
    path: `${process.env.PUBLIC_URL}/audit/listAudit`,
    Component: lazyElement(() => import("../Components/Audit/ListAudit")),
  },
  {
    path: `${process.env.PUBLIC_URL}/audit/timeline`,
    Component: lazyElement(() => import("../Components/Audit/Timeline")),
  },
  {
    path: `${process.env.PUBLIC_URL}/audit/calendar`,
    Component: lazyElement(() => import("../Components/Audit/Calendar")),
  },
  {
    path: `${process.env.PUBLIC_URL}/compliance`,
    Component: lazyElement(
      () => import("../Components/Compliance/DashboardCompliance"),
    ),
  },
  {
    path: `${process.env.PUBLIC_URL}/compliance/summary`,
    Component: redirectElement(`${process.env.PUBLIC_URL}/compliance`),
  },
  {
    path: `${process.env.PUBLIC_URL}/compliance/template`,
    Component: redirectElement(`${process.env.PUBLIC_URL}/compliance`),
  },
  {
    path: `${process.env.PUBLIC_URL}/planning`,
    Component: lazyElement(() => import("../Components/Planning/DashboardPlanning")),
  },
  {
    path: `${process.env.PUBLIC_URL}/planning/businessPlan`,
    Component: lazyElement(
      () => import("../Components/Planning/BusinessPlanDirectory"),
    ),
  },
  {
    path: `${process.env.PUBLIC_URL}/procurement`,
    Component: lazyElement(
      () => import("../Components/Procurement/DashboardProcurement"),
    ),
  },
  {
    path: `${process.env.PUBLIC_URL}/procurement/summary`,
    Component: lazyElement(
      () => import("../Components/Procurement/SummaryProcurement"),
    ),
  },
  {
    path: `${process.env.PUBLIC_URL}/procurement/APS`,
    Component: lazyElement(() => import("../Components/Procurement/APS")),
  },
  {
    path: `${process.env.PUBLIC_URL}/human`,
    Component: lazyElement(() => import("../Components/Human/DashboardHuman")),
  },
  {
    path: `${process.env.PUBLIC_URL}/human/summary`,
    Component: lazyElement(() => import("../Components/Human/SummaryHuman")),
  },
  {
    path: `${process.env.PUBLIC_URL}/human/resource`,
    Component: lazyElement(() => import("../Components/Human/Resource")),
  },
  {
    path: `${process.env.PUBLIC_URL}/human/training`,
    Component: lazyElement(() => import("../Components/Human/Training")),
  },
];
