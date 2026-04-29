/*
 * PGH-DOC
 * File: src/Layout/Header/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

/* eslint-disable react-hooks/exhaustive-deps */
import React, { Fragment, useState, useEffect, useRef } from 'react';
import Leftbar from './LeftBar';
import Rightbar from './RightBar';
import { Row } from '@pgh/ui-bootstrap';
import { useContext } from 'react';
import CustomizerContext from '../../_helper/Customizer';

const Header = () => {
    const [sidebartoogle, setSidebartoogle] = useState(true);
    const { toggleIcon, toggleSidebar, isMobileViewport } = useContext(CustomizerContext);
    const headerRef = useRef(null);

    useEffect(() => {
        toggleSidebar(Boolean(isMobileViewport));
    }, [isMobileViewport, toggleSidebar]);

    useEffect(() => {
        const syncHeaderHeight = () => {
            const measuredHeight = headerRef.current?.getBoundingClientRect?.().height;
            const safeHeight = Number.isFinite(measuredHeight) && measuredHeight > 0 ? measuredHeight : 82;
            document.documentElement.style.setProperty("--pgh-header-height", `${Math.round(safeHeight)}px`);
        };

        syncHeaderHeight();

        let resizeObserver = null;
        if (typeof window !== "undefined" && typeof window.ResizeObserver !== "undefined" && headerRef.current) {
            resizeObserver = new window.ResizeObserver(() => {
                syncHeaderHeight();
            });
            resizeObserver.observe(headerRef.current);
        }

        window.addEventListener("resize", syncHeaderHeight);

        return () => {
            window.removeEventListener("resize", syncHeaderHeight);
            resizeObserver?.disconnect?.();
        };
    }, []);
    return (
        <Fragment>
            <div ref={headerRef} className={`page-main-header ${toggleIcon ? 'close_icon' : ''}`}>
                <Row className="main-header-right m-0">
                    <Leftbar sidebartoogle={sidebartoogle} setSidebartoogle={setSidebartoogle} />
                    {/* <Searchbar /> */}
                    <Rightbar />
                </Row>
            </div>

        </Fragment >
    );
};

export default Header;
