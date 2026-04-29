/*
 * PGH-DOC
 * File: Controllers/👥HumanController/Training/BNUController.cs
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
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using OfficeOpenXml;
using PGH.Dtos;
using PGH.Dtos.Human;
using PGH.Dtos.Planing.Realization;
using PGH.Helpers;
using PGH.Models.Human;
//using refactorbackend.Models.Procurement;
using System.Data;
using WebApplication2.Data;
//using WebApplication2.Dtos;



namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BNUController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public BNUController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
        {

            _mapper = mapper;
            _db = db;
            _env = env;

        }

        private IQueryable<BNU> BuildOrderedQuery()
        {
            return _db.BNU
                .AsNoTracking()
                .OrderByDescending(x => x.Id);
        }

        private static (string schema, string name) SplitSchemaAndName(string table)
        {
            var parts = table.Split('.', 2);
            var schema = SanitizeIdentifier(parts.Length == 2 ? parts[0] : "dbo");
            var name = SanitizeIdentifier(parts.Length == 2 ? parts[1] : parts[0]);
            return (schema, name);
        }

        private static string SanitizeIdentifier(string s)
        {
            var cleaned = new string((s ?? "").Where(ch => char.IsLetterOrDigit(ch) || ch == '_').ToArray());
            if (string.IsNullOrWhiteSpace(cleaned)) return cleaned; // caller handles fallback
            if (cleaned.Length > 120) cleaned = cleaned[..120];
            return cleaned;
        }

        private static List<string> Dedup(List<string> names)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < names.Count; i++)
            {
                var baseName = names[i];
                var name = baseName; int k = 1;
                while (!seen.Add(name)) name = $"{baseName}_{k++}";
                names[i] = name;
            }
            return names;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<BNUReadDto>>> GetAll()
        {
            var list = await BuildOrderedQuery().ToListAsync();
            var dtoList = _mapper.Map<List<BNUReadDto>>(list);

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
                        HumanResourceQueryHelper.BnuSchema,
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
                    HumanResourceQueryHelper.BnuSchema,
                    "BNU",
                    ct),
                "Human resource request was canceled.",
                cancellationToken);
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchBNU(long id, [FromBody] Dictionary<string, object> changes)
        {
            var bnu = await _db.BNU.FindAsync(id);
            if (bnu == null)
                return NotFound($"BNU with id {id} not found.");

            // Deserialize ExtraData into dictionary
            var extraDict = string.IsNullOrWhiteSpace(bnu.ExtraData)
                ? new Dictionary<string, object>()
                : JsonConvert.DeserializeObject<Dictionary<string, object>>(bnu.ExtraData) ?? new Dictionary<string, object>();

            foreach (var kvp in changes)
            {
                var property = typeof(BNU).GetProperty(kvp.Key);

                if (property != null && property.Name != nameof(BNU.ExtraData))
                {
                    // Update normal property dynamically
                    var convertedValue = Convert.ChangeType(kvp.Value, property.PropertyType);
                    property.SetValue(bnu, convertedValue);
                }
                else
                {
                    // Treat as ExtraData field
                    extraDict[kvp.Key] = kvp.Value!;
                }
            }

            bnu.ExtraData = JsonConvert.SerializeObject(extraDict, Formatting.None);
            await _db.SaveChangesAsync();

            return Ok(new { Message = "Updated successfully", bnu });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] BNU bnu)
        {
            _db.BNU.Add(bnu);
            await _db.SaveChangesAsync();
            return Ok(bnu);
        }



        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided.");

            var rows = await _db.BNU.Where(a => ids.Contains(a.Id)).ToListAsync();
            if (!rows.Any())
                return NotFound("No matching rows found.");

            _db.BNU.RemoveRange(rows);
            await _db.SaveChangesAsync();

            return Ok(new { DeletedCount = rows.Count });
        }




        [HttpPost("extra/bulk")]
        public async Task<IActionResult> AddExtraDataFieldToAll([FromBody] Dictionary<string, object> newField)
        {
            if (newField == null || newField.Count == 0)
                return BadRequest("No field provided.");

            var bnuList = await _db.BNU.ToListAsync();

            foreach (var bnu in bnuList)
            {
                var dict = string.IsNullOrWhiteSpace(bnu.ExtraData)
                    ? new Dictionary<string, object>()
                    : JsonConvert.DeserializeObject<Dictionary<string, object>>(bnu.ExtraData) ?? new Dictionary<string, object>();

                foreach (var kvp in newField)
                {
                    if (!dict.ContainsKey(kvp.Key)) // only add if missing
                        dict[kvp.Key] = kvp.Value!;
                }

                bnu.ExtraData = JsonConvert.SerializeObject(dict, Formatting.None);
            }

            await _db.SaveChangesAsync();
            return Ok(new { Message = "Field(s) added to all rows." });
        }


        [HttpDelete("extra/bulk/{key}")]
        public async Task<IActionResult> DeleteExtraDataFieldFromAll(string key)
        {
            var bnuList = await _db.BNU.ToListAsync();

            foreach (var bnu in bnuList)
            {
                var dict = string.IsNullOrWhiteSpace(bnu.ExtraData)
                    ? new Dictionary<string, object>()
                    : JsonConvert.DeserializeObject<Dictionary<string, object>>(bnu.ExtraData) ?? new Dictionary<string, object>();

                if (dict.Remove(key))
                {
                    bnu.ExtraData = JsonConvert.SerializeObject(dict, Formatting.None);
                }
            }

            await _db.SaveChangesAsync();
            return Ok(new { Message = $"Field '{key}' deleted from all rows." });
        }




    }
}




