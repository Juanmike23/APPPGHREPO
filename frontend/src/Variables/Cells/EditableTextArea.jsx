/*
 * PGH-DOC
 * File: src/Variables/Cells/EditableTextArea.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  isNumericValue,
  isPercentageValue,
  formatNumericValue,
  formatNumericCompactMillion,
} from "../utils/numericformat";
import {
  isNonFormattableColumn,
  isPercentageColumn,
} from "../utils/numericFormatRules";
import { renderHighlightedText } from "../Table/filters/highlight";

const INLINE_FORMAT_TAG_STRIP_PATTERN = /<\/?(b|i|u)>/gi;
const EDITOR_HISTORY_LIMIT = 100;
const EDITOR_NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
const DROPDOWN_BOUNDARY_SELECTOR =
  ".ag-body-viewport, .table-content-shell, .sticky-table-wrapper, .table-responsive, .modal-body";

const stripInlineFormatTags = (value) =>
  String(value ?? "").replace(INLINE_FORMAT_TAG_STRIP_PATTERN, "");

const hasExplicitPercentageSymbol = (value) =>
  typeof value === "string" && String(value).trim().endsWith("%");

const numericThousandsCommaPattern = /^-?\d{1,3}(,\d{3})+$/;
const numericThousandsDotPattern = /^-?\d{1,3}(\.\d{3})+$/;

const normalizeNumericToken = (raw) => {
  if (raw == null) return "";
  const token = String(raw).trim();
  if (!token) return "";

  const hasDot = token.includes(".");
  const hasComma = token.includes(",");

  if (hasDot && hasComma) {
    const lastDot = token.lastIndexOf(".");
    const lastComma = token.lastIndexOf(",");
    return lastComma > lastDot
      ? token.replaceAll(".", "").replaceAll(",", ".")
      : token.replaceAll(",", "");
  }

  if (hasComma) {
    if (numericThousandsCommaPattern.test(token)) {
      return token.replaceAll(",", "");
    }
    return token.replaceAll(",", ".");
  }

  if (hasDot && numericThousandsDotPattern.test(token)) {
    return token.replaceAll(".", "");
  }

  return token;
};

const toDisplayPercentage = (value, formatOptions = null) => {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).replace("%", "").replace(",", ".").trim();
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return String(value);

  const options =
    formatOptions && typeof formatOptions === "object"
      ? formatOptions
      : { minimumFractionDigits: 0, maximumFractionDigits: 2 };

  return `${formatNumericValue(numeric, options)}%`;
};

const isRectOutsideBoundary = (rect, boundaryRect, threshold = 6) =>
  rect.bottom <= boundaryRect.top + threshold ||
  rect.top >= boundaryRect.bottom - threshold ||
  rect.right <= boundaryRect.left + threshold ||
  rect.left >= boundaryRect.right - threshold;

const getLineContinuationPrefix = (line) => {
  const numericMatch = line.match(/^(\s*)(\d+)([.)])\s+/);
  if (numericMatch) {
    const [, indent, rawNumber, separator] = numericMatch;
    return `${indent}${Number(rawNumber) + 1}${separator} `;
  }

  const bulletMatch = line.match(/^(\s*)([-*]|\u2022)\s+/);
  if (bulletMatch) {
    const [, indent, bullet] = bulletMatch;
    return `${indent}${bullet} `;
  }

  return "";
};

const selectNodeText = (element) => {
  if (typeof window === "undefined" || !element) return;
  const selection = window.getSelection?.();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
};

const normalizeSuggestionOption = (entry) => {
  if (entry === null || entry === undefined) return null;

  if (typeof entry === "object") {
    const value = String(entry.value ?? entry.label ?? "").trim();
    if (!value) return null;

    const label = String(entry.label ?? value).trim() || value;
    const key = String(entry.key ?? entry.dedupeKey ?? `${label}__${value}`).trim() || `${label}__${value}`;
    return { value, label, key };
  }

  const text = String(entry).trim();
  if (!text) return null;
  return { value: text, label: text, key: `${text}__${text}` };
};

const buildSuggestionOptions = (entries) => {
  const normalized = (Array.isArray(entries) ? entries : [])
    .map(normalizeSuggestionOption)
    .filter(Boolean);

  const seen = new Set();
  return normalized.filter((item) => {
    const key = String(item.key ?? `${item.label ?? ""}__${item.value ?? ""}`)
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const EditableTextarea = React.memo(
  ({
    onTabNext,
    onTabPrev,
    externalEdit,
    onExternalEditConsumed,
    value,
    column,
    onCommit,
    canEdit,
    onCancel,
    style,
    saveOnEnter = true,
    ctrlEnterSaves = true,
    shiftEnterNewline = true,
    commitOnBlur = true,
    allValues = [],
    enableMillionFormat = false,
    numericFormatOptions = null,
    onReadOnlyClick = null,
    multiline,
    searchQuery = "",
    highlightSearch = false,
    ...rest
  }) => {
    const textareaRef = useRef(null);
    const wrapperRef = useRef(null);
    const dropdownListRef = useRef(null);
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const selectAllOnEditRef = useRef(false);
    const blurCommitLockRef = useRef(false);
    const blurCommitReleaseTimerRef = useRef(null);

    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(stripInlineFormatTags(value ?? ""));
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [dropdownPosition, setDropdownPosition] = useState(null);

    const isMultilineEditor =
      typeof multiline === "boolean"
        ? multiline
        : true;
    const effectiveSaveOnEnter = saveOnEnter;
    const suggestionOptions = buildSuggestionOptions(allValues);

    const shouldFormatNumber = (rawValue, columnName) =>
      isNumericValue(rawValue) && !isNonFormattableColumn(columnName);

    const shouldFormatPercentage = (rawValue, columnName) =>
      hasExplicitPercentageSymbol(rawValue) ||
      (isPercentageColumn(columnName) &&
        (isPercentageValue(rawValue) || isNumericValue(rawValue)));

    const rawDisplayValue = shouldFormatPercentage(value, column)
      ? toDisplayPercentage(value, numericFormatOptions || undefined)
      : shouldFormatNumber(value, column)
        ? enableMillionFormat
          ? formatNumericCompactMillion(value)
          : formatNumericValue(value, numericFormatOptions || undefined)
        : typeof value === "number"
          ? String(value)
          : stripInlineFormatTags(value ?? "");

    const renderedDisplayValue = highlightSearch
      ? renderHighlightedText(rawDisplayValue, searchQuery)
      : rawDisplayValue;

    const closeSuggestionDropdown = useCallback(() => {
      setShowDropdown(false);
      setActiveIndex(-1);
      setDropdownPosition(null);
    }, []);

    const lockBlurCommitForCurrentCycle = useCallback(() => {
      blurCommitLockRef.current = true;
      if (blurCommitReleaseTimerRef.current) {
        window.clearTimeout(blurCommitReleaseTimerRef.current);
      }
      blurCommitReleaseTimerRef.current = window.setTimeout(() => {
        blurCommitLockRef.current = false;
        blurCommitReleaseTimerRef.current = null;
      }, 0);
    }, []);

    useEffect(() => {
      if (!canEdit) {
        setEditing(false);
        return;
      }

      setEditing(Boolean(externalEdit));
    }, [canEdit, externalEdit]);

    useEffect(() => {
      if (!editing) {
        setText(
          typeof value === "number"
            ? String(value)
            : stripInlineFormatTags(value ?? ""),
        );
      }
    }, [editing, value]);

    useEffect(() => {
      if (!editing) {
        historyRef.current = [];
        historyIndexRef.current = -1;
        return;
      }

      const initialValue =
        typeof value === "number"
          ? String(value)
          : stripInlineFormatTags(value ?? "");
      const initialCursor = initialValue.length;
      historyRef.current = [
        {
          value: initialValue,
          selectionStart: initialCursor,
          selectionEnd: initialCursor,
        },
      ];
      historyIndexRef.current = 0;
    }, [editing, value]);

    useEffect(() => {
      if (editing && textareaRef.current) {
        const element = textareaRef.current;
        element.style.height = "auto";
        element.style.height = `${element.scrollHeight}px`;
      }
    }, [editing, text]);

    useEffect(() => {
      if (!editing || !selectAllOnEditRef.current) return;

      selectAllOnEditRef.current = false;
      requestAnimationFrame(() => {
        const element = textareaRef.current;
        if (!element) return;
        element.focus();
        element.setSelectionRange(0, element.value.length);
      });
    }, [editing]);

    useEffect(() => {
      setActiveIndex(-1);
    }, [suggestions]);

    const updateDropdownPosition = useCallback(() => {
      if (!editing || !showDropdown || suggestions.length === 0) {
        setDropdownPosition(null);
        return;
      }

      const wrapper = wrapperRef.current;
      const rect = wrapper?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        closeSuggestionDropdown();
        return;
      }

      const viewportPadding = 12;
      const viewportRect = {
        top: 0,
        left: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      };
      if (isRectOutsideBoundary(rect, viewportRect, viewportPadding)) {
        closeSuggestionDropdown();
        return;
      }

      const boundaryElement = wrapper?.closest(DROPDOWN_BOUNDARY_SELECTOR);
      const boundaryRect = boundaryElement?.getBoundingClientRect?.();
      if (
        boundaryRect &&
        isRectOutsideBoundary(rect, boundaryRect, 4)
      ) {
        closeSuggestionDropdown();
        return;
      }

      const estimatedHeight = 188;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward =
        spaceBelow < estimatedHeight && rect.top > estimatedHeight;

      const desiredWidth = Math.max(rect.width, 240);
      const maxWidth = Math.max(240, Math.min(window.innerWidth - 24, 480));
      const width = Math.min(desiredWidth, maxWidth);
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding),
      );

      setDropdownPosition({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left,
        width,
        placement: openUpward ? "top" : "bottom",
      });
    }, [editing, showDropdown, suggestions.length, closeSuggestionDropdown]);

    useEffect(() => {
      updateDropdownPosition();
      return undefined;
    }, [text, updateDropdownPosition]);

    useEffect(() => {
      if (!editing || !showDropdown) {
        return undefined;
      }

      let frameId = null;
      const handleViewportChange = () => {
        frameId = window.requestAnimationFrame(() => {
          updateDropdownPosition();
        });
      };

      window.addEventListener("resize", handleViewportChange);
      window.addEventListener("scroll", handleViewportChange, true);

      return () => {
        if (frameId != null) {
          window.cancelAnimationFrame(frameId);
        }
        window.removeEventListener("resize", handleViewportChange);
        window.removeEventListener("scroll", handleViewportChange, true);
      };
    }, [editing, showDropdown, updateDropdownPosition]);

    useEffect(
      () => () => {
        if (blurCommitReleaseTimerRef.current) {
          window.clearTimeout(blurCommitReleaseTimerRef.current);
          blurCommitReleaseTimerRef.current = null;
        }
      },
      [],
    );

    useEffect(() => {
      if (!editing || !showDropdown) {
        return undefined;
      }

      const isInteractionInsideDropdown = (target) =>
        target instanceof Node &&
        Boolean(dropdownListRef.current && dropdownListRef.current.contains(target));
      const isInteractionInsideEditor = (target) =>
        target instanceof Node &&
        Boolean(wrapperRef.current && wrapperRef.current.contains(target));

      const handleDismissOnExternalInteraction = (event) => {
        if (
          isInteractionInsideDropdown(event.target) ||
          isInteractionInsideEditor(event.target)
        ) {
          return;
        }

        closeSuggestionDropdown();
      };

      const scrollListenerOptions = { capture: true, passive: true };
      const pointerListenerOptions = { capture: true };
      window.addEventListener(
        "scroll",
        handleDismissOnExternalInteraction,
        scrollListenerOptions,
      );
      document.addEventListener(
        "scroll",
        handleDismissOnExternalInteraction,
        scrollListenerOptions,
      );
      window.addEventListener(
        "wheel",
        handleDismissOnExternalInteraction,
        scrollListenerOptions,
      );
      window.addEventListener(
        "touchmove",
        handleDismissOnExternalInteraction,
        scrollListenerOptions,
      );
      window.addEventListener(
        "pointerdown",
        handleDismissOnExternalInteraction,
        pointerListenerOptions,
      );
      window.addEventListener(
        "focusin",
        handleDismissOnExternalInteraction,
        pointerListenerOptions,
      );
      const handleVisibilityChange = () => {
        if (document.visibilityState !== "visible") {
          closeSuggestionDropdown();
        }
      };
      const handleWindowBlur = () => {
        closeSuggestionDropdown();
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("blur", handleWindowBlur, pointerListenerOptions);

      return () => {
        window.removeEventListener(
          "scroll",
          handleDismissOnExternalInteraction,
          scrollListenerOptions,
        );
        document.removeEventListener(
          "scroll",
          handleDismissOnExternalInteraction,
          scrollListenerOptions,
        );
        window.removeEventListener(
          "wheel",
          handleDismissOnExternalInteraction,
          scrollListenerOptions,
        );
        window.removeEventListener(
          "touchmove",
          handleDismissOnExternalInteraction,
          scrollListenerOptions,
        );
        window.removeEventListener(
          "pointerdown",
          handleDismissOnExternalInteraction,
          pointerListenerOptions,
        );
        window.removeEventListener(
          "focusin",
          handleDismissOnExternalInteraction,
          pointerListenerOptions,
        );
        window.removeEventListener("blur", handleWindowBlur, pointerListenerOptions);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }, [editing, showDropdown, closeSuggestionDropdown]);

    const pushHistoryEntry = (nextValue, selectionStart, selectionEnd) => {
      const history = historyRef.current;
      const currentEntry = history[historyIndexRef.current];

      if (currentEntry?.value === nextValue) {
        currentEntry.selectionStart = selectionStart;
        currentEntry.selectionEnd = selectionEnd;
        return;
      }

      const nextHistory = history
        .slice(0, historyIndexRef.current + 1)
        .concat({ value: nextValue, selectionStart, selectionEnd });

      if (nextHistory.length > EDITOR_HISTORY_LIMIT) {
        nextHistory.shift();
      }

      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;
    };

    const focusSelection = (selectionStart, selectionEnd = selectionStart) => {
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(selectionStart, selectionEnd);
      });
    };

    const selectAllEditorText = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      requestAnimationFrame(() => {
        const activeTextarea = textareaRef.current;
        if (!activeTextarea) return;
        activeTextarea.focus();
        activeTextarea.setSelectionRange(0, activeTextarea.value.length);
      });
    };

    const restoreHistory = (direction) => {
      const nextIndex = historyIndexRef.current + direction;
      const nextEntry = historyRef.current[nextIndex];
      if (!nextEntry) return;

      historyIndexRef.current = nextIndex;
      setText(nextEntry.value);
      setSuggestions([]);
      setShowDropdown(false);
      setActiveIndex(-1);
      focusSelection(nextEntry.selectionStart, nextEntry.selectionEnd);
    };

    const applyTextValue = (nextValue, selectionStart, selectionEnd = selectionStart) => {
      setText(nextValue);
      pushHistoryEntry(nextValue, selectionStart, selectionEnd);
      setSuggestions([]);
      setShowDropdown(false);
      setActiveIndex(-1);
      focusSelection(selectionStart, selectionEnd);
    };

    const insertLineBreakWithContinuation = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const selectionStart = textarea.selectionStart ?? text.length;
      const selectionEnd = textarea.selectionEnd ?? selectionStart;
      const currentValue = text ?? "";
      const safeStart = Math.max(0, selectionStart);
      const safeEnd = Math.max(safeStart, selectionEnd);
      const lineStart = currentValue.lastIndexOf("\n", Math.max(0, safeStart - 1)) + 1;
      const lineEndIndex = currentValue.indexOf("\n", safeStart);
      const lineEnd = lineEndIndex === -1 ? currentValue.length : lineEndIndex;
      const currentLine = currentValue.slice(lineStart, lineEnd);
      const continuationPrefix = getLineContinuationPrefix(currentLine);
      const insertion = `\n${continuationPrefix}`;
      const nextValue =
        currentValue.slice(0, safeStart) +
        insertion +
        currentValue.slice(safeEnd);

      applyTextValue(nextValue, safeStart + insertion.length);
    };

    const parseUserNumber = (rawValue) => {
      if (rawValue == null || rawValue === "") return null;

      const stringValue = String(rawValue)
        .replace(/Rp/gi, "")
        .replace(/%/g, "")
        .replace(/\s/g, "")
        .trim();
      if (!stringValue) return null;

      const normalized = normalizeNumericToken(stringValue);
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : rawValue;
    };

    const isEquivalentToCurrentValue = (nextValue) => {
      const currentValue = value;
      const isCurrentEmpty =
        currentValue === null ||
        currentValue === undefined ||
        String(currentValue).trim() === "";
      const isNextEmpty =
        nextValue === null ||
        nextValue === undefined ||
        String(nextValue).trim() === "";

      if (isCurrentEmpty && isNextEmpty) {
        return true;
      }

      if (typeof nextValue === "number") {
        const normalizedCurrent = parseUserNumber(
          stripInlineFormatTags(currentValue ?? ""),
        );
        if (typeof normalizedCurrent === "number" && Number.isFinite(normalizedCurrent)) {
          return normalizedCurrent === nextValue;
        }
      }

      return String(nextValue ?? "") === String(currentValue ?? "");
    };

    const commit = () => {
      lockBlurCommitForCurrentCycle();
      const plainText = stripInlineFormatTags(text);
      let finalValue = plainText;
      if (isNumericValue(plainText)) {
        finalValue = parseUserNumber(plainText);
      }

      if (!isEquivalentToCurrentValue(finalValue)) {
        onCommit?.(finalValue);
      }

      setEditing(false);
      onExternalEditConsumed?.();
    };

    const cancel = () => {
      lockBlurCommitForCurrentCycle();
      setText(stripInlineFormatTags(value ?? ""));
      onCancel?.();
      setSuggestions([]);
      setShowDropdown(false);
      setEditing(false);
      onExternalEditConsumed?.();
    };

    const handleChange = (event) => {
      const nextValue = event.target.value;
      const selectionStart = event.target.selectionStart ?? nextValue.length;
      const selectionEnd = event.target.selectionEnd ?? selectionStart;

      setText(nextValue);
      pushHistoryEntry(nextValue, selectionStart, selectionEnd);

      if (!nextValue) {
        const topSuggestions = suggestionOptions.slice(0, 5);
        setSuggestions(topSuggestions);
        setShowDropdown(topSuggestions.length > 0);
        return;
      }

      const normalizedSearch = String(nextValue).toLowerCase();
      const filteredSuggestions = suggestionOptions
        .filter((entry) => {
          const label = String(entry.label ?? "").toLowerCase();
          const value = String(entry.value ?? "").toLowerCase();
          return (
            (label.includes(normalizedSearch) || value.includes(normalizedSearch)) &&
            value !== normalizedSearch
          );
        })
        .slice(0, 5);

      setSuggestions(filteredSuggestions);
      setShowDropdown(filteredSuggestions.length > 0);
    };

    const handleSelectSuggestion = (selectedOption) => {
      lockBlurCommitForCurrentCycle();
      const plainValue = stripInlineFormatTags(selectedOption?.value ?? "");
      setText(plainValue);
      setSuggestions([]);
      setShowDropdown(false);
      onCommit?.(plainValue);
      setEditing(false);
      onExternalEditConsumed?.();
    };

    const handleEditorKeyDown = (event) => {
      const lowerKey = String(event.key ?? "").toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;

      if (EDITOR_NAVIGATION_KEYS.has(event.key)) {
        event.stopPropagation();
        return;
      }

      if (hasModifier && lowerKey === "a") {
        event.preventDefault();
        event.stopPropagation();
        selectAllEditorText();
        return;
      }

      if (hasModifier && lowerKey === "z") {
        event.preventDefault();
        event.stopPropagation();
        restoreHistory(event.shiftKey ? 1 : -1);
        return;
      }

      if (hasModifier && lowerKey === "y") {
        event.preventDefault();
        event.stopPropagation();
        restoreHistory(1);
        return;
      }

      if (ctrlEnterSaves && hasModifier && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        commit();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          onTabPrev?.();
        } else {
          onTabNext?.();
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (showDropdown) {
          setShowDropdown(false);
          setActiveIndex(-1);
          return;
        }
        cancel();
        return;
      }

      if (event.key === "Enter") {
        event.stopPropagation();

        if (showDropdown && suggestions.length > 0 && activeIndex >= 0) {
          event.preventDefault();
          handleSelectSuggestion(suggestions[activeIndex]);
          return;
        }

        if (event.shiftKey && shiftEnterNewline) {
          event.preventDefault();
          insertLineBreakWithContinuation();
          return;
        }

        if (effectiveSaveOnEnter) {
          event.preventDefault();
          commit();
          return;
        }

        if (isMultilineEditor) {
          event.preventDefault();
          insertLineBreakWithContinuation();
        }
      }
    };

  if (editing) {
    const isDarkMode =
      typeof document !== "undefined" &&
      document.body?.classList?.contains("dark-only");
    const editorBorderColor = isDarkMode ? "#444a57" : "#c4d2e5";
    const editorRingColor = isDarkMode
      ? "rgba(241, 90, 34, 0.28)"
      : "rgba(241, 90, 34, 0.18)";
    const editorBackground = isDarkMode ? "#1e1e2d" : "#f8fbff";
    const dropdownBackground = isDarkMode ? "#1e1e2d" : "#ffffff";
    const dropdownBorder = isDarkMode ? "#444a57" : "#c4d2e5";
    const dropdownItemBackground = isDarkMode ? "#1e1e2d" : "#ffffff";
    const dropdownItemActiveBackground = isDarkMode
      ? "rgba(241, 90, 34, 0.14)"
      : "#fff0e9";
    const dropdownItemBorder = isDarkMode ? "#2c3442" : "#f3e2da";
    const dropdownItemText = isDarkMode ? "#e2e8f0" : "inherit";

    return (
      <div
        ref={wrapperRef}
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            lineHeight: "1.4",
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onBlur={() => {
              if (commitOnBlur && !blurCommitLockRef.current) commit();
            }}
            onKeyDownCapture={handleEditorKeyDown}
            autoFocus
            rows={1}
            style={{
              paddingRight: 28,
              border: `1px solid ${editorBorderColor}`,
              outline: "none",
              boxShadow: `0 0 0 3px ${editorRingColor}`,
              background: editorBackground,
              borderRadius: 8,
              resize: "none",
              overflow: "hidden",
              width: "100%",
              minWidth: 0,
              minHeight: isMultilineEditor ? "3.4em" : "2.4em",
              padding: isMultilineEditor ? "10px 28px 10px 12px" : "8px 28px 8px 10px",
              boxSizing: "border-box",
              lineHeight: isMultilineEditor ? "1.5" : "1.4",
              font: "inherit",
              color: "inherit",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              ...style,
            }}
            {...rest}
          />

          <span
            onMouseDown={(event) => {
              event.preventDefault();
              if (showDropdown) {
                setShowDropdown(false);
                setActiveIndex(-1);
                return;
              }
              const topSuggestions = suggestionOptions.slice(0, 5);
              setSuggestions(topSuggestions);
              setShowDropdown(topSuggestions.length > 0);
            }}
            style={{
              position: "absolute",
              right: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              border: `1px solid ${dropdownBorder}`,
              borderRadius: 4,
              background: dropdownBackground,
              cursor: "pointer",
              userSelect: "none",
              fontSize: 10,
              color: dropdownItemText,
            }}
          >
            v
          </span>

          {showDropdown &&
            suggestions.length > 0 &&
            dropdownPosition &&
            createPortal(
              <ul
                ref={dropdownListRef}
                className="editable-suggest-dropdown list-group"
                style={{
                  position: "fixed",
                  top:
                    dropdownPosition.placement === "top"
                      ? "auto"
                      : dropdownPosition.top,
                  bottom:
                    dropdownPosition.placement === "top"
                      ? Math.max(12, window.innerHeight - dropdownPosition.top)
                      : "auto",
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                  zIndex: 1035,
                  background: dropdownBackground,
                  border: `1px solid ${dropdownBorder}`,
                  borderRadius: 8,
                  boxShadow: isDarkMode
                    ? "0 14px 28px rgba(0, 0, 0, 0.38)"
                    : "0 12px 28px rgba(15,23,42,0.18)",
                  maxHeight: 180,
                  overflowY: "auto",
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.value}-${index}`}
                    className="editable-suggest-dropdown__item list-group-item list-group-item-action"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={() => handleSelectSuggestion(suggestion)}
                    style={{
                      cursor: "pointer",
                      padding: "8px 10px",
                      fontSize: 13,
                      lineHeight: 1.35,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      background:
                        index === activeIndex
                          ? dropdownItemActiveBackground
                          : dropdownItemBackground,
                      color: dropdownItemText,
                      border: "none",
                      borderBottom:
                        index < suggestions.length - 1
                          ? `1px solid ${dropdownItemBorder}`
                          : "none",
                    }}
                  >
                    {suggestion.label}
                  </li>
                ))}
              </ul>,
              document.body,
            )}
        </div>
      );
    }

    const baseDisplayStyle = {
      width: "100%",
      minHeight: "1em",
      fontSize: 14,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      lineHeight: 1.4,
      color: "inherit",
      ...style,
    };

    if (!canEdit) {
      return (
        <div
          style={{
            ...baseDisplayStyle,
            cursor: typeof onReadOnlyClick === "function" ? "pointer" : "default",
            userSelect: "text",
          }}
          onClick={(event) => {
            selectNodeText(event.currentTarget);
          }}
          onMouseDown={
            typeof onReadOnlyClick === "function"
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onReadOnlyClick(event);
                }
              : undefined
          }
        >
          {renderedDisplayValue}
        </div>
      );
    }

    return (
      <div
        style={baseDisplayStyle}
        onMouseDown={(event) => {
          event.preventDefault();
          selectAllOnEditRef.current = true;
          setEditing(true);
          const topSuggestions = suggestionOptions.slice(0, 5);
          setSuggestions(topSuggestions);
          setShowDropdown(topSuggestions.length > 0);
        }}
      >
        {renderedDisplayValue}
      </div>
    );
  },
);

export default EditableTextarea;
