/*
 * PGH-DOC
 * File: Dtos/📅PlaningDTO/PlanningDashboardTableDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.Planing.Realization
{
    public class PlanningDashboardTableReadDto
    {
        public long Id { get; set; }
        public string Scope { get; set; } = "OPEX";
        public string TableName { get; set; } = string.Empty;
        public int Year { get; set; }
        public bool IsDefault { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class PlanningDashboardTableCreateDto
    {
        public string? Scope { get; set; }
        public string? TableName { get; set; }
        public int? Year { get; set; }
    }

    public class PlanningDashboardTableUpdateDto
    {
        public string TableName { get; set; } = string.Empty;
    }
}
