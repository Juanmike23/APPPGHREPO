/*
 * PGH-DOC
 * File: Models/👥HumanModel/KompetensiPegawai.cs
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
    public class KompetensiPegawai
    {
        public long Id { get; set; }
        public string? NPP { get; set; }
        public string? Nama { get; set; }
        public string? Department { get; set; }
        public string? JudulTraining { get; set; }
        public string? TahunPelaksanaan { get; set; }

        public string? SertifikasiNonSerifikasi { get; set; }

        public string? ExtraData { get; set; }
    }



}
