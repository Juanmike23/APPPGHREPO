/*
 * PGH-DOC
 * File: src/Components/Audit/Timeline/FullCalendarResourceTM.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";

import { useNavigate } from "react-router-dom";

import {
  Button,
  Popover,
  PopoverHeader,
  PopoverBody,
  Card,
} from "@pgh/ui-bootstrap";
import {
  Info,
  CheckCircle,
  Grid,
  Layers,
  Clock,
  HelpCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "react-feather";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import { StatusBadge } from "./StatusBadge";
import "./FCRT.css";
import ZoomINControl from "../../../Variables/Table/ZoomControl";
import FeedbackState from "../../Common/FeedbackState";
import { buildAuditDrilldownUrl } from "../Utils/auditViewState";
import {
  AUDIT_EMPTY_LABEL,
  AUDIT_INVALID_STATUS_LABEL,
} from "../Utils/auditValueLabels";

const TIMELINE_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const TIMELINE_VIEWS = [
  { key: "resourceTimelineYear", label: "Year" },
  { key: "resourceTimelineQuarter", label: "Quarter" },
  { key: "resourceTimelineMonth", label: "Month" },
  { key: "resourceTimelineWeek", label: "Week" },
];

const getTimelineInitialDate = (minYear, maxYear) => {
  const today = new Date();
  const todayYear = today.getFullYear();

  if (todayYear < minYear) {
    return new Date(minYear, 0, 1);
  }

  if (todayYear > maxYear) {
    return new Date(maxYear, 11, 1);
  }

  return today;
};

const createStartOfDay = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const alignDateToTimelineView = (value, viewKey) => {
  const date = createStartOfDay(value);

  switch (viewKey) {
    case "resourceTimelineYear":
      return new Date(date.getFullYear(), 0, 1);
    case "resourceTimelineQuarter":
      return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
    case "resourceTimelineMonth":
      return new Date(date.getFullYear(), date.getMonth(), 1);
    case "resourceTimelineWeek": {
      const weekStart = new Date(date);
      const day = weekStart.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diffToMonday);
      return createStartOfDay(weekStart);
    }
    default:
      return date;
  }
};

const addTimelineStep = (value, viewKey, step) => {
  const date = alignDateToTimelineView(value, viewKey);

  switch (viewKey) {
    case "resourceTimelineYear":
      date.setFullYear(date.getFullYear() + step);
      return date;
    case "resourceTimelineQuarter":
      date.setMonth(date.getMonth() + step * 3);
      return date;
    case "resourceTimelineMonth":
      date.setMonth(date.getMonth() + step);
      return date;
    case "resourceTimelineWeek":
      date.setDate(date.getDate() + step * 7);
      return date;
    default:
      return date;
  }
};

const buildInitialVisibleRange = (viewKey) => {
  const start = alignDateToTimelineView(new Date(), viewKey);
  return {
    start,
    end: addTimelineStep(start, viewKey, 1),
  };
};

const formatTimelineBoundary = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveStatusModeFromLabel = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return null;
  if (
    normalized.includes("status tidak valid") ||
    normalized.includes("invalid") ||
    normalized.includes("anom")
  ) {
    return "anomaly";
  }
  if (
    normalized.includes("belum diisi") ||
    normalized.includes("unknown") ||
    normalized.includes("kosong")
  ) {
    return "unknown";
  }
  if (
    normalized.includes("in progress") ||
    normalized.includes("in_progress") ||
    normalized.includes("progress") ||
    normalized.includes("berjalan")
  ) {
    return "inprogress";
  }
  if (normalized.includes("open")) return "open";
  if (normalized.includes("close") || normalized.includes("selesai")) return "closed";
  if (normalized === "all") return "all";

  return null;
};

export default function ProjectTimeline({ type = "all", drilldown = null }) {
  const currentYear = new Date().getFullYear();
  const requestSequenceRef = useRef(0);
  const activeRequestControllerRef = useRef(null);
  const lastVisibleResourceIds = useRef("");
  const [currentView, setCurrentView] = useState("resourceTimelineQuarter");

  const [resources, setResources] = useState([]);
  const [allResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [allEvents] = useState([]);
  const [minYear, setMinYear] = useState(null);
  const [maxYear, setMaxYear] = useState(null);
  const [viewMode, setViewMode] = useState("audit");
  const [activeTab, setActiveTab] = useState("all");
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [visibleRange, setVisibleRange] = useState(() =>
    buildInitialVisibleRange("resourceTimelineQuarter"),
  );
  const lockScroll = useRef(false);

  const [showDetails, setShowDetails] = useState(true);

  const navigate = useNavigate();

  const calendarRef = useRef(null);
  const fullscreenContainerRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [calendarToolbarState, setCalendarToolbarState] = useState({
    title: "",
    rangeStart: null,
    rangeEnd: null,
  });

  const hoverTimer = useRef(null);
  const [activePopover, setActivePopover] = useState(null);
  const hoveringPopoverRef = useRef(false);
  const hoveringEventIdRef = useRef(null);

  const [counts, setCounts] = useState({
    all: 0,
    open: 0,
    inprogress: 0,
    closed: 0,
    unknown: 0,
    anomaly: 0,
  });

  const filterResourcesForRange = (rangeStart, rangeEnd) => {
    const activeResourceIds = new Set(
      allEvents
        .filter((e) => e.start < rangeEnd && e.end > rangeStart)
        .map((e) => e.resourceId),
    );

    const filtered = allResources.filter((r) => activeResourceIds.has(r.id));

    // ðŸ”’ prevent infinite loop
    const key = filtered.map((r) => r.id).join("|");

    if (key !== lastVisibleResourceIds.current) {
      lastVisibleResourceIds.current = key;
      setResources(filtered);
    }
  };

  const expandBtnRef = useRef(null);

  // const changeViewZoom = (dir) => {
  //   const api = calendarRef.current?.getApi();
  //   if (!api) return;

  //   const views = [
  //     "resourceTimelineQuarter",
  //     "resourceTimelineYear",

  //     "resourceTimelineMonth",
  //     "resourceTimelineWeek",
  //   ];

  //   const current = api.view.type;
  //   const idx = views.indexOf(current);
  //   if (idx === -1) return;

  //   if (dir === "in" && idx < views.length - 1) api.changeView(views[idx + 1]);
  //   if (dir === "out" && idx > 0) api.changeView(views[idx - 1]);
  // };

  const changeViewZoom = (dir) => {
    if (dir === "in") {
      setShowDetails(true);
    }

    if (dir === "out") {
      setShowDetails(false);
    }
  };

  const resetView = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView("resourceTimelineQuarter"); // your default
  };

  // ---------- Backend fetch (new) ----------
  const fetchData = useCallback(async (mode = "all", distinct = false, range = visibleRange) => {
    activeRequestControllerRef.current?.abort?.();
    const controller = new AbortController();
    activeRequestControllerRef.current = controller;
    const requestId = ++requestSequenceRef.current;
    setTimelineLoading(true);
    setResources([]);
    setEvents([]);

    const params = new URLSearchParams({
      mode,
      distinct: String(distinct),
      type,
    });

    const rangeStartValue = formatTimelineBoundary(range?.start);
    if (rangeStartValue) {
      params.set("rangeStart", rangeStartValue);
    }

    const rangeEndValue = formatTimelineBoundary(range?.end);
    if (rangeEndValue) {
      params.set("rangeEnd", rangeEndValue);
    }

    const res = await fetch(
      `${process.env.REACT_APP_API_BASE_URL}timeline/timeline?${params.toString()}`,
      {
        credentials: "include",
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (requestId !== requestSequenceRef.current) {
      return;
    }

    const countSource = data?.Counts ?? data?.counts ?? {};
    setCounts({
      all: countSource.All ?? countSource.all ?? 0,
      open: countSource.Open ?? countSource.open ?? 0,
      inprogress: countSource.InProgress ?? countSource.inprogress ?? 0,
      closed: countSource.Closed ?? countSource.closed ?? 0,
      unknown: countSource.Unknown ?? countSource.unknown ?? 0,
      anomaly: countSource.Anomaly ?? countSource.anomaly ?? 0,
    });

    const eventSource = Array.isArray(data?.Events)
      ? data.Events
      : Array.isArray(data?.events)
        ? data.events
        : [];
    const resourceSource = Array.isArray(data?.Resources)
      ? data.Resources
      : Array.isArray(data?.resources)
        ? data.resources
        : [];

    const fallbackstart = (rawEnd) => {
      if (rawEnd instanceof Date && !isNaN(rawEnd)) {
        return new Date(rawEnd.getFullYear(), rawEnd.getMonth(), 1);
      }

      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), 1);
    };

    const normalizeEndInclusive = (rawEnd) => {
      if (!rawEnd) return null;

      const d = new Date(rawEnd);

      const year = d.getFullYear();
      const month = d.getMonth();

      // Last day of the month, exclusive end
      return new Date(year, month + 1, 1);
    };

    const todayAtMidnightPlusOne = () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 1);
      return d;
    };

    const parsedEvents = eventSource.map((e) => {
      const rawStart = e.Start ? new Date(e.Start) : null;
      const rawEnd = e.End ? new Date(e.End) : null;

      const renderStart = rawStart ?? fallbackstart(rawEnd);

      const renderEnd = rawEnd
        ? normalizeEndInclusive(rawEnd)
        : todayAtMidnightPlusOne();

      return {
        id: e.Id,
        resourceId: e.ResourceId,
        title: e.Title,

        // ðŸ”µ what FullCalendar uses
        start: renderStart,
        end: renderEnd,

        // ðŸŸ¢ what YOU use for UI
        rawStart,
        rawEnd,
        rawStatus: e.RawStatus,

        isStartUnknown: !e.Start,
        isEndUnknown: !e.End,

        status: e.Status,
      };
    });

    const parsedResources = resourceSource.map((r) => ({
      id: r.Id,
      title: r.Title,
      order: r.Order,
    }));

    setEvents(parsedEvents);
    setResources(parsedResources);
    setMinYear(data?.MinYear ?? data?.minYear ?? currentYear);
    setMaxYear(data?.MaxYear ?? data?.maxYear ?? currentYear);
    setTimelineLoading(false);
  }, [currentYear, type, visibleRange]);

  useEffect(() => {
    if (!(visibleRange?.start instanceof Date) || !(visibleRange?.end instanceof Date)) {
      return;
    }

    fetchData(activeTab, viewMode === "application", visibleRange).catch((error) => {
      if (error?.name === "AbortError") {
        return;
      }
      console.error("Audit timeline fetch failed:", error);
      setResources([]);
      setEvents([]);
      setTimelineLoading(false);
    });
  }, [activeTab, fetchData, type, viewMode, visibleRange]);

  useEffect(
    () => () => {
      activeRequestControllerRef.current?.abort?.();
    },
    [],
  );

  useEffect(() => {
    if (!drilldown || !drilldown.requestId) {
      return;
    }

    const requestType = String(drilldown.type ?? "").trim().toLowerCase();
    const currentType = String(type ?? "all").trim().toLowerCase();
    if (requestType && requestType !== currentType) {
      return;
    }

    const requestedColumn = String(drilldown.chartColumn ?? "")
      .trim()
      .toUpperCase();
    const requestedLabel = String(drilldown.label ?? "").trim();
    const isDistinctMode = viewMode === "application";

    if (requestedColumn === "STATUS") {
      const targetMode = resolveStatusModeFromLabel(requestedLabel);
      if (targetMode) {
        setActiveTab(targetMode);
        return;
      }
    }

    if (requestedColumn === "TAHUN") {
      const parsedYear = Number(requestedLabel);
      if (Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 3000) {
        const api = calendarRef.current?.getApi();
        if (api) {
          api.gotoDate(new Date(parsedYear, 0, 1));
        }
      }
    }

    setActiveTab("all");
  }, [drilldown, type, viewMode]);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  const closeActivePopover = useCallback(() => {
    clearHoverTimer();
    hoveringPopoverRef.current = false;
    hoveringEventIdRef.current = null;
    setActivePopover(null);
  }, [clearHoverTimer]);

  const schedulePopoverClose = useCallback(() => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => {
      if (hoveringPopoverRef.current || hoveringEventIdRef.current) {
        return;
      }

      setActivePopover(null);
    }, 120);
  }, [clearHoverTimer]);

  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey) return;

      // Prevent browser zoom shortcuts
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
      }

      if (e.key === "]") {
        console.log("Zoom IN (Ctrl + ])");
        changeViewZoom("in");
      }

      if (e.key === "[") {
        console.log("Zoom OUT (Ctrl + [)");
        changeViewZoom("out");
      }

      if (e.key === "0") {
        console.log("Reset Zoom (Ctrl + 0)");
        resetView();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- Keep your UI logic ----------
  const timelineScrollLeft = useRef(0);

  const handleMouseEnter = useCallback((id) => {
    clearHoverTimer();
    hoveringEventIdRef.current = id;

    const scroller = document.querySelector(".fc-scroller");
    if (scroller) {
      timelineScrollLeft.current = scroller.scrollLeft;
      lockScroll.current = true;
    }
    setActivePopover(id);
  }, [clearHoverTimer]);

  useEffect(() => {
    if (!activePopover) {
      lockScroll.current = false;
      return;
    }

    requestAnimationFrame(() => {
      const scroller = document.querySelector(".fc-scroller");
      if (scroller && lockScroll.current) {
        scroller.scrollLeft = timelineScrollLeft.current;
      }
    });
  }, [activePopover]);

  useEffect(() => {
    const handleClose = (e) => {
      if (!(e.target instanceof Element)) return;

      const isEvent = e.target.closest(".fc-event");
      const isPopover = e.target.closest(".popover");
      const isTimelineScroll =
        e.target.closest(".fc-scroller") ||
        e.target.classList?.contains("fc-scroller");

      // ðŸ”¥ ignore timeline scrolling
      if (e.type === "scroll" && isTimelineScroll) return;

      if (!isEvent && !isPopover) {
        closeActivePopover();
      }
    };

    document.addEventListener("click", handleClose);
    document.addEventListener("scroll", handleClose, true);

    return () => {
      document.removeEventListener("click", handleClose);
      document.removeEventListener("scroll", handleClose, true);
    };
  }, [closeActivePopover]);

  const handleMouseLeave = useCallback(
    (id) => {
      if (hoveringEventIdRef.current === id) {
        hoveringEventIdRef.current = null;
      }

      schedulePopoverClose();
    },
    [schedulePopoverClose],
  );

  const handlePopoverEnter = useCallback(() => {
    clearHoverTimer();
    hoveringPopoverRef.current = true;
  }, [clearHoverTimer]);

  const handlePopoverLeave = useCallback(() => {
    hoveringPopoverRef.current = false;
    schedulePopoverClose();
  }, [schedulePopoverClose]);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentTimelineFullscreen =
        document.fullscreenElement === fullscreenContainerRef.current;

      setFullscreen(isCurrentTimelineFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const container = fullscreenContainerRef.current;

    if (!container) {
      return;
    }

    const enterFullscreen = async () => {
      if (fullscreen && document.fullscreenElement !== container) {
        try {
          await container.requestFullscreen();
        } catch (error) {
          console.error("Timeline fullscreen failed:", error);
          setFullscreen(false);
        }
      }

      if (!fullscreen && document.fullscreenElement === container) {
        try {
          await document.exitFullscreen();
        } catch (error) {
          console.error("Timeline exit fullscreen failed:", error);
        }
      }
    };

    enterFullscreen();
  }, [fullscreen]);

  useEffect(() => {
    if (activePopover && !events.some((eventItem) => eventItem.id === activePopover)) {
      closeActivePopover();
    }
  }, [activePopover, closeActivePopover, events]);

  useEffect(() => {
    closeActivePopover();
  }, [activeTab, closeActivePopover, currentView, showDetails, type, viewMode]);

  const renderEventContent = useCallback(
    (arg) => {
      const status = arg.event.extendedProps.status;
      const { rawStart, rawEnd, isStartUnknown, isEndUnknown } =
        arg.event.extendedProps;

      return (
        <div
          id={`event-${arg.event.id}`}
          onMouseEnter={() => handleMouseEnter(arg.event.id)}
          onMouseLeave={() => handleMouseLeave(arg.event.id)}
          style={{
            color: "white",
            fontSize: showDetails ? "12px" : "10px",
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          {showDetails && (
            <>
              <b
                style={{
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {arg.event.title}
              </b>

              <div
                style={{
                  fontSize: "10px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {isStartUnknown ? (
                  <em>{AUDIT_EMPTY_LABEL}</em>
                ) : rawStart ? (
                  TIMELINE_DATE_FORMATTER.format(rawStart)
                ) : (
                  "-"
                )}
                {" -> "}
                {isEndUnknown
                  ? AUDIT_EMPTY_LABEL
                  : rawEnd
                    ? TIMELINE_DATE_FORMATTER.format(rawEnd)
                    : ""}
              </div>
            </>
          )}

          <div
            style={{
              whiteSpace: "nowrap",
            }}
          >
            <StatusBadge status={status} />
          </div>
        </div>
      );
    },
    [handleMouseEnter, handleMouseLeave, showDetails],
  );

  const summaryButtons = [
    {
      key: "all",
      icon: Grid,
      label: "All",
      mode: "all",
      getCount: () => counts.all,
    },
    {
      key: "open",
      icon: Info,
      label: "Open",
      mode: "open",
      getCount: () => counts.open,
    },
    {
      key: "inprogress",
      icon: Clock,
      label: "In Progress",
      mode: "inprogress",
      getCount: () => counts.inprogress,
    },
    {
      key: "closed",
      icon: CheckCircle,
      label: "Closed",
      mode: "closed",
      getCount: () => counts.closed,
    },
    {
      key: "unknown",
      icon: HelpCircle,
      label: AUDIT_EMPTY_LABEL,
      mode: "unknown",
      getCount: () => counts.unknown,
    },
    {
      key: "anomaly",
      icon: AlertTriangle,
      label: AUDIT_INVALID_STATUS_LABEL,
      mode: "anomaly",
      getCount: () => counts.anomaly,
    },
  ];

  const activeEvent = events.find((e) => e.id === activePopover);
  const isDistinctMode = viewMode === "application";
  const timelineHeight = fullscreen
    ? "100vh"
    : expanded
      ? "calc(100vh - 110px)"
      : showDetails
        ? "clamp(640px, 82vh, 860px)"
        : "clamp(560px, 74vh, 760px)";
  const resourceAreaWidth = showDetails ? "22rem" : "16rem";
  const safeMinYear = minYear ?? currentYear;
  const safeMaxYear = maxYear ?? safeMinYear;
  const validRange = {
    start: new Date(safeMinYear, 0, 1),
    end: new Date(safeMaxYear + 1, 0, 1),
  };
  const initialTimelineDate = getTimelineInitialDate(safeMinYear, safeMaxYear);
  const lastValidDate = new Date(validRange.end);
  lastValidDate.setDate(lastValidDate.getDate() - 1);

  const clampDateToValidRange = (value) => {
    const date = new Date(value);
    if (date < validRange.start) {
      return new Date(validRange.start);
    }

    if (date >= validRange.end) {
      return new Date(lastValidDate);
    }

    return date;
  };
  const clampedToday = clampDateToValidRange(new Date());
  const currentRangeAnchor = alignDateToTimelineView(
    calendarToolbarState.rangeStart instanceof Date
      ? calendarToolbarState.rangeStart
      : initialTimelineDate,
    currentView,
  );
  const prevRangeAnchor = addTimelineStep(currentRangeAnchor, currentView, -1);
  const nextRangeAnchor = addTimelineStep(currentRangeAnchor, currentView, 1);
  const canNavigatePrev = prevRangeAnchor >= validRange.start;
  const canNavigateNext = nextRangeAnchor < validRange.end;
  const isTodayInCurrentRange =
    calendarToolbarState.rangeStart instanceof Date &&
    calendarToolbarState.rangeEnd instanceof Date &&
    clampedToday >= calendarToolbarState.rangeStart &&
    clampedToday < calendarToolbarState.rangeEnd;

  const handleCalendarNavigate = (direction) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const targetAnchor = direction === "prev" ? prevRangeAnchor : nextRangeAnchor;
    if (direction === "prev" && !canNavigatePrev) return;
    if (direction === "next" && !canNavigateNext) return;
    api.gotoDate(clampDateToValidRange(targetAnchor));
  };

  const handleCalendarToday = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    const todayAnchor = alignDateToTimelineView(clampedToday, currentView);
    api.gotoDate(clampDateToValidRange(todayAnchor));
  };

  const handleCalendarViewChange = (nextView) => {
    const api = calendarRef.current?.getApi();
    if (!api || !nextView) return;

    api.changeView(nextView, clampDateToValidRange(currentRangeAnchor));
  };
  const resourceHeaderTitle = `Nama Audit (${resources.length})`;

  if (timelineLoading && (!minYear || !maxYear)) {
    return (
      <FeedbackState
        variant="loading"
        title="Loading timeline"
        description="Timeline audit sedang dimuat."
        compact
      />
    );
  }

  return (
    <div>
      <Card>
       <div
  ref={fullscreenContainerRef}
  id="timeline-container"
  className={`p-3 ${showDetails ? "" : "compact-resources"} ${fullscreen ? "timeline-fullscreen" : ""}`}
  style={{
    width: "100%",
    height: timelineHeight,
    minHeight: fullscreen ? "100vh" : showDetails ? "640px" : "560px",
    overflow: "hidden",
    overflowX: "auto",
    display: "flex",
    flexDirection: "column",
    backgroundColor: fullscreen ? "#ffffff" : undefined,
  }}
>

          <div className="timeline-toolbar">
            <div className="timeline-toolbar__heading d-flex align-items-center gap-2">
              <h3 className="m-0">Audit Timeline</h3>
              <Button
                size="sm"
                color="light"
                className={`timeline-mode-toggle ${isDistinctMode ? "active" : ""}`}
                title={"Distinct Mode / Merge Duplicates"}
                style={{ lineHeight: 1 }}
                aria-pressed={isDistinctMode}
                onClick={() => {
                  if (!isDistinctMode) {
                    setViewMode("application");
                    setActiveTab("all");
                  } else {
                    setViewMode("audit");
                    setActiveTab("all");
                  }
                }}
              >
                <Layers size={14} />
                <span>Distinct</span>
                <span className="timeline-mode-toggle__status">
                  {isDistinctMode ? "ON" : "OFF"}
                </span>
              </Button>
            </div>
            <div className="timeline-summary-buttons">
              {summaryButtons.map((btn) => {
                const Icon = btn.icon;
                const isActive = activeTab === btn.key;

                return (
                  <Button
                    innerRef={expandBtnRef}
                    key={btn.key}
                    size="sm"
                    color="light"
                    className={`timeline-summary-button btn-pill d-flex align-items-center gap-1 ${
                      isActive ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setActiveTab(btn.key);
                    }}
                    >
                      <Icon
                        size={14}
                      style={{
                        filter: isActive
                          ? `
        drop-shadow(0 1px 1px rgba(0,0,0,.2))
        drop-shadow(0 0 1px rgba(0,0,0,.9))
      `
                          : "none",
                        color: isActive ? "#ffffff" : "#b84a1c",
                      }}
                    />

                      <span
                        className="timeline-summary-button__label"
                        style={{ fontWeight: 600, color: isActive ? "#ffffff" : "#b84a1c" }}
                    >
                      {btn.label} ({btn.getCount()})
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="timeline-calendar-toolbar" aria-label="Timeline navigation">
            <div className="timeline-calendar-toolbar__nav">
              <Button
                type="button"
                color="light"
                className="timeline-calendar-toolbar__icon-btn"
                onClick={() => handleCalendarNavigate("prev")}
                disabled={!canNavigatePrev}
                aria-label="Periode sebelumnya"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                color="light"
                className={`timeline-calendar-toolbar__today ${
                  isTodayInCurrentRange ? "is-current" : ""
                }`}
                onClick={handleCalendarToday}
              >
                Today
              </Button>
              <Button
                type="button"
                color="light"
                className="timeline-calendar-toolbar__icon-btn"
                onClick={() => handleCalendarNavigate("next")}
                disabled={!canNavigateNext}
                aria-label="Periode berikutnya"
              >
                <ChevronRight size={16} />
              </Button>
            </div>

            <div className="timeline-calendar-toolbar__title">
              {calendarToolbarState.title || "Timeline"}
            </div>

            <div className="timeline-calendar-toolbar__views">
              {TIMELINE_VIEWS.map((view) => (
                <Button
                  key={view.key}
                  type="button"
                  color="light"
                  className={`timeline-calendar-toolbar__view-btn ${
                    currentView === view.key ? "is-active" : ""
                  }`}
                  onClick={() => handleCalendarViewChange(view.key)}
                >
                  {view.label}
                </Button>
              ))}
            </div>
          </div>

          <FullCalendar
            scrollTimeReset={false} // ðŸ”¥ THIS IS THE FIX
            datesSet={(arg) => {
              setCurrentView((prev) =>
                prev === arg.view.type ? prev : arg.view.type,
              );
              setCalendarToolbarState((prev) => {
                const nextStart = arg.start?.getTime?.() ?? null;
                const nextEnd = arg.end?.getTime?.() ?? null;
                const prevStart = prev.rangeStart?.getTime?.() ?? null;
                const prevEnd = prev.rangeEnd?.getTime?.() ?? null;

                if (
                  prev.title === arg.view.title &&
                  prevStart === nextStart &&
                  prevEnd === nextEnd
                ) {
                  return prev;
                }

                return {
                  title: arg.view.title,
                  rangeStart: nextStart == null ? null : new Date(nextStart),
                  rangeEnd: nextEnd == null ? null : new Date(nextEnd),
                };
              });
              setVisibleRange((prev) => {
                const nextStart = arg.start?.getTime?.() ?? null;
                const nextEnd = arg.end?.getTime?.() ?? null;
                const prevStart = prev?.start?.getTime?.() ?? null;
                const prevEnd = prev?.end?.getTime?.() ?? null;

                if (prevStart === nextStart && prevEnd === nextEnd) {
                  return prev;
                }

                return {
                  start: nextStart == null ? null : new Date(nextStart),
                  end: nextEnd == null ? null : new Date(nextEnd),
                };
              });
            }}
            eventClick={(info) => {
              info.jsEvent.preventDefault();

              const isDistinctMode = viewMode === "application";
              const eventId = info.event.id;
              const eventTitle = info.event.title;
              const chartColumn = isDistinctMode
                ? "NAMAAUDIT"
                : eventId
                  ? "Id"
                  : "NAMAAUDIT";
              const label = isDistinctMode ? eventTitle : eventId || eventTitle;

              navigate(
                buildAuditDrilldownUrl({
                  chartColumn,
                  label,
                  mode: "timeline",
                  type,
                }),
              );
            }}
            ref={calendarRef}
            plugins={[resourceTimelinePlugin]}
            initialView="resourceTimelineQuarter"
            height="100%"
            initialDate={initialTimelineDate}
            validRange={validRange}
            headerToolbar={false}
            resourceAreaHeaderContent={resourceHeaderTitle}
            resourceAreaWidth={resourceAreaWidth}
            resources={resources}
            resourceOrder="order"
            eventOrder={() => 0}
            events={events}
            eventContent={renderEventContent}
            nowIndicator
            views={{
              resourceTimelineQuarter: {
                type: "resourceTimeline",
                duration: { months: 3 },
                slotMinWidth: 110,
                slotDuration: { months: 1 },
                slotLabelFormat: [{ year: "numeric" }, { month: "short" }],
              },

              resourceTimelineYear: {
                type: "resourceTimeline",
                duration: { years: 1 },
                slotMinWidth: 88,
                slotDuration: { months: 1 },
                slotLabelFormat: [{ year: "numeric" }, { month: "short" }],
              },

              resourceTimelineMonth: {
                type: "resourceTimeline",
                duration: { months: 1 },
                slotMinWidth: 72,
                slotDuration: { days: 1 },
                slotLabelFormat: [
                  { year: "numeric" },
                  { month: "long" },
                  { day: "numeric" },
                ],
              },

              resourceTimelineWeek: {
                type: "resourceTimeline",
                duration: { weeks: 1 },
                slotMinWidth: 92,
                slotDuration: { days: 1 },
                slotLabelFormat: [
                  { year: "numeric" },
                  { month: "short" },
                  { weekday: "short", day: "numeric" },
                ],
              },
            }}
          />

          {activeEvent &&
            document.getElementById(`event-${activeEvent.id}`) && (
              <Popover
                key={activePopover}
                isOpen={!!activeEvent}
                target={`event-${activeEvent.id}`}
                placement="auto"
                fade={false}
                container="body"
                className="audit-timeline-popover"
                modifiers={[
                  {
                    name: "offset",
                    options: {
                      offset: [0, 10],
                    },
                  },
                  {
                    name: "preventOverflow",
                    options: {
                      boundary: "viewport",
                      padding: 12,
                      tether: true,
                    },
                  },
                  {
                    name: "flip",
                    options: {
                      fallbackPlacements: ["top", "bottom", "left", "right"],
                    },
                  },
                ]}
                trigger="manual"
                autofocus={false} // ðŸ‘ˆ STOP focus jump
                tabIndex="-1" // ðŸ”¥ THIS is critical
              >
                <div
                  onMouseEnter={handlePopoverEnter}
                  onMouseLeave={handlePopoverLeave}
                >
                  <PopoverHeader>{activeEvent.title}</PopoverHeader>
                  <PopoverBody>
                    <div>
                      <b>Status:</b> {activeEvent.status}
                    {activeEvent.status === AUDIT_INVALID_STATUS_LABEL &&
                      activeEvent.rawStatus && (
                        <div>
                          <b>Nilai Asli:</b> {activeEvent.rawStatus}
                        </div>
                      )}
                    </div>
                    <div>
                      <b>Start:</b>{" "}
                      {activeEvent?.isStartUnknown ? (
                        <em>{AUDIT_EMPTY_LABEL}</em>
                      ) : activeEvent?.start ? (
                        activeEvent.start.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      ) : (
                        "-"
                      )}
                    </div>

                    <div>
                      <b>End:</b>{" "}
                      {activeEvent?.isEndUnknown ? (
                        <em>{AUDIT_EMPTY_LABEL}</em>
                      ) : activeEvent?.rawEnd ? (
                        activeEvent.rawEnd.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      ) : (
                        "-"
                      )}
                    </div>
                  </PopoverBody>
                </div>
              </Popover>
            )}
        </div>

        <ZoomINControl
          className="mt-0"
          hideButtons={["expand"]}
          expanded={expanded}
          setExpanded={setExpanded}
          setFullscreen={setFullscreen}
          onZoomIn={() => changeViewZoom("in")}
          onZoomOut={() => changeViewZoom("out")}
          onReset={resetView}
        />
      </Card>
    </div>
  );
}


