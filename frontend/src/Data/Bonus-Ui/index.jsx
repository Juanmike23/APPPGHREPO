/*
 * PGH-DOC
 * File: src/Data/Bonus-Ui/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const TreeViewData = {
  name: "",
  children: [
    {
      name: "root",
      children: [
        {
          name: "Applications",
          children: [{ name: "Ecommerce" }, { name: "Users" }, { name: "Chat" }],
        },
        {
          name: "Components",
          children: [{ name: "UI-Kits" }, { name: "Bonus-UI" }, { name: "Charts" }],
        },
        {
          name: "Miscellaneous",
          children: [{ name: "Gallery" }, { name: "Blog" }, { name: "Editors" }],
        },
      ],
    },
  ],
};
