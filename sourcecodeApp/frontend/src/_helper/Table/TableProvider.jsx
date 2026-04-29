/*
 * PGH-DOC
 * File: src/_helper/Table/TableProvider.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { TableDataApi } from '../../api';
import Context from './index';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const TableProvider = (props) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        axios.get(TableDataApi).then(res => setData(res.data));
    }, [setData]);

    return (
        <Context.Provider
            value={{
                ...props,
                data
            }}
        >
            {props.children}
        </Context.Provider>
    );
};

export default TableProvider;