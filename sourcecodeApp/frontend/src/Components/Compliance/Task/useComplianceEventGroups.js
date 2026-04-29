/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/useComplianceEventGroups.js
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

const normalizeGroup = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = Number(value.id ?? value.Id ?? 0);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return {
    id,
    periodName: String(value.periodName ?? value.PeriodName ?? ""),
    period: String(value.period ?? value.Period ?? ""),
    rowCount: Number(value.rowCount ?? value.RowCount ?? 0),
    suggestionValuesByColumn: normalizeSuggestionValuesByColumn(
      value.suggestionValuesByColumn ?? value.SuggestionValuesByColumn,
    ),
    createdAt: value.createdAt ?? value.CreatedAt ?? null,
    updatedAt: value.updatedAt ?? value.UpdatedAt ?? null,
  };
};

const getGroupTimestamp = (group) => {
  const timestamp = group?.createdAt ? new Date(group.createdAt).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortGroups = (groups) =>
  [...groups].sort((left, right) => {
    const timeDiff = getGroupTimestamp(right) - getGroupTimestamp(left);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return Number(right?.id ?? 0) - Number(left?.id ?? 0);
  });

const buildApiUrl = (path) =>
  `${String(process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "")}/${path}`;

export const ALL_COMPLIANCE_EVENTS_ID = 0;
const ALL_COMPLIANCE_EVENTS_LABEL = "All Events";

export const useComplianceEventGroups = ({ initialGroupId = null } = {}) => {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(
    initialGroupId ? Number(initialGroupId) : null,
  );

  const refreshGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [groupsResponse, activeGroupResponse] = await Promise.all([
        fetch(buildApiUrl("DocumentPeriodReport/groups"), { credentials: "include" }),
        fetch(buildApiUrl("DocumentPeriodReport/active-group"), { credentials: "include" }),
      ]);

      if (!groupsResponse.ok) {
        throw new Error(await groupsResponse.text());
      }

      const groupsJson = await groupsResponse.json();
      const normalizedGroups = sortGroups(
        (Array.isArray(groupsJson) ? groupsJson : [])
          .map(normalizeGroup)
          .filter(Boolean),
      );

      let normalizedActiveGroup = null;
      if (activeGroupResponse.ok) {
        normalizedActiveGroup = normalizeGroup(await activeGroupResponse.json());
      }

      setGroups(normalizedGroups);
      setActiveGroup(normalizedActiveGroup);
    } catch (fetchError) {
      console.error("Failed to load compliance event groups:", fetchError);
      setGroups([]);
      setActiveGroup(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Gagal memuat Compliance Events.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const renameGroup = useCallback(async (groupId, periodName) => {
    const response = await fetch(buildApiUrl(`DocumentPeriodReport/groups/${groupId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ periodName }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }, []);

  const deleteGroup = useCallback(async (groupId) => {
    const response = await fetch(buildApiUrl(`DocumentPeriodReport/groups/${groupId}`), {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }, []);

  const upsertGroupLocally = useCallback((incomingGroup) => {
    const normalizedGroup = normalizeGroup(incomingGroup);
    if (!normalizedGroup) {
      return null;
    }

    setGroups((prev) =>
      sortGroups([
        normalizedGroup,
        ...prev.filter((group) => group.id !== normalizedGroup.id),
      ]),
    );

    setActiveGroup((prev) => {
      if (prev?.id === normalizedGroup.id || prev == null) {
        return normalizedGroup;
      }

      return prev;
    });

    return normalizedGroup;
  }, []);

  const removeGroupLocally = useCallback((groupId, nextActiveGroupId = null) => {
    const numericGroupId = Number(groupId ?? 0);
    const numericNextActiveGroupId = Number(nextActiveGroupId ?? 0) || null;

    setGroups((prev) => prev.filter((group) => group.id !== numericGroupId));
    setActiveGroup((prev) => {
      if (prev?.id !== numericGroupId) {
        return prev;
      }

      return numericNextActiveGroupId
        ? {
            id: numericNextActiveGroupId,
            periodName: "",
            period: "",
            rowCount: 0,
            suggestionValuesByColumn: {},
            createdAt: null,
            updatedAt: null,
          }
        : null;
    });
  }, []);

  const adjustGroupRowCount = useCallback((groupId, delta) => {
    const numericGroupId = Number(groupId ?? 0);
    if (!numericGroupId || !delta) {
      return;
    }

    const applyDelta = (group) =>
      group?.id === numericGroupId
        ? {
            ...group,
            rowCount: Math.max(0, Number(group?.rowCount ?? 0) + Number(delta)),
          }
        : group;

    setGroups((prev) => prev.map(applyDelta));
    setActiveGroup((prev) => (prev ? applyDelta(prev) : prev));
  }, []);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  useEffect(() => {
    if (!initialGroupId) {
      return;
    }

    setSelectedGroupId(Number(initialGroupId));
  }, [initialGroupId]);

  useEffect(() => {
    if (Number(selectedGroupId) === ALL_COMPLIANCE_EVENTS_ID) {
      return;
    }

    if (!selectedGroupId) {
      return;
    }

    const exists = groups.some((group) => group.id === Number(selectedGroupId));
    if (!exists) {
      setSelectedGroupId(null);
    }
  }, [groups, selectedGroupId]);

  const selectedGroup = useMemo(() => {
    if (Number(selectedGroupId) === ALL_COMPLIANCE_EVENTS_ID) {
      return {
        id: ALL_COMPLIANCE_EVENTS_ID,
        periodName: ALL_COMPLIANCE_EVENTS_LABEL,
        period: "All",
        rowCount: groups.reduce(
          (total, group) => total + Number(group?.rowCount ?? 0),
          0,
        ),
        suggestionValuesByColumn: {},
        createdAt: null,
        updatedAt: null,
        isSyntheticAll: true,
      };
    }

    if (selectedGroupId) {
      return groups.find((group) => group.id === Number(selectedGroupId)) || null;
    }

    return activeGroup || groups[0] || null;
  }, [activeGroup, groups, selectedGroupId]);

  const effectiveSelectedGroupId =
    selectedGroup?.id === ALL_COMPLIANCE_EVENTS_ID
      ? ALL_COMPLIANCE_EVENTS_ID
      : Number(selectedGroup?.id ?? 0) || null;

  return {
    groups,
    activeGroup,
    loading,
    error,
    selectedGroup,
    selectedGroupId: effectiveSelectedGroupId,
    setSelectedGroupId,
    refreshGroups,
    renameGroup,
    deleteGroup,
    upsertGroupLocally,
    removeGroupLocally,
    adjustGroupRowCount,
  };
};
