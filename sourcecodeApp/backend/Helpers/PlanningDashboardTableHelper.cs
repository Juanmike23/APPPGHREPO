/*
 * PGH-DOC
 * File: Helpers/PlanningDashboardTableHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan utilitas scope dan naming untuk Planning dashboard table.
 * Kenapa perlu:
 * - Perlu agar normalisasi scope, filter scope, dan penamaan dashboard Planning tetap konsisten lintas controller.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.EntityFrameworkCore;
using PGH.Models.Planing.Realization;
using System.Text.Json;

namespace PGH.Helpers;

public static class PlanningDashboardTableHelper
{
    public const string ScopeOpex = "OPEX";

    private static readonly HashSet<string> AllowedScopes = new(StringComparer.OrdinalIgnoreCase)
    {
        ScopeOpex
    };

    public static bool TryNormalizeScope(string? scope, out string normalizedScope, out string? error)
    {
        normalizedScope = ScopeOpex;
        error = null;

        var raw = string.IsNullOrWhiteSpace(scope)
            ? ScopeOpex
            : scope.Trim().ToUpperInvariant();

        if (!AllowedScopes.Contains(raw))
        {
            error = "Scope harus OPEX.";
            return false;
        }

        normalizedScope = raw;
        return true;
    }

    public static IQueryable<PlanningDashboardTable> ApplyScopeFilter(
        IQueryable<PlanningDashboardTable> query,
        string normalizedScope)
    {
        return query.Where(item => item.Scope == normalizedScope);
    }

    public static string BuildDefaultTableName(string scope, int year)
    {
        return $"{scope} {year}";
    }

    public static string BuildDeleteSummary(
        PlanningDashboardTable target,
        PlanningDashboardTable nextActive,
        string scope)
    {
        return JsonSerializer.Serialize(new
        {
            kind = "DELETE",
            message = $"Menghapus dashboard {scope} tahun {target.Year}: {target.TableName}.",
            fields = new object[]
            {
                new
                {
                    field = nameof(PlanningDashboardTable.TableName),
                    label = "Nama Dashboard",
                    before = target.TableName
                },
                new
                {
                    field = nameof(PlanningDashboardTable.Year),
                    label = "Tahun",
                    before = target.Year.ToString()
                },
                new
                {
                    field = nameof(PlanningDashboardTable.Scope),
                    label = "Scope",
                    before = scope
                },
                new
                {
                    field = "NextActiveTable",
                    label = "Dashboard Aktif Berikutnya",
                    after = nextActive.TableName
                }
            }
        });
    }
}
