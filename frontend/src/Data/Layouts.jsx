/*
 * PGH-DOC
 * File: src/Data/Layouts.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import img4 from './../assets/images/user/4.jpg';
import img1 from './../assets/images/user/1.jpg';
import img2 from './../assets/images/user/2.jpg';

export const classes = [
  { Dubai: 'compact-wrapper' },
  { London: 'only-body' },
  { Seoul: 'compact-wrapper modern-type' },
  { LosAngeles: 'horizontal-wrapper material-type' },
  { Paris: 'compact-wrapper dark-sidebar' },
  { Tokyo: 'compact-sidebar' },
  { Madrid: 'compact-wrapper color-sidebar' },
  { Moscow: 'compact-sidebar compact-small' },
  { NewYork: 'compact-wrapper box-layout' },
  { Singapore: 'horizontal-wrapper enterprice-type' },
  { Rome: 'compact-sidebar compact-small material-icon' },
  { Barcelona: 'horizontal-wrapper enterprice-type advance-layout' }
];

export const messageData = [
  {
      id: 1,
      img: img4,
      name: 'Ain Chavez',
      mess: 'Do you want to go see movie?',
      time: '32 mins ago',
  },
  {
      id: 2,
      img: img1,
      name: 'Erica Hughes',
      mess: 'What`s the project report update?',
      time: '58 mins ago',
  },
  {
      id: 3,
      img: img2,
      name: 'Kori Thomas',
      mess: 'Thank you for rating us.',
      time: '1 hr ago',
  }
];