/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/Bookmark/EmptyClass.jsx
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

const EmpltyClass = ({ searchIcon, search }) => {
    return (
        <Fragment>
            <div className={`${search ? `Typeahead-menu empty-menu ${searchIcon ? 'is-open' : ''}` : `Typeahead-menu empty-bookmark ${searchIcon ? 'is-open' : ''}`} `}>
                <div className="tt-dataset tt-dataset-0">
                    <div className="EmptyMessage">
                        {'Opps!! There are no result found.'}
                    </div>
                </div>
            </div>
        </Fragment>
    );
};

export default EmpltyClass;