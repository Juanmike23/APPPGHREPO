/*
 * PGH-DOC
 * File: Models/🛒Procurement/ProcurementRelation.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Models.Procurement
{
    public class ProcurementRelation
    {
        public long Id { get; set; }
        public long ChildProcurementItemId { get; set; }
        public long ParentProcurementItemId { get; set; }
        public string RelationType { get; set; } = "ParentChild";
        public bool IsPrimary { get; set; }
        public decimal? ConfidenceScore { get; set; }
        public string LinkSource { get; set; } = "manual";
        public string? MatchReason { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public ProcurementItem? ChildItem { get; set; }
        public ProcurementItem? ParentItem { get; set; }
    }
}
