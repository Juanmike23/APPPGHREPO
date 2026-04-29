/*
 * PGH-DOC
 * File: Models/🧾AuditModel/ListAudit.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Models.Audit
{
    public class ListAudit
    {
        public long Id { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public string? TAHUN { get; set; }
        public string? NAMAAUDIT { get; set; }
        public string? RINGKASANAUDIT { get; set; }
        public string? PEMANTAUAN { get; set; }
        public string? JENISAUDIT { get; set; }
        public string? SOURCE { get; set; }
        public string? PICAUDIT { get; set; }
        public string? DEPARTMENT { get; set; }
        public string? PICAPLIKASI { get; set; }
        public byte[]? RHA { get; set; }
        public byte[]? LHA { get; set; }
        public DateTime? IN { get; set; }
        public DateTime? JATUHTEMPO { get; set; }
        public string? LINK { get; set; }
        public string? STATUS { get; set; }
        public string? KETERANGAN { get; set; }
        public string? ExtraData { get; set; }

     

        //Summary Tambahan
        //public string? JenisDocAudit { get; set; }
        //public string? JumlahTemuan { get; set; }
    }
}
