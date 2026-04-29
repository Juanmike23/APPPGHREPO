/*
 * PGH-DOC
 * File: src/CommonElements/ListGroup/UnorderedList.jsx
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
import ListItems from './ListItem';

const UL = (props) =>{
    return(
      <ul {...props.attrUL}>
        {props.listItem? props.listItem.map((item,i) => 
        <ListItems val={item} attrLI={props.attrLI} key={i}/> ):props.children}            
      </ul>
    );
};

export default UL;
