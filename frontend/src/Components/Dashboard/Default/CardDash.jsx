/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/CardDash.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useState, useMemo } from "react";
import { Card } from "@pgh/ui-bootstrap";
import CountUp from "react-countup";

import { useNavigate } from "react-router-dom";

const HomeCard = ({
  icon = null,
  values = [],
  navigateTo = null,
  pill = false,
}) => {
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);

  const getDecimals = (value) => {
    if (value == null) return 0;
    const str = value.toString();
    return str.includes(".") ? str.split(".")[1].length : 0;
  };

  const labelWidth = useMemo(() => {
    const labels = values.filter((v) => v?.label).map((v) => v.label);
    if (labels.length === 0) return 0;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = "14px Arial";

    return Math.max(...labels.map((l) => ctx.measureText(l).width)) + 10;
  }, [values]);

  return (
    <Card
      className="transition-all mb-2"
      style={{
        margin: 0, // 🔥 REMOVE ALL CARD GAP
        transition: "all 0.3s ease-in-out",
        position: "relative",
        cursor: "pointer",
        overflow: "hidden",
        backgroundColor: hover ? "#f1f1f1ff" : "white",
        color: hover ? "black" : "#74797dff",
        width: "auto",
        height: "auto",
        display: "inline-block",
      }}
      onClick={() => {
        // toggleSidebar(true); 
        navigateTo && navigate(navigateTo);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="small fw-bold"
        style={{
          padding: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          width: "auto",
          height: "auto",
          boxSizing: "border-box",
          whiteSpace: "normal",
        }}
      >
        {icon && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginRight: "0px", // pastikan tanpa space kanan
              paddingRight: "0px",
            }}
          >
            {React.cloneElement(icon, {
              size: hover ? 28 : 24,
              style: {
                transition: "all 0.25s ease",
                transform: hover
                  ? "rotate(-25deg) scale(1.15)"
                  : "rotate(0deg) scale(1)",
                color: hover ? "#F15A22" : "#979a9cff",
                ...icon.props.style,
              },
            })}
          </div>
        )}

        <div>
          {values
            .filter((v) => v?.number != null)
            .map((v, index) => {
              const isNegative = Number(v.number) < 0;
              const showArrow = v?.showArrow === true;
              const showPercent = v?.showPercent === true; // 🔥 NEW FLAG
              const showSeperator = v?.showSeperator === true; // 🔥 NEW FLAG

              return (
                <div key={index} className={`d-flex`}>
                  <div style={{ width: labelWidth, opacity: hover ? 1 : 0.7 }}>
                    {v.label}
                  </div>

                  {showSeperator && (
                    <div style={{ width: "10px", opacity: hover ? 1 : 0.7 }}>
                      :
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0px",
                      opacity: hover ? 1 : 0.7,
                    }}
                  >
                    {showArrow && (
                      <i
                        className={`fa   me-1 ${
                          isNegative
                            ? "fa-angle-down text-danger"
                            : "fa-angle-up text-success"
                        }`}
                        style={{
                          fontSize: "0.9rem",
                          marginLeft: "0px",
                          marginRight: "0px",
                        }}
                      ></i>
                    )}
                    {pill ? (
                      <span
                        className="badge  bg-light rounded-pill"
                        style={{ fontSize: 11, color: "rgb(59, 62, 64)" }} // 👈 FIX
                      >
                        <CountUp
                          end={Number(v.number)}
                          duration={1.2}
                          decimals={getDecimals(v.number)}
                          separator=""
                        />
                      </span>
                    ) : (
                      <CountUp
                        end={Number(v.number)}
                        duration={1.2}
                        decimals={getDecimals(v.number)}
                        separator=""
                      />
                    )}

                    {showPercent && "%"}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </Card>
  );
};

export default HomeCard;
