/*
 * PGH-DOC
 * File: Models/📅Planning/Realization/OpexTemplateMonthlySnapshot.cs
 * Apa fungsi bagian ini:
 * - Menyimpan override nilai realisasi hasil import per SIT dan per bulan report.
 * Kenapa perlu:
 * - Agar pembacaan realisasi deterministik: prioritas import user lebih tinggi daripada fallback tahun sebelumnya.
 * Aturan khususnya apa:
 * - Key logis snapshot: PlanningDashboardTableId + Year + ReportMonthIndex + SIT.
 * - Snapshot hanya menyimpan nilai yang benar-benar ada di file import untuk bulan tersebut.
 */

namespace PGH.Models.Planing.Realization
{
    public class OpexTemplateMonthlySnapshot
    {
        public long Id { get; set; }
        public long PlanningDashboardTableId { get; set; }
        public int Year { get; set; }
        public string SIT { get; set; } = string.Empty;
        public int ReportMonthIndex { get; set; }

        public bool HasRealizationLastYearOverride { get; set; }
        public decimal? RealizationLastYearThisMonth { get; set; }

        public bool HasRealizationThisYearOverride { get; set; }
        public decimal? RealizationThisYearThisMonth { get; set; }

        public bool HasFullYearFyOverride { get; set; }
        public decimal? FullYearFY { get; set; }
        public string SnapshotSource { get; set; } = "import";

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public PlanningDashboardTable? PlanningDashboardTable { get; set; }
    }
}
