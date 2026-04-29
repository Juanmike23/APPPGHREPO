/*
 * PGH-DOC
 * File: Controllers/🛒ProcurementController/ExistingController.cs
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
using System.Data;
using System.Globalization;

using WebApplication2.Data;
using PGH.Models.Procurement;
using PGH.Dtos.Procurement;



namespace PGH.Controllers.Procurement
{
    [ApiController]
    [Route("api/[controller]")]
    public class ExistingProcureController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public ExistingProcureController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
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

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ExistingProcureReadDto>>> GetAll()
        {
            var list = await _db.ProcurementItems
                .Where(item => item.SourceType == ProcurementCanonicalHelper.SourceExisting)
                .OrderByDescending(item => item.CreatedAt ?? item.UpdatedAt)
                .ThenByDescending(item => item.Id)
                .ToListAsync();
            var dtoList = list.Select(ProcurementCanonicalHelper.ToExistingDto).ToList();

            return Ok(dtoList);
        }

        [HttpPost("query")]
        public async Task<IActionResult> Query(
            [FromBody] ProcurementListQueryRequest? request,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementListRequestAsync(
                async ct =>
                {
                    var today = DateTime.UtcNow.Date;
                    var query = _db.ProcurementItems
                        .AsNoTracking()
                        .Where(item => item.SourceType == ProcurementCanonicalHelper.SourceExisting)
                        .OrderByDescending(item => item.CreatedAt ?? item.UpdatedAt)
                        .ThenByDescending(item => item.Id)
                        .Select(item => new ExistingProcureReadDto
                        {
                            Id = item.Id,
                            No = item.No,
                            project_id = item.project_id,
                            Status_Pengadaan = item.Status_Pengadaan,
                            Department = item.Department,
                            PIC = item.PIC,
                            Vendor = item.Vendor,
                            TipePengadaan = item.TipePengadaan,
                            Perjanjian = item.Perjanjian,
                            NilaiPengajuanAPS = item.NilaiPengajuanAPS,
                            NilaiApproveSTA = item.NilaiApproveSTA,
                            JenisAnggaran = item.JenisAnggaran,
                            NilaiKontrak = item.NilaiKontrak,
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
                            CreatedAt = item.CreatedAt,
                            UpdatedAt = item.UpdatedAt
                        });

                    var response = await ProcurementListQueryHelper.ExecuteAsync(
                        query,
                        request,
                        ProcurementListQueryHelper.SharedDisplayColumns,
                        ct);

                    return Ok(response);
                },
                cancellationToken);
        }

        [HttpPost("export")]
        public async Task<IActionResult> Export(
            [FromBody] ProcurementExportRequest? request,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteProcurementListRequestAsync(
                async ct =>
                {
                    var today = DateTime.UtcNow.Date;
                    var query = _db.ProcurementItems
                        .AsNoTracking()
                        .Where(item => item.SourceType == ProcurementCanonicalHelper.SourceExisting)
                        .OrderByDescending(item => item.CreatedAt ?? item.UpdatedAt)
                        .ThenByDescending(item => item.Id)
                        .Select(item => new ExistingProcureReadDto
                        {
                            Id = item.Id,
                            No = item.No,
                            project_id = item.project_id,
                            Status_Pengadaan = item.Status_Pengadaan,
                            Department = item.Department,
                            PIC = item.PIC,
                            Vendor = item.Vendor,
                            TipePengadaan = item.TipePengadaan,
                            Perjanjian = item.Perjanjian,
                            NilaiPengajuanAPS = item.NilaiPengajuanAPS,
                            NilaiApproveSTA = item.NilaiApproveSTA,
                            JenisAnggaran = item.JenisAnggaran,
                            NilaiKontrak = item.NilaiKontrak,
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
                            CreatedAt = item.CreatedAt,
                            UpdatedAt = item.UpdatedAt
                        });

                    return await ProcurementExportHelper.BuildExportResponseAsync(
                        this,
                        query,
                        request,
                        ProcurementListQueryHelper.SharedDisplayColumns,
                        "ProcurementList",
                        _db,
                        ct);
                },
                cancellationToken);
        }


        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchExistingProcure(long id, [FromBody] Dictionary<string, object> changes)
        {
            if (changes == null || changes.Count == 0)
                return BadRequest("No changes provided.");

            var existingprocure = await _db.ProcurementItems
                .FirstOrDefaultAsync(item => item.Id == id && item.SourceType == ProcurementCanonicalHelper.SourceExisting);
            if (existingprocure == null)
                return NotFound($"ExistingProcure with ID {id} not found.");
            ProcurementCanonicalHelper.ApplyPatchToItem(existingprocure, changes);
            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, existingprocure);

            // Persist changes
            await _db.SaveChangesAsync();

            var updatedRow = ProcurementCanonicalHelper.ToExistingDto(existingprocure);

            return Ok(new
            {
                Message = "Row updated successfully",
                UpdatedAt = existingprocure.UpdatedAt,
                row = updatedRow,
                existingprocure = updatedRow
            });
        }


        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ExistingProcure existingprocure)
        {
            var item = new ProcurementItem
            {
                SourceType = ProcurementCanonicalHelper.SourceExisting,
                Status_Pengadaan = null,
                Department = existingprocure.Department,
                PIC = existingprocure.PIC,
                Vendor = existingprocure.Vendor,
                TipePengadaan = existingprocure.TipePengadaan,
                Perjanjian = existingprocure.Perjanjian,
                NilaiPengajuanAPS = existingprocure.NilaiPengajuanAPS,
                NilaiApproveSTA = existingprocure.NilaiApproveSTA,
                NilaiKontrak = existingprocure.NilaiKontrak,
                JenisAnggaran = existingprocure.JenisAnggaran,
                NoPKS = existingprocure.NoPKS,
                TglPKS = existingprocure.TglPKS,
                NoSPK = existingprocure.NoSPK,
                TglSPK = existingprocure.TglSPK,
                WaktuMulai = existingprocure.WaktuMulai,
                JatuhTempo = existingprocure.JatuhTempo,
                PICPFA = existingprocure.PICPFA,
                TglKirimkePFA = existingprocure.TglKirimkePFA,
                Keterangan = existingprocure.Keterangan,
                ExtraData = null,
                CreatedAt = null,
                UpdatedAt = null
            };

            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, item);
            _db.ProcurementItems.Add(item);
            await _db.SaveChangesAsync();
            return Ok(ProcurementCanonicalHelper.ToExistingDto(item));
        }



        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided.");

            var rows = await _db.ProcurementItems
                .Where(a => a.SourceType == ProcurementCanonicalHelper.SourceExisting && ids.Contains(a.Id))
                .ToListAsync();
            if (!rows.Any())
                return NotFound("No matching rows found.");

            var targetIds = rows.Select(row => row.Id).ToList();
            var relations = await _db.ProcurementRelations
                .Where(item => targetIds.Contains(item.ChildProcurementItemId) || targetIds.Contains(item.ParentProcurementItemId))
                .ToListAsync();
            var statuses = await _db.StatusPengadaan
                .Where(item => item.ProcurementItemId.HasValue && targetIds.Contains(item.ProcurementItemId.Value))
                .ToListAsync();

            _db.ProcurementRelations.RemoveRange(relations);
            _db.StatusPengadaan.RemoveRange(statuses);
            _db.ProcurementItems.RemoveRange(rows);
            await _db.SaveChangesAsync();

            return Ok(new { DeletedCount = rows.Count });
        }




        [HttpPost("extra/bulk")]
        public IActionResult AddExtraDataFieldToAll([FromBody] Dictionary<string, object> newField)
        {
            return BadRequest("ExtraData fields are disabled for Procurement. Use typed columns.");
        }


        [HttpDelete("extra/bulk/{key}")]
        public IActionResult DeleteExtraDataFieldFromAll(string key)
        {
            return BadRequest("ExtraData fields are disabled for Procurement. Use typed columns.");
        }




        //---------------------------- ADDED Controller ----------------------------//

        [HttpGet("{id}")]
        public async Task<ActionResult<ExistingProcureReadDto>> GetById(long id)
        {
            var entity = await _db.ProcurementItems
                .FirstOrDefaultAsync(item => item.Id == id && item.SourceType == ProcurementCanonicalHelper.SourceExisting);
            if (entity == null)
                return NotFound();

            var dto = ProcurementCanonicalHelper.ToExistingDto(entity);
            return Ok(dto);
        }


  

        [HttpGet("generate-project-id/{id}")]
        public async Task<IActionResult> GenerateProjectId(long id)
        {
            var existingprocure = await _db.ProcurementItems
                .FirstOrDefaultAsync(item => item.Id == id && item.SourceType == ProcurementCanonicalHelper.SourceExisting);
            if (existingprocure == null)
                return NotFound($"ExistingProcure with ID {id} not found.");

            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, existingprocure);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Project ID generated successfully",
                id = existingprocure.Id,
                project_id = existingprocure.project_id
            });
        }



        [HttpPatch("generate-project-id/{id}")]
        public async Task<IActionResult> PatchGenerateProjectId(long id)
        {
            var existingprocure = await _db.ProcurementItems
                .FirstOrDefaultAsync(item => item.Id == id && item.SourceType == ProcurementCanonicalHelper.SourceExisting);
            if (existingprocure == null)
                return NotFound($"ExistingProcure with ID {id} not found.");

            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, existingprocure);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Project ID generated successfully",
                id = existingprocure.Id,
                project_id = existingprocure.project_id
            });
        }
        [HttpPatch("generate-project-ids")]
        public async Task<IActionResult> GenerateAllProjectIds()
        {
            var all = await _db.ProcurementItems
                .Where(item => item.SourceType == ProcurementCanonicalHelper.SourceExisting)
                .ToListAsync();
            if (!all.Any())
                return NotFound("No records found.");

            var updated = new List<object>();
            var orderedRows = all
                .OrderBy(row => row.CreatedAt ?? row.UpdatedAt ?? DateTime.UtcNow)
                .ThenBy(row => row.Id)
                .ToList();

            var partitionCounters = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in orderedRows)
            {
                row.CreatedAt ??= DateTime.UtcNow;
                if (!ProcurementCanonicalHelper.TryGetProjectDepartmentToken(row.Department, out var departmentToken))
                {
                    row.No = null;
                    row.project_id = null;
                    continue;
                }

                var yearToken = ProcurementCanonicalHelper.ResolveProjectYear(row.CreatedAt);
                if (!ProcurementCanonicalHelper.TryGetProjectTypeToken(row, out var typeToken))
                {
                    row.No = null;
                    row.project_id = null;
                    continue;
                }

                var partitionKey = $"{departmentToken}|{typeToken}|{yearToken}";

                if (!partitionCounters.ContainsKey(partitionKey))
                {
                    partitionCounters[partitionKey] = 0;
                }

                partitionCounters[partitionKey]++;
                var nextNumber = partitionCounters[partitionKey];

                row.No = nextNumber.ToString(CultureInfo.InvariantCulture);
                row.project_id = $"{departmentToken}/{typeToken}/{yearToken}/{nextNumber}";

                updated.Add(new { row.Id, row.project_id });
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Project IDs generated/updated for all records",
                count = updated.Count,
                updated
            });
        }

        private async Task ApplyProjectIdentityAsync(ProcurementItem row)
        {
            await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, row);
        }

        private async Task<int> GetNextProjectSequenceAsync(
            ProcurementItem row,
            string departmentToken,
            int yearToken)
        {
            var siblings = await _db.ProcurementItems
                .AsNoTracking()
                .Where(item =>
                    item.Id != row.Id &&
                    item.SourceType == ProcurementCanonicalHelper.SourceExisting &&
                    item.Department != null &&
                    item.Department.Trim() != string.Empty &&
                    item.Department.Trim().ToUpper() == departmentToken)
                .Select(item => new { item.No, item.project_id, item.CreatedAt, item.UpdatedAt })
                .ToListAsync();

            var maxSequence = siblings
                .Where(item => ProcurementCanonicalHelper.ResolveProjectYear(item.CreatedAt ?? item.UpdatedAt) == yearToken)
                .Select(item => ProcurementCanonicalHelper.ResolveStoredSequenceValue(item.No, item.project_id))
                .DefaultIfEmpty(0)
                .Max();

            return maxSequence + 1;
        }

        private static int ResolveStoredSequenceValue(string? noValue, string? projectId)
        {
            if (TryParsePositiveInt(noValue, out var storedNumber))
            {
                return storedNumber;
            }

            if (TryParseProjectSequence(projectId, out var derivedNumber))
            {
                return derivedNumber;
            }

            return 0;
        }

        private static bool TryGetProjectDepartmentToken(string? department, out string token)
        {
            if (string.IsNullOrWhiteSpace(department))
            {
                token = string.Empty;
                return false;
            }

            token = department.Trim().ToUpperInvariant();
            return true;
        }

        private static int ResolveProjectYear(DateTime? createdAt)
        {
            return (createdAt ?? DateTime.UtcNow).Year;
        }

        private static bool TryParsePositiveInt(string? rawValue, out int parsed)
        {
            return int.TryParse(rawValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed) && parsed > 0;
        }

        private static bool TryParseProjectSequence(string? projectId, out int parsed)
        {
            parsed = 0;
            if (string.IsNullOrWhiteSpace(projectId))
            {
                return false;
            }

            var parts = projectId.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 0)
            {
                return false;
            }

            return TryParsePositiveInt(parts[^1], out parsed);
        }

        private static bool IsProtectedProcurementField(string fieldName)
        {
            return fieldName.Equals("No", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("project_id", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("CreatedAt", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("UpdatedAt", StringComparison.OrdinalIgnoreCase);
        }

    }
}













