/*
 * PGH-DOC
 * File: Controllers/👥HumanController/Resource/NonFTEController.cs
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
    public class NonFTEController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public NonFTEController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
        {

            _mapper = mapper;
            _db = db;
            _env = env;

        }

        private IQueryable<NonFTE> BuildOrderedQuery()
        {
            return _db.NonFTE
                .AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<NonFTEReadDto>>> GetAll()
        {
            var list = await BuildOrderedQuery().ToListAsync();
            var dtoList = _mapper.Map<List<NonFTEReadDto>>(list);

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
                        HumanResourceQueryHelper.NonFteSchema,
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
                    HumanResourceQueryHelper.NonFteSchema,
                    "NonFTE",
                    ct),
                "Human resource request was canceled.",
                cancellationToken);
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchNonFTE(long id, [FromBody] Dictionary<string, object> changes)
        {
            var nonfte = await _db.NonFTE.FindAsync(id);
            if (nonfte == null)
                return NotFound($"NonFTE with id {id} not found.");

            var invalidFields = HumanResourcePatchHelper.ApplyPatch(nonfte, changes);

            if (invalidFields.Count > 0)
            {
                return BadRequest(new
                {
                    Message = HumanResourcePatchHelper.InvalidFieldsMessage,
                    InvalidFields = invalidFields
                });
            }

            await _db.SaveChangesAsync();

            return Ok(new { Message = "Updated successfully", nonfte });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] NonFTE nonfte)
        {
            _db.NonFTE.Add(nonfte);
            await _db.SaveChangesAsync();
            return Ok(nonfte);
        }



        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No Ids provided.");

            var rows = await _db.NonFTE.Where(a => ids.Contains(a.Id)).ToListAsync();
            if (!rows.Any())
                return NotFound("No matching rows found.");

            _db.NonFTE.RemoveRange(rows);
            await _db.SaveChangesAsync();

            return Ok(new { DeletedCount = rows.Count });
        }
    }
}




