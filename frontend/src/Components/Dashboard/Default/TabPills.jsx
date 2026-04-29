/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/TabPills.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";

const TabPills = ({ activeTab, setActiveTab }) => {
  const items = [
    { id: "1", label: "Planning" },
    { id: "2", label: "Government" },
    { id: "3", label: "Human Resource" },
  ];

  return (
    <div className="mb-3 d-flex align-items-center gap-2">
      {items.map((item, idx) => (
        <React.Fragment key={item.id}>
          <span
            onClick={() => setActiveTab(item.id)}
            style={{ cursor: "pointer", fontSize: "0.8rem" }}
            className={
              activeTab === item.id
                ? "badge bg-primary text-white rounded-pill px-3 py-2"
                : "text-muted fw-semibold"
            }
          >
            {item.label}
          </span>

          {idx < items.length - 1 && <span className="text-muted">|</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

export default TabPills;
