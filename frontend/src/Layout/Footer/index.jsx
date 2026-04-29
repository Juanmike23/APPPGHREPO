/*
 * PGH-DOC
 * File: src/Layout/Footer/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useContext, useMemo } from "react";
import { Container, Row, Col } from "@pgh/ui-bootstrap";
import { Footer, P } from "../../AbstractElements";
import { useLocation } from "react-router-dom";
import CustomizerContext from "../../_helper/Customizer";

const APP_COPYRIGHT_TEXT = "Copyright (c) 2025-2026 Alvin & Juan. All rights reserved.";
const APP_FOOTER_META_TEXT = (
  <>
    Made with <i className="fa fa-heart font-secondary"></i>
  </>
);

const FooterClass = () => {
  const { toggleIcon, effectiveSidebarType, effectiveSidebarSetting } =
    useContext(CustomizerContext);
  const location = useLocation();
  const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
  const normalizedPath = String(location.pathname || "/").replace(/\/+$/, "") || "/";
  const loginPath = `${publicUrl}/login`.replace(/\/+$/, "") || "/login";
  const hideFooter = normalizedPath === "/viho" || normalizedPath === loginPath;
  const sidebarType = effectiveSidebarType;
  const sidebarSetting = effectiveSidebarSetting;
  const isHorizontalLayout = String(sidebarType || "").includes("horizontal-wrapper");
  const isCompactSidebar = String(sidebarSetting || "").includes("compact-sidebar");

  const footerOffset = useMemo(() => {
    if (toggleIcon || isHorizontalLayout) return 0;
    return isCompactSidebar ? 150 : 290;
  }, [isCompactSidebar, isHorizontalLayout, toggleIcon]);

  const className = "app-global-footer page-main-footer";

  const footerStyle = useMemo(
    () => ({
      position: "relative",
      width: "100%",
      minWidth: "100%",
      maxWidth: "100%",
      marginLeft: 0,
      marginRight: 0,
      left: 0,
      right: 0,
      transform: "none",
      boxSizing: "border-box",
      borderRadius: 0,
    }),
    [],
  );

  const containerStyle = useMemo(
    () => ({
      paddingLeft: `calc(1.25rem + ${footerOffset}px)`,
      paddingRight: "1.25rem",
      transition: "padding-left 0.3s ease",
    }),
    [footerOffset],
  );

  if (hideFooter) return null;

  return (
    <Fragment>
      <Footer attrFooter={{ className, style: footerStyle }}>
        <Container fluid style={containerStyle}>
          <Row className="g-2">
            <Col md="6" className="footer-copyright">
              <P attrPara={{ className: "mb-0" }}>{APP_COPYRIGHT_TEXT}</P>
            </Col>
            <Col md="6" className="d-flex justify-content-end">
              <P attrPara={{ className: "pull-right mb-0" }}>
                {APP_FOOTER_META_TEXT}
              </P>
            </Col>
          </Row>
        </Container>
      </Footer>
    </Fragment>
  );
};

export default FooterClass;
