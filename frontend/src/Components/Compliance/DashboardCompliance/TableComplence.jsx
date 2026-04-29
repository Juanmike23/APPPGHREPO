/*
 * PGH-DOC
 * File: src/Components/Compliance/DashboardCompliance/TableComplence.jsx
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

import Summary from "../../../Variables/Table/TableComponent";
import { buildWeeklyScopeApiUrl } from "../Weekly/useWeeklyPeriods";
import { COMPLIANCE_WEEKLY_SERVER_MODE } from "../Weekly/serverQuery";
import {
  WEEKLY_TABLE_COLUMNS,
  WEEKLY_TABLE_COLUMN_LABELS,
} from "../Weekly/weeklyTableColumns";

const ComplianceSummary = ({
  apiUrl: customApiUrl,
  endpoint = "weeklytable",
  selectedTableId = null,
  selectedTableName = "",
  suggestionValuesByColumn = {},
  forceReadOnly = false,
  onPeriodMutation = null,
  drilldownRequest = null,
}) => {
  const { search } = useLocation();
  const query = new URLSearchParams(search);

  const chartcolumn = query.get("chartcolumn");
  const rawLabel = query.get("label");
  const type = query.get("type")?.toLowerCase() || "all";

  const baseUrl = process.env.REACT_APP_API_BASE_URL.replace(/\/$/, "");
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

  useEffect(() => {
    if (!drilldownRequest?.chartcolumn) {
      return;
    }

    const normalizedColumn = String(drilldownRequest.chartcolumn ?? "")
      .trim()
      .toUpperCase();
    if (!normalizedColumn) {
      return;
    }

    setExternalFilters({
      filters: [
        {
          column: normalizedColumn,
          operator: "=",
          value: drilldownRequest.label ?? "",
        },
      ],
      mode: "and",
      sort: null,
      visibleColumns: null,
      distinct: null,
    });
  }, [drilldownRequest]);

  const title = !chartcolumn || normalizedLabel === ""
    ? "Data"
    : normalizedLabel === "distinct"
      ? `Distinct Compliance Summary (by ${chartcolumn?.toUpperCase()})`
      : `${chartcolumn || "(column)"} = ${
          normalizedLabel === "" ? "(empty)" : normalizedLabel
        }${type !== "all" ? ` (${type})` : ""}`;

  return (
    <Summary
      apiUrl={apiUrl}
      title={title}
      columns={WEEKLY_TABLE_COLUMNS}
      externalFilters={externalFilters}
      onFiltersChange={setExternalFilters}
      forceReloadAfterMutation
      forceReadOnly={forceReadOnly}
      hideImport={forceReadOnly}
      onMutationSuccess={onPeriodMutation}
      patchUrlBase={apiUrl}
      enableColumnDrag={false}
      allowColumnMutations={false}
      persistColumnOrder={false}
      useGridRenderer
      fixedColumnsOnly
      serverQueryMode={COMPLIANCE_WEEKLY_SERVER_MODE}
      columnLabelOverrides={WEEKLY_TABLE_COLUMN_LABELS}
      suggestionValuesByColumn={suggestionValuesByColumn}
      showLogTrail={Boolean(selectedTableId)}
      changeLogTableName="WeeklyTable"
      changeLogTitleLabel={
        selectedTableName
          ? `Riwayat Perubahan Isi Weekly Table: ${selectedTableName}`
          : "Riwayat Perubahan Isi Weekly Table"
      }
      changeLogScopeTableName="WeeklyTableInstance"
      changeLogScopeEntityId={selectedTableId}
    />
  );
};

export default ComplianceSummary;
