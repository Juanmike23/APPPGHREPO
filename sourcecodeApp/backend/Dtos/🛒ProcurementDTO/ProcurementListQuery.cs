/*
 * PGH-DOC
 * File: Dtos/🛒ProcurementDTO/ProcurementListQuery.cs
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
    public class ProcurementListQueryRequest
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public long? FocusId { get; set; }
        public List<ProcurementListFilterRequest>? Filters { get; set; } = [];
        public string? Mode { get; set; } = "and";
        public ProcurementListSortRequest? Sort { get; set; }
        public ProcurementListDistinctRequest? Distinct { get; set; }
        public string? Search { get; set; }
        public List<string>? SearchColumns { get; set; }
        public string? PriorityTopNullColumn { get; set; }
        public List<long>? PriorityBottomIds { get; set; } = [];
    }

    public class ProcurementListQueryResponse
    {
        public List<object> Rows { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public int TotalPages { get; set; }
        public bool HasPreviousPage { get; set; }
        public bool HasNextPage { get; set; }
    }

    public class ProcurementListFilterRequest
    {
        public string? Column { get; set; }
        public string? Operator { get; set; } = "=";
        public string? Value { get; set; }
    }

    public class ProcurementListSortRequest
    {
        public string? Column { get; set; }
        public string? Direction { get; set; }
    }

    public class ProcurementListDistinctRequest
    {
        public string? Column { get; set; }
    }

    public class ProcurementExportRequest : ProcurementListQueryRequest
    {
        public string? Format { get; set; } = "xlsx";
        public List<string>? Columns { get; set; }
    }
}
