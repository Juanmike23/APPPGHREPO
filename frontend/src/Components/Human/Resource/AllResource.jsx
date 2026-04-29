/*
 * PGH-DOC
 * File: src/Components/Human/Resource/AllResource.jsx
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

import TableComponent from "../../../Variables/Table/TableComponent";
import {
  canonicalizeHumanDepartment,
  HUMAN_DEPARTMENT_SUGGESTIONS_BY_COLUMN,
} from "../shared/departmentCanonical";

const ALL_RESOURCE_COLUMNS = [
  "NPP",
  "Nama",
  "Department",
  "ResourceType",
];

const TableAllResource = ({
  apiUrl: customApiUrl,
  endpoint = "allresource",
  title = "All Resource",
}) => {
  const { search } = useLocation();
  const query = new URLSearchParams(search);

  const chartColumn = query.get("chartcolumn");
  const rawLabel = query.get("label");

  const normalizedLabelRaw =
    rawLabel === null ||
    rawLabel === "undefined" ||
    rawLabel === "null" ||
    rawLabel === "empty"
      ? ""
      : rawLabel;

  const resolvedLabel = useMemo(() => {
    if (!normalizedLabelRaw) return "";
    if (String(chartColumn || "").toLowerCase() === "department") {
      return canonicalizeHumanDepartment(normalizedLabelRaw);
    }
    return normalizedLabelRaw;
  }, [chartColumn, normalizedLabelRaw]);

  const initialFilters = useMemo(() => {
    if (normalizedLabelRaw === "distinct" && chartColumn) {
      return {
        filters: [],
        mode: "and",
        sort: null,
        visibleColumns: null,
        distinct: { column: chartColumn },
      };
    }

    if (chartColumn) {
      return {
        filters: [
          {
            column: chartColumn,
            operator: "contains",
            value: resolvedLabel,
          },
        ],
        mode: "and",
        sort: null,
        visibleColumns: null,
        distinct: null,
      };
    }

    return null;
  }, [chartColumn, normalizedLabelRaw, resolvedLabel]);

  const [externalFilters, setExternalFilters] = useState(initialFilters);

  useEffect(() => {
    setExternalFilters(initialFilters);
  }, [initialFilters]);

  const baseUrl = process.env.REACT_APP_API_BASE_URL.replace(/\/$/, "");
  const apiUrl = customApiUrl || `${baseUrl}/${endpoint.replace(/^\//, "")}`;

  const effectiveTitle = useMemo(() => {
    if (!chartColumn) return title;
    if (normalizedLabelRaw === "distinct") {
      return `Distinct ${title} (by ${String(chartColumn).toUpperCase()})`;
    }
    return `${chartColumn} = ${resolvedLabel || "(empty)"}`;
  }, [chartColumn, normalizedLabelRaw, resolvedLabel, title]);

  return (
    <TableComponent
      apiUrl={apiUrl}
      title={effectiveTitle}
      columns={ALL_RESOURCE_COLUMNS}
      fixedColumnsOnly
      externalFilters={externalFilters}
      onFiltersChange={setExternalFilters}
      tableArea="audit"
      allowColumnMutations={false}
      enableClientPagination
      suggestionValuesByColumn={HUMAN_DEPARTMENT_SUGGESTIONS_BY_COLUMN}
    />
  );
};

export default TableAllResource;
