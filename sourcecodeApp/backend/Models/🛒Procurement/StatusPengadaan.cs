/*
 * PGH-DOC
 * File: Models/🛒Procurement/StatusPengadaan.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System;

namespace PGH.Models.Procurement
{
    

    public class StatusPengadaan
    {
        public long Id { get; set; }
        public string? No { get; set; }
        public string? AlurPengadaanIT { get; set; }
        public string? DenganDetail { get; set; }
        public string? Persetujuan { get; set; }
        public string? Status { get; set; }
        public long? TemplateNodeId { get; set; }
        public long? ProcurementItemId { get; set; }
        public long? NewID { get; set; }
        public long? ExistingID { get; set; }

        public string? ExtraData { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }



}
