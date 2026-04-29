/*
 * PGH-DOC
 * File: src/Components/Planning/DashboardPlanning/Opex/OpexBudgetGuardrailModal.jsx
 * Apa fungsi bagian ini:
 * - Menampilkan editor target guardrail bulanan OPEX per table dan per tahun.
 * Kenapa perlu:
 * - Agar user bisa mengubah baseline monitoring chart guardrail tanpa ubah kode backend.
 * Aturan khususnya apa:
 * - Nilai kosong berarti kembali ke default sistem.
 * - Nilai harus 0 sampai 100 karena format yang disimpan adalah persen target YTD.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Table,
} from "@pgh/ui-bootstrap";

const readValue = (source, ...keys) => {
  for (const key of keys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }
  return undefined;
};

const readRows = (config) => {
  const rows = readValue(config, "rows", "Rows");
  return Array.isArray(rows) ? rows : [];
};

const formatPct = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

const parsePctInput = (value) => {
  const normalized = String(value ?? "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .trim();

  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
};

const buildDraftRows = (config) =>
  readRows(config)
    .map((row) => {
      const monthIndex = Number(readValue(row, "monthIndex", "MonthIndex") || 0);
      const targetPct = readValue(row, "targetPct", "TargetPct");
      const defaultTargetPct = readValue(row, "defaultTargetPct", "DefaultTargetPct");
      const isDefault = Boolean(readValue(row, "isDefault", "IsDefault"));
      return {
        monthIndex,
        month: String(readValue(row, "month", "Month") || "-"),
        targetPct: targetPct === null || targetPct === undefined ? null : Number(targetPct),
        defaultTargetPct:
          defaultTargetPct === null || defaultTargetPct === undefined ? null : Number(defaultTargetPct),
        isDefault,
        inputValue:
          isDefault || targetPct === null || targetPct === undefined
            ? ""
            : String(Number(targetPct)),
      };
    })
    .sort((left, right) => left.monthIndex - right.monthIndex);

const OpexBudgetGuardrailModal = ({
  isOpen,
  toggle,
  config,
  loading = false,
  saving = false,
  onSave,
}) => {
  const [draftRows, setDraftRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setError("");
      return;
    }

    setDraftRows(buildDraftRows(config));
    setError("");
  }, [config, isOpen]);

  const tableName = String(readValue(config, "tableName", "TableName") || "OPEX");
  const year = readValue(config, "year", "Year");
  const sourceLabel = String(readValue(config, "source", "Source") || "default");
  const apiUnavailable = Boolean(readValue(config, "apiUnavailable", "ApiUnavailable"));
  const apiUnavailableReason = String(
    readValue(config, "apiUnavailableReason", "ApiUnavailableReason") || "",
  );

  const draftPreview = useMemo(
    () =>
      draftRows.map((row) => {
        const parsed = parsePctInput(row.inputValue);
        const hasOverride = row.inputValue.trim().length > 0 && Number.isFinite(parsed);
        return {
          ...row,
          parsedValue: parsed,
          effectiveValue: hasOverride ? parsed : row.defaultTargetPct,
          sourceLabel: hasOverride ? "Override table/tahun ini" : "Default sistem",
        };
      }),
    [draftRows],
  );

  const handleChangeRow = (monthIndex, nextValue) => {
    setDraftRows((prev) =>
      prev.map((row) =>
        row.monthIndex === monthIndex
          ? {
              ...row,
              inputValue: nextValue,
            }
          : row,
      ),
    );
  };

  const handleResetAll = () => {
    setDraftRows((prev) =>
      prev.map((row) => ({
        ...row,
        inputValue: "",
      })),
    );
  };

  const handleSave = async () => {
    const payloadRows = [];
    for (const row of draftRows) {
      const parsed = parsePctInput(row.inputValue);
      if (row.inputValue.trim().length > 0 && !Number.isFinite(parsed)) {
        setError(`Target bulan ${row.month} harus berupa angka 0 sampai 100.`);
        return;
      }
      if (Number.isFinite(parsed) && (parsed < 0 || parsed > 100)) {
        setError(`Target bulan ${row.month} harus di antara 0 sampai 100.`);
        return;
      }

      payloadRows.push({
        monthIndex: row.monthIndex,
        targetPct: row.inputValue.trim().length === 0 ? null : parsed,
      });
    }

    try {
      setError("");
      await onSave?.(payloadRows);
      toggle?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Gagal menyimpan target guardrail OPEX.",
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      centered
      size="xl"
      className="table-utility-modal planning-opex-guardrail-modal"
    >
      <ModalHeader toggle={toggle}>Atur Target Guardrail OPEX</ModalHeader>
      <ModalBody>
        <div className="small text-muted mb-3">
          Table <strong>{tableName}</strong>
          {" | "}
          Tahun <strong>{year || "-"}</strong>
          {" | "}
          Source <strong>{sourceLabel}</strong>
        </div>

        <div className="small text-muted d-flex flex-column gap-1 mb-3">
          <span>
            Nilai default dipakai sebagai baseline target YTD bulanan. Kosongkan kolom override untuk kembali ke default sistem.
          </span>
          <span>
            Override hanya berlaku untuk table dan tahun yang sedang dibuka.
          </span>
        </div>

        {apiUnavailable ? (
          <Alert color="warning" className="mb-3">
            Runtime backend yang sedang berjalan belum memuat endpoint konfigurasi target guardrail.
            {" "}
            {apiUnavailableReason ? apiUnavailableReason : "Restart IIS Express agar fitur simpan override aktif."}
          </Alert>
        ) : null}

        {error ? (
          <Alert color="danger" className="mb-3">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <div className="d-flex align-items-center justify-content-center py-5 text-muted">
            <Spinner size="sm" className="me-2" />
            Memuat target guardrail...
          </div>
        ) : (
          <div className="table-responsive planning-opex-guardrail-modal__table-shell">
            <Table className="align-middle mb-0 table-hover">
              <thead>
                <tr>
                  <th style={{ minWidth: 92 }}>Bulan</th>
                  <th style={{ minWidth: 140 }}>Default Sistem</th>
                  <th style={{ minWidth: 180 }}>Override Table/Tahun</th>
                  <th style={{ minWidth: 120 }}>Target Efektif</th>
                  <th style={{ minWidth: 160 }}>Sumber</th>
                </tr>
              </thead>
              <tbody>
                {draftPreview.map((row) => (
                  <tr key={row.monthIndex}>
                    <td>{row.month}</td>
                    <td>{formatPct(row.defaultTargetPct)}%</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row.inputValue}
                          onChange={(event) => handleChangeRow(row.monthIndex, event.target.value)}
                          placeholder={`Default ${formatPct(row.defaultTargetPct)}%`}
                          disabled={saving}
                        />
                        <Button
                          color="light"
                          size="sm"
                          className="planning-opex-guardrail-modal__neutral-btn planning-opex-guardrail-modal__neutral-btn--inline"
                          onClick={() => handleChangeRow(row.monthIndex, "")}
                          disabled={saving}
                        >
                          Default
                        </Button>
                      </div>
                    </td>
                    <td>
                      {formatPct(row.effectiveValue)}
                      %
                    </td>
                    <td>{row.sourceLabel}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          color="light"
          className="planning-opex-guardrail-modal__neutral-btn planning-opex-guardrail-modal__neutral-btn--reset"
          onClick={handleResetAll}
          disabled={loading || saving}
        >
          Kosongkan Override
        </Button>
        <Button
          color="light"
          className="planning-opex-guardrail-modal__neutral-btn planning-opex-guardrail-modal__neutral-btn--cancel"
          onClick={toggle}
          disabled={saving}
        >
          Batal
        </Button>
        <Button
          color="primary"
          className="planning-opex-guardrail-modal__primary-btn"
          onClick={handleSave}
          disabled={loading || saving || apiUnavailable}
        >
          {saving ? (
            <>
              <Spinner size="sm" className="me-2" />
              Menyimpan...
            </>
          ) : (
            "Simpan Target"
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default OpexBudgetGuardrailModal;
