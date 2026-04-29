/*
 * PGH-DOC
 * File: Models/⚖️ComplianceModel/DocumentPeriodReport.cs
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
    public class DocumentPeriodReport
    {
        public long Id { get; set; }
        public long? DocumentPeriodReportGroupId { get; set; }
        public string? Period { get; set; }
        public string? PeriodName { get; set; }
        public long? DocumentId { get; set; }
        public string? DocumentToSubmit { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? Link { get; set; }
        public decimal ProgressPercent { get; set; }
    }

}
