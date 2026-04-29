/*
 * PGH-DOC
 * File: Models/🛒Procurement/StatusPengadaanTemplate.cs
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
    public class StatusPengadaanTemplate
    {
        public long Id { get; set; }
        public string? TemplateKey { get; set; }
        public long? ParentTemplateId { get; set; }
        public string? NodeType { get; set; }
        public string? Code { get; set; }
        public string? Title { get; set; }
        public int? SortOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public string? No { get; set; }
        public string? AlurPengadaanIT { get; set; }
        public string? DenganDetail { get; set; }
        public string? Persetujuan { get; set; }
        public string? Status { get; set; }
        public string? ExtraData { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

}
