/*
 * PGH-DOC
 * File: src/Variables/Table/TableToolBarElement/ImageUpload.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useMemo, useRef, useState } from "react";
import { FaDownload, FaUpload } from "react-icons/fa";
import { Spinner } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";
import "./ImageUpload.scss";

const UploadPhoto = ({
  apiUrl,
  rowId,
  column,
  currentValue,
  onUploaded,
  uiVariant = "default",
  align = "start",
}) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState(
    currentValue ? `${apiUrl}/image/${rowId}/${column}` : null,
  );
  const isComplianceEventsVariant =
    String(uiVariant || "").trim().toLowerCase() === "compliance-events";
  const wrapperClassName = useMemo(
    () =>
      `table-image-upload${align === "center" ? " table-image-upload--center" : ""}`,
    [align],
  );
  const actionsClassName = useMemo(
    () =>
      `table-image-upload__actions${
        isComplianceEventsVariant
          ? " table-image-upload__actions--compliance-events"
          : ""
      }`,
    [isComplianceEventsVariant],
  );

  const handleDownload = async () => {
    if (!localImageUrl) {
      return;
    }

    setDownloading(true);

    try {
      const response = await fetch(localImageUrl, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = localImageUrl.split("/").pop() || "image";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);

    try {
      const response = await fetch(`${apiUrl}/image/${rowId}/${column}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await response.json();

      const uploadedUrl = `${apiUrl}/image/${rowId}/${column}`;
      setLocalImageUrl(uploadedUrl);
      onUploaded?.(uploadedUrl);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className={wrapperClassName}
    >
      <div className={actionsClassName}>

        {uploading ? (
          <Spinner size="sm" color="success" />
        ) : (
          <FaUpload
            className="table-image-upload__icon table-image-upload__icon--action"
            title={localImageUrl ? "Replace image" : "Upload image"}
            onClick={() => fileInputRef.current?.click()}
          />
        )}

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />

        {downloading ? (
          <Spinner size="sm" color="success" />
        ) : (
          <FaDownload
            className={`table-image-upload__icon ${
              localImageUrl
                ? "table-image-upload__icon--action"
                : "table-image-upload__icon--disabled"
            }`}
            title={localImageUrl ? "Download image" : "No image to download"}
            onClick={localImageUrl ? handleDownload : undefined}
          />
        )}
      </div>
    </div>
  );
};

export default UploadPhoto;
