/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/ComplianceEventCreateModal.jsx
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

const PERIOD_OPTIONS = ["Daily", "Monthly", "Yearly"];

const ComplianceEventCreateModal = ({
  isOpen,
  toggle,
  cloneFromGroupId = null,
  onCreated,
}) => {
  const [periodName, setPeriodName] = useState("");
  const [period, setPeriod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setPeriodName("");
      setPeriod("");
      setSubmitting(false);
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmedName = periodName.trim();
    if (!trimmedName) {
      setError("Nama event wajib diisi.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}DocumentPeriodReport/groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            periodName: trimmedName,
            period: period || null,
            cloneFromGroupId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const createdGroup = await response.json();
      onCreated?.(createdGroup);
      toggle?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membuat Compliance Events baru.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>Add New Events</ModalHeader>
      <ModalBody>
        <Alert color="secondary" className="py-2">
          Compliance Events baru memakai template detail yang sama. Yang
          diclone hanya suggest word agar pengisian row berikutnya tetap cepat.
        </Alert>

        <FormGroup>
          <Label for="compliance-event-name">Nama Event</Label>
          <Input
            id="compliance-event-name"
            type="text"
            value={periodName}
            onChange={(event) => setPeriodName(event.target.value)}
            placeholder="Contoh: SLA Uptime Aplikasi PJSP"
            maxLength={200}
            autoFocus
          />
        </FormGroup>

        <FormGroup>
          <Label for="compliance-event-period">Periode</Label>
          <Input
            id="compliance-event-period"
            type="select"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="">Pilih periode</option>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Input>
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
          {submitting ? "Menyimpan..." : "Buat Event"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ComplianceEventCreateModal;
