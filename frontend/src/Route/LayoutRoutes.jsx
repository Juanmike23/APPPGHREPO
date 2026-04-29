/*
 * PGH-DOC
 * File: src/Route/LayoutRoutes.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur peta routing dan alur navigasi halaman.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { routes } from './Routes';
import AppLayout from '../Layout/Layout';
import { useAuth } from '../Auth/AuthContext';
import { getDefaultAuthorizedPath, getPathAccess } from '../Auth/accessControl';

const AuthorizedRoute = ({ path, element }) => {
  const { user } = useAuth();
  const { allowed, redirectTo } = getPathAccess(user, path);

  if (!allowed) {
    return <Navigate to={redirectTo || getDefaultAuthorizedPath(user)} replace />;
  }

  return element;
};

const LayoutRoutes = () => {
  return (
    <>
      <Routes>
        {routes.map(({ path, Component }, i) => (
          <Route element={<AppLayout />} key={i}>
            <Route
              path={path}
              element={<AuthorizedRoute path={path} element={Component} />}
            />
          </Route>
        ))}
      </Routes>
    </>
  );
};

export default LayoutRoutes;
