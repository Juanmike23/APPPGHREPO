/*
 * PGH-DOC
 * File: Helpers/BusinessPlanFileStorageMigrationHelper.cs
 * Apa fungsi bagian ini:
 * - Memindahkan file Folder Planning legacy dari blob SQL ke filesystem lokal secara aman saat startup.
 * Kenapa perlu:
 * - Perlu agar storage blob lama tidak terus membebani database, tanpa memutus akses file lama.
 * Aturan khususnya apa:
 * - Migrasi bersifat idempotent.
 * - File fisik ditulis lebih dulu, lalu row database dipindah ke FileStoragePath dan FileData dibersihkan.
 * - Jika save database gagal, file fisik yang baru dibuat langsung dihapus.
 */

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PGH.Models.Planing.BusinessPlan;
using WebApplication2.Data;

namespace PGH.Helpers
{
    public static class BusinessPlanFileStorageMigrationHelper
    {
        private const int BatchSize = 25;

        public static async Task<int> MigrateLegacyFilesAsync(
            AppDbContext db,
            string contentRootPath,
            ILogger logger,
            CancellationToken cancellationToken = default)
        {
            var migratedCount = 0;

            while (true)
            {
                var pendingIds = await db.BusinessPlanFile
                    .AsNoTracking()
                    .Where(entry =>
                        !entry.IsFolder &&
                        entry.FileData != null &&
                        entry.FileSizeBytes != null &&
                        entry.FileSizeBytes > 0 &&
                        (entry.FileStoragePath == null || entry.FileStoragePath == string.Empty))
                    .OrderBy(entry => entry.Id)
                    .Select(entry => entry.Id)
                    .Take(BatchSize)
                    .ToListAsync(cancellationToken);

                if (pendingIds.Count == 0)
                {
                    break;
                }

                foreach (var pendingId in pendingIds)
                {
                    var entry = await db.BusinessPlanFile
                        .FirstOrDefaultAsync(item => item.Id == pendingId, cancellationToken);

                    if (!CanMigrate(entry))
                    {
                        continue;
                    }

                    var originalData = entry!.FileData!;
                    var effectiveTimestamp = entry.UploadedAt ?? entry.CreatedAt ?? DateTime.UtcNow;
                    var sourceName = string.IsNullOrWhiteSpace(entry.FileName)
                        ? $"legacy-file-{entry.Id}"
                        : entry.FileName!;
                    var relativeStoragePath = BusinessPlanFileStorageHelper.BuildRelativeStoragePath(sourceName, effectiveTimestamp);
                    var physicalStoragePath = BusinessPlanFileStorageHelper.ResolvePhysicalStoragePath(contentRootPath, relativeStoragePath);

                    BusinessPlanFileStorageHelper.EnsureStorageDirectory(contentRootPath, relativeStoragePath);

                    await System.IO.File.WriteAllBytesAsync(physicalStoragePath, originalData, cancellationToken);

                    entry.FileStoragePath = relativeStoragePath;
                    entry.FileSizeBytes = entry.FileSizeBytes > 0 ? entry.FileSizeBytes : originalData.LongLength;
                    entry.FileData = null;

                    try
                    {
                        await db.SaveChangesAsync(cancellationToken);
                        migratedCount++;
                    }
                    catch
                    {
                        entry.FileData = originalData;
                        entry.FileStoragePath = null;
                        entry.FileSizeBytes = entry.FileSizeBytes > 0 ? entry.FileSizeBytes : originalData.LongLength;
                        TryDeleteStoredFile(contentRootPath, relativeStoragePath, logger);
                        throw;
                    }
                }
            }

            return migratedCount;
        }

        private static bool CanMigrate(BusinessPlanFile? entry)
        {
            return entry != null
                && !entry.IsFolder
                && entry.FileData != null
                && entry.FileData.Length > 0
                && string.IsNullOrWhiteSpace(entry.FileStoragePath);
        }

        private static void TryDeleteStoredFile(string contentRootPath, string relativeStoragePath, ILogger logger)
        {
            try
            {
                var physicalPath = BusinessPlanFileStorageHelper.ResolvePhysicalStoragePath(contentRootPath, relativeStoragePath);
                if (System.IO.File.Exists(physicalPath))
                {
                    System.IO.File.Delete(physicalPath);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to clean up migrated business plan file after DB save failure. Path={Path}", relativeStoragePath);
            }
        }
    }
}
