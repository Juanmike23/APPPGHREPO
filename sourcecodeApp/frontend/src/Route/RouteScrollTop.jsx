/*
 * PGH-DOC
 * File: src/Route/RouteScrollTop.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur peta routing dan alur navigasi halaman.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const RouteScrollTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    // Guard against stale Bootstrap modal/body scrollbar compensation
    // that can leave a right-side gap after route transitions.
    if (document?.body) {
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("padding-right");
      document.body.style.removeProperty("overflow");
    }
    if (document?.documentElement) {
      document.documentElement.style.removeProperty("padding-right");
      document.documentElement.style.removeProperty("overflow");
    }
  }, [location.pathname]);

  return null;
};

export default RouteScrollTop;
