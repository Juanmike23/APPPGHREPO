/*
 * PGH-DOC
 * File: src/Variables/CardDashboard.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@pgh/ui-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { P } from "../AbstractElements";
import CountUp from "react-countup";

const CardDashboard = ({
  icon,
  title = "Metric",
  linkLabel = "View Details",
  apiUrl,
  extractData = (data) => ({
    total: data?.total ?? 0,
    subInfo: data?.subInfo ?? "",
  }),
  navigateTo = "#",
  bgColor,
  variant = "primary",
  insertheight,
  valueFontSize = "1.4rem",
  blockedMessage = "",
  fallbackToTitle = true,
  wrapperClassName = "",
  cardClassName = "",
  bodyClassName = "",
  appearClassName = "",
  externalData,
  externalLoading = false,
  externalError = false,
}) => {
  const [fetchedData, setFetchedData] = useState({ total: 0, subInfo: "" });
  const usesExternalState =
    externalData !== undefined || externalLoading || externalError;
  const [loading, setLoading] = useState(!!apiUrl && !usesExternalState);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const cardClass = `income-card card-${variant} card-hover transition-all w-100`;
  const arrowClass = `btn-arrow arrow-${variant}`;
  const topArrowClass = `toprightarrow-${variant} fa fa-arrow-up me-2`;
  const canNavigate = Boolean(navigateTo && navigateTo !== "#");
  const canInteract = canNavigate || Boolean(blockedMessage);

  useEffect(() => {
    if (usesExternalState || !apiUrl) return;

    let active = true;

    setLoading(true);
    setError(false);

    const fetchData = async () => {
      try {
        const res = await fetch(`${apiUrl}`, {
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to fetch data");
        const json = await res.json();
        if (!active) return;
        setFetchedData(extractData(json));
      } catch (err) {
        if (!active) return;
        console.error("CardDashboard fetch error:", err);
        setError(true);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [apiUrl, extractData, usesExternalState]);

  const resolvedData = useMemo(() => {
    if (!usesExternalState) {
      return fetchedData;
    }

    try {
      return extractData(externalData ?? {});
    } catch (extractError) {
      console.error("CardDashboard external extract error:", extractError);
      return { total: 0, subInfo: "" };
    }
  }, [externalData, extractData, fetchedData, usesExternalState]);

  const resolvedLoading = usesExternalState ? externalLoading : loading;
  const resolvedError = usesExternalState ? Boolean(externalError) : error;

  useEffect(() => {
    if (!apiUrl) return;
    if (!usesExternalState) return;
    setLoading(false);
    setError(false);
  }, [apiUrl, usesExternalState]);

  const handleClick = () => {
    if (canNavigate) {
      navigate(navigateTo);
      return;
    }

    if (blockedMessage) {
      toast.info(blockedMessage);
    }
  };

  const { total, subInfo } = resolvedData;
  const isPending = resolvedLoading || resolvedError;
  const displaySubInfo = resolvedError
    ? "Failed to load data"
    : subInfo || (fallbackToTitle ? title : "");

  return (
    <div
      className={[
        "card-dashboard-wrapper",
        "audit-dashboard-card-wrapper",
        "dashboard-shared-card-wrapper",
        "w-100",
        wrapperClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Card
        className={[
          cardClass,
          "audit-dashboard-card",
          "audit-dashboard-card--metric",
          "dashboard-shared-card",
          "dashboard-shared-card--metric",
          appearClassName || "dashboard-shared-appear",
          cardClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          transition: "all 0.3s ease-in-out",
          position: "relative",
          overflow: "hidden",
          backgroundColor: bgColor || "",
          cursor: !isPending && canInteract ? "pointer" : "default",
          height: insertheight || "auto",
        }}
        onClick={isPending ? undefined : handleClick}
        onMouseEnter={(e) => {
          if (isPending) return;
          const card = e.currentTarget;
          const parrten = card.querySelector(".parrten");
          const roundBox = card.querySelector(".round-box");

          card.style.backgroundColor = "#3f435d";
          card.style.color = "#fff";

          card.querySelectorAll("h5, p, i").forEach((el) => {
            el.style.color = "#fff";
          });

          if (roundBox) roundBox.style.color = "#3d3261ff";

          if (parrten) {
            parrten.style.color = "#ffffff";
            parrten.style.transform = "scale(1.05)";
            parrten.style.transition = "all 0.3s ease-in-out";
          }
        }}
        onMouseLeave={(e) => {
          if (isPending) return;
          const card = e.currentTarget;
          const parrten = card.querySelector(".parrten");
          const roundBox = card.querySelector(".round-box");

          card.style.backgroundColor = bgColor || "";
          card.style.color = "";

          card.querySelectorAll("h5, p, i").forEach((el) => {
            el.style.color = "";
          });

          if (roundBox) roundBox.style.color = "";

          if (parrten) {
            parrten.style.color = "rgba(63, 67, 93, 0.15)";
            parrten.style.transform = "scale(1)";
          }
        }}
      >
        <CardBody
          className={[
            "dashboard-shared-card__body",
            "text-center",
            "d-flex",
            "flex-column",
            "justify-content-center",
            "align-items-center",
            bodyClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ position: "relative", zIndex: 1, height: "100%" }}
        >
          <div className="round-box">{icon}</div>

          {resolvedLoading ? (
            <div className="dashboard-shared-placeholder dashboard-shared-placeholder--metric">
              <span className="dashboard-shared-placeholder__line dashboard-shared-placeholder__line--strong" />
              <span className="dashboard-shared-placeholder__line" />
            </div>
          ) : (
            <>
              <CountUp
                end={total}
                duration={1.5}
                separator=","
                className="fw-bold"
                style={{
                  fontSize: valueFontSize,
                  marginTop: "-4px",
                  marginBottom: "4px",
                  display: "inline-block",
                }}
              />
              {displaySubInfo ? <P>{displaySubInfo}</P> : null}
            </>
          )}

          <div
            className="parrten"
            style={{
              position: "absolute",
              fontSize: "60px",
              color: "rgba(63, 67, 93, 0.15)",
              pointerEvents: "none",
              transition: "all 0.3s ease-in-out",
            }}
          >
            {icon}
          </div>

          {!resolvedLoading ? (
            <Link
              className={arrowClass}
              to={canNavigate ? navigateTo : "#"}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleClick();
              }}
            >
              <i className={topArrowClass}></i>
              {resolvedError ? "Try Again Later" : linkLabel}
            </Link>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
};

export default CardDashboard;
