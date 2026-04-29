/*
 * PGH-DOC
 * File: Models/📅Planning/Realization/OpexTemplateHeader.cs
 * Apa fungsi bagian ini:
 * - Menyimpan metadata header OPEX Template per table+year secara terstruktur.
 * Kenapa perlu:
 * - Menghindari penyimpanan label header di ExtraData per baris yang rawan tidak konsisten.
 * Aturan khususnya apa:
 * - Satu kombinasi PlanningDashboardTableId + Year hanya boleh punya satu metadata aktif.
 * - Label header mengikuti hasil import terbaru untuk table+year yang sama.
 */

namespace PGH.Models.Planing.Realization
{
    public class OpexTemplateHeader
    {
        public long Id { get; set; }
        public long PlanningDashboardTableId { get; set; }
        public int Year { get; set; }

        public int ReportMonthIndex { get; set; } = 12;
        public string? RealizationLastYearLabel { get; set; }
        public string? RealizationThisYearLabel { get; set; }
        public string? GrowthRpLabel { get; set; }
        public string? GrowthPercentLabel { get; set; }
        public string? FullYearFyLabel { get; set; }
        public string? YtdLabel { get; set; }
        public string? ToAngThisYearLabel { get; set; }
        public string? ToAngYtdThisYearLabel { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public PlanningDashboardTable? PlanningDashboardTable { get; set; }
    }
}

