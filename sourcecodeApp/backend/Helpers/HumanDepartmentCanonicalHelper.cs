/*
 * PGH-DOC
 * File: Helpers/HumanDepartmentCanonicalHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika bantu bersama agar kode fitur tetap konsisten.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.EntityFrameworkCore;
using PGH.Models.Human;
using WebApplication2.Data;

namespace PGH.Helpers
{
    public static class HumanDepartmentCanonicalHelper
    {
        public static readonly IReadOnlyList<string> AllowedDepartmentCodes =
        [
            "TSC",
            "CBS",
            "DCP",
            "BOA",
            "IDS"
        ];

        private static readonly IReadOnlyList<(string Pattern, string Code)> AliasPatterns =
        [
            ("TSC", "TSC"),
            ("TESTING", "TSC"),
            ("TEST", "TSC"),
            ("QUALITY ASSURANCE", "TSC"),

            ("CBS", "CBS"),
            ("CORE", "CBS"),
            ("CORE BANKING", "CBS"),

            ("DCP", "DCP"),
            ("PAYMENT", "DCP"),
            ("PAYMENTS", "DCP"),
            ("DIGITAL CHANNEL", "DCP"),
            ("CHANNEL", "DCP"),

            ("BOA", "BOA"),
            ("OPERATION", "BOA"),
            ("OPERATIONS", "BOA"),
            ("ONBOARDING", "BOA"),

            ("IDS", "IDS"),
            ("DATA", "IDS"),
            ("INFORMATION DATA", "IDS")
        ];

        public static string? Canonicalize(string? rawDepartment)
        {
            var normalized = NormalizeToken(rawDepartment);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return null;
            }

            if (AllowedDepartmentCodes.Contains(normalized, StringComparer.OrdinalIgnoreCase))
            {
                return normalized;
            }

            foreach (var (pattern, code) in AliasPatterns)
            {
                if (ContainsPattern(normalized, pattern))
                {
                    return code;
                }
            }

            return null;
        }

        public static string? NormalizeDisplayValue(string? rawDepartment)
        {
            if (string.IsNullOrWhiteSpace(rawDepartment))
            {
                return null;
            }

            return string.Join(
                " ",
                rawDepartment
                    .Trim()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }

        public static string? NormalizeComparableValue(string? rawDepartment)
        {
            return NormalizeToken(rawDepartment);
        }

        public static string? NormalizeComparisonBucket(string? rawDepartment)
        {
            return Canonicalize(rawDepartment) ?? NormalizeToken(rawDepartment);
        }

        public static IReadOnlyList<string> GetAliasPatternsForCode(string? code)
        {
            var normalizedCode = NormalizeToken(code);
            if (string.IsNullOrWhiteSpace(normalizedCode))
            {
                return Array.Empty<string>();
            }

            return AliasPatterns
                .Where(entry => string.Equals(entry.Code, normalizedCode, StringComparison.OrdinalIgnoreCase))
                .Select(entry => entry.Pattern)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        public static bool IsAllowedDepartmentCode(string? code)
        {
            var normalizedCode = NormalizeToken(code);
            return !string.IsNullOrWhiteSpace(normalizedCode) &&
                   AllowedDepartmentCodes.Contains(normalizedCode, StringComparer.OrdinalIgnoreCase);
        }

        public static void CanonicalizeEntity(object entity)
        {
            NormalizeEntityDisplayValues(entity);
        }

        public static void NormalizeEntityDisplayValues(object entity)
        {
            switch (entity)
            {
                case FTE fte:
                    fte.Department = NormalizeDisplayValue(fte.Department);
                    break;
                case NonFTE nonFte:
                    nonFte.Department = NormalizeDisplayValue(nonFte.Department);
                    break;
                case KebutuhanFTE kebutuhan:
                    kebutuhan.Department = NormalizeDisplayValue(kebutuhan.Department);
                    break;
                case KompetensiPegawai kompetensi:
                    kompetensi.Department = NormalizeDisplayValue(kompetensi.Department);
                    break;
                case BNU bnu:
                    bnu.DivisiDepartment = NormalizeDisplayValue(bnu.DivisiDepartment);
                    break;
                case InternalTraining training:
                    training.DivisiDepartment = NormalizeDisplayValue(training.DivisiDepartment);
                    break;
            }
        }

        public static async Task<int> NormalizePersistedDepartmentColumnsAsync(
            AppDbContext db,
            CancellationToken cancellationToken = default)
        {
            var utcNow = DateTime.UtcNow;
            var changedCount = 0;

            changedCount += await NormalizeSetAsync(
                db.FTE,
                row => row.Department,
                (row, canonical) => row.Department = canonical,
                row => row.UpdatedAt = utcNow,
                cancellationToken);

            changedCount += await NormalizeSetAsync(
                db.NonFTE,
                row => row.Department,
                (row, canonical) => row.Department = canonical,
                row => row.UpdatedAt = utcNow,
                cancellationToken);

            changedCount += await NormalizeSetAsync(
                db.KebutuhanFTE,
                row => row.Department,
                (row, canonical) => row.Department = canonical,
                row => row.UpdatedAt = utcNow,
                cancellationToken);

            changedCount += await NormalizeSetAsync(
                db.KompetensiPegawai,
                row => row.Department,
                (row, canonical) => row.Department = canonical,
                onChanged: null,
                cancellationToken);

            changedCount += await NormalizeSetAsync(
                db.BNU,
                row => row.DivisiDepartment,
                (row, canonical) => row.DivisiDepartment = canonical,
                onChanged: null,
                cancellationToken);

            changedCount += await NormalizeSetAsync(
                db.InternalTraining,
                row => row.DivisiDepartment,
                (row, canonical) => row.DivisiDepartment = canonical,
                onChanged: null,
                cancellationToken);

            if (changedCount > 0)
            {
                await db.SaveChangesAsync(cancellationToken);
            }

            return changedCount;
        }

        private static async Task<int> NormalizeSetAsync<TEntity>(
            DbSet<TEntity> set,
            Func<TEntity, string?> read,
            Action<TEntity, string?> write,
            Action<TEntity>? onChanged,
            CancellationToken cancellationToken)
            where TEntity : class
        {
            var rows = await set.ToListAsync(cancellationToken);
            var changedCount = 0;

            foreach (var row in rows)
            {
                var normalized = NormalizeDisplayValue(read(row));
                var current = NormalizeDisplayValue(read(row));
                var next = NormalizeDisplayValue(normalized);

                if (string.Equals(current, next, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                write(row, normalized);
                onChanged?.Invoke(row);
                changedCount++;
            }

            return changedCount;
        }

        private static bool ContainsPattern(string source, string pattern)
        {
            if (string.Equals(source, pattern, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return source.Contains(pattern, StringComparison.OrdinalIgnoreCase);
        }

        private static string? NormalizeToken(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var normalized = value.Trim().ToUpperInvariant();
            normalized = string.Join(
                " ",
                normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

            return normalized;
        }
    }
}
