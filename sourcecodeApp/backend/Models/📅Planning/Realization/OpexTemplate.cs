/*
 * PGH-DOC
 * File: Models/📅Planning/Realization/OpexTemplate.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Models.Planing.Realization
{
    public class OpexTemplate
    {
        public long Id { get; set; }
        public long PlanningDashboardTableId { get; set; }
        public int Year { get; set; }

        public string? SIT { get; set; }
        public string? MataAnggaranParent { get; set; }
        public string? MataAnggaranChild { get; set; }
        public string? RowType { get; set; }
        public bool IsKro { get; set; }

        public decimal Jan { get; set; }
        public decimal Feb { get; set; }
        public decimal Mar { get; set; }
        public decimal Apr { get; set; }
        public decimal May { get; set; }
        public decimal Jun { get; set; }
        public decimal Jul { get; set; }
        public decimal Aug { get; set; }
        public decimal Sep { get; set; }
        public decimal Oct { get; set; }
        public decimal Nov { get; set; }
        public decimal Dec { get; set; }

        public decimal? Accumulated { get; set; }
        public decimal? RealizationLastYearThisMonth { get; set; }
        public decimal? RealizationThisYearThisMonth { get; set; }
        public decimal? GrowthRp { get; set; }
        public decimal? Growth { get; set; }
        public decimal? FullYearFY { get; set; }
        public decimal? YTD { get; set; }
        public decimal? toAngThisYear { get; set; }
        public decimal? toAngYTDThisYear { get; set; }
        public decimal? SisaFY { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public PlanningDashboardTable? PlanningDashboardTable { get; set; }
    }
}
