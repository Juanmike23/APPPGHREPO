/*
 * PGH-DOC
 * File: Dtos/⚖️ComplianceDTO/DocumentPeriodReport.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Newtonsoft.Json.Linq;

namespace PGH.Dtos.Compliance
{
    public class DocumentPeriodReportReadDto
    {
        public long? Id { get; set; }
        public long? GroupId { get; set; }
        public string? Period { get; set; }
        public string? PeriodName { get; set; }
        public long? DocumentId { get; set; }
        public string? DocumentToSubmit { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? FileName { get; set; }
        public string? Link { get; set; }
        public string? DocumentFileUrl { get; set; }
        public decimal ProgressPercent { get; set; }
    }

    public class DocumentPeriodReportCreateDto
    {
        public long? GroupId { get; set; }
        public string? Period { get; set; }
        public string? PeriodName { get; set; }
        public long? DocumentId { get; set; }
        public string? DocumentToSubmit { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? Link { get; set; }
        public decimal ProgressPercent { get; set; }
    }

    public class DocumentPeriodReportGroupDto
    {
        public long Id { get; set; }
        public string PeriodName { get; set; } = string.Empty;
        public string? Period { get; set; }
        public Dictionary<string, List<string>>? SuggestionValuesByColumn { get; set; }
        public int RowCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class DocumentPeriodReportGroupCreateDto
    {
        public string PeriodName { get; set; } = string.Empty;
        public string? Period { get; set; }
        public long? CloneFromGroupId { get; set; }
    }

    public class DocumentPeriodReportGroupUpdateDto
    {
        public string PeriodName { get; set; } = string.Empty;
    }

    public class DocumentPeriodReportPatchRequestDto
    {
        public JObject? Changes { get; set; }
    }
}
