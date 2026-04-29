/*
 * PGH-DOC
 * File: src/Components/Planning/DashboardPlanning/PlanningTableCreateModal.jsx
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
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@pgh/ui-bootstrap";

const PlanningTableCreateModal = ({
  isOpen,
  toggle,
  onSubmit,
  scopeLabel = "OPEX",
  suggestedYear = null,
  suggestedTableName = "",
}) => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
      setError("");
    }
  }, [currentYear, isOpen]);

  const resolvedYear = Number.isFinite(Number(suggestedYear))
    ? Number(suggestedYear)
    : currentYear + 1;
  const resolvedTableName =
    String(suggestedTableName || "").trim() || `${scopeLabel} ${resolvedYear}`;

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError("");
      await onSubmit?.();
      toggle?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membuat table planning baru.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>Add New {scopeLabel} Table</ModalHeader>
      <ModalBody>
        <Alert color="secondary" className="py-2">
          Add New otomatis membuat table tahun berikutnya untuk scope {scopeLabel}.
          Table lama tetap dipertahankan.
        </Alert>

        <div className="small text-muted">
          Tahun baru: <strong>{resolvedYear}</strong>
        </div>
        <div className="small text-muted">
          Nama table: <strong>{resolvedTableName}</strong>
        </div>

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
        <Button color="warning" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Menyimpan..." : "Buat Table"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default PlanningTableCreateModal;
