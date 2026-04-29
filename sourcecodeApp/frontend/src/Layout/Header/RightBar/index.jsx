/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/index.jsx
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
import { useContext } from 'react';
import { Maximize } from 'react-feather';
import { LI, UL } from '../../../AbstractElements';
import CustomizerContext from '../../../_helper/Customizer';
import LogoutClass from './Logout';
import MoonLight from './MoonLight';

const Rightbar = () => {
    const { sidebarResponsive } = useContext(CustomizerContext);
    //full screen function
    function goFull() {
        if ((document.fullScreenElement && document.fullScreenElement !== null) ||
            (!document.mozFullScreen && !document.webkitIsFullScreen)) {
            if (document.documentElement.requestFullScreen) {
                document.documentElement.requestFullScreen();
            } else if (document.documentElement.mozRequestFullScreen) {
                document.documentElement.mozRequestFullScreen();
            } else if (document.documentElement.webkitRequestFullScreen) {
                document.documentElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        } else {
            if (document.cancelFullScreen) {
                document.cancelFullScreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitCancelFullScreen) {
                document.webkitCancelFullScreen();
            }
        }
    }

    return (
        <Fragment>
            <div className="nav-right col pull-right right-menu p-0">
                <UL attrUL={{ className: `simple-list d-flex flex-row nav-menus ${sidebarResponsive ? 'open' : ''}` }} >
                    <LI attrLI={{ className: "onhover-dropdown p-0 header-icon-item" }}>
                        <button
                            type="button"
                            className="header-icon-link header-icon-button"
                            onClick={goFull}
                            aria-label="Fullscreen"
                            title="Fullscreen"
                        >
                            <Maximize />
                        </button>
                    </LI>
                    {/* <LanguageClass /> */}
                    {/* <Bookmarks /> */}
                    <MoonLight />
                    {/* <MessageDrop /> */}
                    <LogoutClass />
                </UL>
            </div>
        </Fragment>
    );
};

export default Rightbar;
