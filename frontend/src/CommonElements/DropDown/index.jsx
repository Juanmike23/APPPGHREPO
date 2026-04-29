/*
 * PGH-DOC
 * File: src/CommonElements/DropDown/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from 'react';
import { Dropdown, DropdownItem, DropdownMenu } from '@pgh/ui-bootstrap';
import Btn from '../Button';

const Dropdowns = (props) =>(
  <Dropdown {...props.attrDropDown}>
    <Btn attrBtn={props.attrDropBtn} ><div dangerouslySetInnerHTML={{ __html:props.dropBtnContent }} /></Btn>
    <DropdownMenu {...props.attrDropMenu}>
      {props.dropItem.map((item,i) => 
        <DropdownItem {...props.attrDropItem} key={i}>{item.item}</DropdownItem>
      )}
    </DropdownMenu>
  </Dropdown>
);

export default Dropdowns;