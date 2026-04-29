/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/CreatedByme.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useRef, useState } from "react";
import { Trash2 } from "react-feather";
import { Button, CardBody, Input, Table } from "@pgh/ui-bootstrap";

import { H6, P } from "../../../AbstractElements";
import ComplianceEventFileCell from "./ComplianceEventFileCell";

const DECIMAL_PROGRESS_PATTERN = /^(100(\.0{0,2})?|([0-9]{1,2})(\.[0-9]{0,2})?)?$/;
const detectDarkOnlyTheme = () =>
  typeof document !== "undefined" &&
  document.body?.classList?.contains("dark-only");

const getProgressDisplay = (row) => {
  const raw = String(
    row?.ProgressPercent ?? row?.progressPercent ?? row?.Status ?? row?.status ?? "",
  ).trim();

  if (!raw) {
    return row?.DocumentId || row?.FileName ? "No Progress" : "No Upload";
  }

  const parsed = Number(raw.replace("%", ""));
  if (Number.isFinite(parsed)) {
    return `${parsed}%`;
  }

  return raw;
};

const sanitizeProgressInput = (value) =>
  String(value ?? "")
    .trim()
    .replace("%", "");

const isInternalDocumentPath = (value) => {
  const raw = String(value || "").trim();

  if (!raw) {
    return false;
  }

  return /(^|\/)api\/documents\/.+\/file$/i.test(raw);
};

const isValidExternalLink = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getUserLinkValue = (value) => {
  const raw = String(value || "").trim();

  if (!raw || isInternalDocumentPath(raw)) {
    return "";
  }

  return raw;
};

const resolveLinkHref = (value) => {
  const raw = getUserLinkValue(value);
  if (!isValidExternalLink(raw)) {
    return "";
  }

  return raw;
};

const getLinkDisplay = (value) => {
  const raw = getUserLinkValue(value);

  if (!raw) {
    return "...";
  }

  return raw.length > 40 ? `${raw.slice(0, 40)}...` : raw;
};

const resolveDraftFromRow = (row, field) => {
  if (field === "DocumentToSubmit") {
    return row?.DocumentToSubmit || "";
  }

  if (field === "Link") {
    return getUserLinkValue(row?.Link);
  }

  if (field === "ProgressPercent") {
    return sanitizeProgressInput(
      row?.ProgressPercent ?? row?.progressPercent ?? row?.Status ?? row?.status,
    );
  }

  return "";
};

const getProgressTone = (value) => {
  const progress = parseFloat(String(value ?? "").replace("%", ""));

  if (!Number.isFinite(progress) || progress <= 0) {
    return {
      background: "rgba(148, 163, 184, 0.16)",
      color: "#64748B",
      border: "rgba(148, 163, 184, 0.22)",
    };
  }

  if (progress >= 100) {
    return {
      background: "rgba(21, 128, 61, 0.16)",
      color: "#166534",
      border: "rgba(21, 128, 61, 0.22)",
    };
  }

  if (progress >= 75) {
    return {
      background: "rgba(34, 197, 94, 0.14)",
      color: "#15803D",
      border: "rgba(34, 197, 94, 0.22)",
    };
  }

  if (progress >= 50) {
    return {
      background: "rgba(245, 158, 11, 0.14)",
      color: "#B45309",
      border: "rgba(245, 158, 11, 0.22)",
    };
  }

  return {
    background: "rgba(14, 165, 233, 0.14)",
    color: "#0369A1",
    border: "rgba(14, 165, 233, 0.22)",
  };
};

