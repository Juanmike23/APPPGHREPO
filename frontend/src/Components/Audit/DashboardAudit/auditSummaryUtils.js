/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/auditSummaryUtils.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import {
  AUDIT_EMPTY_LABEL,
  getAuditChartLabel,
  getAuditDisplayValue,
} from "../Utils/auditValueLabels";

const ROOT_ARRAY_KEYS = ["rows", "data", "items", "results", "result", "value"];

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getRootArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!isPlainObject(payload)) return null;

  for (const key of ROOT_ARRAY_KEYS) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return null;
};

export const normalizeAuditSection = (label) => {
  const text = getAuditDisplayValue(label);
  const lowered = text.toLowerCase();

  if (!text) return AUDIT_EMPTY_LABEL;
  if (lowered.includes("internal")) return "Internal";
  if (lowered.includes("eksternal") || lowered.includes("external")) {
    return "External";
  }
  if (lowered === "unknown" || lowered === AUDIT_EMPTY_LABEL.toLowerCase()) {
    return AUDIT_EMPTY_LABEL;
  }

  return text;
};

const sortSectionRows = (rows) => {
  const allNumeric = rows.every((row) => /^-?\d+(\.\d+)?$/.test(String(row.label)));

  return [...rows].sort((left, right) => {
    if (allNumeric) {
      return Number(left.label) - Number(right.label);
    }

    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return String(left.label).localeCompare(String(right.label), "id");
  });
};

export const toCompareSeries = (response, chartColumn = null) => {
  const items = getRootArray(response) || [];
  const grouped = {};

  items.forEach((item, index) => {
    if (!isPlainObject(item)) {
      console.warn("Audit compare item is not an object:", { index, item });
      return;
    }

    const rawLabel = item.Label ?? item.label;
    if (rawLabel == null || String(rawLabel).trim() === "") {
      console.warn("Audit compare item is missing Label:", { index, item });
      return;
    }

    const section = normalizeAuditSection(rawLabel);
    if (!grouped[section]) {
      grouped[section] = {};
    }

    const breakdown = item.Breakdown ?? item.breakdown;
    if (breakdown == null) {
      return;
    }

    if (!isPlainObject(breakdown)) {
      console.warn("Audit compare item has invalid Breakdown:", { index, item });
      return;
    }

    Object.entries(breakdown).forEach(([detailLabel, rawCount]) => {
      const label = getAuditChartLabel(detailLabel, chartColumn);
      const count = toFiniteNumber(rawCount);

      if (count === null) {
        return;
      }

      grouped[section][label] = (grouped[section][label] || 0) + count;
    });
  });

  return Object.fromEntries(
    Object.entries(grouped).map(([section, breakdown]) => [
      section,
      sortSectionRows(
        Object.entries(breakdown)
          .map(([label, count]) => ({
            label: String(label),
            count: toFiniteNumber(count) ?? 0,
          }))
          .filter((row) => row.count > 0),
      ),
    ]),
  );
};

export const getAuditSectionRows = (payload, sectionKey) =>
  toCompareSeries(payload)[normalizeAuditSection(sectionKey)] || [];

export const toSeriesRows = (rows, chartColumn = null) => {
  const aggregated = rows.reduce((accumulator, row) => {
    const label = getAuditChartLabel(row?.label, chartColumn);
    const count = toFiniteNumber(row?.count) ?? 0;
    accumulator[label] = (accumulator[label] || 0) + count;
    return accumulator;
  }, {});

  return Object.entries(aggregated).map(([label, count]) => ({
    label,
    count: toFiniteNumber(count) ?? 0,
  }));
};

export const extractCountFromPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (!isPlainObject(payload)) return 0;

  const directCount = ["Count", "count", "Total", "total", "Jumlah", "jumlah"]
    .map((key) => toFiniteNumber(payload[key]))
    .find((value) => value !== null);

  if (directCount != null) {
    return directCount;
  }

  const arrayPayload = getRootArray(payload);
  if (arrayPayload) {
    return arrayPayload.length;
  }

  const labels = payload.Labels || payload.labels;
  const values = payload.Values || payload.values;

  if (Array.isArray(labels)) {
    return labels.length;
  }

  if (Array.isArray(values)) {
    return values.reduce(
      (total, value) => total + (toFiniteNumber(value) ?? 0),
      0,
    );
  }

  return 0;
};
