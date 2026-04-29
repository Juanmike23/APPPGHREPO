/*
 * PGH-DOC
 * File: Models/🛒Procurement/NewProcure.cs
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
    public class NewProcure
    {
        public long Id { get; set; }
        public string? Status_Pengadaan { get; set; }
        public string? No { get; set; }
        public string? Divisisesudah { get; set; }
        public string? project_id { get; set; }
        public string? Department { get; set; }
        public string? PIC { get; set; }
        public string? Vendor { get; set; }
        public string? TipePengadaan { get; set; }
        public string? Perjanjian { get; set; }
        public string? NilaiPengajuanAPS { get; set; }
        public string? NilaiApproveSTA { get; set; }
        public string? NilaiKontrak { get; set; }
        public string? JenisAnggaran { get; set; }
        public string? NoPKS { get; set; }
        public DateTime? TglPKS { get; set; }
        public string? NoSPK { get; set; }
        public DateTime? TglSPK { get; set; }
        public DateTime? WaktuMulai { get; set; }
        public DateTime? JatuhTempo { get; set; }
        public string? PICPFA { get; set; }
        public DateTime? TglKirimkePFA { get; set; }
        public string? Keterangan { get; set; }
        public string? SisaBulan { get; set; }
        public string? ExtraData { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties to ParentChild
        public ICollection<ParentChild>? ParentLinks { get; set; } = new List<ParentChild>();
        public ICollection<ParentChild>? ChildLinks { get; set; } = new List<ParentChild>();
    }
}
