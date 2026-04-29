/*
 * PGH-DOC
 * File: src/Components/Planning/DashboardPlanning/Opex/OpexWorkspace.jsx
 * Apa fungsi bagian ini:
 * - Workspace OPEX: kartu overview + impor + tabel detail.
 * Kenapa perlu:
 * - Menjaga flow OPEX tetap satu area kerja dan konsisten dengan engine tabel global.
 * Aturan khususnya apa:
 * - Hierarki row dibangun dari kolom SIT dan ditampilkan dalam mode collapse/expand.
 * - Jangan menambah dropdown pemilihan table di area ini; pemilihan table tetap dari header dashboard.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, UploadCloud } from "react-feather";
import { Alert, Col } from "@pgh/ui-bootstrap";
import TableComponent from "../../../../Variables/Table/TableComponent";
import OpexCharts from "./OpexCharts";
import OpexLegacyCharts from "./OpexLegacyCharts";
import {
  OPEX_TEMPLATE_COLUMNS,
  resolveOpexYear,
  buildOpexColumnLabels,
} from "../../../../Variables/utils/opexSchema";

const createEmptyTableFilters = () => ({
  filters: [],
  mode: "and",
  sort: null,
  visibleColumns: null,
  distinct: null,
});

const normalizeSitToken = (value) => String(value ?? "").trim().replace(/\s+/g, "");
const normalizeTextToken = (value) => String(value ?? "").trim().toLowerCase();
const normalizeSitComparable = (value) =>
  normalizeSitToken(value).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const sitSegments = (value) =>
  normalizeSitToken(value)
    .split(/[.\-_/]+/)
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
const hasChildValue = (row) => String(row?.MataAnggaranChild ?? "").trim().length > 0;
const isRowTypeDetail = (row) => normalizeTextToken(row?.RowType) === "detail";
const canSitBeParent = (parentSit, childSit) => {
  const parentToken = normalizeSitToken(parentSit);
  const childToken = normalizeSitToken(childSit);
  if (!parentToken || !childToken || parentToken.toLowerCase() === childToken.toLowerCase()) {
    return false;
  }

  const parentComparable = normalizeSitComparable(parentToken);
  const childComparable = normalizeSitComparable(childToken);
  if (!parentComparable || !childComparable || parentComparable === childComparable) {
    return false;
  }

  const parentParts = sitSegments(parentToken);
  const childParts = sitSegments(childToken);
  if (parentParts.length > 0 && childParts.length > parentParts.length) {
    return parentParts.every((segment, index) => segment === childParts[index]);
  }

  // Hierarki kode kontinu: parent lebih pendek dan child diawali kode parent.
  if (
    childComparable.length > parentComparable.length &&
    childComparable.startsWith(parentComparable)
  ) {
    return true;
  }

  // Parent group biasanya berakhiran "00" dan detail/sibling punya prefix yang sama.
  if (
    parentComparable.endsWith("00") &&
    parentComparable.length === childComparable.length &&
    parentComparable.slice(0, -2) === childComparable.slice(0, -2) &&
    !childComparable.endsWith("00")
  ) {
    return true;
  }

  if (!childToken.toLowerCase().startsWith(parentToken.toLowerCase())) {
    return false;
  }

  const boundary = childToken.slice(parentToken.length, parentToken.length + 1);
  return boundary === "." || boundary === "-" || boundary === "_" || boundary === "/";
};
const BUDGET_GUARDRAIL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUDGET_GUARDRAIL_DEFAULTS = [7, 14, 22, 30, 39, 48, 58, 68, 77, 85, 93, 100];
const buildHierarchyRowKey = (row, index) => {
  const rowId = row?.Id ?? row?.id ?? row?.ID ?? null;
  if (rowId !== null && rowId !== undefined && rowId !== "") {
    return `opex:id:${String(rowId)}`;
  }
  const sit = normalizeSitToken(row?.SIT);
  return `opex:sit:${sit || String(index)}`;
};

const buildFallbackBudgetGuardrailConfig = (tableId, year, tableName, reason = "") => ({
  tableId,
  tableName: tableName || "OPEX",
  year,
  source: "default",
  apiUnavailable: true,
  apiUnavailableReason: reason,
  rows: BUDGET_GUARDRAIL_MONTHS.map((month, index) => ({
    monthIndex: index + 1,
    month,
    targetPct: BUDGET_GUARDRAIL_DEFAULTS[index],
    defaultTargetPct: BUDGET_GUARDRAIL_DEFAULTS[index],
    isDefault: true,
  })),
});

const buildHierarchyRowsFromSit = (rows, collapseState) => {
  const source = Array.isArray(rows)
    ? rows.filter((row) => row && typeof row === "object")
    : [];
  if (!source.length) return [];

  const nodes = source.map((row, index) => ({
    ...row,
    __key: buildHierarchyRowKey(row, index),
    __sourceIndex: index,
    __sit: normalizeSitToken(row?.SIT),
    __segments: sitSegments(row?.SIT),
    __parentToken: normalizeTextToken(row?.MataAnggaranParent),
    __parentKey: null,
    __children: [],
  }));

  const nodeByKey = new Map(nodes.map((node) => [node.__key, node]));
  const latestBySit = new Map();
  const latestByParentToken = new Map();
  const latestGroupWithoutChildByParentToken = new Map();

  nodes.forEach((node, index) => {
    if (index > 0) {
      let sitParent = null;
      if (node.__sit) {
        if (!node.__sit.endsWith("00") && node.__sit.length >= 2) {
          const groupedCandidateToken = `${node.__sit.slice(0, -2)}00`;
          const groupedCandidate = latestBySit.get(groupedCandidateToken);
          if (groupedCandidate && canSitBeParent(groupedCandidate?.__sit, node.__sit)) {
            sitParent = groupedCandidate;
          }
        }

        if (!sitParent) {
          for (let cursor = node.__sit.length - 1; cursor > 0; cursor -= 1) {
            const boundary = node.__sit.charAt(cursor);
            if (boundary !== "." && boundary !== "-" && boundary !== "_" && boundary !== "/") {
              continue;
            }

            const candidateToken = node.__sit.slice(0, cursor);
            const prefixedCandidate = latestBySit.get(candidateToken);
            if (prefixedCandidate && canSitBeParent(prefixedCandidate?.__sit, node.__sit)) {
              sitParent = prefixedCandidate;
              break;
            }
          }
        }

        if (!sitParent) {
          for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
            const candidate = nodes[cursor];
            if (canSitBeParent(candidate?.__sit, node.__sit)) {
              sitParent = candidate;
              break;
            }
          }
        }
      }

      if (sitParent) {
        node.__parentKey = sitParent.__key;
      } else if (node.__parentToken) {
        const groupedParent = latestGroupWithoutChildByParentToken.get(node.__parentToken);
        if (groupedParent) {
          node.__parentKey = groupedParent.__key;
        } else if (hasChildValue(node) || isRowTypeDetail(node)) {
          const nearestSameParent = latestByParentToken.get(node.__parentToken);
          if (nearestSameParent) {
            node.__parentKey = nearestSameParent.__key;
          }
        }
      }
    }

    if (node.__parentToken) {
      latestByParentToken.set(node.__parentToken, node);
      if (!hasChildValue(node)) {
        latestGroupWithoutChildByParentToken.set(node.__parentToken, node);
      }
    }
    if (node.__sit) {
      latestBySit.set(node.__sit, node);
    }
  });

  nodes.forEach((node) => {
    if (!node.__parentKey) return;
    const parent = nodeByKey.get(node.__parentKey);
    if (parent) {
      parent.__children.push(node);
    }
  });

  const roots = nodes
    .filter((node) => !node.__parentKey)
    .sort((left, right) => left.__sourceIndex - right.__sourceIndex);

  const flattened = [];
  const visit = (node, parentKeys, level) => {
    const children = [...node.__children].sort(
      (left, right) => left.__sourceIndex - right.__sourceIndex,
    );
    const isCollapsed = Boolean(collapseState?.[node.__key]);

    flattened.push({
      ...node,
      __level: level,
      parentKey: node.__parentKey,
      parentKeys,
      hasChildren: children.length > 0,
      isCollapsed,
    });

    if (isCollapsed || children.length === 0) return;
    children.forEach((child) => visit(child, [...parentKeys, node.__key], level + 1));
  };

  roots.forEach((root) => {
    visit(root, [], 0);
  });

  return flattened.map((node) => {
    const cleaned = { ...node };
    delete cleaned.__sourceIndex;
    delete cleaned.__sit;
    delete cleaned.__segments;
    delete cleaned.__parentToken;
    delete cleaned.__parentKey;
    delete cleaned.__children;
    return cleaned;
  });
};

const buildDefaultCollapseState = (sourceRows) => {
  const flattened = buildHierarchyRowsFromSit(sourceRows, {});
  const next = {};
  flattened.forEach((row) => {
    next[row.__key] = Boolean(row.hasChildren);
  });
  return next;
};

const toFriendlyOpexError = (error, fallbackMessage) => {
  const raw =
    error instanceof Error
      ? error.message
      : String(error ?? "").trim();

  if (
    /Invalid column name 'FullYearFY'|Invalid column name 'HasFullYearFyOverride'/i.test(raw)
  ) {
    return "Schema database OPEX belum sinkron (kolom FY snapshot belum tersedia). Restart backend agar auto-bootstrap schema berjalan, lalu coba lagi.";
  }

  return raw || fallbackMessage;
};

const isTransientCanceledStatus = (status) =>
  Number(status) === 499 || Number(status) === 408;

const OpexWorkspace = ({
  tableId,
  year,
  mode,
  period,
  tableName,
  kroOnly = false,
  showOverviewCards = true,
  showImportControls = true,
  showTable = true,
  allowChartDrilldown = true,
  canManageBudgetGuardrail = true,
  refreshToken = 0,
  onImported = null,
}) => {
  const apiRoot = String(process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
  const fileInputRef = useRef(null);
  const tableSectionRef = useRef(null);
  const overviewRequestIdRef = useRef(0);
  const rowsRequestIdRef = useRef(0);
  const budgetGuardrailRequestIdRef = useRef(0);

  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [budgetGuardrailConfig, setBudgetGuardrailConfig] = useState(null);
  const [loadingBudgetGuardrailConfig, setLoadingBudgetGuardrailConfig] = useState(false);
  const [savingBudgetGuardrailConfig, setSavingBudgetGuardrailConfig] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [tableReloadKey, setTableReloadKey] = useState(0);
  const [collapseState, setCollapseState] = useState({});
  const [tableFilters, setTableFilters] = useState(createEmptyTableFilters);
  const [importHeaderLabels, setImportHeaderLabels] = useState(null);
  const resolvedYear = useMemo(() => resolveOpexYear(year), [year]);
  const selectedOverviewMonths = useMemo(
    () => (Array.isArray(overview?.months) ? overview.months : []),
    [overview?.months],
  );
  const opexColumnLabels = useMemo(
    () => buildOpexColumnLabels(resolvedYear, importHeaderLabels, { selectedMonths: selectedOverviewMonths }),
    [resolvedYear, importHeaderLabels, selectedOverviewMonths],
  );
  const modeToken = useMemo(
    () => (String(mode ?? "").trim().toLowerCase() === "monthly" ? "monthly" : "total"),
    [mode],
  );
  const periodToken = useMemo(
    () =>
      period === null || period === undefined || period === ""
        ? "Dec"
        : String(period).trim(),
    [period],
  );
  const opexNonEditableColumns = useMemo(() => [...OPEX_TEMPLATE_COLUMNS], []);

  const tableApiUrl = useMemo(() => {
    if (!tableId || !year) return "";
    return `${apiRoot}/opex/table/${tableId}?year=${year}&mode=${encodeURIComponent(
      modeToken,
    )}&period=${encodeURIComponent(periodToken)}${kroOnly ? "&kroOnly=true" : ""}`;
  }, [apiRoot, kroOnly, modeToken, periodToken, tableId, year]);

  const hierarchyRowsForCurrentTable = useMemo(
    () => buildHierarchyRowsFromSit(rows, collapseState),
    [collapseState, rows],
  );

  const buildHierarchyRows = useCallback(
    (sourceRows) => {
      if (sourceRows === rows) {
        return hierarchyRowsForCurrentTable;
      }
      return buildHierarchyRowsFromSit(sourceRows, collapseState);
    },
    [collapseState, hierarchyRowsForCurrentTable, rows],
  );

  const toggleHierarchy = useCallback((key) => {
    setCollapseState((prev) => ({
      ...prev,
      [key]: !Boolean(prev?.[key]),
    }));
  }, []);

  const loadOverview = useCallback(async () => {
    if (!tableId || !year) {
      setOverview(null);
      setImportHeaderLabels(null);
      return;
    }

    const requestId = overviewRequestIdRef.current + 1;
    overviewRequestIdRef.current = requestId;
    setLoadingOverview(true);
    try {
      const url = `${apiRoot}/opex/table/${tableId}/overview?year=${year}&mode=${encodeURIComponent(
        modeToken,
      )}&period=${encodeURIComponent(periodToken)}${kroOnly ? "&kroOnly=true" : ""}`;
      let response = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
        });

        if (!isTransientCanceledStatus(response.status) || attempt > 0) {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      if (isTransientCanceledStatus(response?.status)) {
        return;
      }
      if (!response?.ok) throw new Error(await response.text());
      const json = await response.json();
      if (overviewRequestIdRef.current !== requestId) return;
      setOverview(json);
      setImportHeaderLabels(
        json?.headerLabels && typeof json.headerLabels === "object"
          ? json.headerLabels
          : null,
      );
      setMessage("");
    } catch (error) {
      if (overviewRequestIdRef.current !== requestId) return;
      setOverview(null);
      setImportHeaderLabels(null);
      setMessage(toFriendlyOpexError(error, "Gagal memuat overview OPEX."));
    } finally {
      if (overviewRequestIdRef.current === requestId) {
        setLoadingOverview(false);
      }
    }
  }, [apiRoot, kroOnly, modeToken, periodToken, tableId, year]);

  const loadRows = useCallback(async () => {
    if (!tableApiUrl) {
      setRows([]);
      return;
    }

    const requestId = rowsRequestIdRef.current + 1;
    rowsRequestIdRef.current = requestId;
    try {
      let response = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch(tableApiUrl, {
          credentials: "include",
          cache: "no-store",
        });

        if (!isTransientCanceledStatus(response.status) || attempt > 0) {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      if (isTransientCanceledStatus(response?.status)) {
        return;
      }
      if (!response?.ok) throw new Error(await response.text());
      const json = await response.json();
      if (rowsRequestIdRef.current !== requestId) return;
      setRows(Array.isArray(json) ? json : []);
    } catch (error) {
      if (rowsRequestIdRef.current !== requestId) return;
      setRows([]);
      setMessage(toFriendlyOpexError(error, "Gagal memuat tabel OPEX."));
    }
  }, [tableApiUrl]);

  const loadBudgetGuardrailConfig = useCallback(async () => {
    if (!tableId || !year) {
      setBudgetGuardrailConfig(null);
      return;
    }

    const requestId = budgetGuardrailRequestIdRef.current + 1;
    budgetGuardrailRequestIdRef.current = requestId;
    setLoadingBudgetGuardrailConfig(true);
    try {
      const url = `${apiRoot}/opex/table/${tableId}/budget-guardrail-targets?year=${year}`;
      let response = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
        });

        if (!isTransientCanceledStatus(response.status) || attempt > 0) {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      if (isTransientCanceledStatus(response?.status)) {
        return;
      }
      if (Number(response?.status) === 404) {
        if (budgetGuardrailRequestIdRef.current !== requestId) return;
        setBudgetGuardrailConfig(
          buildFallbackBudgetGuardrailConfig(
            tableId,
            year,
            tableName,
            "Endpoint target guardrail belum aktif di runtime backend yang sedang berjalan.",
          ),
        );
        return;
      }
      if (!response?.ok) throw new Error(await response.text());
      const json = await response.json();
      if (budgetGuardrailRequestIdRef.current !== requestId) return;
      setBudgetGuardrailConfig(json);
    } catch (error) {
      if (budgetGuardrailRequestIdRef.current !== requestId) return;
      setBudgetGuardrailConfig(
        buildFallbackBudgetGuardrailConfig(
          tableId,
          year,
          tableName,
          error instanceof Error ? error.message : "",
        ),
      );
      setMessage(toFriendlyOpexError(error, "Gagal memuat target guardrail OPEX."));
    } finally {
      if (budgetGuardrailRequestIdRef.current === requestId) {
        setLoadingBudgetGuardrailConfig(false);
      }
    }
  }, [apiRoot, tableId, year]);

  const handleSaveBudgetGuardrailConfig = useCallback(
    async (configRows) => {
      if (!tableId || !year) {
        throw new Error("Table OPEX belum dipilih.");
      }

      setSavingBudgetGuardrailConfig(true);
      try {
        if (budgetGuardrailConfig?.apiUnavailable) {
          throw new Error("Backend target guardrail belum aktif di runtime IIS yang sedang berjalan. Restart IIS Express terlebih dahulu agar endpoint config terbaca.");
        }

        const response = await fetch(
          `${apiRoot}/opex/table/${tableId}/budget-guardrail-targets?year=${year}`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              year,
              rows: Array.isArray(configRows) ? configRows : [],
            }),
          },
        );

        if (Number(response.status) === 404) {
          throw new Error("Endpoint target guardrail belum aktif di backend yang sedang berjalan. Restart IIS Express terlebih dahulu.");
        }
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const json = await response.json();
        setBudgetGuardrailConfig(json);
        await loadOverview();
        setMessage("Target guardrail OPEX berhasil diperbarui.");
        return json;
      } catch (error) {
        throw new Error(toFriendlyOpexError(error, "Gagal menyimpan target guardrail OPEX."));
      } finally {
        setSavingBudgetGuardrailConfig(false);
      }
    },
    [apiRoot, budgetGuardrailConfig?.apiUnavailable, loadOverview, tableId, year],
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshToken]);

  useEffect(() => {
    loadRows();
  }, [loadRows, refreshToken, tableReloadKey]);

  useEffect(() => {
    loadBudgetGuardrailConfig();
  }, [loadBudgetGuardrailConfig, refreshToken]);

  useEffect(() => {
    setTableFilters(createEmptyTableFilters());
    setImportHeaderLabels(null);
  }, [tableId, year]);

  useEffect(() => {
    // Hindari flash data lama saat user pindah table/tahun.
    setRows([]);
    setOverview(null);
    setBudgetGuardrailConfig(null);
    setCollapseState({});
    setMessage("");
  }, [tableId, year]);

  useEffect(
    () => () => {
      overviewRequestIdRef.current += 1;
      rowsRequestIdRef.current += 1;
      budgetGuardrailRequestIdRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    setCollapseState((prev) => {
      const baseline = buildDefaultCollapseState(rows);
      const previousState =
        prev && typeof prev === "object" ? prev : {};

      const merged = { ...baseline };
      Object.keys(baseline).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(previousState, key)) {
          merged[key] = Boolean(previousState[key]);
        }
      });

      const baselineKeys = Object.keys(baseline);
      const isSameLength = baselineKeys.length === Object.keys(previousState).length;
      const isSameValue = isSameLength && baselineKeys.every((key) => previousState[key] === merged[key]);
      return isSameValue ? previousState : merged;
    });
  }, [rows]);

  const handleChartDrilldown = useCallback(
    ({ chartcolumn, label }) => {
      const resolvedColumn = String(chartcolumn || "MataAnggaranParent").trim();
      const resolvedValue = String(label ?? "").trim();
      if (!resolvedColumn || !resolvedValue) return false;

      setTableFilters((prev) => ({
        ...(prev || createEmptyTableFilters()),
        filters: [
          {
            column: resolvedColumn,
            operator: "=",
            value: resolvedValue,
          },
        ],
        mode: "and",
        distinct: null,
      }));

      window.requestAnimationFrame(() => {
        tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      return true;
    },
    [],
  );

  const triggerImportPicker = useCallback(() => {
    if (importing) return;
    fileInputRef.current?.click();
  }, [importing]);

  const importMergeToolbarAction =
    showImportControls && typeof triggerImportPicker === "function" ? (
      <button
        type="button"
        className="btn btn-outline-primary btn-sm d-inline-flex align-items-center"
        onClick={triggerImportPicker}
      >
        <UploadCloud size={14} className="me-2" />
        Import
      </button>
    ) : null;

  const handleImport = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file || !tableId) return;

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    setMessage("");
    try {
      const importResponse = await fetch(
        `${apiRoot}/opex/import/table/${tableId}?year=${year}&importMode=merge`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );
      if (!importResponse.ok) throw new Error(await importResponse.text());
      const result = await importResponse.json();

      const importedYear = result?.year ?? year;
      const activeMonth = result?.reportMonth ?? "-";
      const fileMonth = result?.importedReportMonth ?? activeMonth;
      const lockInfo =
        result?.didLockToNewerMonth
          ? ` File bulan ${fileMonth} lebih lama, bulan aktif tetap ${activeMonth}.`
          : "";
      const perf = result?.performance;
      const perfInfo =
        perf && Number.isFinite(Number(perf.totalMs))
          ? ` Waktu proses: ${Math.round(Number(perf.totalMs))} ms (parse ${Math.round(Number(perf.parseMs || 0))} ms, upsert ${Math.round(Number(perf.upsertMs || 0))} ms, recalc ${Math.round(Number(perf.recalculateMs || 0))} ms).`
          : "";
      setMessage(
        `Import berhasil (${importedYear} - ${activeMonth}): ${result.processed || 0} baris diproses (${result.inserted || 0} baru, ${result.updated || 0} update).${lockInfo}${perfInfo}`,
      );
      await Promise.all([loadRows(), loadOverview()]);

      if (typeof onImported === "function") {
        Promise.resolve(onImported(result)).catch(() => {});
      }
    } catch (error) {
      setMessage(toFriendlyOpexError(error, "Import OPEX gagal."));
    } finally {
      if (event?.target) event.target.value = "";
      setImporting(false);
    }
  };

  if (!tableId) {
    return (
      <Col xs="12">
        <Alert color="light" className="mb-0">
          Pilih Table Dashboard OPEX terlebih dahulu.
        </Alert>
      </Col>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="d-none"
        onChange={handleImport}
      />

      {message && (
        <Col xs="12" className="mb-3">
          <Alert color={message.toLowerCase().includes("gagal") ? "danger" : "success"} className="mb-0">
            <AlertCircle size={14} className="me-2" />
            {message}
          </Alert>
        </Col>
      )}

      {showOverviewCards && (
        <>
          <OpexLegacyCharts
            overview={overview}
            loading={loadingOverview}
          budgetGuardrailConfig={budgetGuardrailConfig}
          budgetGuardrailConfigLoading={loadingBudgetGuardrailConfig}
          budgetGuardrailConfigSaving={savingBudgetGuardrailConfig}
          canManageBudgetGuardrail={canManageBudgetGuardrail}
          onSaveBudgetGuardrailConfig={handleSaveBudgetGuardrailConfig}
          monitorSideContent={
              <OpexCharts
                rows={rows}
                year={year}
                selectedMonth={period}
                onDrilldown={allowChartDrilldown ? handleChartDrilldown : null}
                wrapInCol={false}
              />
            }
          />
        </>
      )}

      {showTable && (
        <Col xs="12" ref={tableSectionRef} className={showOverviewCards ? "mt-3" : ""}>
          <TableComponent
            title={kroOnly ? `OPEX KRO - ${year}` : `OPEX - ${year}`}
            data={rows}
            endpoint="Opex"
            apiUrl={tableApiUrl}
            reloadKey={tableReloadKey}
            disableAutoFetch
            forceReadOnly
            collapsible
            fixedColumnsOnly
            flatData={rows}
            collapseState={collapseState}
            toggle={toggleHierarchy}
            setCollapseState={setCollapseState}
            buildCollapsibleRows={buildHierarchyRows}
            columns={OPEX_TEMPLATE_COLUMNS}
            columnMap={opexColumnLabels}
            nonEditableColumns={opexNonEditableColumns}
            externalFilters={tableFilters}
            onFiltersChange={setTableFilters}
            allowDistinct={false}
            enableColumnDrag={false}
            layoutPreset="spreadsheet"
            showLogTrail={Boolean(tableId)}
            changeLogTableName="OpexTemplate"
            changeLogTitleLabel={
              tableName
                ? `Riwayat Perubahan Import OPEX: ${tableName}`
                : `Riwayat Perubahan Import OPEX - ${year}`
            }
            changeLogScopeTableName="PlanningDashboardTable"
            changeLogScopeEntityId={tableId}
            allowChangeLogNavigation={false}
            hideImport
            hideColumnYear
            hideExport={false}
            transferActions={importMergeToolbarAction}
            onRowsReplaced={(nextRows) => {
              setRows(Array.isArray(nextRows) ? nextRows : []);
            }}
          />
        </Col>
      )}
    </>
  );
};

export default OpexWorkspace;
