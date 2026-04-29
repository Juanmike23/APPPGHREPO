/*
 * PGH-DOC
 * File: src/Variables/Summary/SummaryFilterFrontend.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// Summary.jsx
import React, { useEffect, useState, Fragment } from "react";
import TabelComponent from "../Table/TableComponent";
import { Card, Row, Col, Container, Nav, NavLink, NavItem } from "@pgh/ui-bootstrap";

const Summary = ({ apiUrl, title = "Summary" , patchUrlBase}) => {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiUrl) return;

    const fetchData = async () => {
      setLoading(true);
      console.log("📡 Fetching from:", apiUrl);

      try {
       const res = await fetch(`${apiUrl}`, {
  credentials: "include"
});

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(data);

        if (data.length > 0) {
          const sample = data[0];
          setColumns(Object.keys(sample));
        } else {
          setColumns([]);
        }
      } catch (err) {
        console.error("❌ Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiUrl]);

  if (!apiUrl) return <p>No API URL provided.</p>;

  return (
   
        
          <TabelComponent
            title={title}
            apiUrl={apiUrl}
            columns={columns}
            allColumns={[]}
            collapsible={false}
            // uploadColumns={["RHA", "LHA"]}
            enableColumnDrag={false}
            showLogTrail={false}
            patchUrlBase={patchUrlBase}
          />
       
    
  );
};

export default Summary;
