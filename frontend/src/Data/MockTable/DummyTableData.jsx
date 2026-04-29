/*
 * PGH-DOC
 * File: src/Data/MockTable/DummyTableData.jsx
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

export const tableData = [
    {
        id:'1',
        name: 'Product Menu',
        status: <i className="fa fa-circle font-success f-12" />,
        creat_on:'2022-04-18T00:00:00'
    },
    {
        id:'2',
        name: 'Category Menu',
        status: <i className="fa fa-circle font-warning f-12" />,
        creat_on:'2022-04-18T00:00:00'
    },
    {
        id:'3',
        name: 'Subcategory Menu',
        status: <i className="fa fa-circle font-success f-12" />,
        creat_on:'2022-04-18T00:00:00'
    },
    {
        id:'4',
        name: 'Sales  Menu',
        status: <i className="fa fa-circle font-danger f-12" />,
        creat_on:'2022-04-18T00:00:00'
    },
    {
        id:'5',
        name: 'Vendor Menu',
        status: <i className="fa fa-circle font-success f-12" />,
        creat_on:'2022-04-18T00:00:00'
    },
    {
        id:'6',
        name: 'Category Menu',
        status: <i className="fa fa-circle font-warning f-12" />,
        creat_on:'2022-04-18T00:00:00'
    }
];





