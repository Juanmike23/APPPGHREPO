/*
 * PGH-DOC
 * File: Dtos/GenericImportDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.ImportTable
{
    public class GenericImportDto
    {
        public string? TargetTable { get; set; }
        public string? UploadedBy { get; set; }
        public string? FileName { get; set; }
      

        public List<Dictionary<string, object>> Records { get; set; } = new();
    }

}
