/*
 * PGH-DOC
 * File: src/Components/Procurement/APS/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Container, Row } from "@pgh/ui-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../Auth/AuthContext";
import { canEditPath } from "../../../Auth/accessControl";

import All from "./AllPengadaan";
import StatusPengadaan from "./StatusPengadaan";
import {
  buildProcurementDrilldownUrl,
  buildProcurementListTitle,
  resolveProcurementDrilldownState,
} from "./procurementViewState";

import "./procurementList.scss";

const isEmptyFilterState = (value) => {
  const filters = Array.isArray(value?.filters) ? value.filters : [];
  const hasFilter = filters.some((item) => {
    const column = String(item?.column ?? "").trim();
    const filterValue = item?.value;
    return column && filterValue !== null && filterValue !== undefined && String(filterValue).trim() !== "";
  });

  return !hasFilter && !value?.sort?.column && !value?.distinct?.column;
};

const toPositiveRowId = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? String(numeric) : null;
};

const APS = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canManageChecklist = canEditPath(user, location.pathname);

  const drilldownState = useMemo(
    () =>
      resolveProcurementDrilldownState({
        search: location.search,
        visibleColumns: null,
        allowDistinct: true,
        forceTabAll: true,
      }),
    [location.search],
  );
  const stateFocusRowId = useMemo(() => {
    const statePayload =
      location.state && typeof location.state === "object" ? location.state : null;
    const directStateId = toPositiveRowId(statePayload?.highlightRowId);
    if (directStateId) {
      return directStateId;
    }

    return toPositiveRowId(
      statePayload?.row?.id ?? statePayload?.row?.Id ?? statePayload?.row?.ID,
    );
  }, [location.state]);
  const activeFocusRowId = drilldownState.rowId || stateFocusRowId;

  const [selectedId, setSelectedId] = useState(activeFocusRowId);
  const [foreignKey, setForeignKey] = useState("newprocure");
  const [statusVisible, setStatusVisible] = useState(false);
  const [externalFilters, setExternalFilters] = useState(
    drilldownState.externalFilters,
  );
  const [tableReloadKey, setTableReloadKey] = useState(0);
  const [tableFocusRequest, setTableFocusRequest] = useState(() =>
    activeFocusRowId
      ? {
          id: Number(activeFocusRowId),
          requestedAt: Date.now(),
        }
      : null,
  );

  const hasDrilldownQuery = useMemo(
    () =>
      Boolean(
        drilldownState.chartColumn ||
          drilldownState.secondaryColumn ||
          drilldownState.normalizedLabel ||
          drilldownState.normalizedSecondaryLabel ||
          drilldownState.countdown ||
          drilldownState.countdownStart ||
          drilldownState.distinctColumn,
      ),
    [drilldownState],
  );

  const title = useMemo(
    () =>
      buildProcurementListTitle({
        tabKey: "all",
        chartColumn: drilldownState.chartColumn,
        secondaryColumn: drilldownState.secondaryColumn,
        normalizedLabel: drilldownState.normalizedLabel,
        normalizedSecondaryLabel: drilldownState.normalizedSecondaryLabel,
        distinctColumn: drilldownState.distinctColumn,
        countdown: drilldownState.countdown,
        countdownStart: drilldownState.countdownStart,
      }),
    [
      drilldownState.chartColumn,
      drilldownState.countdown,
      drilldownState.countdownStart,
      drilldownState.distinctColumn,
      drilldownState.normalizedLabel,
      drilldownState.normalizedSecondaryLabel,
      drilldownState.secondaryColumn,
    ],
  );

  useEffect(() => {
    setExternalFilters(drilldownState.externalFilters);
  }, [drilldownState.externalFilters]);

  useEffect(() => {
    if (!activeFocusRowId) {
      return;
    }

    setSelectedId(activeFocusRowId);
    setTableFocusRequest({
      id: Number(activeFocusRowId),
      requestedAt: Date.now(),
    });
  }, [activeFocusRowId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasRowIdQuery = params.has("rowId");
    if (hasRowIdQuery) {
      params.delete("rowId");
    }

    const safeState =
      location.state && typeof location.state === "object" ? location.state : null;
    const hasHighlightState =
      !!safeState &&
      Object.prototype.hasOwnProperty.call(safeState, "highlightRowId");

    if (!hasRowIdQuery && !hasHighlightState) {
      return;
    }

    const nextSearch = params.toString();
    let nextState = safeState;
    if (hasHighlightState) {
      const { highlightRowId, ...restState } = safeState;
      nextState = Object.keys(restState).length > 0 ? restState : null;
    }

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      {
        replace: true,
        state: nextState ?? undefined,
      },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  const handleStatusClick = useCallback((id, keyColumn) => {
    if (!canManageChecklist) {
      return;
    }
    setSelectedId(id);
    setForeignKey(keyColumn);
    setStatusVisible(true);
  }, [canManageChecklist]);

  const handleCheckpointApplied = useCallback(
    ({ procurementId }) => {
      const focusId = Number(procurementId || selectedId);
      if (!Number.isFinite(focusId) || focusId <= 0) {
        return;
      }

      setStatusVisible(false);
      setSelectedId(focusId);
      setTableReloadKey((current) => current + 1);
      setTableFocusRequest({
        id: focusId,
        requestedAt: Date.now(),
      });
    },
    [selectedId],
  );

  const handleTableFiltersChange = useCallback(
    (nextFilters) => {
      setExternalFilters(nextFilters);

      if (!hasDrilldownQuery || !isEmptyFilterState(nextFilters)) {
        return;
      }

      const nextSearch = buildProcurementDrilldownUrl({
        tab: "all",
      }).replace(/^[^?]*/, "");

      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
        },
        { replace: true },
      );
    },
    [hasDrilldownQuery, location.pathname, navigate],
  );

  const activeContent = useMemo(() => {
    return (
      <All
        onStatusClick={handleStatusClick}
        title={title}
        externalFilters={externalFilters}
        onFiltersChange={handleTableFiltersChange}
        reloadKey={tableReloadKey}
        focusRowRequest={tableFocusRequest}
      />
    );
  }, [
    externalFilters,
    handleStatusClick,
    handleTableFiltersChange,
    tableFocusRequest,
    tableReloadKey,
    title,
  ]);

  return (
    <Fragment>
      <Container fluid className="procurement-list-page">
        <Row className="procurement-list-shell">
          <div className="procurement-list-content">{activeContent}</div>

          {statusVisible && selectedId && canManageChecklist && (
            <div className="procurement-list-status">
              <StatusPengadaan
                id={selectedId}
                foreignKey={foreignKey}
                onCheckpointApplied={handleCheckpointApplied}
              />
            </div>
          )}
        </Row>
      </Container>
    </Fragment>
  );
};

export default APS;
