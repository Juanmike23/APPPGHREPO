/*
 * PGH-DOC
 * File: Dtos/ColumnOrderDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.Preference;

// DTOs/ColumnOrderUpdateDto.cs
public class ColumnOrderUpdateDto
{
    public string TableName { get; set; } = string.Empty;
    public string ColumnKey { get; set; } = string.Empty;
    public int ColumnIndex { get; set; }
    public string ViewKey { get; set; } = "default";
}

// DTOs/ColumnOrderReadDto.cs
public class ColumnOrderReadDto
{
    public string ColumnKey { get; set; } = string.Empty;
    public int ColumnIndex { get; set; }
}
