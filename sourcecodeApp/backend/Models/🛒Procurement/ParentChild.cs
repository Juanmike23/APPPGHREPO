/*
 * PGH-DOC
 * File: Models/🛒Procurement/ParentChild.cs
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
    public class ParentChild
    {
        public long Id { get; set; }

        // Child
        public long ChildId { get; set; }
        public string ChildSource { get; set; } = "NewProcure"; // "NewProcure" or "ExistingProcure"

        // Parent
        public long? ParentId { get; set; }
        public string? ParentSource { get; set; } // can be null

        // Navigation properties
        public NewProcure? ChildNew { get; set; }
        public ExistingProcure? ChildExisting { get; set; }

        public NewProcure? ParentNew { get; set; }
        public ExistingProcure? ParentExisting { get; set; }
    }
}
