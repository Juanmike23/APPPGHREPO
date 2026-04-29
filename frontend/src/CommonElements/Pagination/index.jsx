/*
 * PGH-DOC
 * File: src/CommonElements/Pagination/index.jsx
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
import { Pagination, PaginationItem, PaginationLink } from '@pgh/ui-bootstrap';

const PaginationClass = (props) => {
    return (
        <Fragment>
            <Pagination {...props.attrPagination}>
                <PaginationItem>
                    <PaginationLink href="#javascript">{props.children}</PaginationLink>
                </PaginationItem>
            </Pagination>
        </Fragment>
    );
};

export default PaginationClass;