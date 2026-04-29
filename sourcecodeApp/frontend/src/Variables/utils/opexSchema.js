/*
 * PGH-DOC
 * File: src/Variables/utils/opexSchema.js
 * Apa fungsi bagian ini:
 * - Menjadi schema global untuk kolom, label, dan header group OPEX.
 * Kenapa perlu:
 * - Supaya UI tabel, export Excel, dan konfigurasi kolom tetap konsisten dari satu sumber.
 * Aturan khususnya apa:
 * - Gunakan helper di file ini untuk render header OPEX; hindari hardcode per komponen.
 */

export const OPEX_TEMPLATE_COLUMNS = [
  "SIT",
  "MataAnggaranParent",
  "MataAnggaranChild",
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
  "Accumulated",
  "RealizationLastYearThisMonth",
  "RealizationThisYearThisMonth",
  "GrowthRp",
  "Growth",
  "FullYearFY",
  "YTD",
  "toAngThisYear",
  "toAngYTDThisYear",
  "SisaFY",
];

const OPEX_TEMPLATE_MONTH_COLUMNS = [
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

export const OPEX_TEMPLATE_NON_EDITABLE_COLUMNS = [
  "Accumulated",
  "RealizationLastYearThisMonth",
  "RealizationThisYearThisMonth",
  "GrowthRp",
  "Growth",
  "toAngThisYear",
  "toAngYTDThisYear",
  "SisaFY",
];

const OPEX_TEMPLATE_BASE_COLUMN_LABELS = {
  SIT: "SIT",
  MataAnggaranParent: "Kelompok Mata Anggaran",
  MataAnggaranChild: "Detail Mata Anggaran",
  Jan: "Jan",
  Feb: "Feb",
  Mar: "Mar",
  Apr: "Apr",
  May: "May",
  Jun: "Jun",
  Jul: "Jul",
  Aug: "Aug",
  Sep: "Sep",
  Oct: "Oct",
  Nov: "Nov",
  Dec: "Dec",
  Accumulated: "Total Akumulasi (sesuai filter bulan)",
  RealizationLastYearThisMonth: "Realisasi dari sistem (bulan sama, tahun sebelumnya)",
  RealizationThisYearThisMonth:
    "Realisasi dari sistem (bulan sesuai filter, tahun file aktif)",
  GrowthRp: "Selisih Realisasi (Rp)",
  Growth: "Pertumbuhan Realisasi (%)",
  FullYearFY: "Anggaran Full Year (FY)",
  YTD: "Anggaran YTD (s.d. bulan filter)",
  toAngThisYear: "% Pencapaian terhadap Anggaran Tahun Ini",
  toAngYTDThisYear: "% Pencapaian terhadap Anggaran YTD",
  SisaFY: "Sisa Anggaran FY",
};

const MONTH_ID_MAP = {
  Jan: "Januari",
  Feb: "Februari",
  Mar: "Maret",
  Apr: "April",
  May: "Mei",
  Jun: "Juni",
  Jul: "Juli",
  Aug: "Agustus",
  Sep: "September",
  Oct: "Oktober",
  Nov: "November",
  Dec: "Desember",
};

export const OPEX_TEMPLATE_HEADER_GROUPS = [
  {
    key: "mutasi",
    label: "Mutasi",
    columns: [...OPEX_TEMPLATE_MONTH_COLUMNS, "Accumulated"],
  },
  {
    key: "realisasi",
    label: "Realisasi",
    columns: ["RealizationLastYearThisMonth", "RealizationThisYearThisMonth"],
  },
  {
    key: "growth",
    label: "Growth",
    columns: ["GrowthRp", "Growth"],
  },
  {
    key: "anggaran",
    label: "Anggaran",
    columns: ["FullYearFY", "YTD"],
  },
  {
    key: "achievement",
    label: "% achievement",
    columns: ["toAngThisYear", "toAngYTDThisYear"],
  },
];

const normalizeEndpointToken = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const extractYear = (value) => {
  const matched = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return matched ? Number(matched[0]) : null;
};

const getOpexGroupForColumn = (column) =>
  OPEX_TEMPLATE_HEADER_GROUPS.find((group) => group.columns.includes(column)) ||
  null;

const resolveBudgetYearFromColumnLabels = (columnLabelMap) => {
  const candidates = [
    columnLabelMap?.FullYearFY,
    columnLabelMap?.YTD,
    columnLabelMap?.toAngThisYear,
    columnLabelMap?.toAngYTDThisYear,
    columnLabelMap?.RealizationThisYearThisMonth,
  ];

  for (const label of candidates) {
    const year = extractYear(label);
    if (year) return year;
  }

  return null;
};

export const resolveOpexYear = (year) => {
  const parsed = Number(year);
  if (Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2099) {
    return parsed;
  }

  return new Date().getFullYear();
};

const normalizeLabelOverrideValue = (value) => {
  if (typeof value !== "string") return "";
  const normalized = value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return normalized;
};

const resolveAccumulatedLabel = (selectedMonths = []) => {
  const months = Array.isArray(selectedMonths)
    ? selectedMonths
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    : [];

  if (months.length === 0) {
    return "Total Akumulasi (sesuai filter bulan)";
  }

  if (months.length === 1) {
    const token = months[0];
    return `Total Akumulasi bulan ${MONTH_ID_MAP[token] ?? token}`;
  }

  const first = months[0];
  const last = months[months.length - 1];
  if (first.toLowerCase() === last.toLowerCase()) {
    return `Total Akumulasi bulan ${MONTH_ID_MAP[first] ?? first}`;
  }

  return `Total Akumulasi ${first}-${last}`;
};

const normalizeSelectedMonths = (selectedMonths = []) =>
  (Array.isArray(selectedMonths) ? selectedMonths : [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);

const isCumulativeMonthSelection = (selectedMonths = []) => {
  const months = normalizeSelectedMonths(selectedMonths);
  if (months.length === 0) return false;

  const indices = months
    .map((value) => OPEX_TEMPLATE_MONTH_COLUMNS.indexOf(value))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);

  if (indices.length !== months.length) return false;

  return indices.every((monthIndex, index) => monthIndex === index);
};

const resolveBudgetPeriodLabel = (selectedMonths = [], year) => {
  const months = normalizeSelectedMonths(selectedMonths);
  if (months.length === 0) {
    return `Anggaran ${year} YTD (s.d. bulan filter)`;
  }

  if (isCumulativeMonthSelection(months)) {
    return `Anggaran ${year} YTD (s.d. bulan filter)`;
  }

  if (months.length === 1) {
    const token = months[0];
    return `Anggaran ${year} bulan ${MONTH_ID_MAP[token] ?? token}`;
  }

  const first = months[0];
  const last = months[months.length - 1];
  return `Anggaran ${year} periode ${MONTH_ID_MAP[first] ?? first}-${MONTH_ID_MAP[last] ?? last}`;
};

const resolveAchievementPeriodLabel = (selectedMonths = [], year) => {
  const months = normalizeSelectedMonths(selectedMonths);
  if (months.length === 0) {
    return `% Pencapaian terhadap Anggaran YTD ${year}`;
  }

  if (isCumulativeMonthSelection(months)) {
    return `% Pencapaian terhadap Anggaran YTD ${year}`;
  }

  if (months.length === 1) {
    const token = months[0];
    return `% Pencapaian terhadap Anggaran bulan ${MONTH_ID_MAP[token] ?? token} ${year}`;
  }

  const first = months[0];
  const last = months[months.length - 1];
  return `% Pencapaian terhadap Anggaran periode ${MONTH_ID_MAP[first] ?? first}-${MONTH_ID_MAP[last] ?? last} ${year}`;
};

export const buildOpexColumnLabels = (year, overrides = null, context = null) => {
  const resolvedYear = resolveOpexYear(year);
  const selectedMonths = context?.selectedMonths;
  const accumulatedLabel = context?.accumulatedLabel
    || resolveAccumulatedLabel(selectedMonths);
  const base = {
    ...OPEX_TEMPLATE_BASE_COLUMN_LABELS,
    Accumulated: accumulatedLabel,
    RealizationThisYearThisMonth: `Realisasi dari sistem (bulan sesuai filter, tahun ${resolvedYear})`,
    FullYearFY: `Anggaran ${resolvedYear} Full Year (FY)`,
    YTD: resolveBudgetPeriodLabel(selectedMonths, resolvedYear),
    toAngThisYear: `% Pencapaian terhadap Anggaran ${resolvedYear}`,
    toAngYTDThisYear: resolveAchievementPeriodLabel(selectedMonths, resolvedYear),
  };

  if (!overrides || typeof overrides !== "object") {
    return base;
  }

  const next = { ...base };
  [
    "RealizationLastYearThisMonth",
    "RealizationThisYearThisMonth",
    "GrowthRp",
    "Growth",
    "FullYearFY",
    "YTD",
    "toAngThisYear",
    "toAngYTDThisYear",
  ].forEach((key) => {
    const normalized = normalizeLabelOverrideValue(overrides?.[key]);
    if (normalized) {
      next[key] = normalized;
    }
  });

  return next;
};

export const isOpexEndpoint = ({ endpointName, apiUrl } = {}) => {
  const normalizedEndpoint = normalizeEndpointToken(endpointName);
  if (normalizedEndpoint === "opextemplate" || normalizedEndpoint === "opex") return true;

  return (
    /\/opextemplate(?:\/|$|\?)/i.test(String(apiUrl ?? "")) ||
    /\/opex\/table(?:\/|$|\?)/i.test(String(apiUrl ?? ""))
  );
};

export const buildOpexHeaderRows = (columnOrder, columnLabelMap) => {
  const orderedColumns = Array.isArray(columnOrder) ? columnOrder : [];
  if (orderedColumns.length === 0) return null;

  const resolvedYear = resolveBudgetYearFromColumnLabels(columnLabelMap);
  const consumedColumns = new Set();
  const renderedGroups = new Set();
  const topRowCells = [];
  const secondRowCells = [];

  orderedColumns.forEach((column) => {
    if (consumedColumns.has(column)) return;

    const group = getOpexGroupForColumn(column);
    if (!group) {
      topRowCells.push({
        key: `leaf-top-${column}`,
        column,
        label: columnLabelMap?.[column] ?? column,
        rowSpan: 2,
      });
      consumedColumns.add(column);
      return;
    }

    if (renderedGroups.has(group.key)) {
      consumedColumns.add(column);
      return;
    }

    const groupColumns = orderedColumns.filter((candidate) =>
      group.columns.includes(candidate),
    );

    if (groupColumns.length === 0) {
      consumedColumns.add(column);
      return;
    }

    topRowCells.push({
      key: `group-${group.key}`,
      label:
        group.key === "anggaran" && resolvedYear
          ? `Anggaran ${resolvedYear}`
          : group.label,
      colSpan: groupColumns.length,
      columns: groupColumns,
    });

    groupColumns.forEach((groupColumn) => {
      consumedColumns.add(groupColumn);
      secondRowCells.push({
        key: `leaf-${groupColumn}`,
        column: groupColumn,
        label: columnLabelMap?.[groupColumn] ?? groupColumn,
      });
    });

    renderedGroups.add(group.key);
  });

  if (topRowCells.length === 0) return null;
  if (!topRowCells.some((cell) => !cell.rowSpan)) return null;

  return {
    topRowCells,
    secondRowCells,
  };
};
