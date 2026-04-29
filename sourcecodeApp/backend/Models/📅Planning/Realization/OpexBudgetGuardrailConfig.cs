/*
 * PGH-DOC
 * File: Models/📅Planning/Realization/OpexBudgetGuardrailConfig.cs
 * Apa fungsi bagian ini:
 * - Menyimpan konfigurasi target guardrail OPEX per table dan per tahun.
 * Kenapa perlu:
 * - Agar target monitoring YTD tidak hardcoded dan bisa dibedakan antar table/tahun tanpa ubah source code.
 * Aturan khususnya apa:
 * - Satu baris mewakili satu bulan.
 * - Jika bulan tidak punya konfigurasi, sistem wajib fallback ke baseline default.
 * - Nilai TargetPct disimpan dalam persen, misalnya 7 berarti 7%.
 */

namespace PGH.Models.Planing.Realization
{
    public class OpexBudgetGuardrailConfig
    {
        public long Id { get; set; }
        public long PlanningDashboardTableId { get; set; }
        public int Year { get; set; }
        public int MonthIndex { get; set; }
        public decimal TargetPct { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public PlanningDashboardTable? PlanningDashboardTable { get; set; }
    }
}
