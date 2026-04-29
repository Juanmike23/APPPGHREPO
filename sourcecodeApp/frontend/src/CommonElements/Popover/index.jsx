/*
 * PGH-DOC
 * File: src/CommonElements/Popover/index.jsx
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
import { Popover, PopoverBody, PopoverHeader } from '@pgh/ui-bootstrap';

const Popovers = (props) =>(
  <Popover
        placement={props.placement}
        isOpen={props.isOpen}
        target={props.target}
        toggle={props.toggle}
        trigger={props.trigger}
        >
    {props.title ? <PopoverHeader>{props.title}</PopoverHeader> :''}
    <PopoverBody>
      {props.children}
    </PopoverBody>
  </Popover>
);


export default Popovers;