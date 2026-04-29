/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/Government.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// 📁 Government.jsx (2x2 clean grid)
import React, { useState } from "react";
import { Link } from "react-router-dom";

import RenderHome from "./RenderHome";
import TabPills from "./TabPills";
import CardDash from "./CardDash";

import existimg from "./image/existing.PNG";
import eventsimg from "./image/events.PNG";
import auditimg from "./image/timeline.PNG";

import { FileText, Calendar } from "react-feather";

const Government = ({ activeTab, setActiveTab }) => {
  const [existingTotal] = useState(0);
  const [auditToday] = useState(16);

  // useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       const resp = await fetch(
  //         `${process.env.REACT_APP_API_BASE_URL}apschart/chart/duedue?months=1`
  //       );
  //       const data = await resp.json();

  //       if (Array.isArray(data.Labels) && Array.isArray(data.Values)) {
  //         const idx = data.Labels.indexOf("Existing");
  //         setExistingTotal(idx !== -1 ? data.Values[idx] : 0);
  //       }
  //     } catch (err) {
  //       console.error("Government fetch failed", err);
  //     }
  //   };
  //   fetchData();
  // }, []);

  return (
    <RenderHome
      title="Government"
      pic="Dika, Leonard & Lamora"
      description={
        <>
          Government isn’t just about policies – it’s about{" "}
          <strong>accountability</strong> and <strong>transparency</strong>.
          Manage <strong>compliance</strong>, control{" "}
          <strong>existing procurement</strong>, ensure{" "}
          <strong>regulatory alignment</strong>, and maintain clean{" "}
          <strong>audit trails</strong>.
        </>
      }
      tabs={<TabPills activeTab={activeTab} setActiveTab={setActiveTab} />}
      images={[
        { src: eventsimg, label: "Compliance", to: `${process.env.PUBLIC_URL}/compliance` },
        { src: auditimg, label: "Audit", to: `${process.env.PUBLIC_URL}/audit` },
      ]}
      widgets={[
        /*  =================== 2×2 GRID ===================
            LEFT COLUMN                          RIGHT COLUMN
            --------------------------------------------------
            | Existing Image       | Today’s Audit CardDash   |
            | Existing CardDash    | Compliance CardDash      |
        */

        <div className="d-flex w-100 gap-3">

          {/* LEFT COLUMN */}
          <div className="flex-fill d-flex flex-column gap-2">

            {/* IMAGE */}
            <Link
              to={`${process.env.PUBLIC_URL}/procurement/Aps?tab=existing`}
              className="overlay-wrapper"
            >
              <img src={existimg} alt="Existing Procurement" />
              <div className="overlay"></div>
              <div className="overlay-text">Existing Procurement</div>
            </Link>

          
          </div>

          {/* RIGHT COLUMN */}
          <div className="">

            {/* TODAY'S AUDIT */}
            <CardDash
            pill={true}
              values={[
                { label: "Current Audit", number: auditToday },
              ]}
              navigateTo={`${process.env.PUBLIC_URL}/audit`}
              icon={<Calendar />}
            />


  {/* EXISTING CARD */}
            <CardDash
            pill={true} 
               values={[
                  {
                    label: (
                      <>
                        Existing Procurement <br />
                        <span className="text-muted small">
                          ends in 1 month
                        </span>
                      </>
                    ),
                    number: existingTotal,
                  },
                ]}
              navigateTo={`${process.env.PUBLIC_URL}/procurement/Aps?tab=existing`}
              icon={<FileText />}

            
            />
            {/* COMPLIANCE */}
            {/* <CardDash
              values={[
                { label: "Compliance Items", number: 12 },
                { label: "Pending Reviews", number: 3 },
              ]}
              navigateTo="/Planing"
              icon={<Shield />}
            /> */}
          </div>

        </div>,
      ]}
    />
  );
};

export default Government;
