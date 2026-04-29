/*
 * PGH-DOC
 * File: src/CommonElements/Alert/index.jsx
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
import { Alert } from '@pgh/ui-bootstrap';
import Btn from '../Button';

const Alerts = (props) => {
  return (
    <Alert {...props.attrAlert} >
      {props.children}
      {props.closeBtn ? <Btn attrBtn={props.attrBtn} >
        <div className={props.divCls} dangerouslySetInnerHTML={{ __html: props.btnContent }} /></Btn> : ''}
    </Alert>
  );
};

export default Alerts;