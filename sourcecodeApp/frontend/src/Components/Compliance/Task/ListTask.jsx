/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/ListTask.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useMemo, useState } from "react";
import { Button, Card, CardHeader } from "@pgh/ui-bootstrap";

import { H6 } from "../../../AbstractElements";
import ChangeLogModal from "../../../Variables/ActionCell/ChangeLogModal";
import CreatedByme from "./CreatedByme";

const COMPLIANCE_EVENTS_DEFAULT_PAGE_SIZE = 25;
const COMPLIANCE_EVENTS_PAGE_SIZE_OPTIONS = [25, 50, 100];

const ListOfTask = ({
  activeGroup,
  reports = [],
  onDelete,
  onUpdate,
  onUploadDocument,
  onAddRow,
  highlightRowId,
  canManageCompliance,
  isAllEventsView = false,
}) => {
  const activeGroupId = Number(activeGroup?.id ?? activeGroup?.GroupId ?? 0) || null;
  const docs = isAllEventsView
    ? reports
    : activeGroupId
    ? reports.filter(
        (item) =>
          Number(item?.GroupId ?? item?.groupId ?? 0) === activeGroupId,
      )
    : [];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(COMPLIANCE_EVENTS_DEFAULT_PAGE_SIZE);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(docs.length / pageSize)),
    [docs.length, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [activeGroupId, isAllEventsView]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!highlightRowId) {
      return;
    }

    const highlightedIndex = docs.findIndex(
      (item) => Number(item?.Id ?? item?.id ?? 0) === Number(highlightRowId),
    );

    if (highlightedIndex < 0) {
      return;
    }

    const targetPage = Math.floor(highlightedIndex / pageSize) + 1;
    setPage((currentPage) => (currentPage === targetPage ? currentPage : targetPage));
  }, [docs, highlightRowId, pageSize]);

  const paginatedDocs = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return docs.slice(startIndex, startIndex + pageSize);
  }, [docs, page, pageSize]);

  const pageRange = useMemo(() => {
    if (docs.length === 0 || paginatedDocs.length === 0) {
      return { from: 0, to: 0 };
    }

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(docs.length, from + paginatedDocs.length - 1);
    return { from, to };
  }, [docs.length, page, pageSize, paginatedDocs.length]);

  return (
    <Fragment>
      <Card className="compliance-dashboard-card compliance-events-detail-card mb-0">
        <CardHeader className="compliance-events-detail-card__header d-flex justify-content-between align-items-center">
          <H6 attrH6={{ className: "mb-0 f-w-600 compliance-events-detail-card__title" }}>
            {isAllEventsView
              ? "All Events [All]"
              : activeGroup
              ? `${activeGroup.periodName} [${activeGroup.period || "Unknown"}]`
              : "No Event Selected"}
          </H6>
          <div className="compliance-events-detail-card__actions">
            <div className="compliance-events-detail-card__meta">
              {docs.length} row{docs.length === 1 ? "" : "s"}
            </div>
            <ChangeLogModal
              tableName="DocumentPeriodReport"
              titleLabel={
                isAllEventsView
                  ? "Riwayat Perubahan Isi Events"
                  : activeGroup?.periodName
                  ? `Riwayat Perubahan Isi Events: ${activeGroup.periodName}`
                  : "Riwayat Perubahan Isi Events"
              }
              scopeTableName={!isAllEventsView && activeGroupId ? "DocumentPeriodReportGroup" : null}
              scopeEntityId={!isAllEventsView && activeGroupId ? activeGroupId : null}
              triggerMode="header"
              triggerLabel="Riwayat Perubahan"
              showLastUpdated={false}
              allowNavigateToChange={false}
            />
            {canManageCompliance && activeGroupId && !isAllEventsView && (
              <Button
                color="primary"
                size="sm"
                className="compliance-events-detail-card__add-btn"
                onClick={() => onAddRow?.(activeGroupId)}
              >
                + Add Row
              </Button>
            )}
          </div>
        </CardHeader>

        <CreatedByme
          docs={paginatedDocs}
          totalCount={docs.length}
          onDelete={(row) => onDelete?.(row)}
          onUpdate={onUpdate}
          onUploadDocument={onUploadDocument}
          highlightRowId={highlightRowId}
          canManageCompliance={canManageCompliance}
          showGroupColumn={isAllEventsView}
        />

        {docs.length > 0 ? (
          <div className="compliance-events-detail-card__footer">
            <div className="compliance-events-detail-card__footer-summary">
              Menampilkan {pageRange.from}-{pageRange.to} dari {docs.length} data
            </div>

            <div className="compliance-events-detail-card__footer-actions">
              <span className="compliance-events-detail-card__footer-label">Baris</span>
              <select
                className="form-select form-select-sm"
                style={{ width: "auto" }}
                value={pageSize}
                onChange={(event) => {
                  const nextPageSize =
                    Number(event.target.value) || COMPLIANCE_EVENTS_DEFAULT_PAGE_SIZE;
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
              >
                {COMPLIANCE_EVENTS_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              >
                Sebelumnya
              </button>

              <span className="compliance-events-detail-card__footer-label">
                Halaman {page} / {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((currentPage) => Math.min(totalPages, currentPage + 1))
                }
              >
                Berikutnya
              </button>
            </div>
          </div>
        ) : null}
      </Card>
    </Fragment>
  );
};

export default ListOfTask;
