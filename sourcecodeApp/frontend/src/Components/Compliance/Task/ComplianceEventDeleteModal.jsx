/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/ComplianceEventDeleteModal.jsx
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
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@pgh/ui-bootstrap";

const ComplianceEventDeleteModal = ({
  isOpen,
  toggle,
  eventName = "",
  onConfirm,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
      setError("");
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError("");
      await onConfirm?.();
      toggle?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menghapus Compliance Events.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>Delete</ModalHeader>
      <ModalBody>
        <p className="mb-0">
          Compliance Events <strong>{eventName || "Compliance Events"}</strong>{" "}
          akan dihapus beserta seluruh row di dalamnya.
        </p>

        {error ? (
          <Alert color="danger" className="mt-3 mb-0">
            {error}
          </Alert>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button color="light" onClick={toggle} disabled={submitting}>
          Batal
        </Button>
        <Button color="danger" onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Menghapus..." : "Delete"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ComplianceEventDeleteModal;
