/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/Bookmark/RemoveBookmark.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from 'react';
import { H6, LI, UL } from '../../../../AbstractElements';
import { Bookmark } from '../../../../Constant';
import BookmarkList from './BookmarkList';

const RemoveBookmark = ({ bookmarkItems }) => {
    return (
        <Fragment>
            <div className="front">
                <UL attrUL={{ className: 'simple-list droplet-dropdown bookmark-dropdown' }}>
                    <LI attrLI={{ className: 'p-0' }}>
                        <H6 attrH6={{ className: 'f-18 mb-0' }}>{Bookmark}</H6>
                    </LI>
                    <BookmarkList bookmarkItems={bookmarkItems} />
                </UL>
            </div>
        </Fragment>
    );
};
export default RemoveBookmark;