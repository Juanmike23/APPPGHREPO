/*
 * PGH-DOC
 * File: src/Variables/Breadcrumbs/Breadcrumb.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import { Breadcrumb, BreadcrumbItem } from "@pgh/ui-bootstrap";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Search,
  ShoppingCart,
  Briefcase,
  Users,
  Shield,
  Settings,
} from "react-feather";
import "./breadcrumbs.scss"; // NEW SCSS

const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const buildAppPath = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  return `${PUBLIC_URL}${normalizedPath}` || "/";
};

// Mobile / segment mapping (icons only use FIRST segment)
export const routeNameMap = {
  planning: "Planning",
  audit: "Audit",
  procurement: "Procurement",
  compliance: "Compliance",
  human: "Human Resource",
  admin: "Administration",
  settings: "Settings",
};

export const routeIconMap = {
  planning: <Activity size={20} />,
  audit: <Search size={20} />,
  procurement: <ShoppingCart size={20} />,
  compliance: <Briefcase size={20} />,
  human: <Users size={20} />,
  admin: <Shield size={20} />,
  settings: <Settings size={20} />,
};

const SECTION_LABELS = {
  audit: "Audit",
  compliance: "Compliance",
  planning: "Planning",
  procurement: "Procurement",
  human: "Human Resource",
  admin: "Administration",
  settings: "Settings",
};

const SEGMENT_LABELS = {
  summary: "Summary",
  listaudit: "Audit List",
  timeline: "Timeline",
  calendar: "Calendar",
  businessplan: "Folder",
  aps: "Procurement List",
  resource: "Resource",
  training: "Training",
  "user-access": "User Access",
};

const EXACT_ROUTE_LABELS = {
  audit: "Audit Dashboard",
  "audit/summary": "Audit Summary",
  "audit/listaudit": "Audit List",
  "audit/timeline": "Audit Timeline",
  "audit/calendar": "Audit Calendar",
  compliance: "Compliance Dashboard",
  planning: "Planning Dashboard",
  "planning/businessplan": "Planning Folder",
  procurement: "Procurement Dashboard",
  "procurement/summary": "Procurement Summary",
  "procurement/aps": "Procurement List",
  human: "Human Dashboard",
  "human/summary": "Human Summary",
  "human/resource": "Human Resource",
  "human/training": "Human Training",
  admin: "Administration",
  "admin/user-access": "User Access",
  settings: "Settings",
};

const toReadableLabel = (segment = "") =>
  String(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const Breadcrumbs = () => {
  const location = useLocation();

  // Break URL into segments and remove "pgh"
  const pathnames = location.pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment.toLowerCase() !== "pgh");

  const fullRouteKey = pathnames.join("/").toLowerCase();
  const firstSegment = pathnames[0]?.toLowerCase();

  const labels = pathnames.map((segment, index) => {
    const routeKey = pathnames.slice(0, index + 1).join("/").toLowerCase();
    const normalizedSegment = segment.toLowerCase();

    if (index === pathnames.length - 1 && EXACT_ROUTE_LABELS[routeKey]) {
      return EXACT_ROUTE_LABELS[routeKey];
    }

    if (index === 0 && SECTION_LABELS[normalizedSegment]) {
      return SECTION_LABELS[normalizedSegment];
    }

    return SEGMENT_LABELS[normalizedSegment] || toReadableLabel(segment);
  });

  let pageTitle = "Home";
  if (EXACT_ROUTE_LABELS[fullRouteKey]) {
    pageTitle = EXACT_ROUTE_LABELS[fullRouteKey];
  } else if (labels.length === 1) {
    pageTitle = `${labels[0]} Dashboard`;
  } else if (labels.length > 1) {
    pageTitle = labels[labels.length - 1];
  }

  // MOBILE TITLE + ICON
  const mobileIcon = routeIconMap[firstSegment] || null;
  const mobileText = pageTitle;

  return (
    <div className="breadcrumbs-wrapper page-header">

      {/* MOBILE HEADER */}
      <div className="mobile-header">
        <div className="mobile-icon-wrapper">{mobileIcon}</div>
        <h2 className="mobile-title">{mobileText}</h2>
      </div>

      {/* DESKTOP HEADER */}
      <div className="desktop-header">
        <h1 className="desktop-title">{pageTitle}</h1>

        <Breadcrumb className="small desktop-breadcrumb">
          <BreadcrumbItem tag="span">
            <Link to={buildAppPath("/")}>Home</Link>
          </BreadcrumbItem>

          {pathnames.map((value, index) => {
            const to = buildAppPath(`/${pathnames.slice(0, index + 1).join("/")}`);
            const label = labels[index];

            return (
              <BreadcrumbItem
                key={to}
                active={index === pathnames.length - 1}
                tag={index === pathnames.length - 1 ? undefined : "span"}
              >
                {index === pathnames.length - 1 ? (
                  label
                ) : (
                  <Link to={to}>{label}</Link>
                )}
              </BreadcrumbItem>
            );
          })}
        </Breadcrumb>
      </div>

      <hr className="breadcrumbs-divider" />
    </div>
  );
};

export default Breadcrumbs;