const CreatedByme = ({
  docs = [],
  totalCount = docs.length,
  onDelete,
  onUpdate,
  onUploadDocument,
  highlightRowId,
  canManageCompliance,
  showGroupColumn = false,
}) => {
  const [editingCell, setEditingCell] = useState(null);
  const [draftValue, setDraftValue] = useState("");
  const [progressError, setProgressError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(detectDarkOnlyTheme);
  const skipBlurSaveRef = useRef(false);
  const saveInFlightRef = useRef(null);

  useEffect(() => {
    setEditingCell(null);
    setDraftValue("");
    setProgressError("");
    setLinkError("");
  }, [docs]);

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) {
      return undefined;
    }

    const syncThemeMode = () => {
      setIsDarkTheme(detectDarkOnlyTheme());
    };

    syncThemeMode();

    const observer = new MutationObserver(syncThemeMode);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const getRowBackground = (rowId) => {
    const isHighlighted = highlightRowId === rowId;
    const isHovered = hoveredRowId === rowId;

    if (isDarkTheme) {
      if (isHighlighted) {
        return isHovered ? "#202938" : "transparent";
      }

      return isHovered ? "#202938" : "transparent";
    }

    if (isHighlighted) {
      return isHovered ? "rgba(241, 90, 34, 0.1)" : "transparent";
    }

    return isHovered ? "rgba(241, 90, 34, 0.1)" : "transparent";
  };

  const getRowAccent = (rowId) =>
    highlightRowId === rowId ? "inset 4px 0 0 rgba(241, 90, 34, 0.72)" : "none";

  const getCellStyle = (rowId, isFirstCell = false) => ({
    backgroundColor: getRowBackground(rowId),
    transition: "background-color 0.2s ease",
    boxShadow: isFirstCell ? getRowAccent(rowId) : "none",
  });

  const palette = isDarkTheme
    ? {
        shellBackground: "#111827",
        shellBorder: "rgba(148, 163, 184, 0.18)",
        headerBackground: "rgba(15, 23, 42, 0.96)",
        headerText: "#CBD5E1",
        headerBorder: "rgba(148, 163, 184, 0.14)",
        metaBackground: "rgba(15, 23, 42, 0.88)",
        metaText: "#94A3B8",
        bodyText: "#E2E8F0",
        mutedText: "#94A3B8",
        rowBorder: "rgba(71, 85, 105, 0.38)",
        actionBackground: "rgba(30, 41, 59, 0.9)",
        actionBorder: "rgba(148, 163, 184, 0.16)",
        actionText: "#E2E8F0",
      }
    : {
        shellBackground: "#FFFFFF",
        shellBorder: "rgba(36, 54, 74, 0.10)",
        headerBackground: "#F8FAFC",
        headerText: "#475569",
        headerBorder: "rgba(36, 54, 74, 0.10)",
        metaBackground: "#FFF7ED",
        metaText: "#475569",
        bodyText: "#0F172A",
        mutedText: "#64748B",
        rowBorder: "rgba(36, 54, 74, 0.08)",
        actionBackground: "#FFFFFF",
        actionBorder: "rgba(36, 54, 74, 0.10)",
        actionText: "#0F172A",
      };

  const beginEdit = (row, field) => {
    if (!canManageCompliance) {
      return;
    }

    setEditingCell({ rowId: row.Id, field });
    setDraftValue(resolveDraftFromRow(row, field));
    setProgressError("");
    setLinkError("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setDraftValue("");
    setProgressError("");
    setLinkError("");
  };

  const saveEdit = async (row) => {
    if (!editingCell || editingCell.rowId !== row.Id) {
      return;
    }

    const cellKey = `${editingCell.rowId}:${editingCell.field}`;
    if (saveInFlightRef.current === cellKey) {
      return;
    }

    const trimmedValue = draftValue.trim();
    let payload = {};
    if (editingCell.field === "ProgressPercent") {
      const normalized = sanitizeProgressInput(trimmedValue);
      if (!DECIMAL_PROGRESS_PATTERN.test(normalized)) {
        setProgressError("Use decimal with dot only, example 18.7");
        return;
      }

      payload = {
        ProgressPercent: normalized === "" ? null : Number(normalized),
      };
    }

    if (editingCell.field === "DocumentToSubmit") {
      payload = {
        DocumentToSubmit: trimmedValue,
      };
    }

    if (editingCell.field === "Link") {
      if (trimmedValue && !isValidExternalLink(trimmedValue)) {
        setLinkError("Use full external URL, example https://example.com");
        return;
      }

      payload = {
        Link: trimmedValue || null,
      };
    }

    saveInFlightRef.current = cellKey;

    const pendingUpdate = Promise.resolve(onUpdate?.(row.Id, payload));
    cancelEdit();

    try {
      await pendingUpdate;
    } finally {
      if (saveInFlightRef.current === cellKey) {
        saveInFlightRef.current = null;
      }
    }
  };

  const handleBlurSave = (row) => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }

    saveEdit(row);
  };

  const handleEscapeCancel = () => {
    skipBlurSaveRef.current = true;
    cancelEdit();
  };

  const renderEditableCell = (row, field) => {
    const isEditing =
      editingCell?.rowId === row.Id && editingCell?.field === field;

    if (field === "DocumentToSubmit") {
      return isEditing ? (
        <div onClick={(event) => event.stopPropagation()}>
          <Input
            type="text"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveEdit(row);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleEscapeCancel();
              }
            }}
            onBlur={() => handleBlurSave(row)}
            autoFocus
          />
        </div>
      ) : (
        <div
          onClick={() => beginEdit(row, field)}
          style={{ cursor: canManageCompliance ? "pointer" : "default" }}
        >
          <H6 className="task_title_0 mb-1" style={{ color: palette.bodyText }}>
            {row.DocumentToSubmit || "Untitled"}
          </H6>
        </div>
      );
    }

    if (field === "DocumentId") {
      return (
        <ComplianceEventFileCell
          row={row}
          onUploadDocument={onUploadDocument}
          canManageCompliance={canManageCompliance}
        />
      );
    }

    if (field === "ProgressPercent") {
      return isEditing ? (
        <div onClick={(event) => event.stopPropagation()}>
          <Input
            type="text"
            inputMode="decimal"
            value={draftValue}
            onChange={(event) => {
              const nextValue = sanitizeProgressInput(event.target.value);
              setDraftValue(nextValue);
              if (!DECIMAL_PROGRESS_PATTERN.test(nextValue)) {
                setProgressError("Use decimal with dot only, example 18.7");
              } else {
                setProgressError("");
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveEdit(row);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleEscapeCancel();
              }
            }}
            onBlur={() => handleBlurSave(row)}
            placeholder="18.7"
            autoFocus
            invalid={Boolean(progressError)}
          />
          {progressError ? (
            <div className="text-danger mt-1" style={{ fontSize: "0.75rem" }}>
              {progressError}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          onClick={() => beginEdit(row, field)}
          style={{ cursor: canManageCompliance ? "pointer" : "default" }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.35rem 0.7rem",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 600,
              border: `1px solid ${getProgressTone(getProgressDisplay(row)).border}`,
              background: getProgressTone(getProgressDisplay(row)).background,
              color: getProgressTone(getProgressDisplay(row)).color,
            }}
          >
            {getProgressDisplay(row)}
          </span>
        </div>
      );
    }

    if (field === "Link") {
      const resolvedLink = resolveLinkHref(row.Link);
      const hasLink = Boolean(resolvedLink);

      return isEditing ? (
        <div onClick={(event) => event.stopPropagation()}>
          <Input
            type="text"
            value={draftValue}
            onChange={(event) => {
              setDraftValue(event.target.value);
              setLinkError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveEdit(row);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleEscapeCancel();
              }
            }}
            onBlur={() => handleBlurSave(row)}
            placeholder="https://..."
            autoFocus
            invalid={Boolean(linkError)}
          />
          {linkError ? (
            <div className="text-danger mt-1" style={{ fontSize: "0.75rem" }}>
              {linkError}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          onClick={() => beginEdit(row, field)}
          style={{ cursor: canManageCompliance ? "pointer" : "default" }}
        >
          <P
            className="task_desc_0 mb-1"
            style={{ color: hasLink ? palette.bodyText : palette.mutedText }}
          >
            {getLinkDisplay(row.Link)}
          </P>
          {hasLink ? (
            <a
              href={resolvedLink}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              Open link
            </a>
          ) : (
            <P className="task_desc_0 mb-0" style={{ color: palette.mutedText }}>
              Click to add external link
            </P>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Fragment>
      <CardBody className="compliance-events-table-card-body pt-0 px-0 pb-3">
        <div className="compliance-events-table-wrap">
          <div
            className="compliance-events-table-shell"
            style={{
              border: `1px solid ${palette.shellBorder}`,
              borderRadius: "10px",
              background: palette.shellBackground,
              overflow: "hidden",
            }}
          >
            <div
              className="compliance-events-table-meta d-flex align-items-center justify-content-between"
              style={{
                padding: "0.85rem 1rem",
                borderBottom: `1px solid ${palette.headerBorder}`,
                background: palette.metaBackground,
              }}
            >
              <div style={{ color: palette.metaText, fontSize: "0.82rem" }}>
                <strong>{totalCount}</strong> document row{totalCount === 1 ? "" : "s"}
              </div>
              <div style={{ color: palette.metaText, fontSize: "0.8rem" }}>
                {canManageCompliance
                  ? "Click Title, Progress, or Link to edit"
                  : "View only"}
              </div>
            </div>
            <div className="compliance-events-table-scroll">
            <Table className="mb-0 compliance-events-table">
              <thead>
                <tr>
                  <th
                    className="compliance-events-table__head"
                    style={{
                      background: palette.headerBackground,
                      color: palette.headerText,
                      borderBottom: `1px solid ${palette.headerBorder}`,
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "0.95rem 1rem",
                      textAlign: "left",
                      width: showGroupColumn ? "18%" : "0",
                      display: showGroupColumn ? "table-cell" : "none",
                    }}
                  >
                    Compliance Events
                  </th>
                  <th
                    className="compliance-events-table__head"
                    style={{
                      background: palette.headerBackground,
                      color: palette.headerText,
                      borderBottom: `1px solid ${palette.headerBorder}`,
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "0.95rem 1rem",
                      textAlign: "left",
                      width: "34%",
                    }}
                  >
                    Title
                  </th>
                  <th
                    className="compliance-events-table__head"
                    style={{
                      background: palette.headerBackground,
                      color: palette.headerText,
                      borderBottom: `1px solid ${palette.headerBorder}`,
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "0.95rem 1rem",
                      textAlign: "center",
                      width: "24%",
                    }}
                  >
                    File
                  </th>
                  <th
                    className="compliance-events-table__head"
                    style={{
                      background: palette.headerBackground,
                      color: palette.headerText,
                      borderBottom: `1px solid ${palette.headerBorder}`,
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "0.95rem 1rem",
                      textAlign: "left",
                      width: "14%",
                    }}
                  >
                    Progress
                  </th>
                  <th
                    className="compliance-events-table__head"
                    style={{
                      background: palette.headerBackground,
                      color: palette.headerText,
                      borderBottom: `1px solid ${palette.headerBorder}`,
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "0.95rem 1rem",
                      textAlign: "left",
                      width: "22%",
                    }}
                  >
                    Link
                  </th>
                  <th
                    className="compliance-events-table__head compliance-events-table__head--center"
                    style={{
                      background: palette.headerBackground,
                      color: palette.headerText,
                      borderBottom: `1px solid ${palette.headerBorder}`,
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "0.95rem 1rem",
                      textAlign: "center",
                      width: "6%",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {docs.length ? (
                  docs.map((row) => (
                    <tr
                      key={row.Id}
                      id={`compliance-event-row-${row.Id}`}
                      className={highlightRowId === row.Id ? "highlighted-row" : ""}
                      onMouseEnter={() => setHoveredRowId(row.Id)}
                      onMouseLeave={() => setHoveredRowId((currentId) =>
                        currentId === row.Id ? null : currentId)}
                    >
                      <td
                        className="align-middle compliance-events-table__cell"
                        style={{
                          ...getCellStyle(row.Id),
                          borderBottom: `1px solid ${palette.rowBorder}`,
                          padding: "1rem",
                          textAlign: "left",
                          display: showGroupColumn ? "table-cell" : "none",
                        }}
                      >
                        <div
                          className="compliance-events-table__group-text"
                          title={row.PeriodName || "Unknown Event"}
                        >
                          {row.PeriodName || "Unknown Event"}
                        </div>
                      </td>
                      <td
                        className="align-middle compliance-events-table__cell"
                        style={{
                          ...getCellStyle(row.Id, true),
                          borderBottom: `1px solid ${palette.rowBorder}`,
                          padding: "1rem",
                        }}
                      >
                        <div className="d-flex align-items-center">
                          <span
                            style={{
                              display: "inline-block",
                              width: "11px",
                              height: "11px",
                              borderRadius: "50%",
                              marginRight: "10px",
                              backgroundColor: row.DocumentId ? "#16A34A" : "#EF4444",
                              flexShrink: 0,
                              boxShadow: row.DocumentId
                                ? "0 0 0 4px rgba(22, 163, 74, 0.12)"
                                : "0 0 0 4px rgba(239, 68, 68, 0.12)",
                            }}
                          />
                          <div style={{ width: "100%", textAlign: "left" }}>
                            {renderEditableCell(row, "DocumentToSubmit")}
                          </div>
                        </div>
                      </td>
                      <td
                        className="align-middle compliance-events-table__cell"
                        style={{
                          ...getCellStyle(row.Id),
                          borderBottom: `1px solid ${palette.rowBorder}`,
                          padding: "1rem",
                          textAlign: "center",
                        }}
                      >
                        {renderEditableCell(row, "DocumentId")}
                      </td>
                      <td
                        className="align-middle compliance-events-table__cell"
                        style={{
                          ...getCellStyle(row.Id),
                          borderBottom: `1px solid ${palette.rowBorder}`,
                          padding: "1rem",
                          textAlign: "left",
                        }}
                      >
                        {renderEditableCell(row, "ProgressPercent")}
                      </td>
                      <td
                        className="align-middle compliance-events-table__cell"
                        style={{
                          ...getCellStyle(row.Id),
                          borderBottom: `1px solid ${palette.rowBorder}`,
                          padding: "1rem",
                          textAlign: "left",
                        }}
                      >
                        {renderEditableCell(row, "Link")}
                      </td>
                      <td
                        className="align-middle compliance-events-table__cell compliance-events-table__cell--center"
                        style={{
                          ...getCellStyle(row.Id),
                          borderBottom: `1px solid ${palette.rowBorder}`,
                          padding: "1rem",
                          textAlign: "center",
                        }}
                      >
                        {canManageCompliance ? (
                          <Button
                            color="light"
                            size="sm"
                            className="compliance-events-table__delete-btn"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onDelete?.(row);
                            }}
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "12px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: `1px solid ${palette.actionBorder}`,
                              background: palette.actionBackground,
                              color: "#f15a22",
                              padding: 0,
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={showGroupColumn ? "6" : "5"}>
                      <div className="compliance-events-table__empty">
                        <span>No Documents Found</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
            </div>
          </div>
        </div>
      </CardBody>
    </Fragment>
  );
};

export default CreatedByme;
