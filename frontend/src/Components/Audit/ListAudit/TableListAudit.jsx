/*
 * PGH-DOC
 * File: src/Components/Audit/ListAudit/TableListAudit.jsx
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

import GenericGroupedTable from "../../../Variables/Table/TableComponent";
import { LIST_AUDIT_COLUMN_LABELS } from "../Utils/columnHelpers";
import {
  buildAuditListTitle,
  resolveAuditDrilldownState,
} from "../Utils/auditViewState";
import {
  LIST_AUDIT_SERVER_AREA,
  LIST_AUDIT_SERVER_MODE,
} from "./serverQuery";

const TableListAudit = ({ apiUrl: customApiUrl, endpoint = "listaudit" }) => {
  const { search } = useLocation();
  const baseUrl = process.env.REACT_APP_API_BASE_URL.replace(/\/$/, "");
  const apiUrl = customApiUrl || `${baseUrl}/${endpoint.replace(/^\//, "")}`;

  const drilldownState = useMemo(
    () =>
      resolveAuditDrilldownState({
        search,
        visibleColumns: null,
        allowDistinct: true,
      }),
    [search],
  );

  const [externalFilters, setExternalFilters] = useState(
    drilldownState.externalFilters,
  );

  useEffect(() => {
    setExternalFilters(drilldownState.externalFilters);
  }, [drilldownState.externalFilters]);

  const columns = useMemo(
    () => Object.keys(LIST_AUDIT_COLUMN_LABELS).filter((column) => column !== "NO"),
    [],
  );

  const title = buildAuditListTitle({
    chartColumn: drilldownState.chartColumn,
    distinctColumn: drilldownState.distinctColumn,
    normalizedLabel: drilldownState.normalizedLabel,
    normalizedType: drilldownState.normalizedType,
  });

  return (
    <GenericGroupedTable
      apiUrl={apiUrl}
      title={title}
      columns={columns}
      externalFilters={externalFilters}
      onFiltersChange={setExternalFilters}
      uploadColumns={["RHA", "LHA"]}
      actionKeys={["logtrail"]}
      fixedDateColumns={["IN", "JATUHTEMPO"]}
      fixedColumnsOnly
      tableArea={LIST_AUDIT_SERVER_AREA}
      serverQueryMode={LIST_AUDIT_SERVER_MODE}
      allowColumnMutations={false}
    />
  );
};

export default TableListAudit;
