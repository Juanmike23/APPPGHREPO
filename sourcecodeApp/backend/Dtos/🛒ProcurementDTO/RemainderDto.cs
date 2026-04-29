/*
 * PGH-DOC
 * File: Dtos/🛒ProcurementDTO/RemainderDto.cs
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
    public class ProcureReminderDto
    {
        public long Id { get; set; }
        public string Type { get; set; } = string.Empty; // "new" or "existing"
        public string? Dept { get; set; }
        public string? PIC { get; set; }
        public string? Vendor { get; set; }
        public string? Perjanjian { get; set; }
        public DateTime? JatuhTempo { get; set; }
        public string? Status_Pengadaan { get; set; }

        // Computed Fields
        public int SisaBulan { get; set; }
        public int DaysRemaining { get; set; }
        public string Countdown { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int Progress { get; set; }
        public int DoneCount { get; set; }
        public int TotalSteps { get; set; }
        public string CurrentStep { get; set; } = "Not Started";
        public string ColorCode { get; set; } = "success"; // 🟢 default
    }
}
