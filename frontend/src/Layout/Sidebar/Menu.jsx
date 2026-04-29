/*
 * PGH-DOC
 * File: src/Layout/Sidebar/Menu.jsx
 * Apa fungsi bagian ini:
 * - Mendefinisikan struktur menu sidebar utama aplikasi.
 * Kenapa perlu:
 * - Supaya navigasi lintas unit konsisten, ringkas, dan hanya menampilkan modul yang aktif dipakai.
 * Aturan khususnya apa:
 * - Hindari mengembalikan menu template bawaan (Ui Kits/Bonus Ui/dll) ke sidebar produksi.
 * - Untuk fitur baru, tambahkan hanya menu yang punya route dan data source aktif.
 */

import {
  Activity,
  Briefcase,
  Home,
  Search,
  ShoppingCart,
  UserCheck,
  Users,
} from "react-feather";

const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const HOME_PATH = PUBLIC_URL || "/";

export const MENUITEMS = [
  {
    menutitle: "Workspace",
    menucontent: "Home and administration",
    Items: [
      {
        path: HOME_PATH,
        title: "Home",
        icon: Home,
        type: "link",
        active: false,
      },
      {
        path: `${PUBLIC_URL}/admin/user-access`,
        title: "User Access",
        icon: UserCheck,
        type: "link",
        active: false,
      },
    ],
  },
  {
    menutitle: "Stream",
    menucontent: "Dashboards",
    Items: [
      {
        title: "Audit",
        icon: Search,
        type: "sub",
        active: false,
        children: [
          { path: `${PUBLIC_URL}/audit`, title: "Audit Dashboard", type: "link" },
          {
            path: `${PUBLIC_URL}/audit/summary`,
            title: "Audit Summary",
            type: "link",
          },
          { path: `${PUBLIC_URL}/audit/listAudit`, title: "Audit List", type: "link" },
          { path: `${PUBLIC_URL}/audit/calendar`, title: "Event Calendar", type: "link" },
        ],
      },
      {
        title: "Compliance",
        icon: Briefcase,
        type: "sub",
        active: false,
        children: [
          {
            path: `${PUBLIC_URL}/compliance`,
            title: "Compliance Dashboard",
            type: "link",
          },
        ],
      },
      {
        title: "Planning",
        icon: Activity,
        type: "sub",
        active: false,
        children: [
          { path: `${PUBLIC_URL}/Planning`, title: "Planning Dashboard", type: "link" },
          {
            path: `${PUBLIC_URL}/planning/businessPlan`,
            title: "Folder",
            type: "link",
          },
        ],
      },
      {
        title: "Procurement",
        icon: ShoppingCart,
        type: "sub",
        active: false,
        children: [
          {
            path: `${PUBLIC_URL}/procurement`,
            title: "Procurement Dashboard",
            type: "link",
          },
          {
            path: `${PUBLIC_URL}/procurement/summary`,
            title: "Procurement Summary",
            type: "link",
          },
          {
            path: `${PUBLIC_URL}/procurement/aps`,
            title: "Procurement List",
            type: "link",
          },
        ],
      },
      {
        title: "Human Resource",
        icon: Users,
        type: "sub",
        active: false,
        children: [
          { path: `${PUBLIC_URL}/human`, title: "Human Dashboard", type: "link" },
          { path: `${PUBLIC_URL}/human/summary`, title: "Human Summary", type: "link" },
          { path: `${PUBLIC_URL}/human/resource`, title: "Resource", type: "link" },
          { path: `${PUBLIC_URL}/human/training`, title: "Training", type: "link" },
        ],
      },
    ],
  },
];
