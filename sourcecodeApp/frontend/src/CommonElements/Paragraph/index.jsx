/*
 * PGH-DOC
 * File: src/CommonElements/Paragraph/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from 'react';

const P = (props) =>{
    return(
      <Fragment>
        {props.innerHtml ? <p dangerouslySetInnerHTML={{ __html:props.innerHtml }} />
       : ''}
        <p {...props.attrPara} >{props.children}</p>
      </Fragment>
    );
};

export default P;