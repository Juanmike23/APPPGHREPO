/*
 * PGH-DOC
 * File: src/Variables/Cells/DateCell.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useState, useEffect, useId, useRef } from "react";
import { Input, Popover, PopoverBody } from "@pgh/ui-bootstrap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "react-toastify";
import { renderHighlightedText } from "../Table/filters/highlight";

/* -------------------------------------------------------------
   🧮 Utility checks
------------------------------------------------------------- */
export const isDateValue = (val) => {
  if (!val) return false;

  if (val instanceof Date && !isNaN(val)) return true;

  if (typeof val === "string") {
    val = val.trim();

    // 1️⃣ ISO format: 2025-01-01
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return true;

    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return !isNaN(new Date(val));

    // 2️⃣ Numeric dash format: 01-12-2025
    const dash = val.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (dash) {
      const [, d, m, y] = dash.map(Number);
      const year = y < 100 ? 2000 + y : y;
      const parsed = new Date(year, m - 1, d);
      return (
        parsed.getFullYear() === year &&
        parsed.getMonth() === m - 1 &&
        parsed.getDate() === d
      );
    }

    // 3️⃣ Day-MonthName-Year with dash or space: 01-Jan-2025 or 01 Jan 2025
    const monthMap = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };

    const textual = val.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/);
    if (textual) {
      const [, dStr, mStr, yStr] = textual;
      const monthIndex = monthMap[mStr.toUpperCase()];
      if (monthIndex === undefined) return false;

      const d = parseInt(dStr, 10);
      const y = parseInt(yStr, 10) < 100 ? 2000 + parseInt(yStr, 10) : parseInt(yStr, 10);

      const parsed = new Date(y, monthIndex, d);
      return (
        parsed.getFullYear() === y &&
        parsed.getMonth() === monthIndex &&
        parsed.getDate() === d
      );
    }
  }

  return false;
};

// export const isDateValue = (val) => {
//   if (!val) return false;

//   if (val instanceof Date && !isNaN(val)) return true;

//   if (typeof val === "string") {
//     if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return true;
//     if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return !isNaN(new Date(val));

//     if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(val)) return true;

//     const dash = val.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
//     if (dash) {
//       const [, d, m, y] = dash.map(Number);
//       const year = y < 100 ? 2000 + y : y;
//       const parsed = new Date(year, m - 1, d);
//       return (
//         parsed.getFullYear() === year &&
//         parsed.getMonth() === m - 1 &&
//         parsed.getDate() === d
//       );
//     }
//   }
//   return false;
// };
/* -------------------------------------------------------------
   ✅ Date-only serializer (NO TIMEZONE BUG)
------------------------------------------------------------- */
const toDateOnly = (date) => date.toLocaleDateString("en-CA"); // YYYY-MM-DD

const hasTimeComponent = (value) => {
  if (!value) return false;

  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}T/.test(value.trim());
  }

  if (value instanceof Date && !isNaN(value)) {
    return (
      value.getHours() !== 0 ||
      value.getMinutes() !== 0 ||
      value.getSeconds() !== 0
    );
  }

  return false;
};

