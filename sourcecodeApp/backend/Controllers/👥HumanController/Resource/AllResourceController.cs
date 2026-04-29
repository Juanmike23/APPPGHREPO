/*
 * PGH-DOC
 * File: Controllers/👥HumanController/Resource/AllResourceController.cs
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
using PGH.Helpers;
using PGH.Models.Human;
using WebApplication2.Data;



namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AllResourceController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public AllResourceController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
        {

            _mapper = mapper;
            _db = db;
            _env = env;

        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AllResourceDto>>> GetAllResources()
        {
            var fteQuery =
                _db.FTE
                   .Select(f => new
                   {
                       Id = f.Id,                 // 👈 FTE.Id

                       NPP = f.NPP ?? string.Empty,
                       Nama = f.Nama ?? string.Empty,
                       Department = f.Department ?? string.Empty,
                       ResourceType = "FTE",
                       CreatedAt = f.CreatedAt
                   });

            var nonFteQuery =
                _db.NonFTE
                   .Select(n => new
                   {
                       Id = n.Id,                 // 👈 nonfte.Id

                       NPP = n.NPP ?? string.Empty,
                       Nama = n.Nama ?? string.Empty,
                       Department = n.Department ?? string.Empty,
                       ResourceType = "NonFTE",
                       CreatedAt = n.CreatedAt
                   });

            var result = await fteQuery
                .Union(nonFteQuery)
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .Select(x => new AllResourceDto
                {
                    Id = x.Id,
                    NPP = x.NPP,
                    Nama = x.Nama,
                    Department = x.Department,
                    ResourceType = x.ResourceType
                })
                .ToListAsync();

            return Ok(result);
        }

        public class AllResourceDto
        {
            public long Id { get; set; }          // original table Id
            public string NPP { get; set; } = string.Empty;
            public string Nama { get; set; } = string.Empty;
            public string Department { get; set; } = string.Empty;
            public string ResourceType { get; set; } = string.Empty; // "FTE" | "NonFTE"
        }

        [HttpPatch("{id:long}")]
        public async Task<IActionResult> PatchResource(
            long id,
            [FromBody] Dictionary<string, object> changes
        )
        {
            object? entity = null;
            string? resourceType = null;

            var fte = await _db.FTE.FindAsync(id);
            if (fte != null)
            {
                entity = fte;
                resourceType = "FTE";
            }
            else
            {
                var nonFte = await _db.NonFTE.FindAsync(id);
                if (nonFte != null)
                {
                    entity = nonFte;
                    resourceType = "NonFTE";
                }
            }

            if (entity == null)
                return NotFound($"Resource with id {id} not found");

            var invalidFields = HumanResourcePatchHelper.ApplyPatch(
                entity,
                changes,
                "ResourceType");
            if (invalidFields.Count > 0)
            {
                return BadRequest(new
                {
                    Message = HumanResourcePatchHelper.InvalidFieldsMessage,
                    InvalidFields = invalidFields
                });
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                Message = "Resource updated",
                ResourceType = resourceType,
                Id = id
            });
        }



        [HttpPost]
        public async Task<IActionResult> Create([FromBody] FTE fte)
        {
            _db.FTE.Add(fte);
            await _db.SaveChangesAsync();
            return Ok(fte);
        }



        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDeleteResource(
     [FromBody] List<long> ids
 )
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No Ids provided");

            // 🔍 Detect per table
            var fteRows = await _db.FTE
                .Where(x => ids.Contains(x.Id))
                .ToListAsync();

            var nonFteRows = await _db.NonFTE
                .Where(x => ids.Contains(x.Id))
                .ToListAsync();

            if (!fteRows.Any() && !nonFteRows.Any())
                return NotFound("No matching resources found");

            // 🧹 Delete
            _db.FTE.RemoveRange(fteRows);
            _db.NonFTE.RemoveRange(nonFteRows);

            await _db.SaveChangesAsync();

            return Ok(new
            {
                DeletedFTE = fteRows.Select(x => x.Id).ToList(),
                DeletedNonFTE = nonFteRows.Select(x => x.Id).ToList(),
                TotalDeleted = fteRows.Count + nonFteRows.Count
            });
        }
    }
}



