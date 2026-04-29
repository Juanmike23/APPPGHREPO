/*
 * PGH-DOC
 * File: src/Components/Compliance/Weekly/WeeklyPeriodScope.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import {
  Button,
  Card,
  CardBody,
  Col,
  Input,
  Label,
  Row,
} from "@pgh/ui-bootstrap";
import FeedbackState from "../../Common/FeedbackState";
import "./weeklyPeriodScope.scss";

const defaultResolveItemId = (item) => item?.id ?? item?.Id ?? null;
const defaultResolveItemLabel = (item) =>
  String(item?.tableName ?? item?.periodName ?? "").trim();

const WeeklyPeriodScope = ({
  items = null,
  selectedItem = null,
  activeItem = null,
  onItemChange = null,
  getItemId = defaultResolveItemId,
  getItemLabel = defaultResolveItemLabel,
  getItemMeta = null,
  activeTableToken,
  selectedTableToken,
  onTableChange,
  tables = [],
  selectedTable = null,
  activeTable = null,
  tableLoading = false,
  tableError = "",
  canCreateTable = false,
  canManageTable = false,
  canRenameTable = canManageTable,
  canDeleteTable = false,
  deleteTableDisabled = false,
  deleteTableDisabledReason = "",
  onOpenCreateTable = null,
  onOpenRenameTable = null,
  onOpenDeleteTable = null,
  scopeLabel = "Table Weekly",
  searchPlaceholder = "Cari atau pilih nama Table Weekly",
  fallbackTableName = "Weekly Table",
  createButtonLabel = "Add New Table",
  renameButtonLabel = "Edit Nama",
  deleteButtonLabel = "Delete",
  rowCountLabel = "baris",
  emptySearchResultLabel = "Tidak ada table yang cocok",
  fieldId = "weekly-table-combobox",
  historyAction = null,
  createActionAddon = null,
  actionAddon = null,
}) => {
  const resolveItemId = React.useCallback(
    (item) => getItemId?.(item),
    [getItemId],
  );
  const resolveItemLabel = React.useCallback(
    (item) => String(getItemLabel?.(item) || "").trim(),
    [getItemLabel],
  );
  const resolveItemMeta = React.useCallback(
    (item) => {
      if (!item) {
        return "";
      }

      if (typeof getItemMeta === "function") {
        return String(getItemMeta(item) || "").trim();
      }

      return `${item?.rowCount ?? 0} ${rowCountLabel}`;
    },
    [getItemMeta, rowCountLabel],
  );

  const currentSelectedItem = selectedItem ?? selectedTable ?? null;
  const currentActiveItem = activeItem ?? activeTable ?? null;
  const handleSelectionChange = onItemChange ?? onTableChange;

  const orderedItems = React.useMemo(() => {
    if (Array.isArray(items)) {
      return items.filter(Boolean);
    }

    const mergedTables = [
      activeTable,
      ...tables.filter(
        (table) =>
          resolveItemId(table) != null &&
          String(resolveItemId(table)) !== String(resolveItemId(activeTable)),
      ),
    ].filter(
      (table, index, array) =>
        table &&
        array.findIndex(
          (entry) => String(resolveItemId(entry)) === String(resolveItemId(table)),
        ) === index,
    );

    return [...mergedTables].sort((left, right) => {
      const leftYear = Number(left?.year);
      const rightYear = Number(right?.year);
      if (Number.isFinite(leftYear) && Number.isFinite(rightYear) && rightYear !== leftYear) {
        return rightYear - leftYear;
      }

      const leftTimestamp = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTimestamp = right?.createdAt ? new Date(right.createdAt).getTime() : 0;

      if (rightTimestamp !== leftTimestamp) {
        return rightTimestamp - leftTimestamp;
      }

      return Number(resolveItemId(right) ?? 0) - Number(resolveItemId(left) ?? 0);
    });
  }, [activeTable, items, resolveItemId, tables]);

  const selectedItemName =
    resolveItemLabel(currentSelectedItem) ||
    resolveItemLabel(currentActiveItem) ||
    fallbackTableName;
  const [fieldValue, setFieldValue] = React.useState(selectedItemName);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const scopeFieldRef = React.useRef(null);

  const filteredItems = React.useMemo(() => {
    const keyword = String(fieldValue || "").trim().toLowerCase();
    const normalizedSelectedName = String(selectedItemName || "").trim().toLowerCase();

    if (!keyword || keyword === normalizedSelectedName) {
      return orderedItems;
    }

    return orderedItems.filter((item) =>
      resolveItemLabel(item).toLowerCase().includes(keyword),
    );
  }, [fieldValue, orderedItems, resolveItemLabel, selectedItemName]);

  React.useEffect(() => {
    setFieldValue(selectedItemName);
  }, [selectedItemName]);

  React.useEffect(() => {
    setHighlightedIndex(filteredItems.length > 0 ? 0 : -1);
  }, [filteredItems]);

  React.useEffect(() => {
    const handlePointerDownOutside = (event) => {
      if (!scopeFieldRef.current?.contains(event.target)) {
        const exactMatch = orderedItems.find(
          (item) =>
            resolveItemLabel(item).toLowerCase() ===
            String(fieldValue || "").trim().toLowerCase(),
        );

        if (exactMatch) {
          const nextId = resolveItemId(exactMatch);
          setFieldValue(resolveItemLabel(exactMatch));
          if (
            String(nextId ?? "") !==
            String(resolveItemId(currentSelectedItem ?? currentActiveItem) ?? "")
          ) {
            handleSelectionChange?.(nextId);
          }
        } else {
          setFieldValue(selectedItemName);
        }

        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [
    currentActiveItem,
    currentSelectedItem,
    fieldValue,
    handleSelectionChange,
    orderedItems,
    resolveItemId,
    resolveItemLabel,
    selectedItemName,
  ]);

  const handleOptionSelect = React.useCallback(
    (item) => {
      const nextId = resolveItemId(item);
      if (nextId == null || nextId === "") {
        return;
      }

      setFieldValue(resolveItemLabel(item));
      setHighlightedIndex(
        filteredItems.findIndex(
          (currentItem) =>
            String(resolveItemId(currentItem) ?? "") === String(nextId),
        ),
      );
      setIsDropdownOpen(false);
      handleSelectionChange?.(nextId);
    },
    [filteredItems, handleSelectionChange, resolveItemId, resolveItemLabel],
  );

  const handleInputCommit = React.useCallback(() => {
    const normalizedValue = String(fieldValue || "").trim().toLowerCase();

    if (!normalizedValue) {
      setFieldValue(selectedItemName);
      setIsDropdownOpen(false);
      return;
    }

    const highlightedItem =
      highlightedIndex >= 0 ? filteredItems[highlightedIndex] : null;
    if (highlightedItem) {
      handleOptionSelect(highlightedItem);
      return;
    }

    const matchedItem = filteredItems.find(
      (item) => resolveItemLabel(item).toLowerCase() === normalizedValue,
    );

    if (matchedItem) {
      handleOptionSelect(matchedItem);
      return;
    }

    setFieldValue(selectedItemName);
    setIsDropdownOpen(false);
  }, [
    fieldValue,
    filteredItems,
    handleOptionSelect,
    highlightedIndex,
    resolveItemLabel,
    selectedItemName,
  ]);

  const handleInputKeyDown = (event) => {
    if (!isDropdownOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      setIsDropdownOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        Math.min(currentIndex + 1, filteredItems.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleInputCommit();
      return;
    }

    if (event.key === "Escape") {
      setFieldValue(selectedItemName);
      setIsDropdownOpen(false);
    }
  };

  const isEmptyState =
    tableLoading &&
    !currentActiveItem &&
    orderedItems.length === 0 &&
    !Array.isArray(items);

  if (isEmptyState) {
    return (
      <Card className="weekly-period-scope-card">
        <CardBody className="weekly-period-scope-card__body">
          <FeedbackState
            variant="loading"
            title="Loading table weekly"
            description="Daftar table weekly sedang dimuat."
            compact
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="weekly-period-scope-card">
      <CardBody className="weekly-period-scope-card__body">
        <Row className="g-3 align-items-end weekly-period-scope-card__bottom-row">
          <Col lg={actionAddon ? "6" : "12"} xl={actionAddon ? "5" : "12"}>
            <Label className="weekly-period-scope-card__label" for={fieldId}>
              {scopeLabel}
            </Label>
            <div
              className={`weekly-period-scope-card__search ${isDropdownOpen ? "is-open" : ""}`}
              ref={scopeFieldRef}
            >
              <Input
                id={fieldId}
                type="search"
                value={fieldValue}
                onChange={(event) => {
                  setFieldValue(event.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleInputKeyDown}
                placeholder={searchPlaceholder}
                className="weekly-period-scope-card__search-input"
                autoComplete="off"
                disabled={tableLoading || orderedItems.length === 0}
              />
              {isDropdownOpen ? (
                <div className="weekly-period-scope-card__dropdown">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                      <button
                        key={String(resolveItemId(item) ?? index)}
                        type="button"
                        className={`weekly-period-scope-card__dropdown-option ${
                          index === highlightedIndex ? "is-active" : ""
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleOptionSelect(item)}
                      >
                        <span className="weekly-period-scope-card__dropdown-name">
                          {resolveItemLabel(item)}
                        </span>
                        <span className="weekly-period-scope-card__dropdown-meta">
                          {resolveItemMeta(item)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="weekly-period-scope-card__dropdown-empty">
                      {emptySearchResultLabel}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Col>

          {actionAddon ? (
            <Col lg="6" xl="7">
              <div className="weekly-period-scope-card__action-addon">
                {actionAddon}
              </div>
            </Col>
          ) : null}
        </Row>

        {(historyAction || canManageTable || canDeleteTable || canCreateTable || createActionAddon) ? (
          <div className="weekly-period-scope-card__top-actions">
            <div className="weekly-period-scope-card__action-group">
              {canCreateTable ? (
                <Button
                  type="button"
                  color="warning"
                  className="weekly-period-scope-card__create"
                  onClick={onOpenCreateTable}
                >
                  {createButtonLabel}
                </Button>
              ) : null}
              {canRenameTable ? (
                <Button
                  type="button"
                  color="light"
                  className="weekly-period-scope-card__action-secondary"
                  onClick={onOpenRenameTable}
                >
                  {renameButtonLabel}
                </Button>
              ) : null}
              {canDeleteTable ? (
                <Button
                  type="button"
                  color="danger"
                  outline
                  className="weekly-period-scope-card__action-secondary"
                  onClick={() => {
                    if (!deleteTableDisabled) {
                      onOpenDeleteTable?.();
                    }
                  }}
                  disabled={deleteTableDisabled}
                  title={deleteTableDisabled ? deleteTableDisabledReason : undefined}
                >
                  {deleteButtonLabel}
                </Button>
              ) : null}
              {historyAction}
              {createActionAddon}
            </div>
          </div>
        ) : null}

        {tableError ? (
          <div className="weekly-period-scope-card__error mt-2">{tableError}</div>
        ) : null}
      </CardBody>
    </Card>
  );
};

export default WeeklyPeriodScope;
