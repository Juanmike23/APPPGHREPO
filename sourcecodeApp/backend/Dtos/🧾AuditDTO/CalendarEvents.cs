/*
 * PGH-DOC
 * File: Dtos/🧾AuditDTO/CalendarEvents.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.Audit
{
    public class CalendarEventsReadDto
    {
        public long Id { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public DateTime? StartDateTime { get; set; }
        public string? Place { get; set; }
        public string? Color { get; set; }

        public Dictionary<string, object>? ExtraData { get; set; }
    }



    public class CalendarEventsCreateDto : CalendarEventsReadDto { }
}