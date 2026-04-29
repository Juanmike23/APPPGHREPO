/*
 * PGH-DOC
 * File: src/Variables/ActionCell/APSParentRowModal.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Modal, ModalHeader, ModalBody, Col, Row } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";
import { Eye } from "react-feather";

const RELATION_EMPTY = [];

const normalizeRelationRows = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return RELATION_EMPTY;
};

const normalizeSearchText = (value) => String(value ?? "").trim().toLowerCase();

const normalizeSource = (source) => {
  if (!source) return source;

  const map = {
    new: "NewProcure",
    existing: "ExistingProcure",
  };

  return map[String(source).toLowerCase()] ?? source;
};

const getRowId = (row) => row?.Id ?? row?.id ?? null;
const getRowSource = (row) => row?.Source ?? row?.source ?? null;
const getRowTitle = (row) => row?.Perjanjian ?? row?.perjanjian ?? "";
const getRowNoSpk = (row) => row?.NoSPK ?? row?.noSPK ?? row?.noSpk ?? "";
const getRowTglSpk = (row) => row?.TglSPK ?? row?.tglSPK ?? row?.tglSpk ?? null;
const getRowScore = (row) => row?.Score ?? row?.score ?? 0;
const getRowMatchReason = (row) => row?.MatchReason ?? row?.matchReason ?? "";
const isRowLinked = (row) => Boolean(row?.IsLinked ?? row?.isLinked);
const formatDisplayDate = (value) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const buildRelationKey = (row) =>
  `${String(getRowId(row) ?? "")}:${String(getRowSource(row) ?? "").trim().toLowerCase()}`;

const ParentRowModal = ({
  tableName,
  recordId,
  source,
  title = "Parent details of ...",
  onApplyFilter,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parentRows, setParentRows] = useState(RELATION_EMPTY);
  const [childRows, setChildRows] = useState(RELATION_EMPTY);
  const [hasParent, setHasParent] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);

  const [candidateOptions, setCandidateOptions] = useState(RELATION_EMPTY);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [parentTitleInput, setParentTitleInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const normalizedSource = useMemo(() => normalizeSource(source), [source]);
  const hasAnyLink = hasParent || hasChildren;

  const toggle = () => setIsOpen((prev) => !prev);

  const fetchRelationRows = useCallback(async (url) => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      return RELATION_EMPTY;
    }

    const payload = await response.json().catch(() => RELATION_EMPTY);
    return normalizeRelationRows(payload);
  }, []);

  const fetchParentRows = useCallback(async () => {
    if (!recordId || !normalizedSource) {
      return RELATION_EMPTY;
    }

    const query = encodeURIComponent(normalizedSource);
    const url =
      `${process.env.REACT_APP_API_BASE_URL}parentchild/child/${recordId}` +
      `?childSource=${query}`;
    return fetchRelationRows(url);
  }, [fetchRelationRows, normalizedSource, recordId]);

  const fetchChildRows = useCallback(async () => {
    if (!recordId) {
      return RELATION_EMPTY;
    }

    const encodedSource = encodeURIComponent(normalizedSource ?? "");
    const candidateUrls = [
      `${process.env.REACT_APP_API_BASE_URL}parentchild/children/${recordId}` +
        `?parentSource=${encodedSource}`,
      `${process.env.REACT_APP_API_BASE_URL}parentchild/children/${recordId}`,
    ];

    for (let index = 0; index < candidateUrls.length; index += 1) {
      const url = candidateUrls[index];
      try {
        const rows = await fetchRelationRows(url);
        if (rows.length > 0 || index === candidateUrls.length - 1) {
          return rows;
        }
      } catch (error) {
        if (index === candidateUrls.length - 1) {
          throw error;
        }
      }
    }

    return RELATION_EMPTY;
  }, [fetchRelationRows, normalizedSource, recordId]);

  const reloadRelations = useCallback(
    async ({ withSpinner = false } = {}) => {
      if (!recordId) {
        setParentRows(RELATION_EMPTY);
        setChildRows(RELATION_EMPTY);
        setHasParent(false);
        setHasChildren(false);
        return;
      }

      if (withSpinner) {
        setLoading(true);
      }

      try {
        const [nextParentRows, nextChildRows] = await Promise.all([
          fetchParentRows(),
          fetchChildRows(),
        ]);

        setParentRows(nextParentRows);
        setChildRows(nextChildRows);
        setHasParent(nextParentRows.length > 0);
        setHasChildren(nextChildRows.length > 0);
      } catch (error) {
        console.error("Failed loading parent-child links:", error);
        setParentRows(RELATION_EMPTY);
        setChildRows(RELATION_EMPTY);
        setHasParent(false);
        setHasChildren(false);
      } finally {
        if (withSpinner) {
          setLoading(false);
        }
      }
    },
    [fetchChildRows, fetchParentRows, recordId],
  );

  useEffect(() => {
    reloadRelations();
  }, [recordId, normalizedSource, reloadRelations]);

  useEffect(() => {
    if (!isOpen || !tableName || !recordId) return;
    reloadRelations({ withSpinner: true });
  }, [isOpen, tableName, recordId, reloadRelations]);

  useEffect(() => {
    if (!isOpen || !recordId) return undefined;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const url =
          `${process.env.REACT_APP_API_BASE_URL}parentchild/search-candidates` +
          `?childId=${recordId}` +
          `&childSource=${encodeURIComponent(normalizedSource ?? "")}` +
          `&q=${encodeURIComponent(parentTitleInput.trim())}`;

        const response = await fetch(url, { credentials: "include" });
        const payload = response.ok
          ? await response.json().catch(() => RELATION_EMPTY)
          : RELATION_EMPTY;

        if (cancelled) return;

        setCandidateOptions(normalizeRelationRows(payload));
        if (parentTitleInput.trim() === "") {
          setSelectedCandidate(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed searching parent candidates:", error);
          setCandidateOptions(RELATION_EMPTY);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, normalizedSource, parentTitleInput, recordId]);

  useEffect(() => {
    const handler = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exactCandidate = useMemo(() => {
    const term = normalizeSearchText(parentTitleInput);
    if (!term) {
      return null;
    }

    return (
      candidateOptions.find((candidate) => {
        return normalizeSearchText(getRowNoSpk(candidate)) === term;
      }) ?? null
    );
  }, [candidateOptions, parentTitleInput]);

  const relationIconState = useMemo(() => {
    if (hasParent && hasChildren) {
      return {
        title: "Linked as parent and child",
        backgroundColor: "#1d8f6b",
        color: "#ffffff",
        opacity: 0.96,
      };
    }

    if (hasParent) {
      return {
        title: "Has parent link",
        backgroundColor: "#f15a20",
        color: "#ffffff",
        opacity: 0.95,
      };
    }

    if (hasChildren) {
      return {
        title: "Has child link",
        backgroundColor: "#0b6abf",
        color: "#ffffff",
        opacity: 0.95,
      };
    }

    return {
      title: "No link yet - click to assign",
      backgroundColor: "transparent",
      color: "#898989",
      opacity: 0.65,
    };
  }, [hasChildren, hasParent]);

  const relationRoleState = useMemo(() => {
    if (hasChildren && hasParent) {
      return {
        key: "mixed",
        label: "Role: Parent + Child",
        description:
          "Data ini punya child dan juga punya parent. Struktur lama seperti ini perlu dirapikan.",
        canAssignParent: false,
      };
    }

    if (hasChildren) {
      return {
        key: "parent",
        label: "Role: Parent",
        description:
          "Data ini sudah menjadi parent. Sesuai aturan, parent tidak boleh punya parent.",
        canAssignParent: false,
      };
    }

    if (hasParent) {
      return {
        key: "child",
        label: "Role: Child",
        description: "Data ini punya parent dan tidak punya child.",
        canAssignParent: true,
      };
    }

    return {
      key: "standalone",
      label: "Role: Standalone",
      description: "Data ini belum terhubung. Anda bisa memilih parent.",
      canAssignParent: true,
    };
  }, [hasChildren, hasParent]);

  const handleRemoveParent = useCallback(
    async (parentRow) => {
      const parentId = getRowId(parentRow);
      const parentSource = getRowSource(parentRow) || normalizedSource;

      if (!recordId || !parentId || !parentSource) {
        toast.error("Data parent tidak valid.");
        return;
      }

      try {
        const url =
          `${process.env.REACT_APP_API_BASE_URL}parentchild/remove-parent` +
          `?childId=${recordId}` +
          `&childSource=${encodeURIComponent(normalizedSource ?? "")}` +
          `&parentId=${parentId}` +
          `&parentSource=${encodeURIComponent(parentSource)}`;

        const response = await fetch(url, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        toast.success("Parent berhasil dihapus.");
        await reloadRelations({ withSpinner: true });
      } catch (error) {
        console.error("Failed to remove parent link:", error);
        toast.error("Gagal menghapus parent.");
      }
    },
    [normalizedSource, recordId, reloadRelations],
  );

  const handleLinkParent = useCallback(async () => {
    if (!relationRoleState.canAssignParent) {
      toast.info("Baris yang sudah menjadi parent tidak bisa dipilihkan parent lagi.");
      return;
    }

    const parentCandidate = selectedCandidate || exactCandidate;
    if (!parentCandidate) {
      toast.info("Pilih candidate parent dari daftar suggestion.");
      return;
    }

    try {
      const parentId = getRowId(parentCandidate);
      const parentSource = getRowSource(parentCandidate) || normalizedSource;

      if (!recordId || !parentId || !parentSource) {
        toast.error("Candidate parent tidak valid.");
        return;
      }

      if (Number(parentId) === Number(recordId)) {
        toast.error("Tidak bisa link ke baris yang sama.");
        return;
      }

      const candidateKey = buildRelationKey({
        Id: parentId,
        Source: parentSource,
      });
      const linkedKeys = new Set(parentRows.map(buildRelationKey));

      if (linkedKeys.has(candidateKey)) {
        toast.error("Link parent sudah ada.");
        return;
      }

      const payload = {
        ChildId: Number(recordId),
        ChildSource: normalizedSource,
        ParentId: Number(parentId),
        ParentSource: parentSource,
      };

      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}parentchild/add-parent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast.success(`Parent linked: ${getRowTitle(parentCandidate) || parentId}`);
      setSelectedCandidate(null);
      setParentTitleInput("");
      setShowSuggestions(false);
      await reloadRelations({ withSpinner: true });
    } catch (error) {
      console.error("Failed assigning parent:", error);
      toast.error("Gagal melakukan link parent.");
    }
  }, [
    exactCandidate,
    normalizedSource,
    parentRows,
    recordId,
    relationRoleState.canAssignParent,
    reloadRelations,
    selectedCandidate,
  ]);

  const fetchGraphRelationIds = useCallback(async () => {
    if (!recordId) {
      return {
        relationIds: RELATION_EMPTY,
        graphParentIds: RELATION_EMPTY,
        missingDueDateCount: 0,
      };
    }

    try {
      const encodedSource = encodeURIComponent(normalizedSource ?? "");
      const sourceQuery = encodedSource ? `?itemSource=${encodedSource}` : "";
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}parentchild/graph/${recordId}${sourceQuery}`,
        { credentials: "include" },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = await response.json().catch(() => ({}));
      const rawIds = Array.isArray(payload?.RelatedIds)
        ? payload.RelatedIds
        : Array.isArray(payload?.relatedIds)
          ? payload.relatedIds
          : RELATION_EMPTY;
      const rawParentIds = Array.isArray(payload?.ParentNodeIds)
        ? payload.ParentNodeIds
        : Array.isArray(payload?.parentNodeIds)
          ? payload.parentNodeIds
          : RELATION_EMPTY;
      const nodes = Array.isArray(payload?.Nodes)
        ? payload.Nodes
        : Array.isArray(payload?.nodes)
          ? payload.nodes
          : RELATION_EMPTY;
      const missingDueDateCount = nodes.filter(
        (node) => !node?.JatuhTempo && !node?.jatuhTempo,
      ).length;

      const relationIds = Array.from(
        new Set(
          rawIds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0),
        ),
      );
      const graphParentIds = Array.from(
        new Set(
          rawParentIds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0),
        ),
      );
      return {
        relationIds,
        graphParentIds,
        missingDueDateCount,
      };
    } catch (error) {
      console.error("Failed loading linked graph:", error);
      return {
        relationIds: RELATION_EMPTY,
        graphParentIds: RELATION_EMPTY,
        missingDueDateCount: 0,
      };
    }
  }, [normalizedSource, recordId]);

  const handleFullView = useCallback(async () => {
    const {
      relationIds: recursiveRelationIds,
      graphParentIds,
      missingDueDateCount,
    } =
      await fetchGraphRelationIds();
    const directParentIds = Array.from(
      new Set(
        parentRows
          .map((row) => Number(getRowId(row)))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    );
    const fallbackRelationIds = Array.from(
      new Set(
        [recordId, ...parentRows.map((row) => getRowId(row)), ...childRows.map((row) => getRowId(row))]
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    );
    const relationIds =
      recursiveRelationIds.length > 0 ? recursiveRelationIds : fallbackRelationIds;
    const parentBottomIds =
      graphParentIds.length > 0 ? graphParentIds : directParentIds;

    const relationSummaryLabel = `Linked View: ${relationIds.length} Data terkait`;

    onApplyFilter?.({
      filters: relationIds.map((value) => ({
        column: "Id",
        operator: "=",
        value: String(value),
        hidden: true,
        displayLabel: relationSummaryLabel,
      })),
      mode: "or",
      sort: {
        column: "JatuhTempo",
        direction: "asc",
      },
      distinct: null,
      priorityTopNullColumn: "JatuhTempo",
      priorityBottomIds: parentBottomIds,
    });

    if (missingDueDateCount > 0) {
      toast.info(
        `${missingDueDateCount} data belum punya Jatuh Tempo. Data tetap tampil dan diprioritaskan di bagian atas urutan.`,
      );
    }
    if (parentBottomIds.length > 0) {
      toast.info(
        "Parent diposisikan di bagian paling bawah pada hasil Full View.",
      );
    }

    setIsOpen(false);
  }, [
    childRows,
    fetchGraphRelationIds,
    onApplyFilter,
    parentRows,
    recordId,
  ]);

  return (
    <>
      <i
        className="icon-bookmark"
        title={relationIconState.title}
        onClick={toggle}
        style={{
          cursor: "pointer",
          transition: "all 0.2s ease",
          fontSize: hasAnyLink ? "0.9rem" : "1.2rem",
          display: hasAnyLink ? "inline-flex" : "inline",
          alignItems: hasAnyLink ? "center" : undefined,
          justifyContent: hasAnyLink ? "center" : undefined,
          width: hasAnyLink ? 20 : "auto",
          height: hasAnyLink ? 20 : "auto",
          borderRadius: hasAnyLink ? 6 : 0,
          backgroundColor: relationIconState.backgroundColor,
          color: relationIconState.color,
          opacity: relationIconState.opacity,
        }}
        onMouseOver={(event) => {
          event.currentTarget.style.opacity = "1";
          if (!hasAnyLink) event.currentTarget.style.color = "#f15a20";
          if (hasAnyLink) event.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseOut={(event) => {
          event.currentTarget.style.opacity = String(relationIconState.opacity);
          event.currentTarget.style.transform = "scale(1)";
          event.currentTarget.style.color = relationIconState.color;
        }}
      />

      <Modal isOpen={isOpen} toggle={toggle} size="lg" centered>
        <ModalHeader toggle={toggle}>
          <Row className="w-100 align-items-center">
            <Col xs="auto" className="pe-2">
              <i
                className="icon-bookmark"
                style={{
                  fontSize: 40,
                  width: 56,
                  height: 56,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  backgroundColor: relationIconState.backgroundColor,
                  color: "#fff",
                }}
              />
            </Col>

            <Col className="ps-0">
              <h3 className="fw-semibold mb-0 ms-2">Link Procurement</h3>
            </Col>
          </Row>
        </ModalHeader>

        <ModalBody>
          {loading ? (
            <div className="text-center text-muted py-4">
              Loading parent-child data...
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <div
                style={{
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  background: "#fde4d6",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                {title}
              </div>

              <div
                className="small"
                style={{
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  background: "#fff",
                }}
              >
                <div className="fw-semibold">{relationRoleState.label}</div>
                <div className="text-muted mt-1">{relationRoleState.description}</div>
              </div>

              <div>
                <div className="fw-semibold mb-2">
                  Linked Parent ({parentRows.length})
                </div>
                {parentRows.length === 0 ? (
                  <div className="text-muted small border rounded p-2">
                    Belum ada parent yang terhubung.
                  </div>
                ) : (
                  parentRows.map((item, index) => (
                    <div
                      key={`${buildRelationKey(item)}:${index}`}
                      style={{
                        display: "flex",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        overflow: "hidden",
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div className="fw-semibold">{getRowTitle(item) || "-"}</div>
                          <div className="small text-muted">
                            Tgl SPK: {formatDisplayDate(getRowTglSpk(item))} | No SPK: {getRowNoSpk(item) || "-"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        style={{
                          width: 40,
                          border: "none",
                          borderLeft: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                          fontSize: 18,
                          fontWeight: 600,
                          color: "#dc3545",
                        }}
                        onClick={() =>
                          toast.warn(
                            ({ closeToast }) => (
                              <div>
                                <div className="mb-2 fw-semibold">
                                  Remove this parent?
                                </div>
                                <div className="d-flex gap-2">
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={async () => {
                                      await handleRemoveParent(item);
                                      closeToast();
                                    }}
                                  >
                                    Remove
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={closeToast}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ),
                            { autoClose: false },
                          )
                        }
                      >
                        x
                      </button>
                    </div>
                  ))
                )}
              </div>

              {(relationRoleState.key === "parent" ||
                relationRoleState.key === "mixed" ||
                childRows.length > 0) && (
                <div>
                  <div className="fw-semibold mb-2">
                    Linked Child (sebagai Parent) ({childRows.length})
                  </div>
                  {childRows.length === 0 ? (
                    <div className="text-muted small border rounded p-2">
                      Belum ada child yang terhubung.
                    </div>
                  ) : (
                    childRows.map((item, index) => (
                      <div
                        key={`${buildRelationKey(item)}:child:${index}`}
                        style={{
                          display: "flex",
                          border: "1px solid #ddd",
                          borderRadius: 4,
                          overflow: "hidden",
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div className="fw-semibold">{getRowTitle(item) || "-"}</div>
                            <div className="small text-muted">
                              Tgl SPK: {formatDisplayDate(getRowTglSpk(item))} | No SPK: {getRowNoSpk(item) || "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="d-flex align-items-start gap-3 mt-3">
            <div style={{ position: "relative", flex: 1 }}>
              <input
                ref={inputRef}
                type="text"
                className="form-control w-100"
                placeholder="Search No SPK..."
                value={parentTitleInput}
                disabled={!relationRoleState.canAssignParent}
                onChange={(event) => {
                  setParentTitleInput(event.target.value);
                  setSelectedCandidate(null);
                }}
                onFocus={() => setShowSuggestions(true)}
              />

              {showSuggestions && (
                <ul
                  className="list-group mt-1"
                  style={{
                    cursor: "pointer",
                    width: "100%",
                    maxHeight: "160px",
                    overflowY: "auto",
                    position: "absolute",
                    background: "white",
                    zIndex: 5,
                  }}
                >
                  {candidateOptions.slice(0, 8).map((candidate, index) => (
                    <li
                      key={`${getRowId(candidate) ?? "candidate"}-${index}`}
                      className="list-group-item list-group-item-action m-2"
                      onMouseDown={() => {
                        setSelectedCandidate(candidate);
                        setParentTitleInput(getRowNoSpk(candidate));
                        setShowSuggestions(false);
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-3">
                        <div className="min-w-0">
                          <div className="fw-semibold text-truncate">
                            {getRowNoSpk(candidate) || "-"}
                          </div>
                          <div className="small text-muted text-truncate">
                            Nama Perjanjian: {getRowTitle(candidate) || "-"}
                          </div>
                          <div className="small text-muted text-truncate">
                            Tgl SPK: {formatDisplayDate(getRowTglSpk(candidate))} | No SPK: {getRowNoSpk(candidate) || "-"}
                          </div>
                          {getRowMatchReason(candidate) ? (
                            <div className="small text-muted text-truncate">
                              {getRowMatchReason(candidate)}
                            </div>
                          ) : null}
                        </div>
                        <div className="d-flex flex-column align-items-end gap-1">
                          <span className="badge bg-light text-dark border">
                            {getRowSource(candidate) || "-"}
                          </span>
                          <span className="badge bg-warning-subtle text-dark border">
                            Score {Number(getRowScore(candidate) || 0).toFixed(0)}
                          </span>
                          {isRowLinked(candidate) ? (
                            <span className="badge bg-success-subtle text-dark border">
                              Linked
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="d-flex gap-2">
              <button
                className="btn btn-success"
                onClick={handleLinkParent}
                disabled={
                  !relationRoleState.canAssignParent ||
                  (!selectedCandidate && !exactCandidate)
                }
              >
                Link
              </button>

              <button
                className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center gap-2"
                onClick={handleFullView}
              >
                <Eye size={16} /> Full View
              </button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ParentRowModal;
