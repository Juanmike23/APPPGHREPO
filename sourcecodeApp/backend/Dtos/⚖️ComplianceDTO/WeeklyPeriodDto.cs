/*
 * PGH-DOC
 * File: Dtos/⚖️ComplianceDTO/WeeklyPeriodDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.Compliance
{
    public class WeeklyPeriodDto
    {
        public long Id { get; set; }
        public string PeriodCode { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public DateTime? WeekStartDate { get; set; }
        public DateTime? WeekEndDate { get; set; }
        public int? Year { get; set; }
        public int? WeekNumber { get; set; }
        public bool IsLegacy { get; set; }
        public int RowCount { get; set; }
    }
}
