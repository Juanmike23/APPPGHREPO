/*
 * PGH-DOC
 * File: Controllers/👥HumanController/Resource/FTEController.cs
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
using PGH.Dtos.Human;
using PGH.Helpers;
using PGH.Models.Human;
using WebApplication2.Data;



namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FTEController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public FTEController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
        {

            _mapper = mapper;
            _db = db;
            _env = env;

        }

        private IQueryable<FTE> BuildOrderedQuery()
        {
            return _db.FTE
                .AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<FTEReadDto>>> GetAll()
        {
            var list = await BuildOrderedQuery().ToListAsync();
            var dtoList = _mapper.Map<List<FTEReadDto>>(list);

            return Ok(dtoList);
        }

        [HttpPost("query")]
        public async Task<IActionResult> Query(
            [FromBody] HumanResourceQueryRequest? request,
            CancellationToken cancellationToken = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async ct =>
                {
                    var result = await HumanResourceQueryHelper.ExecuteAsync(
                        BuildOrderedQuery(),
                        request,
                        HumanResourceQueryHelper.FteSchema,
                        ct);

                    return Ok(result);
                },
                "Human resource request was canceled.",
                cancellationToken);
        }

        [HttpPost("export")]
        public async Task<IActionResult> Export(
            [FromBody] HumanResourceExportRequest? request,
            CancellationToken cancellationToken = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                ct => HumanResourceExportHelper.BuildExportResponseAsync(
                    this,
                    BuildOrderedQuery(),
                    request,
                    HumanResourceQueryHelper.FteSchema,
                    "FTE",
                    ct),
                "Human resource request was canceled.",
                cancellationToken);
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchFTE(long id, [FromBody] Dictionary<string, object> changes)
        {
            var fte = await _db.FTE.FindAsync(id);
            if (fte == null)
                return NotFound($"FTE with id {id} not found.");

            var invalidFields = HumanResourcePatchHelper.ApplyPatch(fte, changes);

            if (invalidFields.Count > 0)
            {
                return BadRequest(new
                {
                    Message = HumanResourcePatchHelper.InvalidFieldsMessage,
                    InvalidFields = invalidFields
                });
            }

            await _db.SaveChangesAsync();

            return Ok(new { Message = "Updated successfully", fte });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] FTE fte)
        {
            _db.FTE.Add(fte);
            await _db.SaveChangesAsync();
            return Ok(fte);
        }



        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No Ids provided.");

            var rows = await _db.FTE.Where(a => ids.Contains(a.Id)).ToListAsync();
            if (!rows.Any())
                return NotFound("No matching rows found.");

            _db.FTE.RemoveRange(rows);
            await _db.SaveChangesAsync();

            return Ok(new { DeletedCount = rows.Count });
        }
    }
}




