/*
 * PGH-DOC
 * File: Dtos/👥HumanDTO/FTEDto.cs
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
    public class FTEReadDto
    {
        public long Id { get; set; }
        public string? No { get; set; }
        public string? NPP { get; set; }


        public string? Nama { get; set; }
        public string? JenjangJabatan { get; set; }
        public string? Posisi { get; set; }
        public string? Department { get; set; }
    }

    public class FTECreateDto : FTEReadDto { }


}
