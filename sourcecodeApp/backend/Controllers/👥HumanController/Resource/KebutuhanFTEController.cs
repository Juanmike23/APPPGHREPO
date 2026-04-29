/*
 * PGH-DOC
 * File: Controllers/👥HumanController/Resource/KebutuhanFTEController.cs
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
    public class KebutuhanFTEController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public KebutuhanFTEController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
        {

            _mapper = mapper;
            _db = db;
            _env = env;

        }

        private IQueryable<KebutuhanFTE> BuildOrderedQuery()
        {
            return _db.KebutuhanFTE
                .AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<KebutuhanFTEReadDto>>> GetAll()
        {
            var list = await BuildOrderedQuery().ToListAsync();
            var dtoList = _mapper.Map<List<KebutuhanFTEReadDto>>(list);

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
                        HumanResourceQueryHelper.KebutuhanFteSchema,
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
                    HumanResourceQueryHelper.KebutuhanFteSchema,
                    "KebutuhanFTE",
                    ct),
                "Human resource request was canceled.",
                cancellationToken);
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchKebutuhanFTE(long id, [FromBody] Dictionary<string, object> changes)
        {
            var kebutuhanfte = await _db.KebutuhanFTE.FindAsync(id);
            if (kebutuhanfte == null)
                return NotFound($"KebutuhanFTE with id {id} not found.");

            var invalidFields = HumanResourcePatchHelper.ApplyPatch(kebutuhanfte, changes);

            if (invalidFields.Count > 0)
            {
                return BadRequest(new
                {
                    Message = HumanResourcePatchHelper.InvalidFieldsMessage,
                    InvalidFields = invalidFields
                });
            }

            kebutuhanfte.Gap = CalculateGap(kebutuhanfte.Existing, kebutuhanfte.Kebutuhan);

            await _db.SaveChangesAsync();

            return Ok(new { Message = "Updated successfully", kebutuhanfte });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] KebutuhanFTE kebutuhanfte)
        {
            kebutuhanfte.Gap = CalculateGap(kebutuhanfte.Existing, kebutuhanfte.Kebutuhan);
            _db.KebutuhanFTE.Add(kebutuhanfte);
            await _db.SaveChangesAsync();
            return Ok(kebutuhanfte);
        }



        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided.");

            var rows = await _db.KebutuhanFTE.Where(a => ids.Contains(a.Id)).ToListAsync();
            if (!rows.Any())
                return NotFound("No matching rows found.");

            _db.KebutuhanFTE.RemoveRange(rows);
            await _db.SaveChangesAsync();

            return Ok(new { DeletedCount = rows.Count });
        }   
        private static int CalculateGap(int? existing, int? kebutuhan)
        {
            var existingValue = existing ?? 0;
            var kebutuhanValue = kebutuhan ?? 0;
            return kebutuhanValue > existingValue ? kebutuhanValue - existingValue : 0;
        }

        //--------------------------------------------------------------------------------------------------------------------//
        //-----------------------------------------------KEBUTUHAN FTE --------------------------------------------------------//
        //--------------------------------------------------------------------------------------------------------------------//

        //patch + calculate gap
        [HttpPatch("{id}/gap")]
        public async Task<IActionResult> PatchGap(long id)
        {
            var kebutuhanfte = await _db.KebutuhanFTE.FindAsync(id);
            if (kebutuhanfte == null)
                return NotFound($"KebutuhanFTE with id {id} not found.");

            // Recalculate Gap
            kebutuhanfte.Gap = CalculateGap(kebutuhanfte.Existing, kebutuhanfte.Kebutuhan);

            await _db.SaveChangesAsync();

            return Ok(new { Message = "Gap recalculated successfully", kebutuhanfte });
        }


    }
}




