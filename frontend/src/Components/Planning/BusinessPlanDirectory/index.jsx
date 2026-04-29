/*
 * PGH-DOC
 * File: src/Components/Planning/BusinessPlanDirectory/index.jsx
 * Apa fungsi bagian ini:
 * - Halaman folder directory Planning untuk membuat folder bertingkat dan mengelola file dokumen.
 * Kenapa perlu:
 * - Perlu agar user Planning punya struktur file yang rapi, tidak lagi berupa list flat.
 * Aturan khususnya apa:
 * - Endpoint memakai API Planning folder directory.
 * - Folder dan file mengikuti struktur parent-child dari backend.
 * - User read-only hanya boleh lihat struktur dan download file.
 */

import React, {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Form,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
} from "@pgh/ui-bootstrap";
import {
  ChevronRight,
  Download,
  File,
  FileText,
  Folder,
  FolderPlus,
  MoreVertical,
  UploadCloud,
} from "react-feather";
import { toast } from "react-toastify";
import { useAuth } from "../../../Auth/AuthContext";
import { canEditPath, isReadOnlyUser } from "../../../Auth/accessControl";
import ChangeLogModal from "../../../Variables/ActionCell/ChangeLogModal";
import FeedbackState from "../../Common/FeedbackState";
import WeeklyTableRenameModal from "../../Compliance/Weekly/WeeklyTableRenameModal";
import "./index.scss";

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 24;
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];
const ACCEPTED_EXTENSIONS = [".ppt", ".pptx", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv"];
const ACCEPT_ATTRIBUTE = ".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.csv";
const API_BASE = (process.env.REACT_APP_API_BASE_URL || "/api/").replace(/\/+$/, "");
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");

const buildApiUrl = (path, params = null) => {
  const query = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        return;
      }

      query.set(key, String(value));
    });
  }

  const queryString = query.toString();
  return `${API_BASE}/${path}${queryString ? `?${queryString}` : ""}`;
};

const authFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return response;
};

const getEntryVisual = (entry) => {
  if (entry?.IsFolder) {
    return {
      icon: Folder,
      iconClass: "business-plan-directory-item__icon business-plan-directory-item__icon--folder",
      typeLabel: "Folder",
    };
  }

  const extension = String(entry?.Extension || "").toLowerCase();
  if (["ppt", "pptx"].includes(extension)) {
    return {
      icon: FileText,
      iconClass: "business-plan-directory-item__icon business-plan-directory-item__icon--presentation",
      typeLabel: extension.toUpperCase(),
    };
  }

  if (["xls", "xlsx", "csv"].includes(extension)) {
    return {
      icon: File,
      iconClass: "business-plan-directory-item__icon business-plan-directory-item__icon--spreadsheet",
      typeLabel: extension.toUpperCase(),
    };
  }

  if (extension === "pdf") {
    return {
      icon: File,
      iconClass: "business-plan-directory-item__icon business-plan-directory-item__icon--pdf",
      typeLabel: "PDF",
    };
  }

  if (["doc", "docx"].includes(extension)) {
    return {
      icon: FileText,
      iconClass: "business-plan-directory-item__icon business-plan-directory-item__icon--document",
      typeLabel: extension.toUpperCase(),
    };
  }

  return {
    icon: FileText,
    iconClass: "business-plan-directory-item__icon business-plan-directory-item__icon--file",
    typeLabel: extension ? extension.toUpperCase() : "FILE",
  };
};

const formatUploadedAt = (value) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("id-ID");
};

