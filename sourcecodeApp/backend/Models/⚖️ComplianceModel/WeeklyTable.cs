/*
 * PGH-DOC
 * File: Models/⚖️ComplianceModel/WeeklyTable.cs
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
    public class WeeklyTable
    {
        public long Id { get; set; }
        public long? WeeklyPeriodId { get; set; }
        public long? WeeklyTableInstanceId { get; set; }
        public Guid LogicalRowKey { get; set; }
        public string? Highlights { get; set; }
        public string? WorkInProgress { get; set; }
        public string? Target { get; set; }
        public string? NextToDo { get; set; }
        public string? Status { get; set; }
        public string? Progress { get; set; }
        public string? ExtraData { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

}
