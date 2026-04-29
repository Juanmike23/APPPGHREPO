/*
 * PGH-DOC
 * File: Models/👥HumanModel/BNU.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System.Runtime.InteropServices;

namespace PGH.Models.Human
{
    public class BNU
    {
        public long Id { get; set; }
        public string? UsulanTraining { get; set; }
        public string? BulanTahun { get; set; }
        public string? JumlahPerserta { get; set; }
        public string? SentralDesentral { get; set; }
        public string? DivisiDepartment { get; set; }
        public string? Biaya { get; set; }





        public string? ExtraData { get; set; }





    }



}
