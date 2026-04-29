/*
 * PGH-DOC

 * File: src/Components/Planning/DashboardPlanning/index.jsx

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
  useState,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useLocation } from "react-router-dom";
import { Col, Container, Row, TabContent, TabPane } from "@pgh/ui-bootstrap";
import { BarChart2, Activity, Target, AlertOctagon } from "react-feather";

import DashboardHeader from "../../../Variables/Dashboard/DashboardHeader";
import ChangeLogModal from "../../../Variables/ActionCell/ChangeLogModal";
import TabSwitcherPillDashboard from "../../../Variables/TabSwitcher/TabSwitcherPillDashboard";
import WeeklyPeriodScope from "../../Compliance/Weekly/WeeklyPeriodScope";
import OpexWorkspace from "./Opex/OpexWorkspace";
import { useAuth } from "../../../Auth/AuthContext";
import {
  canEditPath,
  isForeignModuleForManager,
  isReadOnlyUser,
} from "../../../Auth/accessControl";
import CrossStreamDashboardNotice from "../../../Variables/Dashboard/CrossStreamDashboardNotice";
import { usePlanningDashboardTables } from "./usePlanningDashboardTables";
import PlanningTableCreateModal from "./PlanningTableCreateModal";
import PlanningTableDeleteModal from "./PlanningTableDeleteModal";
import "../../Audit/DashboardAudit/auditDashboard.scss";
import "./planningDashboardTheme.scss";
import useHeaderTabRefreshToken from "../../../Variables/Dashboard/useHeaderTabRefreshToken";

const MONTH_ORDER = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const QUARTER_ORDER = ["Q1", "Q2", "Q3", "Q4"];
const QUARTER_TO_LAST_MONTH = {
  Q1: "Mar",
  Q2: "Jun",
  Q3: "Sep",
  Q4: "Dec",
};

const resolveMonthToken = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 12) {
    return MONTH_ORDER[value - 1];
  }

  const token = String(value ?? "").trim();
  if (!token) return "";

  const numericToken = Number(token);
  if (Number.isFinite(numericToken) && numericToken >= 1 && numericToken <= 12) {
    return MONTH_ORDER[Math.trunc(numericToken) - 1];
  }

  const matched = MONTH_ORDER.find((month) => month.toLowerCase() === token.toLowerCase());
  return matched || "";
};

const resolveSelectedPlanningTableState = ({
  selectedToken,
  activeTableToken,
  activeTable,
  tables,
}) => {
  if (selectedToken === activeTableToken) {
    return activeTable ?? null;
  }

  const selectedId = Number(selectedToken);
  if (!Number.isFinite(selectedId) || selectedId <= 0) {
    return activeTable ?? null;
  }

  return tables.find((table) => Number(table?.id) === selectedId) ?? activeTable ?? null;
};

const createPlanningDashboardState = (savedState) => ({
  toMonthMode: savedState?.toMonthMode ?? "cumulative",
  activeTab: savedState?.activeTab ?? "toMonth",
  filtersByTab: savedState?.filtersByTab ?? {},
  maxMonthInfo: { month: null },
});

const mergeTabFilterEntry = (current, changes) => {
  const next = { ...(current ?? {}), ...changes };
  const currentKeys = Object.keys(current ?? {});
  const nextKeys = Object.keys(next);

  if (currentKeys.length === nextKeys.length &&
      nextKeys.every((key) => current?.[key] === next[key])) {
    return current;
  }

  return next;
};

const planningDashboardReducer = (state, action) => {
  switch (action.type) {
    case "setActiveTab":
      return state.activeTab === action.activeTab
        ? state
        : { ...state, activeTab: action.activeTab };
    case "setToMonthMode":
      return state.toMonthMode === action.toMonthMode
        ? state
        : { ...state, toMonthMode: action.toMonthMode };
    case "setMaxMonthInfo": {
      const nextInfo = action.maxMonthInfo ?? { month: null };
      const currentInfo = state.maxMonthInfo ?? {};
      const same =
        currentInfo.month === nextInfo.month &&
        currentInfo.tableId === nextInfo.tableId &&
        currentInfo.year === nextInfo.year;
      return same ? state : { ...state, maxMonthInfo: nextInfo };
    }
    case "mergeTabFilter": {
      const currentEntry = state.filtersByTab[action.storageKey] ?? {};
      const nextEntry = mergeTabFilterEntry(currentEntry, action.changes ?? {});
      if (nextEntry === currentEntry) {
        return state;
      }

      return {
        ...state,
        filtersByTab: {
          ...state.filtersByTab,
          [action.storageKey]: nextEntry,
        },
      };
    }
    case "ensureTabFilter": {
      if (state.filtersByTab[action.storageKey]) {
        return state;
      }

      return {
        ...state,
        filtersByTab: {
          ...state.filtersByTab,
          [action.storageKey]: action.defaults,
        },
      };
    }
    case "syncTabYears": {
      const nextFilters = { ...state.filtersByTab };
      let changed = false;

      action.storageKeys.forEach((storageKey) => {
        const currentEntry = nextFilters[storageKey] ?? {};
        if (currentEntry.year === action.year) {
          return;
        }

        nextFilters[storageKey] = { ...currentEntry, year: action.year };
        changed = true;
      });

      return changed ? { ...state, filtersByTab: nextFilters } : state;
    }
    case "syncOpexTabMonths": {
      const nextFilters = { ...state.filtersByTab };
      let changed = false;

      action.storageKeys.forEach((storageKey) => {
        const currentEntry = nextFilters[storageKey] ?? {};
        const shouldUpdate =
          currentEntry.year !== action.year || currentEntry.month !== action.month;
        if (!shouldUpdate) {
          return;
        }

        nextFilters[storageKey] = {
          ...currentEntry,
          year: action.year,
          month: action.month,
        };
        changed = true;
      });

      return changed ? { ...state, filtersByTab: nextFilters } : state;
    }
    default:
      return state;
  }
};

const ChartComponent = () => {
  const { user } = useAuth();
  const location = useLocation();

  const savedState = (() => {
    try {
      return JSON.parse(localStorage.getItem("chartComponentState"));
    } catch {
      return null;
    }
  })();

  const todayMonth = new Date().getMonth() + 1;
  const [mainTab, setMainTab] = useState("Opex");
  const [dashboardState, dispatchDashboard] = useReducer(
    planningDashboardReducer,
    savedState,
    createPlanningDashboardState,
  );
  const { toMonthMode, activeTab, filtersByTab, maxMonthInfo } = dashboardState;
  const [planningTableCreateOpen, setPlanningTableCreateOpen] = useState(false);
  const [planningTableDeleteOpen, setPlanningTableDeleteOpen] = useState(false);
  const [planningModalScope, setPlanningModalScope] = useState("OPEX");
  const [pendingDeleteTable, setPendingDeleteTable] = useState(null);
  const [opexRefreshToken, setOpexRefreshToken] = useState(0);
  const headerTabRefreshToken = useHeaderTabRefreshToken(mainTab);
  const opexMonthContextRef = useRef({ tableId: null, year: null });
  const maxMonthRequestRef = useRef(0);

  const refreshTrigger = headerTabRefreshToken;
  const summaryOnly = isForeignModuleForManager(user, location.pathname);
  const canManagePlanningDashboard =
    !summaryOnly &&
    !isReadOnlyUser(user) &&
    canEditPath(user, location.pathname);

  const opexTableApi = usePlanningDashboardTables({
    endpoint: "planningdashboardtable",
    scope: "OPEX",
  });
  const currentScope = "OPEX";
  const currentTableApi = opexTableApi;
  const scopeDisplayLabel = currentScope;

  const {
    tables: planningTables,
    activeTable: activePlanningTable,
    loading: planningTableLoading,
    error: planningTableError,
    selectedToken: selectedPlanningTableToken,
    setSelectedToken: setSelectedPlanningTableToken,
    selectedTable: selectedPlanningTableState,
  } = currentTableApi;

  const selectedPlanningTable = selectedPlanningTableState ?? activePlanningTable;
  const selectedPlanningYear = Number(
    selectedPlanningTable?.year ?? new Date().getFullYear(),
  );
  const suggestedNextYear = useMemo(() => {
    const years = planningTables
      .map((table) => Number(table?.year))
      .filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2099);
    const latestYear = years.length > 0 ? Math.max(...years) : selectedPlanningYear;
    return latestYear + 1;
  }, [planningTables, selectedPlanningYear]);
  const suggestedNextTableName = useMemo(
    () => `${planningModalScope} ${suggestedNextYear}`,
    [planningModalScope, suggestedNextYear],
  );

  const availableYears = useMemo(() => {
    const years = new Set(
      planningTables
        .map((table) => Number(table?.year))
        .filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2099),
    );

    years.add(selectedPlanningYear);

    return Array.from(years).sort((left, right) => left - right);
  }, [planningTables, selectedPlanningYear]);

  const latestPlanningYear = useMemo(() => {
    const years = planningTables
      .map((table) => Number(table?.year))
      .filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2099);

    if (years.length === 0) {
      return Number.isFinite(selectedPlanningYear) ? selectedPlanningYear : null;
    }

    return Math.max(...years);
  }, [planningTables, selectedPlanningYear]);

  const canDeletePlanningTable =
    canManagePlanningDashboard && planningTables.length > 1;
  const selectedPlanningTableYear = Number(selectedPlanningTable?.year);
  const isSelectedLatestPlanningYear =
    Number.isFinite(selectedPlanningTableYear) &&
    Number.isFinite(Number(latestPlanningYear)) &&
    selectedPlanningTableYear === Number(latestPlanningYear);
  const deletePlanningTableDisabled =
    planningTableLoading || planningTables.length <= 1;
  const deletePlanningTableDisabledReason =
    planningTables.length <= 1
      ? `Minimal satu table dashboard ${scopeDisplayLabel} harus tersisa.`
      : Number.isFinite(Number(latestPlanningYear)) && !isSelectedLatestPlanningYear
        ? `Delete akan divalidasi backend. Urutan yang valid saat ini mulai dari ${scopeDisplayLabel} ${latestPlanningYear}.`
        : "Pilih table yang ingin dihapus.";

  const getTabFilterStorageKey = useCallback(
    (tabKey) => `${mainTab}:${tabKey}`,
    [mainTab],
  );

  const getTabYear = useCallback(
    (tabKey) =>
      filtersByTab[getTabFilterStorageKey(tabKey)]?.year ?? selectedPlanningYear,
    [filtersByTab, getTabFilterStorageKey, selectedPlanningYear],
  );

  const normalizeTemplateMonth = useCallback(
    (candidateMonth) => {
      const normalizedMax = resolveMonthToken(maxMonthInfo.month) || "Jan";
      const maxIndex = MONTH_ORDER.findIndex((month) => month === normalizedMax);
      const rawCandidate = String(candidateMonth ?? "").trim();
      const quarterCandidate = QUARTER_ORDER.find(
        (quarter) => quarter.toLowerCase() === rawCandidate.toLowerCase(),
      );

      if (quarterCandidate) {
        const quarterEndMonth = QUARTER_TO_LAST_MONTH[quarterCandidate];
        const quarterEndIndex = MONTH_ORDER.findIndex((month) => month === quarterEndMonth);
        if (maxIndex < 0 || quarterEndIndex < 0) {
          return quarterCandidate;
        }

        return quarterEndIndex > maxIndex ? normalizedMax : quarterCandidate;
      }

      const normalizedCandidate = resolveMonthToken(candidateMonth) || normalizedMax;
      const candidateIndex = MONTH_ORDER.findIndex((month) => month === normalizedCandidate);

      if (maxIndex < 0) {
        return "Jan";
      }

      if (candidateIndex < 0) {
        return normalizedMax;
      }

      if (candidateIndex > maxIndex) {
        return normalizedMax;
      }

      return normalizedCandidate;
    },
    [maxMonthInfo.month],
  );

  const getDefaultMonthForTab = useCallback(
    (tabKey) => {
      if (tabKey === "KRO") return null;
      if (mainTab === "Opex") return resolveMonthToken(maxMonthInfo.month) || "Jan";
      return maxMonthInfo.month ?? todayMonth;
    },
    [mainTab, maxMonthInfo.month, todayMonth],
  );

  const getTabMonth = useCallback(
    (tabKey) => {
      const currentMonth =
        filtersByTab[getTabFilterStorageKey(tabKey)]?.month ??
        getDefaultMonthForTab(tabKey);

      if (tabKey === "KRO") {
        return null;
      }

      if (mainTab === "Opex") {
        return normalizeTemplateMonth(currentMonth);
      }

      return currentMonth;
    },
    [filtersByTab, getDefaultMonthForTab, getTabFilterStorageKey, mainTab, normalizeTemplateMonth],
  );

  const setYearForTab = (tabKey, year) => {
    const storageKey = getTabFilterStorageKey(tabKey);
    dispatchDashboard({
      type: "mergeTabFilter",
      storageKey,
      changes: { year },
    });
  };

  const setMonthForTab = (tabKey, month) => {
    const storageKey = getTabFilterStorageKey(tabKey);
    const nextMonth =
      tabKey === "KRO"
        ? null
        : (mainTab === "Opex"
          ? normalizeTemplateMonth(month)
          : month);
    dispatchDashboard({
      type: "mergeTabFilter",
      storageKey,
      changes: { month: nextMonth },
    });
  };

  const setDashboardActiveTab = useCallback(
    (tabKey) => {
      dispatchDashboard({ type: "setActiveTab", activeTab: tabKey });
    },
    [],
  );

  const setDashboardToMonthMode = useCallback(
    (mode) => {
      dispatchDashboard({ type: "setToMonthMode", toMonthMode: mode });
    },
    [],
  );

  useEffect(() => {
    localStorage.setItem(
      "chartComponentState",
      JSON.stringify({
        mainTab,
        activeTab,
        filtersByTab,
        toMonthMode,
      }),
    );
  }, [mainTab, activeTab, filtersByTab, toMonthMode]);

  useEffect(() => {
    dispatchDashboard({ type: "setActiveTab", activeTab: "toMonth" });
  }, [mainTab]);

  useEffect(() => {
    if (summaryOnly && activeTab === "KRO") {
      dispatchDashboard({ type: "setActiveTab", activeTab: "toMonth" });
    }
  }, [activeTab, summaryOnly]);

  useEffect(() => {
    if (!Number.isFinite(selectedPlanningYear)) {
      return;
    }

    const activeSubTabs = mainTab === "Opex" ? ["toMonth", "KRO"] : ["toMonth"];
    dispatchDashboard({
      type: "syncTabYears",
      storageKeys: activeSubTabs.map((tabKey) => getTabFilterStorageKey(tabKey)),
      year: selectedPlanningYear,
    });
  }, [getTabFilterStorageKey, mainTab, selectedPlanningYear]);

  useEffect(() => {
    const fetchMaxMonth = async () => {
      const requestId = maxMonthRequestRef.current + 1;
      maxMonthRequestRef.current = requestId;
      try {
        const apiRoot = process.env.REACT_APP_API_BASE_URL.replace(/\/$/, "");
        const tableId = Number(selectedPlanningTable?.id ?? 0);
        const year = Number.isFinite(selectedPlanningYear)
          ? selectedPlanningYear
          : Number(selectedPlanningTable?.year ?? new Date().getFullYear());
        if (!tableId) {
          if (maxMonthRequestRef.current === requestId) {
            dispatchDashboard({
              type: "setMaxMonthInfo",
              maxMonthInfo: { month: "Jan" },
            });
          }
          return;
        }
        const response = await fetch(
          `${apiRoot}/opex/table/${tableId}/maxmonth?year=${year}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        const result = await response.json();
        if (maxMonthRequestRef.current !== requestId) {
          return;
        }
        dispatchDashboard({
          type: "setMaxMonthInfo",
          maxMonthInfo: {
            month: resolveMonthToken(result?.maxMonth) || "Jan",
            tableId,
            year,
          },
        });
      } catch (error) {
        console.error(error);
        if (maxMonthRequestRef.current === requestId) {
          dispatchDashboard({
            type: "setMaxMonthInfo",
            maxMonthInfo: { month: "Jan" },
          });
        }
      }
    };

    fetchMaxMonth();
  }, [opexRefreshToken, selectedPlanningTable?.id, selectedPlanningTable?.year, selectedPlanningYear]);

  useEffect(() => {
    const storageKey = getTabFilterStorageKey(activeTab);
    dispatchDashboard({
      type: "ensureTabFilter",
      storageKey,
      defaults: {
        year: selectedPlanningYear,
        month: getDefaultMonthForTab(activeTab),
      },
    });
  }, [activeTab, getDefaultMonthForTab, getTabFilterStorageKey, selectedPlanningYear]);

  useEffect(() => {
    if (mainTab !== "Opex") {
      return;
    }

    const currentTableId = Number(selectedPlanningTable?.id ?? 0) || null;
    const currentYear = Number.isFinite(selectedPlanningYear)
      ? selectedPlanningYear
      : null;
    const normalizedMonth = resolveMonthToken(maxMonthInfo.month) || "Jan";
    const maxMonthMatchesContext =
      Number(maxMonthInfo?.tableId ?? 0) === Number(currentTableId ?? 0) &&
      Number(maxMonthInfo?.year ?? 0) === Number(currentYear ?? 0);
    const previousContext = opexMonthContextRef.current;
    const contextChanged =
      previousContext.tableId !== currentTableId ||
      previousContext.year !== currentYear;

    if (!maxMonthMatchesContext && currentTableId && currentYear) {
      return;
    }

    const storageKey = getTabFilterStorageKey("toMonth");
    const current = filtersByTab[storageKey] ?? {};
    const nextMonth =
      contextChanged ||
      current.month === null ||
      current.month === undefined ||
      current.month === ""
        ? normalizedMonth
        : normalizeTemplateMonth(current.month);

    dispatchDashboard({
      type: "syncOpexTabMonths",
      storageKeys: [storageKey],
      year: selectedPlanningYear,
      month: nextMonth,
    });

    opexMonthContextRef.current = {
      tableId: currentTableId,
      year: currentYear,
    };
  }, [
    getTabFilterStorageKey,
    mainTab,
    maxMonthInfo.month,
    maxMonthInfo.tableId,
    maxMonthInfo.year,
    filtersByTab,
    selectedPlanningTable?.id,
    selectedPlanningYear,
  ]);

  useEffect(() => {
    if (mainTab !== "Opex" || toMonthMode !== "monthly") {
      return;
    }

    const storageKey = getTabFilterStorageKey("toMonth");
    const currentMonth = String(filtersByTab[storageKey]?.month ?? "").trim();
    const quarterCandidate = QUARTER_ORDER.find(
      (quarter) => quarter.toLowerCase() === currentMonth.toLowerCase(),
    );

    if (!quarterCandidate) {
      return;
    }

    dispatchDashboard({
      type: "mergeTabFilter",
      storageKey,
      changes: { month: QUARTER_TO_LAST_MONTH[quarterCandidate] },
    });
  }, [filtersByTab, getTabFilterStorageKey, mainTab, toMonthMode]);

  const effectiveOpexRefreshToken =
    opexRefreshToken + headerTabRefreshToken;

  const OpexContent = () => (
    <TabContent activeTab={activeTab}>
      <TabPane tabId="toMonth">
        <Row>
          <OpexWorkspace
            tableId={selectedPlanningTable?.id ?? null}
            tableName={selectedPlanningTable?.tableName || "OPEX"}
            year={getTabYear("toMonth")}
            period={getTabMonth("toMonth")}
            mode={toMonthMode}
            kroOnly={false}
            showOverviewCards
            showImportControls={canManagePlanningDashboard}
            showTable={!summaryOnly}
            allowChartDrilldown={!summaryOnly}
            canManageBudgetGuardrail={canManagePlanningDashboard}
            refreshToken={effectiveOpexRefreshToken}
            onImported={(result) => {
              const importedMonth = resolveMonthToken(result?.reportMonth);
              if (importedMonth) {
                setMonthForTab("toMonth", importedMonth);
              }
              setOpexRefreshToken((prev) => prev + 1);
            }}
          />
        </Row>
      </TabPane>

      {!summaryOnly && (
        <TabPane tabId="KRO">
          <Row>
            <OpexWorkspace
              tableId={selectedPlanningTable?.id ?? null}
              tableName={selectedPlanningTable?.tableName || "OPEX"}
              year={getTabYear("KRO")}
              period={getTabMonth("KRO")}
              mode={toMonthMode}
              kroOnly
              showOverviewCards={false}
              showImportControls={false}
              canManageBudgetGuardrail={false}
              refreshToken={effectiveOpexRefreshToken}
            />
          </Row>
        </TabPane>
      )}
    </TabContent>
  );

  const rightTabs = mainTab === "Opex"
      ? [
          {
            key: "toMonth",
            label: "OPEX",
            icon: Activity,
            modeDropdown: {
              value: toMonthMode,
              options: [
                { key: "cumulative", label: "Kumulatif", icon: Activity },
                { key: "monthly", label: "Monthly", icon: Target },
              ],
            },
          },
          ...(!summaryOnly
            ? [
                {
                  key: "KRO",
                  label: "KRO",
                  icon: AlertOctagon,
                  hideDropdownMonth: true,
                },
              ]
            : []),
        ]
      : [{ key: "toMonth", label: "Kumulatif", icon: Activity }];

  return (
    <Fragment>
      <Container fluid className="dashboard-default-sec audit-dashboard-page audit-dashboard-page--ready planning-dashboard-page">
        <Row className="audit-dashboard-shell g-3">
          {summaryOnly && (
            <Col sm="12">
              <CrossStreamDashboardNotice
                moduleLabel="Planning"
                userStream={user?.stream}
              />
            </Col>
          )}

            <DashboardHeader
              tabs={[
                { key: "Opex", label: "OPEX", icon: BarChart2 },
              ]}
              activeTab={mainTab}
              onTabChange={setMainTab}
            />

          <Col xs="12">
            <WeeklyPeriodScope
              activeTableToken={currentTableApi.activeTableToken}
              selectedTableToken={selectedPlanningTableToken}
              onTableChange={setSelectedPlanningTableToken}
              tables={planningTables}
              selectedTable={selectedPlanningTableState}
              activeTable={activePlanningTable}
              tableLoading={planningTableLoading}
              tableError={planningTableError}
              canCreateTable={canManagePlanningDashboard}
              canManageTable={canManagePlanningDashboard && Boolean(selectedPlanningTable?.id)}
              canRenameTable={false}
              canDeleteTable={canDeletePlanningTable}
                deleteTableDisabled={canDeletePlanningTable && deletePlanningTableDisabled}
                deleteTableDisabledReason={deletePlanningTableDisabledReason}
                onOpenCreateTable={() => {
                  setPlanningModalScope("OPEX");
                  setPlanningTableCreateOpen(true);
                }}
                onOpenDeleteTable={async () => {
                  const targetApi = opexTableApi;
                  const latestState = await targetApi.refreshTables();
                  const latestTables = latestState?.tables ?? [];
                  const latestActiveTable = latestState?.activeTable ?? null;
                const latestSelectedTable = resolveSelectedPlanningTableState({
                  selectedToken: targetApi.selectedToken,
                  activeTableToken: targetApi.activeTableToken,
                  activeTable: latestActiveTable,
                  tables: latestTables,
                });
                if (!canDeletePlanningTable || latestTables.length <= 1 || !latestSelectedTable) {
                    return;
                  }

                setPlanningModalScope("OPEX");
                setPendingDeleteTable(latestSelectedTable);
                setPlanningTableDeleteOpen(true);
              }}
              scopeLabel={`Table Dashboard ${scopeDisplayLabel}`}
              searchPlaceholder={`Cari atau pilih nama table dashboard ${scopeDisplayLabel}`}
              fallbackTableName={`${scopeDisplayLabel} Table`}
              createButtonLabel="Add New"
              deleteButtonLabel="Delete"
              historyAction={
                <ChangeLogModal
                  tableName="PlanningDashboardTable"
                  titleLabel={`Riwayat Perubahan Dashboard ${scopeDisplayLabel}`}
                  triggerMode="header"
                  triggerLabel="Riwayat Perubahan"
                  allowNavigateToChange={false}
                />
              }
              actionAddon={(
                <TabSwitcherPillDashboard
                  tabs={rightTabs}
                  activeTab={activeTab}
                  onTabChange={setDashboardActiveTab}
                  showYearFilter={false}
                  getTabYear={getTabYear}
                  getTabMonth={getTabMonth}
                  onYearChange={setYearForTab}
                  onMonthChange={setMonthForTab}
                  years={availableYears}
                  maxValue={maxMonthInfo.month}
                  groupTabs
                  toMonthMode={toMonthMode}
                  setToMonthMode={setDashboardToMonthMode}
                />
              )}
            />
          </Col>

          <Col xs="12">
            {mainTab === "Opex" && <OpexContent />}
          </Col>
        </Row>
      </Container>

      <PlanningTableCreateModal
        isOpen={planningTableCreateOpen}
        toggle={() => setPlanningTableCreateOpen((prev) => !prev)}
        scopeLabel={planningModalScope}
        suggestedYear={suggestedNextYear}
        suggestedTableName={suggestedNextTableName}
        onSubmit={async () => {
          const targetApi = opexTableApi;
          const createdTable = await targetApi.createTable();
          await targetApi.refreshTables();
          const nextId = createdTable?.id ?? createdTable?.Id;
          if (nextId) {
            targetApi.setSelectedToken(String(nextId));
          }
        }}
      />

      <PlanningTableDeleteModal
        isOpen={planningTableDeleteOpen}
        toggle={() => {
          setPlanningTableDeleteOpen((prev) => !prev);
          if (planningTableDeleteOpen) {
            setPendingDeleteTable(null);
          }
        }}
        scopeLabel={planningModalScope}
        tableName={
          pendingDeleteTable?.tableName ||
          (opexTableApi.selectedTable?.tableName) ||
          (opexTableApi.activeTable?.tableName) ||
          ""
        }
        onConfirm={async () => {
          const targetApi = opexTableApi;
          const latestState = await targetApi.refreshTables();
          const latestSelectedTable = resolveSelectedPlanningTableState({
            selectedToken: targetApi.selectedToken,
            activeTableToken: targetApi.activeTableToken,
            activeTable: latestState?.activeTable ?? null,
            tables: latestState?.tables ?? [],
          });
          const resolvedPendingDeleteTable =
            pendingDeleteTable &&
            latestState?.tables?.find(
              (table) => Number(table?.id) === Number(pendingDeleteTable?.id),
            );
          const tableId =
            resolvedPendingDeleteTable?.id ??
            latestSelectedTable?.id ??
            latestState?.activeTable?.id ??
            null;
          if (!tableId) return;

          const result = await targetApi.deleteTable(tableId);
          await targetApi.refreshTables();
          const nextId = result?.activeTableId ?? result?.ActiveTableId;
          targetApi.setSelectedToken(
            nextId ? String(nextId) : targetApi.activeTableToken,
          );
          setPendingDeleteTable(null);
        }}
      />
    </Fragment>
  );
};

export default ChartComponent;
