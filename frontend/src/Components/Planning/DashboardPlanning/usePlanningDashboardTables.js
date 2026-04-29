/*
 * PGH-DOC
 * File: src/Components/Planning/DashboardPlanning/usePlanningDashboardTables.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

const ACTIVE_TABLE_TOKEN = "__active_planning_table__";

const normalizeTable = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = Number(value.id ?? value.Id ?? 0);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return {
    id,
    tableName: String(value.tableName ?? value.TableName ?? ""),
    year: Number(value.year ?? value.Year ?? new Date().getFullYear()),
    isDefault: Boolean(value.isDefault ?? value.IsDefault),
    createdAt: value.createdAt ?? value.CreatedAt ?? null,
    updatedAt: value.updatedAt ?? value.UpdatedAt ?? null,
  };
};

const getTableCreatedAtTimestamp = (table) => {
  const rawValue = table?.createdAt ?? null;
  const timestamp = rawValue ? new Date(rawValue).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const usePlanningDashboardTables = ({
  endpoint = "planningdashboardtable",
  initialTableId = null,
  scope = "OPEX",
} = {}) => {
  const baseUrl = String(process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
  const normalizedScope = String(scope || "OPEX").trim().toUpperCase() || "OPEX";
  const queryScope = encodeURIComponent(normalizedScope);
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedToken, setSelectedToken] = useState(
    initialTableId ? String(initialTableId) : ACTIVE_TABLE_TOKEN,
  );

  const tablesUrl = useMemo(
    () => `${baseUrl}/${endpoint}/tables?scope=${queryScope}`,
    [baseUrl, endpoint, queryScope],
  );
  const activeTableUrl = useMemo(
    () => `${baseUrl}/${endpoint}/active-table?scope=${queryScope}`,
    [baseUrl, endpoint, queryScope],
  );

  const refreshTables = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [tablesResponse, activeTableResponse] = await Promise.all([
        fetch(tablesUrl, { credentials: "include" }),
        fetch(activeTableUrl, { credentials: "include" }),
      ]);

      if (!tablesResponse.ok) {
        throw new Error(await tablesResponse.text());
      }

      const tablesJson = await tablesResponse.json();
      const normalizedTables = Array.isArray(tablesJson)
        ? tablesJson
            .map(normalizeTable)
            .filter(Boolean)
            .sort((left, right) => {
              const yearDiff =
                Number(right?.year ?? 0) - Number(left?.year ?? 0);
              if (yearDiff !== 0) {
                return yearDiff;
              }

              const timeDiff =
                getTableCreatedAtTimestamp(right) - getTableCreatedAtTimestamp(left);

              if (timeDiff !== 0) {
                return timeDiff;
              }

              return Number(right?.id ?? 0) - Number(left?.id ?? 0);
            })
        : [];

      let normalizedActiveTable = null;
      if (activeTableResponse.ok) {
        normalizedActiveTable = normalizeTable(await activeTableResponse.json());
      }

      setTables(normalizedTables);
      setActiveTable(normalizedActiveTable);
      return {
        tables: normalizedTables,
        activeTable: normalizedActiveTable,
      };
    } catch (fetchError) {
      console.error("Failed to load planning dashboard tables:", fetchError);
      setTables([]);
      setActiveTable(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : `Gagal memuat table dashboard ${normalizedScope}.`,
      );
      return {
        tables: [],
        activeTable: null,
      };
    } finally {
      setLoading(false);
    }
  }, [activeTableUrl, normalizedScope, tablesUrl]);

  const createTable = useCallback(
    async () => {
      const response = await fetch(`${baseUrl}/${endpoint}/tables?scope=${queryScope}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scope: normalizedScope }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    [baseUrl, endpoint, normalizedScope, queryScope],
  );

  const renameTable = useCallback(
    async (tableId, tableName) => {
      const response = await fetch(`${baseUrl}/${endpoint}/tables/${tableId}?scope=${queryScope}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tableName }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    [baseUrl, endpoint, queryScope],
  );

  const deleteTable = useCallback(
    async (tableId) => {
      const response = await fetch(`${baseUrl}/${endpoint}/tables/${tableId}?scope=${queryScope}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    [baseUrl, endpoint, queryScope],
  );

  useEffect(() => {
    refreshTables();
  }, [refreshTables]);

  useEffect(() => {
    if (!initialTableId) {
      return;
    }

    setSelectedToken(String(initialTableId));
  }, [initialTableId]);

  useEffect(() => {
    if (selectedToken === ACTIVE_TABLE_TOKEN) {
      return;
    }

    const exists = tables.some((table) => table.id === Number(selectedToken));
    if (!exists) {
      setSelectedToken(ACTIVE_TABLE_TOKEN);
    }
  }, [selectedToken, tables]);

  const selectedTableId =
    selectedToken === ACTIVE_TABLE_TOKEN
      ? Number(activeTable?.id ?? 0) || null
      : Number(selectedToken);

  const selectedTable = useMemo(() => {
    if (selectedToken === ACTIVE_TABLE_TOKEN) {
      return activeTable;
    }

    if (!selectedTableId) {
      return activeTable;
    }

    return tables.find((table) => table.id === selectedTableId) || null;
  }, [activeTable, selectedTableId, selectedToken, tables]);

  return {
    scope: normalizedScope,
    tables,
    activeTable,
    loading,
    error,
    selectedToken,
    setSelectedToken,
    selectedTableId,
    selectedTable,
    refreshTables,
    createTable,
    renameTable,
    deleteTable,
    activeTableToken: ACTIVE_TABLE_TOKEN,
  };
};
