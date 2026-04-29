/*
 * PGH-DOC
 * File: src/Auth/AuthContext.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur autentikasi, login flow, dan kontrol akses user.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import defaultavatar from "./default-avatar.png";

const AuthContext = createContext(null);
const SESSION_HINT_KEY = "pgh_session_hint";
const SESSION_NOTICE_KEY = "pgh_session_notice";
const SESSION_FOCUS_REVALIDATE_MS = 45 * 1000;
const DEFAULT_SESSION_EXPIRED_NOTICE = {
  title: "Sesi berakhir",
  description:
    "Sesi login sudah habis atau tidak lagi valid. Refresh halaman atau login kembali untuk melanjutkan.",
};

const hasSessionHint = () => {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
};

const setSessionHint = (active) => {
  try {
    if (active) {
      window.localStorage.setItem(SESSION_HINT_KEY, "1");
    } else {
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {}
};

const readSessionNotice = () => {
  try {
    const raw = window.localStorage.getItem(SESSION_NOTICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      title: String(parsed.title || DEFAULT_SESSION_EXPIRED_NOTICE.title),
      description: String(
        parsed.description || DEFAULT_SESSION_EXPIRED_NOTICE.description,
      ),
    };
  } catch {
    return null;
  }
};

const setSessionNoticeStorage = (notice) => {
  try {
    if (!notice) {
      window.localStorage.removeItem(SESSION_NOTICE_KEY);
      return;
    }

    window.localStorage.setItem(SESSION_NOTICE_KEY, JSON.stringify(notice));
  } catch {}
};

const isAuthBypassUrl = (url) => {
  const normalized = String(url || "").toLowerCase();
  return normalized.includes("/auth/");
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState(() => readSessionNotice());
  const sessionCheckRef = useRef(null);
  const userRef = useRef(null);
  const lastFocusSessionCheckRef = useRef(0);
  const authStateVersionRef = useRef(0);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
    setSessionNoticeStorage(null);
  }, []);

  const markSessionExpired = useCallback(
    (notice = DEFAULT_SESSION_EXPIRED_NOTICE) => {
      authStateVersionRef.current += 1;

      const normalizedNotice = {
        title: String(notice?.title || DEFAULT_SESSION_EXPIRED_NOTICE.title),
        description: String(
          notice?.description || DEFAULT_SESSION_EXPIRED_NOTICE.description,
        ),
      };

      setSessionHint(false);
      setUser(null);
      setSessionNotice((current) => {
        if (
          current?.title === normalizedNotice.title &&
          current?.description === normalizedNotice.description
        ) {
          return current;
        }

        return normalizedNotice;
      });
      setSessionNoticeStorage(normalizedNotice);
      return false;
    },
    [],
  );

  const loadProfileImage = useCallback(async (userId) => {
    try {
      const resp = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}UserImages/${userId}`,
        { credentials: "include" }
      );

      if (!resp.ok) {
        return null;
      }

      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }, []);

  const applyUserProfile = useCallback(
    async (profile, { expectedVersion = authStateVersionRef.current } = {}) => {
      if (!profile?.id) {
        return false;
      }

      if (expectedVersion !== authStateVersionRef.current) {
        return false;
      }

      const currentUser = userRef.current;
      const isSameUser =
        String(currentUser?.id ?? "") === String(profile.id ?? "");
      const canReuseCurrentImage =
        isSameUser &&
        typeof currentUser?.profileURL === "string" &&
        currentUser.profileURL.length > 0;

      const profileURL = canReuseCurrentImage
        ? currentUser.profileURL
        : await loadProfileImage(profile.id);

      if (expectedVersion !== authStateVersionRef.current) {
        return false;
      }

      setUser((prev) => {
        const nextUser = {
          ...profile,
          profileURL: profileURL ?? prev?.profileURL ?? defaultavatar,
        };

        const sameIdentity =
          String(prev?.id ?? "") === String(nextUser.id ?? "") &&
          String(prev?.email ?? "") === String(nextUser.email ?? "") &&
          String(prev?.name ?? "") === String(nextUser.name ?? "") &&
          String(prev?.level ?? "") === String(nextUser.level ?? "") &&
          String(prev?.stream ?? "") === String(nextUser.stream ?? "");

        const sameProfileImage =
          String(prev?.profileURL ?? "") === String(nextUser.profileURL ?? "");

        if (sameIdentity && sameProfileImage) {
          return prev;
        }

        return nextUser;
      });

      setSessionHint(true);
      return true;
    },
    [loadProfileImage]
  );

  const fetchProfile = useCallback(
    async ({
      clearUserOnFailure = true,
      silent = false,
      expectedVersion = authStateVersionRef.current,
    } = {}) => {
      try {
        const res = await fetch(
          `${process.env.REACT_APP_API_BASE_URL}Auth/profile`,
          {
            credentials: "include",
          }
        );

        if (!res.ok) {
          if (!silent && res.status !== 401) {
            console.error("Profile fetch failed.", { status: res.status });
          }

          if (clearUserOnFailure) {
            setUser(null);
          }

          return { ok: false, status: res.status };
        }

        const profile = await res.json();
        const applied = await applyUserProfile(profile, { expectedVersion });
        if (!applied) {
          return { ok: false, status: 0, stale: true };
        }

        return { ok: true, status: res.status };
      } catch (error) {
        if (!silent) {
          console.error("Profile fetch request failed.", error);
        }

        if (clearUserOnFailure) {
          setUser(null);
        }

        return { ok: false, status: 0 };
      }
    },
    [applyUserProfile]
  );

  const refreshToken = useCallback(async ({ silent = false } = {}) => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}Auth/refresh`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!res.ok) {
        if (!silent && res.status !== 401) {
          console.error("Refresh token request failed.", { status: res.status });
        }

        return { ok: false, status: res.status };
      }

      setSessionHint(true);
      return { ok: true, status: res.status };
    } catch (error) {
      if (!silent) {
        console.error("Refresh token request crashed.", error);
      }

      return { ok: false, status: 0 };
    }
  }, []);

  const ensureSession = useCallback(
    async ({ silent = true, force = false } = {}) => {
      const runVersion = authStateVersionRef.current;
      const hadSession = hasSessionHint() || Boolean(userRef.current);

      if (!force && !hasSessionHint()) {
        setUser(null);
        return false;
      }

      if (sessionCheckRef.current) {
        return sessionCheckRef.current;
      }

      sessionCheckRef.current = (async () => {
        const profile = await fetchProfile({
          clearUserOnFailure: false,
          silent,
          expectedVersion: runVersion,
        });

        if (profile.ok) {
          return true;
        }

        if (profile.stale || runVersion !== authStateVersionRef.current) {
          return false;
        }

        if (profile.status !== 401) {
          setUser(null);
          setSessionHint(false);
          return false;
        }

        const refreshed = await refreshToken({ silent });
        if (!refreshed.ok) {
          return hadSession ? markSessionExpired() : false;
        }

        const retry = await fetchProfile({
          clearUserOnFailure: false,
          silent,
          expectedVersion: runVersion,
        });

        if (retry.ok) {
          return true;
        }

        if (retry.stale || runVersion !== authStateVersionRef.current) {
          return false;
        }

        return hadSession ? markSessionExpired() : false;
      })();

      try {
        return await sessionCheckRef.current;
      } finally {
        sessionCheckRef.current = null;
      }
    },
    [fetchProfile, markSessionExpired, refreshToken]
  );

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const apiBaseUrl = String(process.env.REACT_APP_API_BASE_URL || "").trim();

    const extractRequestUrl = (input) => {
      if (typeof input === "string") return input;
      if (input instanceof URL) return input.toString();
      return input?.url || "";
    };

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      try {
        const requestUrl = extractRequestUrl(input);
        const isApiRequest = apiBaseUrl
          ? requestUrl.startsWith(apiBaseUrl)
          : requestUrl.includes("/api/");
        const hasLiveSession = hasSessionHint() || Boolean(userRef.current);

        if (
          response?.status === 401 &&
          isApiRequest &&
          hasLiveSession &&
          !isAuthBypassUrl(requestUrl)
        ) {
          void ensureSession({ silent: true, force: true });
        }
      } catch {}

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [ensureSession]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState !== "visible" || !hasSessionHint()) {
        return;
      }
      const now = Date.now();
      if (now - lastFocusSessionCheckRef.current < SESSION_FOCUS_REVALIDATE_MS) {
        return;
      }
      lastFocusSessionCheckRef.current = now;

      ensureSession({ silent: true });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [ensureSession]);

  useEffect(() => {
    const load = async () => {
      await ensureSession({ silent: true });
      setLoading(false);
    };

    load();
  }, [ensureSession]);

  const login = async (email, password) => {
    try {
      authStateVersionRef.current += 1;
      const loginVersion = authStateVersionRef.current;

      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}Auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      let payload = null;
      try {
        payload = await response.json();
      } catch {}

      if (!response.ok) {
        setSessionHint(false);
        return {
          success: false,
          message:
            payload?.message ||
            payload?.error ||
            (response.status === 401
              ? "Invalid email or password"
              : `Login failed (HTTP ${response.status})`),
        };
      }

      setSessionHint(true);
      clearSessionNotice();

      const hydratedFromLogin = await applyUserProfile(payload?.user, {
        expectedVersion: loginVersion,
      });
      if (!hydratedFromLogin) {
        const profileLoaded = await ensureSession({ silent: false, force: true });
        if (!profileLoaded) {
          setSessionHint(false);
          return {
            success: false,
            message: "Login berhasil, tetapi sesi tidak dapat dipulihkan.",
          };
        }
      }

      return { success: true, message: "Login berhasil!" };
    } catch {
      setSessionHint(false);
      return {
        success: false,
        message: "Tidak dapat terhubung ke server.",
      };
    }
  };

  const logout = async () => {
    authStateVersionRef.current += 1;

    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}Auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}

    setSessionHint(false);
    setUser(null);
    clearSessionNotice();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        logout,
        sessionNotice,
        clearSessionNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
