/*
 * PGH-DOC
 * File: src/Components/Compliance/DashboardCompliance/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useRef, useState } from "react";
import { Container, Row, Col } from "@pgh/ui-bootstrap";
import { BarChart2, Package } from "react-feather";
import DashboardHeader from "../../../Variables/Dashboard/DashboardHeader"; // <-- adjust
import ChangeLogModal from "../../../Variables/ActionCell/ChangeLogModal";
import TableWeekly from "./TableComplence";
import TaskLayout from "../Task/index";
import ChartStatusWeekly from "./ChartStatusWeekly";
import EventProgressChart from "../Task/EventProgressChart";
import { useAuth } from "../../../Auth/AuthContext";
import {
  canEditComplianceContent,
  isSummaryOnlyMode,
} from "../../../Auth/accessControl";
import CrossStreamDashboardNotice from "../../../Variables/Dashboard/CrossStreamDashboardNotice";
import "./complianceDashboard.scss";
import WeeklyPeriodScope from "../Weekly/WeeklyPeriodScope";
import { useWeeklyTables } from "../Weekly/useWeeklyTables";
import WeeklyTableCreateModal from "../Weekly/WeeklyTableCreateModal";
import WeeklyTableRenameModal from "../Weekly/WeeklyTableRenameModal";
import WeeklyTableDeleteModal from "../Weekly/WeeklyTableDeleteModal";
import useHeaderTabRefreshToken from "../../../Variables/Dashboard/useHeaderTabRefreshToken";

const WEEKLY_DETAIL_LOCKED_MESSAGE =
  "Detail Weekly Table hanya tersedia untuk pengguna yang memiliki akses CRUD Compliance.";

const FileManagerContain = () => {
  const { user } = useAuth();
  const summaryOnly = isSummaryOnlyMode(user, "compliance");
  const [mainTab, setMainTab] = useState("WEEKLY");
  const headerRefreshToken = useHeaderTabRefreshToken(mainTab);
  const [weeklyRefreshVersion, setWeeklyRefreshVersion] = useState(0);
  const [weeklyDrilldownRequest, setWeeklyDrilldownRequest] = useState(null);
  const [weeklyTableModalOpen, setWeeklyTableModalOpen] = useState(false);
  const [weeklyTableRenameOpen, setWeeklyTableRenameOpen] = useState(false);
  const [weeklyTableDeleteOpen, setWeeklyTableDeleteOpen] = useState(false);
  const weeklyTableSectionRef = useRef(null);
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
    endpoint: "weeklytable",
  });
  const currentWeeklyTable = selectedTable ?? activeTable;
  const canManageCompliance = canEditComplianceContent(user);
  const canViewWeeklyDetails = !summaryOnly;
  const canCreateWeeklyTable =
    !summaryOnly &&
    canManageCompliance;
  const canManageWeeklyTable =
    !summaryOnly &&
    canManageCompliance &&
    Boolean(currentWeeklyTable?.id);
  const canDeleteWeeklyTable =
    canManageWeeklyTable &&
    weeklyTables.length > 1;
  const handleWeeklyMutation = () => {
    refreshTables({ silent: true });
    setWeeklyRefreshVersion((value) => value + 1);
  };
  const handleWeeklyChartDrilldown = ({ chartcolumn, label }) => {
    setMainTab("WEEKLY");
    setWeeklyDrilldownRequest({
      key: Date.now(),
      chartcolumn: String(chartcolumn ?? "").trim().toUpperCase(),
      label: String(label ?? "").trim(),
    });
    return true;
  };

  useEffect(() => {
    if (mainTab !== "WEEKLY" || !weeklyDrilldownRequest || !weeklyTableSectionRef.current) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      weeklyTableSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [mainTab, weeklyDrilldownRequest]);

  const tabs = [
    {
      key: "WEEKLY",
      label: "Weekly Table",
      abbrev: "Wkly",
      icon: BarChart2,
    },
    {
      key: "DOCUMENT",
      label: "Events",
      abbrev: "Evt",
      icon: Package,
    },
  ];

  return (
    <Fragment>
      <div className="compliance-dashboard-page">
      <Container fluid className="compliance-dashboard-shell">
        <Row className="compliance-dashboard-row g-3 align-items-stretch">
          {summaryOnly && (
            <Col sm="12" className="compliance-dashboard-col">
              <CrossStreamDashboardNotice
                moduleLabel="Compliance"
                userStream={user?.stream}
              />
            </Col>
          )}

          <DashboardHeader
            tabs={tabs}
            activeTab={mainTab}
            onTabChange={setMainTab}
          />

          {mainTab === "WEEKLY" && (
            <>
            <Col xl="12" className="compliance-dashboard-col">
              <WeeklyPeriodScope
                activeTableToken={activeTableToken}
                selectedTableToken={selectedTableToken}
                onTableChange={setSelectedTableToken}
                tables={weeklyTables}
                selectedTable={selectedTable}
                activeTable={activeTable}
                tableLoading={weeklyTableLoading}
                tableError={weeklyTableError}
                canCreateTable={canCreateWeeklyTable}
                canManageTable={canManageWeeklyTable}
                canDeleteTable={canDeleteWeeklyTable}
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
            </Col>
            <Col xl="12" className="compliance-dashboard-col">
              <ChartStatusWeekly
                key={`compliance-weekly-chart-${headerRefreshToken}`}
                blockedMessage={summaryOnly ? WEEKLY_DETAIL_LOCKED_MESSAGE : ""}
                selectedTableId={selectedTableId}
                refreshKey={weeklyRefreshVersion + headerRefreshToken}
                onDrilldown={handleWeeklyChartDrilldown}
              />
              </Col>
              {canViewWeeklyDetails && (
                <Col xl="12" className="compliance-dashboard-col" ref={weeklyTableSectionRef}>
                  <TableWeekly
                    key={`compliance-weekly-table-${selectedTableId || "none"}-${headerRefreshToken}`}
                    selectedTableId={selectedTableId}
                    selectedTableName={currentWeeklyTable?.tableName || ""}
                    suggestionValuesByColumn={currentWeeklyTable?.suggestionValuesByColumn || {}}
                    forceReadOnly={!canManageCompliance}
                    onPeriodMutation={handleWeeklyMutation}
                    drilldownRequest={weeklyDrilldownRequest}
                  />
                </Col>
              )}
            </>
          )}
          {summaryOnly && mainTab === "DOCUMENT" && (
            <Col xl="12" className="compliance-dashboard-col">
              <EventProgressChart key={`compliance-events-summary-${headerRefreshToken}`} summaryOnly reports={[]} />
            </Col>
          )}
          {!summaryOnly && mainTab === "DOCUMENT" && (
            <Col xl="12" className="compliance-dashboard-col">
              <TaskLayout key={`compliance-events-${headerRefreshToken}`} />
            </Col>
          )}
        </Row>
      </Container>
      <WeeklyTableCreateModal
        isOpen={weeklyTableModalOpen}
        toggle={() => setWeeklyTableModalOpen((prev) => !prev)}
        endpoint="weeklytable"
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
      </div>
    </Fragment>
  );
};

export default FileManagerContain;
