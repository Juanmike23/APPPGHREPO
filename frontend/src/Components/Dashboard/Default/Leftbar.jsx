/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/Leftbar.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// import React, { useState, useContext } from 'react';
// import { AlignCenter } from 'react-feather';
// import CheckContext from '../../../_helper/Customizer';

// const Leftbar = () => {
//   const { toggleSidebar } = useContext(CheckContext);
//   const [isOpen, setIsOpen] = useState(true); // initial state open/closed

//   const openCloseSidebar = () => {
//     setIsOpen(prev => {
//       const newState = !prev;
//       toggleSidebar(newState); // update global context
//       return newState;
//     });
//   };

//   return (
//     <div className={`main-header-left ${isOpen ? "open" : "closed"}`}>
//       <div className="toggle-sidebar" onClick={openCloseSidebar}>
//         <AlignCenter className="status_toggle middle" id="sidebar-toggle" />
//       </div>
//     </div>
//   );
// };

// export default Leftbar;