/*
 * PGH-DOC
 * File: src/Auth/accessControl.js
 * Apa fungsi bagian ini:
 * - File ini mengatur autentikasi, login flow, dan kontrol akses user.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");

const buildPath = (path = "") => `${PUBLIC_URL}${path}`;

const STREAM_MODULES = {
  audit: {
    key: "audit",
    dashboard: buildPath("/audit"),
    base: buildPath("/audit"),
  },
  compliance: {
    key: "compliance",
    dashboard: buildPath("/compliance"),
    base: buildPath("/compliance"),
  },
  planning: {
    key: "planning",
    dashboard: buildPath("/Planning"),
    base: buildPath("/Planning"),
  },
  procurement: {
    key: "procurement",
    dashboard: buildPath("/procurement"),
    base: buildPath("/procurement"),
  },
  human: {
    key: "human",
    dashboard: buildPath("/human"),
    base: buildPath("/human"),
  },
};

const ALWAYS_ALLOWED_PATHS = [
  buildPath("/settings"),
  buildPath("/app/users/userProfile"),
  buildPath("/app/users/userEdit"),
];

const ADMIN_ONLY_PATHS = [buildPath("/admin/user-access")];

const normalizeValue = (value) => String(value || "").trim().toLowerCase();
const STREAM_KEY_ALIASES = {
  audit: "audit",
  compliance: "compliance",
  planning: "planning",
  procurement: "procurement",
  human: "human",
  "human resource": "human",
};

const normalizePath = (path = "") => {
  const [cleanPath] = String(path).split("?");
  const trimmed = cleanPath.replace(/\/+$/, "");
  return (trimmed || "/").toLowerCase();
};

export const isAdminUser = (user) => {
  const normalizedLevel = normalizeValue(user?.level);
  return normalizedLevel === "admin";
};

export const isExecutive = (user) => normalizeValue(user?.level) === "executive";
export const isManager = (user) => normalizeValue(user?.level) === "manager";

export const isReadOnlyUser = (user) => {
  const normalizedLevel = normalizeValue(user?.level);
  return normalizedLevel === "executive";
};

export const getUserStreamKey = (user) => {
  const streamKey = STREAM_KEY_ALIASES[normalizeValue(user?.stream)];
  return STREAM_MODULES[streamKey] ? streamKey : null;
};

export const getManagerStreamKey = (user) => {
  if (normalizeValue(user?.level) !== "manager") {
    return null;
  }

  return getUserStreamKey(user);
};

export const isStreamScopedManager = (user) => Boolean(getManagerStreamKey(user));

const resolveModuleKey = (moduleOrPath) => {
  if (!moduleOrPath) {
    return null;
  }

  if (typeof moduleOrPath === "string" && STREAM_MODULES[moduleOrPath]) {
    return moduleOrPath;
  }

  return getModuleByPath(moduleOrPath)?.key || null;
};

export const isCrossStreamManager = (user, moduleOrPath) => {
  const streamKey = getManagerStreamKey(user);
  const moduleKey = resolveModuleKey(moduleOrPath);

  return Boolean(streamKey && moduleKey && streamKey !== moduleKey);
};

export const isSummaryOnlyMode = (user, moduleOrPath) =>
  isCrossStreamManager(user, moduleOrPath);

export const isAuditOwner = (user) => getUserStreamKey(user) === "audit";

export const isAuditSummaryOnly = (user) =>
  isManager(user) && !isAuditOwner(user);

export const canEditComplianceContent = (user) =>
  isAdminUser(user) ||
  (normalizeValue(user?.level) === "manager" &&
    getManagerStreamKey(user) === "compliance");

export const isForeignModuleForManager = (user, path) => {
  return isCrossStreamManager(user, path);
};

export const getModuleByPath = (path) => {
  const normalizedPath = normalizePath(path);

  return (
    Object.values(STREAM_MODULES).find(({ dashboard, base }) => {
      const normalizedDashboard = normalizePath(dashboard);
      const normalizedBase = normalizePath(base);

      return (
        normalizedPath === normalizedDashboard ||
        normalizedPath.startsWith(`${normalizedBase}/`)
      );
    }) || null
  );
};

export const getDefaultAuthorizedPath = () => PUBLIC_URL || "/";

export const getPathAccess = (user, path) => {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(PUBLIC_URL || "/");
  const streamKey = getManagerStreamKey(user);
  const managerWithoutStream = isManager(user) && !streamKey;

  if (normalizedPath === normalizedRoot) {
    return { allowed: true, redirectTo: null };
  }

  if (ADMIN_ONLY_PATHS.some((adminPath) => normalizePath(adminPath) === normalizedPath)) {
    return isAdminUser(user)
      ? { allowed: true, redirectTo: null }
      : { allowed: false, redirectTo: getDefaultAuthorizedPath(user) };
  }

  if (!streamKey && !managerWithoutStream) {
    return { allowed: true, redirectTo: null };
  }

  if (ALWAYS_ALLOWED_PATHS.some((allowedPath) => normalizePath(allowedPath) === normalizedPath)) {
    return { allowed: true, redirectTo: null };
  }

  const matchedModule = getModuleByPath(normalizedPath);

  if (!matchedModule) {
    return {
      allowed: false,
      redirectTo: getDefaultAuthorizedPath(user),
    };
  }

  if (matchedModule.key === streamKey) {
    return { allowed: true, redirectTo: null };
  }

  if (managerWithoutStream) {
    return {
      allowed: false,
      redirectTo: getDefaultAuthorizedPath(user),
    };
  }

  if (normalizedPath === normalizePath(matchedModule.dashboard)) {
    return { allowed: true, redirectTo: null };
  }

  return {
    allowed: false,
    redirectTo: matchedModule.dashboard,
  };
};

export const canEditPath = (user, path) => {
  if (isReadOnlyUser(user)) {
    return false;
  }

  const matchedModule = getModuleByPath(path);

  if (matchedModule?.key === "compliance") {
    return canEditComplianceContent(user);
  }

  const streamKey = getManagerStreamKey(user);

  if (isManager(user) && !streamKey) {
    return false;
  }

  if (!streamKey) {
    return true;
  }

  return matchedModule?.key === streamKey;
};
