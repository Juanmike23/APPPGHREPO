/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/ApsCardDashboard.jsx
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
import { FileText ,Search} from "react-feather"; // or any icon you prefer
import CardDashboard from "../../../Variables/CardDashboard";

const IncomeCard = () => {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuditData = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}listaudit/total`,{ credentials: "include" });
        if (!response.ok) throw new Error("Failed to fetch audit totals");
        const data = await response.json();
        setAuditData(data);
      } catch (err) {
        console.error("Error fetching audit data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAuditData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!auditData) return <div>Error loading data</div>;

  return (
    <CardDashboard
      iconClass={<Search size={24} />}        // 🔹 Feather icon
      totalRows={auditData.TotalRows || 0}      // 🔹 Dynamic number from API
      title="Pengadaan APS"               // 🔹 Custom label
      linkLabel="Procurement APS"                // 🔹 Bottom small text
      linkTo="/PGH/audit/listaudit"                   // 🔹 Full-card link destination
    />
  );
};

export default IncomeCard;
