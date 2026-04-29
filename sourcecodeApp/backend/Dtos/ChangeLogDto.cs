/*
 * PGH-DOC
 * File: Dtos/ChangeLogDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.ChangeLog
{
    public class ChangeLogListQueryDto
    {
        public int? Limit { get; set; }
        public int? Offset { get; set; }
        public string? ScopeTableName { get; set; }
        public long? ScopeEntityId { get; set; }
    }

    public class ChangeLogDetailDto
    {
        public string Field { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string? Before { get; set; }
        public string? After { get; set; }
    }

    public class ChangeLogDto
    {
        public string TableName { get; set; } = string.Empty;
        public long? EntityId { get; set; }
        public string? ScopeTableName { get; set; }
        public long? ScopeEntityId { get; set; }
        public string? ChangedBy { get; set; }
        public string ChangeType { get; set; } = string.Empty;
        public string? ChangeSummary { get; set; }
        public string? IPAddress { get; set; }
    }

    public class ChangeLogReadDto : ChangeLogDto
    {
        public long Id { get; set; }
        public DateTime Timestamp { get; set; }
        public string? ChangedByDisplay { get; set; }
        public string? ChangedByLevel { get; set; }
        public string? ChangeSummaryDisplay { get; set; }
        public List<ChangeLogDetailDto> ChangeDetails { get; set; } = new();
    }
}
