/*
 * PGH-DOC
 * File: src/Components/Compliance/Weekly/WeeklyTableRenameModal.jsx
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

const WeeklyTableRenameModal = ({
  isOpen,
  toggle,
  initialName = "",
  onSubmit,
  modalTitle = "Edit Nama Table Weekly",
  fieldLabel = "Nama Table",
}) => {
  const [tableName, setTableName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setTableName(initialName || "");
      setSubmitting(false);
      setError("");
      return;
    }

    setTableName(initialName || "");
    setSubmitting(false);
    setError("");
  }, [initialName, isOpen]);

  const handleSubmit = async () => {
    const trimmedName = tableName.trim();
    if (!trimmedName) {
      setError("Nama table wajib diisi.");
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
          : "Gagal mengubah nama table.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>{modalTitle}</ModalHeader>
      <ModalBody>
        <FormGroup>
          <Label for="weekly-table-rename">{fieldLabel}</Label>
          <Input
            id="weekly-table-rename"
            type="text"
            value={tableName}
            onChange={(event) => setTableName(event.target.value)}
            maxLength={160}
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

export default WeeklyTableRenameModal;
