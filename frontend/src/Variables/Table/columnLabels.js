const COMMON_LABEL_OVERRIDES = {
  createdat: "Waktu Dibuat",
  updatedat: "Waktu Diperbarui",
  deletedat: "Waktu Dihapus",
  isactive: "Status Aktif",
  isdefault: "Default",
  userid: "User ID",
  picaudit: "PIC Audit",
  pichuman: "PIC Human",
  picprocurement: "PIC Procurement",
};

const normalizeComparableToken = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "");

const tryHeaderMapLookup = (headerMap, rawKey) => {
  if (!headerMap || !rawKey) return "";

  const candidates = [
    rawKey,
    String(rawKey).trim(),
    String(rawKey).toLowerCase(),
    String(rawKey).toUpperCase(),
  ];

  for (const candidate of candidates) {
    const mapped = headerMap?.[candidate];
    if (mapped) {
      return String(mapped).trim();
    }
  }

  return "";
};

export const humanizeColumnLabel = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const override = COMMON_LABEL_OVERRIDES[raw.toLowerCase()];
  if (override) return override;

  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => {
      if (!part) return "";
      if (part.length <= 3 && /^[A-Z0-9]+$/.test(part)) return part;
      if (part.length <= 3 && /^[a-z0-9]+$/.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
};

export const resolveTableColumnLabel = (column, headerMap = null) => {
  if (!column) return "";

  const key =
    typeof column === "string"
      ? column
      : String(column.key || column.accessor || column.Header || "").trim();

  const mappedLabel = tryHeaderMapLookup(headerMap, key);
  if (mappedLabel) {
    return mappedLabel;
  }

  if (typeof column === "object") {
    const explicitLabel = String(column.label || column.Header || "").trim();
    if (
      explicitLabel &&
      normalizeComparableToken(explicitLabel) !== normalizeComparableToken(key)
    ) {
      return explicitLabel;
    }
  }

  return humanizeColumnLabel(key);
};
