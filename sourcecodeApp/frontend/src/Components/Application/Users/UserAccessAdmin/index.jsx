/*
 * PGH-DOC
 * File: src/Components/Application/Users/UserAccessAdmin/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Input,
  Row,
  Spinner,
  Table,
} from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";
import { Clock, Save, Shield } from "react-feather";
import { useAuth } from "../../../../Auth/AuthContext";
import { isAdminUser } from "../../../../Auth/accessControl";
import FeedbackState from "../../../Common/FeedbackState";

const LEVEL_OPTIONS = ["Executive", "Manager", "Admin"];
const STREAM_OPTIONS = [
  "Audit",
  "Compliance",
  "Planning",
  "Procurement",
  "Human Resource",
];
const STREAM_OPTION_MAP = {
  audit: "Audit",
  compliance: "Compliance",
  planning: "Planning",
  procurement: "Procurement",
  human: "Human Resource",
  "human resource": "Human Resource",
};
const STREAM_DISABLED_LEVELS = new Set(["Executive", "Admin"]);
const AUDIT_TAKE_OPTIONS = ["25", "50", "100"];
const API_ROOT = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

const buildApiUrl = (path) => `${API_ROOT}/${String(path || "").replace(/^\/+/, "")}`;

const SELECTED_USER_ROW_STYLE = {
  boxShadow: "inset 4px 0 0 rgba(241, 90, 34, 0.72)",
};

const getArrayPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  return [];
};

const pickValue = (row, keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      return row[key];
    }
  }

  return "";
};

const normalizeLevelValue = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (normalizedValue === "executive") {
    return "Executive";
  }

  if (normalizedValue === "manager") {
    return "Manager";
  }

  if (normalizedValue === "admin") {
    return "Admin";
  }

  return value || "Executive";
};

const normalizeStreamValue = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return STREAM_OPTION_MAP[normalizedValue] || value || "";
};

const normalizeUserRow = (row) => ({
  id: pickValue(row, ["id", "Id", "userId", "UserId"]),
  email: pickValue(row, ["email", "Email", "userEmail", "UserEmail"]),
  name: pickValue(row, ["name", "Name", "fullName", "FullName", "username", "Username"]),
  level: normalizeLevelValue(pickValue(row, ["level", "Level", "role", "Role"])),
  stream: normalizeStreamValue(
    pickValue(row, ["stream", "Stream", "department", "Department"]),
  ),
  createdAt: pickValue(row, ["createdAt", "CreatedAt"]),
  updatedAt: pickValue(row, ["updatedAt", "UpdatedAt"]),
});

const normalizeAuditRow = (row) => ({
  id: pickValue(row, ["id", "Id"]),
  targetUserId: pickValue(row, ["targetUserId", "TargetUserId"]),
  targetEmail: pickValue(row, ["targetEmail", "TargetEmail"]),
  targetName: pickValue(row, ["targetName", "TargetName"]),
  previousLevel: pickValue(row, ["previousLevel", "PreviousLevel"]),
  previousStream: pickValue(row, ["previousStream", "PreviousStream"]),
  newLevel: pickValue(row, ["newLevel", "NewLevel"]),
  newStream: pickValue(row, ["newStream", "NewStream"]),
  changedByUserId: pickValue(row, ["changedByUserId", "ChangedByUserId"]),
  changedByEmail: pickValue(row, ["changedByEmail", "ChangedByEmail"]),
  changedByName: pickValue(row, ["changedByName", "ChangedByName"]),
  changedAt: pickValue(row, ["changedAt", "ChangedAt"]),
  ipAddress: pickValue(row, ["ipAddress", "IPAddress", "IpAddress"]),
});

const isSameDraftAccess = (draft, row) =>
  normalizeLevelValue(draft?.level || "") === normalizeLevelValue(row?.level || "") &&
  normalizeStreamValue(draft?.stream || "") === normalizeStreamValue(row?.stream || "");

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("id-ID");
};

const UserAccessAdmin = () => {
  const { user, setUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [auditItems, setAuditItems] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [auditTake, setAuditTake] = useState("50");
  const [selectedAuditUser, setSelectedAuditUser] = useState(null);
  const auditSectionRef = useRef(null);
  const pendingAuditScrollRef = useRef(false);
  const usersRef = useRef([]);

  const isAdmin = isAdminUser(user);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const loadUsers = useCallback(async ({ silent = false } = {}) => {
    if (!isAdmin) {
      setUsers([]);
      setDrafts({});
      setLoadingUsers(false);
      return;
    }

    if (!silent) {
      setLoadingUsers(true);
    }

    setError((currentError) => (silent ? currentError : ""));

    try {
      const response = await fetch(buildApiUrl("auth/users"), {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      const normalizedUsers = getArrayPayload(payload)
        .map(normalizeUserRow)
        .filter((row) => row.id);

      setUsers(normalizedUsers);
      setDrafts((currentDrafts) => {
        const previousUsersById = new Map(
          usersRef.current.map((row) => [row.id, row]),
        );

        return Object.fromEntries(
          normalizedUsers.map((row) => {
            const existingDraft = currentDrafts[row.id];
            const previousRow = previousUsersById.get(row.id);
            const shouldKeepDraft =
              existingDraft && previousRow && !isSameDraftAccess(existingDraft, previousRow);

            return [
              row.id,
              shouldKeepDraft
                ? existingDraft
                : {
                    level: row.level || "Executive",
                    stream: row.stream || "",
                  },
            ];
          }),
        );
      });
    } catch (loadError) {
      if (!silent) {
        setUsers([]);
        setDrafts({});
      }
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat user.");
    } finally {
      if (!silent) {
        setLoadingUsers(false);
      }
    }
  }, [isAdmin]);

  const loadAudit = useCallback(
    async (targetUserId = "", { silent = false } = {}) => {
      if (!isAdmin) {
        setAuditItems([]);
        setLoadingAudit(false);
        return;
      }

      if (!silent) {
        setLoadingAudit(true);
      }

      setAuditError((currentError) => (silent ? currentError : ""));

      try {
        const auditPath = targetUserId
          ? `auth/users/${targetUserId}/access-audit?take=${auditTake}`
          : `auth/users/access-audit?take=${auditTake}`;

        const response = await fetch(buildApiUrl(auditPath), {
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        const normalizedAudit = getArrayPayload(payload)
          .map(normalizeAuditRow)
          .sort(
            (left, right) =>
              new Date(right.changedAt || 0).getTime() -
              new Date(left.changedAt || 0).getTime(),
          );

        setAuditItems(normalizedAudit);
      } catch (loadError) {
        if (!silent) {
          setAuditItems([]);
        }
        setAuditError(
          loadError instanceof Error
            ? loadError.message
            : "Gagal memuat audit perubahan akses.",
        );
      } finally {
        if (!silent) {
          setLoadingAudit(false);
        }
      }
    },
    [auditTake, isAdmin],
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!isAdmin) {
      return undefined;
    }

    const refreshUsers = () => {
      if (document.visibilityState === "visible") {
        loadUsers({ silent: true });
      }
    };

    const intervalId = window.setInterval(refreshUsers, 60000);
    window.addEventListener("focus", refreshUsers);
    document.addEventListener("visibilitychange", refreshUsers);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshUsers);
      document.removeEventListener("visibilitychange", refreshUsers);
    };
  }, [isAdmin, loadUsers]);

  useEffect(() => {
    loadAudit(selectedAuditUser?.id);
  }, [loadAudit, selectedAuditUser?.id]);

  useEffect(() => {
    if (!isAdmin) {
      return undefined;
    }

    const refreshAudit = () => {
      if (document.visibilityState === "visible") {
        loadAudit(selectedAuditUser?.id, { silent: true });
      }
    };

    const intervalId = window.setInterval(refreshAudit, 60000);
    window.addEventListener("focus", refreshAudit);
    document.addEventListener("visibilitychange", refreshAudit);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshAudit);
      document.removeEventListener("visibilitychange", refreshAudit);
    };
  }, [isAdmin, loadAudit, selectedAuditUser?.id]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((row) =>
      [row.name, row.email, row.level, row.stream].join(" ").toLowerCase().includes(keyword),
    );
  }, [search, users]);

  const summary = useMemo(() => {
    const counts = {
      total: users.length,
      admin: 0,
      manager: 0,
      executive: 0,
    };

    users.forEach((row) => {
      if (row.level === "Admin") counts.admin += 1;
      if (row.level === "Manager") counts.manager += 1;
      if (row.level === "Executive") counts.executive += 1;
    });

    return counts;
  }, [users]);

  const updateDraft = useCallback((userId, field, value) => {
    setDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[userId] || {
        level: "Executive",
        stream: "",
      };
      const nextDraft = {
        ...currentDraft,
        [field]: value,
      };

      if (field === "level" && STREAM_DISABLED_LEVELS.has(value)) {
        nextDraft.stream = "";
      }

      return {
        ...currentDrafts,
        [userId]: nextDraft,
      };
    });
  }, []);

  const scrollToAuditSection = useCallback(() => {
    const target = auditSectionRef.current;

    if (!target || typeof target.scrollIntoView !== "function") {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleSelectAuditUser = useCallback((row) => {
    pendingAuditScrollRef.current = true;
    setSelectedAuditUser(row);

    window.requestAnimationFrame(() => {
      scrollToAuditSection();
    });
  }, [scrollToAuditSection]);

  useEffect(() => {
    if (!pendingAuditScrollRef.current || loadingAudit) {
      return;
    }

    pendingAuditScrollRef.current = false;

    window.requestAnimationFrame(() => {
      scrollToAuditSection();
    });
  }, [auditItems.length, loadingAudit, scrollToAuditSection, selectedAuditUser?.id]);

  const saveUserAccess = useCallback(
    async (row) => {
      const draft = drafts[row.id];

      if (!draft) {
        return;
      }

      const level = normalizeLevelValue(draft.level || row.level);
      const stream = normalizeStreamValue(draft.stream || row.stream);
      const shouldDisableStream = STREAM_DISABLED_LEVELS.has(level);

      if (!shouldDisableStream && !stream) {
        toast.warning("Stream wajib dipilih untuk level Manager.");
        return;
      }

      setSavingId(row.id);

      try {
        const payload = shouldDisableStream
          ? { Level: level }
          : { Level: level, Stream: stream };
        const response = await fetch(buildApiUrl(`auth/users/${row.id}/access`), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(result?.message || `HTTP ${response.status}`);
        }

        const updatedRow = normalizeUserRow(result?.user || row);
        const responseMessage = String(result?.message || "").trim();
        const hasAccessChange =
          responseMessage.toLowerCase() !== "tidak ada perubahan akses.";

        setUsers((currentUsers) =>
          currentUsers.map((item) => (item.id === row.id ? { ...item, ...updatedRow } : item)),
        );
        setDrafts((currentDrafts) => ({
          ...currentDrafts,
          [row.id]: {
            level: updatedRow.level,
            stream: updatedRow.stream || "",
          },
        }));

        if (row.id === user?.id) {
          setUser((currentUser) =>
            currentUser
              ? {
                  ...currentUser,
                  level: updatedRow.level,
                  stream: updatedRow.stream,
                }
              : currentUser,
          );
        }

        if (hasAccessChange) {
          toast.success(
            result?.reloginRequired
              ? `${responseMessage || `Akses ${row.name || row.email} berhasil diperbarui.`} Re-login akan diminta saat token refresh berikutnya.`
              : responseMessage || `Akses ${row.name || row.email} berhasil diperbarui.`,
          );
        } else {
          toast.info(responseMessage || "Tidak ada perubahan akses.");
        }

        if (hasAccessChange) {
          await loadAudit(selectedAuditUser?.id);
        }
      } catch (saveError) {
        toast.error(
          saveError instanceof Error
            ? saveError.message
            : "Gagal memperbarui Level dan Stream user.",
        );
      } finally {
        setSavingId(null);
      }
    },
    [drafts, loadAudit, selectedAuditUser?.id, setUser, user?.id],
  );

  if (!isAdmin) {
    return (
      <Container fluid>
        <FeedbackState
          variant="restricted"
          title="Admin only"
          description="Halaman ini hanya dapat diakses oleh user dengan level Admin."
        />
      </Container>
    );
  }

  return (
    <Fragment>
      <Container fluid>
        <Row className="g-4">
          <Col sm="12">
            <Card style={{ border: 0 }}>
              <CardHeader
                className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3"
                style={{ background: "transparent" }}
              >
                <div>
                  <h4 className="mb-1 d-flex align-items-center gap-2">
                    <Shield size={18} />
                    Admin User Access
                  </h4>
                  <p className="text-muted mb-0">
                    Kelola Level dan Stream user dari endpoint backend
                    <code className="ms-1">/api/auth/users</code>.
                  </p>
                </div>
                <div className="d-flex flex-column flex-sm-row gap-2">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari nama, email, level, atau stream"
                    style={{ minWidth: "280px" }}
                  />
                </div>
              </CardHeader>
              <CardBody>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="table-toolbar-pill table-toolbar-pill--results">
                    Total User: {summary.total}
                  </span>
                  <span className="table-toolbar-pill table-toolbar-pill--results">
                    Admin: {summary.admin}
                  </span>
                  <span className="table-toolbar-pill table-toolbar-pill--results">
                    Manager: {summary.manager}
                  </span>
                  <span className="table-toolbar-pill table-toolbar-pill--results">
                    Executive: {summary.executive}
                  </span>
                </div>

                {loadingUsers ? (
                  <FeedbackState
                    variant="loading"
                    title="Loading users"
                    description="Daftar user sedang dimuat dari backend."
                    compact
                  />
                ) : error && users.length === 0 ? (
                  <FeedbackState
                    variant="error"
                    title="Failed to load users"
                    description={error}
                    actionLabel="Try again"
                    onAction={() => loadUsers()}
                    compact
                  />
                ) : (
                  <>
                    {error ? <Alert color="warning">{error}</Alert> : null}
                  <div className="table-responsive">
                    <Table hover>
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>Email</th>
                          <th>Level</th>
                          <th>Stream</th>
                          <th>Updated</th>
                          <th style={{ minWidth: "180px" }}>Set Level</th>
                          <th style={{ minWidth: "200px" }}>Set Stream</th>
                          <th style={{ minWidth: "180px" }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="py-4">
                              <FeedbackState
                                variant="empty"
                                title="No matching users"
                                description={
                                  search.trim()
                                    ? "Tidak ada user yang cocok dengan kata kunci pencarian."
                                    : "Belum ada user yang tersedia untuk ditampilkan."
                                }
                                compact
                              />
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((row) => {
                            const draft = drafts[row.id] || {
                              level: row.level || "Executive",
                              stream: row.stream || "",
                            };
                            const disableStream = STREAM_DISABLED_LEVELS.has(draft.level);
                            const isSelectedAuditRow = selectedAuditUser?.id === row.id;

                            return (
                              <tr
                                key={row.id}
                                style={isSelectedAuditRow ? SELECTED_USER_ROW_STYLE : undefined}
                              >
                                <td>{row.name || "-"}</td>
                                <td>{row.email || "-"}</td>
                                <td>{row.level || "-"}</td>
                                <td>{row.stream || "-"}</td>
                                <td>{formatDateTime(row.updatedAt)}</td>
                                <td>
                                  <Input
                                    type="select"
                                    value={draft.level}
                                    onChange={(event) =>
                                      updateDraft(row.id, "level", event.target.value)
                                    }
                                  >
                                    {LEVEL_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </Input>
                                </td>
                                <td>
                                  <Input
                                    type="select"
                                    value={disableStream ? "" : draft.stream}
                                    disabled={disableStream}
                                    onChange={(event) =>
                                      updateDraft(row.id, "stream", event.target.value)
                                    }
                                  >
                                    <option value="">
                                      {disableStream ? "No stream required" : "Pilih stream"}
                                    </option>
                                    {STREAM_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </Input>
                                </td>
                                <td>
                                  <div className="d-flex gap-2">
                                    <Button
                                      color="light"
                                      size="sm"
                                      onClick={() => handleSelectAuditUser(row)}
                                    >
                                      Audit
                                    </Button>
                                    <Button
                                      color="primary"
                                      size="sm"
                                      disabled={savingId === row.id}
                                      onClick={() => saveUserAccess(row)}
                                    >
                                      {savingId === row.id ? (
                                        <Spinner size="sm" />
                                      ) : (
                                        <>
                                          <Save size={14} className="me-2" />
                                          Simpan
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>
                  </>
                )}
              </CardBody>
            </Card>
          </Col>

          <Col sm="12">
            <div ref={auditSectionRef} style={{ scrollMarginTop: "24px" }}>
            <Card style={{ border: 0 }}>
              <CardHeader
                className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3"
                style={{ background: "transparent" }}
              >
                <div>
                  <h5 className="mb-1 d-flex align-items-center gap-2">
                    <Clock size={18} />
                    Audit Perubahan Akses
                  </h5>
                  <p className="text-muted mb-0">
                    {selectedAuditUser
                      ? `Menampilkan audit untuk ${selectedAuditUser.name || selectedAuditUser.email}.`
                      : "Menampilkan audit perubahan akses untuk semua user."}
                  </p>
                </div>
                <div className="d-flex flex-column flex-sm-row gap-2">
                  <Input
                    type="select"
                    value={auditTake}
                    onChange={(event) => setAuditTake(event.target.value)}
                    style={{ minWidth: "120px" }}
                  >
                    {AUDIT_TAKE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} rows
                      </option>
                    ))}
                  </Input>
                  {selectedAuditUser && (
                    <Button color="secondary" outline onClick={() => setSelectedAuditUser(null)}>
                      Semua Audit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="table-toolbar-pill table-toolbar-pill--results">
                    Scope: {selectedAuditUser ? "User Selected" : "All Users"}
                  </span>
                  <span className="table-toolbar-pill table-toolbar-pill--results">
                    Records: {auditItems.length}
                  </span>
                </div>

                {loadingAudit ? (
                  <FeedbackState
                    variant="loading"
                    title="Loading access audit"
                    description="Riwayat perubahan akses sedang dimuat."
                    compact
                  />
                ) : auditError && auditItems.length === 0 ? (
                  <FeedbackState
                    variant="error"
                    title="Failed to load access audit"
                    description={auditError}
                    actionLabel="Try again"
                    onAction={() => loadAudit(selectedAuditUser?.id)}
                    compact
                  />
                ) : (
                  <>
                  {auditError ? <Alert color="warning">{auditError}</Alert> : null}
                  <div className="table-responsive">
                    <Table hover>
                      <thead>
                        <tr>
                          <th>Target</th>
                          <th>Perubahan</th>
                          <th>Diubah Oleh</th>
                          <th>Waktu</th>
                          <th>IP Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditItems.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="py-4">
                              <FeedbackState
                                variant="empty"
                                title="No access audit yet"
                                description="Belum ada riwayat audit perubahan akses untuk scope yang dipilih."
                                compact
                              />
                            </td>
                          </tr>
                        ) : (
                          auditItems.map((item) => (
                            <tr key={item.id || `${item.targetUserId}-${item.changedAt}`}>
                              <td>{item.targetName || item.targetEmail || item.targetUserId || "-"}</td>
                              <td>
                                {(item.previousLevel || "-")}/{item.previousStream || "-"} ke{" "}
                                {(item.newLevel || "-")}/{item.newStream || "-"}
                              </td>
                              <td>
                                {item.changedByName ||
                                  item.changedByEmail ||
                                  item.changedByUserId ||
                                  "-"}
                              </td>
                              <td>{formatDateTime(item.changedAt)}</td>
                              <td>{item.ipAddress || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>
                  </>
                )}
              </CardBody>
            </Card>
            </div>
          </Col>
        </Row>
      </Container>
    </Fragment>
  );
};

export default UserAccessAdmin;
