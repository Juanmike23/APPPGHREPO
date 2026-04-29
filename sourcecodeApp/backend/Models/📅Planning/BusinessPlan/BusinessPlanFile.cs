/*
 * PGH-DOC
 * File: Models/📅Planning/BusinessPlan/BusinessPlanFile.cs
 * Apa fungsi bagian ini:
 * - Entity penyimpanan file Business Plan khusus stream Planning.
 * Kenapa perlu:
 * - Memisahkan storage dokumen Planning dari Compliance agar governance data lebih bersih.
 * Aturan khususnya apa:
 * - Hanya dipakai endpoint Business Plan Directory.
 * - CreatedAt/UpdatedAt dikelola otomatis oleh AppDbContext.
 */

namespace PGH.Models.Planing.BusinessPlan
{
    public class BusinessPlanFile
    {
        public long Id { get; set; }
        public string? FileName { get; set; }
        public bool IsFolder { get; set; }
        public long? ParentId { get; set; }
        public string? ContentType { get; set; }
        public long? FileSizeBytes { get; set; }
        public string? FileStoragePath { get; set; }
        public byte[]? FileData { get; set; }
        public DateTime? UploadedAt { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public BusinessPlanFile? Parent { get; set; }
        public ICollection<BusinessPlanFile> Children { get; set; } = new List<BusinessPlanFile>();
    }
}
