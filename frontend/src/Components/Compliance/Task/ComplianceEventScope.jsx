/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/ComplianceEventScope.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import { Card, CardBody } from "@pgh/ui-bootstrap";
import FeedbackState from "../../Common/FeedbackState";
import ChangeLogModal from "../../../Variables/ActionCell/ChangeLogModal";
import WeeklyPeriodScope from "../Weekly/WeeklyPeriodScope";
import { ALL_COMPLIANCE_EVENTS_ID } from "./useComplianceEventGroups";

const ComplianceEventScope = ({
  groups = [],
  selectedGroup = null,
  activeGroup = null,
  onGroupChange,
  loading = false,
  error = "",
  canCreate = false,
  canManage = false,
  canDelete = false,
  onOpenCreate = null,
  onOpenRename = null,
  onOpenDelete = null,
}) => {
  const orderedGroups = React.useMemo(() => {
    const sortedGroups = [...groups].sort((left, right) => {
      const leftTimestamp = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTimestamp = right?.createdAt ? new Date(right.createdAt).getTime() : 0;

      if (rightTimestamp !== leftTimestamp) {
        return rightTimestamp - leftTimestamp;
      }

      return Number(right?.id ?? 0) - Number(left?.id ?? 0);
    });

    return [
      {
        id: ALL_COMPLIANCE_EVENTS_ID,
        periodName: "All Events",
        period: "All",
        rowCount: sortedGroups.reduce(
          (total, group) => total + Number(group?.rowCount ?? 0),
          0,
        ),
        isSyntheticAll: true,
      },
      ...sortedGroups,
    ];
  }, [groups]);

  if (loading && !activeGroup && groups.length === 0) {
    return (
      <Card className="weekly-period-scope-card">
        <CardBody className="weekly-period-scope-card__body">
          <FeedbackState
            variant="loading"
            title="Loading compliance events"
            description="Compliance Events sedang dimuat."
            compact
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <WeeklyPeriodScope
      items={orderedGroups}
      selectedItem={selectedGroup}
      activeItem={activeGroup}
      onItemChange={onGroupChange}
      getItemId={(group) => group?.id}
      getItemLabel={(group) => group?.periodName}
      getItemMeta={(group) =>
        [group?.period || null, `${group?.rowCount ?? 0} baris`]
          .filter(Boolean)
          .join(" • ")
      }
      tableLoading={loading}
      tableError={error}
      canCreateTable={canCreate}
      canManageTable={canManage}
      canDeleteTable={canDelete}
      onOpenCreateTable={onOpenCreate}
      onOpenRenameTable={onOpenRename}
      onOpenDeleteTable={onOpenDelete}
      scopeLabel="Compliance Events"
      searchPlaceholder="Cari atau pilih nama Compliance Events"
      fallbackTableName="Compliance Events"
      createButtonLabel="Add New"
      renameButtonLabel="Edit Nama"
      deleteButtonLabel="Delete"
      emptySearchResultLabel="Tidak ada event yang cocok"
      fieldId="compliance-event-combobox"
      historyAction={
        <ChangeLogModal
          tableName="DocumentPeriodReportGroup"
          titleLabel="Riwayat Perubahan Events"
          triggerMode="header"
          triggerLabel="Riwayat Perubahan"
          showLastUpdated={false}
          allowNavigateToChange={false}
        />
      }
    />
  );
};

export default ComplianceEventScope;
