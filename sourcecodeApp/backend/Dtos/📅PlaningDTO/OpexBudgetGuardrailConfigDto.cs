/*
 * PGH-DOC
 * File: Dtos/📅PlaningDTO/OpexBudgetGuardrailConfigDto.cs
 * Apa fungsi bagian ini:
 * - Menjadi kontrak request/response untuk konfigurasi target guardrail OPEX.
 * Kenapa perlu:
 * - Agar konfigurasi target per table/tahun bisa dikelola rapi tanpa membocorkan entity database langsung ke API.
 * Aturan khususnya apa:
 * - TargetPct menggunakan persen utuh, misalnya 7 berarti 7%.
 * - MonthIndex selalu 1-12.
 * - Jika TargetPct null pada request update, override bulan tersebut dihapus dan sistem kembali ke default.
 */

namespace PGH.Dtos.Planing.Realization
{
    public class OpexBudgetGuardrailTargetRowDto
    {
        public int MonthIndex { get; set; }
        public string? Month { get; set; }
        public decimal? TargetPct { get; set; }
        public decimal? DefaultTargetPct { get; set; }
        public bool IsDefault { get; set; }
    }

    public class OpexBudgetGuardrailConfigReadDto
    {
        public long TableId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public int Year { get; set; }
        public string Source { get; set; } = "default";
        public List<OpexBudgetGuardrailTargetRowDto> Rows { get; set; } = new();
    }

    public class OpexBudgetGuardrailConfigUpdateRequest
    {
        public int? Year { get; set; }
        public List<OpexBudgetGuardrailTargetRowDto> Rows { get; set; } = new();
    }
}
