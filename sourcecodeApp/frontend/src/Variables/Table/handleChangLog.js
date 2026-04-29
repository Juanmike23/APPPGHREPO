/*
 * PGH-DOC
 * File: src/Variables/Table/handleChangLog.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useCallback } from "react";
import { useAuth } from "../../Auth/AuthContext";

export default function useChangeLog() {
  const { user } = useAuth();

  const logChange = useCallback(
    async ({ tableName, id, changeType, field, oldValue, newValue, summary }) => {
      try {
        const payload = {
          tableName,
          entityId: id ?? null,
          changeType, // CREATE | UPDATE | DELETE
          changedBy: user?.name || "Unknown",
          changeSummary:
            summary ??
            (changeType === "UPDATE"
              ? `Field '${field}' changed from '${oldValue}' to '${newValue}'`
              : summary),
          ipAddress: window.location.hostname,
        };

        const res = await fetch(
          `${process.env.REACT_APP_API_BASE_URL}ChangeLog`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) throw new Error(await res.text());
        console.log("🧾 Change logged:", payload);
      } catch (err) {
        console.error("❌ ChangeLog failed:", err);
      }
    },
    [user]
  );

  return { logChange };
}
