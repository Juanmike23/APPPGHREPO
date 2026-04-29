/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/Planing.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useState } from "react";
import { Col, Row } from "@pgh/ui-bootstrap";
import { Link } from "react-router-dom";
import { Activity, ShoppingCart } from "react-feather";
import RenderHome from "./RenderHome";
import TabPills from "./TabPills";
import CardDash from "./CardDash";
import PlanningImg from "./image/planing.PNG";
import BusinessPlanImg from "./image/businessplan.PNG";
import NewImg from "./image/new.PNG";

const fetchJsonWithAuth = async (url, options = {}) => {
  const response = await fetch(url, { credentials: "include", ...options });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};

const extractNewProcurementTotal = (data) => {
  if (Array.isArray(data?.Labels) && Array.isArray(data?.Values)) {
    const newIndex = data.Labels.indexOf("New");
    return newIndex !== -1 ? data.Values[newIndex] || 0 : 0;
  }

  if (typeof data?.New === "number") {
    return data.New;
  }

  if (Array.isArray(data)) {
    const match = data.find(
      (item) =>
        item?.Value === "New" ||
        item?.value === "New" ||
        item?.Label === "New" ||
        item?.label === "New" ||
        item?.Name === "New" ||
        item?.name === "New",
    );

    return match?.Count ?? match?.count ?? match?.Total ?? match?.total ?? 0;
  }

  return 0;
};

const Planning = ({ activeTab, setActiveTab }) => {
  const [opexAvg, setOpexAvg] = useState(null);
  const [opexGrowth, setOpexGrowth] = useState(null);
  const [newProcurementTotal, setNewProcurementTotal] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const apiRoot = String(process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

    const loadOpexCard = async () => {
      try {
        const summary = await fetchJsonWithAuth(
          `${apiRoot}/opex/home-summary`,
          { signal: controller.signal },
        );

        setOpexAvg(summary?.runRatePct ?? null);
        setOpexGrowth(summary?.growthPct ?? null);
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        setOpexAvg(null);
        setOpexGrowth(null);
      }
    };

    loadOpexCard();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    fetchJsonWithAuth(`${process.env.REACT_APP_API_BASE_URL}apschart/chart/duedue?months=1`)
      .then((data) => {
        setNewProcurementTotal(extractNewProcurementTotal(data));
      })
      .catch(() => {
        setNewProcurementTotal(0);
      });
  }, []);

  return (
    <RenderHome
      title="Planning"
      pic="Rifan & Lamora"
      description={
        <Fragment>
          Planning is not just about numbers. Manage <strong>Opex</strong>,
          keep your <strong>Folder</strong> structure tidy,
          and streamline <strong>New Procurement</strong> decisions in one place.
        </Fragment>
      }
      tabs={<TabPills activeTab={activeTab} setActiveTab={setActiveTab} />}
      childrenRight={
        <Fragment>
          <Row>
            <Col md="6" className="d-flex justify-content-center align-items-center">
              <Link to={`${process.env.PUBLIC_URL}/planning`} className="overlay-wrapper">
                <img src={PlanningImg} alt="Opex" />
                <div className="overlay"></div>
                <div className="overlay-text">OPEX</div>
              </Link>
            </Col>

            <Col md="6" className="d-flex justify-content-center align-items-center">
              <Link
                to={`${process.env.PUBLIC_URL}/planning/businessPlan`}
                className="overlay-wrapper"
              >
                <img src={BusinessPlanImg} alt="Folder" />
                <div className="overlay"></div>
                <div className="overlay-text">Folder</div>
              </Link>
            </Col>
          </Row>

          <div className="d-flex gap-3 w-75 mt-3">
            <Col className="d-flex flex-column align-items-end gap-2 p-0">
              <CardDash
                values={[
                  {
                    label: "Opex",
                    number: opexAvg != null ? opexAvg : "-",
                    showPercent: true,
                    showSeperator: true,
                  },
                  {
                    label: "Growth",
                    number: opexGrowth != null ? opexGrowth : "-",
                    showArrow: true,
                    showPercent: true,
                    showSeperator: true,
                  },
                ]}
                navigateTo={`${process.env.PUBLIC_URL}/Planning`}
                icon={<Activity />}
              />
            </Col>

            <Col>
              <Link to={`${process.env.PUBLIC_URL}/Procurement`} className="overlay-wrapper mb-2">
                <img src={NewImg} alt="New Procurement" />
                <div className="overlay"></div>
                <div className="overlay-text">New Procurement</div>
              </Link>

              <CardDash
                pill={true}
                values={[
                  {
                    label: (
                      <Fragment>
                        New Procurement <br />
                        <span className="text-muted small">ends in 1 month</span>
                      </Fragment>
                    ),
                    number: newProcurementTotal,
                  },
                ]}
                navigateTo={`${process.env.PUBLIC_URL}/procurement/aps?tab=new`}
                icon={<ShoppingCart />}
              />
            </Col>
          </div>
        </Fragment>
      }
    />
  );
};

export default Planning;
