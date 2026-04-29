/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/ProcurementMetricCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@pgh/ui-bootstrap";
import CountUp from "react-countup";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import FeedbackState from "../../Common/FeedbackState";

const ProcurementMetricCard = ({
  icon,
  title,
  subtitle,
  apiUrl,
  extractData = (payload) => ({
    total: payload?.total ?? 0,
    subtitle: "",
    detail: "",
  }),
  navigateTo = null,
  blockedMessage = "",
  height = 280,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(Boolean(apiUrl));
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let active = true;

    if (!apiUrl) {
      setLoading(false);
      return undefined;
    }

    (async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(apiUrl, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        if (!active) {
          return;
        }

        setPayload(json);
      } catch (fetchError) {
        if (!active) {
          return;
        }

        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to load metric.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [apiUrl]);

  const metric = useMemo(() => extractData(payload || {}), [extractData, payload]);
  const canNavigate = Boolean(navigateTo);
  const canInteract = canNavigate || Boolean(blockedMessage);

  const handleNavigate = () => {
    if (canNavigate) {
      navigate(navigateTo);
      return;
    }

    if (blockedMessage) {
      toast.info(blockedMessage);
    }
  };

  const handleCardClick = () => {
    if (loading || error || !canInteract) {
      return;
    }

    handleNavigate();
  };

  return (
    <Card
      className={[
        "procurement-dashboard-panel",
        "procurement-dashboard-panel--metric",
        "income-card",
        "card-primary",
        "h-100",
        canInteract && !loading && !error
          ? "procurement-dashboard-panel--metric-clickable"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        minHeight: height,
        cursor: !loading && !error && canInteract ? "pointer" : "default",
      }}
      onClick={handleCardClick}
    >
      <CardBody className="procurement-dashboard-panel__body procurement-dashboard-panel__body--metric">
        <div className="procurement-dashboard-metric__ghost">{icon}</div>
        <div className="procurement-dashboard-metric__icon">{icon}</div>

        <div className="procurement-dashboard-panel__heading procurement-dashboard-panel__heading--center">
          <span className="procurement-dashboard-panel__eyebrow">Overview</span>
          <h5 className="procurement-dashboard-panel__title">{title}</h5>
          {subtitle ? (
            <p className="procurement-dashboard-panel__subtitle">{subtitle}</p>
          ) : null}
        </div>

        {loading ? (
          <FeedbackState
            variant="loading"
            title="Loading metric"
            description="Ringkasan procurement sedang dimuat."
            compact
          />
        ) : error ? (
          <FeedbackState
            variant="error"
            title="Failed to load metric"
            description={error}
            compact
          />
        ) : (
          <div className="procurement-dashboard-metric__content">
            <div className="procurement-dashboard-metric__value">
              <CountUp end={Number(metric.total ?? 0)} duration={1.2} separator="," />
            </div>
            {metric.subtitle ? (
              <div className="procurement-dashboard-metric__label">{metric.subtitle}</div>
            ) : null}
            {metric.detail ? (
              <div className="procurement-dashboard-metric__detail">{metric.detail}</div>
            ) : null}
          </div>
        )}

        <div className="procurement-dashboard-metric__actions">
          <button
            type="button"
            className="btn-arrow arrow-primary procurement-dashboard-panel__link procurement-dashboard-panel__link--audit"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleNavigate();
            }}
          >
            <i className="toprightarrow-primary fa fa-arrow-up me-2"></i>
            <span>See Detail</span>
          </button>
        </div>
      </CardBody>
    </Card>
  );
};

export default ProcurementMetricCard;
