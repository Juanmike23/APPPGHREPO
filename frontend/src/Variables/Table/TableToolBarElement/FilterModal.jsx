/*
 * PGH-DOC
 * File: src/Variables/Table/TableToolBarElement/FilterModal.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
  Badge,
  Button,
  FormGroup,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@pgh/ui-bootstrap";
import "./NoCaretInput.scss";

import { Eye, Filter, Layers, Sliders } from "react-feather";
import { resolveTableColumnLabel } from "../columnLabels";

const OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "=", label: "Equals" },
  { value: "!=", label: "Not equal" },
  { value: "<", label: "Less than" },
  { value: "<=", label: "Less or equal" },
  { value: ">", label: "Greater than" },
  { value: ">=", label: "Greater or equal" },
];

const NON_CONTAINS_FILTER_COLUMNS = new Set(["TAHUN", "IN", "JATUHTEMPO"]);

const getNormalizedFilterColumnKey = (value) =>
  String(value ?? "").trim().toUpperCase();

const getColumnKey = (column) =>
  typeof (column?.key || column?.accessor || column) === "string"
    ? String(column.key || column.accessor || column).trim()
    : "";

const normalizeFilterColumnValue = (value) =>
  typeof (value?.key || value?.accessor || value) === "string"
    ? String(value.key || value.accessor || value).trim()
    : "";

const extractSuggestionValueTokens = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      extractSuggestionValueTokens(
        item && typeof item === "object" && "value" in item ? item.value : item,
      ),
    );
  }

  if (value instanceof Date) {
    return [value.toISOString()];
  }

  if (value === null || value === undefined) {
    return [""];
  }

  if (typeof value === "object") {
    if ("value" in value) {
      return extractSuggestionValueTokens(value.value);
    }

    if ("label" in value) {
      return [String(value.label ?? "")];
    }

    if ("title" in value) {
      return [String(value.title ?? "")];
    }

    return [];
  }

  return [String(value)];
};

const normalizeFilterValue = (value) => {
  const [firstToken = ""] = extractSuggestionValueTokens(value);
  return String(firstToken ?? "");
};

const getOperatorOptionsForColumn = (column) => {
  const normalizedColumn = getNormalizedFilterColumnKey(column);
  if (NON_CONTAINS_FILTER_COLUMNS.has(normalizedColumn)) {
    return OPERATORS.filter((operator) => operator.value !== "contains");
  }

  return OPERATORS;
};

const normalizeOperatorForColumn = (column, operator) => {
  const operatorOptions = getOperatorOptionsForColumn(column);
  const normalizedOperator = String(operator ?? "").trim();
  return operatorOptions.some((item) => item.value === normalizedOperator)
    ? normalizedOperator
    : "=";
};

const emptyFilter = { column: "", operator: "contains", value: "" };

const FilterModal = ({
  columns,
  filterColumns = columns,
  sortColumns = columns,
  rows,
  headerMap = null,
  onApply,
  externalFilters,
  hasHighlight,
  hasDistinct = false,
  allowDistinct = true,
  serverQueryEnabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState([emptyFilter]);
  const [activeIndex, setActiveIndex] = useState(null);
  const [filterMode, setFilterMode] = useState("and");
  const [isFiltered, setIsFiltered] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const dropdownRef = useRef(null);
  const isDarkMode =
    typeof document !== "undefined" &&
    document.body?.classList?.contains("dark-only");

  const validFilters = filters.filter(
    (filter) => filter.column && filter.value !== undefined,
  );
  const canHighlight = validFilters.length > 0;

  const [sort, setSort] = useState({
    column: "",
    direction: "asc",
  });

  const [distinct, setDistinct] = useState({
    enabled: true,
    column: "",
    aggregate: "count",
  });

  const distinctOptions = useMemo(
    () => (Array.isArray(filterColumns) ? filterColumns : []),
    [filterColumns],
  );
  const getColumnLabel = useCallback(
    (column) => resolveTableColumnLabel(column, headerMap),
    [headerMap],
  );
  const distinctActive = allowDistinct && distinct.enabled && !!distinct.column;
  const lockSortForDistinct = serverQueryEnabled && distinctActive;
  const isTimeBasedSort = ["CreatedAt", "UpdatedAt"].includes(sort.column);
  const noneSortLabel = serverQueryEnabled
    ? "Default: Data terbaru"
    : "None";
  const ascSortLabel = isTimeBasedSort ? "Data terlama" : "Ascending";
  const descSortLabel = isTimeBasedSort ? "Data terbaru" : "Descending";

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  const getAllColumnKeys = useCallback(
    () =>
      columns
        .map((column) => column?.key || column?.accessor || column)
        .filter((key) => typeof key === "string")
        .map((key) => key.trim())
        .filter((key) => key !== "" && key.toLowerCase() !== "id"),
    [columns],
  );

  const getSuggestions = (index) => {
    const filter = filters[index];
    if (!filter?.column) return [];

    const uniqueValues = new Map();

    rows.forEach((row) => {
      if (row?.__isTotalRow) {
        return;
      }

      extractSuggestionValueTokens(row?.[filter.column]).forEach((rawValue) => {
        const normalizedValue = String(rawValue ?? "");
        if (!uniqueValues.has(normalizedValue)) {
          uniqueValues.set(normalizedValue, normalizedValue);
        }
      });
    });

    const values = Array.from(uniqueValues.values());
    if (!filter.value) {
      return values;
    }

    return values.filter((value) =>
      value.toLowerCase().includes(String(filter.value ?? "").toLowerCase()),
    );
  };

  const allKeys = getAllColumnKeys();
  const allActive = visibleColumns.length === allKeys.length;

  const highlightOnly = () => {
    if (!validFilters.length) {
      toast.error("Add at least 1 filter first");
      return;
    }

    onApply({
      filters: validFilters,
      mode: filterMode,
      highlightOnly: true,
    });

    closeModal();
  };

  useEffect(() => {
    if (!open) return;

    const editableExternalFilters = Array.isArray(externalFilters?.filters)
      ? externalFilters.filters.filter((filter) => !filter?.hidden)
      : [];

    if (editableExternalFilters.length) {
      setFilters(
        editableExternalFilters.map((filter) => {
          const normalizedColumn = normalizeFilterColumnValue(filter?.column);
          return {
            column: normalizedColumn,
            operator: normalizeOperatorForColumn(
              normalizedColumn,
              filter?.operator,
            ),
            value: normalizeFilterValue(filter?.value),
            ...(filter?.hidden ? { hidden: true } : {}),
            ...(filter?.displayLabel
              ? { displayLabel: String(filter.displayLabel) }
              : {}),
          };
        }),
      );
      setFilterMode(externalFilters.mode || "and");
    } else {
      setFilters([emptyFilter]);
      setFilterMode("and");
    }

    if (externalFilters?.visibleColumns?.length) {
      setVisibleColumns(externalFilters.visibleColumns);
    } else {
      setVisibleColumns(getAllColumnKeys());
    }

    if (externalFilters?.sort) {
      setSort(externalFilters.sort);
    } else {
      setSort({ column: "", direction: "asc" });
    }

    if (externalFilters?.distinct) {
      setDistinct({
        enabled: true,
        column: normalizeFilterColumnValue(externalFilters.distinct.column),
        aggregate: externalFilters.distinct.aggregate || "count",
      });
    } else {
      setDistinct({
        enabled: true,
        column: "",
        aggregate: "count",
      });
    }
  }, [externalFilters, getAllColumnKeys, open]);

  useEffect(() => {
    const hasFilters = externalFilters?.filters?.length > 0;
    const hasSort = !!externalFilters?.sort?.column;
    const hasColumns =
      Array.isArray(externalFilters?.visibleColumns) &&
      externalFilters.visibleColumns.length < getAllColumnKeys().length;

    const hasDistinctFilter =
      allowDistinct &&
      (hasDistinct ||
        !!externalFilters?.distinct?.column ||
        (distinct.enabled && distinct.column));

    setIsFiltered(
      hasFilters || hasSort || hasColumns || hasHighlight || hasDistinctFilter,
    );
  }, [
    allowDistinct,
    distinct,
    externalFilters,
    getAllColumnKeys,
    hasDistinct,
    hasHighlight,
  ]);

  useEffect(() => {
    const close = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveIndex(null);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleChange = (index, key, value) => {
    setFilters((previous) =>
      previous.map((filter, itemIndex) =>
        itemIndex === index
          ? key === "column"
            ? {
                ...filter,
                column: value,
                operator: normalizeOperatorForColumn(value, filter?.operator),
              }
            : {
                ...filter,
                [key]:
                  key === "operator"
                    ? normalizeOperatorForColumn(filter?.column, value)
                    : value,
              }
          : filter,
      ),
    );
  };

  const addFilter = () => setFilters((previous) => [...previous, emptyFilter]);

  const removeFilter = (index) => {
    setFilters((previous) =>
      previous.length === 1
        ? [emptyFilter]
        : previous.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const apply = () => {
    if (visibleColumns.length === 0) {
      toast.error("At least 1 column must be visible");
      return;
    }

    const valid = filters
      .filter((filter) => filter.column && filter.value !== undefined)
      .map((filter) => ({
        ...filter,
        operator: normalizeOperatorForColumn(filter.column, filter.operator),
      }));
    const isAllSelected = visibleColumns.length === allKeys.length;

    onApply({
      filters: valid,
      mode: filterMode,
      sort: lockSortForDistinct ? null : sort.column ? sort : null,
      visibleColumns: isAllSelected ? null : visibleColumns,
      distinct:
        distinctActive
          ? {
              column: distinct.column,
              aggregate: distinct.aggregate,
              label: "Total",
            }
          : null,
    });

    setIsFiltered(
      valid.length > 0 ||
        !!(!lockSortForDistinct && sort.column) ||
        !isAllSelected ||
        distinctActive,
    );
    closeModal();
  };

  const clearAll = () => {
    setFilters([emptyFilter]);
    setFilterMode("and");
    setSort({ column: "", direction: "asc" });
    setVisibleColumns(getAllColumnKeys());
    setDistinct({
      enabled: true,
      column: "",
      aggregate: "count",
    });
    setIsFiltered(false);

    onApply({
      filters: [],
      mode: "and",
      sort: null,
      visibleColumns: null,
      distinct: null,
      clearHighlight: true,
    });

    closeModal();
  };

  return (
    <>
      <i
        className={`icon-filter table-toolbar-icon-button ${
          isFiltered
            ? "table-toolbar-icon-button--active"
            : "table-toolbar-icon-button--idle"
        }`}
        onClick={openModal}
        title={"Filter Table"}
      />

      <Modal
        isOpen={open}
        toggle={closeModal}
        size="lg"
        className="table-utility-modal"
        backdropClassName="table-utility-backdrop"
        zIndex={1400}
      >
        <ModalHeader toggle={closeModal}>Filter Table</ModalHeader>

        <ModalBody>
          <div className="filter-segment segmented">
            <span className="segment-border-title d-flex align-items-center gap-2">
              <Sliders size={14} /> Sort By
            </span>

            <div className="d-flex gap-3 mt-2">
              <Input
                type="select"
                className="flex-grow-1 no-caret"
                value={sort.column}
                onChange={(event) =>
                  setSort((state) => {
                    const nextColumn = event.target.value;
                    const nextDirection =
                      nextColumn === "CreatedAt" || nextColumn === "UpdatedAt"
                        ? "desc"
                        : state.direction;

                    return {
                      ...state,
                      column: nextColumn,
                      direction: nextDirection,
                    };
                  })
                }
                disabled={lockSortForDistinct}
              >
                <option value="">{noneSortLabel}</option>
                {sortColumns.map((column, index) => {
                  const key =
                    typeof (column?.key || column?.accessor || column) === "string"
                      ? column.key || column.accessor || column
                      : "";
                  const label = getColumnLabel(column);

                  return (
                    <option key={index} value={key}>
                      {label}
                    </option>
                  );
                })}
              </Input>

              <Input
                type="select"
                value={sort.direction}
                disabled={!sort.column || lockSortForDistinct}
                onChange={(event) =>
                  setSort((state) => ({
                    ...state,
                    direction: event.target.value,
                  }))
                }
                style={{ width: 160 }}
              >
                <option value="asc">{ascSortLabel}</option>
                <option value="desc">{descSortLabel}</option>
              </Input>
            </div>
            {lockSortForDistinct && (
              <small className="text-muted d-block mt-2">
                Distinct Audit memakai urutan grup yang konsisten. Nonaktifkan
                Distinct untuk memakai Sort By.
              </small>
            )}
          </div>

          {allowDistinct && (
            <div
              className={`
                filter-segment segmented segmented--expand
                ${distinct.enabled ? "is-open" : "is-closed"}
              `}
            >
              <span
                className="segment-border-title d-flex align-items-center gap-2 pill-toggle"
                role="button"
                onClick={() =>
                  setDistinct((state) => {
                    const nextEnabled = !state.enabled;
                    if (serverQueryEnabled && nextEnabled) {
                      setSort({ column: "", direction: "asc" });
                    }

                    return {
                      ...state,
                      enabled: nextEnabled,
                      column: state.enabled ? "" : state.column,
                    };
                  })
                }
                style={{
                  cursor: "pointer",
                  opacity: distinct.enabled ? 1 : 0.6,
                }}
              >
                <Layers size={14} /> Distinct
              </span>

              {distinct.enabled && (
                <div className="d-flex gap-2 mt-2">
                  <Input
                    type="select"
                    value={distinct.column}
                    onChange={(event) =>
                      setDistinct((state) => {
                        if (serverQueryEnabled) {
                          setSort({ column: "", direction: "asc" });
                        }

                        return {
                          ...state,
                          column: event.target.value,
                        };
                      })
                    }
                  >
                    <option value="">Select column</option>
                    {distinctOptions.map((column, index) => {
                      const key = column.key || column.accessor || column;
                      const label = getColumnLabel(column);

                      return (
                        <option key={index} value={key}>
                          {label}
                        </option>
                      );
                    })}
                  </Input>
                </div>
              )}
            </div>
          )}

          <div className="filter-segment segmented">
            <span className="segment-border-title d-flex align-items-center gap-2">
              <Filter size={14} /> Filters
            </span>

            {filters.length > 1 && (
              <>
                <span
                  className="segment-border-title segment-border-right pill-toggle d-flex align-items-center gap-2"
                  onClick={() => setFilterMode("and")}
                  style={{
                    opacity: filterMode === "and" ? 1 : 0.5,
                  }}
                >
                  True for all
                </span>

                <span
                  className="segment-border-title segment-border-right pill-toggle d-flex align-items-center gap-2"
                  style={{
                    right: "120px",
                    opacity: filterMode === "or" ? 1 : 0.5,
                  }}
                  onClick={() => setFilterMode("or")}
                >
                  True for at least one
                </span>
              </>
            )}

            {filters.map((filter, index) => {
              const operatorOptions = getOperatorOptionsForColumn(filter.column);
              const selectedOperator = normalizeOperatorForColumn(
                filter.column,
                filter.operator,
              );
              const suggestionOptions = getSuggestions(index);

              return (
                <FormGroup row key={index} className="align-items-end mt-2">
                <div className="col-md-4 position-relative">
                  <Input
                    type="select"
                    className="no-caret"
                    value={filter.column}
                    onChange={(event) =>
                      handleChange(index, "column", event.target.value)
                    }
                  >
                    <option value="">Select column</option>
                    {filterColumns.map((column, itemIndex) => {
                      const key = getColumnKey(column);
                      const label = getColumnLabel(column);
                      return (
                        <option key={`${key}-${itemIndex}`} value={key}>
                          {label}
                        </option>
                      );
                    })}
                  </Input>
                </div>

                <div className="col-md-2">
                  <Input
                    type="select"
                    className="no-caret text-center"
                    value={selectedOperator}
                    disabled={!filter.column}
                    onChange={(event) =>
                      handleChange(index, "operator", event.target.value)
                    }
                  >
                    {operatorOptions.map((operator) => (
                      <option key={operator.value} value={operator.value}>
                        {operator.label}
                      </option>
                    ))}
                  </Input>
                </div>

                <div className="col-md-4 position-relative">
                  <>
                    <Input
                      value={filter.value}
                      placeholder={filter.column ? "Type value" : "Value"}
                      disabled={!filter.column}
                      onFocus={() => setActiveIndex(index)}
                      onChange={(event) =>
                        handleChange(index, "value", event.target.value)
                      }
                    />
                    {activeIndex === index && suggestionOptions.length > 0 && (
                  <ul
                    ref={dropdownRef}
                    className="list-group position-absolute w-100 filter-dropdown"
                    style={{
                      background: isDarkMode ? "#1e1e2d" : "#f8f9fa",
                      borderRadius: "8px",
                      border: isDarkMode ? "1px solid #444a57" : "1px solid #dee2e6",
                      marginTop: "8px",
                      maxHeight: "220px",
                      overflowY: "auto",
                      padding: "4px",
                      zIndex: 20,
                    }}
                  >
                    {suggestionOptions.map((value, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="list-group-item list-group-item-action"
                        style={{
                          background: isDarkMode ? "#1e1e2d" : "#ffffff",
                          color: isDarkMode ? "#e2e8f0" : "inherit",
                          borderColor: isDarkMode ? "#2c3442" : "#dee2e6",
                        }}
                        onClick={() => {
                          handleChange(index, "value", value);
                          setActiveIndex(null);
                        }}
                      >
                        {value === "" ? <em>(Empty)</em> : String(value)}
                      </li>
                    ))}
                  </ul>
                    )}
                  </>
                </div>

                <div className="col-md-2 text-end d-flex gap-2 justify-content-end">
                  <Button
                    color={filter.column ? "warning" : "info"}
                    size="xsm"
                    disabled={!canHighlight}
                    onClick={highlightOnly}
                    title={
                      !canHighlight
                        ? "Add at least one filter first"
                        : "Highlight first matched"
                    }
                    style={{
                      fontWeight: 600,
                      margin: 0,
                      paddingLeft: 10,
                      paddingRight: 10,
                      cursor: filter.column ? "pointer" : "not-allowed",
                    }}
                  >
                    <Eye size={14} color="white" />
                  </Button>

                  <Button
                    color={filter.column ? "danger" : "info"}
                    size="xsm"
                    onClick={() => removeFilter(index)}
                    style={{
                      margin: 0,
                      paddingLeft: 12,
                      paddingRight: 12,
                      cursor: filter.column ? "pointer" : "not-allowed",
                    }}
                    title="Remove this Filter"
                  >
                    x
                  </Button>
                </div>
                </FormGroup>
              );
            })}

            <Button
              color="outline-primary"
              className="w-100 mt-2"
              onClick={addFilter}
            >
              + Add Filter
            </Button>
          </div>

          <div className="filter-segment segmented">
            <span className="segment-border-title d-flex align-items-center gap-2">
              <Eye size={14} /> Visible Columns
            </span>

            <span
              className="segment-border-title segment-border-right d-flex align-items-center gap-2 pill-toggle"
              onClick={() => setVisibleColumns(allActive ? [] : allKeys)}
            >
              {allActive ? "Hide All" : "Unhide All"}
            </span>

            <div className="d-flex flex-wrap gap-2 mt-2">
              {columns
                .filter((column) => {
                  const key = column?.key || column?.accessor || column;
                  if (typeof key !== "string") return false;
                  const normalized = key.trim();
                  return normalized !== "" && normalized.toLowerCase() !== "id";
                })
                .map((column) => {
                  const key =
                    typeof (column?.key || column?.accessor || column) === "string"
                      ? column.key || column.accessor || column
                      : "";
                  const label = getColumnLabel(column);
                  const active = visibleColumns.includes(key);

                  return (
                    <Badge
                      key={key}
                      pill
                      role="button"
                      color={active ? "primary" : "info"}
                      onClick={() =>
                        setVisibleColumns((previous) =>
                          active
                            ? previous.filter((value) => value !== key)
                            : [...previous, key],
                        )
                      }
                      style={{
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </Badge>
                  );
                })}
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            color="warning"
            onClick={highlightOnly}
            disabled={!canHighlight}
            title={!canHighlight ? "Add at least one filter first" : ""}
          >
            Highlight Matches
          </Button>

          <Button color="danger" onClick={clearAll}>
            Clear
          </Button>
          <Button color="primary" onClick={apply}>
            Apply
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default FilterModal;
