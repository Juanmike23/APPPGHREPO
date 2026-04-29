/*
 * PGH-DOC
 * File: Models/⚖️ComplianceModel/WeeklyPeriod.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Models.Compliance
{
    public class WeeklyPeriod
    {
        public long Id { get; set; }
        public string PeriodCode { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public DateTime? WeekStartDate { get; set; }
        public DateTime? WeekEndDate { get; set; }
        public int? Year { get; set; }
        public int? WeekNumber { get; set; }
        public bool IsLegacy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
