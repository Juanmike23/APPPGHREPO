/*
 * PGH-DOC
 * File: Controllers/🧾AuditController/CalendarEventsController.cs
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
using Newtonsoft.Json;
using PGH.Dtos.Audit;
using PGH.Models.Audit;
using WebApplication2.Data;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CalendarEventsController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly AppDbContext _db;

        public CalendarEventsController(IMapper mapper, AppDbContext db)
        {
            _mapper = mapper;
            _db = db;
        }

        private static IQueryable<CalendarEvents> ApplyCalendarRangeFilter(
            IQueryable<CalendarEvents> query,
            DateTime? rangeStart,
            DateTime? rangeEnd)
        {
            if (rangeStart.HasValue)
            {
                var startBoundary = rangeStart.Value;
                query = query.Where(x => x.StartDateTime != null && x.StartDateTime >= startBoundary);
            }

            if (rangeEnd.HasValue)
            {
                var endBoundary = rangeEnd.Value;
                query = query.Where(x => x.StartDateTime != null && x.StartDateTime < endBoundary);
            }

            return query;
        }

        // -------------------- GET ALL --------------------
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CalendarEventsReadDto>>> GetAll(
            [FromQuery] DateTime? rangeStart = null,
            [FromQuery] DateTime? rangeEnd = null,
            CancellationToken ct = default)
        {
            var query = ApplyCalendarRangeFilter(
                _db.CalendarEvents.AsNoTracking(),
                rangeStart,
                rangeEnd);

            var events = await query
                .OrderBy(x => x.StartDateTime)
                .ToListAsync(ct);

            var dtoList = _mapper.Map<List<CalendarEventsReadDto>>(events);
            return Ok(dtoList);
        }

        // -------------------- GET BY ID --------------------
        [HttpGet("{id:long}")]
        public async Task<ActionResult<CalendarEventsReadDto>> GetById(long id)
        {
            var entity = await _db.CalendarEvents.FindAsync(id);
            if (entity == null) return NotFound($"Event with ID {id} not found.");
            return Ok(_mapper.Map<CalendarEventsReadDto>(entity));
        }

        // -------------------- CREATE --------------------
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CalendarEvents model)
        {
            if (model == null) return BadRequest("Invalid event data.");

            _db.CalendarEvents.Add(model);
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = model.Id }, model);
        }

        // -------------------- PATCH --------------------
        [HttpPatch("{id:long}")]
        public async Task<IActionResult> Patch(long id, [FromBody] Dictionary<string, object> changes)
        {
            var entity = await _db.CalendarEvents.FindAsync(id);
            if (entity == null)
                return NotFound($"Event with ID {id} not found.");

            try
            {
                foreach (var kvp in changes)
                {
                    var prop = typeof(CalendarEvents).GetProperty(kvp.Key);
                    if (prop == null) continue;

                    object? convertedValue = null;
                    var targetType = Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType;

                    if (kvp.Value == null)
                    {
                        convertedValue = null;
                    }
                    else if (targetType == typeof(DateTime))
                    {
                        // Safely handle date/time strings
                        if (DateTime.TryParse(kvp.Value.ToString(), out var parsedDate))
                            convertedValue = parsedDate;
                        else
                            continue; // skip invalid date
                    }
                    else
                    {
                        try
                        {
                            convertedValue = Convert.ChangeType(kvp.Value, targetType);
                        }
                        catch
                        {
                            Console.WriteLine($"⚠️ Skipped invalid field: {kvp.Key}");
                            continue;
                        }
                    }

                    prop.SetValue(entity, convertedValue);
                }

                await _db.SaveChangesAsync();
                return Ok(new { Message = "Updated successfully", entity });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    Message = "Internal server error while patching event",
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                });
            }
        }


        // -------------------- DELETE SINGLE --------------------
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            try
            {
                var entity = await _db.CalendarEvents.FindAsync(id);
                if (entity == null)
                    return NotFound($"Event with ID {id} not found.");

                _db.CalendarEvents.Remove(entity);
                await _db.SaveChangesAsync();

                return Ok(new { Message = $"Event ID {id} deleted successfully" });
            }
            catch (DbUpdateException dbEx)
            {
                // Common case: foreign key violation (FK constraint)
                return Conflict(new
                {
                    Message = $"Cannot delete Event ID {id} due to related data (foreign key constraint).",
                    Error = dbEx.InnerException?.Message ?? dbEx.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    Message = "Unexpected error deleting event",
                    Error = ex.Message
                });
            }
        }


        // -------------------- BULK DELETE --------------------
        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided.");

            var rows = await _db.CalendarEvents.Where(e => ids.Contains(e.Id)).ToListAsync();
            if (rows.Count == 0)
                return NotFound("No matching rows found.");

            _db.CalendarEvents.RemoveRange(rows);
            await _db.SaveChangesAsync();

            return Ok(new { DeletedCount = rows.Count });
        }




        // -------------------- CALENDAR SUMMARY -------------------- //
        [HttpGet("calendar-audit")]
        public async Task<IActionResult> GetCalendarAudit(
            [FromQuery] DateTime? rangeStart = null,
            [FromQuery] DateTime? rangeEnd = null,
            CancellationToken ct = default)
        {
            var events = await ApplyCalendarRangeFilter(
                    _db.CalendarEvents.AsNoTracking(),
                    rangeStart,
                    rangeEnd)
                .Where(x => x.StartDateTime != null)
                .Select(x => new
                {
                    date = x.StartDateTime!.Value.Date,
                    name = string.IsNullOrWhiteSpace(x.Title) ? "Untitled Event" : x.Title.Trim()
                })
                .ToListAsync(ct);

            var days = events
                .GroupBy(x => x.date)
                .Select(g => new
                {
                    date = g.Key,
                    totalCount = g.Count(),
                    projects = g.GroupBy(x => x.name)
                                .ToDictionary(k => k.Key, v => v.Count())
                })
                .OrderBy(x => x.date)
                .ToList();

            return Ok(new { days });
        }

    }
}
