/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/SearchTabs.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useState } from 'react';
import { Activity, Briefcase, Users } from 'react-feather';
import { Nav, NavLink, NavItem } from '@pgh/ui-bootstrap';

const SearchTabs = ({ callbackActive }) => {
  const [activeTab, setActiveTab] = useState('1');
  return (
    <Fragment>
      <Nav tabs className="search-list" id="top-tab" role="tablist">
        <NavItem><NavLink className={activeTab === '1' ? 'active' : ''} onClick={() => {
          setActiveTab('1'); callbackActive('1');
        }}><Activity className="icon-target" />&nbsp;Planning</NavLink>
          <div className="material-border"></div>
        </NavItem>
        <NavItem><NavLink className={activeTab === '2' ? 'active' : ''} onClick={() => {
          setActiveTab('2'); callbackActive('2');
        }}><Briefcase className="icon-image" />&nbsp;Government</NavLink>
          <div className="material-border"></div>
        </NavItem>
        <NavItem><NavLink className={activeTab === '3' ? 'active' : ''} onClick={() => {
          setActiveTab('3'); callbackActive('3');
        }}><Users className="icon-video-clapper" />&nbsp;Human</NavLink>
          <div className="material-border"></div>
        </NavItem>
    
      </Nav>
    </Fragment>
  );
};
export default SearchTabs;
