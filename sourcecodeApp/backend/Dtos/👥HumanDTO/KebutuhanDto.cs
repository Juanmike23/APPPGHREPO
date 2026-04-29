/*
 * PGH-DOC
 * File: Dtos/👥HumanDTO/KebutuhanDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

// DTOs for Human_Resource
namespace PGH.Dtos.Human
{
   

    public class KebutuhanFTEReadDto
    {
        public long Id { get; set; }
        public string? DIREKTORAT { get; set; }
        public string? KODEJOB { get; set; }
        public string? JOB { get; set; }
        public string? Department { get; set; }
        public int? Existing { get; set; }
        public int? Kebutuhan { get; set; }
        public int? Gap { get; set; }
    }

    public class KebutuhanFTECreateDto : KebutuhanFTEReadDto { }
}
