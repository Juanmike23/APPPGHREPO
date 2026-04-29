/*
 * PGH-DOC
 * File: src/Variables/Table/TableToolBar.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import {
  Input,
  Button,
  ButtonGroup,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormGroup,
  Label,
  UncontrolledTooltip,
} from "@pgh/ui-bootstrap";
import { Plus, Minus, Search, X } from "react-feather";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import FilterModal from "./TableToolBarElement/FilterModal";
import MandatoryInputModal from "./TableToolBarElement/MandatoryInputModal";
import { resolveTableTransferProfile } from "./tableTargetProfiles";
import { resolveTableColumnLabel } from "./columnLabels";
import {
  sanitizeSearchInput,
  SEARCH_INPUT_MAX_LENGTH,
} from "./filters/search";

const LazyExcelImport = React.lazy(() => import("./TableToolBarElement/Import"));
const LazyExportTable = React.lazy(() => import("./TableToolBarElement/ExportTable.jsx"));

const renderToolbarLazyFallback = (label) => (
  <Button color="light" size="sm" disabled>
    {label}
  </Button>
);

const SEARCH_SCOPE_ALL = "__all__";

const buildToolbarActionUrl = (baseUrl, actionPath) => {
  const raw = String(baseUrl || "").trim();
  if (!raw) return "";

  const [path, queryString = ""] = raw.split("?");
  const normalizedPath = path.replace(/\/$/, "");
  const normalizedAction = String(actionPath || "").replace(/^\/+/, "");
  const finalPath = normalizedPath.toLowerCase().endsWith(`/${normalizedAction.toLowerCase()}`)
    ? normalizedPath
    : `${normalizedPath}/${normalizedAction}`;

  return queryString ? `${finalPath}?${queryString}` : finalPath;
};

const TableToolbar = ({
  derivedColumns,
  searchTerm,
  appliedSearchTerm = "",
  setSearchTerm,
  searchScope = SEARCH_SCOPE_ALL,
  setSearchScope,
  searchScopeOptions = [],
  isReadOnly,
  canManageTable = true,
  editMode,
  setEditMode,
  apiUrl,
  tableData,
  setTableData,
  title,
  headerMap = null,
  selectedIds,
  setRefreshTrigger,
  tableRef,
  patchUrlBase,
  columns,
  filterColumns = columns,
  sortColumns = columns,
  rows,
  onApply,
  filters,
  sortedData,
  endpointName,
  setSelectedIds,
  YearImportValue,
  hideImport,
  hideExport,
  hasHighlight,
  hasDistinct,
  setSortedData,
  mandatoryValueOf,
  mandatorySuggestionValues,
  addColumnUrl,
  onRowCreated,
  onColumnCreated,
  resultCount = 0,
  activeFilterCount = 0,
  showRowCount = true,
  allowDistinct = true,
  allowColumnMutations = true,
  serverQueryEnabled = false,
  resetToDefaultView,
  clearToDefaultView,
  transferActions = null,
  supplementalActions = null,
  forceReloadAfterMutation = false,
  onMutationSuccess = null,
}) => {
  const effectiveBaseUrl = patchUrlBase || apiUrl;
  const transferProfile = React.useMemo(
    () =>
      resolveTableTransferProfile({
        endpointName,
        apiUrl: effectiveBaseUrl,
        checkApiUrl: true,
      }),
    [effectiveBaseUrl, endpointName],
  );
  const supportsGlobalImport = transferProfile.supportsGlobalImport !== false;
  const supportsGlobalExport = transferProfile.supportsGlobalExport !== false;
  const [mandatoryModalOpen, setMandatoryModalOpen] = React.useState(false);
  const [mandatoryInputValue, setMandatoryInputValue] = React.useState("");
  const [addColumnModalOpen, setAddColumnModalOpen] = React.useState(false);
  const [newColumnName, setNewColumnName] = React.useState("");
  const [deleteColumnModalOpen, setDeleteColumnModalOpen] = React.useState(false);
  const [deleteColumnName, setDeleteColumnName] = React.useState("");
  const [isAddingColumn, setIsAddingColumn] = React.useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = React.useState(null);
  const hasScopedSearch = searchScope !== SEARCH_SCOPE_ALL;
  const hasSearchQuery = Boolean(searchTerm?.trim());
  const hasAppliedSearchQuery = Boolean(appliedSearchTerm?.trim());
  const hasActiveSearch = hasAppliedSearchQuery;
  const normalizedActiveFilters = Array.isArray(filters?.filters)
    ? filters.filters.filter((filter) => {
        if (filter?.hidden) {
          return true;
        }

        const key = String(filter?.column || "").trim();
        const value = filter?.value;
        return key && value !== undefined && value !== null && String(value).trim() !== "";
      })
    : [];
  const visibleActiveFilters = normalizedActiveFilters.filter(
    (filter) => !filter?.hidden,
  );
  const hiddenActiveFilterLabels = Array.from(
    new Set(
      normalizedActiveFilters
        .filter((filter) => filter?.hidden)
        .map((filter) => String(filter?.displayLabel || "").trim())
        .filter(Boolean),
    ),
  );
  const hiddenActiveFilterCount = normalizedActiveFilters.length - visibleActiveFilters.length;
  const resolveColumnKey = (column) => {
    if (!column) return "";
    if (typeof column === "string") return column;
    return String(column.key || column.accessor || column.Header || "").trim();
  };
  const resolveColumnLabel = (columnKey) => {
    if (!columnKey) return "";

    const sources = [sortColumns, filterColumns, derivedColumns, columns];
    for (const source of sources) {
      if (!Array.isArray(source)) continue;
      const match = source.find((column) => resolveColumnKey(column) === columnKey);
      if (!match) continue;
      return resolveTableColumnLabel(match, headerMap);
    }

    return resolveTableColumnLabel(columnKey, headerMap);
  };
  const visibleColumnOptions = Array.isArray(filterColumns) && filterColumns.length > 0
    ? filterColumns
    : columns;
  const totalVisibleColumnCount = Array.from(
    new Set(
      (Array.isArray(visibleColumnOptions) ? visibleColumnOptions : [])
        .map((column) => resolveColumnKey(column))
        .filter((columnKey) => columnKey && columnKey.toLowerCase() !== "id"),
    ),
  ).length;
  const activeVisibleColumnCount = Array.from(
    new Set(
      (Array.isArray(filters?.visibleColumns) ? filters.visibleColumns : [])
        .map((column) => resolveColumnKey(column))
        .filter(Boolean),
    ),
  ).length;
  const activeVisibleColumnsLabel =
    activeVisibleColumnCount > 0
      ? `Visible columns: ${activeVisibleColumnCount}/${totalVisibleColumnCount || activeVisibleColumnCount}`
      : "";
  const activeSearchScopeLabel =
    searchScope === SEARCH_SCOPE_ALL
      ? "All visible columns"
      : searchScopeOptions.find((option) => option.key === searchScope)?.label ||
        resolveColumnLabel(searchScope) ||
        searchScope;
  const activeSortColumnKey = String(filters?.sort?.column || "").trim();
  const activeDistinctColumnKey = String(filters?.distinct?.column || "").trim();
  const activeSortDirection = String(filters?.sort?.direction || "asc").toLowerCase();
  const activeSortLabel = (() => {
    if (!activeSortColumnKey) return "";

    const label = resolveColumnLabel(activeSortColumnKey);
    const isTimeBased =
      activeSortColumnKey === "CreatedAt" || activeSortColumnKey === "UpdatedAt";
    if (isTimeBased) {
      return `${label}: ${activeSortDirection === "desc" ? "Data terbaru" : "Data terlama"}`;
    }

    return `${label}: ${activeSortDirection === "desc" ? "Descending" : "Ascending"}`;
  })();
  const activeDistinctLabel = activeDistinctColumnKey
    ? resolveColumnLabel(activeDistinctColumnKey)
    : "";
  const formatBadgeValue = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return text.length > 28 ? `${text.slice(0, 28)}...` : text;
  };
  const activeFilterLabels = visibleActiveFilters.map((filter, index) => {
    const customLabel = String(filter?.displayLabel || "").trim();
    if (customLabel) {
      return {
        id: `system-label-${index}-${customLabel}`,
        text: customLabel,
      };
    }

    const key = String(filter.column || "").trim();
    const operator = String(filter.operator || "=").trim();
    const value = formatBadgeValue(filter.value);
    const label = resolveColumnLabel(key);
    return {
      id: `${key}-${operator}-${value}-${index}`,
      text: `Filter: ${label} ${operator} ${value}`,
    };
  });
  const filterModeLabel =
    visibleActiveFilters.length > 1 && String(filters?.mode || "and").toLowerCase() === "or"
      ? "Mode: OR"
      : "";
  const hasActiveToolbarState =
    hasActiveSearch ||
    activeFilterLabels.length > 0 ||
    hiddenActiveFilterCount > 0 ||
    Boolean(activeVisibleColumnsLabel) ||
    Boolean(filterModeLabel) ||
    Boolean(activeSortLabel) ||
    Boolean(activeDistinctLabel);
  const fallbackViewWasCustomized =
    hasSearchQuery ||
    hasScopedSearch ||
    normalizedActiveFilters.length > 0 ||
    Boolean(filters?.sort?.column) ||
    Boolean(filters?.distinct?.column) ||
    (Array.isArray(filters?.visibleColumns) && filters.visibleColumns.length > 0);

  const clearActiveBadges = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (typeof clearToDefaultView === "function") {
      return clearToDefaultView();
    }

    if (typeof resetToDefaultView === "function") {
      return resetToDefaultView();
    }

    onApply?.({
      filters: [],
      mode: "and",
      sort: null,
      visibleColumns: null,
      distinct: null,
      clearHighlight: true,
    });

    setSearchTerm?.("");
    setSearchScope?.(SEARCH_SCOPE_ALL);
    setSelectedIds?.([]);
  };

  const resetViewToDefaultForCreate = () => {
    if (typeof resetToDefaultView === "function") {
      return resetToDefaultView();
    }

    onApply?.({
      filters: [],
      mode: "and",
      sort: null,
      visibleColumns: null,
      distinct: null,
      clearHighlight: true,
    });

    setSearchTerm?.("");
    setSearchScope?.(SEARCH_SCOPE_ALL);
    setSelectedIds?.([]);

    return fallbackViewWasCustomized;
  };

  const resetViewToDefaultForNewColumn = (columnKey) => {
    if (typeof resetToDefaultView === "function") {
      return resetToDefaultView({ ensureVisibleColumn: columnKey });
    }

    return resetViewToDefaultForCreate();
  };

  const normalizeCol = (value) =>
    value.toString().trim().toLowerCase().replace(/\s+/g, "_");

  const normalizeFetchedRows = (fetchedRows) =>
    (Array.isArray(fetchedRows) ? fetchedRows : []).map((row) => {
      const { Id, id, ID, ...rest } = row || {};
      return {
        Id: Id ?? id ?? ID ?? null,
        ...rest,
      };
    });

  const openDeleteConfirm = React.useCallback(
    ({ title = "Delete", message, onConfirm, confirmLabel = "Delete" }) => {
      setDeleteConfirmState({
        title,
        message,
        onConfirm,
        confirmLabel,
        submitting: false,
      });
    },
    [],
  );

  const closeDeleteConfirm = React.useCallback(() => {
    setDeleteConfirmState((current) =>
      current?.submitting ? current : null,
    );
  }, []);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteConfirmState?.onConfirm || deleteConfirmState?.submitting) {
      return;
    }

    setDeleteConfirmState((current) =>
      current ? { ...current, submitting: true } : current,
    );

    try {
      await deleteConfirmState.onConfirm();
      setDeleteConfirmState(null);
    } catch (error) {
      console.error("Delete action failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Delete failed",
      );
      setDeleteConfirmState((current) =>
        current ? { ...current, submitting: false } : current,
      );
    }
  }, [deleteConfirmState]);

  const handleDeleteColumnRequest = React.useCallback(async () => {
    const input = deleteColumnName.trim();
    if (!input) {
      toast.warning("Column name is required.");
      return;
    }

    const normalizedInput = normalizeCol(input);
    const columnMap = {};

    (derivedColumns || columns || []).forEach((column) => {
      columnMap[normalizeCol(column)] = column;
    });

    const realColumnName = columnMap[normalizedInput];

    if (!realColumnName) {
      toast.error(`Column "${input}" not found`);
      return;
    }

    setDeleteColumnModalOpen(false);
    setDeleteColumnName("");

    openDeleteConfirm({
      message: `Delete column "${realColumnName}" from ALL rows?`,
      onConfirm: async () => {
        const urlBase = addColumnUrl?.trim() ? addColumnUrl : apiUrl;

        const res = await fetch(
          buildToolbarActionUrl(
            urlBase,
            `extra/bulk/${encodeURIComponent(realColumnName)}`,
          ),
          {
            method: "DELETE",
            credentials: "include",
          },
        );

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const fetchedRows = await fetch(apiUrl, {
          credentials: "include",
        }).then((response) => response.json());

        const normalizedRows = normalizeFetchedRows(fetchedRows);
        setTableData(normalizedRows);
        setSortedData?.(normalizedRows);
        toast.success(`Column "${realColumnName}" deleted`);
      },
    });
  }, [
    addColumnUrl,
    apiUrl,
    columns,
    deleteColumnName,
    derivedColumns,
    openDeleteConfirm,
    setSortedData,
    setTableData,
  ]);

  const extractExtraDataKeys = (row) => {
    const rawExtraData = row?.ExtraData;
    if (!rawExtraData) return [];

    try {
      const parsed =
        typeof rawExtraData === "string" ? JSON.parse(rawExtraData) : rawExtraData;

      return parsed && typeof parsed === "object"
        ? Object.keys(parsed).filter((key) => !String(key ?? "").startsWith("__"))
        : [];
    } catch {
      return [];
    }
  };

  const resolveAddedColumnName = (fetchedRows, requestedName) => {
    const normalizedRequested = normalizeCol(requestedName);
    const discoveredKeys = new Set();

    (Array.isArray(fetchedRows) ? fetchedRows : []).forEach((row) => {
      Object.keys(row || {}).forEach((key) => {
        if (!["Id", "id", "ID", "ExtraData"].includes(key)) {
          discoveredKeys.add(key);
        }
      });

      extractExtraDataKeys(row).forEach((key) => discoveredKeys.add(key));
    });

    return (
      Array.from(discoveredKeys).find(
        (columnKey) => normalizeCol(columnKey) === normalizedRequested,
      ) || requestedName
    );
  };

  const handleAddRow = async () => {
    if (!canManageTable) return;

    if (mandatoryValueOf && !mandatoryInputValue) {
      setMandatoryModalOpen(true);
      return;
    }

    if (!apiUrl) return;

    try {
      let url = apiUrl;

      if (mandatoryValueOf) {
        url += `/${encodeURIComponent(mandatoryInputValue)}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error(await res.text());

      const newRow = await res.json();
      const normalizedRow = {
        ...newRow,
        Id: newRow.Id ?? newRow.id ?? newRow.ID,
        ...(mandatoryValueOf
          ? { [mandatoryValueOf]: mandatoryInputValue }
          : {}),
      };

      const viewWasReset = resetViewToDefaultForCreate();
      setMandatoryInputValue("");
      if (serverQueryEnabled || forceReloadAfterMutation) {
        onRowCreated?.(normalizedRow);
        setRefreshTrigger?.((prev) => prev + 1);
      } else {
        setTableData((prev) => [normalizedRow, ...prev]);
        setSortedData?.((prev) => [normalizedRow, ...prev]);
        onRowCreated?.(normalizedRow);
      }
      onMutationSuccess?.();

      toast.success(
        viewWasReset
          ? "New row added. View reset to default so the latest row is visible."
          : "New row added!",
      );
    } catch (err) {
      console.error("Add row failed:", err);
      toast.error("Action failed - please try again");
    }
  };

  const handleDeleteSelected = () => {
    if (!canManageTable) return;

    if (!selectedIds.length) {
      toast.warning("No rows selected");
      return;
    }

    if (!effectiveBaseUrl) {
      toast.error("Missing API URL");
      return;
    }

    const count = selectedIds.length;
    const label = count === 1 ? "row" : "rows";

    openDeleteConfirm({
      message: `Delete ${count} ${label}?`,
      onConfirm: async () => {
        const targetIds = [...selectedIds];
        const res = await fetch(buildToolbarActionUrl(effectiveBaseUrl, "bulk-delete"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(targetIds),
        });

        if (res.status === 403) {
          throw new Error("You don't have access to Delete Row");
        }

        if (!res.ok) {
          throw new Error(await res.text());
        }

        if (serverQueryEnabled || forceReloadAfterMutation) {
          setRefreshTrigger?.((prev) => prev + 1);
        } else {
          setTableData((prev) => prev.filter((row) => !targetIds.includes(row.Id)));
          setSortedData?.((prev) => prev.filter((row) => !targetIds.includes(row.Id)));
        }
        onMutationSuccess?.();
        setSelectedIds?.([]);

        toast.success(`${count} ${label} deleted`);
      },
    });
  };

  const handleAddColumn = async (rawColumnName = newColumnName) => {
    if (!apiUrl) return;

    const columnName = rawColumnName.trim();
    if (!columnName) {
      toast.warning("Column name is required");
      return;
    }

    const normalized = normalizeCol(columnName);
    const existingCols = (derivedColumns || columns || []).map((column) =>
      normalizeCol(column),
    );

    if (existingCols.includes(normalized)) {
      toast.error(`Column "${columnName}" already exists`);
      return;
    }

    try {
      setIsAddingColumn(true);

      const url = addColumnUrl?.trim()
        ? buildToolbarActionUrl(addColumnUrl, "extra/bulk")
        : buildToolbarActionUrl(apiUrl, "extra/bulk");

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [columnName]: "" }),
      });

      if (!res.ok) throw new Error(await res.text());

      let actualColumnName = columnName;

      if (serverQueryEnabled || forceReloadAfterMutation) {
        setRefreshTrigger?.((prev) => prev + 1);
      } else {
        const fetchedRows = await fetch(apiUrl, {
          credentials: "include",
        }).then((response) => response.json());

        const normalizedRows = normalizeFetchedRows(fetchedRows);
        actualColumnName = resolveAddedColumnName(fetchedRows, columnName);

        setTableData(normalizedRows);
        setSortedData?.(normalizedRows);
      }
      onMutationSuccess?.();

      const viewWasReset = resetViewToDefaultForNewColumn(actualColumnName);
      onColumnCreated?.(actualColumnName);
      setNewColumnName("");
      setAddColumnModalOpen(false);
      toast.success(
        viewWasReset
          ? `Column "${actualColumnName}" added. View reset to default so the change is visible.`
          : `Column "${actualColumnName}" added`,
      );
    } catch (err) {
      console.error("Add column failed:", err);
      toast.error("Failed to add column");
    } finally {
      setIsAddingColumn(false);
    }
  };

  return (
    <>
      <div className="table-toolbar-shell">
        <div className="table-toolbar-topbar">
          <div className="table-toolbar-meta">
            {showRowCount && (
              <span className="table-toolbar-pill table-toolbar-pill--results">
                Total data: {resultCount}
              </span>
            )}

            {hasActiveSearch && (
              <span className="table-toolbar-pill table-toolbar-pill--search table-toolbar-pill--pulse">
                Search from: {activeSearchScopeLabel}
              </span>
            )}

            {activeFilterLabels.map((item) => (
              <span
                key={item.id}
                className="table-toolbar-pill table-toolbar-pill--filter table-toolbar-pill--pulse"
              >
                {item.text}
              </span>
            ))}

            {hiddenActiveFilterLabels.map((label, index) => (
              <span
                key={`hidden-filter-${index}-${label}`}
                className="table-toolbar-pill table-toolbar-pill--filter table-toolbar-pill--pulse"
              >
                {label}
              </span>
            ))}

            {filterModeLabel && (
              <span className="table-toolbar-pill table-toolbar-pill--filter table-toolbar-pill--pulse">
                {filterModeLabel}
              </span>
            )}

            {activeVisibleColumnsLabel && (
              <span className="table-toolbar-pill table-toolbar-pill--filter table-toolbar-pill--pulse">
                {activeVisibleColumnsLabel}
              </span>
            )}

            {activeSortLabel && (
              <span className="table-toolbar-pill table-toolbar-pill--filter table-toolbar-pill--pulse">
                Sort: {activeSortLabel}
              </span>
            )}

            {activeDistinctLabel && (
              <span className="table-toolbar-pill table-toolbar-pill--filter table-toolbar-pill--pulse">
                Distinct: {activeDistinctLabel}
              </span>
            )}

            {hasActiveToolbarState && (
              <Button
                type="button"
                color="light"
                className="table-toolbar-clear"
                onClick={clearActiveBadges}
                title="Clear active badges"
              >
                <X size={14} className="me-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="table-toolbar-main">
          <div className="table-toolbar-search-group">
            {setSearchScope && searchScopeOptions.length > 0 && (
              <Input
                type="select"
                value={searchScope}
                onChange={(event) => setSearchScope(event.target.value)}
                className="table-toolbar-scope"
                title="Search scope"
              >
                <option value={SEARCH_SCOPE_ALL}>All visible columns</option>
                {searchScopeOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </Input>
            )}

            <div className="table-toolbar-search-inline">
              <div className="search-wrapper table-toolbar-search">
                <Search className="search-icon" size={16} />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  maxLength={SEARCH_INPUT_MAX_LENGTH}
                  onChange={(event) =>
                    setSearchTerm(sanitizeSearchInput(event.target.value))
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;

                    if (searchTerm) {
                      event.preventDefault();
                      setSearchTerm("");
                      return;
                    }

                    if (searchScope !== SEARCH_SCOPE_ALL && setSearchScope) {
                      event.preventDefault();
                      setSearchScope(SEARCH_SCOPE_ALL);
                    }
                  }}
                  className="search-input"
                />
              </div>
            </div>
          </div>

          <div className="table-toolbar-actions">
            {canManageTable && (
              <i
                className={`icon-pencil table-toolbar-icon-button ${
                  editMode
                    ? "edit-flash table-toolbar-icon-button--active"
                    : "table-toolbar-icon-button--idle"
                }`}
                onClick={() => setEditMode(!editMode)}
                title={editMode ? "Exit Edit Mode" : "Enter Edit Mode"}
              ></i>
            )}

            {!editMode ? transferActions : null}

            {!editMode && !isReadOnly && !hideImport && supportsGlobalImport && (
              <React.Suspense fallback={renderToolbarLazyFallback("Import")}>
                <LazyExcelImport
                  apiUrl={apiUrl}
                  endpointName={endpointName}
                  onImported={() => setRefreshTrigger?.((prev) => prev + 1)}
                  YearImportValue={YearImportValue}
                />
              </React.Suspense>
            )}

            {!editMode && !hideExport && supportsGlobalExport && (
              <React.Suspense fallback={renderToolbarLazyFallback("Export")}>
                <LazyExportTable
                  data={sortedData}
                  fileName={title}
                  tableRef={tableRef}
                  exportColumns={derivedColumns}
                  headerMap={headerMap}
                  apiUrl={apiUrl}
                  endpointName={endpointName}
                  filters={filters}
                  searchTerm={appliedSearchTerm}
                  searchScope={searchScope}
                />
              </React.Suspense>
            )}

            {canManageTable && editMode && (
              <div className="table-toolbar-edit-actions">
                {allowColumnMutations && (
                <ButtonGroup className="align-items-center">
                  <Button
                    size="sm"
                    color=""
                    title="Delete Column"
                    className=" px-2 disabled"
                  >
                    Column
                  </Button>

                  <Button
                    id="btn-del-col"
                    size="sm"
                    color="danger"
                    title="Delete Column"
                    className=" px-2"
                    onClick={() => {
                      setDeleteColumnName("");
                      setDeleteColumnModalOpen(true);
                    }}
                  >
                    <Minus size={12} className="me-1 " />
                  </Button>
                  <UncontrolledTooltip placement="top" target="btn-del-col">
                    Delete a column
                  </UncontrolledTooltip>

                  <Button
                    id="btn-add-col"
                    size="sm"
                    color="success"
                    title="Add Column"
                    className=" px-2"
                    onClick={() => {
                      setNewColumnName("");
                      setAddColumnModalOpen(true);
                    }}
                  >
                    <Plus size={12} className="me-1" />
                  </Button>
                  <UncontrolledTooltip placement="top" target="btn-add-col">
                    Add a new column
                  </UncontrolledTooltip>
                </ButtonGroup>
                )}

                <ButtonGroup>
                  <Button
                    id="btn-add-row"
                    size="sm"
                    color=""
                    title="Delete Column"
                    className=" px-2 disabled"
                  >
                    Row
                  </Button>
                  <UncontrolledTooltip placement="top" target="btn-add-row">
                    Add a new row
                  </UncontrolledTooltip>

                  <Button
                    id="btn-del-row"
                    size="sm"
                    color="danger"
                    title="Delete Selected Rows"
                    className=" px-2"
                    disabled={selectedIds.length === 0}
                    onClick={handleDeleteSelected}
                  >
                    <Minus size={12} className="me-1" />
                  </Button>
                  <UncontrolledTooltip placement="top" target="btn-del-row">
                    Delete selected rows
                  </UncontrolledTooltip>

                  <Button
                    id="btn-add-row-action"
                    size="sm"
                    color="success"
                    title="Add Row"
                    className=" px-2"
                    onClick={handleAddRow}
                  >
                    <Plus size={12} className="me-1" />
                  </Button>
                  <UncontrolledTooltip placement="top" target="btn-add-row-action">
                    Add a new row
                  </UncontrolledTooltip>
                </ButtonGroup>
              </div>
            )}

            <FilterModal
              columns={columns}
              filterColumns={filterColumns}
              sortColumns={sortColumns}
              rows={rows}
              headerMap={headerMap}
              onApply={onApply}
              externalFilters={filters}
              hasHighlight={hasHighlight}
              hasDistinct={hasDistinct}
              allowDistinct={allowDistinct}
            />

            {supplementalActions}
          </div>
        </div>

      </div>

      <MandatoryInputModal
        isOpen={mandatoryModalOpen}
        mandatoryColumn={mandatoryValueOf}
        suggestionValues={mandatorySuggestionValues}
        value={mandatoryInputValue}
        onChange={setMandatoryInputValue}
        onSubmit={() => {
          setMandatoryModalOpen(false);
          handleAddRow();
        }}
        onCancel={() => setMandatoryModalOpen(false)}
      />

      {allowColumnMutations && (
        <Modal
          isOpen={addColumnModalOpen}
          toggle={() => {
            if (isAddingColumn) return;
            setAddColumnModalOpen((open) => !open);
          }}
          centered
        >
          <ModalHeader
            toggle={() => {
              if (isAddingColumn) return;
              setAddColumnModalOpen(false);
            }}
          >
            Add Column
          </ModalHeader>
          <ModalBody>
            <FormGroup className="mb-0">
              <Label for="new-column-name">Column name</Label>
              <Input
                id="new-column-name"
                type="text"
                value={newColumnName}
                onChange={(event) => setNewColumnName(event.target.value)}
                placeholder="Enter new column name"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddColumn();
                  }
                }}
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button
              color="secondary"
              onClick={() => setAddColumnModalOpen(false)}
              disabled={isAddingColumn}
            >
              Cancel
            </Button>
            <Button
              color="success"
              onClick={() => handleAddColumn()}
              disabled={isAddingColumn}
            >
              {isAddingColumn ? "Saving..." : "Add"}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {allowColumnMutations && (
        <Modal
          isOpen={deleteColumnModalOpen}
          toggle={() => setDeleteColumnModalOpen(false)}
          centered
        >
          <ModalHeader toggle={() => setDeleteColumnModalOpen(false)}>
            Delete Column
          </ModalHeader>
          <ModalBody>
            <FormGroup className="mb-0">
              <Label for="delete-column-name">Column name</Label>
              <Input
                id="delete-column-name"
                type="text"
                value={deleteColumnName}
                onChange={(event) => setDeleteColumnName(event.target.value)}
                placeholder="Enter column name to delete"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleDeleteColumnRequest();
                  }
                }}
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button
              color="secondary"
              onClick={() => setDeleteColumnModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onClick={handleDeleteColumnRequest}
            >
              Continue
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <Modal isOpen={Boolean(deleteConfirmState)} toggle={closeDeleteConfirm} centered>
        <ModalHeader toggle={closeDeleteConfirm}>
          {deleteConfirmState?.title || "Delete"}
        </ModalHeader>
        <ModalBody>
          <p className="mb-0">
            {deleteConfirmState?.message || "Delete selected data?"}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            color="light"
            onClick={closeDeleteConfirm}
            disabled={Boolean(deleteConfirmState?.submitting)}
          >
            Batal
          </Button>
          <Button
            color="danger"
            onClick={handleDeleteConfirm}
            disabled={Boolean(deleteConfirmState?.submitting)}
          >
            {deleteConfirmState?.submitting
              ? "Menghapus..."
              : deleteConfirmState?.confirmLabel || "Delete"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default TableToolbar;
