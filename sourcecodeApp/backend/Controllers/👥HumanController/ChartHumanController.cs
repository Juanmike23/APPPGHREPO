/*
 * PGH-DOC
 *
 * File: Controllers/👥HumanController/ChartHumanController.cs
 *
 * Apa fungsi bagian ini:
 *
 * - File ini menangani endpoint API dan alur request/response fitur.
 *
 * Kenapa perlu:
 *
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 *
 * Aturan khususnya apa:
 *
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 *
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 *
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PGH.Helpers;
using PGH.Models.Human;
using WebApplication2.Data;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChartHumanController : ControllerBase
    {
        private static readonly MemoryCacheEntryOptions HumanDashboardCacheOptions = new()
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(45)
        };

        private readonly AppDbContext _db;
        private readonly IMemoryCache _memoryCache;

        public ChartHumanController(AppDbContext db, IMemoryCache memoryCache)
        {
            _db = db;
            _memoryCache = memoryCache;
        }

        [HttpGet("overview/{department?}")]
        public async Task<IActionResult> GetFteNonFteOverview(
            string? department,
            CancellationToken cancellationToken = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async ct =>
                {
                    var snapshot = await GetOverviewSnapshotAsync(
                        department,
                        ct);

                    return Ok(snapshot);
                },
                "Human dashboard request was canceled.",
                cancellationToken);
        }

        [HttpGet("dashboard/{department?}")]
        public async Task<IActionResult> GetDashboardSnapshot(
            string? department,
            CancellationToken cancellationToken = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async ct =>
                {
                    var snapshot = await GetDashboardSnapshotAsync(
                        department,
                        ct);

                    return Ok(snapshot);
                },
                "Human dashboard request was canceled.",
                cancellationToken);
        }

        private Task<HumanOverviewSnapshot> GetOverviewSnapshotAsync(string? departmentFilter, CancellationToken cancellationToken)
        {
            var cacheKey = HumanDashboardHelper.BuildCacheKey(
                "overview",
                HumanDepartmentCanonicalHelper.NormalizeComparisonBucket(departmentFilter));

            return _memoryCache.GetOrCreateAsync(cacheKey, async entry =>
            {
                entry.SetOptions(HumanDashboardCacheOptions);

                var filter = !string.IsNullOrWhiteSpace(departmentFilter);
                var fteQuery = _db.FTE.AsNoTracking().AsQueryable();
                var nonFteQuery = _db.NonFTE.AsNoTracking().AsQueryable();
                var kebutuhanQuery = _db.KebutuhanFTE.AsNoTracking().AsQueryable();

                if (filter)
                {
                    fteQuery = HumanDashboardHelper.ApplyDepartmentFilter(fteQuery, departmentFilter, x => x.Department);
                    nonFteQuery = HumanDashboardHelper.ApplyDepartmentFilter(nonFteQuery, departmentFilter, x => x.Department);
                    kebutuhanQuery = HumanDashboardHelper.ApplyDepartmentFilter(kebutuhanQuery, departmentFilter, x => x.Department);
                }

                var fteCount = await fteQuery.CountAsync(cancellationToken);
                var nonFteCount = await nonFteQuery.CountAsync(cancellationToken);
                var totalGap = await kebutuhanQuery.SumAsync(x => x.Gap ?? 0, cancellationToken);

                return new HumanOverviewSnapshot
                {
                    Department = HumanDepartmentCanonicalHelper.NormalizeDisplayValue(departmentFilter) ?? "ALL",
                    FTE = fteCount,
                    NonFTE = nonFteCount,
                    TotalEmployees = fteCount + nonFteCount,
                    TotalGap = totalGap
                };
            })!;
        }

        private Task<HumanDashboardSnapshot> GetDashboardSnapshotAsync(string? departmentFilter, CancellationToken cancellationToken)
        {
            var cacheKey = HumanDashboardHelper.BuildCacheKey(
                "dashboard",
                HumanDepartmentCanonicalHelper.NormalizeComparisonBucket(departmentFilter));

            return _memoryCache.GetOrCreateAsync(cacheKey, async entry =>
            {
                entry.SetOptions(HumanDashboardCacheOptions);

                var filter = !string.IsNullOrWhiteSpace(departmentFilter);
                var fteQuery = _db.FTE.AsNoTracking().AsQueryable();
                var nonFteQuery = _db.NonFTE.AsNoTracking().AsQueryable();
                var kebutuhanQuery = _db.KebutuhanFTE.AsNoTracking().AsQueryable();

                if (filter)
                {
                    fteQuery = HumanDashboardHelper.ApplyDepartmentFilter(fteQuery, departmentFilter, x => x.Department);
                    nonFteQuery = HumanDashboardHelper.ApplyDepartmentFilter(nonFteQuery, departmentFilter, x => x.Department);
                    kebutuhanQuery = HumanDashboardHelper.ApplyDepartmentFilter(kebutuhanQuery, departmentFilter, x => x.Department);
                }

                var overview = await GetOverviewSnapshotAsync(departmentFilter, cancellationToken);

                var fteChartRows = await fteQuery
                    .Where(x => x.Department != null && x.Department.Trim() != string.Empty)
                    .GroupBy(x => x.Department!.Trim())
                    .Select(group => new HumanDepartmentMetricProjection
                    {
                        Department = group.Key,
                        Value = group.Count()
                    })
                    .ToListAsync(cancellationToken);

                var nonFteChartRows = await nonFteQuery
                    .Where(x => x.Department != null && x.Department.Trim() != string.Empty)
                    .GroupBy(x => x.Department!.Trim())
                    .Select(group => new HumanDepartmentMetricProjection
                    {
                        Department = group.Key,
                        Value = group.Count()
                    })
                    .ToListAsync(cancellationToken);

                var gapChartRows = await kebutuhanQuery
                    .Where(x => x.Department != null && x.Department.Trim() != string.Empty)
                    .GroupBy(x => x.Department!.Trim())
                    .Select(group => new HumanDepartmentMetricProjection
                    {
                        Department = group.Key,
                        Value = group.Sum(item => item.Gap ?? 0)
                    })
                    .ToListAsync(cancellationToken);

                var fteByDepartment = HumanDashboardHelper.NormalizeDepartmentMetrics(fteChartRows);
                var nonFteByDepartment = HumanDashboardHelper.NormalizeDepartmentMetrics(nonFteChartRows);
                var gapByDepartment = HumanDashboardHelper.NormalizeDepartmentMetrics(gapChartRows);
                var totalByDepartment = HumanDashboardHelper.MergeDepartmentMetrics(fteByDepartment, nonFteByDepartment);

                return new HumanDashboardSnapshot
                {
                    Overview = overview,
                    TotalEmployeeChart = HumanDashboardHelper.BuildDepartmentChartPayload(totalByDepartment, "Total Employees (FTE + NonFTE)"),
                    FteChart = HumanDashboardHelper.BuildDepartmentChartPayload(fteByDepartment, "FTE Employees per Department"),
                    NonFteChart = HumanDashboardHelper.BuildDepartmentChartPayload(nonFteByDepartment, "Non-FTE Employees per Department"),
                    GapChart = HumanDashboardHelper.BuildDepartmentChartPayload(gapByDepartment, "Kebutuhan FTE Gap per Department")
                };
            })!;
        }
    }
}
