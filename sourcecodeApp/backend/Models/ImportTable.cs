/*
 * PGH-DOC
 * File: Models/ImportTable.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */


    using System.ComponentModel.DataAnnotations; // 👈 REQUIRED for [Key]
using System.ComponentModel.DataAnnotations.Schema;
namespace PGH.Models.ImportTable
{
    public class ImportSession
    {
        [Key]
        public int ImportId { get; set; }
        public string? TargetTable { get; set; }
        public string? UploadedBy { get; set; }
        public DateTime? UploadedAt { get; set; } = DateTime.UtcNow;
        public string? FileName { get; set; }
        public string? Status { get; set; } = "Pending";
        public int? ErrorCount { get; set; }
        public int? Year { get; set; }
        public ICollection<ImportData> ImportData { get; set; } = new List<ImportData>();
    }

    public class ImportData
    {
        [Key]
        public long Id { get; set; }

        [ForeignKey(nameof(ImportSession))]
        public int ImportId { get; set; }
        public int? RowNumber { get; set; }
        public string? Data { get; set; }     // JSON
        public bool? IsValid { get; set; }
        public string? ValidationMessage { get; set; }

        public string SheetName { get; set; } = string.Empty;
        public int SheetIndex { get; set; }


        public ImportSession ImportSession { get; set; } = null!; // navigation
    }
}
