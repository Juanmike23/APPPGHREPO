/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/ComplianceEventRenameModal.jsx
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
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@pgh/ui-bootstrap";

const ComplianceEventRenameModal = ({
  isOpen,
  toggle,
  initialName = "",
  onSubmit,
}) => {
  const [periodName, setPeriodName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setPeriodName(initialName || "");
      setSubmitting(false);
      setError("");
      return;
    }

    setPeriodName(initialName || "");
    setSubmitting(false);
    setError("");
  }, [initialName, isOpen]);

  const handleSubmit = async () => {
    const trimmedName = periodName.trim();
    if (!trimmedName) {
      setError("Nama event wajib diisi.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await onSubmit?.(trimmedName);
      toggle?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal mengubah nama event.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>Edit Nama Event</ModalHeader>
      <ModalBody>
        <FormGroup>
          <Label for="compliance-event-rename">Nama Event</Label>
          <Input
            id="compliance-event-rename"
            type="text"
            value={periodName}
            onChange={(event) => setPeriodName(event.target.value)}
            maxLength={200}
            autoFocus
          />
        </FormGroup>

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
          {submitting ? "Menyimpan..." : "Simpan Nama"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ComplianceEventRenameModal;
