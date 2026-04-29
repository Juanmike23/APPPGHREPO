/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/RenderHome.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// 📁 RenderHome.jsx
import React, { Fragment } from "react";
import { Row, Col } from "@pgh/ui-bootstrap";
import { Link } from "react-router-dom";

const RenderHome = ({
  title,
  pic,
  description,
  tabs,
  images = [],
  widgets = [],
  childrenRight,
}) => {
  return (
    <Fragment>
      <style>{`
        .overlay-wrapper {
          position: relative;
          display: block;
          width: 100%;
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .overlay-wrapper img {
          width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }
        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.5);
          transition: 0.4s ease;
        }
        .overlay-wrapper:hover .overlay {
          background: rgba(0,0,0,0);
        }
        .overlay-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #fff;
          font-weight: 600;
          font-size: 1.25rem;
          pointer-events: none;
        }
      `}</style>

      <div style={{ minHeight: "73vh" }}>
        <Row className="h-100">

          {/* LEFT SIDE */}
          <Col
            md="6"
            className="d-flex flex-column justify-content-center py-5"
            style={{ minHeight: "73vh" }}
          >
            {tabs}
            <h1 className="fw-bold display-5 mb-0">{title}</h1>
            <h5 className="small text-dark mb-3">PIC: {pic}</h5>
            <p className="text-muted mb-4">{description}</p>
            <p className="text-muted small">-</p>
          </Col>

          {/* RIGHT SIDE */}
          <Col
            md="6"
            className="d-flex justify-content-center align-items-center flex-column gap-3 position-relative"
            style={{ minHeight: "73vh" }}
          >
            {/* Background Circle */}
            <div
              className="rounded-circle position-absolute"
              style={{
                width: 500,
                height: 500,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 0,
                opacity: 0.25,
                background: "rgba(241, 90, 34, 0.35)",
              }}
            />

            {/* Foreground */}
            <div style={{ zIndex: 1, width: "100%" }}>
              {childrenRight ? (
                childrenRight
              ) : (
                <>
                  {/* Image Buttons */}
                  <Row>
                    {images.map((img, i) => (
                      <Col
                        md="6"
                        key={i}
                        className="d-flex align-items-center justify-content-center"
                      >
                        <Link to={img.to} className="overlay-wrapper">
                          <img src={img.src} alt={img.label} />
                          <div className="overlay" />
                          <div className="overlay-text">{img.label}</div>
                        </Link>
                      </Col>
                    ))}
                  </Row>

                  {/* Widgets */}
                  <div className="d-flex gap-3 w-75 mt-3">
                    {widgets.map((w, i) => (
                      <div key={i} className="flex-fill">
                        {w}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Col>
        </Row>
      </div>
    </Fragment>
  );
};

export default RenderHome;
