/*
 * PGH-DOC
 * File: Dtos/👥HumanDTO/HumanResourceQuery.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan kontrak data antar layer (request/response).
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

namespace PGH.Dtos.Human
{
    public class HumanResourceQueryRequest
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public long? FocusId { get; set; }
        public List<HumanResourceFilterRequest>? Filters { get; set; } = [];
        public string? Mode { get; set; } = "and";
        public HumanResourceSortRequest? Sort { get; set; }
        public HumanResourceDistinctRequest? Distinct { get; set; }
        public string? Search { get; set; }
        public List<string>? SearchColumns { get; set; }
        public string? PriorityTopNullColumn { get; set; }
        public List<long>? PriorityBottomIds { get; set; } = [];
    }

    public class HumanResourceQueryResponse
    {
        public List<object> Rows { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public int TotalPages { get; set; }
        public bool HasPreviousPage { get; set; }
        public bool HasNextPage { get; set; }
    }

    public class HumanResourceFilterRequest
    {
        public string? Column { get; set; }
        public string? Operator { get; set; } = "=";
        public string? Value { get; set; }
    }

    public class HumanResourceSortRequest
    {
        public string? Column { get; set; }
        public string? Direction { get; set; }
    }

    public class HumanResourceDistinctRequest
    {
        public string? Column { get; set; }
    }

    public class HumanResourceExportRequest : HumanResourceQueryRequest
    {
        public string? Format { get; set; } = "xlsx";
        public List<string>? Columns { get; set; }
    }
}
