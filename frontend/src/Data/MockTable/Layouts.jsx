/*
 * PGH-DOC
 * File: src/Data/MockTable/Layouts.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

  export const classes= [
    { Dubai:'compact-wrapper' },
    { London:'only-body' },
    { Seoul:'compact-wrapper modern-type' },
    { LosAngeles:'horizontal-wrapper material-type' },
    { Paris:'compact-wrapper dark-sidebar' },
    { Tokyo:'compact-sidebar' },
    { Madrid:'compact-wrapper color-sidebar' },
    { Moscow:'compact-sidebar compact-small' },
    { NewYork:'compact-wrapper box-layout' },
    { Singapore:'horizontal-wrapper enterprice-type' },
    { Rome:'compact-sidebar compact-small material-icon' },
    { Barcelona:'horizontal-wrapper enterprice-type advance-layout' }
];