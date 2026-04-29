/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/Bookmark/BookmarkList.jsx
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
import { Link } from 'react-router-dom';
import { Col, Row } from '@pgh/ui-bootstrap';
import { Btn, LI } from '../../../../AbstractElements';
import { AddNewBookmark } from '../../../../Constant';

const BookmarkList = (props) => {
    const { bookmarkItems = '' } = props;
    const addnewbookmark = () => {
        document.querySelector('.flip-card-inner').classList.add('flipped');
    };

    return (
        <Fragment>
            <LI attrLI={{ className: 'custom-scrollbar' }}>
                <Row>
                    {bookmarkItems.map((items, index) => {
                        return (
                            <Col xs="4" className="text-center" key={index}>
                                <Link to={items.path || '/'}>
                                    <items.icon id={`${items[index]}`} />
                                </Link>
                            </Col>
                        );
                    })}
                </Row>
            </LI>
            <LI attrLI={{ className: 'text-center' }}>
                <Btn attrBtn={{ className: 'flip-btn', onClick: addnewbookmark }}>{AddNewBookmark}</Btn>
            </LI>
        </Fragment>
    );
};
export default BookmarkList;