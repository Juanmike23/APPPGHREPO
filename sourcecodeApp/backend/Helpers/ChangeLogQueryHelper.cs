/*
 * PGH-DOC
 * File: Helpers/ChangeLogQueryHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika query/access bersama untuk endpoint change log.
 * Kenapa perlu:
 * - Perlu agar aturan akses stream, filtering scope, dan pagination change log tetap konsisten lintas controller.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PGH.Dtos.ChangeLog;
using PGH.Models.ChangeLog;

namespace PGH.Helpers;

public static class ChangeLogQueryHelper
{
    public const int DefaultListLimit = 100;
    public const int MaxListLimit = 200;
    public const string TableAccessDeniedMessage = "Table access is not allowed for this stream.";

    public static IQueryable<ChangeLog> BuildAccessibleQuery(
        IQueryable<ChangeLog> sourceQuery,
        ClaimsPrincipal user)
    {
        var query = sourceQuery.AsNoTracking();

        if (FeatureAccessResolver.HasGlobalStreamAccess(user))
        {
            return query;
        }

        var userStream = FeatureAccessResolver.GetUserStream(user);
        var allowedTables = FeatureAccessResolver
            .GetTablesForStream(userStream)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (allowedTables.Length == 0)
        {
            return query.Where(_ => false);
        }

        return query.Where(x => allowedTables.Contains(x.TableName));
    }

    public static bool HasScopeFilter(ChangeLogListQueryDto? queryDto) =>
        !string.IsNullOrWhiteSpace(queryDto?.ScopeTableName) &&
        queryDto?.ScopeEntityId is > 0;

    public static IQueryable<ChangeLog> ApplyScopeFilter(
        IQueryable<ChangeLog> query,
        ChangeLogListQueryDto? queryDto)
    {
        if (!HasScopeFilter(queryDto))
        {
            return query;
        }

        return query.Where(log =>
            log.ScopeTableName == queryDto!.ScopeTableName &&
            log.ScopeEntityId == queryDto.ScopeEntityId);
    }

    public static string[] ResolveRequestedTables(string tableName)
    {
        var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            tableName
        };

        if (string.Equals(tableName, "AllProcure", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(tableName, "NewProcure", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(tableName, "ExistingProcure", StringComparison.OrdinalIgnoreCase))
        {
            tables.Add("ProcurementItem");
        }

        if (string.Equals(tableName, "ParentChild", StringComparison.OrdinalIgnoreCase))
        {
            tables.Add("ProcurementRelation");
        }

        return tables
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToArray();
    }

    public static bool CanAccessTables(
        ClaimsPrincipal user,
        params string?[] tableNames)
    {
        foreach (var candidate in tableNames
                     .Where(value => !string.IsNullOrWhiteSpace(value))
                     .Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var targetStream = FeatureAccessResolver.ResolveStreamForTable(candidate);
            if (!FeatureAccessResolver.CanAccessRequestedStream(user, targetStream))
            {
                return false;
            }
        }

        return true;
    }

    public static int NormalizeListLimit(int? requestedLimit)
    {
        var value = requestedLimit.GetValueOrDefault(DefaultListLimit);
        if (value <= 0)
        {
            return DefaultListLimit;
        }

        return Math.Min(value, MaxListLimit);
    }

    public static int NormalizeListOffset(int? requestedOffset)
    {
        return Math.Max(requestedOffset.GetValueOrDefault(0), 0);
    }
}
