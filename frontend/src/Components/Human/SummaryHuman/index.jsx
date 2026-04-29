/*
 * PGH-DOC
 * File: src/Components/Human/SummaryHuman/index.jsx
 * Apa fungsi bagian ini:
 * - Menampilkan Human Summary dengan default distinct aktif per tab.
 * Kenapa perlu:
 * - Agar tampilan ringkasan tetap sederhana, dan user bisa drill-down langsung ke tabel asal saat klik baris.
 * Aturan khususnya apa:
 * - Tidak memakai kolom detail/action.
 * - Read-only, tanpa import.
 */

import React, { useMemo, useState } from "react";
import { Activity, Users } from "react-feather";
import { Container, Row } from "@pgh/ui-bootstrap";

import DashboardHeader from "../../../Variables/Dashboard/DashboardHeader";
import useHeaderTabRefreshToken from "../../../Variables/Dashboard/useHeaderTabRefreshToken";
import TableComponent from "../../../Variables/Table/TableComponent";
import { HUMAN_TABLE_COLUMN_LABELS } from "../shared/humanLabelOverrides";
import { HUMAN_RESOURCE_SERVER_MODE } from "../Resource/serverQuery";
import "../Resource/humanResourceList.scss";
import "../../Audit/Utils/auditArea.scss";
import "../../Audit/DashboardAudit/auditDashboard.scss";

const HUMAN_SUMMARY_TABLES = [
  {
    key: "fte",
    tabLabel: "FTE",
    icon: Users,
    title: "Summary FTE",
    source: "HumanSummaryFte",
    endpoint: "FTE",
    columns: ["JenjangJabatan"],
    initialFilters: {
      filters: [],
      mode: "and",
      sort: null,
      visibleColumns: ["JenjangJabatan"],
      distinct: { column: "JenjangJabatan" },
    },
  },
  {
    key: "manmonth",
    tabLabel: "Non-FTE Manmonth/Managed Service",
    icon: Activity,
    title: "Summary Non-FTE Manmonth/Managed Service",
    source: "HumanSummaryManmonth",
    endpoint: "NonFTE",
    columns: ["ManmonthManagedService", "Vendor"],
    initialFilters: {
      filters: [],
      mode: "and",
      sort: null,
      visibleColumns: ["ManmonthManagedService", "Vendor"],
      distinct: { column: "ManmonthManagedService" },
    },
  },
  {
    key: "vendor",
    tabLabel: "Non-FTE Vendor",
    icon: Activity,
    title: "Summary Non-FTE Vendor",
    source: "HumanSummaryVendor",
    endpoint: "NonFTE",
    columns: ["Vendor"],
    initialFilters: {
      filters: [],
      mode: "and",
      sort: null,
      visibleColumns: ["Vendor"],
      distinct: { column: "Vendor" },
    },
  },
];

const DEFAULT_TAB = HUMAN_SUMMARY_TABLES[0].key;

const cloneFilters = (value) => ({
  filters: Array.isArray(value?.filters)
    ? value.filters.map((item) => ({ ...item }))
    : [],
  mode: String(value?.mode ?? "").toLowerCase() === "or" ? "or" : "and",
  sort: value?.sort ? { ...value.sort } : null,
  visibleColumns: Array.isArray(value?.visibleColumns)
    ? [...value.visibleColumns]
    : null,
  distinct: value?.distinct ? { ...value.distinct } : null,
});

const SummaryHuman = () => {
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const headerRefreshToken = useHeaderTabRefreshToken(activeTab);
  const [filtersMap, setFiltersMap] = useState(() =>
    HUMAN_SUMMARY_TABLES.reduce((accumulator, table) => {
      accumulator[table.key] = cloneFilters(table.initialFilters);
      return accumulator;
    }, {}),
  );

  const tabs = useMemo(
    () =>
      HUMAN_SUMMARY_TABLES.map(({ key, tabLabel, icon }) => ({
        key,
        label: tabLabel,
        icon,
      })),
    [],
  );

  const activeTableConfig =
    HUMAN_SUMMARY_TABLES.find((table) => table.key === activeTab) ??
    HUMAN_SUMMARY_TABLES[0];

  const handleFilterChange = (nextFilters) => {
    setFiltersMap((previous) => ({
      ...previous,
      [activeTab]: cloneFilters(nextFilters),
    }));
  };

  return (
    <Container fluid className="human-resource-page audit-module-page audit-dashboard-page">
      <Row className="human-resource-shell audit-dashboard-shell g-3">
        <DashboardHeader
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="human-resource-content">
          <div key={activeTableConfig.key} className="mb-4">
            <TableComponent
              key={`human-summary-${activeTableConfig.key}-${headerRefreshToken}`}
              source={activeTableConfig.source}
              title={activeTableConfig.title}
              columns={activeTableConfig.columns}
              allColumns={activeTableConfig.columns}
              columnLabelOverrides={HUMAN_TABLE_COLUMN_LABELS}
              apiUrl={`${process.env.REACT_APP_API_BASE_URL}${activeTableConfig.endpoint}`}
              fixedColumnsOnly
              nonEditableColumns={activeTableConfig.columns}
              externalFilters={filtersMap[activeTab]}
              onFiltersChange={handleFilterChange}
              tableArea="audit"
              serverQueryMode={HUMAN_RESOURCE_SERVER_MODE}
              useGridRenderer
              enableClientPagination
              allowColumnMutations={false}
              enableColumnDrag={false}
              persistColumnOrder={false}
              forceReadOnly
              hideImport
              showLogTrail={false}
              showRowCount
            />
          </div>
        </div>
      </Row>
    </Container>
  );
};

export default SummaryHuman;
