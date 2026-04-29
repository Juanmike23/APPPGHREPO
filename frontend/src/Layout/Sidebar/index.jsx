/*
 * PGH-DOC
 * File: src/Layout/Sidebar/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useState, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import SidebarMenu from './SidebarMenu';
import CustomizerContext from '../../_helper/Customizer';
import Profile from './Profile';

const SideBarLayout = (props) => {
  const { toggleIcon, isMobileViewport, sidebarOpen, toggleSidebar } = useContext(CustomizerContext);
  const location = useLocation();
  const currentUrl = location.pathname;
  const id = currentUrl.split('/').pop();
  // eslint-disable-next-line
  const [leftArrow, setLeftArrow] = useState(false);
  const layout = id;
  const [width, setWidth] = useState(0);
  const handleResize = () => {
    setWidth(window.innerWidth - 500);
  };// eslint-disable-next-line
  const handleScroll = () => {
    if (window.scrollY > 400) {
      document.querySelector('.main-navbar').className =
        'main-navbar hovered';
    } else {
      if (document.getElementById('main-navbar'))
        document.querySelector('.main-navbar').className = 'main-navbar';
    }
  };

  useEffect(() => {
    setLeftArrow(true);
    window.addEventListener('resize', handleResize);
    handleResize();
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [layout, currentUrl]);

  useEffect(() => {
    const overlay = document.getElementById('bg-overlay1');
    const shouldActivateOverlay = Boolean(isMobileViewport && !sidebarOpen);
    if (overlay) {
      overlay.classList.toggle('active', shouldActivateOverlay);
    }
    document.body.classList.toggle('sidebar-mobile-open', shouldActivateOverlay);

    return () => {
      if (overlay) {
        overlay.classList.remove('active');
      }
      document.body.classList.remove('sidebar-mobile-open');
    };
  }, [isMobileViewport, sidebarOpen]);

  const closeOverlay = () => {
    if (isMobileViewport) {
      toggleSidebar(true);
    }
    document.getElementById('bg-overlay1')?.classList.remove('active');
    document.getElementById('nav-link')?.classList.remove('active');
    document.body.classList.remove('sidebar-mobile-open');
  };

  return (
    <Fragment>
      <div id="bg-overlay1" onClick={() => {
        closeOverlay();
      }} ></div>
      <header
        className={`main-nav ${toggleIcon ? 'close_icon' : ''}`}
      >
        <Profile />
        <SidebarMenu props={props} sidebartoogle={true} width={width} />
      </header>
    </Fragment>
  );
};
export default SideBarLayout;
