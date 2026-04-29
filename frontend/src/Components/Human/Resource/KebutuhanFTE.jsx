/*
 * PGH-DOC
 * File: src/Components/Human/Resource/KebutuhanFTE.jsx
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

import TableComponent from "../../../Variables/Table/TableComponent";
import {
  HUMAN_RESOURCE_SERVER_AREA,
  HUMAN_RESOURCE_SERVER_MODE,
} from "./serverQuery";
import { HUMAN_TABLE_COLUMN_LABELS } from "../shared/humanLabelOverrides";
import {
  canonicalizeHumanDepartment,
  HUMAN_DEPARTMENT_SUGGESTIONS_BY_COLUMN,
} from "../shared/departmentCanonical";

const KEBUTUHAN_FTE_COLUMNS = [
  "DIREKTORAT",
  "KODEJOB",
  "JOB",
  "Department",
  "Existing",
  "Kebutuhan",
  "Gap",
];

const TablePassed = ({ apiUrl: customApiUrl, endpoint = "KebutuhanFTE" }) => {
  const { user } = useAuth();

  const { search } = useLocation();
  const query = new URLSearchParams(search);

  const chartcolumn = query.get("chartcolumn");
  const rawLabel = query.get("label");
  const baseUrl = process.env.REACT_APP_API_BASE_URL.replace(/\/$/, "");
  const apiUrl = customApiUrl || `${baseUrl}/${endpoint.replace(/^\//, "")}`;

  const normalizedLabel =
    rawLabel === null ||
    rawLabel === "undefined" ||
    rawLabel === "null" ||
    rawLabel === "empty"
      ? ""
      : rawLabel;

  const normalizedLabelRaw =
    rawLabel === null ||
    rawLabel === "undefined" ||
    rawLabel === "null" ||
    rawLabel === "empty"
      ? ""
      : rawLabel;

  const resolvedLabel = useMemo(() => {
    if (!normalizedLabelRaw) return "";
    if (String(chartcolumn || "").toLowerCase() === "department") {
      return canonicalizeHumanDepartment(normalizedLabelRaw);
    }
    return normalizedLabelRaw;
  }, [chartcolumn, normalizedLabelRaw]);

  const initialFilters = useMemo(() => {
    if (normalizedLabel === "distinct" && chartcolumn) {
      return {
        filters: [],
        mode: "and",
        sort: null,
        visibleColumns: null,
        distinct: {
          column: chartcolumn,
        },
      };
    }

    if (chartcolumn) {
      return {
        filters: [
          {
            column: chartcolumn,
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
  }, [chartcolumn, normalizedLabel, resolvedLabel]);

  const [externalFilters, setExternalFilters] = useState(initialFilters);

  useEffect(() => {
    setExternalFilters(initialFilters);
  }, [initialFilters]);

  const rowsBaseUrl = `${baseUrl}/${endpoint.replace(/^\//, "")}`;

  const title = !chartcolumn
    ? "FTE Requirement"
    : normalizedLabel === "distinct"
      ? `Distinct FTE Requirement (by ${chartcolumn?.toUpperCase()})`
      : `${chartcolumn} = ${resolvedLabel === "" ? "(empty)" : resolvedLabel}`;

  const handleEdit = async (id, field, value, oldValue, row) => {
    const oldClean = (oldValue ?? "").toString();
    let newValue = value;

    if (!Number.isNaN(Number(value)) && value !== "") {
      newValue = Number(value);
    }

    if (oldClean === newValue?.toString()) {
      console.log("No change detected, skipping");
      return;
    }

    const patchPayload = { [field]: newValue };

    if (field === "Existing" || field === "Kebutuhan") {
      const existing =
        field === "Existing" ? newValue : parseFloat(row?.Existing) || 0;
      const kebutuhan =
        field === "Kebutuhan" ? newValue : parseFloat(row?.Kebutuhan) || 0;
      patchPayload.Gap = kebutuhan > existing ? kebutuhan - existing : 0;
    }

    try {
      const response = await fetch(`${rowsBaseUrl}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patchPayload),
      });

      if (!response.ok) throw new Error(await response.text());
      const responsePayload = await response.json();
      console.log("Field updated", patchPayload);

      const logPayload = {
        tableName: endpoint,
        entityId: id,
        changeType: "UPDATE",
        changedBy: user?.name || "Unknown",
        changeTableComponent: `Field '${field}' changed from '${oldClean}' to '${newValue}'`,
        ipAddress: window.location.hostname,
      };

      void fetch(`${process.env.REACT_APP_API_BASE_URL}ChangeLog`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logPayload),
      }).catch((logError) => {
        console.warn("ChangeLog write failed:", logError);
      });

      return {
        row:
          responsePayload?.kebutuhanfte ||
          responsePayload?.row || {
            Id: id,
            ...row,
            ...patchPayload,
          },
      };
    } catch (err) {
      console.error("PATCH failed:", err);
      throw err;
    }
  };

  return (
    <TableComponent
      apiUrl={apiUrl}
      title={title}
      columns={KEBUTUHAN_FTE_COLUMNS}
      columnLabelOverrides={HUMAN_TABLE_COLUMN_LABELS}
      fixedColumnsOnly
      externalFilters={externalFilters}
      onFiltersChange={setExternalFilters}
      actionKeys={["logtrail"]}
      onEdit={handleEdit}
      tableArea={HUMAN_RESOURCE_SERVER_AREA}
      serverQueryMode={HUMAN_RESOURCE_SERVER_MODE}
      useGridRenderer
      enableColumnDrag={false}
      allowColumnMutations={false}
      persistColumnOrder={false}
      nonEditableColumns={["Gap"]}
      highlightCondition={(row) =>
        Number(row.Gap ?? 0) > 5 ? "critical" : Number(row.Gap ?? 0) > 0
      }
      suggestionValuesByColumn={HUMAN_DEPARTMENT_SUGGESTIONS_BY_COLUMN}
    />
  );
};

export default TablePassed;
