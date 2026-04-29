/*
 * PGH-DOC
 * File: Models/⚖️ComplianceModel/WeeklyTableInstance.cs
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
    public class WeeklyTableInstance
    {
        public long Id { get; set; }
        public long? WeeklyPeriodId { get; set; }
        public Guid LogicalTableKey { get; set; }
        public string TableName { get; set; } = string.Empty;
        public string? SuggestionSeed { get; set; }
        public bool IsDefault { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
