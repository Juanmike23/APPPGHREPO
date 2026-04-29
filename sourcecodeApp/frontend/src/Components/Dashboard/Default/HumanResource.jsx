/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/HumanResource.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useState } from "react";
import { Col } from "@pgh/ui-bootstrap";
import { AlertTriangle, Users } from "react-feather";
import RenderHome from "./RenderHome";
import TabPills from "./TabPills";
import CardDash from "./CardDash";
import humanimg from "./image/human.PNG";
import trainingimg from "./image/training.PNG";

const Human = ({ activeTab, setActiveTab }) => {
  const [humanData, setHumanData] = useState({
    FTE: 0,
    NonFTE: 0,
    Gap: 0,
  });

  useEffect(() => {
    const fetchHumanData = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}charthuman/overview`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        setHumanData({
          FTE: data?.FTE ?? 0,
          NonFTE: data?.NonFTE ?? 0,
          Gap: data?.TotalGap ?? 0,
        });
      } catch (err) {
        console.error("Human fetch failed:", err);
        setHumanData({ FTE: 0, NonFTE: 0, Gap: 0 });
      }
    };

    fetchHumanData();
  }, []);

  return (
    <RenderHome
      title="Human"
      pic="Debora"
      description={
        <>
          Human is not just about processes. Manage <strong>Non-FTE</strong>,
          <strong> FTE</strong>, manpower planning, and <strong>training proposals</strong>
          in one workspace.
        </>
      }
      tabs={<TabPills activeTab={activeTab} setActiveTab={setActiveTab} />}
      images={[
        {
          src: humanimg,
          label: "Resource",
          to: `${process.env.PUBLIC_URL}/human/resource`,
        },
        {
          src: trainingimg,
          label: "Training",
          to: `${process.env.PUBLIC_URL}/human/training`,
        },
      ]}
      widgets={[
        <Col className="d-flex flex-column align-items-end gap-2 p-0">
          <CardDash
            pill={true}
            values={[
              { label: "FTE", number: humanData.FTE },
              { label: "Non-FTE", number: humanData.NonFTE },
            ]}
            navigateTo={`${process.env.PUBLIC_URL}/human/resource?tab=fte`}
            icon={<Users />}
          />

          <CardDash
            pill={true}
            values={[{ label: "Gap", number: humanData.Gap }]}
            navigateTo={`${process.env.PUBLIC_URL}/human/resource?tab=kebutuhanfte`}
            icon={<AlertTriangle />}
          />
        </Col>,

      ]}
    />
  );
};

export default Human;
