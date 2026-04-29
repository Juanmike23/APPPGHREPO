/*
 * PGH-DOC
 * File: src/Components/Procurement/APS/ParentRowTable.jsx
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
import { Modal, ModalHeader, ModalBody, Spinner } from "@pgh/ui-bootstrap";
import TabelComponent from "../../../Variables/Table/TableComponent";

const ParentRowTable = ({ apiUrl, parentId, isOpen, onClose }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !parentId) return;
    const fetchParentRow = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/parent/${parentId}`,{credentials: "include"});
        if (!res.ok) throw new Error("Failed to fetch parent row");
        const json = await res.json();
        setData(Array.isArray(json) ? json : [json]);
      } catch (err) {
        console.error("❌ Error fetching parent row:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchParentRow();
  }, [isOpen, parentId]);

  return (
    <Modal isOpen={isOpen} toggle={onClose} size="lg">
      <ModalHeader toggle={onClose}>
        Parent Record Details (ID: {parentId})
      </ModalHeader>
      <ModalBody>
        {loading ? (
          <div className="text-center my-3">
            <Spinner color="primary" />
          </div>
        ) : data.length > 0 ? (
          <TabelComponent
            data={data}
            title="Parent Row"
            collapsible={false}
            groupingEnabled={false}
          />
        ) : (
          <p>No parent record found.</p>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ParentRowTable;
