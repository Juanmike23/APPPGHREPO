/*
 * PGH-DOC
 * File: src/Variables/Table/tableTargetProfiles.js
 * Apa fungsi bagian ini:
 * - Menyediakan profil target tabel global (endpoint/unit) untuk dipakai lintas fitur tabel.
 * Kenapa perlu:
 * - Menghindari duplikasi logic deteksi target di Import/Export dan menjaga konsistensi perilaku antar unit.
 * Aturan khususnya apa:
 * - Tambah target baru cukup di sini, jangan hardcode berulang di komponen lain.
 * - Untuk kebutuhan fallback dari URL API, gunakan helper `is*Target` dengan `checkApiUrl: true`.
 */

export const PROCUREMENT_TARGETS = new Set([
  "newprocure",
  "existingprocure",
  "allprocure",
]);

export const HUMAN_RESOURCE_TARGETS = new Set([
  "fte",
  "nonfte",
  "kebutuhanfte",
  "bnu",
  "internaltraining",
  "kompetensipegawai",
]);

export const HUMAN_DISABLED_TRANSFER_TARGETS = new Set();

export const HUMAN_ALL_TARGETS = new Set([
  ...HUMAN_RESOURCE_TARGETS,
  ...HUMAN_DISABLED_TRANSFER_TARGETS,
]);

export const LIST_AUDIT_TARGET = "listaudit";
export const WEEKLY_TABLE_TARGET = "weeklytable";
export const OPEX_TARGETS = new Set(["opex", "opextemplate"]);

const TABLE_TRANSFER_PROFILES = [
  {
    id: "listaudit",
    domain: "audit",
    targets: new Set([LIST_AUDIT_TARGET]),
    importStrategy: "staging-audit",
    exportStrategy: "official-backend",
    exportFormats: ["csv", "xlsx"],
    defaultUpsertKey: null,
    supportsGlobalImport: true,
    supportsGlobalExport: true,
  },
  {
    id: "weeklytable",
    domain: "compliance-weekly",
    targets: new Set([WEEKLY_TABLE_TARGET]),
    importStrategy: "staging-weekly",
    exportStrategy: "official-backend",
    exportFormats: ["csv", "xlsx"],
    defaultUpsertKey: null,
    supportsGlobalImport: true,
    supportsGlobalExport: true,
  },
  {
    id: "procurement",
    domain: "procurement",
    targets: PROCUREMENT_TARGETS,
    importStrategy: "staging-guided",
    exportStrategy: "official-backend",
    exportFormats: ["csv", "xlsx"],
    defaultUpsertKey: null,
    supportsGlobalImport: true,
    supportsGlobalExport: true,
  },
  {
    id: "human-resource",
    domain: "human",
    targets: HUMAN_RESOURCE_TARGETS,
    importStrategy: "staging-human",
    exportStrategy: "official-backend",
    exportFormats: ["csv", "xlsx"],
    defaultUpsertKey: null,
    supportsGlobalImport: true,
    supportsGlobalExport: true,
  },
  {
    id: "opex",
    domain: "planning-opex",
    targets: OPEX_TARGETS,
    importStrategy: "domain-custom",
    exportStrategy: "official-backend",
    exportFormats: ["csv", "xlsx"],
    defaultUpsertKey: null,
    supportsGlobalImport: false,
    supportsGlobalExport: true,
  },
];

export const normalizeEndpointTarget = (value) =>
  String(value ?? "").replace(/\s+/g, "").trim().toLowerCase();

const isApiUrlMatched = (apiUrl, targets) => {
  const normalizedTargets = Array.from(targets)
    .map((target) => String(target).trim().toLowerCase())
    .filter(Boolean);

  if (normalizedTargets.length === 0) return false;

  const pattern = new RegExp(
    `/api/(${normalizedTargets.join("|")})(?:/|$|\\?)`,
    "i",
  );

  return pattern.test(String(apiUrl ?? ""));
};

const isTargetMatched = ({ endpointName, apiUrl, targets, checkApiUrl = false }) => {
  const normalizedEndpoint = normalizeEndpointTarget(endpointName);
  if (targets.has(normalizedEndpoint)) return true;
  if (!checkApiUrl) return false;
  return isApiUrlMatched(apiUrl, targets);
};

export const resolveTableTransferProfile = ({
  endpointName,
  apiUrl,
  checkApiUrl = false,
} = {}) => {
  const matchedProfile = TABLE_TRANSFER_PROFILES.find((profile) =>
    isTargetMatched({
      endpointName,
      apiUrl,
      targets: profile.targets,
      checkApiUrl,
    }),
  );

  if (matchedProfile) {
    return matchedProfile;
  }

  return {
    id: "default",
    domain: "generic",
    targets: new Set(),
    importStrategy: "staging-generic",
    exportStrategy: "client-file",
    exportFormats: ["csv", "xlsx", "pdf"],
    defaultUpsertKey: null,
    supportsGlobalImport: true,
    supportsGlobalExport: true,
  };
};

export const getTableImportStrategy = (args) =>
  resolveTableTransferProfile(args).importStrategy;

export const getTableExportStrategy = (args) =>
  resolveTableTransferProfile(args).exportStrategy;

export const isListAuditTarget = (endpointName) =>
  normalizeEndpointTarget(endpointName) === LIST_AUDIT_TARGET;

export const isWeeklyTableTarget = (endpointName) =>
  normalizeEndpointTarget(endpointName) === WEEKLY_TABLE_TARGET;

export const isProcurementTarget = ({
  endpointName,
  apiUrl,
  checkApiUrl = false,
}) =>
  isTargetMatched({
    endpointName,
    apiUrl,
    targets: PROCUREMENT_TARGETS,
    checkApiUrl,
  });

export const isHumanResourceTarget = ({
  endpointName,
  apiUrl,
  checkApiUrl = false,
}) =>
  isTargetMatched({
    endpointName,
    apiUrl,
    targets: HUMAN_ALL_TARGETS,
    checkApiUrl,
  });

export const isPlanningOpexTarget = ({
  endpointName,
  apiUrl,
  checkApiUrl = false,
}) =>
  isTargetMatched({
    endpointName,
    apiUrl,
    targets: OPEX_TARGETS,
    checkApiUrl,
  });