const formatDisplayDate = (value) => {
  if (!value) return "";

  let parsedDate;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, day] = value.split("-").map(Number);
    parsedDate = new Date(y, m - 1, day);
  } else {
    parsedDate = new Date(value);
  }

  if (isNaN(parsedDate)) return String(value);

  if (hasTimeComponent(value)) {
    return parsedDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/* -------------------------------------------------------------
   📅 Editable DateCell — text input + calendar
------------------------------------------------------------- */
const DateCellEditable = ({
  value,
  onChange,
  uniqueId,
  canEdit = true,
  searchQuery = "",
  highlightSearch = false,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [hasError, setHasError] = useState(false);
  const [originalValue, setOriginalValue] = useState("");

  const inputRef = useRef(null);
  const popoverRef = useRef(null);

  const autoId = useId();
  const safeId = (uniqueId ?? autoId).replace(/[^a-zA-Z0-9_-]/g, "-");

  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!value) {
      setSelectedDate(null);
      setTextValue("");
      setOriginalValue(""); // remember original
      return;
    }

    let d;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, day] = value.split("-").map(Number);
      d = new Date(y, m - 1, day);
    } else {
      d = new Date(value);
    }

    if (!isNaN(d)) {
      const display = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      setSelectedDate(d);
      setTextValue(display);
      setOriginalValue(display); // store original
      setHasError(false);
    }
  }, [value]);

  /* ─────────────────────────
     Sync external value
  ───────────────────────── */
  useEffect(() => {
    if (value) {
      let d;

      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, day] = value.split("-").map(Number);
        d = new Date(y, m - 1, day);
      } else {
        d = new Date(value);
      }

      if (!isNaN(d)) {
        setTextValue(
          d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        );
        return;
      }
    }
    setTextValue("");
  }, [value]);

  /* ─────────────────────────
     Manual typing
  ───────────────────────── */

  const handleKeyDown = (e) => {
  if (e.key === "Enter") {
    handleBlur(); // reuse your blur logic to parse
    inputRef.current.blur(); // optional: remove focus after Enter
  }
};
 const handleTextChange = (e) => {
  setTextValue(e.target.value); // just update the text
  setHasError(false); // optional: remove error while typing
};


  const handleBlur = () => {
  const val = textValue.trim();
  if (val === "") {
    setSelectedDate(null);
    onChange?.(null);
    return;
  }

  let parsed = null;

  // 1️⃣ ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    parsed = new Date(val);
  } else {
    // 2️⃣ dd-MMM-yy or dd-MMM-yyyy
    const parts = val.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2}|\d{4})$/);
    if (parts) {
      const [, day, monthStr, yearStr] = parts;
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());

      if (monthIndex >= 0) {
        let year = Number(yearStr);
        if (year < 100) year += 2000; // convert 2-digit year
        parsed = new Date(Number(year), monthIndex, Number(day));
      }
    }
  }

  if (parsed && !isNaN(parsed)) {
    setSelectedDate(parsed);
    setHasError(false);

    const display = parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    setTextValue(display);

    const patchVal = `${("0"+parsed.getDate()).slice(-2)}-${parsed.toLocaleString("en-GB",{month:"short"})}-${parsed.getFullYear()}`;
    onChange?.(patchVal);
  } else {
    setHasError(true);

      // Show a toast immediately
  toast.error("Invalid date format! Please use dd-mmm-yy or dd-mmm-yyyy.", {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: "colored",
  });


    // reset after small delay or immediately
    setTimeout(() => {
      setTextValue(originalValue);
      setHasError(false);
    }, 1000);
  }
};
  /* ─────────────────────────
     Calendar pick
  ───────────────────────── */
  const handleCalendarChange = (date) => {
    if (date) {
      setSelectedDate(date); // 👈 update calendar state
      onChange?.(toDateOnly(date)); // send to parent
      setTextValue(
        date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      );
    }
    setPopoverOpen(false);
  };

  /* ─────────────────────────
     Click outside → close
  ───────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      const inputEl = inputRef.current;

      // ✅ allow clicks inside input
      if (inputEl?.contains(e.target)) return;

      // ✅ allow clicks inside react-datepicker (prev/next, days, header)
      if (e.target.closest(".react-datepicker")) return;

      // ❌ real outside click
      setPopoverOpen(false);
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!canEdit) {
    const readOnlyDisplay = formatDisplayDate(value) || "-";

    return (
      <div style={{ minWidth: "140px" }}>
        {highlightSearch
          ? renderHighlightedText(readOnlyDisplay, searchQuery)
          : readOnlyDisplay}
      </div>
    );
  }

  return (
    <>
   <Input
  innerRef={inputRef}
  id={`date-input-${safeId}`}
  type="text"
  value={textValue}
  onChange={handleTextChange}  // just update text
  onBlur={handleBlur}          // parse only on blur
  onKeyDown={handleKeyDown}    // parse on Enter
  onFocus={() => setPopoverOpen(true)}
  onClick={() => setPopoverOpen(true)}
  placeholder="dd-mmm-yyyy"
  className="w-100 text-center"
  style={{
    width: "100%",
    minWidth: 0,
    fontSize: "0.9rem",
    cursor: "pointer",
    color: hasError ? "blue" : "inherit",
  }}
/>

      <Popover
        isOpen={popoverOpen}
        target={`date-input-${safeId}`}
        placement="bottom-start"
        trigger="legacy"
      >
        <PopoverBody ref={popoverRef} className="p-0">
          <DatePicker
            inline
            selected={selectedDate} // 👈 fully controlled
            onChange={handleCalendarChange}
          />
        </PopoverBody>
      </Popover>
    </>
  );
};

export default DateCellEditable;

export const isDateColumn = (col) => /(^|_)(tgl|date|tempo|fixedtanggalforalltable)($|_)/i.test(col);
