/*
 * PGH-DOC
 * File: Dtos/👥HumanDTO/BnuDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */


namespace PGH.Dtos.Human
{
    public class BNUReadDto
    {
        public long Id { get; set; }
        public string? UsulanTraining { get; set; }
        public string? BulanTahun { get; set; }
        public string? JumlahPerserta { get; set; }
        public string? SentralDesentral { get; set; }
        public string? DivisiDepartment { get; set; }
        public string? Biaya { get; set; }

        public Dictionary<string, object>? ExtraData { get; set; }
    }

    public class BNUCreateDto : BNUReadDto { }

    
}
