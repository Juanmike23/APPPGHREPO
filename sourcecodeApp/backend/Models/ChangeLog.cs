/*
 * PGH-DOC
 * File: Models/ChangeLog.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */



namespace PGH.Models.ChangeLog;

public class ChangeLog
{
    public long Id { get; set; }
    public string TableName { get; set; } = string.Empty;
    public long? EntityId { get; set; }
    public string? ScopeTableName { get; set; }
    public long? ScopeEntityId { get; set; }
    public string? ChangedBy { get; set; }
    public string ChangeType { get; set; } = string.Empty; // e.g. UPDATE, INSERT, DELETE
   
    public string? ChangeSummary { get; set; } // JSON or description
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? IPAddress { get; set; }
}
