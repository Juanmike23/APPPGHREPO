/*
 * PGH-DOC
 * File: src/_helper/Ecommerce/Wishlist/WishlistProvider.jsx
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
import Context from './index';

const WishListProvider = (props) => {
    const [wishlist, setWishList] = useState([]);

    useEffect(() => {
    }, [setWishList]);

    const addToWishList = (product) => {
        const productId = product.id;
        if (wishlist.findIndex((product) => product.id === productId) !== -1) {
            const wishlists = wishlist.reduce((wishAcc, product) => {
                if (product.id === productId) {
                    wishAcc.push({
                        ...product,
                    });
                } else {
                    wishAcc.push(product);
                }
                return wishAcc;
            }, []);
            return setWishList(wishlists);
        }

        setWishList((prev) => [...prev, { ...product }]);
    };

    const removeFromWhishList = (productId) => {
        setWishList(wishlist.filter((wish) => wish.id !== productId));
    };
    return (
        <Context.Provider
            value={{
                props,
                wishlist,
                addToWishList: addToWishList,
                removeFromWhishList: removeFromWhishList,
            }}
        >
            {props.children}
        </Context.Provider>
    );
};

export default WishListProvider;
