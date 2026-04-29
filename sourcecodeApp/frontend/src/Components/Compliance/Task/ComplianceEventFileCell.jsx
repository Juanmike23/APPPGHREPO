/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/ComplianceEventFileCell.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useMemo, useRef, useState } from "react";
import { FaDownload, FaUpload } from "react-icons/fa";
import { Spinner } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";

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

const resolveDocumentFileUrl = (row, documentId) => {
  const rawUrl = String(row?.DocumentFileUrl || "").trim();

  if (rawUrl) {
    try {
      return new URL(rawUrl, process.env.REACT_APP_API_BASE_URL).toString();
    } catch {
      return rawUrl;
    }
  }

  if (!documentId) {
    return "";
  }

  return `${process.env.REACT_APP_API_BASE_URL}documents/${documentId}/file`;
};

const ComplianceEventFileCell = ({
  row,
  onUploadDocument,
  canManageCompliance,
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const documentId = row?.DocumentId ?? null;
  const documentFileUrl = useMemo(
    () => resolveDocumentFileUrl(row, documentId),
    [documentId, row],
  );
  const fileName = row?.FileName || "No File Assigned";
  const hasFile = Boolean(documentFileUrl || documentId || row?.FileName);

  const handleUploadChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploading(true);

    try {
      await onUploadDocument?.(row.Id, file);
    } catch (error) {
      console.error("File upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!documentFileUrl) {
      return;
    }

    setDownloading(true);

    try {
      const response = await authFetch(documentFileUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = row?.FileName || "document";
      link.click();

      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Fragment>
      <div
        onClick={(event) => event.stopPropagation()}
        className="compliance-event-file-cell"
        style={{ minWidth: 0, justifyContent: "center" }}
      >
        <div className="compliance-event-file-cell__inner" style={{ justifyContent: "center" }}>
          <div
            className="compliance-event-file-cell__actions"
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              hidden
              onChange={handleUploadChange}
            />

            {uploading ? (
              <Spinner size="sm" color="success" />
            ) : (
              <FaUpload
                className={`compliance-event-file-cell__icon ${
                  canManageCompliance ? "is-active" : "is-disabled"
                }`}
                style={{
                  fontSize: "18px",
                  color: canManageCompliance ? "#16a34a" : "#cbd5e1",
                  cursor: canManageCompliance ? "pointer" : "not-allowed",
                  opacity: canManageCompliance ? 1 : 0.85,
                }}
                title={
                  canManageCompliance
                    ? hasFile
                      ? "Replace file"
                      : "Upload file"
                    : "Only Manager Compliance can upload"
                }
                onClick={canManageCompliance ? () => inputRef.current?.click() : undefined}
              />
            )}

            {downloading ? (
              <Spinner size="sm" color="success" />
            ) : (
              <FaDownload
                className={`compliance-event-file-cell__icon ${
                  documentFileUrl ? "is-active" : "is-disabled"
                }`}
                style={{
                  fontSize: "18px",
                  color: documentFileUrl ? "#16a34a" : "#cbd5e1",
                  cursor: documentFileUrl ? "pointer" : "not-allowed",
                  opacity: documentFileUrl ? 1 : 0.85,
                }}
                title={documentFileUrl ? `Download ${fileName}` : "No file to download"}
                onClick={documentFileUrl ? handleDownload : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default ComplianceEventFileCell;
