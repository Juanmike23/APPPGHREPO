/*
 * PGH-DOC
 * File: Controllers/ColumnOrderController.cs
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
using PGH.Dtos.Preference;
using PGH.Helpers;
using WebApplication2.Data;

using Microsoft.EntityFrameworkCore;
[ApiController]
[Route("api/[controller]")]
public class ColumnOrderController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IMapper _mapper;

    public ColumnOrderController(AppDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    // --------------------------------------------------
    // GET: api/columnorder?tableName=listaudit&viewKey=default
    // --------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> GetColumnOrder(
        [FromQuery] string tableName,
        [FromQuery] string viewKey = "default"
    )
    {
        if (string.IsNullOrWhiteSpace(tableName))
            return BadRequest("tableName is required");

        var targetStream = FeatureAccessResolver.ResolveStreamForTable(tableName);
        if (!FeatureAccessResolver.CanAccessRequestedStream(User, targetStream))
        {
            return StatusCode(403, new { message = "Table access is not allowed for this stream." });
        }

        var entities = await _context.ColumnOrders
            .Where(x => x.TableName == tableName && x.ViewKey == viewKey)
            .OrderBy(x => x.ColumnIndex)
            .ToListAsync();

        var result = _mapper.Map<List<ColumnOrderReadDto>>(entities);

        // frontend expects array of column keys
        return Ok(result.Select(x => x.ColumnKey));
    }

    // --------------------------------------------------
    // POST: api/columnorder/update
    // --------------------------------------------------
    [HttpPost("update")]
    public async Task<IActionResult> UpdateColumnOrder(
        [FromBody] List<ColumnOrderUpdateDto> payload
    )
    {
        if (payload == null || payload.Count == 0)
            return BadRequest("Payload is empty");

        var tableName = payload.First().TableName;
        var targetStream = FeatureAccessResolver.ResolveStreamForTable(tableName);
        if (!FeatureAccessResolver.CanAccessRequestedStream(User, targetStream))
        {
            return StatusCode(403, new { message = "Table access is not allowed for this stream." });
        }

        var viewKey = payload.First().ViewKey ?? "default";

        var existing = await _context.ColumnOrders
            .Where(x => x.TableName == tableName && x.ViewKey == viewKey)
            .ToListAsync();

        _context.ColumnOrders.RemoveRange(existing);

        var entities = _mapper.Map<List<ColumnOrder>>(payload);

        foreach (var e in entities)
            e.UpdatedAt = DateTime.UtcNow;

        await _context.ColumnOrders.AddRangeAsync(entities);
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }
}
