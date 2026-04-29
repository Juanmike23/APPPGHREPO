/*
 * PGH-DOC
 * File: Helpers/BusinessPlanFileStorageHelper.cs
 * Apa fungsi bagian ini:
 * - Menyatukan aturan path storage file Folder Planning di filesystem lokal aplikasi.
 * Kenapa perlu:
 * - Perlu agar upload runtime dan migrasi legacy file memakai pola path yang sama dan aman.
 * Aturan khususnya apa:
 * - Semua file folder planning disimpan relatif ke content root backend.
 * - Nama file fisik memakai GUID agar tidak bentrok dengan nama user-facing.
 */

using System.IO;

namespace PGH.Helpers
{
    public static class BusinessPlanFileStorageHelper
    {
        public const string StorageDirectoryName = "BusinessPlanDirectory";

        public static string BuildRelativeStoragePath(string fileName, DateTime utcNow)
        {
            var extension = Path.GetExtension(fileName) ?? string.Empty;
            var storedFileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
            var relativePath = Path.Combine(
                "App_Data",
                StorageDirectoryName,
                utcNow.ToString("yyyy"),
                utcNow.ToString("MM"),
                storedFileName);

            return relativePath.Replace('\\', '/');
        }

        public static string ResolvePhysicalStoragePath(string contentRootPath, string relativeStoragePath)
        {
            var normalizedRelativePath = relativeStoragePath
                .Replace('/', Path.DirectorySeparatorChar)
                .Replace('\\', Path.DirectorySeparatorChar);

            return Path.GetFullPath(Path.Combine(contentRootPath, normalizedRelativePath));
        }

        public static void EnsureStorageDirectory(string contentRootPath, string relativeStoragePath)
        {
            var physicalStoragePath = ResolvePhysicalStoragePath(contentRootPath, relativeStoragePath);
            var storageDirectory = Path.GetDirectoryName(physicalStoragePath);
            if (!string.IsNullOrWhiteSpace(storageDirectory))
            {
                Directory.CreateDirectory(storageDirectory);
            }
        }
    }
}
