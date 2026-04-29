/*
 * PGH-DOC
 * File: Controllers/🛒ProcurementController/AllController.cs
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
using PGH.Helpers;
using PGH.Dtos.Procurement;
using PGH.Models.Procurement;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Reflection;
using WebApplication2.Data;



namespace PGH.Controllers.Procurement
{
    [ApiController]
    [Route("api/[controller]")]
    public class AllProcureController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public AllProcureController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
        {

            _mapper = mapper;
            _db = db;
            _env = env;

        }

        private Task<IActionResult> ExecuteProcurementListRequestAsync(
            Func<CancellationToken, Task<IActionResult>> action,
            CancellationToken cancellationToken = default)
        {
            return RequestCancellationHelper.ExecuteAsync(
                this,
                action,
                "Procurement list request was canceled.",
                cancellationToken);
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




        //---------------------------- ADDED Controller ----------------------------//

        //Combine Dto Exist and Dto New
        [HttpGet("combined")]
        public async Task<IActionResult> GetCombinedProcurements()
        {
            var combined = (await _db.ProcurementItems
                .AsNoTracking()
                .ToListAsync())
                .Select(ProcurementCanonicalHelper.ToAllDto)
                .OrderByDescending(x => x.CreatedAt ?? x.UpdatedAt ?? DateTime.MinValue)
                .ThenByDescending(x => x.Id)
                .ToList();

            return Ok(combined);
        }

        [HttpPost("combined/query")]
        public async Task<IActionResult> QueryCombined(
            [FromBody] ProcurementListQueryRequest? request,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementListRequestAsync(
                async ct =>
                {
                    var today = DateTime.UtcNow.Date;
                    var query = _db.ProcurementItems
                        .AsNoTracking()
                        .OrderByDescending(item => item.CreatedAt ?? item.UpdatedAt)
                        .ThenByDescending(item => item.Id)
                        .Select(item => new AllProcureBaseDto
                        {
                            Id = item.Id,
                            Source = item.SourceType == ProcurementCanonicalHelper.SourceExisting ? "Existing" : "New",
                            No = item.No,
                            project_id = item.project_id,
                            Department = item.Department,
                            TipePengadaan = item.TipePengadaan,
                            Vendor = item.Vendor,
                            PIC = item.PIC,
                            Perjanjian = item.Perjanjian,
                            NilaiPengajuanAPS = item.NilaiPengajuanAPS,
                            NilaiApproveSTA = item.NilaiApproveSTA,
                            Status_Pengadaan = item.Status_Pengadaan,
                            NoPKS = item.NoPKS,
                            TglPKS = item.TglPKS,
                            NoSPK = item.NoSPK,
                            TglSPK = item.TglSPK,
                            WaktuMulai = item.WaktuMulai,
                            JatuhTempo = item.JatuhTempo,
                            PICPFA = item.PICPFA,
                            TglKirimkePFA = item.TglKirimkePFA,
                            Keterangan = item.Keterangan,
                            SisaBulan = item.JatuhTempo.HasValue
                                ? ((item.JatuhTempo.Value.Year - today.Year) * 12) +
                                  item.JatuhTempo.Value.Month - today.Month
                                : (int?)null,
                            JenisAnggaran = item.JenisAnggaran,
                            NilaiKontrak = item.NilaiKontrak,
                            CreatedAt = item.CreatedAt,
                            UpdatedAt = item.UpdatedAt
                        });

                    var response = await ProcurementListQueryHelper.ExecuteAsync(
                        query,
                        request,
                        ProcurementListQueryHelper.AllDisplayColumns,
                        ct);

                    return Ok(response);
                },
                cancellationToken);
        }

        [HttpPost("combined/export")]
        public async Task<IActionResult> ExportCombined(
            [FromBody] ProcurementExportRequest? request,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementListRequestAsync(
                async ct =>
                {
                    var today = DateTime.UtcNow.Date;
                    var query = _db.ProcurementItems
                        .AsNoTracking()
                        .OrderByDescending(item => item.CreatedAt ?? item.UpdatedAt)
                        .ThenByDescending(item => item.Id)
                        .Select(item => new AllProcureBaseDto
                        {
                            Id = item.Id,
                            Source = item.SourceType == ProcurementCanonicalHelper.SourceExisting ? "Existing" : "New",
                            No = item.No,
                            project_id = item.project_id,
                            Department = item.Department,
                            TipePengadaan = item.TipePengadaan,
                            Vendor = item.Vendor,
                            PIC = item.PIC,
                            Perjanjian = item.Perjanjian,
                            NilaiPengajuanAPS = item.NilaiPengajuanAPS,
                            NilaiApproveSTA = item.NilaiApproveSTA,
                            Status_Pengadaan = item.Status_Pengadaan,
                            NoPKS = item.NoPKS,
                            TglPKS = item.TglPKS,
                            NoSPK = item.NoSPK,
                            TglSPK = item.TglSPK,
                            WaktuMulai = item.WaktuMulai,
                            JatuhTempo = item.JatuhTempo,
                            PICPFA = item.PICPFA,
                            TglKirimkePFA = item.TglKirimkePFA,
                            Keterangan = item.Keterangan,
                            SisaBulan = item.JatuhTempo.HasValue
                                ? ((item.JatuhTempo.Value.Year - today.Year) * 12) +
                                  item.JatuhTempo.Value.Month - today.Month
                                : (int?)null,
                            JenisAnggaran = item.JenisAnggaran,
                            NilaiKontrak = item.NilaiKontrak,
                            CreatedAt = item.CreatedAt,
                            UpdatedAt = item.UpdatedAt
                        });

                    return await ProcurementExportHelper.BuildExportResponseAsync(
                        this,
                        query,
                        request,
                        ProcurementListQueryHelper.AllDisplayColumns,
                        "ProcurementList",
                        _db,
                        ct);
                },
                cancellationToken);
        }

        [HttpDelete("combined/extra/bulk/{key}")]
        public IActionResult DeleteExtraDataFieldFromAllCombined(string key)
        {
            return BadRequest("ExtraData fields are disabled for Procurement. Use typed columns.");
        }



        [HttpPost("combined")]
        public async Task<IActionResult> Create([FromBody] NewProcure newprocure)
        {
            var item = new ProcurementItem
            {
                SourceType = ProcurementCanonicalHelper.SourceNew,
                Status_Pengadaan = null,
                Department = newprocure.Department,
                PIC = newprocure.PIC,
                Vendor = newprocure.Vendor,
                TipePengadaan = newprocure.TipePengadaan,
                Perjanjian = newprocure.Perjanjian,
                NilaiPengajuanAPS = newprocure.NilaiPengajuanAPS,
                NilaiApproveSTA = newprocure.NilaiApproveSTA,
                NilaiKontrak = newprocure.NilaiKontrak,
                JenisAnggaran = newprocure.JenisAnggaran,
                NoPKS = newprocure.NoPKS,
                TglPKS = newprocure.TglPKS,
                NoSPK = newprocure.NoSPK,
                TglSPK = newprocure.TglSPK,
                WaktuMulai = newprocure.WaktuMulai,
                JatuhTempo = newprocure.JatuhTempo,
                PICPFA = newprocure.PICPFA,
                TglKirimkePFA = newprocure.TglKirimkePFA,
                Keterangan = newprocure.Keterangan,
                ExtraData = null
            };

            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, item);
            _db.ProcurementItems.Add(item);
            await _db.SaveChangesAsync();
            return Ok(ProcurementCanonicalHelper.ToAllDto(item));
        }

        [HttpPost("combined/{source}")]
        public async Task<IActionResult> CreateBySource(
    string source,
    [FromBody] Dictionary<string, object> payload
)
        {
            if (string.IsNullOrWhiteSpace(source))
                return BadRequest("Source is required.");

            source = source.ToLowerInvariant();

            if (source != "new" && source != "existing" && source != "exs")
                return BadRequest("Source must be 'new' or 'existing'.");

            if (payload == null)
                return BadRequest("Payload is required.");

            var entity = new ProcurementItem
            {
                SourceType = source == "new"
                    ? ProcurementCanonicalHelper.SourceNew
                    : ProcurementCanonicalHelper.SourceExisting
            };
            ProcurementCanonicalHelper.ApplyPatchToItem(entity, payload);
            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, entity);
            _db.ProcurementItems.Add(entity);
            await _db.SaveChangesAsync();
            return Ok(ProcurementCanonicalHelper.ToAllDto(entity));
        }



        [HttpPost("combined/extra/bulk")]
        public IActionResult AddExtraDataFieldToAllCombined(
    [FromBody] Dictionary<string, object> newField
)
        {
            return BadRequest("ExtraData fields are disabled for Procurement. Use typed columns.");
        }


        [HttpPatch("combined/{id:long}")]
        public async Task<IActionResult> PatchCombined(
    long id,
    [FromBody] Dictionary<string, object> updates
)
        {
            var entity = await _db.ProcurementItems.FindAsync(id);
            var currentSource = entity == null
                ? null
                : ProcurementCanonicalHelper.NormalizeSourceType(entity.SourceType) == ProcurementCanonicalHelper.SourceExisting
                    ? "existing"
                    : "new";

            if (entity == null)
                return NotFound($"Procurement with id {id} not found");

            // 🔁 SOURCE MIGRATION
            if (updates.TryGetValue("Source", out var targetSourceObj))
            {
                var targetSource = targetSourceObj?.ToString()?.ToLowerInvariant();

                if (targetSource == currentSource)
                    return BadRequest("Source is already set to this value");

                if (targetSource is not ("new" or "existing"))
                    return BadRequest("Invalid source transition");

                entity.SourceType = ProcurementCanonicalHelper.NormalizeSourceType(targetSource);
                await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, entity);
                await _db.SaveChangesAsync();

                var migratedRow = ProcurementCanonicalHelper.ToAllDto(entity);

                return Ok(new
                {
                    Message = currentSource == "new" ? "Converted new → existing" : "Converted existing → new",
                    entity.Id,
                    entity.project_id,
                    row = migratedRow
                });
            }

            // 🔹 NORMAL PATCH
            ProcurementCanonicalHelper.ApplyPatchToItem(entity, updates);
            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, entity);
            await _db.SaveChangesAsync();

            var updatedRow = ProcurementCanonicalHelper.ToAllDto(entity);

            return Ok(new
            {
                Message = "Updated",
                Source = currentSource,
                Id = id,
                row = updatedRow
            });
        }

        [HttpPost("combined/bulk-delete")]
        public async Task<IActionResult> BulkDeleteCombined([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided.");

            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var trx = await _db.Database.BeginTransactionAsync();
                try
                {
                    // build parameters
                    var parameters = ids
                        .Select((id, i) => new SqlParameter($"@p{i}", id))
                        .ToArray();

                    var inClause = string.Join(",", parameters.Select(p => p.ParameterName));
                    var deleteRelationSql = $@"
            DELETE FROM Procurement.ProcurementRelation
            WHERE ChildProcurementItemId IN ({inClause})
               OR ParentProcurementItemId IN ({inClause})
        ";
                    var deleteStatusSql = $@"
            DELETE FROM Procurement.StatusPengadaan
            WHERE ProcurementItemId IN ({inClause})
        ";
                    var deleteItemsSql = $@"
            DELETE FROM Procurement.ProcurementItem
            WHERE Id IN ({inClause})
        ";

                    await _db.Database.ExecuteSqlRawAsync(deleteRelationSql, parameters);
                    await _db.Database.ExecuteSqlRawAsync(deleteStatusSql, parameters);
                    var deletedItems = await _db.Database.ExecuteSqlRawAsync(deleteItemsSql, parameters);

                    await trx.CommitAsync();

                    return Ok(new
                    {
                        TotalDeleted = deletedItems
                    });
                }
                catch
                {
                    await trx.RollbackAsync();
                    throw;
                }
            });
        }

        [HttpPatch("combined/generate-project-id/{id:long}")]
        public async Task<IActionResult> PatchGenerateProjectIdCombined(
    long id,
    [FromQuery] string source
)
        {
            if (string.IsNullOrWhiteSpace(source))
                return BadRequest("Source is required");

            source = source.ToLower();

            var normalizedSource = ProcurementCanonicalHelper.NormalizeSourceType(source);
            var entity = await _db.ProcurementItems
                .FirstOrDefaultAsync(item => item.Id == id && item.SourceType == normalizedSource);
            if (entity == null)
                return NotFound($"Procurement with ID {id} and source '{source}' not found.");

            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, entity);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Project ID generated",
                id = entity.Id,
                project_id = entity.project_id
            });
        }
    }

}












