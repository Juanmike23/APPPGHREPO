/*
 * PGH-DOC
 * File: Controllers/📅PlanningController/PlanningDashboardTableController.cs
 * Apa fungsi bagian ini:
 * - File ini menangani endpoint API dan alur request/response fitur.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PGH.Dtos.Planing.Realization;
using PGH.Helpers;
using PGH.Models.ChangeLog;
using PGH.Models.Planing.Realization;
using WebApplication2.Data;

namespace PGH.Controllers.Planing.BusinessPlan
{
    [ApiController]
    [Route("api/[controller]")]
    public class PlanningDashboardTableController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IMapper _mapper;
        private readonly ILogger<PlanningDashboardTableController> _logger;

        public PlanningDashboardTableController(
            AppDbContext db,
            IMapper mapper,
            ILogger<PlanningDashboardTableController> logger)
        {
            _db = db;
            _mapper = mapper;
            _logger = logger;
        }

        [HttpGet("tables")]
        public async Task<ActionResult<IEnumerable<PlanningDashboardTableReadDto>>> GetTables(
            [FromQuery] string? scope = null,
            CancellationToken cancellationToken = default)
        {
            if (!PlanningDashboardTableHelper.TryNormalizeScope(scope, out var normalizedScope, out var scopeError))
            {
                return BadRequest(scopeError);
            }

            await NormalizeScopeTableNamesAsync(normalizedScope, cancellationToken);
            await EnsureDefaultTableAsync(normalizedScope, cancellationToken);

            var rows = await PlanningDashboardTableHelper.ApplyScopeFilter(
                    _db.PlanningDashboardTables.AsNoTracking(),
                    normalizedScope)
                .OrderByDescending(item => item.Year)
                .ThenByDescending(item => item.CreatedAt)
                .ThenByDescending(item => item.Id)
                .ToListAsync(cancellationToken);

            return Ok(_mapper.Map<List<PlanningDashboardTableReadDto>>(rows));
        }

        [HttpGet("active-table")]
        public async Task<ActionResult<PlanningDashboardTableReadDto>> GetActiveTable(
            [FromQuery] string? scope = null,
            CancellationToken cancellationToken = default)
        {
            if (!PlanningDashboardTableHelper.TryNormalizeScope(scope, out var normalizedScope, out var scopeError))
            {
                return BadRequest(scopeError);
            }

            await NormalizeScopeTableNamesAsync(normalizedScope, cancellationToken);
            var active = await EnsureDefaultTableAsync(normalizedScope, cancellationToken);
            return Ok(_mapper.Map<PlanningDashboardTableReadDto>(active));
        }

        [HttpPost("tables")]
        public async Task<ActionResult<PlanningDashboardTableReadDto>> CreateTable(
            [FromBody] PlanningDashboardTableCreateDto? request,
            [FromQuery] string? scope = null,
            CancellationToken cancellationToken = default)
        {
            if (!PlanningDashboardTableHelper.TryNormalizeScope(request?.Scope ?? scope, out var normalizedScope, out var scopeError))
            {
                return BadRequest(scopeError);
            }

            await NormalizeScopeTableNamesAsync(normalizedScope, cancellationToken);
            var scopedTables = PlanningDashboardTableHelper.ApplyScopeFilter(
                _db.PlanningDashboardTables.AsNoTracking(),
                normalizedScope);

            var latestExistingYear = (await scopedTables
                .Select(item => (int?)item.Year)
                .MaxAsync(cancellationToken)) ?? (DateTime.UtcNow.Year - 1);
            var hasAnyTable = await scopedTables.AnyAsync(cancellationToken);

            if (latestExistingYear < 1900 || latestExistingYear > 2098)
            {
                return BadRequest($"Tahun terbaru untuk scope {normalizedScope} tidak valid untuk auto-generate.");
            }

            var year = latestExistingYear + 1;

            var duplicateYear = await PlanningDashboardTableHelper.ApplyScopeFilter(
                    _db.PlanningDashboardTables,
                    normalizedScope)
                .AnyAsync(item =>
                    item.Year == year,
                    cancellationToken);
            if (duplicateYear)
            {
                return Conflict($"Table {normalizedScope} untuk tahun {year} sudah ada. Gunakan tahun lain.");
            }

            var tableName = await GenerateNextTableNameAsync(
                normalizedScope,
                year,
                cancellationToken);

            var now = DateTime.UtcNow;
            var row = new PlanningDashboardTable
            {
                Scope = normalizedScope,
                TableName = tableName,
                Year = year,
                IsDefault = !hasAnyTable,
                CreatedAt = now,
                UpdatedAt = now,
            };

            _db.PlanningDashboardTables.Add(row);
            try
            {
                await SqlServerRetryHelper.SaveChangesWithTransientRetryAsync(
                    _db,
                    _logger,
                    "PlanningDashboardTable save",
                    cancellationToken);
            }
            catch (DbUpdateException ex) when (SqlServerRetryHelper.IsUniqueConstraintViolation(ex))
            {
                var existing = await PlanningDashboardTableHelper.ApplyScopeFilter(
                        _db.PlanningDashboardTables.AsNoTracking(),
                        normalizedScope)
                    .OrderByDescending(item => item.Year)
                    .ThenByDescending(item => item.CreatedAt)
                    .ThenByDescending(item => item.Id)
                    .FirstOrDefaultAsync(item => item.Year == year, cancellationToken);

                if (existing != null)
                {
                    return Conflict($"Table {normalizedScope} untuk tahun {year} sudah ada. Gunakan tahun lain.");
                }

                throw;
            }

            return Ok(_mapper.Map<PlanningDashboardTableReadDto>(row));
        }

        [HttpPatch("tables/{id:long}")]
        public async Task<ActionResult<PlanningDashboardTableReadDto>> RenameTable(
            long id,
            [FromBody] PlanningDashboardTableUpdateDto? request,
            [FromQuery] string? scope = null,
            CancellationToken cancellationToken = default)
        {
            var tableName = request?.TableName?.Trim();
            if (string.IsNullOrWhiteSpace(tableName))
            {
                return BadRequest("TableName is required.");
            }

            if (!PlanningDashboardTableHelper.TryNormalizeScope(scope, out var normalizedScope, out var scopeError))
            {
                return BadRequest(scopeError);
            }

            var row = await PlanningDashboardTableHelper.ApplyScopeFilter(
                    _db.PlanningDashboardTables,
                    normalizedScope)
                .FirstOrDefaultAsync(item =>
                    item.Id == id,
                    cancellationToken);
            if (row == null)
            {
                return NotFound("Planning dashboard table not found.");
            }

            var normalizedName = tableName.ToLowerInvariant();
            var duplicateName = await PlanningDashboardTableHelper.ApplyScopeFilter(
                    _db.PlanningDashboardTables,
                    normalizedScope)
                .AnyAsync(item =>
                    item.Id != id &&
                    item.TableName.ToLower() == normalizedName,
                    cancellationToken);
            if (duplicateName)
            {
                return Conflict($"Table '{tableName}' sudah ada di {normalizedScope}.");
            }

            row.TableName = tableName;
            row.UpdatedAt = DateTime.UtcNow;
            await SqlServerRetryHelper.SaveChangesWithTransientRetryAsync(
                _db,
                _logger,
                "PlanningDashboardTable rename",
                cancellationToken);

            return Ok(_mapper.Map<PlanningDashboardTableReadDto>(row));
        }

        [HttpDelete("tables/{id:long}")]
        public async Task<IActionResult> DeleteTable(
            long id,
            [FromQuery] string? scope = null,
            CancellationToken cancellationToken = default)
        {
            if (!PlanningDashboardTableHelper.TryNormalizeScope(scope, out var normalizedScope, out var scopeError))
            {
                return BadRequest(scopeError);
            }

            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(() =>
                DeleteTableCoreAsync(id, normalizedScope, cancellationToken));
        }

        private async Task<IActionResult> DeleteTableCoreAsync(
            long id,
            string normalizedScope,
            CancellationToken cancellationToken)
        {
            await EnsureDefaultTableAsync(normalizedScope, cancellationToken);

            var rows = await PlanningDashboardTableHelper.ApplyScopeFilter(
                    _db.PlanningDashboardTables,
                    normalizedScope)
                .OrderByDescending(item => item.Year)
                .ThenByDescending(item => item.CreatedAt)
                .ThenByDescending(item => item.Id)
                .ToListAsync(cancellationToken);

            var target = rows.FirstOrDefault(item => item.Id == id);
            if (target == null)
            {
                return NotFound("Planning dashboard table not found.");
            }

            if (rows.Count <= 1)
            {
                return BadRequest($"Minimal satu table dashboard {normalizedScope} harus tersisa.");
            }

            var latestYearInScope = rows.Max(item => item.Year);
            if (target.Year < latestYearInScope)
            {
                return BadRequest(
                    $"Delete harus berurutan dari tahun terbaru. Hapus dulu {normalizedScope} {latestYearInScope} sebelum {normalizedScope} {target.Year}.");
            }

            var now = DateTime.UtcNow;
            PlanningDashboardTable? nextActive = rows
                .Where(item => item.Id != target.Id && item.IsDefault)
                .OrderByDescending(item => item.UpdatedAt)
                .ThenByDescending(item => item.CreatedAt)
                .ThenByDescending(item => item.Id)
                .FirstOrDefault();

            if (nextActive == null)
            {
                nextActive = rows
                    .Where(item => item.Id != target.Id)
                    .OrderByDescending(item => item.Year)
                    .ThenByDescending(item => item.CreatedAt)
                    .ThenByDescending(item => item.Id)
                    .First();
            }

            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            using var suppressAutomaticLogs = _db.SuppressAutomaticLogs();
            try
            {
                if (target.IsDefault)
                {
                    target.IsDefault = false;
                    target.UpdatedAt = now;
                    await SqlServerRetryHelper.SaveChangesWithTransientRetryAsync(
                        _db,
                        _logger,
                        "PlanningDashboardTable delete-prep",
                        cancellationToken);
                }

                var survivors = rows.Where(item => item.Id != target.Id).ToList();
                foreach (var row in survivors)
                {
                    row.IsDefault = row.Id == nextActive.Id;
                    row.UpdatedAt = now;
                }

                WritePlanningDashboardDeleteLog(target, nextActive, normalizedScope, now);
                _db.PlanningDashboardTables.Remove(target);
                await SqlServerRetryHelper.SaveChangesWithTransientRetryAsync(
                    _db,
                    _logger,
                    "PlanningDashboardTable delete",
                    cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }

            return Ok(new
            {
                deletedId = target.Id,
                activeTableId = nextActive.Id,
                scope = normalizedScope
            });
        }

        private void WritePlanningDashboardDeleteLog(
            PlanningDashboardTable target,
            PlanningDashboardTable nextActive,
            string scope,
            DateTime timestamp)
        {
            var summary = PlanningDashboardTableHelper.BuildDeleteSummary(target, nextActive, scope);

            _db.ChangeLog.Add(new ChangeLog
            {
                TableName = "PlanningDashboardTable",
                EntityId = target.Id,
                ChangedBy = FeatureAccessResolver.GetUserId(User),
                ChangeType = "DELETE",
                ChangeSummary = summary,
                Timestamp = timestamp,
                IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
            });
        }

        private async Task<PlanningDashboardTable> EnsureDefaultTableAsync(
            string scope,
            CancellationToken cancellationToken)
        {
            var scopedRows = await PlanningDashboardTableHelper.ApplyScopeFilter(
                    _db.PlanningDashboardTables,
                    scope)
                .OrderByDescending(item => item.Year)
                .ThenByDescending(item => item.CreatedAt)
                .ThenByDescending(item => item.Id)
                .ToListAsync(cancellationToken);

            var preferredDefault = scopedRows.FirstOrDefault();
            if (preferredDefault != null)
            {
                var now = DateTime.UtcNow;
                var changed = false;
                foreach (var row in scopedRows)
                {
                    var shouldBeDefault = row.Id == preferredDefault.Id;
                    if (row.IsDefault != shouldBeDefault)
                    {
                        row.IsDefault = shouldBeDefault;
                        row.UpdatedAt = now;
                        changed = true;
                    }
                }

                if (changed)
                {
                    try
                    {
                        await SqlServerRetryHelper.SaveChangesWithTransientRetryAsync(
                            _db,
                            _logger,
                            "PlanningDashboardTable ensure-default",
                            cancellationToken);
                    }
                    catch (DbUpdateException ex) when (SqlServerRetryHelper.IsUniqueConstraintViolation(ex))
                    {
                        var recovered = await PlanningDashboardTableHelper.ApplyScopeFilter(
                                _db.PlanningDashboardTables,
                                scope)
                            .OrderByDescending(item => item.Year)
                            .ThenByDescending(item => item.CreatedAt)
                            .ThenByDescending(item => item.Id)
                            .FirstOrDefaultAsync(item => item.IsDefault, cancellationToken);

                        if (recovered != null)
                        {
                            return recovered;
                        }

                        throw;
                    }
                }

                return preferredDefault;
            }

            var nowForCreate = DateTime.UtcNow;
            var year = nowForCreate.Year;
            var created = new PlanningDashboardTable
            {
                Scope = scope,
                TableName = PlanningDashboardTableHelper.BuildDefaultTableName(scope, year),
                Year = year,
                IsDefault = true,
                CreatedAt = nowForCreate,
                UpdatedAt = nowForCreate,
            };

            _db.PlanningDashboardTables.Add(created);
            try
            {
                await SqlServerRetryHelper.SaveChangesWithTransientRetryAsync(
                    _db,
                    _logger,
                    "PlanningDashboardTable create-default",
                    cancellationToken);
            }
            catch (DbUpdateException ex) when (SqlServerRetryHelper.IsUniqueConstraintViolation(ex))
            {
                var recovered = await PlanningDashboardTableHelper.ApplyScopeFilter(
                        _db.PlanningDashboardTables,
                        scope)
                    .OrderByDescending(item => item.IsDefault)
                    .ThenByDescending(item => item.Year)
                    .ThenByDescending(item => item.CreatedAt)
                    .ThenByDescending(item => item.Id)
                    .FirstOrDefaultAsync(cancellationToken);

                if (recovered != null)
                {
                    return recovered;
                }

                throw;
            }
            return created;
        }

        private async Task NormalizeScopeTableNamesAsync(
            string scope,
            CancellationToken cancellationToken)
        {
            if (!string.Equals(scope, PlanningDashboardTableHelper.ScopeOpex, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var rows = await PlanningDashboardTableHelper.ApplyScopeFilter(
                    _db.PlanningDashboardTables,
                    scope)
                .OrderBy(item => item.Year)
                .ThenBy(item => item.Id)
                .ToListAsync(cancellationToken);

            if (rows.Count == 0)
            {
                return;
            }

            var now = DateTime.UtcNow;
            var changed = false;
            foreach (var row in rows)
            {
                var normalizedName = PlanningDashboardTableHelper.BuildDefaultTableName(scope, row.Year);
                var currentName = row.TableName?.Trim() ?? string.Empty;
                if (string.Equals(currentName, normalizedName, StringComparison.Ordinal))
                {
                    continue;
                }

                row.TableName = normalizedName;
                row.UpdatedAt = now;
                changed = true;
            }

            if (changed)
            {
                await SqlServerRetryHelper.SaveChangesWithTransientRetryAsync(
                    _db,
                    _logger,
                    "PlanningDashboardTable normalize-scope-names",
                    cancellationToken);
            }
        }

        private async Task<string> GenerateNextTableNameAsync(
            string scope,
            int year,
            CancellationToken cancellationToken)
        {
            var baseName = PlanningDashboardTableHelper.BuildDefaultTableName(scope, year);
            var candidateName = baseName;
            var suffix = 2;

            var candidateNameLower = candidateName.ToLowerInvariant();
            while (await _db.PlanningDashboardTables
                       .AnyAsync(item =>
                               ((scope == PlanningDashboardTableHelper.ScopeOpex &&
                                 (item.Scope == PlanningDashboardTableHelper.ScopeOpex)) ||
                                (scope != PlanningDashboardTableHelper.ScopeOpex && item.Scope == scope)) &&
                               item.TableName.ToLower() == candidateNameLower,
                           cancellationToken))
            {
                candidateName = $"{baseName} ({suffix})";
                candidateNameLower = candidateName.ToLowerInvariant();
                suffix++;
            }

            return candidateName;
        }
    }
}
