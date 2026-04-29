/*
 * PGH-DOC
 * File: Helpers/HumanDashboardHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan model dan utilitas agregasi dashboard Human.
 * Kenapa perlu:
 * - Perlu agar cache key, filter department, dan payload chart Human konsisten lintas endpoint dashboard.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System.Linq.Expressions;

namespace PGH.Helpers;

public sealed class HumanDepartmentMetricProjection
{
    public string? Department { get; init; }
    public int Value { get; init; }
}

public sealed class HumanOverviewSnapshot
{
    public string Department { get; init; } = "ALL";
    public int FTE { get; init; }
    public int NonFTE { get; init; }
    public int TotalEmployees { get; init; }
    public decimal TotalGap { get; init; }
}

public sealed class HumanChartSnapshot
{
    public string[] Labels { get; init; } = Array.Empty<string>();
    public int[] Values { get; init; } = Array.Empty<int>();
    public string Title { get; init; } = string.Empty;
}

public sealed class HumanDepartmentMetricAggregate
{
    public string Label { get; init; } = string.Empty;
    public int Value { get; set; }
}

public sealed class HumanDashboardSnapshot
{
    public HumanOverviewSnapshot Overview { get; init; } = new();
    public HumanChartSnapshot TotalEmployeeChart { get; init; } = new();
    public HumanChartSnapshot FteChart { get; init; } = new();
    public HumanChartSnapshot NonFteChart { get; init; } = new();
    public HumanChartSnapshot GapChart { get; init; } = new();
}

public static class HumanDashboardHelper
{
    public static string BuildCacheKey(string scope, string? departmentKey) =>
        $"human:{scope}:{departmentKey ?? "ALL"}";

    public static Dictionary<string, HumanDepartmentMetricAggregate> NormalizeDepartmentMetrics(
        IEnumerable<HumanDepartmentMetricProjection> rows)
    {
        var result = new Dictionary<string, HumanDepartmentMetricAggregate>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            var displayLabel = HumanDepartmentCanonicalHelper.NormalizeDisplayValue(row.Department);
            var comparisonKey = HumanDepartmentCanonicalHelper.NormalizeComparableValue(displayLabel);
            if (string.IsNullOrWhiteSpace(displayLabel) || string.IsNullOrWhiteSpace(comparisonKey))
            {
                continue;
            }

            if (!result.TryGetValue(comparisonKey, out var aggregate))
            {
                aggregate = new HumanDepartmentMetricAggregate
                {
                    Label = displayLabel,
                    Value = 0
                };
                result[comparisonKey] = aggregate;
            }

            aggregate.Value += row.Value;
        }

        return result;
    }

    public static Dictionary<string, HumanDepartmentMetricAggregate> MergeDepartmentMetrics(
        params IReadOnlyDictionary<string, HumanDepartmentMetricAggregate>[] metrics)
    {
        var result = new Dictionary<string, HumanDepartmentMetricAggregate>(StringComparer.OrdinalIgnoreCase);

        foreach (var metric in metrics)
        {
            foreach (var entry in metric)
            {
                if (!result.TryGetValue(entry.Key, out var aggregate))
                {
                    aggregate = new HumanDepartmentMetricAggregate
                    {
                        Label = entry.Value.Label,
                        Value = 0
                    };
                    result[entry.Key] = aggregate;
                }

                aggregate.Value += entry.Value.Value;
            }
        }

        return result;
    }

    public static HumanChartSnapshot BuildDepartmentChartPayload(
        IReadOnlyDictionary<string, HumanDepartmentMetricAggregate> metrics,
        string title)
    {
        var ordered = metrics.Values
            .Where(entry => entry.Value > 0)
            .OrderByDescending(entry => entry.Value)
            .ThenBy(entry => entry.Label, StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();

        return new HumanChartSnapshot
        {
            Labels = ordered.Select(entry => entry.Label).ToArray(),
            Values = ordered.Select(entry => entry.Value).ToArray(),
            Title = title
        };
    }

    public static IQueryable<TEntity> ApplyDepartmentFilter<TEntity>(
        IQueryable<TEntity> query,
        string? departmentFilter,
        Expression<Func<TEntity, string?>> selector)
        where TEntity : class
    {
        var comparisonBucket = HumanDepartmentCanonicalHelper.NormalizeComparisonBucket(departmentFilter);
        if (string.IsNullOrWhiteSpace(comparisonBucket))
        {
            return query;
        }

        var parameter = selector.Parameters[0];
        var property = selector.Body;
        var propertyNotNull = Expression.NotEqual(property, Expression.Constant(null, typeof(string)));
        var toUpperMethod = typeof(string).GetMethod(nameof(string.ToUpper), Type.EmptyTypes)!;
        var containsMethod = typeof(string).GetMethod(nameof(string.Contains), new[] { typeof(string) })!;
        var upperProperty = Expression.Call(property, toUpperMethod);

        Expression filterBody;
        if (HumanDepartmentCanonicalHelper.IsAllowedDepartmentCode(comparisonBucket))
        {
            var patterns = HumanDepartmentCanonicalHelper.GetAliasPatternsForCode(comparisonBucket);
            Expression? patternBody = null;

            foreach (var pattern in patterns)
            {
                var containsPattern = Expression.Call(
                    upperProperty,
                    containsMethod,
                    Expression.Constant(pattern));

                patternBody = patternBody == null
                    ? containsPattern
                    : Expression.OrElse(patternBody, containsPattern);
            }

            filterBody = patternBody ?? Expression.Constant(false);
        }
        else
        {
            filterBody = Expression.Equal(
                upperProperty,
                Expression.Constant(comparisonBucket));
        }

        var predicate = Expression.Lambda<Func<TEntity, bool>>(
            Expression.AndAlso(propertyNotNull, filterBody),
            parameter);

        return query.Where(predicate);
    }
}
