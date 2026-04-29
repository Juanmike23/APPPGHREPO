/*
 * PGH-DOC
 * File: src/Components/Compliance/Weekly/useWeeklyTables.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildWeeklyScopeApiUrl } from "./useWeeklyPeriods";

const ACTIVE_TABLE_TOKEN = "__active_table__";

const normalizeSuggestionValuesByColumn = (value) => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [column, entries]) => {
    const normalizedColumn = String(column ?? "").trim();
    if (!normalizedColumn) {
      return accumulator;
    }

    const normalizedEntries = Array.isArray(entries)
      ? Array.from(
          new Set(
            entries
              .map((entry) => String(entry ?? "").trim())
              .filter(Boolean),
          ),
        )
      : [];

    if (normalizedEntries.length > 0) {
      accumulator[normalizedColumn] = normalizedEntries;
    }

    return accumulator;
  }, {});
};

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
    weeklyPeriodId: Number(value.weeklyPeriodId ?? value.WeeklyPeriodId ?? 0) || null,
    tableName: String(value.tableName ?? value.TableName ?? ""),
    isDefault: Boolean(value.isDefault ?? value.IsDefault),
    suggestionValuesByColumn: normalizeSuggestionValuesByColumn(
      value.suggestionValuesByColumn ?? value.SuggestionValuesByColumn,
    ),
    rowCount: Number(value.rowCount ?? value.RowCount ?? 0),
    createdAt: value.createdAt ?? value.CreatedAt ?? null,
    updatedAt: value.updatedAt ?? value.UpdatedAt ?? null,
  };
};

const getTableCreatedAtTimestamp = (table) => {
  const rawValue = table?.createdAt ?? null;
  const timestamp = rawValue ? new Date(rawValue).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const useWeeklyTables = ({
  endpoint = "weeklytable",
  selectedPeriodId = null,
  initialTableId = null,
} = {}) => {
  const baseUrl = String(process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedToken, setSelectedTokenState] = useState(
    initialTableId ? String(initialTableId) : ACTIVE_TABLE_TOKEN,
  );
  const pendingSelectionRef = useRef(
    initialTableId ? String(initialTableId) : null,
  );

  const setSelectedToken = useCallback((nextToken) => {
    const normalizedToken =
      nextToken === undefined || nextToken === null || nextToken === ""
        ? ACTIVE_TABLE_TOKEN
        : String(nextToken);

    pendingSelectionRef.current =
      normalizedToken === ACTIVE_TABLE_TOKEN ? null : normalizedToken;

    setSelectedTokenState(normalizedToken);
  }, []);

  const tablesUrl = useMemo(
    () =>
      buildWeeklyScopeApiUrl(baseUrl, `${endpoint}/tables`, {
        periodId: selectedPeriodId,
      }),
    [baseUrl, endpoint, selectedPeriodId],
  );

  const activeTableUrl = useMemo(
    () =>
      buildWeeklyScopeApiUrl(baseUrl, `${endpoint}/active-table`, {
        periodId: selectedPeriodId,
      }),
    [baseUrl, endpoint, selectedPeriodId],
  );

  const refreshTables = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
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

      const pendingToken = pendingSelectionRef.current;
      if (pendingToken) {
        const exists = normalizedTables.some(
          (table) => String(table.id) === pendingToken,
        );

        if (exists) {
          setSelectedTokenState(pendingToken);
          pendingSelectionRef.current = null;
        }
      }
    } catch (fetchError) {
      console.error("Failed to load weekly tables:", fetchError);
      if (!silent) {
        setTables([]);
        setActiveTable(null);
      }
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat table weekly.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [activeTableUrl, tablesUrl]);

  const renameTable = useCallback(
    async (tableId, tableName) => {
      const response = await fetch(`${baseUrl}/${endpoint}/tables/${tableId}`, {
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
    [baseUrl, endpoint],
  );

  const deleteTable = useCallback(
    async (tableId) => {
      const response = await fetch(`${baseUrl}/${endpoint}/tables/${tableId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    [baseUrl, endpoint],
  );

  useEffect(() => {
    refreshTables();
  }, [refreshTables]);

  useEffect(() => {
    if (!initialTableId) {
      return;
    }

    setSelectedToken(String(initialTableId));
  }, [initialTableId, setSelectedToken]);

  useEffect(() => {
    if (selectedToken === ACTIVE_TABLE_TOKEN) {
      pendingSelectionRef.current = null;
      return;
    }

    if (pendingSelectionRef.current === selectedToken) {
      const pendingExists = tables.some(
        (table) => String(table.id) === String(selectedToken),
      );

      if (pendingExists) {
        pendingSelectionRef.current = null;
      }

      return;
    }

    const exists = tables.some((table) => table.id === Number(selectedToken));
    if (!exists) {
      setSelectedTokenState(ACTIVE_TABLE_TOKEN);
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
    tables,
    activeTable,
    loading,
    error,
    selectedToken,
    setSelectedToken,
    selectedTableId,
    selectedTable,
    refreshTables,
    renameTable,
    deleteTable,
    activeTableToken: ACTIVE_TABLE_TOKEN,
  };
};
