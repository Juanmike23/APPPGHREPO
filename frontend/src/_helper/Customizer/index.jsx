/*
 * PGH-DOC
 * File: src/_helper/Customizer/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { createContext, useState } from 'react';

const CheckContext = createContext();

export const CheckProvider = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = (value) => {
    setSidebarOpen(value);
  };

  return (
    <CheckContext.Provider value={{ sidebarOpen, toggleSidebar }}>
      {children}
    </CheckContext.Provider>
  );
};

export default CheckContext;