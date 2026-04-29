/*
 * PGH-DOC
 * File: Dtos/🛒ProcurementDTO/ParentChildDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.Procurement
{
    public class SetParentDto
    {
        public long ChildId { get; set; }
        public string ChildSource { get; set; } = null!;


        public long? ParentId { get; set; }
        public string? ParentSource { get; set; }
    }


    public class ParentChildReadDto
    {
        public long Id { get; set; }
        public long ChildId { get; set; }
        public string ChildSource { get; set; } = string.Empty;
        public long? ParentId { get; set; }
        public string? ParentSource { get; set; }
        public string ChildName { get; set; } = string.Empty;
        public string? ParentName { get; set; }
    }





}
