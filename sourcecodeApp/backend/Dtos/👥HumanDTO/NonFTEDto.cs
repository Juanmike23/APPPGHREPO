/*
 * PGH-DOC
 * File: Dtos/👥HumanDTO/NonFTEDto.cs
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
    

    public class NonFTEReadDto
    {
        public long Id { get; set; }
        public string? NPP { get; set; }
        public string? Nama { get; set; }
        
        public string? JenisKelamin { get; set; }
        public DateTime? TanggalLahir { get; set; }
        public DateTime? TanggalJoinBNI { get; set; }
        public string? ManmonthManagedService { get; set; }
        public string? Department { get; set; }
        public string? Role { get; set; }
        public string? Vendor { get; set; }
    }

    public class NonFTECreateDto : NonFTEReadDto { }

  
}
