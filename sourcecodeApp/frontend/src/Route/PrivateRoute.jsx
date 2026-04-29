/*
 * PGH-DOC
 * File: src/Route/PrivateRoute.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur peta routing dan alur navigasi halaman.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import Loader from "../Layout/Loader";

const PrivateRoute = () => {
  const { user, loading } = useAuth();

  // still loading session → show loader
  if (loading) return <Loader />;

  // logged in → allow
  if (user) return <Outlet />;

  // not logged in → go to login
  return <Navigate to="/login" replace />;
};

export default PrivateRoute;
