/*
 * PGH-DOC
 * File: src/Components/Compliance/SummaryCompliance/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../Auth/AuthContext";
import { canEditComplianceContent } from "../../../Auth/accessControl";
import Summary from "../../../Variables/Table/TableComponent";
import ChangeLogModal from "../../../Variables/ActionCell/ChangeLogModal";
import WeeklyPeriodScope from "../Weekly/WeeklyPeriodScope";
import WeeklyTableCreateModal from "../Weekly/WeeklyTableCreateModal";
import WeeklyTableRenameModal from "../Weekly/WeeklyTableRenameModal";
import WeeklyTableDeleteModal from "../Weekly/WeeklyTableDeleteModal";
import { buildWeeklyScopeApiUrl } from "../Weekly/useWeeklyPeriods";
import { COMPLIANCE_WEEKLY_SERVER_MODE } from "../Weekly/serverQuery";
import { useWeeklyTables } from "../Weekly/useWeeklyTables";
import {
  WEEKLY_TABLE_COLUMNS,
  WEEKLY_TABLE_COLUMN_LABELS,
} from "../Weekly/weeklyTableColumns";

const ComplianceSummary = ({ apiUrl: customApiUrl, endpoint = "weeklytable" }) => {
  const { search } = useLocation();
  const { user } = useAuth();
  const query = new URLSearchParams(search);
  const initialTableId = query.get("tableId");
  const [weeklyTableModalOpen, setWeeklyTableModalOpen] = useState(false);
  const [weeklyTableRenameOpen, setWeeklyTableRenameOpen] = useState(false);
  const [weeklyTableDeleteOpen, setWeeklyTableDeleteOpen] = useState(false);

  const chartcolumn = query.get("chartcolumn");
  const rawLabel = query.get("label");
  const type = query.get("type")?.toLowerCase() || "all";

  const baseUrl = process.env.REACT_APP_API_BASE_URL.replace(/\/$/, "");
  const {
    tables: weeklyTables,
    activeTable,
    loading: weeklyTableLoading,
    error: weeklyTableError,
    selectedToken: selectedTableToken,
    setSelectedToken: setSelectedTableToken,
    selectedTableId,
    selectedTable,
    refreshTables,
    renameTable,
    deleteTable,
    activeTableToken,
  } = useWeeklyTables({
    endpoint,
    initialTableId,
  });
  const currentWeeklyTable = selectedTable ?? activeTable;

  const apiUrl =
    customApiUrl ||
    buildWeeklyScopeApiUrl(baseUrl, endpoint, {
      tableId: selectedTableId,
    });

  const normalizedLabel =
    rawLabel === null ||
    rawLabel === "undefined" ||
    rawLabel === "null" ||
    rawLabel === "empty"
      ? ""
      : rawLabel;

  const initialFilters = useMemo(() => {
    if (normalizedLabel === "distinct" && chartcolumn) {
      return {
        filters: [],
        mode: "and",
        sort: null,
        visibleColumns: null,
        distinct: {
          column: chartcolumn.toUpperCase(),
        },
      };
    }

    if (chartcolumn) {
      return {
        filters: [
          {
            column: chartcolumn.toUpperCase(),
            operator: "=",
            value: normalizedLabel,
          },
        ],
        mode: "and",
        sort: null,
        visibleColumns: null,
        distinct: null,
      };
    }

    return null;
  }, [chartcolumn, normalizedLabel]);

  const [externalFilters, setExternalFilters] = useState(initialFilters);

  useEffect(() => {
    setExternalFilters(initialFilters);
  }, [initialFilters]);

  const title =
    !chartcolumn || normalizedLabel === ""
      ? "Data"
      : normalizedLabel === "distinct"
        ? `Distinct Compliance Summary (by ${chartcolumn?.toUpperCase()})`
        : `${chartcolumn || "(column)"} = ${
            normalizedLabel === "" ? "(empty)" : normalizedLabel
          }${type !== "all" ? ` (${type})` : ""}`;

  return (
    <>
      <div className="mb-3">
        <WeeklyPeriodScope
          activeTableToken={activeTableToken}
          selectedTableToken={selectedTableToken}
          onTableChange={setSelectedTableToken}
          tables={weeklyTables}
          selectedTable={selectedTable}
          activeTable={activeTable}
          tableLoading={weeklyTableLoading}
          tableError={weeklyTableError}
          canCreateTable={canEditComplianceContent(user)}
          canManageTable={canEditComplianceContent(user) && Boolean(currentWeeklyTable?.id)}
          canDeleteTable={canEditComplianceContent(user) && weeklyTables.length > 1}
          onOpenCreateTable={() => setWeeklyTableModalOpen(true)}
          onOpenRenameTable={() => setWeeklyTableRenameOpen(true)}
          onOpenDeleteTable={() => setWeeklyTableDeleteOpen(true)}
          historyAction={
            <ChangeLogModal
              tableName="WeeklyTableInstance"
              titleLabel="Riwayat Perubahan Weekly Table"
              triggerMode="header"
              triggerLabel="Riwayat Perubahan"
              allowNavigateToChange={false}
            />
          }
        />
      </div>

      <Summary
        apiUrl={apiUrl}
        title={title}
        columns={WEEKLY_TABLE_COLUMNS}
        externalFilters={externalFilters}
        onFiltersChange={setExternalFilters}
        forceReloadAfterMutation
        onMutationSuccess={() => {
          refreshTables({ silent: true });
        }}
        patchUrlBase={apiUrl}
        enableColumnDrag={false}
        allowColumnMutations={false}
        persistColumnOrder={false}
        useGridRenderer
        fixedColumnsOnly
        serverQueryMode={COMPLIANCE_WEEKLY_SERVER_MODE}
        columnLabelOverrides={WEEKLY_TABLE_COLUMN_LABELS}
        suggestionValuesByColumn={currentWeeklyTable?.suggestionValuesByColumn || {}}
        showLogTrail={Boolean(selectedTableId)}
        changeLogTableName="WeeklyTable"
        changeLogTitleLabel={
          currentWeeklyTable?.tableName
            ? `Riwayat Perubahan Isi Weekly Table: ${currentWeeklyTable.tableName}`
            : "Riwayat Perubahan Isi Weekly Table"
        }
        changeLogScopeTableName="WeeklyTableInstance"
        changeLogScopeEntityId={selectedTableId}
      />

      <WeeklyTableCreateModal
        isOpen={weeklyTableModalOpen}
        toggle={() => setWeeklyTableModalOpen((prev) => !prev)}
        endpoint={endpoint}
        cloneFromTableId={selectedTable?.id ?? activeTable?.id ?? null}
        onCreated={async (createdTable) => {
          const nextId = createdTable?.id ?? createdTable?.Id;
          if (nextId) {
            setSelectedTableToken(String(nextId));
          }
          await refreshTables();
        }}
      />
      <WeeklyTableRenameModal
        isOpen={weeklyTableRenameOpen}
        toggle={() => setWeeklyTableRenameOpen((prev) => !prev)}
        initialName={currentWeeklyTable?.tableName || ""}
        onSubmit={async (tableName) => {
          if (!currentWeeklyTable?.id) {
            return;
          }

          await renameTable(currentWeeklyTable.id, tableName);
          await refreshTables();
        }}
      />
      <WeeklyTableDeleteModal
        isOpen={weeklyTableDeleteOpen}
        toggle={() => setWeeklyTableDeleteOpen((prev) => !prev)}
        tableName={currentWeeklyTable?.tableName || ""}
        onConfirm={async () => {
          if (!currentWeeklyTable?.id) {
            return;
          }

          const result = await deleteTable(currentWeeklyTable.id);
          await refreshTables();
          const nextId = result?.activeTableId ?? result?.ActiveTableId;
          setSelectedTableToken(nextId ? String(nextId) : activeTableToken);
        }}
      />
    </>
  );
};

export default ComplianceSummary;
