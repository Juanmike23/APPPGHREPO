/*
 * PGH-DOC
 * File: Controllers/ChangeLogController.cs
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
using PGH.Dtos.ChangeLog;
using PGH.Helpers;
using PGH.Models.ChangeLog;
using WebApplication2.Data;
using Microsoft.EntityFrameworkCore;
using PGH.Models.User;

[ApiController]
[Route("api/[controller]")]
public class ChangeLogController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IMapper _mapper;

    public ChangeLogController(AppDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<IActionResult> GetAccessibleLogs([FromQuery] ChangeLogListQueryDto? queryDto)
    {
        var limit = ChangeLogQueryHelper.NormalizeListLimit(queryDto?.Limit);
        var offset = ChangeLogQueryHelper.NormalizeListOffset(queryDto?.Offset);

        var query = ChangeLogQueryHelper.BuildAccessibleQuery(_context.ChangeLog, User);

        var totalCount = await query.CountAsync();
        var logs = await query
            .OrderByDescending(x => x.Timestamp)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        AppendListMetadataHeaders(totalCount, logs.Count, limit, offset, "role");
        return Ok(await BuildReadDtosAsync(logs));
    }

    [HttpPost]
    public async Task<IActionResult> LogChange([FromBody] ChangeLogDto dto)
    {
        if (dto == null)
            return BadRequest("Invalid payload");

        var accessResult = EnsureTableAccess(dto.TableName, dto.ScopeTableName);
        if (accessResult != null)
        {
            return accessResult;
        }

        var log = _mapper.Map<ChangeLog>(dto);
        var currentUserId = FeatureAccessResolver.GetUserId(User);

        log.ChangedBy = string.IsNullOrWhiteSpace(currentUserId) ? dto.ChangedBy : currentUserId;
        log.ChangeSummary = string.IsNullOrWhiteSpace(dto.ChangeSummary)
            ? ChangeLogSummaryHelper.BuildDefaultSummary(log.ChangeType)
            : dto.ChangeSummary;
        log.Timestamp = DateTime.UtcNow;

        await _context.ChangeLog.AddAsync(log);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Change logged successfully", time = log.Timestamp });
    }


    [HttpGet("{tableName}")]
    public async Task<IActionResult> GetLogs(string tableName, [FromQuery] ChangeLogListQueryDto? queryDto)
    {
        var accessResult = EnsureTableAccess(tableName, queryDto?.ScopeTableName);
        if (accessResult != null)
        {
            return accessResult;
        }

        var limit = ChangeLogQueryHelper.NormalizeListLimit(queryDto?.Limit);
        var offset = ChangeLogQueryHelper.NormalizeListOffset(queryDto?.Offset);
        var requestedTables = ChangeLogQueryHelper.ResolveRequestedTables(tableName);

        var query = ChangeLogQueryHelper.ApplyScopeFilter(
            ChangeLogQueryHelper.BuildAccessibleQuery(_context.ChangeLog, User)
                .Where(x => requestedTables.Contains(x.TableName)),
            queryDto);

        var totalCount = await query.CountAsync();
        var logs = await query
            .OrderByDescending(x => x.Timestamp)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        AppendListMetadataHeaders(
            totalCount,
            logs.Count,
            limit,
            offset,
            ChangeLogQueryHelper.HasScopeFilter(queryDto) ? "table-selection" : "table");
        return Ok(await BuildReadDtosAsync(logs));
    }

    // GET: api/ChangeLog/{tableName}/{entityId}
    [HttpGet("{tableName}/{entityId}")]
    public async Task<IActionResult> GetLogsByEntity(string tableName, long entityId, [FromQuery] ChangeLogListQueryDto? queryDto)
    {
        var accessResult = EnsureTableAccess(tableName, queryDto?.ScopeTableName);
        if (accessResult != null)
        {
            return accessResult;
        }

        var limit = ChangeLogQueryHelper.NormalizeListLimit(queryDto?.Limit);
        var offset = ChangeLogQueryHelper.NormalizeListOffset(queryDto?.Offset);

        var requestedTables = ChangeLogQueryHelper.ResolveRequestedTables(tableName);
        var query = ChangeLogQueryHelper.ApplyScopeFilter(
            ChangeLogQueryHelper.BuildAccessibleQuery(_context.ChangeLog, User)
                .Where(x => requestedTables.Contains(x.TableName) && x.EntityId == entityId),
            queryDto);

        var totalCount = await query.CountAsync();
        var logs = await query
            .OrderByDescending(x => x.Timestamp)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        AppendListMetadataHeaders(totalCount, logs.Count, limit, offset, "entity");
        return Ok(await BuildReadDtosAsync(logs));

    }

        [HttpGet("last-updated/{tableName}")]
    public async Task<IActionResult> GetLastUpdated(string tableName, [FromQuery] ChangeLogListQueryDto? queryDto)
    {
        if (string.IsNullOrWhiteSpace(tableName))
            return BadRequest("Table name is required");

        var accessResult = EnsureTableAccess(tableName, queryDto?.ScopeTableName);
        if (accessResult != null)
        {
            return accessResult;
        }

        var requestedTables = ChangeLogQueryHelper.ResolveRequestedTables(tableName);

        var lastLog = await ChangeLogQueryHelper.ApplyScopeFilter(
                ChangeLogQueryHelper.BuildAccessibleQuery(_context.ChangeLog, User)
                    .Where(x => requestedTables.Contains(x.TableName)),
                queryDto)
            .OrderByDescending(x => x.Timestamp)
            .Select(x => x.Timestamp)
            .FirstOrDefaultAsync();

        if (lastLog == default)
            return Ok(new
            {
                tableName,
                lastUpdated = (DateTime?)null,
                formatted = (string?)null
            });

        return Ok(new
        {
            tableName,
            lastUpdated = lastLog,
            formatted = lastLog.ToString("yyyy-MM-dd HH:mm:ss")
        });
    }


    //for Role OFFICER
    // GET: api/ChangeLog/user/{userId}/post
    [HttpGet("user/{userId}/post")]
    public async Task<IActionResult> GetUserPostLogs(string userId, [FromQuery] ChangeLogListQueryDto? queryDto)
    {
        var currentUserId = FeatureAccessResolver.GetUserId(User);
        if (!FeatureAccessResolver.IsAdmin(User) &&
            !FeatureAccessResolver.IsExecutive(User) &&
            !string.Equals(currentUserId, userId, StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { message = "You can only view your own change logs." });
        }

        var limit = ChangeLogQueryHelper.NormalizeListLimit(queryDto?.Limit);
        var offset = ChangeLogQueryHelper.NormalizeListOffset(queryDto?.Offset);

        var userStream = FeatureAccessResolver.GetUserStream(User);
        var allowedTables = FeatureAccessResolver.GetTablesForStream(userStream);

        var query = ChangeLogQueryHelper.BuildAccessibleQuery(_context.ChangeLog, User)
            .Where(x =>
                x.ChangedBy == userId &&
                x.ChangeType == "POST" &&
                allowedTables.Contains(x.TableName));

        var totalCount = await query.CountAsync();
        var logs = await query
            .OrderByDescending(x => x.Timestamp)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        AppendListMetadataHeaders(totalCount, logs.Count, limit, offset, "user-post");
        return Ok(await BuildReadDtosAsync(logs));
    }

    private async Task<List<ChangeLogReadDto>> BuildReadDtosAsync(List<ChangeLog> logs)
    {
        if (logs.Count == 0)
        {
            return new List<ChangeLogReadDto>();
        }

        var parsedUserIds = logs
            .Select(x => x.ChangedBy)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(value => Guid.TryParse(value, out var userId) ? userId : (Guid?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .ToList();

        var userLookup = parsedUserIds.Count == 0
            ? new Dictionary<string, User>()
            : await _context.Users
                .AsNoTracking()
                .Where(user => parsedUserIds.Contains(user.Id))
                .ToDictionaryAsync(
                    user => user.Id.ToString(),
                    user => user);

        return logs.Select(log =>
        {
            userLookup.TryGetValue(log.ChangedBy ?? string.Empty, out var matchedUser);
            var parsedSummary = ChangeLogSummaryHelper.ParseSummary(log.ChangeSummary, log.ChangeType);

            return new ChangeLogReadDto
            {
                Id = log.Id,
                TableName = log.TableName,
                EntityId = log.EntityId,
                ScopeTableName = log.ScopeTableName,
                ScopeEntityId = log.ScopeEntityId,
                ChangedBy = log.ChangedBy,
                ChangedByDisplay = matchedUser?.Name ?? log.ChangedBy,
                ChangedByLevel = matchedUser?.Level,
                ChangeType = log.ChangeType,
                ChangeSummary = log.ChangeSummary,
                ChangeSummaryDisplay = parsedSummary.Display,
                ChangeDetails = parsedSummary.Details,
                Timestamp = log.Timestamp,
                IPAddress = log.IPAddress
            };
        }).ToList();
    }

    private IActionResult? EnsureTableAccess(string? tableName, string? scopeTableName = null)
    {
        if (!ChangeLogQueryHelper.CanAccessTables(User, tableName, scopeTableName))
        {
            return StatusCode(403, new { message = ChangeLogQueryHelper.TableAccessDeniedMessage });
        }

        return null;
    }

    private void AppendListMetadataHeaders(int totalCount, int returnedCount, int limit, int offset, string scope)
    {
        Response.Headers["X-Total-Count"] = totalCount.ToString();
        Response.Headers["X-Returned-Count"] = returnedCount.ToString();
        Response.Headers["X-Result-Limit"] = limit.ToString();
        Response.Headers["X-Result-Offset"] = offset.ToString();
        Response.Headers["X-Has-More"] = (offset + returnedCount < totalCount).ToString().ToLowerInvariant();
        Response.Headers["X-Log-Scope"] = scope;
    }

}
