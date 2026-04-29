/*
 * PGH-DOC
 * File: Models/RefreshToken.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */



using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

using PGH.Models.User;

namespace PGH.Models.User
{
    [Table("RefreshTokens")] // mapping tabel eksplisit (aman walau juga diatur di OnModelCreating) 
    public class RefreshToken
    {
        public int Id { get; set; }

        [Required]
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        // simpan HASH (base64 SHA-256 ≈ 44 char) → longgar ke 64
        [Required, MaxLength(64)]
        public string TokenHash { get; set; } = string.Empty;

        // NOTE kompatibilitas:
        // Di DB lama kolomnya bernama "ExpiryDate".
        // Jika nanti kolom DB sudah di-rename ke "ExpiresAt", HAPUS attribute [Column("ExpiryDate")] ini.
        
        public DateTime ExpiresAt { get; set; }       // UTC

        public bool IsRevoked { get; set; } = false;

        // UTC
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? RevokedAt { get; set; }     

        // agar bisa deteksi reuse saat rotasi
        [MaxLength(64)]
        public string? ReplacedByTokenHash { get; set; }

        // telemetri opsional (berguna investigasi)
        [MaxLength(256)] public string? UserAgent { get; set; }
        [MaxLength(64)] public string? CreatedByIp { get; set; } // IPv6 safe
    }
}
