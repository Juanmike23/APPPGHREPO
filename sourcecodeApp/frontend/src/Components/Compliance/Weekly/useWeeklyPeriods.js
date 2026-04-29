/*
 * PGH-DOC
 * File: src/Components/Compliance/Weekly/useWeeklyPeriods.js
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

const ACTIVE_PERIOD_TOKEN = "__active__";

const buildScopedUrl = (baseUrl, endpoint, params = {}) => {
  const normalizedBase = String(baseUrl || "").replace(/\/$/, "");
  const normalizedEndpoint = String(endpoint || "").replace(/^\//, "");
  const url = `${normalizedBase}/${normalizedEndpoint}`;
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `${url}?${queryString}` : url;
};

const normalizePeriod = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = Number(value.id ?? value.Id ?? 0);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return {
    id,
    periodCode: String(value.periodCode ?? value.PeriodCode ?? ""),
    displayName: String(value.displayName ?? value.DisplayName ?? ""),
    weekStartDate: value.weekStartDate ?? value.WeekStartDate ?? null,
    weekEndDate: value.weekEndDate ?? value.WeekEndDate ?? null,
    year: value.year ?? value.Year ?? null,
    weekNumber: value.weekNumber ?? value.WeekNumber ?? null,
    isLegacy: Boolean(value.isLegacy ?? value.IsLegacy),
    rowCount: Number(value.rowCount ?? value.RowCount ?? 0),
  };
};

export const buildWeeklyScopeApiUrl = (
  baseUrl,
  endpoint,
  { periodId = null, tableId = null } = {},
) => buildScopedUrl(baseUrl, endpoint, { periodId, tableId });

export const buildWeeklyPeriodApiUrl = (baseUrl, endpoint, periodId) =>
  buildWeeklyScopeApiUrl(baseUrl, endpoint, { periodId });

export const buildWeeklyItemApiUrl = (
  baseUrl,
  endpoint,
  rowId,
  { periodId = null, tableId = null } = {},
) => {
  const scopedBase = buildWeeklyScopeApiUrl(baseUrl, endpoint, {
    periodId,
    tableId,
  });
  const [path, queryString = ""] = scopedBase.split("?");
  const normalizedPath = path.replace(/\/$/, "");
  return queryString
    ? `${normalizedPath}/${encodeURIComponent(rowId)}?${queryString}`
    : `${normalizedPath}/${encodeURIComponent(rowId)}`;
};

export const buildWeeklyActionApiUrl = (
  baseUrl,
  endpoint,
  actionPath,
  { periodId = null, tableId = null } = {},
) => {
  const scopedBase = buildWeeklyScopeApiUrl(baseUrl, endpoint, {
    periodId,
    tableId,
  });
  const [path, queryString = ""] = scopedBase.split("?");
  const normalizedPath = path.replace(/\/$/, "");
  const normalizedAction = String(actionPath || "").replace(/^\/+/, "");
  return queryString
    ? `${normalizedPath}/${normalizedAction}?${queryString}`
    : `${normalizedPath}/${normalizedAction}`;
};

export const useWeeklyPeriods = ({
  endpoint = "weeklytable",
  initialPeriodId = null,
} = {}) => {
  const baseUrl = String(process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
  const periodsUrl = `${baseUrl}/${endpoint}/periods`;
  const activePeriodUrl = `${baseUrl}/${endpoint}/active-period`;

  const [periods, setPeriods] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedToken, setSelectedToken] = useState(
    initialPeriodId ? String(initialPeriodId) : ACTIVE_PERIOD_TOKEN,
  );

  const refreshPeriods = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [periodsResponse, activePeriodResponse] = await Promise.all([
        fetch(periodsUrl, { credentials: "include" }),
        fetch(activePeriodUrl, { credentials: "include" }),
      ]);

      if (!periodsResponse.ok) {
        throw new Error(await periodsResponse.text());
      }

      const periodsJson = await periodsResponse.json();
      const normalizedPeriods = Array.isArray(periodsJson)
        ? periodsJson.map(normalizePeriod).filter(Boolean)
        : [];

      let normalizedActivePeriod = null;
      if (activePeriodResponse.ok) {
        normalizedActivePeriod = normalizePeriod(await activePeriodResponse.json());
      }

      setPeriods(normalizedPeriods);
      setActivePeriod(normalizedActivePeriod);
    } catch (fetchError) {
      console.error("Failed to load weekly periods:", fetchError);
      setPeriods([]);
      setActivePeriod(null);
      setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat periode weekly.");
    } finally {
      setLoading(false);
    }
  }, [activePeriodUrl, periodsUrl]);

  useEffect(() => {
    refreshPeriods();
  }, [refreshPeriods]);

  useEffect(() => {
    if (!initialPeriodId) {
      return;
    }

    setSelectedToken(String(initialPeriodId));
  }, [initialPeriodId]);

  const historyPeriods = useMemo(() => {
    if (!activePeriod) {
      return periods;
    }

    return periods.filter((period) => period.id !== activePeriod.id);
  }, [activePeriod, periods]);

  const selectedPeriodId =
    selectedToken === ACTIVE_PERIOD_TOKEN ? null : Number(selectedToken);

  const selectedPeriod = useMemo(() => {
    if (!selectedPeriodId) {
      return activePeriod;
    }

    return periods.find((period) => period.id === selectedPeriodId) || null;
  }, [activePeriod, periods, selectedPeriodId]);

  const isHistoricalSelection = selectedToken !== ACTIVE_PERIOD_TOKEN;
  const isEditableSelection = !isHistoricalSelection;

  return {
    activePeriod,
    periods,
    historyPeriods,
    loading,
    error,
    selectedToken,
    setSelectedToken,
    selectedPeriodId,
    selectedPeriod,
    isHistoricalSelection,
    isEditableSelection,
    refreshPeriods,
    activePeriodToken: ACTIVE_PERIOD_TOKEN,
  };
};
