/*
 * PGH-DOC
 * File: src/Components/Compliance/Weekly/WeeklyTableCreateModal.jsx
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

const WeeklyTableCreateModal = ({
  isOpen,
  toggle,
  endpoint = "weeklytable",
  cloneFromTableId = null,
  onCreated,
}) => {
  const [tableName, setTableName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setTableName("");
      setSubmitting(false);
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmedName = tableName.trim();
    if (!trimmedName) {
      setError("Nama table wajib diisi.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}${endpoint}/tables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            tableName: trimmedName,
            cloneRows: false,
            cloneFromTableId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const createdTable = await response.json();
      await Promise.resolve(onCreated?.(createdTable));
      toggle?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membuat table weekly baru.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>Add New Table</ModalHeader>
      <ModalBody>
        <Alert color="secondary" className="py-2">
          Table baru memakai template kolom yang sama. Sistem hanya membuat
          entitas data baru, bukan tabel database fisik baru. Suggest word dari
          table yang sedang dipilih akan ikut dibawa agar pengisian cell lebih cepat.
        </Alert>

        <FormGroup>
          <Label for="weekly-table-name">Nama Table</Label>
          <Input
            id="weekly-table-name"
            type="text"
            value={tableName}
            onChange={(event) => setTableName(event.target.value)}
            placeholder="Contoh: Weekly Table Support"
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
          {submitting ? "Menyimpan..." : "Buat Table"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default WeeklyTableCreateModal;
