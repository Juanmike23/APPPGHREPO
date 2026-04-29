/*
 * PGH-DOC
 * File: src/Auth/AuthThemeToggleButton.jsx
 * Apa fungsi bagian ini:
 * - Tombol toggle dark/light untuk halaman autentikasi.
 * Kenapa perlu:
 * - Agar user bisa mengganti mode tema sebelum login tanpa masuk ke halaman utama.
 * Aturan khususnya apa:
 * - Gunakan style class auth yang konsisten dengan engine table.
 */

import React from "react";
import { Moon, Sun } from "react-feather";

const AuthThemeToggleButton = ({ isDarkMode, onToggle }) => {
  return (
    <button
      type="button"
      className="auth-theme-toggle"
      onClick={onToggle}
      aria-label={isDarkMode ? "Ubah ke Light Mode" : "Ubah ke Dark Mode"}
      title={isDarkMode ? "Light Mode" : "Dark Mode"}
    >
      {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
      <span>{isDarkMode ? "Light" : "Dark"}</span>
    </button>
  );
};

export default AuthThemeToggleButton;

