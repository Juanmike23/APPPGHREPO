/*
 * PGH-DOC
 * File: Dtos/⚖️ComplianceDTO/WeeklyTableDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using PGH.Dtos.Common;

namespace PGH.Dtos.Compliance
{
    public class WeeklyTableReadDto
    {
        public long Id { get; set; }
        public long? WeeklyTableInstanceId { get; set; }
        public string? Progress { get; set; }
        public string? Status { get; set; }
        public string? Highlights { get; set; }
        public string? WorkInProgress { get; set; }
        public string? Target { get; set; }
        public string? NextToDo { get; set; }
        public Dictionary<string, object>? ExtraData { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class WeeklyTableCreateDto
    {
        public long? WeeklyTableInstanceId { get; set; }
        public string? Progress { get; set; }
        public string? Status { get; set; }
        public string? Highlights { get; set; }
        public string? WorkInProgress { get; set; }
        public string? Target { get; set; }
        public string? NextToDo { get; set; }
        public Dictionary<string, object>? ExtraData { get; set; }
    }

    public class WeeklyTableExportRequest : TableQueryRequest
    {
        public string? Format { get; set; } = "xlsx";
        public List<string>? Columns { get; set; }
    }
}
