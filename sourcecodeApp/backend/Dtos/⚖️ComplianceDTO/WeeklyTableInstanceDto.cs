/*
 * PGH-DOC
 * File: Dtos/⚖️ComplianceDTO/WeeklyTableInstanceDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.Compliance
{
    public class WeeklyTableInstanceDto
    {
        public long Id { get; set; }
        public long? WeeklyPeriodId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public Dictionary<string, List<string>>? SuggestionValuesByColumn { get; set; }
        public bool IsDefault { get; set; }
        public int RowCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class WeeklyTableInstanceCreateDto
    {
        public long? PeriodId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public bool CloneRows { get; set; } = false;
        public long? CloneFromTableId { get; set; }
    }

    public class WeeklyTableInstanceUpdateDto
    {
        public string TableName { get; set; } = string.Empty;
    }
}
