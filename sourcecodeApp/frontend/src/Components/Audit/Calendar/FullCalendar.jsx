/*
 * PGH-DOC
 * File: src/Components/Audit/Calendar/FullCalendar.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from "axios";
import "../Timeline/FCRT.css";
import "./eventCalendar.css";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  Card,
} from "@pgh/ui-bootstrap";
import { ChevronLeft, ChevronRight } from "react-feather";
import { useAuth } from "../../../Auth/AuthContext";
import { canEditPath, isReadOnlyUser } from "../../../Auth/accessControl";

const API_URL = `${process.env.REACT_APP_API_BASE_URL}CalendarEvents`;
const CALENDAR_VIEWS = [
  { key: "yearView", label: "Year" },
  { key: "quarterView", label: "Quarter" },
  { key: "dayGridMonth", label: "Month" },
  { key: "thisWeek", label: "Week" },
];

const createStartOfDay = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const alignCalendarDateToView = (value, viewKey) => {
  const date = createStartOfDay(value);

  switch (viewKey) {
    case "yearView":
      return new Date(date.getFullYear(), 0, 1);
    case "quarterView":
      return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
    case "dayGridMonth":
      return new Date(date.getFullYear(), date.getMonth(), 1);
    case "thisWeek": {
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

const addCalendarStep = (value, viewKey, step) => {
  const date = alignCalendarDateToView(value, viewKey);

  switch (viewKey) {
    case "yearView":
      date.setFullYear(date.getFullYear() + step);
      return date;
    case "quarterView":
      date.setMonth(date.getMonth() + step * 3);
      return date;
    case "dayGridMonth":
      date.setMonth(date.getMonth() + step);
      return date;
    case "thisWeek":
      date.setDate(date.getDate() + step * 7);
      return date;
    default:
      return date;
  }
};

export default function CalendarAudit() {
  const { user } = useAuth();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: null,
    title: "",
    desc: "",
    date: "",
      time: "",
      place: "",
      color: "#e67e22",
  });
  const calendarRef = useRef(null);
  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [calendarToolbarState, setCalendarToolbarState] = useState({
    title: "",
    rangeStart: null,
    rangeEnd: null,
  });
  const requestSequenceRef = useRef(0);
  const canManageCalendar =
    !isReadOnlyUser(user) && canEditPath(user, location.pathname);
  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const localToUTC = useCallback((localString) => {
    if (!localString) return null;

    return new Date(localString).toISOString();
  }, []);

  const utcToLocal = useCallback((utcString) => {
    if (!utcString) return null;

    const date = new Date(`${utcString}Z`);
    const pad = (value) => (value < 10 ? `0${value}` : value);

    return (
      `${date.getFullYear()}-` +
      `${pad(date.getMonth() + 1)}-` +
      `${pad(date.getDate())}T` +
      `${pad(date.getHours())}:` +
      `${pad(date.getMinutes())}:` +
      `${pad(date.getSeconds())}`
    );
  }, []);

  const sortCalendarEvents = useCallback((items) => {
    return [...items].sort((left, right) => {
      const leftTime = left?.start ? new Date(left.start).getTime() : 0;
      const rightTime = right?.start ? new Date(right.start).getTime() : 0;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return String(left?.title ?? "").localeCompare(String(right?.title ?? ""));
    });
  }, []);

  const buildCalendarEvent = useCallback((row) => {
    if (!row?.StartDateTime) {
      return null;
    }

    return {
      id: String(row.Id ?? ""),
      title: row.Title ?? "",
      start: utcToLocal(row.StartDateTime),
      desc: row.Description ?? "",
      place: row.Place ?? "",
      color: row.Color || "#f15a22",
      editable: canManageCalendar,
    };
  }, [canManageCalendar, utcToLocal]);

  const isEventInsideCurrentRange = useCallback((eventStart) => {
    if (!eventStart) {
      return false;
    }

    const eventDate = new Date(eventStart);
    if (Number.isNaN(eventDate.getTime())) {
      return false;
    }

    const rangeStart = calendarToolbarState.rangeStart;
    const rangeEnd = calendarToolbarState.rangeEnd;

    if (!(rangeStart instanceof Date) || !(rangeEnd instanceof Date)) {
      return true;
    }

    return eventDate >= rangeStart && eventDate < rangeEnd;
  }, [calendarToolbarState.rangeEnd, calendarToolbarState.rangeStart]);

  const upsertCalendarEvent = useCallback((nextEvent) => {
    if (!nextEvent?.id) {
      return;
    }

    setEvents((currentEvents) => {
      const nextItems = currentEvents.filter((item) => String(item.id) !== String(nextEvent.id));

      if (isEventInsideCurrentRange(nextEvent.start)) {
        nextItems.push(nextEvent);
      }

      return sortCalendarEvents(nextItems);
    });
  }, [isEventInsideCurrentRange, sortCalendarEvents]);

  const removeCalendarEvent = useCallback((eventId) => {
    if (!eventId) {
      return;
    }

    setEvents((currentEvents) =>
      currentEvents.filter((item) => String(item.id) !== String(eventId)),
    );
  }, []);

  const fetchCrudEvents = useCallback(async (rangeStart, rangeEnd) => {
    if (!(rangeStart instanceof Date) || !(rangeEnd instanceof Date)) {
      return;
    }

    const sequence = ++requestSequenceRef.current;

    try {
      const response = await axios.get(API_URL, {
        withCredentials: true,
        params: {
          rangeStart: rangeStart.toISOString(),
          rangeEnd: rangeEnd.toISOString(),
        },
      });

      if (sequence !== requestSequenceRef.current) {
        return;
      }

      const rows = Array.isArray(response.data)
        ? response.data
        : response.data?.rows || response.data?.data || [];

      const mappedEvents = sortCalendarEvents(
        rows
          .map((row) => buildCalendarEvent(row))
          .filter(Boolean),
      );

      setEvents(mappedEvents);
    } catch (error) {
      if (sequence !== requestSequenceRef.current) {
        return;
      }
      console.error("CRUD fetch failed:", error);
    }
  }, [buildCalendarEvent, sortCalendarEvents]);

  useEffect(() => {
    fetchCrudEvents(
      calendarToolbarState.rangeStart,
      calendarToolbarState.rangeEnd,
    );
  }, [
    calendarToolbarState.rangeEnd,
    calendarToolbarState.rangeStart,
    fetchCrudEvents,
  ]);

  const getDateTime = () =>
    eventForm.date && eventForm.time
      ? `${eventForm.date}T${eventForm.time}`
      : "";

  const handleChange = (event) => {
    setEventForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleDateClick = (info) => {
    if (!canManageCalendar) return;
    setEventForm({
      id: null,
      title: "",
      desc: "",
      date: info.dateStr,
      time: "09:00",
      place: "",
      color: "#e67e22",
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleEventClick = (info) => {
    const selectedEvent = events.find((event) => event.id === info.event.id);
    if (!selectedEvent) return;

    const [datePart, timePart] = selectedEvent.start.split("T");

    setEventForm({
      id: selectedEvent.id,
      title: selectedEvent.title,
      desc: selectedEvent.desc,
      date: datePart,
      time: timePart?.slice(0, 5) || "09:00",
      place: selectedEvent.place,
      color: selectedEvent.color,
    });

    setIsEditing(canManageCalendar);
    setModalOpen(true);
  };

  const saveEvent = async () => {
    if (!canManageCalendar) return;
    try {
      const response = await axios.post(
        API_URL,
        {
          Title: eventForm.title,
          Description: eventForm.desc,
          StartDateTime: localToUTC(getDateTime()),
          Place: eventForm.place,
          Color: eventForm.color,
        },
        { withCredentials: true }
      );

      const nextEvent = buildCalendarEvent(response.data);
      if (nextEvent) {
        upsertCalendarEvent(nextEvent);
      }
      setModalOpen(false);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  const updateEvent = async () => {
    if (!canManageCalendar) return;
    try {
      const response = await axios.patch(
        `${API_URL}/${eventForm.id}`,
        {
          Title: eventForm.title,
          Description: eventForm.desc,
          StartDateTime: localToUTC(getDateTime()),
          Place: eventForm.place,
          Color: eventForm.color,
        },
        { withCredentials: true }
      );

      const nextEvent = buildCalendarEvent(response.data?.entity ?? response.data);
      if (nextEvent) {
        upsertCalendarEvent(nextEvent);
      } else {
        removeCalendarEvent(eventForm.id);
      }
      setModalOpen(false);
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const deleteEvent = async () => {
    if (!canManageCalendar) return;
    try {
      await axios.delete(`${API_URL}/${eventForm.id}`, {
        withCredentials: true,
      });
      removeCalendarEvent(eventForm.id);
      setModalOpen(false);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleEventDrop = async (info) => {
    if (!canManageCalendar) {
      info.revert();
      return;
    }
    try {
      const newStart = info.event.start;
      const newEnd = info.event.end;

      const response = await axios.patch(
        `${API_URL}/${info.event.id}`,
        {
          StartDateTime: newStart ? newStart.toISOString() : null,
          EndDateTime: newEnd ? newEnd.toISOString() : null,
        },
        { withCredentials: true }
      );
      const nextEvent = buildCalendarEvent(response.data?.entity ?? response.data);
      if (nextEvent) {
        upsertCalendarEvent(nextEvent);
      } else {
        removeCalendarEvent(info.event.id);
      }
    } catch (error) {
      console.error("Drag update failed:", error);
      info.revert();
    }
  };

  const isTodayInCurrentRange =
    calendarToolbarState.rangeStart instanceof Date &&
    calendarToolbarState.rangeEnd instanceof Date &&
    new Date() >= calendarToolbarState.rangeStart &&
    new Date() < calendarToolbarState.rangeEnd;

  const handleCalendarNavigate = (direction) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const activeView = api.view?.type || currentView;
    const baseDate =
      api.view?.currentStart ||
      (calendarToolbarState.rangeStart instanceof Date
        ? calendarToolbarState.rangeStart
        : new Date());

    const targetDate = addCalendarStep(
      baseDate,
      activeView,
      direction === "prev" ? -1 : 1,
    );
    api.gotoDate(targetDate);
  };

  const handleCalendarToday = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    api.gotoDate(alignCalendarDateToView(new Date(), api.view?.type || currentView));
  };

  const handleCalendarViewChange = (nextView) => {
    const api = calendarRef.current?.getApi();
    if (!api || !nextView) return;
    const baseDate =
      api.view?.currentStart ||
      (calendarToolbarState.rangeStart instanceof Date
        ? calendarToolbarState.rangeStart
        : new Date());

    api.changeView(nextView, alignCalendarDateToView(baseDate, nextView));
  };

  return (
    <div>
      <Card className="p-3 audit-calendar-card">
        <div className="audit-calendar-toolbar" aria-label="Event calendar navigation">
          <div className="audit-calendar-toolbar__nav">
            <Button
              type="button"
              color="light"
              className="audit-calendar-toolbar__icon-btn"
              onClick={() => handleCalendarNavigate("prev")}
              aria-label="Periode sebelumnya"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              type="button"
              color="light"
              className={`audit-calendar-toolbar__today ${
                isTodayInCurrentRange ? "is-current" : ""
              }`}
              onClick={handleCalendarToday}
            >
              Today
            </Button>
            <Button
              type="button"
              color="light"
              className="audit-calendar-toolbar__icon-btn"
              onClick={() => handleCalendarNavigate("next")}
              aria-label="Periode berikutnya"
            >
              <ChevronRight size={16} />
            </Button>
          </div>

          <div className="audit-calendar-toolbar__title">
            {calendarToolbarState.title || "Event Calendar"}
          </div>

          <div className="audit-calendar-toolbar__views">
            {CALENDAR_VIEWS.map((view) => (
              <Button
                key={view.key}
                type="button"
                color="light"
                className={`audit-calendar-toolbar__view-btn ${
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
          ref={calendarRef}
          height={400}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={false}
          firstDay={1}
          fixedWeekCount={false}
          dayMaxEvents={3}
          datesSet={(arg) => {
            setCurrentView((prev) => (prev === arg.view.type ? prev : arg.view.type));
            setCalendarToolbarState((prev) => {
              const nextStart =
                arg.view.currentStart?.getTime?.() ?? arg.start?.getTime?.() ?? null;
              const nextEnd =
                arg.view.currentEnd?.getTime?.() ?? arg.end?.getTime?.() ?? null;
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
          }}
          selectable={canManageCalendar}
          editable={canManageCalendar}
          events={events}
          dateClick={canManageCalendar ? handleDateClick : undefined}
          eventClick={handleEventClick}
          eventDrop={canManageCalendar ? handleEventDrop : undefined}
          views={{
            quarterView: {
              type: "dayGrid",
              buttonText: "Quarter",
              duration: { months: 3 },
              dateIncrement: { months: 3 },
              dateAlignment: "month",
              showNonCurrentDates: true,
            },
            yearView: {
              type: "dayGrid",
              buttonText: "Year",
              duration: { years: 1 },
              dateIncrement: { years: 1 },
              dateAlignment: "year",
              showNonCurrentDates: true,
            },
            thisWeek: {
              type: "dayGrid",
              buttonText: "Week",
              duration: { weeks: 1 },
              dateIncrement: { weeks: 1 },
              dateAlignment: "week",
              dayHeaderFormat: { weekday: "short", day: "numeric", month: "short" },
              showNonCurrentDates: true,
            },
          }}
        />

        <Modal
          isOpen={modalOpen}
          toggle={closeModal}
          className="table-utility-modal calendar-event-modal"
          backdropClassName="table-utility-backdrop"
          zIndex={1400}
        >
          <ModalHeader toggle={closeModal}>
            {canManageCalendar ? (isEditing ? "Edit Event" : "Add Event") : "Event Detail"}
          </ModalHeader>

          <ModalBody>
            <Form>
              <FormGroup>
                <Label>Title</Label>
                <Input
                  name="title"
                  value={eventForm.title}
                  onChange={handleChange}
                  disabled={!canManageCalendar}
                />
              </FormGroup>

              <FormGroup>
                <Label>Description</Label>
                <Input
                  type="textarea"
                  name="desc"
                  value={eventForm.desc}
                  onChange={handleChange}
                  disabled={!canManageCalendar}
                />
              </FormGroup>

              <FormGroup>
                <Label>Date</Label>
                <Input
                  type="date"
                  name="date"
                  value={eventForm.date}
                  onChange={handleChange}
                  disabled={!canManageCalendar}
                />
              </FormGroup>

              <FormGroup>
                <Label>Time</Label>
                <Input
                  type="time"
                  name="time"
                  value={eventForm.time}
                  onChange={handleChange}
                  disabled={!canManageCalendar}
                />
              </FormGroup>

              <FormGroup>
                <Label>Place</Label>
                <Input
                  name="place"
                  value={eventForm.place}
                  onChange={handleChange}
                  disabled={!canManageCalendar}
                />
              </FormGroup>

              <FormGroup>
                <Label>Color</Label>
                <Input
                  type="color"
                  name="color"
                  value={eventForm.color}
                  onChange={handleChange}
                  disabled={!canManageCalendar}
                />
              </FormGroup>
            </Form>
          </ModalBody>

          <ModalFooter>
            {canManageCalendar ? (
              <>
                {isEditing && (
                  <Button
                    color="light"
                    className="table-header-action table-header-action--danger calendar-event-modal__action"
                    onClick={deleteEvent}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  color="light"
                  className="table-header-action table-header-action--primary calendar-event-modal__action"
                  onClick={isEditing ? updateEvent : saveEvent}
                >
                  {isEditing ? "Update" : "Save"}
                </Button>
              </>
            ) : null}
            <Button
              color="light"
              className="table-header-action calendar-event-modal__action"
              onClick={closeModal}
            >
              {canManageCalendar ? "Cancel" : "Close"}
            </Button>
          </ModalFooter>
        </Modal>
      </Card>
    </div>
  );
}
