/*
 * PGH-DOC
 * File: src/Variables/Table/TableToolBarElement/MandatoryInputModal.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";

const MandatoryInputModal = ({
  isOpen,
  mandatoryColumn,
  value,
  suggestionValues = null, // true | [] | null
  onChange,
  onSubmit,
  onCancel,
}) => {
  const handleConfirm = () => {
    if (
      value === undefined ||
      value === null ||
      value.toString().trim() === ""
    ) {
      toast.warning(`Please enter a value for "${mandatoryColumn}"`);
      return;
    }
    onSubmit();
  };

  const renderInput = () => {
    // 🔘 Boolean selector
    if (suggestionValues === true) {
      return (
        <Input
          type="select"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Input>
      );
    }

    // 🔽 Dropdown with fixed values
    if (Array.isArray(suggestionValues) && suggestionValues.length > 0) {
      return (
        <Input
          type="select"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {mandatoryColumn}...</option>
          {suggestionValues.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Input>
      );
    }

    // ✏️ Default text input
    return (
      <Input
        type="text"
        placeholder={`Enter ${mandatoryColumn}...`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
      />
    );
  };

  return (
    <Modal isOpen={isOpen} toggle={onCancel} centered>
      <ModalHeader toggle={onCancel}>
        Enter value for "{mandatoryColumn}"
      </ModalHeader>
      <ModalBody>{renderInput()}</ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button color="primary" onClick={handleConfirm}>
          Confirm
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default MandatoryInputModal;