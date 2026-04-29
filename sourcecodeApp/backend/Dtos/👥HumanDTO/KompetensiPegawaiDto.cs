/*
 * PGH-DOC
 * File: Dtos/👥HumanDTO/KompetensiPegawaiDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */


// DTOs for Human_Training
namespace PGH.Dtos.Human
{
    
    public class KompetensiPegawaiReadDto
    {
        public long ID { get; set; }
        public string? NPP { get; set; }
        public string? Nama { get; set; }
        public string? Department { get; set; }
        public string? JudulTraining { get; set; }
        public string? TahunPelaksanaan { get; set; }

        public string? SertifikasiNonSerifikasi { get; set; }
        public Dictionary<string, object>? ExtraData { get; set; }
    }

    public class KompetensiPegawaiCreateDto : KompetensiPegawaiReadDto { }
}
