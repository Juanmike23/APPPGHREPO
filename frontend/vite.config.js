/*
 * PGH-DOC
 * File: vite.config.js
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const withTrailingSlash = (value) => {
  const normalized = String(value || "/").trim();
  if (!normalized || normalized === "/") return "/";
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
};

export default defineConfig(({ mode }) => {
  const rawEnv = loadEnv(mode, process.cwd(), "");
  const shouldSilenceSassDeprecations =
    rawEnv.VITE_SASS_SILENCE_DEPRECATIONS !== "false";
  const apiBaseSource =
    rawEnv.REACT_APP_API_BASE_URL ||
    "/api/";
  const apiBase = withTrailingSlash(apiBaseSource);
  const baseSource =
    mode === "production"
      ? (rawEnv.PUBLIC_URL || rawEnv.VITE_PUBLIC_URL || "/")
      : "/";
  const base = withTrailingSlash(baseSource);

  const processEnv = {
    ...rawEnv,
    REACT_APP_API_BASE_URL: apiBase,
    PUBLIC_URL: base === "/" ? "" : base.replace(/\/$/, ""),
    NODE_ENV: mode === "production" ? "production" : "development",
  };

  return {
    resolve: {
      alias: {
        "@pgh/ui-bootstrap": path.resolve(
          process.cwd(),
          "src/Variables/UI/bootstrapCompat.jsx"
        ),
      },
    },
    plugins: [
      react({
        include: /\.(j|t)sx?$/,
      }),
    ],
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true,
          // Stage-1 migration: keep legacy SCSS build stable while we refactor @import -> @use gradually.
          ...(shouldSilenceSassDeprecations
            ? {
                silenceDeprecations: [
                  "import",
                  "global-builtin",
                  "color-functions",
                  "if-function",
                ],
              }
            : {}),
        },
      },
    },
    base,
    define: {
      "process.env": JSON.stringify(processEnv),
      global: "globalThis",
    },
    server: {
      host: true,
      port: 3000,
      strictPort: true,
      open: true,
      proxy: {
        // Proxy backend API only; keep legacy static mock JSON (/api/*.json)
        // served by Vite public folder to avoid ECONNREFUSED noise.
        "^/api/(?!.*\\.json$)": {
          target: rawEnv.VITE_DEV_BACKEND_URL || "http://localhost:57962",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      host: true,
      port: 4173,
    },
    optimizeDeps: {
      // Vite 8 uses Rolldown for dep optimization; prefer rolldownOptions over deprecated esbuildOptions.
      rolldownOptions: {
        moduleTypes: {
          ".js": "jsx",
        },
      },
    },
    build: {
      outDir: "build",
      sourcemap: rawEnv.GENERATE_SOURCEMAP === "true",
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        checks: {
          pluginTimings: false,
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (
              id.includes("/react/") ||
              id.includes("react-dom") ||
              id.includes("react-router") ||
              id.includes("scheduler")
            ) {
              return "react-vendor";
            }

            if (
              id.includes("i18next") ||
              id.includes("react-i18next")
            ) {
              return "i18n-vendor";
            }

            if (id.includes("axios")) {
              return "http-vendor";
            }

            if (
              id.includes("ag-grid-community") ||
              id.includes("ag-grid-react")
            ) {
              return "ag-grid";
            }

            if (
              id.includes("exceljs")
            ) {
              return "excel-utils";
            }

            if (id.includes("@dnd-kit/")) {
              return "dnd-kit";
            }
          },
        },
      },
    },
  };
});
