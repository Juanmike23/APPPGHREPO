/*
 * PGH-DOC
 * File: src/Variables/ActionCell/ChangeLogModal.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock } from "react-feather";
import {
  Badge,
  Button,
  Col,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
  Table,
} from "@pgh/ui-bootstrap";

import "../Table/TableToolBarElement/Mobile.scss";
import {
  getListAuditColumnLabel,
  isListAuditTarget,
} from "../../Components/Audit/Utils/columnHelpers";
import {
  sanitizeSearchInput,
  SEARCH_INPUT_MAX_LENGTH,
} from "../Table/filters/search";

const CHANGE_TYPE_OPTIONS = [
  { value: "all", label: "Semua aksi" },
  { value: "POST", label: "Tambah" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Hapus" },
];
const CHANGE_LOG_DEFAULT_PAGE_SIZE = 25;
const CHANGE_LOG_PAGE_SIZE_OPTIONS = [25, 50, 100];

const getLogValue = (log, key) =>
  log?.[key] ?? log?.[key?.charAt(0)?.toLowerCase() + key?.slice(1)] ?? null;

const normalizeText = (value) =>
  sanitizeSearchInput(value).trim().toLowerCase();

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const getChangeTypeBadge = (changeType) => {
  switch (String(changeType ?? "").toUpperCase()) {
    case "POST":
      return { color: "success", label: "Tambah" };
    case "DELETE":
      return { color: "danger", label: "Hapus" };
    case "UPDATE":
      return { color: "warning", label: "Update" };
    case "IMPORT":
      return { color: "info", label: "Import" };
    default:
      return { color: "secondary", label: changeType || "-" };
  }
};

const getChangedByDisplay = (log) => {
  const display =
    getLogValue(log, "ChangedByDisplay") ||
    getLogValue(log, "ChangedByName") ||
    getLogValue(log, "ChangedByEmail");

  return {
    text: display || getLogValue(log, "ChangedBy") || "-",
    raw: getLogValue(log, "ChangedBy") || "",
    level: getLogValue(log, "ChangedByLevel") || "",
  };
};

const humanizeValue = (value) => {
  if (value == null || value === "") {
    return "Kosong";
  }

  return String(value);
};

const getScopeLabel = (scope, titleLabel, recordId) => {
  switch (scope) {
    case "entity":
      return `Log per baris untuk ID ${recordId}`;
    case "table-selection":
      return `Log untuk ${titleLabel}`;
    case "user-post":
      return `Log data yang dibuat pengguna`;
    case "table":
    default:
      return `Log keseluruhan tabel ${titleLabel}`;
  }
};

const extractLegacyDetails = (summary, tableName) => {
  const raw = String(summary ?? "").trim();
  if (!raw) {
    return [];
  }

  const fieldMatch = raw.match(
    /Field\s+'(?<field>[^']+)'\s+changed\s+from\s+'(?<before>[^']*)'\s+to\s+'(?<after>[^']*)'/i,
  );

  if (!fieldMatch?.groups?.field) {
    return [];
  }

  const field = fieldMatch.groups.field;
  const label =
    isListAuditTarget(tableName) ? getListAuditColumnLabel(field) : field;

  return [
    {
      Field: field,
      Label: label,
      Before: fieldMatch.groups.before || null,
      After: fieldMatch.groups.after || null,
    },
  ];
};

const getChangeDetails = (log, tableName) => {
  const rawDetails = getLogValue(log, "ChangeDetails");
  if (Array.isArray(rawDetails) && rawDetails.length > 0) {
    return rawDetails.map((detail) => {
      const rawField = detail?.Field || detail?.field || "";
      return {
        Field: rawField,
        Label:
          detail?.Label ||
          detail?.label ||
          (isListAuditTarget(tableName)
            ? getListAuditColumnLabel(rawField)
            : rawField),
        Before: detail?.Before ?? detail?.before ?? null,
        After: detail?.After ?? detail?.after ?? null,
      };
    });
  }

  return extractLegacyDetails(getLogValue(log, "ChangeSummary"), tableName);
};

const getSummaryDisplay = (log) =>
  getLogValue(log, "ChangeSummaryDisplay") ||
  getLogValue(log, "ChangeSummary") ||
  "-";

const parseChangedField = (log, tableName) => {
  const details = getChangeDetails(log, tableName);
  if (details.length > 0) {
    return details[0].Field;
  }

  const summary = String(getLogValue(log, "ChangeSummary") ?? "").trim();
  const fieldMatch = summary.match(/Field\s+'([^']+)'/i);
  return fieldMatch?.[1] || null;
};

const canNavigateFromLog = (log) => {
  const changeType = String(getLogValue(log, "ChangeType") ?? "").toUpperCase();
  const entityId = getLogValue(log, "EntityId");
  return Boolean(entityId && changeType !== "DELETE");
};

const getLogRowId = (log) =>
  String(
    getLogValue(log, "Id") ||
      `${getLogValue(log, "EntityId") || "table"}-${getLogValue(log, "Timestamp") || "unknown"}`,
  );

const formatDetailDescription = (detail, changeType) => {
  const normalizedType = String(changeType ?? "").toUpperCase();

  if (normalizedType === "DELETE") {
    return (
      <>
        <strong>{detail.Label}</strong>: <strong>{humanizeValue(detail.Before)}</strong>
      </>
    );
  }

  if (normalizedType === "POST") {
    return (
      <>
        <strong>{detail.Label}</strong>: <strong>{humanizeValue(detail.After)}</strong>
      </>
    );
  }

  return (
    <>
      <strong>{detail.Label}</strong>: dari{" "}
      <strong>{humanizeValue(detail.Before)}</strong> menjadi{" "}
      <strong>{humanizeValue(detail.After)}</strong>
    </>
  );
};

const ChangeLogModal = ({
  tableName,
  titleLabel = null,
  recordId,
  scopeTableName = null,
  scopeEntityId = null,
  showLastUpdated = true,
  onNavigateToChange,
  allowNavigateToChange = true,
  triggerMode = "inline",
  triggerLabel = "Riwayat Perubahan",
}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [changeTypeFilter, setChangeTypeFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [expandedDetails, setExpandedDetails] = useState({});
  const [listMeta, setListMeta] = useState({
    totalCount: 0,
    returnedCount: 0,
    limit: CHANGE_LOG_DEFAULT_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    scope:
      recordId
        ? "entity"
        : scopeTableName && scopeEntityId
          ? "table-selection"
          : "table",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(CHANGE_LOG_DEFAULT_PAGE_SIZE);
  const effectiveTitleLabel = titleLabel || tableName;

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    setPage(1);
    setExpandedDetails({});
  }, [isOpen, recordId, scopeEntityId, scopeTableName, tableName]);

  useEffect(() => {
    if (!isOpen || !tableName) {
      return undefined;
    }

    let cancelled = false;

    const fetchLogs = async () => {
      try {
        setLoading(true);

        const endpoint = recordId
          ? `${process.env.REACT_APP_API_BASE_URL}ChangeLog/${tableName}/${recordId}`
          : `${process.env.REACT_APP_API_BASE_URL}ChangeLog/${tableName}`;
        const offset = (page - 1) * pageSize;
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
        });

        if (scopeTableName && scopeEntityId) {
          params.set("scopeTableName", scopeTableName);
          params.set("scopeEntityId", String(scopeEntityId));
        }

        const requestUrl = `${endpoint}?${params.toString()}`;

        const res = await fetch(requestUrl, { credentials: "include" });
        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = await res.json();
        if (!cancelled) {
          const nextLogs = Array.isArray(data) ? data : [];

          setLogs(nextLogs);
          setExpandedDetails({});

          const parsedReturnedCount = Number(
            res.headers.get("X-Returned-Count") || nextLogs.length,
          );
          const parsedTotalCount = Number(res.headers.get("X-Total-Count"));
          const parsedResultLimit = Number(res.headers.get("X-Result-Limit"));
          const parsedResultOffset = Number(res.headers.get("X-Result-Offset"));
          const hasMore =
            String(res.headers.get("X-Has-More") || "").toLowerCase() === "true";
          const returnedCount = Number.isFinite(parsedReturnedCount)
            ? parsedReturnedCount
            : nextLogs.length;
          const totalCount =
            Number.isFinite(parsedTotalCount) && parsedTotalCount > 0
              ? parsedTotalCount
              : offset + nextLogs.length;
          const resultLimit =
            Number.isFinite(parsedResultLimit) && parsedResultLimit > 0
              ? parsedResultLimit
              : pageSize;
          const resultOffset = Number.isFinite(parsedResultOffset)
            ? parsedResultOffset
            : offset;

          setListMeta({
            totalCount,
            returnedCount,
            limit: resultLimit,
            offset: resultOffset,
            hasMore,
            scope: res.headers.get("X-Log-Scope") || (recordId ? "entity" : "table"),
          });
        }
      } catch (error) {
        console.error("Failed to fetch change logs:", error);
        if (!cancelled) {
          setLogs([]);
          setExpandedDetails({});
          setListMeta({
            totalCount: 0,
            returnedCount: 0,
            limit: pageSize,
            offset: 0,
            hasMore: false,
            scope:
              scopeTableName && scopeEntityId
                ? "table-selection"
                : recordId
                  ? "entity"
                  : "table",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [isOpen, page, pageSize, recordId, scopeEntityId, scopeTableName, tableName]);

  useEffect(() => {
    if (!tableName || !showLastUpdated) {
      return undefined;
    }

    let cancelled = false;

    const fetchLastUpdated = async () => {
      try {
        const params = new URLSearchParams();
        if (scopeTableName && scopeEntityId) {
          params.set("scopeTableName", scopeTableName);
          params.set("scopeEntityId", String(scopeEntityId));
        }

        const res = await fetch(
          `${process.env.REACT_APP_API_BASE_URL}ChangeLog/last-updated/${tableName}${params.size > 0 ? `?${params.toString()}` : ""}`,
          { credentials: "include" },
        );

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = await res.json();
        if (!cancelled) {
          setLastUpdated(data?.lastUpdated || null);
        }
      } catch {
        if (!cancelled) {
          setLastUpdated(null);
        }
      }
    };

    fetchLastUpdated();
    return () => {
      cancelled = true;
    };
  }, [scopeEntityId, scopeTableName, showLastUpdated, tableName]);

  const actorOptions = useMemo(() => {
    const options = logs
      .map((log) => getChangedByDisplay(log).text)
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));

    return [
      { value: "all", label: "Semua pengguna" },
      ...options.map((value) => ({ value, label: value })),
    ];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const search = normalizeText(searchTerm);

    return logs.filter((log) => {
      const changeType = String(getLogValue(log, "ChangeType") ?? "").toUpperCase();
      if (changeTypeFilter !== "all" && changeType !== changeTypeFilter) {
        return false;
      }

      const actor = getChangedByDisplay(log).text;
      if (actorFilter !== "all" && actor !== actorFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const currentChangeType = String(getLogValue(log, "ChangeType") ?? "").toUpperCase();
      const detailsText = getChangeDetails(log, tableName)
        .map((detail) =>
          (
            currentChangeType === "DELETE"
              ? [detail.Label, detail.Before, `isi terakhir ${humanizeValue(detail.Before)}`]
              : currentChangeType === "POST"
                ? [detail.Label, detail.After, `nilai awal ${humanizeValue(detail.After)}`]
                : [
                    detail.Label,
                    detail.Before,
                    detail.After,
                    `dari ${humanizeValue(detail.Before)} menjadi ${humanizeValue(detail.After)}`,
                  ]
          )
            .filter(Boolean)
            .join(" "),
        )
        .join(" ");

      const haystack = normalizeText(
        [
          getSummaryDisplay(log),
          actor,
          getChangedByDisplay(log).level,
          getLogValue(log, "ChangeType"),
          detailsText,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return haystack.includes(search);
    });
  }, [actorFilter, changeTypeFilter, logs, searchTerm, tableName]);

  const summaryText = useMemo(() => {
    const shown = filteredLogs.length;
    const loaded = logs.length;
    const total = listMeta.totalCount || loaded;
    const hidden = Math.max(loaded - shown, 0);

    if (shown === 0) {
      return `Tidak ada log yang cocok. Saat ini termuat ${loaded} log${total > loaded ? ` dari total ${total}` : ""}.`;
    }

    let text = `Menampilkan ${shown} log`;
    if (shown !== loaded) {
      text += ` dari ${loaded} log yang sedang dimuat`;
    } else {
      text += ` yang sedang dimuat`;
    }

    if (total > loaded) {
      text += `, dari total ${total} log`;
    }

    if (hidden > 0) {
      text += `. ${hidden} log lain tersembunyi oleh search/filter`;
    } else {
      text += ".";
    }

    return text;
  }, [filteredLogs.length, listMeta.totalCount, logs.length]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((listMeta.totalCount || 0) / pageSize)),
    [listMeta.totalCount, pageSize],
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageRange = useMemo(() => {
    if (!listMeta.totalCount || logs.length === 0) {
      return { from: 0, to: 0 };
    }

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(listMeta.totalCount, from + logs.length - 1);
    return { from, to };
  }, [listMeta.totalCount, logs.length, page, pageSize]);

  const toggleDetail = (logId) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  const handleNavigate = useCallback(
    (log) => {
      if (!allowNavigateToChange || !onNavigateToChange || !canNavigateFromLog(log)) {
        return;
      }

      onNavigateToChange({
        recordId: getLogValue(log, "EntityId"),
        field: parseChangedField(log, tableName),
        changeType: getLogValue(log, "ChangeType"),
      });
      closeModal();
    },
    [allowNavigateToChange, closeModal, onNavigateToChange, tableName],
  );

  return (
    <>
      {triggerMode === "header" ? (
        <button
          type="button"
          className="table-header-action"
          title="Lihat riwayat perubahan"
          onClick={openModal}
        >
          <Clock size={16} aria-hidden="true" />
          <span>{triggerLabel}</span>
        </button>
      ) : (
        <div
          onClick={openModal}
          title="Lihat riwayat perubahan"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: showLastUpdated ? "0.4rem" : 0,
            width: showLastUpdated ? "auto" : 24,
            minWidth: showLastUpdated ? "auto" : 24,
            height: showLastUpdated ? "auto" : 24,
            lineHeight: 1,
            color: "#898989",
            cursor: "pointer",
          }}
          onMouseOver={(event) => {
            event.currentTarget.style.color = "#f15a22";
          }}
          onMouseOut={(event) => {
            event.currentTarget.style.color = "#898989";
          }}
        >
          <Clock
            size={18}
            style={{
              transition: "all 0.2s ease",
              color: "currentColor",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: showLastUpdated ? "auto" : 18,
              height: showLastUpdated ? "auto" : 18,
              lineHeight: 1,
            }}
          />

          {showLastUpdated ? (
            <div className="changelog-lastupdated">
              <small className="full-text">
                Last Updated: {formatShortDate(lastUpdated)}
              </small>
              <small className="mobile-text">{formatShortDate(lastUpdated)}</small>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        isOpen={isOpen}
        toggle={closeModal}
        size="xl"
        centered
        className="table-utility-modal"
        backdropClassName="table-utility-backdrop"
        zIndex={1400}
      >
        <ModalHeader toggle={closeModal}>Riwayat Perubahan {effectiveTitleLabel}</ModalHeader>
        <ModalBody className="change-log-modal-body">
          <div className="mb-3">
            <div className="fw-semibold">
              {getScopeLabel(listMeta.scope, effectiveTitleLabel, recordId)}
            </div>
            <small className="text-muted d-block">{summaryText}</small>
          </div>

          <Row className="g-2 mb-3">
            <Col md="5">
              <Input
                value={searchTerm}
                maxLength={SEARCH_INPUT_MAX_LENGTH}
                onChange={(event) =>
                  setSearchTerm(sanitizeSearchInput(event.target.value))
                }
                placeholder="Cari ringkasan, detail perubahan, atau pengguna"
              />
            </Col>
            <Col md="3">
              <Input
                type="select"
                value={changeTypeFilter}
                onChange={(event) => setChangeTypeFilter(event.target.value)}
              >
                {CHANGE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md="4">
              <Input
                type="select"
                value={actorFilter}
                onChange={(event) => setActorFilter(event.target.value)}
              >
                {actorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Input>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-4">
              <Spinner color="primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-muted text-center mb-0">
              Belum ada log yang cocok untuk tampilan ini.
            </p>
          ) : (
            <div className="change-log-table-shell">
              <Table bordered hover size="sm" className="table change-log-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 164, width: 172, textAlign: "center" }}>Waktu</th>
                      <th style={{ minWidth: 108, width: 118, textAlign: "center" }}>Aksi</th>
                      <th style={{ minWidth: 190, width: 220, textAlign: "center" }}>Diubah Oleh</th>
                      <th style={{ minWidth: 460, textAlign: "center" }}>Ringkasan Perubahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const logId = getLogRowId(log);
                      const badge = getChangeTypeBadge(getLogValue(log, "ChangeType"));
                      const changedBy = getChangedByDisplay(log);
                      const details = getChangeDetails(log, tableName);
                      const isExpanded = Boolean(expandedDetails[logId]);
                      const canNavigate =
                        allowNavigateToChange &&
                        canNavigateFromLog(log) &&
                        Boolean(onNavigateToChange);

                      return (
                        <tr key={logId}>
                          <td className="text-center align-middle change-log-table__time">
                            {formatDateTime(getLogValue(log, "Timestamp"))}
                          </td>
                          <td className="text-center align-middle change-log-table__type">
                            <Badge color={badge.color} pill>
                              {badge.label}
                            </Badge>
                          </td>
                          <td className="align-middle change-log-table__actor">
                            <div className="change-log-ag-grid-actor">
                              <div className="change-log-ag-grid-actor__name">
                                {changedBy.text}
                              </div>
                              {changedBy.level ? (
                                <small className="change-log-ag-grid-actor__meta">
                                  {changedBy.level}
                                </small>
                              ) : null}
                            </div>
                          </td>
                          <td className="align-middle change-log-table__summary">
                            <div className="change-log-ag-grid-summary">
                              <div className="change-log-ag-grid-summary__headline">
                                {canNavigate ? (
                                  <button
                                    type="button"
                                    className="change-log-ag-grid-summary__link"
                                    onClick={() => handleNavigate(log)}
                                    title="Buka lokasi perubahan"
                                  >
                                    {getSummaryDisplay(log)}
                                  </button>
                                ) : (
                                  <span className="change-log-ag-grid-summary__text">
                                    {getSummaryDisplay(log)}
                                  </span>
                                )}
                              </div>

                              {details.length > 0 ? (
                                <>
                                  <div className="change-log-ag-grid-summary__meta">
                                    <Badge color="light" className="change-log-ag-grid-summary__count border">
                                      {details.length} perubahan
                                    </Badge>
                                    <button
                                      type="button"
                                      className="change-log-ag-grid-summary__toggle"
                                      onClick={() => toggleDetail(logId)}
                                    >
                                      {isExpanded ? "Sembunyikan detail" : "Lihat detail perubahan"}
                                    </button>
                                  </div>

                                  {isExpanded ? (
                                    <div className="change-log-ag-grid-summary__details">
                                      <ul className="mb-0 ps-3">
                                        {details.map((detail, index) => (
                                          <li key={`${detail.Field || detail.Label}-${index}`}>
                                            {formatDetailDescription(
                                              detail,
                                              getLogValue(log, "ChangeType"),
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </>
                              ) : (
                                <small className="change-log-ag-grid-summary__empty">
                                  Tidak ada detail kolom tambahan.
                                </small>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </Table>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="change-log-modal-footer">
          <div className="small text-muted">
            Menampilkan {pageRange.from}-{pageRange.to} dari {listMeta.totalCount} data
          </div>

          <div className="change-log-modal-footer__actions">
            <span className="small text-muted">Baris</span>
            <select
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={pageSize}
              onChange={(event) => {
                const nextSize = Number(event.target.value) || CHANGE_LOG_DEFAULT_PAGE_SIZE;
                setPageSize(nextSize);
                setPage(1);
              }}
            >
              {CHANGE_LOG_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Sebelumnya
            </button>

            <span className="small text-muted">
              Halaman {page} / {totalPages}
            </span>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Berikutnya
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default ChangeLogModal;
