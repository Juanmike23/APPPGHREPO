/*
 * PGH-DOC
 * File: src/Config/ThemeConfig.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

const ConfigDB = {
  settings: {
    layout_type: "ltr",
    sidebar: {
      type: "compact-wrapper",
    },
    sidebar_setting: "default-sidebar",
  },
  color: {
    primary_color: "#F15A22",
    // #26695c
    secondary_color: "#ba895d",
    mix_background_layout: "light-only",
  },
  router_animation: "fadeIn",
};
export default ConfigDB;
