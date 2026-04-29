/*
 * PGH-DOC
 * File: src/Components/Procurement/APS/StatusPengadaan.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Circle,
  Layers,
  List,
} from "react-feather";
import { Card, Col, Row, Spinner } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";

import "./statusPengadaan.scss";

const isLetterCode = (value) => /^[A-Z]$/i.test(String(value ?? "").trim());
const isNumberCode = (value) => /^\d+$/.test(String(value ?? "").trim());
const extractAlphaCode = (value) => {
  const normalized = String(value ?? "").trim();
  const match = normalized.match(/^([a-z])\.\s*(.*)$/i);
  if (!match) {
    return {
      code: "",
      label: normalized,
    };
  }

  return {
    code: match[1].toLowerCase(),
    label: match[2]?.trim() || normalized,
  };
};

const normalizeStatus = (value) => String(value ?? "").trim().toLowerCase();

const normalizeNodeType = (value) => String(value ?? "").trim().toLowerCase();
const getChecklistRowId = (row) => row?.Id ?? row?.TemplateNodeId;
const getChecklistRowAnchorId = (rowId) =>
  rowId == null ? undefined : `procurement-checkpoint-row-${String(rowId)}`;
const includesFocusRow = (rows, focusRowId) => {
  if (focusRowId == null || !Array.isArray(rows) || rows.length === 0) {
    return false;
  }

  const focusKey = String(focusRowId);
  return rows.some((row) => String(getChecklistRowId(row) ?? "") === focusKey);
};

const isTerminasiStepRow = (row) => {
  const nodeType = normalizeNodeType(row?.NodeType);
  const noCode = String(row?.No ?? "").trim();
  const explicitCode = String(row?.Code ?? "").trim();
  const titleToken = `${String(row?.Title ?? "").trim()} ${String(
    row?.AlurPengadaanIT ?? "",
  ).trim()}`.toLowerCase();
  const isStepLikeNode = nodeType === "step" || (!nodeType && isNumberCode(noCode));

  if (!isStepLikeNode) {
    return false;
  }

  return explicitCode === "8" || noCode === "8" || titleToken.includes("terminasi");
};

const isStructuredRow = (row) =>
  Boolean(
    row?.TemplateNodeId ||
      row?.ParentTemplateId ||
      String(row?.NodeType ?? "").trim(),
  );

const isActionableStatusRow = (row) =>
  isTerminasiStepRow(row)
    ? true
    : typeof row?.IsActionable === "boolean"
      ? row.IsActionable
      : !isLetterCode(row.No) &&
        !isNumberCode(row.No) &&
        Boolean(
          String(row.AlurPengadaanIT ?? "").trim() ||
            String(row.DenganDetail ?? "").trim() ||
            String(row.Persetujuan ?? "").trim() ||
            String(row.Status ?? "").trim(),
        );

const getRowCode = (row) => {
  const explicitCode = String(row?.Code ?? "").trim();
  if (explicitCode) {
    return explicitCode;
  }

  const nodeType = normalizeNodeType(row?.NodeType);
  if (nodeType === "section" || nodeType === "step") {
    return String(row?.No ?? "").trim();
  }

  return extractAlphaCode(row?.AlurPengadaanIT).code;
};

const getRowTitle = (row, fallbackIndex = 1) => {
  const explicitTitle = String(row?.Title ?? "").trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  const nodeType = normalizeNodeType(row?.NodeType);
  if (nodeType === "section" || nodeType === "step") {
    return String(row?.AlurPengadaanIT ?? "").trim() || `Node ${fallbackIndex}`;
  }

  if (nodeType === "item") {
    const parsed = extractAlphaCode(row?.AlurPengadaanIT);
    return parsed.label || `Item ${fallbackIndex}`;
  }

  return getLeafTitle(row, fallbackIndex);
};

const buildStructuredChecklistTree = (rows) => {
  const sections = [];
  const sectionMap = new Map();
  const stepMap = new Map();
  const itemMap = new Map();
  let fallbackSection = null;
  let fallbackStep = null;
  let fallbackItem = null;

  const ensureFallbackSection = () => {
    if (fallbackSection) {
      return fallbackSection;
    }

    fallbackSection = {
      id: "section-default",
      code: "General",
      title: "Checklist Umum",
      row: null,
      steps: [],
    };
    sections.push(fallbackSection);
    return fallbackSection;
  };

  const ensureFallbackStep = () => {
    if (fallbackStep) {
      return fallbackStep;
    }

    const section = ensureFallbackSection();
    fallbackStep = {
      id: "step-default",
      code: "1",
      title: "Tahapan Umum",
      detail: "",
      row: null,
      items: [],
    };
    section.steps.push(fallbackStep);
    return fallbackStep;
  };

  const ensureFallbackItem = () => {
    if (fallbackItem) {
      return fallbackItem;
    }

    const step = ensureFallbackStep();
    fallbackItem = {
      id: "item-default",
      code: "",
      title: "Detail Tambahan",
      row: {
        Id: "virtual-item",
        Status: "",
        DenganDetail: "",
        Persetujuan: "",
      },
      points: [],
    };
    step.items.push(fallbackItem);
    return fallbackItem;
  };

  rows.forEach((row, index) => {
    const rowId = row.TemplateNodeId ?? row.Id ?? `row-${index}`;
    const nodeType = normalizeNodeType(row.NodeType);
    const code = getRowCode(row);
    const title = getRowTitle(row, index + 1);
    const parentTemplateId = row.ParentTemplateId ?? null;

    if (nodeType === "section") {
      const section = {
        id: `section-${rowId}`,
        code: code || String.fromCharCode(65 + sections.length),
        title: title || "Bagian Tanpa Judul",
        row,
        steps: [],
      };
      sections.push(section);
      sectionMap.set(row.TemplateNodeId ?? row.Id, section);
      return;
    }

    if (nodeType === "step") {
      const section =
        sectionMap.get(parentTemplateId) || sections.at(-1) || ensureFallbackSection();
      const step = {
        id: `step-${rowId}`,
        code: code || `${section.steps.length + 1}`,
        title: title || "Tahapan Tanpa Judul",
        detail:
          String(row.DenganDetail ?? "").trim() ||
          String(row.Persetujuan ?? "").trim() ||
          "",
        row,
        items: [],
      };
      section.steps.push(step);
      stepMap.set(row.TemplateNodeId ?? row.Id, step);
      return;
    }

    if (nodeType === "item") {
      const step =
        stepMap.get(parentTemplateId) ||
        Array.from(stepMap.values()).at(-1) ||
        ensureFallbackStep();
      const item = {
        id: `item-${rowId}`,
        code,
        title: title || "Item Tanpa Judul",
        row,
        points: [],
      };
      step.items.push(item);
      itemMap.set(row.TemplateNodeId ?? row.Id, item);
      return;
    }

    const item =
      itemMap.get(parentTemplateId) ||
      Array.from(itemMap.values()).at(-1) ||
      ensureFallbackItem();
    item.points.push({
      id: `point-${rowId}`,
      title: title || `Point ${item.points.length + 1}`,
      row,
    });
  });

  return sections;
};

const buildLegacyChecklistTree = (rows) => {
  const sections = [];
  let currentSection = null;
  let currentStep = null;
  let currentItem = null;
  let orphanPointIndex = 1;

  const ensureSection = () => {
    if (currentSection) {
      return currentSection;
    }

    currentSection = {
      id: "section-default",
      code: "General",
      title: "Checklist Umum",
      row: null,
      steps: [],
    };
    sections.push(currentSection);
    return currentSection;
  };

  const ensureStep = () => {
    const section = ensureSection();
    if (currentStep) {
      return currentStep;
    }

    currentStep = {
      id: `step-default-${section.steps.length + 1}`,
      code: `${section.steps.length + 1}`,
      title: "Tahapan Umum",
      detail: "",
      row: null,
      items: [],
    };
    section.steps.push(currentStep);
    return currentStep;
  };

  const ensureFallbackItem = () => {
    const step = ensureStep();
    if (currentItem) {
      return currentItem;
    }

    currentItem = {
      id: `item-default-${step.items.length + 1}`,
      code: "",
      title: "Detail Tambahan",
      row: {
        Id: `virtual-item-${step.items.length + 1}`,
        Status: "",
        DenganDetail: "",
        Persetujuan: "",
      },
      points: [],
    };
    step.items.push(currentItem);
    return currentItem;
  };

  for (const sourceRow of rows) {
    const row = {
      ...sourceRow,
      No: String(sourceRow.No ?? "").trim(),
      AlurPengadaanIT: String(sourceRow.AlurPengadaanIT ?? "").trim(),
      DenganDetail: String(sourceRow.DenganDetail ?? "").trim(),
      Persetujuan: String(sourceRow.Persetujuan ?? "").trim(),
      Status: String(sourceRow.Status ?? "").trim(),
    };

    const hasContent = Boolean(
      row.No ||
        row.AlurPengadaanIT ||
        row.DenganDetail ||
        row.Persetujuan ||
        row.Status,
    );

    if (!hasContent) {
      continue;
    }

    if (isLetterCode(row.No)) {
      currentSection = {
        id: `section-${row.Id}`,
        code: row.No.toUpperCase(),
        title: row.AlurPengadaanIT || "Bagian Tanpa Judul",
        row,
        steps: [],
      };
      sections.push(currentSection);
      currentStep = null;
      currentItem = null;
      orphanPointIndex = 1;
      continue;
    }

    if (isNumberCode(row.No)) {
      const section = ensureSection();
      currentStep = {
        id: `step-${row.Id}`,
        code: row.No,
        title: row.AlurPengadaanIT || "Tahapan Tanpa Judul",
        detail: row.DenganDetail || row.Persetujuan || "",
        row,
        items: [],
      };
      section.steps.push(currentStep);
      currentItem = null;
      orphanPointIndex = 1;
      continue;
    }

    if (row.AlurPengadaanIT) {
      const step = ensureStep();
      const { code, label } = extractAlphaCode(row.AlurPengadaanIT);
      currentItem = {
        id: `item-${row.Id}`,
        code,
        title: label || row.AlurPengadaanIT,
        row,
        points: [],
      };
      step.items.push(currentItem);
      orphanPointIndex = 1;
      continue;
    }

    const item = ensureFallbackItem();
    item.points.push({
      id: `point-${row.Id}`,
      title: getLeafTitle(row, orphanPointIndex),
      row,
    });
    orphanPointIndex += 1;
  }

  return sections;
};

const buildChecklistTree = (rows) => {
  if (rows.some(isStructuredRow)) {
    return buildStructuredChecklistTree(rows);
  }

  return buildLegacyChecklistTree(rows);
};

const getLeafTitle = (row, fallbackIndex) => {
  const detail = String(row.DenganDetail ?? "").trim();
  const approval = String(row.Persetujuan ?? "").trim();

  return detail || approval || `Point ${fallbackIndex}`;
};

const summarizeStatuses = (rows) => {
  const actionableRows = rows.filter(isActionableStatusRow);
  const done = actionableRows.filter(
    (row) => normalizeStatus(row.Status) === "done",
  ).length;
  const total = actionableRows.length;

  return {
    total,
    done,
    remaining: Math.max(total - done, 0),
    progress: total === 0 ? 0 : Math.round((done / total) * 100),
  };
};

const resolveCurrentCheckpoint = (rows) => {
  const actionableRows = rows
    .filter(isActionableStatusRow)
    .sort(
      (left, right) =>
        (left.SortOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.SortOrder ?? Number.MAX_SAFE_INTEGER) || left.Id - right.Id,
    );

  if (actionableRows.length === 0) {
    return "Belum ada checklist aktif";
  }

  const latestDone = actionableRows
    .slice()
    .reverse()
    .find((row) => normalizeStatus(row.Status) === "done");
  const anchor = latestDone || actionableRows[0];
  return getRowTitle(anchor, 1);
};

const resolveCurrentCheckpointRowId = (rows) => {
  const actionableRows = rows
    .filter(isActionableStatusRow)
    .sort(
      (left, right) =>
        (left.SortOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.SortOrder ?? Number.MAX_SAFE_INTEGER) || left.Id - right.Id,
    );

  if (actionableRows.length === 0) {
    return null;
  }

  const latestDone = actionableRows
    .slice()
    .reverse()
    .find((row) => normalizeStatus(row.Status) === "done");
  const anchor = latestDone || actionableRows[0];
  return getChecklistRowId(anchor);
};

const collectItemActionableRows = (item) => {
  if (!item) {
    return [];
  }

  if (Array.isArray(item.points) && item.points.length > 0) {
    return item.points
      .map((point) => point?.row)
      .filter((row) => row && isActionableStatusRow(row));
  }

  return isActionableStatusRow(item.row) ? [item.row] : [];
};

const collectNodeRows = (step) => {
  const rows = [];
  const seen = new Set();

  if ((!Array.isArray(step.items) || step.items.length === 0) && isActionableStatusRow(step.row)) {
    const key = step.row?.Id ?? step.row?.TemplateNodeId;
    if (key != null) {
      seen.add(key);
      rows.push(step.row);
    }
  }

  for (const item of step.items) {
    const candidateRows = collectItemActionableRows(item);
    for (const candidate of candidateRows) {
      const key = candidate?.Id ?? candidate?.TemplateNodeId;
      if (key == null || seen.has(key)) {
        continue;
      }
      seen.add(key);
      rows.push(candidate);
    }
  }
  return rows;
};

const StatusTone = ({ status }) => {
  const normalized = normalizeStatus(status);
  const done = normalized === "done";

  return (
    <span
      className={`procurement-status-pill ${done ? "is-done" : "is-pending"}`}
    >
      {done ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {done ? "Done" : status || "Not Yet"}
    </span>
  );
};

const LevelBadge = ({ label }) => (
  <span className="procurement-level-badge">{label}</span>
);

const ToggleButton = ({ status, disabled, onClick }) => {
  const done = normalizeStatus(status) === "done";

  return (
    <button
      type="button"
      className={`procurement-status-toggle ${done ? "is-done" : "is-pending"}`}
      onClick={onClick}
      disabled={disabled}
      title="Set checkpoint di baris ini"
    >
      {done ? <CheckCircle size={16} /> : <Circle size={16} />}
      <span>{done ? "Done" : "Not Yet"}</span>
    </button>
  );
};

const ChecklistLeaf = ({
  row,
  code = "",
  title,
  disabled = false,
  isPoint = false,
  levelLabel = "Checklist",
  showToggle = true,
  onToggle,
}) => {
  const approval = String(row.Persetujuan ?? "").trim();
  const done = normalizeStatus(row.Status) === "done";
  const rowId = getChecklistRowId(row);
  const rowAnchorId = getChecklistRowAnchorId(rowId);

  return (
    <div
      id={rowAnchorId}
      data-row-key={rowId == null ? undefined : String(rowId)}
      className={`procurement-checklist-leaf ${isPoint ? "is-point" : ""} ${
        done ? "is-done" : "is-pending"
      }`}
    >
      <div className="procurement-checklist-leaf__main">
        <div className="procurement-checklist-leaf__heading">
          {code ? (
            <span className="procurement-checklist-leaf__code">{code}</span>
          ) : null}
          <div className="procurement-checklist-leaf__title-group">
            <div className="procurement-checklist-leaf__meta">
              <LevelBadge label={levelLabel} />
            </div>
            <div className="procurement-checklist-leaf__title">{title}</div>
            {approval ? (
              <div className="procurement-checklist-leaf__approval">
                Persetujuan: {approval}
              </div>
            ) : null}
          </div>
        </div>
        {showToggle ? (
          <ToggleButton
            status={row.Status}
            disabled={disabled}
            onClick={() => onToggle?.(row)}
          />
        ) : null}
      </div>
    </div>
  );
};

const ItemBlock = ({ item, disabled, onToggle, focusRowId }) => {
  const [expanded, setExpanded] = useState(true);
  const displayPoints = item.points;
  const itemLeafRows = collectItemActionableRows(item);
  const hasPointChildren = displayPoints.length > 0;
  const isLeafItem = !hasPointChildren && itemLeafRows.length > 0;
  const itemRows = useMemo(
    () => [item.row, ...displayPoints.map((point) => point?.row)].filter(Boolean),
    [displayPoints, item.row],
  );
  const containsFocusRow = useMemo(
    () => includesFocusRow(itemRows, focusRowId),
    [focusRowId, itemRows],
  );
  const summary = summarizeStatuses(itemLeafRows);
  const itemTone =
    summary.total > 0 && summary.done === summary.total
      ? "is-complete"
      : summary.done > 0
        ? "is-active"
        : "is-pending";

  useEffect(() => {
    if (containsFocusRow) {
      setExpanded(true);
    }
  }, [containsFocusRow]);

  return (
    <div className={`procurement-checklist-item ${itemTone}`}>
      <div className="procurement-checklist-item__header">
        <ChecklistLeaf
          row={item.row}
          code={item.code}
          title={item.title}
          disabled={disabled}
          levelLabel="Item"
          showToggle={isLeafItem}
          onToggle={onToggle}
        />

        {hasPointChildren ? (
          <button
            type="button"
            className="procurement-collapse-button"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>{displayPoints.length} checklist</span>
            <StatusTone
              status={summary.done === summary.total && summary.total > 0 ? "Done" : "Not Yet"}
            />
          </button>
        ) : !isLeafItem ? (
          <div className="procurement-checklist-item__empty-note">
            Belum ada checklist.
          </div>
        ) : null}
      </div>

      {expanded && hasPointChildren ? (
        <div className="procurement-checklist-points">
          {displayPoints.map((point, index) => (
            <ChecklistLeaf
              key={point.id}
              row={point.row}
              title={point.title}
              disabled={disabled}
              isPoint={true}
              levelLabel="Checklist"
              onToggle={onToggle}
              code={`${item.code || "p"}${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const StepBlock = ({ step, disabled, onToggle, focusRowId }) => {
  const [expanded, setExpanded] = useState(true);
  const actionableRows = useMemo(() => collectNodeRows(step), [step]);
  const stepRows = useMemo(
    () => [step.row, ...actionableRows].filter(Boolean),
    [actionableRows, step.row],
  );
  const containsFocusRow = useMemo(
    () => includesFocusRow(stepRows, focusRowId),
    [focusRowId, stepRows],
  );
  const summary = summarizeStatuses(actionableRows);
  const isLeafStep =
    (!Array.isArray(step.items) || step.items.length === 0) &&
    isActionableStatusRow(step.row);
  const stepTone =
    summary.total > 0 && summary.done === summary.total
      ? "is-complete"
      : summary.done > 0
      ? "is-active"
      : "is-pending";

  useEffect(() => {
    if (containsFocusRow) {
      setExpanded(true);
    }
  }, [containsFocusRow]);

  return (
    <div className={`procurement-checklist-step ${stepTone}`}>
      <button
        type="button"
        className="procurement-checklist-step__header"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="procurement-checklist-step__identity">
          <span className="procurement-checklist-step__code">{step.code}</span>
          <div className="procurement-checklist-step__copy">
            <div className="procurement-checklist-step__meta">
              <LevelBadge label="Step" />
            </div>
            <div className="procurement-checklist-step__title">{step.title}</div>
          </div>
        </div>
        <div className="procurement-checklist-step__summary">
          <span className="procurement-checklist-summary-chip">
            {summary.done}/{summary.total} selesai
          </span>
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>

      {expanded ? (
        <div className="procurement-checklist-step__body">
          {isLeafStep ? (
            <ChecklistLeaf
              row={step.row}
              title={step.title}
              disabled={disabled}
              levelLabel="Step"
              onToggle={onToggle}
            />
          ) : null}
          {step.items.map((item) => (
            <ItemBlock
              key={item.id}
              item={item}
              disabled={disabled}
              onToggle={onToggle}
              focusRowId={focusRowId}
            />
          ))}
        </div>
      ) : !isLeafStep ? (
        <div className="procurement-checklist-step__body">
          <div className="procurement-checklist-step__empty-note">
            Belum ada item atau checklist.
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SectionBlock = ({ section, disabled, onToggle, focusRowId }) => {
  const [expanded, setExpanded] = useState(true);
  const sectionRows = useMemo(
    () =>
      section.steps.flatMap((step) => [
        step.row,
        ...(Array.isArray(step.items)
          ? step.items.flatMap((item) => [
              item?.row,
              ...(Array.isArray(item?.points)
                ? item.points.map((point) => point?.row)
                : []),
            ])
          : []),
      ]),
    [section.steps],
  );
  const containsFocusRow = useMemo(
    () => includesFocusRow(sectionRows, focusRowId),
    [focusRowId, sectionRows],
  );
  const summary = summarizeStatuses(
    section.steps.flatMap((step) => collectNodeRows(step)),
  );
  const sectionTone =
    summary.total > 0 && summary.done === summary.total
      ? "is-complete"
      : summary.done > 0
      ? "is-active"
      : "is-pending";

  useEffect(() => {
    if (containsFocusRow) {
      setExpanded(true);
    }
  }, [containsFocusRow]);

  return (
    <Card className={`procurement-checklist-section ${sectionTone}`}>
      <button
        type="button"
        className="procurement-checklist-section__header"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="procurement-checklist-section__identity">
          <span className="procurement-checklist-section__code">{section.code}</span>
          <div className="procurement-checklist-section__copy">
            <div className="procurement-checklist-section__meta">
              <LevelBadge label="Section" />
            </div>
            <div className="procurement-checklist-section__title">{section.title}</div>
            <div className="procurement-checklist-section__subtitle">
              {summary.done}/{summary.total} checklist selesai
            </div>
          </div>
        </div>
        {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {expanded ? (
        <div className="procurement-checklist-section__body">
          {section.steps.map((step) => (
            <StepBlock
              key={step.id}
              step={step}
              disabled={disabled}
              onToggle={onToggle}
              focusRowId={focusRowId}
            />
          ))}
        </div>
      ) : null}
    </Card>
  );
};

const TablePassed = ({
  endpoint = "StatusPengadaan",
  title,
  foreignKey,
  id,
  onCheckpointApplied,
}) => {
  const [rows, setRows] = useState([]);
  const [dynamicTitle, setDynamicTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState([]);
  const [pendingFocusRowId, setPendingFocusRowId] = useState(null);
  const [hasInitialFocus, setHasInitialFocus] = useState(false);

  const API_ROOT = process.env.REACT_APP_API_BASE_URL.replace(/\/$/, "");
  const patchUrlBase = `${API_ROOT}/${endpoint.replace(/^\//, "")}`;
  const rowsBaseUrl = `${API_ROOT}/${endpoint.replace(/^\//, "")}/${foreignKey}/${id}`;
  const infoBaseUrl = `${API_ROOT}/${
    foreignKey === "newprocure" ? "NewProcure" : "ExistingProcure"
  }/${id}`;
  const syncUrl = `${API_ROOT}/StatusPengadaan/update-latest-status/${foreignKey}/${id}`;

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const ts = Date.now();
      const requestUrl = `${rowsBaseUrl}${rowsBaseUrl.includes("?") ? "&" : "?"}_ts=${ts}`;
      const response = await fetch(requestUrl, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = await response.json();
      setRows(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load status pengadaan rows:", error);
      setRows([]);
      toast.error("Gagal memuat checklist Status Pengadaan.");
    } finally {
      setLoading(false);
    }
  }, [rowsBaseUrl]);

  const loadTitle = useCallback(async () => {
    try {
      const ts = Date.now();
      const requestUrl = `${infoBaseUrl}${infoBaseUrl.includes("?") ? "&" : "?"}_ts=${ts}`;
      const response = await fetch(requestUrl, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const baseTitle =
        data?.Perjanjian ||
        (foreignKey === "newprocure"
          ? "Untitled New Procurement"
          : "Untitled Existing Procurement");
      const statusText = data?.Status_Pengadaan || "Unknown";

      setDynamicTitle(`${baseTitle} - Status: ${statusText}`);
    } catch (error) {
      console.error("Failed to load procurement title:", error);
      setDynamicTitle("Status Pengadaan");
    }
  }, [foreignKey, infoBaseUrl]);

  useEffect(() => {
    loadRows();
    loadTitle();
  }, [loadRows, loadTitle]);

  useEffect(() => {
    setHasInitialFocus(false);
    setPendingFocusRowId(null);
  }, [foreignKey, id]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon(syncUrl);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      fetch(syncUrl, {
        method: "POST",
        credentials: "include",
      }).catch((error) => {
        console.error("Failed to sync latest procurement status:", error);
      });
    };
  }, [syncUrl]);

  useEffect(() => {
    if (!pendingFocusRowId || loading) {
      return undefined;
    }

    let attempts = 0;
    let timerId;
    const targetId = getChecklistRowAnchorId(pendingFocusRowId);
    const tryFocusRow = () => {
      if (!targetId) {
        setPendingFocusRowId(null);
        return;
      }

      const target =
        document.getElementById(targetId) ||
        Array.from(document.querySelectorAll("[data-row-key]")).find(
          (node) => node.getAttribute("data-row-key") === String(pendingFocusRowId),
        );
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
        target.classList.add("is-focus-highlight");
        window.setTimeout(() => {
          target.classList.remove("is-focus-highlight");
        }, 1600);
        setPendingFocusRowId(null);
        return;
      }

      attempts += 1;
      if (attempts >= 20) {
        setPendingFocusRowId(null);
        return;
      }

      timerId = window.setTimeout(tryFocusRow, 80);
    };

    timerId = window.setTimeout(tryFocusRow, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [loading, pendingFocusRowId, rows]);

  useEffect(() => {
    if (loading || hasInitialFocus || pendingFocusRowId) {
      return;
    }

    const initialRowId = resolveCurrentCheckpointRowId(rows);
    if (initialRowId) {
      setPendingFocusRowId(initialRowId);
    }
    setHasInitialFocus(true);
  }, [hasInitialFocus, loading, pendingFocusRowId, rows]);

  const sections = useMemo(() => buildChecklistTree(rows), [rows]);
  const orderedSections = useMemo(() => {
    if (!Array.isArray(sections) || sections.length === 0) {
      return [];
    }

    const target = sections.find(
      (section) => String(section?.code ?? "").trim().toUpperCase() === "A",
    );
    if (!target) {
      return sections;
    }

    return [target, ...sections.filter((section) => section !== target)];
  }, [sections]);
  const summary = useMemo(() => summarizeStatuses(rows), [rows]);
  const currentCheckpoint = useMemo(() => {
    const sectionA = orderedSections.find(
      (section) => String(section?.code ?? "").trim().toUpperCase() === "A",
    );
    if (sectionA) {
      const sectionTitle = String(sectionA?.title ?? "").trim();
      return sectionTitle ? `A. ${sectionTitle}` : "A";
    }

    const firstSection = orderedSections[0];
    if (firstSection) {
      const code = String(firstSection?.code ?? "").trim();
      const sectionTitle = String(firstSection?.title ?? "").trim();
      if (code && sectionTitle) {
        return `${code}. ${sectionTitle}`;
      }
      return sectionTitle || code || "Belum ada checklist aktif";
    }

    return resolveCurrentCheckpoint(rows);
  }, [orderedSections, rows]);

  const handleToggleStatus = useCallback(
    async (row) => {
      const rowId = Number(row?.Id);
      if (!Number.isFinite(rowId) || rowId <= 0) {
        toast.error("Checkpoint tidak valid: baris status tidak ditemukan.");
        return;
      }

      setSavingIds((current) => [...current, rowId]);

      try {
        const response = await fetch(
          `${API_ROOT}/StatusPengadaan/checkpoint/${foreignKey}/${id}/${rowId}`,
          {
            method: "POST",
            credentials: "include",
          },
        );

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to apply checkpoint");
        }

        if (typeof onCheckpointApplied === "function") {
          onCheckpointApplied({
            procurementId: id,
            checklistRowId: rowId,
            foreignKey,
          });
        } else {
          await loadRows();
          await loadTitle();
          setPendingFocusRowId(rowId);
        }
      } catch (error) {
        console.error("Failed to update status pengadaan checkpoint:", error);
        const message =
          typeof error?.message === "string" && error.message.trim().length
            ? error.message
            : "Gagal memperbarui checkpoint checklist.";
        toast.error(message);
      } finally {
        setSavingIds((current) => current.filter((value) => value !== rowId));
      }
    },
    [API_ROOT, foreignKey, id, loadRows, loadTitle, onCheckpointApplied],
  );

  return (
    <div className="procurement-status-tree">
      <Col md="12" className="project-list">
        <Card className="procurement-status-tree__header-card">
          <Row className="align-items-center">
            <Col xl="8" lg="7">
              <div className="procurement-status-tree__headline">
                <div className="procurement-status-tree__icon-wrap">
                  <Layers size={22} />
                </div>
                <div>
                  <div className="procurement-status-tree__eyebrow">
                    Status Pengadaan
                  </div>
                  <h3 className="procurement-status-tree__title">
                    {title || dynamicTitle || "Checklist Pengadaan"}
                  </h3>
                  <div className="procurement-status-tree__current-chip">
                    Posisi saat ini: <strong>{currentCheckpoint}</strong>
                  </div>
                </div>
              </div>
            </Col>

            <Col xl="4" lg="5">
              <div className="procurement-status-tree__summary">
                <div className="procurement-status-tree__summary-card">
                  <span className="label">Progress</span>
                  <strong>{summary.progress}%</strong>
                </div>
                <div className="procurement-status-tree__summary-card">
                  <span className="label">Done</span>
                  <strong>{summary.done}</strong>
                </div>
                <div className="procurement-status-tree__summary-card">
                  <span className="label">Remaining</span>
                  <strong>{summary.remaining}</strong>
                </div>
                <div className="procurement-status-tree__summary-card">
                  <span className="label">Total</span>
                  <strong>{summary.total}</strong>
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </Col>

      {loading ? (
        <Card className="procurement-status-tree__feedback">
          <Spinner size="sm" />
          <span>Memuat checklist procurement...</span>
        </Card>
      ) : orderedSections.length === 0 ? (
        <Card className="procurement-status-tree__feedback is-empty">
          <List size={18} />
          <span>Belum ada struktur Status Pengadaan untuk procurement ini.</span>
        </Card>
      ) : (
        <div className="procurement-status-tree__sections">
          {orderedSections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              disabled={savingIds.length > 0}
              onToggle={handleToggleStatus}
              focusRowId={pendingFocusRowId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TablePassed;
