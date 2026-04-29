/*
 * PGH-DOC
 * File: Dtos/🛒ProcurementDTO/StatusPengadaanDto.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.Procurement
{
    public class StatusPengadaanReadDto
    {
        public long Id { get; set; }
        public string? No { get; set; }
        public string? AlurPengadaanIT { get; set; }
        public string? DenganDetail { get; set; }
        public string? Persetujuan { get; set; }
        public string? Status { get; set; }
        public long? TemplateNodeId { get; set; }
        public string? TemplateKey { get; set; }
        public long? ParentTemplateId { get; set; }
        public string? NodeType { get; set; }
        public string? Code { get; set; }
        public string? Title { get; set; }
        public int? SortOrder { get; set; }
        public bool IsActionable { get; set; }
        public long? ProcurementItemId { get; set; }
        public long? NewID { get; set; }
        public long? ExistingID { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public Dictionary<string, object>? ExtraData { get; set; }
    }

    public class StatusPengadaanCreateDto : StatusPengadaanReadDto { }

    public class StatusProgressDto
    {
        public string Type { get; set; } = string.Empty;
        public long Id { get; set; }

        public int Progress { get; set; }
        public string ProgressText => $"{Progress}%";

        public int DoneCount { get; set; }
        public int TotalSteps { get; set; }

        public string CurrentStep { get; set; } = "Completed";

        // Optional quality-of-life property
        public string ProgressCategory
        {
            get
            {
                if (Progress == 0) return "Not Started";
                if (Progress < 100) return "In Progress";
                return "Completed";
            }
        }
    }



}
