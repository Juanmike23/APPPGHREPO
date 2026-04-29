/*
 * PGH-DOC
 * File: Models/ColumnOrder.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

// Models/ColumnOrder.cs
using System;
using System.ComponentModel.DataAnnotations;
using PGH.Models;
public class ColumnOrder
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string TableName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string ColumnKey { get; set; } = string.Empty;

    public int ColumnIndex { get; set; }

    [MaxLength(50)]
    public string ViewKey { get; set; } = "default";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