const formatFileSize = (bytes) => {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeFolderName = (value) => String(value ?? "").trim();

const BusinessPlanDirectory = () => {
  const { user } = useAuth();
  const uploadInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const latestRequestRef = useRef(0);
  const [entries, setEntries] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState(null);
  const [pendingRenameEntry, setPendingRenameEntry] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [includeDescendantsSearch, setIncludeDescendantsSearch] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortFilter, setSortFilter] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    totalCount: 0,
    hasMore: false,
  });

  const canManageDirectory = useMemo(
    () => canEditPath(user, `${PUBLIC_URL}/planning/businessPlan`) && !isReadOnlyUser(user),
    [user],
  );

  const queryParams = useMemo(
    () => ({
      parentId: currentFolderId,
      search: searchTerm.trim(),
      includeDescendants: includeDescendantsSearch,
      type: typeFilter,
      sort: sortFilter,
      page,
      pageSize,
    }),
    [currentFolderId, includeDescendantsSearch, page, pageSize, searchTerm, sortFilter, typeFilter],
  );

  const loadEntries = useCallback(async (requestId = null) => {
    const requestUrl = buildApiUrl("planning/business-plan-directory/entries", queryParams);
    const response = await authFetch(requestUrl);
    const data = await response.json();

    if (requestId !== null && requestId !== latestRequestRef.current) {
      return;
    }

    startTransition(() => {
      setEntries(Array.isArray(data?.items) ? data.items : []);
      setBreadcrumbs(Array.isArray(data?.breadcrumbs) ? data.breadcrumbs : []);
      setCurrentFolder(data?.currentFolder ?? null);
      setPagination({
        page: Number(data?.pagination?.page) || 1,
        pageSize: Number(data?.pagination?.pageSize) || PAGE_SIZE,
        totalCount: Number(data?.pagination?.totalCount) || 0,
        hasMore: Boolean(data?.pagination?.hasMore),
      });
    });
  }, [queryParams]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    debounceTimerRef.current = setTimeout(async () => {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      try {
        setLoading(true);
        await loadEntries(requestId);
      } catch (error) {
        if (requestId === latestRequestRef.current) {
          toast.error("Gagal memuat isi folder.");
        }
      } finally {
        if (requestId === latestRequestRef.current) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [loadEntries]);

  const handleOpenFolder = (entry) => {
    if (!entry?.IsFolder) {
      return;
    }

    setCurrentFolderId(entry.Id);
    setPage(1);
  };

  const handleBreadcrumbClick = (folderId) => {
    setCurrentFolderId(folderId ?? null);
    setPage(1);
  };

  const handleUploadClick = () => {
    if (!canManageDirectory) {
      return;
    }
    uploadInputRef.current?.click();
  };

  const handleCreateFolder = async () => {
    if (!canManageDirectory) {
      toast.error("Folder Planning hanya bisa diubah oleh user Planning yang punya akses edit.");
      return;
    }

    const normalizedName = normalizeFolderName(newFolderName);
    if (!normalizedName) {
      toast.warning("Nama folder wajib diisi.");
      return;
    }

    try {
      setCreatingFolder(true);
      const formData = new FormData();
      formData.append("name", normalizedName);
      if (currentFolderId !== null && currentFolderId !== undefined) {
        formData.append("parentId", String(currentFolderId));
      }

      await authFetch(buildApiUrl("planning/business-plan-directory/folders"), {
        method: "POST",
        body: formData,
      });

      setFolderModalOpen(false);
      setNewFolderName("");
      toast.success("Folder berhasil dibuat.");
      await loadEntries();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Gagal membuat folder.",
      );
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUpload = async (event) => {
    if (!canManageDirectory) {
      event.target.value = "";
      toast.error("Folder Planning hanya bisa diubah oleh user Planning yang punya akses edit.");
      return;
    }

    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) {
      return;
    }

    const invalidFiles = selectedFiles.filter((file) => {
      const lowerName = (file.name || "").toLowerCase();
      return !ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
    });

    if (invalidFiles.length > 0) {
        toast.error("Hanya file PPT, PPTX, PDF, DOC, DOCX, XLS, XLSX, atau CSV yang bisa di-upload.");
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (currentFolderId !== null && currentFolderId !== undefined) {
          formData.append("parentId", String(currentFolderId));
        }

        await authFetch(buildApiUrl("planning/business-plan-directory/upload"), {
          method: "POST",
          body: formData,
        });
      }

      toast.success("Upload file berhasil.");
      await loadEntries();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Upload file gagal.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDownload = async (entry) => {
    try {
      setDownloadingId(entry.Id);
      const response = await authFetch(
        buildApiUrl(`planning/business-plan-directory/${entry.Id}/file`),
      );

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = entry.FileName || "planning-file";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Download file gagal.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (entry = pendingDeleteEntry) => {
    if (!canManageDirectory) {
      toast.error("Folder Planning hanya bisa diubah oleh user Planning yang punya akses edit.");
      return;
    }

    if (!entry?.Id) {
      return;
    }

    try {
      setOpenActionMenuId(null);
      setDeletingId(entry.Id);
      await authFetch(buildApiUrl(`planning/business-plan-directory/${entry.Id}`), {
        method: "DELETE",
      });
      toast.success(entry?.IsFolder ? "Folder berhasil dihapus." : "File berhasil dihapus.");

      if (currentFolderId === entry.Id) {
        setCurrentFolderId(entry?.ParentId ?? null);
        setPage(1);
      } else if (entries.length === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await loadEntries();
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Hapus item gagal.",
      );
    } finally {
      setDeletingId(null);
      setPendingDeleteEntry(null);
    }
  };

  const handleRename = async (entryName) => {
    if (!canManageDirectory) {
      throw new Error("Folder Planning hanya bisa diubah oleh user Planning yang punya akses edit.");
    }

    if (!pendingRenameEntry?.Id) {
      return;
    }

    const normalizedName = normalizeFolderName(entryName);
    if (!normalizedName) {
      toast.warning("Nama file atau folder wajib diisi.");
      return;
    }

    try {
      await authFetch(buildApiUrl(`planning/business-plan-directory/${pendingRenameEntry.Id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });

      toast.success(
        pendingRenameEntry?.IsFolder
          ? "Nama folder berhasil diubah."
          : "Nama file berhasil diubah.",
      );
      setPendingRenameEntry(null);
      await loadEntries();
    } catch (error) {
      throw new Error(
        error instanceof Error && error.message
          ? error.message
          : "Gagal mengubah nama file atau folder.",
      );
    }
  };

  const totalPages = Math.max(1, Math.ceil((pagination.totalCount || 0) / (pagination.pageSize || pageSize || PAGE_SIZE)));

  return (
    <Fragment>
      <div className="business-plan-directory-page">
        <Card className="business-plan-directory-card">
          <CardHeader className="business-plan-directory-header">
            <Row className="g-2 align-items-end">
              <Col lg="5" md="6" sm="12">
                <Label className="mb-1">Search</Label>
                <Input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari nama folder atau file..."
                />
                <div className="business-plan-directory-search-scope form-check mt-2">
                  <Input
                    id="business-plan-directory-search-subtree"
                    type="checkbox"
                    className="form-check-input"
                    checked={includeDescendantsSearch}
                    onChange={(event) => {
                      setIncludeDescendantsSearch(event.target.checked);
                      setPage(1);
                    }}
                  />
                  <Label
                    for="business-plan-directory-search-subtree"
                    className="form-check-label mb-0"
                  >
                    Cari seluruh subfolder
                  </Label>
                </div>
              </Col>

              <Col lg="3" md="3" sm="6">
                <Label className="mb-1">Tipe</Label>
                <Input
                  type="select"
                  value={typeFilter}
                  onChange={(event) => {
                    setTypeFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua</option>
                  <option value="folder">Folder</option>
                  <option value="file">File</option>
                  <option value="presentation">Presentation</option>
                  <option value="document">Document</option>
                  <option value="spreadsheet">Spreadsheet</option>
                  <option value="pdf">PDF</option>
                </Input>
              </Col>

              <Col lg="4" md="3" sm="6">
                <Label className="mb-1">Urutkan</Label>
                <Input
                  type="select"
                  value={sortFilter}
                  onChange={(event) => {
                    setSortFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="name-asc">Nama A-Z</option>
                  <option value="name-desc">Nama Z-A</option>
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                </Input>
              </Col>

            </Row>

            <Row className="g-2 mt-2">
              <Col xs="12" className="business-plan-directory-header__actions">
                {canManageDirectory && (
                  <Form className="business-plan-directory-upload-form">
                    <Button
                      color="primary"
                      onClick={handleUploadClick}
                      disabled={uploading}
                      className="business-plan-directory-action-btn"
                    >
                      <UploadCloud size={15} className="me-1" />
                      {uploading ? "Uploading..." : "Upload File"}
                    </Button>
                    <Input
                      innerRef={uploadInputRef}
                      className="d-none"
                      type="file"
                      multiple
                      accept={ACCEPT_ATTRIBUTE}
                      onChange={handleUpload}
                    />
                  </Form>
                )}

                {canManageDirectory && (
                  <Button
                    color="light"
                    onClick={() => setFolderModalOpen(true)}
                    disabled={creatingFolder || uploading}
                    className="business-plan-directory-action-btn"
                  >
                    <FolderPlus size={15} className="me-1" />
                    New Folder
                  </Button>
                )}

                <ChangeLogModal
                  tableName="BusinessPlanFile"
                  titleLabel="Riwayat Perubahan Planning Folder"
                  triggerMode="header"
                  triggerLabel="Riwayat Perubahan"
                  showLastUpdated={false}
                  allowNavigateToChange={false}
                />
              </Col>
            </Row>
          </CardHeader>

          <CardBody>
            {isReadOnlyUser(user) && (
              <Alert color="light" className="business-plan-directory-alert">
                Folder ini read-only untuk akun Anda. Anda tetap bisa buka struktur folder dan download file.
              </Alert>
            )}

            <div className="business-plan-directory-breadcrumb">
              {(breadcrumbs.length ? breadcrumbs : [{ Id: null, Name: "Root" }]).map((item, index) => {
                const isLast = index === (breadcrumbs.length ? breadcrumbs.length - 1 : 0);
                return (
                  <Fragment key={`breadcrumb-${item?.Id ?? "root"}-${index}`}>
                    <button
                      type="button"
                      className={`business-plan-directory-breadcrumb__item ${isLast ? "is-active" : ""}`}
                      onClick={() => handleBreadcrumbClick(item?.Id ?? null)}
                      disabled={isLast}
                    >
                      {item?.Name || "Root"}
                    </button>
                    {!isLast && <ChevronRight size={14} className="business-plan-directory-breadcrumb__separator" />}
                  </Fragment>
                );
              })}
            </div>

            <div className="business-plan-directory-subtitle">
              {currentFolder?.Name
                ? `Folder aktif: ${currentFolder.Name}`
                : "Folder aktif: Root"}
              {includeDescendantsSearch && searchTerm.trim()
                ? " | Pencarian mencakup seluruh subfolder."
                : ""}
            </div>

            {loading ? (
              <FeedbackState
                variant="loading"
                title="Memuat isi folder"
                description="Struktur folder sedang disiapkan."
              />
            ) : entries.length === 0 ? (
              <FeedbackState
                variant="empty"
                title="Folder kosong"
                description="Belum ada folder atau file yang sesuai filter di lokasi ini."
              />
            ) : (
              <div className="business-plan-directory-grid">
                {entries.map((entry) => {
                  const busy = deletingId === entry.Id || downloadingId === entry.Id;
                  const { icon: EntryIcon, iconClass, typeLabel } = getEntryVisual(entry);
                  return (
                    <div
                      key={entry.Id}
                      className={`business-plan-directory-item ${entry.IsFolder ? "is-folder" : "is-file"}`}
                    >
                      <div className="business-plan-directory-item__top">
                        <div className={iconClass}>
                          <EntryIcon size={26} />
                        </div>

                        <Dropdown
                          isOpen={openActionMenuId === entry.Id}
                          toggle={() =>
                            setOpenActionMenuId((prev) => (prev === entry.Id ? null : entry.Id))
                          }
                        >
                          <DropdownToggle
                            tag="button"
                            className="business-plan-directory-item__action-btn"
                            type="button"
                            color="transparent"
                            caret={false}
                          >
                            <MoreVertical size={16} />
                          </DropdownToggle>
                          <DropdownMenu end>
                            {entry.IsFolder ? (
                              <DropdownItem onClick={() => {
                                setOpenActionMenuId(null);
                                handleOpenFolder(entry);
                              }}>
                                Open Folder
                              </DropdownItem>
                            ) : (
                              <DropdownItem onClick={() => {
                                setOpenActionMenuId(null);
                                handleDownload(entry);
                              }}>
                                <Download size={14} className="me-2" />
                                Download
                              </DropdownItem>
                            )}
                            {canManageDirectory && (
                              <DropdownItem
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setPendingRenameEntry(entry);
                                }}
                              >
                                Rename
                              </DropdownItem>
                            )}
                            {canManageDirectory && (
                              <DropdownItem
                                className="text-danger"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setPendingDeleteEntry(entry);
                                }}
                              >
                                Delete
                              </DropdownItem>
                            )}
                          </DropdownMenu>
                        </Dropdown>
                      </div>

                      <button
                        type="button"
                        className={`business-plan-directory-item__name ${entry.IsFolder ? "is-clickable" : ""}`}
                        title={entry.FileName}
                        onClick={() => {
                          if (entry.IsFolder) {
                            handleOpenFolder(entry);
                          }
                        }}
                        disabled={!entry.IsFolder}
                      >
                        {entry.FileName}
                      </button>

                      <div className="business-plan-directory-item__meta">
                        {entry.IsFolder ? (
                          <>
                            <span>Tipe: {typeLabel}</span>
                            <span>{entry.ChildCount || 0} item</span>
                          </>
                        ) : (
                          <>
                            <span>Tipe: {typeLabel}</span>
                            <span>Uploaded: {formatUploadedAt(entry.UploadedAt)}</span>
                            <span>Size: {formatFileSize(entry.FileSize)}</span>
                          </>
                        )}
                      </div>

                      {entry.IsFolder ? (
                        <Button
                          color="light"
                          className="business-plan-directory-item__cta"
                          onClick={() => handleOpenFolder(entry)}
                          disabled={busy}
                        >
                          Open
                        </Button>
                      ) : (
                        <Button
                          color="light"
                          className="business-plan-directory-item__cta"
                          onClick={() => handleDownload(entry)}
                          disabled={busy}
                        >
                          {downloadingId === entry.Id ? "Downloading..." : "Download"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {pagination.totalCount > 0 && (
              <div className="table-pagination-footer d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top mt-3">
                <div className="table-pagination-footer__summary small text-muted">
                  Menampilkan{" "}
                  <strong>
                    {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.totalCount)}-
                    {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}
                  </strong>{" "}
                  dari <strong>{pagination.totalCount}</strong> item
                </div>

                <div className="table-pagination-footer__controls d-flex flex-wrap align-items-center gap-2">
                  <span className="table-pagination-footer__label small text-muted">Baris</span>
                  <select
                    className="table-pagination-footer__select form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={pageSize}
                    disabled={loading}
                    onChange={(event) => {
                      const nextSize = Number(event.target.value) || PAGE_SIZE;
                      setPageSize(nextSize);
                      setPage(1);
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="table-pagination-footer__button btn btn-outline-secondary btn-sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={loading || pagination.page <= 1}
                  >
                    Sebelumnya
                  </button>
                  <span className="table-pagination-footer__page small text-muted">
                    Halaman {pagination.page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="table-pagination-footer__button btn btn-outline-secondary btn-sm"
                    onClick={() => setPage((prev) => prev + 1)}
                    disabled={loading || !pagination.hasMore}
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        isOpen={folderModalOpen}
        toggle={() => setFolderModalOpen((prev) => !prev)}
        centered
        className="table-utility-modal business-plan-directory-modal"
      >
        <ModalHeader toggle={() => setFolderModalOpen(false)}>New Folder</ModalHeader>
        <ModalBody>
          <Label className="mb-1">Nama Folder</Label>
          <Input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Contoh: 2026 / Divisi / Draft"
            autoFocus
          />
          <small className="text-muted d-block mt-2">
            Folder akan dibuat di
            {" "}
            <strong>{currentFolder?.Name || "Root"}</strong>.
          </small>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setFolderModalOpen(false)} disabled={creatingFolder}>
            Batal
          </Button>
          <Button color="primary" onClick={handleCreateFolder} disabled={creatingFolder}>
            {creatingFolder ? "Membuat..." : "Buat Folder"}
          </Button>
        </ModalFooter>
      </Modal>

      <WeeklyTableRenameModal
        isOpen={Boolean(pendingRenameEntry)}
        toggle={() => setPendingRenameEntry(null)}
        initialName={pendingRenameEntry?.FileName || ""}
        onSubmit={handleRename}
        modalTitle={pendingRenameEntry?.IsFolder ? "Edit Nama Folder" : "Edit Nama File"}
        fieldLabel={pendingRenameEntry?.IsFolder ? "Nama Folder" : "Nama File"}
      />

      <Modal
        isOpen={Boolean(pendingDeleteEntry)}
        toggle={() => {
          if (!deletingId) {
            setPendingDeleteEntry(null);
          }
        }}
        centered
        className="table-utility-modal business-plan-directory-modal"
      >
        <ModalHeader
          toggle={() => {
            if (!deletingId) {
              setPendingDeleteEntry(null);
            }
          }}
        >
          Delete
        </ModalHeader>
        <ModalBody>
          {pendingDeleteEntry?.IsFolder ? (
            <>
              Folder <strong>{pendingDeleteEntry?.FileName || "Belum Diisi"}</strong> akan dihapus
              beserta seluruh isi di dalamnya.
            </>
          ) : (
            <>
              File <strong>{pendingDeleteEntry?.FileName || "Belum Diisi"}</strong> akan dihapus.
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="light"
            onClick={() => setPendingDeleteEntry(null)}
            disabled={Boolean(deletingId)}
          >
            Batal
          </Button>
          <Button
            color="danger"
            onClick={() => handleDelete(pendingDeleteEntry)}
            disabled={Boolean(deletingId)}
          >
            {deletingId ? "Menghapus..." : "Delete"}
          </Button>
        </ModalFooter>
      </Modal>
    </Fragment>
  );
};

export default BusinessPlanDirectory;
