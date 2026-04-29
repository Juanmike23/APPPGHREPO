/*
 * PGH-DOC
 * File: src/CommonElements/ListGroup/ListItem.jsx
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
import { Fragment } from 'react';

const LI = (props) =>{
   return (
     <Fragment>
       <li {...props.attrLI}>{props.val? <div dangerouslySetInnerHTML={{ __html:props.val }}/> :''} {props.children}</li>
     </Fragment>
      );
};

export default LI;
