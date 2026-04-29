/*
 * PGH-DOC
 * File: Models/UserImage.cs
 * Apa fungsi bagian ini:
 * - File ini mendefinisikan struktur entity/domain yang disimpan di database.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using PGH.Models.User;

namespace PGH.Models.User
{
    public class UserImage
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }

        public byte[]? ImageData { get; set; }
        
        public string? MimeType { get; set; }

        public byte[]? ImageBg { get; set; }
        public string? ImageBgMimeType { get; set; }
        public DateTime? CreatedAt { get; set; }

        public User User { get; set; } = null!;
    }
    
}
