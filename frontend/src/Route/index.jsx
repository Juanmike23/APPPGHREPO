/*
 * PGH-DOC
 * File: src/Route/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur peta routing dan alur navigasi halaman.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

/* eslint-disable no-unused-vars */
import React, { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Signin from "../Auth/Signin";
import { useAuth } from "../Auth/AuthContext";
import Loader from "../Layout/Loader";
import LayoutRoutes from "../Route/LayoutRoutes";
import { authRoutes } from "./AuthRoutes";
import PrivateRoute from "./PrivateRoute";
import RouteScrollTop from "./RouteScrollTop";

const Routers = () => {
  const { user, loading } = useAuth();

  return (
    <BrowserRouter basename="/">
      <RouteScrollTop />
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* PROTECTED ROUTES */}
          <Route element={<PrivateRoute />}>
            <Route path="/*" element={<LayoutRoutes />} />
          </Route>

          {/* PUBLIC LOGIN */}
          <Route
            path="/login"
            element={loading ? <Loader /> : user ? <Navigate to="/" replace /> : <Signin />}
          />

          {/* OTHER AUTH ROUTES */}
          {authRoutes.map(({ path, Component }, i) => (
            <Route key={i} path={path} element={Component} />
          ))}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default Routers;
