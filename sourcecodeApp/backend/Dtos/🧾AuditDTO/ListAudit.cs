/*
 * PGH-DOC
 * File: Dtos/🧾AuditDTO/ListAudit.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System.Drawing;
using Newtonsoft.Json.Linq;

namespace PGH.Dtos.Audit
{
    public class ListAuditReadDto
    {
        public long? Id { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? NO { get; set; }
        public string? TAHUN { get; set; }
        public string? NAMAAUDIT { get; set; }
        public string? RINGKASANAUDIT { get; set; }
        public string? PEMANTAUAN { get; set; }
        public string? JENISAUDIT { get; set; }
        public string? SOURCE { get; set; }
        public string? PICAUDIT { get; set; }
        public string? DEPARTMENT { get; set; }
        public string? PICAPLIKASI { get; set; }
        // RHA is NOT the file anymore - it's existence
        public bool RHA { get; set; }
        public bool LHA { get; set; }
        public DateTime? IN { get; set; }
        public DateTime? JATUHTEMPO { get; set; }
        public string? LINK { get; set; }
        public string? STATUS { get; set; }
        public string? KETERANGAN { get; set; }

        //public string? JenisDocAudit { get; set; }

        public Dictionary<string, object>? ExtraData { get; set; }
    }

    public class ListAuditCreateDto
    {
        public string? TAHUN { get; set; }
        public string? NAMAAUDIT { get; set; }
        public string? RINGKASANAUDIT { get; set; }
        public string? PEMANTAUAN { get; set; }
        public string? JENISAUDIT { get; set; }
        public string? SOURCE { get; set; }
        public string? PICAUDIT { get; set; }
        public string? DEPARTMENT { get; set; }
        public string? PICAPLIKASI { get; set; }
        public DateTime? IN { get; set; }
        public DateTime? JATUHTEMPO { get; set; }
        public string? LINK { get; set; }
        public string? STATUS { get; set; }
        public string? KETERANGAN { get; set; }
        public Dictionary<string, object>? ExtraData { get; set; }
    }

    public class ListAuditExportRequest
    {
        public string? Format { get; set; } = "xlsx";
        public string? ViewKey { get; set; } = "default";
        public string? Type { get; set; }
        public List<string>? Columns { get; set; }
        public JToken? Filters { get; set; }
        public string? Mode { get; set; } = "and";
        public ListAuditExportSortRequest? Sort { get; set; }
        public ListAuditExportDistinctRequest? Distinct { get; set; }
        public string? Search { get; set; }
        public List<string>? SearchColumns { get; set; }
    }

    public class ListAuditQueryRequest
    {
        public string? Type { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
        public long? FocusId { get; set; }
        public JToken? Filters { get; set; }
        public string? Mode { get; set; } = "and";
        public ListAuditExportSortRequest? Sort { get; set; }
        public ListAuditExportDistinctRequest? Distinct { get; set; }
        public string? Search { get; set; }
        public List<string>? SearchColumns { get; set; }
    }

    public class ListAuditQueryResponse
    {
        public List<object> Rows { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public int TotalPages { get; set; }
        public bool HasPreviousPage { get; set; }
        public bool HasNextPage { get; set; }
    }

    public class ListAuditExportFilterRequest
    {
        public string? Column { get; set; }
        public string? Operator { get; set; } = "=";
        public string? Value { get; set; }
    }

    public class ListAuditExportSortRequest
    {
        public string? Column { get; set; }
        public string? Direction { get; set; }
    }

    public class ListAuditExportDistinctRequest
    {
        public string? Column { get; set; }
    }

    public class SummaryAuditReadDto
    {
        public long? Id { get; set; }
        public string? JenisDocAudit { get; set; }
        public string? NAMAAUDIT { get; set; }
        public string? LINK { get; set; }
        public string? STATUS { get; set; }
        public string? PICAUDIT { get; set; }
        public string? TAHUN { get; set; }
        public string? SOURCE { get; set; }
        public string? JumlahTemuan { get; set; }
    }

    public class SummaryAuditCreateDto : SummaryAuditReadDto { }
}
