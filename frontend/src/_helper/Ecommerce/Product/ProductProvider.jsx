/*
 * PGH-DOC
 * File: src/_helper/Ecommerce/Product/ProductProvider.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useState } from 'react';
import { ProductsApi } from '../../../api';
import Context from './index';
import axios from 'axios';


const ProductProvider = (props) => {
    const [productItem, setProductItem] = useState([]);
    const symbol = '$';

    const fetchProducts = async () => {
        try {
            await axios.get(ProductsApi).then((resp) => {
                setProductItem(resp.data);
            });
        } catch (error) {
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [setProductItem]);

    return (
        <Context.Provider value={{ ...props, productItem, symbol }}>
            {props.children}
        </Context.Provider>
    );
};

export default ProductProvider;
