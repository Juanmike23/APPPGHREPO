/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/Bookmark/ListOfMenu.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useContext } from 'react';
import { Link } from 'react-router-dom';
import CustomContext from '../../../../_helper/Customizer';

const ListOfMenu = ({ searchToggle, searchBar, searchValue, removeFix, setBookmarkItems, bookmarkItems, searchResult }) => {
    const { IsOpen } = useContext(CustomContext);
    const addToBookmark = (event, items) => {
        const index = bookmarkItems.indexOf(items);
        if (index === -1 && !items.bookmark) {
            items.bookmark = true;
            event.currentTarget.classList.add('starred');
            setBookmarkItems([...bookmarkItems, items]);
        } else {
            event.currentTarget.classList.remove('starred');
            bookmarkItems.splice(index, 1);
            setBookmarkItems(bookmarkItems);
            items.bookmark = false;
        }
    };
    return (
        <Fragment>
            <div className={`${searchBar ? `Typeahead-menu custom-scrollbar ${searchToggle ? 'is-open' : ''}` : `filled-bookmark Typeahead-menu ${IsOpen ? ' is-open' : ''} custom-scrollbar`} `} id="search-outer">
                {searchValue &&
                    searchResult.map((data, index) => {
                        return (
                            <div className="ProfileCard u-cf" key={index}>
                                <div className="ProfileCard-avatar">
                                    <data.icon />
                                </div>
                                <div className="ProfileCard-details">
                                    <div className="ProfileCard-realName">
                                        <Link
                                            to={data.path}
                                            className="realname"
                                            onClick={removeFix}
                                        >
                                            {data.title}
                                        </Link>
                                        {searchBar ? ''
                                            : <span className="pull-right">
                                                <a href="#javascript">
                                                    <i className="fa fa-star-o mt-1 icon-star" onClick={(e) => addToBookmark(e, data)}></i>
                                                </a>
                                            </span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </Fragment>
    );
};

export default ListOfMenu;