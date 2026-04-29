/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/index.jsx
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
import axios from "axios";
import { Container, Row } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";

import { useAuth } from "../../../Auth/AuthContext";
import { canEditComplianceContent } from "../../../Auth/accessControl";
import EventProgressChart from "./EventProgressChart";
import TabClass from "./TabClass";
import ComplianceEventScope from "./ComplianceEventScope";
import ComplianceEventCreateModal from "./ComplianceEventCreateModal";
import ComplianceEventRenameModal from "./ComplianceEventRenameModal";
import ComplianceEventDeleteModal from "./ComplianceEventDeleteModal";
import ComplianceEventRowDeleteModal from "./ComplianceEventRowDeleteModal";
import {
  ALL_COMPLIANCE_EVENTS_ID,
  useComplianceEventGroups,
} from "./useComplianceEventGroups";
import "./complianceEvents.scss";

const apiUrl = (path) =>
  `${String(process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "")}/${path}`;

const ReportLayout = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [highlightRowId, setHighlightRowId] = useState(null);
  const [pendingScrollRowId, setPendingScrollRowId] = useState(null);
  const [pendingScrollToDetail, setPendingScrollToDetail] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rowDeleteModalOpen, setRowDeleteModalOpen] = useState(false);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const detailRef = useRef(null);
  const reportsRequestSequenceRef = useRef(0);
  const canManageCompliance = canEditComplianceContent(user);
  const {
    groups,
    activeGroup,
    loading: groupLoading,
    error: groupError,
    selectedGroup,
    selectedGroupId,
    setSelectedGroupId,
    renameGroup,
    deleteGroup,
    upsertGroupLocally,
    removeGroupLocally,
    adjustGroupRowCount,
  } = useComplianceEventGroups();

  const currentGroup = selectedGroup ?? activeGroup;
  const currentGroupId =
    Number(selectedGroupId) === ALL_COMPLIANCE_EVENTS_ID
      ? ALL_COMPLIANCE_EVENTS_ID
      : Number(selectedGroupId ?? currentGroup?.id ?? 0) || null;
  const isAllEventsSelected = currentGroupId === ALL_COMPLIANCE_EVENTS_ID;
  const groupOrderMap = useMemo(() => {
    return groups.reduce((accumulator, group, index) => {
      const groupId = Number(group?.id ?? 0);
      if (groupId > 0) {
        accumulator[groupId] = index;
      }
      return accumulator;
    }, {});
  }, [groups]);

  const fetchReports = useCallback(async (groupId = currentGroupId) => {
    if (groupId == null) {
      setReports([]);
      return;
    }

    const requestSequence = ++reportsRequestSequenceRef.current;

    try {
      const queryString =
        Number(groupId) === ALL_COMPLIANCE_EVENTS_ID ? "?groupId=0" : `?groupId=${groupId}`;
      const res = await axios.get(apiUrl(`DocumentPeriodReport${queryString}`), {
        withCredentials: true,
      });
      if (requestSequence !== reportsRequestSequenceRef.current) {
        return;
      }
      const data = Array.isArray(res.data) ? res.data : res.data.rows || [];
      setReports(data);
    } catch (err) {
      if (requestSequence !== reportsRequestSequenceRef.current) {
        return;
      }
      console.error("Failed to fetch reports:", err);
      setReports([]);
    }
  }, [currentGroupId]);

  useEffect(() => {
    fetchReports(currentGroupId);
  }, [currentGroupId, fetchReports]);

  useEffect(() => {
    if (!pendingScrollToDetail) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingScrollToDetail(false);
    }, 80);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [pendingScrollToDetail]);

  useEffect(() => {
    if (!pendingScrollRowId) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      const targetRow = document.getElementById(
        `compliance-event-row-${pendingScrollRowId}`,
      );

      if (!targetRow) {
        return;
      }

      targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingScrollRowId(null);
    }, 120);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [pendingScrollRowId, reports]);

  const handleSelectGroup = (groupId, rowId = null) => {
    if (groupId == null) {
      return;
    }

    setSelectedGroupId(Number(groupId));
    setHighlightRowId(rowId);
    setPendingScrollRowId(rowId || null);
    setPendingScrollToDetail(!rowId);

    if (rowId) {
      return;
    }
  };

  const mergeReportRow = useCallback((targetId, nextRow) => {
    if (!targetId || !nextRow || typeof nextRow !== "object") {
      return;
    }

    setReports((prev) =>
      prev.map((currentRow) => {
        const currentId = Number(currentRow?.Id ?? currentRow?.id ?? 0);
        return currentId === Number(targetId)
          ? { ...currentRow, ...nextRow }
          : currentRow;
      }),
    );
  }, []);

  const handleSelectDocument = (groupId, rowId) => {
    if (isAllEventsSelected) {
      setSelectedGroupId(ALL_COMPLIANCE_EVENTS_ID);
      setHighlightRowId(rowId);
      setPendingScrollRowId(rowId || null);
      setPendingScrollToDetail(false);
      return;
    }

    handleSelectGroup(groupId, rowId);
  };

  const handleDelete = (row) => {
    if (!canManageCompliance) {
      toast.error("Only Manager Compliance can edit Events.");
      return;
    }

    setPendingDeleteRow(row || null);
    setRowDeleteModalOpen(true);
  };

  const closeRowDeleteModal = () => {
    setRowDeleteModalOpen(false);
    setPendingDeleteRow(null);
  };

  const handleConfirmDelete = async () => {
    const targetId = Number(pendingDeleteRow?.Id ?? pendingDeleteRow?.id ?? 0);
    const targetGroupId = Number(
      pendingDeleteRow?.GroupId ?? pendingDeleteRow?.groupId ?? currentGroupId ?? 0,
    );
    if (!targetId) {
      return;
    }

    try {
      await axios.delete(apiUrl(`DocumentPeriodReport/${targetId}`), {
        withCredentials: true,
      });
      setReports((prev) =>
        prev.filter((row) => Number(row?.Id ?? row?.id ?? 0) !== targetId),
      );
      adjustGroupRowCount(targetGroupId, -1);
      toast.success("Row deleted!");
      setHighlightRowId((prev) => (prev === targetId ? null : prev));
    } catch (err) {
      console.error("Delete failed", err);
      throw new Error(
        err?.response?.data?.message ||
          err?.response?.data?.title ||
          err?.response?.data ||
          "Delete failed!",
      );
    }
  };

  const handleUpdate = useCallback(async (id, payload) => {
    if (!canManageCompliance) {
      toast.error("Only Manager Compliance can edit Events.");
      return false;
    }

    const previousRow =
      reports.find((item) => Number(item?.Id ?? item?.id ?? 0) === Number(id)) || null;
    if (!previousRow) {
      return false;
    }

    const optimisticPatch = { ...payload };
    if (Object.prototype.hasOwnProperty.call(optimisticPatch, "ProgressPercent")) {
      optimisticPatch.Status = optimisticPatch.ProgressPercent;
    }

    mergeReportRow(id, optimisticPatch);

    try {
      const response = await axios.patch(
        apiUrl(`DocumentPeriodReport/${id}`),
        { Changes: payload },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        },
      );

      const updatedRow = response?.data;
      if (updatedRow && typeof updatedRow === "object") {
        mergeReportRow(id, updatedRow);
      }

      toast.success("Cell updated!");
      return true;
    } catch (err) {
      mergeReportRow(id, previousRow);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.title ||
        err?.response?.data ||
        err.message;

      console.error("Update failed:", err.response?.data || err.message);
      toast.error(
        err?.response?.status === 400 && errorMessage
          ? String(errorMessage)
          : "Update failed!",
      );
      return false;
    }
  }, [canManageCompliance, mergeReportRow, reports]);

  const handleUploadDocument = useCallback(async (id, file) => {
    if (!canManageCompliance) {
      toast.error("Only Manager Compliance can edit Events.");
      return false;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await axios.post(
        apiUrl("documents/Compliance/upload"),
        formData,
        { withCredentials: true },
      );

      const uploadedDocument =
        uploadResponse?.data?.document ||
        uploadResponse?.data?.Document ||
        uploadResponse?.data ||
        {};
      const uploadedDocumentId =
        uploadedDocument?.Id ??
        uploadedDocument?.id ??
        uploadedDocument?.DocumentId ??
        uploadedDocument?.documentId;

      if (!uploadedDocumentId) {
        throw new Error("Upload response does not contain document id");
      }

      const patchResponse = await axios.patch(
        apiUrl(`DocumentPeriodReport/${id}`),
        { Changes: { DocumentId: uploadedDocumentId } },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        },
      );

      const updatedRow = patchResponse?.data;
      if (updatedRow && typeof updatedRow === "object") {
        mergeReportRow(id, updatedRow);
      }

      toast.success("File uploaded and linked!");
      return true;
    } catch (err) {
      console.error("Upload document failed:", err.response?.data || err.message);
      toast.error("Failed to upload file");
      return false;
    }
  }, [canManageCompliance, mergeReportRow]);

  const handleAddRow = async (groupId) => {
    if (!canManageCompliance) {
      toast.error("Only Manager Compliance can edit Events.");
      return;
    }

    if (!groupId) {
      toast.error("Pilih Compliance Events terlebih dahulu.");
      return;
    }

    try {
      const response = await axios.post(
        apiUrl("DocumentPeriodReport"),
        {
          groupId,
          documentId: null,
          documentToSubmit: "",
        },
        { withCredentials: true },
      );

      const insertedRow = response?.data?.inserted ?? response?.data ?? null;
      const insertedRowId = Number(insertedRow?.Id ?? insertedRow?.id ?? 0) || null;
      const normalizedGroupId = Number(groupId);

      if (insertedRow && (isAllEventsSelected || Number(currentGroupId) === normalizedGroupId)) {
        setReports((prev) => [insertedRow, ...prev]);
      }

      adjustGroupRowCount(normalizedGroupId, 1);
      if (insertedRowId) {
        setHighlightRowId(insertedRowId);
        setPendingScrollRowId(insertedRowId);
        setPendingScrollToDetail(false);
      }
      toast.success("Row added!");
    } catch (err) {
      console.error("Add row failed:", err);
      toast.error("Failed to add row");
    }
  };

  const chartReports = useMemo(() => {
    if (!isAllEventsSelected) {
      return reports;
    }

    const getTimestamp = (value) => {
      const parsed = value ? new Date(value).getTime() : Number.NaN;
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return [...reports].sort((left, right) => {
      const leftGroupId = Number(left?.GroupId ?? left?.groupId ?? 0);
      const rightGroupId = Number(right?.GroupId ?? right?.groupId ?? 0);
      const leftGroupRank =
        Object.prototype.hasOwnProperty.call(groupOrderMap, leftGroupId)
          ? groupOrderMap[leftGroupId]
          : Number.MAX_SAFE_INTEGER;
      const rightGroupRank =
        Object.prototype.hasOwnProperty.call(groupOrderMap, rightGroupId)
          ? groupOrderMap[rightGroupId]
          : Number.MAX_SAFE_INTEGER;

      if (leftGroupRank !== rightGroupRank) {
        return leftGroupRank - rightGroupRank;
      }

      const createdAtDiff =
        getTimestamp(right?.CreatedAt ?? right?.createdAt) -
        getTimestamp(left?.CreatedAt ?? left?.createdAt);
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return Number(right?.Id ?? right?.id ?? 0) - Number(left?.Id ?? left?.id ?? 0);
    });
  }, [groupOrderMap, isAllEventsSelected, reports]);

  return (
    <Fragment>
      <Container fluid className="compliance-events-page">
        <div className="compliance-events-layout">
          <Row className="align-items-start g-3">
            <ComplianceEventScope
              groups={groups}
              selectedGroup={selectedGroup}
              activeGroup={activeGroup}
              onGroupChange={handleSelectGroup}
              loading={groupLoading}
              error={groupError}
              canCreate={canManageCompliance}
              canManage={canManageCompliance && Number(currentGroup?.id) > 0}
              canDelete={canManageCompliance && Number(currentGroup?.id) > 0}
              onOpenCreate={() => setCreateModalOpen(true)}
              onOpenRename={() => setRenameModalOpen(true)}
              onOpenDelete={() => setDeleteModalOpen(true)}
            />
            <EventProgressChart
              reports={chartReports}
              activeEventId={currentGroupId}
              activeEventLabel={
                isAllEventsSelected ? "All Events" : currentGroup?.periodName || ""
              }
              onSelectEvent={(groupId) => handleSelectGroup(groupId)}
              onSelectDocument={(groupId, rowId) => handleSelectDocument(groupId, rowId)}
              showSearch={false}
            />
            <TabClass
              activeGroup={currentGroup}
              reports={chartReports}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onUploadDocument={handleUploadDocument}
              onAddRow={handleAddRow}
              contentRef={detailRef}
              highlightRowId={highlightRowId}
              canManageCompliance={canManageCompliance}
              isAllEventsView={isAllEventsSelected}
            />
          </Row>
        </div>
      </Container>

      <ComplianceEventCreateModal
        isOpen={createModalOpen}
        toggle={() => setCreateModalOpen((prev) => !prev)}
        cloneFromGroupId={currentGroupId}
        onCreated={(createdGroup) => {
          const normalizedGroup = upsertGroupLocally(createdGroup);
          const nextId = Number(normalizedGroup?.id ?? createdGroup?.id ?? createdGroup?.Id ?? 0) || null;
          setSelectedGroupId(nextId);
        }}
      />
      <ComplianceEventRenameModal
        isOpen={renameModalOpen}
        toggle={() => setRenameModalOpen((prev) => !prev)}
        initialName={currentGroup?.periodName || ""}
        onSubmit={async (periodName) => {
          if (!currentGroup?.id) {
            return;
          }

          const updatedGroup = await renameGroup(currentGroup.id, periodName);
          upsertGroupLocally(updatedGroup);
        }}
      />
      <ComplianceEventDeleteModal
        isOpen={deleteModalOpen}
        toggle={() => setDeleteModalOpen((prev) => !prev)}
        eventName={currentGroup?.periodName || ""}
        onConfirm={async () => {
          if (!currentGroup?.id) {
            return;
          }

          const result = await deleteGroup(currentGroup.id);
          const nextId = Number(result?.activeGroupId ?? result?.ActiveGroupId ?? 0) || null;
          removeGroupLocally(currentGroup.id, nextId);
          setSelectedGroupId(nextId);
          setHighlightRowId(null);
        }}
      />
      <ComplianceEventRowDeleteModal
        isOpen={rowDeleteModalOpen}
        toggle={closeRowDeleteModal}
        row={pendingDeleteRow}
        onConfirm={handleConfirmDelete}
      />
    </Fragment>
  );
};

export default ReportLayout;
