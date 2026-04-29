/*
 * PGH-DOC

 * File: src/Variables/Cells/EditableTextAreaOri.jsx

 * Apa fungsi bagian ini:

 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).

 * Kenapa perlu:

 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.

 * Aturan khususnya apa:

 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.

 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.

 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useState, useRef, useEffect } from "react";

// 🧮 Utility functions — you can move these to utils/formatUtils.js later
import { isNumericValue, formatNumericValue } from "../utils/numericformat";
const EditableTextarea = React.memo(
  ({
    value,
    onCommit,
      canEdit,          // 👈 ADD THIS
    onCancel,
    style,
    saveOnEnter = true,
    ctrlEnterSaves = true,
    shiftEnterNewline = true,
    commitOnBlur = true,
    allValues = [],
    ...rest
  }) => {
    const textareaRef = useRef(null);
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value ?? "");
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    /* Sync external value */
    useEffect(() => {
      if (!editing) setText(value ?? "");
    }, [value, editing]);

    /* Auto-resize */
    useEffect(() => {
      if (editing && textareaRef.current) {
        const el = textareaRef.current;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    }, [editing, text]);

    const commit = () => {
      if (text !== value) onCommit?.(text);
      setEditing(false);
      setSuggestions([]);
      setShowDropdown(false);
    };

    const cancel = () => {
      setText(value ?? "");
      onCancel?.();
      setEditing(false);
      setSuggestions([]);
      setShowDropdown(false);
    };

    /* 🔍 Live suggestions */
    const handleChange = (e) => {
      const val = e.target.value;
      setText(val);

      if (!val) {
        const top = Array.from(new Set(allValues.filter(Boolean))).slice(0, 5);
        setSuggestions(top);
        return;
      }

      const filtered = Array.from(
        new Set(
          allValues
            .filter(
              (v) =>
                v &&
                typeof v === "string" &&
                v.toLowerCase().includes(val.toLowerCase()) &&
                v.toLowerCase() !== val.toLowerCase()
            )
        )
      ).slice(0, 5);

      setSuggestions(filtered);
      setShowDropdown(true);
    };

    const handleSelectSuggestion = (s) => {
      setText(s);
      setSuggestions([]);
      setShowDropdown(false);
      onCommit?.(s);
      setEditing(false);
    };

    const toggleDropdown = () => {
      if (showDropdown) {
        setShowDropdown(false);
      } else {
        const top = Array.from(new Set(allValues.filter(Boolean))).slice(0, 5);
        setSuggestions(top);
        setShowDropdown(true);
      }
    };

    return editing ? (
      <div
        style={{
          position: "relative",
          width: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onBlur={() => {
            if (commitOnBlur) commit();
          }}
          onKeyDown={(e) => {
            if (ctrlEnterSaves && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              commit();
              return;
            }
            if (saveOnEnter && e.key === "Enter" && !(shiftEnterNewline && e.shiftKey)) {
              e.preventDefault();
              commit();
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          autoFocus
          rows={1}
          style={{
            resize: "none",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "transparent",
            width: "100%",
            paddingRight: "20px",
            maxWidth: style?.maxWidth || "400px",
            color: "inherit",
            ...style,
          }}
          {...rest}
        />

        {/* ▼ dropdown trigger */}
        <span
          onMouseDown={(e) => {
            e.preventDefault();
            toggleDropdown();
          }}
          style={{
            position: "absolute",
            right: "4px",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "14px",
            color: "#777",
          }}
        >
          ▼
        </span>

        {/* Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <ul
            className="list-group position-absolute"
            style={{
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 1035,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "4px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              maxHeight: "150px",
              overflowY: "auto",
              marginTop: "2px",
            }}
          >
            {suggestions.map((s, i) => (
              <li
                key={i}
                className="list-group-item list-group-item-action"
                onMouseDown={() => handleSelectSuggestion(s)}
                style={{
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: "13px",
                  lineHeight: "1.3",
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    ) : (
      <div
        style={{
          resize: "none",
          overflow: "hidden",
          width: "100%",
          maxWidth: "400px",
          minHeight: "1em",
          border: "none",
          background: "transparent",
          fontSize: "14px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: "1.2",
          fontWeight: "normal",
          color: "inherit",
          textAlign: isNumericValue(value) ? "right" : "left",
        }}
        onClick={() => {
          setEditing(true);
          const top = Array.from(new Set(allValues.filter(Boolean))).slice(0, 5);
          setSuggestions(top);
          setShowDropdown(true);
        }}
      >
        {isNumericValue(value) ? formatNumericValue(value) : text}
      </div>
    );
  }
);

export default EditableTextarea;
