/*
 * PGH-DOC
 * File: Controllers/🛒ProcurementController/StatusPengadaanController.cs
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

using WebApplication2.Data;
using PGH.Models.Procurement;
using PGH.Dtos.Procurement;



namespace PGH.Controllers.Procurement
{
    [ApiController]
    [Route("api/[controller]")]
    public class StatusPengadaanController : ControllerBase
    {
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public StatusPengadaanController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
        {

            _mapper = mapper;
            _db = db;
            _env = env;

        }

        private Task<IActionResult> ExecuteStatusPengadaanRequestAsync(
            Func<CancellationToken, Task<IActionResult>> action,
            CancellationToken cancellationToken = default)
        {
            return RequestCancellationHelper.ExecuteAsync(
                this,
                action,
                "Procurement status request was canceled.",
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
        public async Task<ActionResult<IEnumerable<StatusPengadaanReadDto>>> GetAll()
        {
            var statuspengadaanList = await _db.StatusPengadaan.ToListAsync();
            var dtoList = _mapper.Map<List<StatusPengadaanReadDto>>(statuspengadaanList);
            return Ok(dtoList);
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchStatusPengadaan(long id, [FromBody] Dictionary<string, object> changes)
        {
            var statuspengadaan = await _db.StatusPengadaan.FindAsync(id);
            if (statuspengadaan == null)
                return NotFound($"StatusPengadaan with id {id} not found.");

            var protectedFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                nameof(StatusPengadaan.Id),
                nameof(StatusPengadaan.TemplateNodeId),
                nameof(StatusPengadaan.ProcurementItemId),
                nameof(StatusPengadaan.NewID),
                nameof(StatusPengadaan.ExistingID),
                nameof(StatusPengadaan.No),
                nameof(StatusPengadaan.AlurPengadaanIT),
                nameof(StatusPengadaan.DenganDetail),
                nameof(StatusPengadaan.Persetujuan),
                nameof(StatusPengadaan.CreatedAt),
                nameof(StatusPengadaan.UpdatedAt)
            };

            // Deserialize ExtraData into dictionary
            var extraDict = string.IsNullOrWhiteSpace(statuspengadaan.ExtraData)
                ? new Dictionary<string, object>()
                : JsonConvert.DeserializeObject<Dictionary<string, object>>(statuspengadaan.ExtraData) ?? new Dictionary<string, object>();

            foreach (var kvp in changes)
            {
                var property = typeof(StatusPengadaan).GetProperty(kvp.Key);

                if (property != null && property.Name != nameof(StatusPengadaan.ExtraData))
                {
                    if (protectedFields.Contains(property.Name))
                    {
                        continue;
                    }

                    // Update normal property dynamically
                    var convertedValue = Convert.ChangeType(kvp.Value, property.PropertyType);
                    property.SetValue(statuspengadaan, convertedValue);
                }
                else
                {
                    // Treat as ExtraData field
                    extraDict[kvp.Key] = kvp.Value!;
                }
            }

            statuspengadaan.ExtraData = JsonConvert.SerializeObject(extraDict, Formatting.None);
            await _db.SaveChangesAsync();

            return Ok(new { Message = "Updated successfully", statuspengadaan });
        }


        [HttpPost]
        public async Task<IActionResult> Create([FromBody] StatusPengadaan statuspengadaan)
        {
            _db.StatusPengadaan.Add(statuspengadaan);
            await _db.SaveChangesAsync();
            return Ok(statuspengadaan);
        }



        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided.");

            var rows = await _db.StatusPengadaan.Where(a => ids.Contains(a.Id)).ToListAsync();
            if (!rows.Any())
                return NotFound("No matching rows found.");

            _db.StatusPengadaan.RemoveRange(rows);
            await _db.SaveChangesAsync();

            return Ok(new { DeletedCount = rows.Count });
        }




        [HttpPost("extra/bulk")]
        public async Task<IActionResult> AddExtraDataFieldToAll([FromBody] Dictionary<string, object> newField)
        {
            if (newField == null || newField.Count == 0)
                return BadRequest("No field provided.");

            var statuspengadaanList = await _db.StatusPengadaan.ToListAsync();

            foreach (var statuspengadaan in statuspengadaanList)
            {
                var dict = string.IsNullOrWhiteSpace(statuspengadaan.ExtraData)
                    ? new Dictionary<string, object>()
                    : JsonConvert.DeserializeObject<Dictionary<string, object>>(statuspengadaan.ExtraData) ?? new Dictionary<string, object>();

                foreach (var kvp in newField)
                {
                    if (!dict.ContainsKey(kvp.Key)) // only add if missing
                        dict[kvp.Key] = kvp.Value!;
                }

                statuspengadaan.ExtraData = JsonConvert.SerializeObject(dict, Formatting.None);
            }

            await _db.SaveChangesAsync();
            return Ok(new { Message = "Field(s) added to all rows." });
        }


        [HttpDelete("extra/bulk/{key}")]
        public async Task<IActionResult> DeleteExtraDataFieldFromAll(string key)
        {
            var statuspengadaanList = await _db.StatusPengadaan.ToListAsync();

            foreach (var statuspengadaan in statuspengadaanList)
            {
                var dict = string.IsNullOrWhiteSpace(statuspengadaan.ExtraData)
                    ? new Dictionary<string, object>()
                    : JsonConvert.DeserializeObject<Dictionary<string, object>>(statuspengadaan.ExtraData) ?? new Dictionary<string, object>();

                if (dict.Remove(key))
                {
                    statuspengadaan.ExtraData = JsonConvert.SerializeObject(dict, Formatting.None);
                }
            }

            await _db.SaveChangesAsync();
            return Ok(new { Message = $"Field '{key}' deleted from all rows." });
        }


        //--------------------------------------------Added Controller -------------------------------//

        [HttpGet("{id}")]
        public async Task<ActionResult<StatusPengadaanReadDto>> GetById(long id)
        {
            var entity = await _db.StatusPengadaan.FindAsync(id);
            if (entity == null)
                return NotFound();

            var dto = _mapper.Map<StatusPengadaanReadDto>(entity);
            return Ok(dto);
        }

        //GET StatusPengdaan of an Main ID
        [HttpGet("{type}/{id}")]
        public async Task<IActionResult> GetByType(
            string type,
            long id,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteStatusPengadaanRequestAsync(
                async ct =>
                {
                    type = type.ToLower().Trim();
                    var sourceType = type switch
                    {
                        "newprocure" => ProcurementCanonicalHelper.SourceNew,
                        "existingprocure" => ProcurementCanonicalHelper.SourceExisting,
                        _ => null
                    };

                    if (sourceType == null)
                        return BadRequest("Invalid type. Use 'newprocure' or 'existingprocure'.");

                    var item = await _db.ProcurementItems
                        .AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == id && x.SourceType == sourceType, ct);

                    if (item == null)
                        return NotFound("Procurement record not found.");

                    var rows = await EnsureStructuredStatusRowsAsync(item);
                    return Ok(rows);
                },
                cancellationToken);
        }







        [HttpPost("update-latest-status/{foreignKey}/{id}")]
        public async Task<IActionResult> UpdateLatestStatus(
            string foreignKey,
            long id,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteStatusPengadaanRequestAsync(
                async ct =>
                {
                    foreignKey = foreignKey.ToLower().Trim();
                    string? latestAlur = null;
                    var sourceType = foreignKey switch
                    {
                        "newprocure" => ProcurementCanonicalHelper.SourceNew,
                        "existingprocure" => ProcurementCanonicalHelper.SourceExisting,
                        _ => null
                    };
                    if (sourceType == null)
                    {
                        return BadRequest("Invalid foreignKey. Use 'newprocure' or 'existingprocure'.");
                    }

                    var procurementItem = await _db.ProcurementItems
                        .FirstOrDefaultAsync(x => x.Id == id && x.SourceType == sourceType, ct);
                    if (procurementItem == null)
                    {
                        return NotFound("Procurement item not found.");
                    }

                    var rows = await EnsureStructuredStatusRowsAsync(procurementItem);
                    latestAlur = ResolveCurrentStatusLabel(rows);

                    procurementItem.Status_Pengadaan = latestAlur;

                    await _db.SaveChangesAsync(ct);

                    return Ok(new
                    {
                        updated = true,
                        type = foreignKey,
                        id,
                        value_set = latestAlur
                    });
                },
                cancellationToken);
        }



        [HttpGet("progress/{type}/{id}")]
        public async Task<IActionResult> GetProgress(
            string type,
            long id,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteStatusPengadaanRequestAsync(
                async ct =>
                {
                    var sourceType = type.ToLower() switch
                    {
                        "newprocure" => ProcurementCanonicalHelper.SourceNew,
                        "existingprocure" => ProcurementCanonicalHelper.SourceExisting,
                        _ => null
                    };
                    if (sourceType == null) return BadRequest("Invalid type. Use 'newprocure' or 'existingprocure'.");

                    var item = await _db.ProcurementItems
                        .AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == id && x.SourceType == sourceType, ct);
                    if (item == null) return NotFound("Procurement item not found.");

                    var list = await EnsureStructuredStatusRowsAsync(item);
                    if (!list.Any())
                    {
                        return Ok(new StatusProgressDto
                        {
                            Type = type,
                            Id = id,
                            Progress = 0,
                            DoneCount = 0,
                            TotalSteps = 0,
                            CurrentStep = "Not Started",
                        });
                    }

                    var actionableRows = list
                        .Where(x => x.IsActionable)
                        .OrderBy(x => x.SortOrder ?? int.MaxValue)
                        .ThenBy(x => x.Id)
                        .ToList();

                    int total = actionableRows.Count;
                    int doneCount = actionableRows.Count(x => x.Status?.Equals("Done", StringComparison.OrdinalIgnoreCase) == true);
                    int progress = total == 0 ? 0 : (int)Math.Round(doneCount / (double)total * 100);

                    var latestDone = actionableRows.LastOrDefault(x => x.Status?.Equals("Done", StringComparison.OrdinalIgnoreCase) == true);
                    var currentAnchor = latestDone ?? actionableRows.FirstOrDefault() ?? list.First();
                    string current = CleanAlurName((currentAnchor?.Title ?? currentAnchor?.AlurPengadaanIT) ?? string.Empty);

                    return Ok(new StatusProgressDto
                    {
                        Type = type,
                        Id = id,
                        Progress = progress,
                        DoneCount = doneCount,
                        TotalSteps = total,
                        CurrentStep = current
                    });
                },
                cancellationToken);
        }

        [HttpPost("checkpoint/{type}/{id}/{rowId}")]
        public async Task<IActionResult> ApplyCheckpoint(
            string type,
            long id,
            long rowId,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteStatusPengadaanRequestAsync(
                async ct =>
                {
                    var sourceType = type.ToLower().Trim() switch
                    {
                        "newprocure" => ProcurementCanonicalHelper.SourceNew,
                        "existingprocure" => ProcurementCanonicalHelper.SourceExisting,
                        _ => null
                    };

                    if (sourceType == null)
                    {
                        return BadRequest("Invalid type. Use 'newprocure' or 'existingprocure'.");
                    }

                    var procurementItem = await _db.ProcurementItems
                        .FirstOrDefaultAsync(x => x.Id == id && x.SourceType == sourceType, ct);
                    if (procurementItem == null)
                    {
                        return NotFound("Procurement item not found.");
                    }

                    await EnsureStructuredStatusRowsAsync(procurementItem);

                    var templates = await _db.StatusPengadaanTemplate
                        .Where(x => x.IsActive && (x.TemplateKey ?? StatusPengadaanStructureHelper.DefaultTemplateKey) == StatusPengadaanStructureHelper.DefaultTemplateKey)
                        .OrderBy(x => x.SortOrder ?? int.MaxValue)
                        .ThenBy(x => x.Id)
                        .ToDictionaryAsync(x => x.Id, ct);
                    var actionableTemplateIds = StatusPengadaanStructureHelper.ResolveActionableTemplateIds(templates.Values);

                    var statusRows = await _db.StatusPengadaan
                        .Where(x => x.ProcurementItemId == procurementItem.Id && x.TemplateNodeId.HasValue)
                        .OrderBy(x => x.Id)
                        .ToListAsync(ct);

                    var actionableRows = statusRows
                        .Where(x => x.TemplateNodeId.HasValue && templates.ContainsKey(x.TemplateNodeId.Value))
                        .Select(x => new
                        {
                            Entity = x,
                            Template = templates[x.TemplateNodeId!.Value]
                        })
                        .Where(x => actionableTemplateIds.Contains(x.Template.Id))
                        .OrderBy(x => x.Template.SortOrder ?? int.MaxValue)
                        .ThenBy(x => x.Entity.Id)
                        .ToList();

                    if (!actionableRows.Any())
                    {
                        return BadRequest("No actionable checklist rows found.");
                    }

                    var targetIndex = actionableRows.FindIndex(x => x.Entity.Id == rowId);
                    if (targetIndex < 0)
                    {
                        return NotFound("Target checklist row not found.");
                    }

                    for (var index = 0; index < actionableRows.Count; index++)
                    {
                        var nextStatus = index <= targetIndex ? "Done" : "Not Yet";
                        actionableRows[index].Entity.Status = nextStatus;
                    }

                    foreach (var row in statusRows)
                    {
                        if (!row.TemplateNodeId.HasValue || !templates.TryGetValue(row.TemplateNodeId.Value, out var template))
                        {
                            continue;
                        }

                        if (!actionableTemplateIds.Contains(template.Id))
                        {
                            row.Status = null;
                        }
                    }

                    await _db.SaveChangesAsync(ct);

                    var refreshedRows = await EnsureStructuredStatusRowsAsync(procurementItem);
                    var currentStatus = ResolveCurrentStatusLabel(refreshedRows);
                    procurementItem.Status_Pengadaan = currentStatus;
                    await _db.SaveChangesAsync(ct);

                    var actionableDtos = refreshedRows
                        .Where(x => x.IsActionable)
                        .OrderBy(x => x.SortOrder ?? int.MaxValue)
                        .ThenBy(x => x.Id)
                        .ToList();

                    var doneCount = actionableDtos.Count(x => string.Equals(x.Status, "Done", StringComparison.OrdinalIgnoreCase));
                    var totalSteps = actionableDtos.Count;
                    var progress = totalSteps == 0
                        ? 0
                        : (int)Math.Round(doneCount / (double)totalSteps * 100);

                    return Ok(new
                    {
                        Message = "Checkpoint applied",
                        Rows = refreshedRows,
                        CurrentStatus = currentStatus,
                        DoneCount = doneCount,
                        TotalSteps = totalSteps,
                        Progress = progress
                    });
                },
                cancellationToken);
        }


        [HttpPost("{type}/{id}")]
        public async Task<IActionResult> CreateWithType(string type, long id, [FromBody] StatusPengadaan? statuspengadaan)
        {
            // Allow empty payloads
            statuspengadaan ??= new StatusPengadaan();

            type = type.ToLower().Trim();

            var sourceType = type switch
            {
                "newprocure" => ProcurementCanonicalHelper.SourceNew,
                "existingprocure" => ProcurementCanonicalHelper.SourceExisting,
                _ => null
            };
            if (sourceType == null)
            {
                return BadRequest("Invalid type. Use 'newprocure' or 'existingprocure'.");
            }

            var item = await _db.ProcurementItems
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.SourceType == sourceType);
            if (item == null)
            {
                return NotFound("Procurement item not found.");
            }

            statuspengadaan.ProcurementItemId = item.Id;
            statuspengadaan.NewID = sourceType == ProcurementCanonicalHelper.SourceNew ? item.Id : null;
            statuspengadaan.ExistingID = sourceType == ProcurementCanonicalHelper.SourceExisting ? item.Id : null;

            if (statuspengadaan.TemplateNodeId.HasValue)
            {
                var template = await _db.StatusPengadaanTemplate
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == statuspengadaan.TemplateNodeId.Value);
                if (template != null)
                {
                    StatusPengadaanStructureHelper.NormalizeTemplateRow(template);
                    statuspengadaan.No = template.No;
                    statuspengadaan.AlurPengadaanIT = template.AlurPengadaanIT;
                    statuspengadaan.DenganDetail = template.DenganDetail;
                    statuspengadaan.Persetujuan = template.Persetujuan;
                }
            }

            // ✅ Optional: Set default values
            statuspengadaan.AlurPengadaanIT ??= "New Step";
            statuspengadaan.Status ??= "-";
            statuspengadaan.ExtraData ??= "{}";

            _db.StatusPengadaan.Add(statuspengadaan);
            await _db.SaveChangesAsync();

            return Ok(statuspengadaan);
        }

        [HttpPost("sync-template/{type}/{id}")]
        public async Task<IActionResult> SyncTemplate(
            string type,
            long id,
            CancellationToken cancellationToken = default)
        {
            return await ExecuteStatusPengadaanRequestAsync(
                async ct =>
                {
                    type = type.ToLower().Trim();
                    var sourceType = type switch
                    {
                        "newprocure" => ProcurementCanonicalHelper.SourceNew,
                        "existingprocure" => ProcurementCanonicalHelper.SourceExisting,
                        _ => null
                    };

                    if (sourceType == null)
                        return BadRequest("Invalid type. Use 'newprocure' or 'existingprocure'.");

                    var item = await _db.ProcurementItems
                        .FirstOrDefaultAsync(x => x.Id == id && x.SourceType == sourceType, ct);
                    if (item == null)
                        return NotFound("Procurement record not found.");

                    var rows = await EnsureStructuredStatusRowsAsync(item, forceNormalizeTemplates: true);
                    return Ok(new
                    {
                        Message = "Template synced",
                        Rows = rows.Count
                    });
                },
                cancellationToken);
        }





        /// <HELPER>
        /// Removes any prefix before ". " in AlurPengadaanIT (e.g., "a. Step" → "Step").
        /// If no ". " exists, returns the original value.
        /// </summary>
        private static string CleanAlurName(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return input;

            // Find ". " pattern (dot followed by space)
            var index = input.IndexOf(". ");
            if (index >= 0 && index + 2 < input.Length)
                return input.Substring(index + 2).Trim();

            return input.Trim();
        }

        private static string ResolveCurrentStatusLabel(IEnumerable<StatusPengadaanReadDto> rows)
        {
            var actionableRows = rows
                .Where(x => x.IsActionable)
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToList();

            if (!actionableRows.Any())
            {
                return "Not Started";
            }

            var anchor = actionableRows.LastOrDefault(x =>
                string.Equals(x.Status, "Done", StringComparison.OrdinalIgnoreCase))
                ?? actionableRows.First();

            var label = ResolveChecklistLeafLabel(anchor);

            label = CleanAlurName(label ?? string.Empty);
            return string.IsNullOrWhiteSpace(label) ? "Not Started" : label;
        }

        private static string ResolveChecklistLeafLabel(StatusPengadaanReadDto row)
        {
            if (!string.IsNullOrWhiteSpace(row.Title))
            {
                return row.Title;
            }

            if (!string.IsNullOrWhiteSpace(row.DenganDetail))
            {
                return row.DenganDetail;
            }

            if (!string.IsNullOrWhiteSpace(row.Persetujuan))
            {
                return row.Persetujuan;
            }

            return row.AlurPengadaanIT ?? string.Empty;
        }

        private async Task<List<StatusPengadaanReadDto>> EnsureStructuredStatusRowsAsync(
            ProcurementItem item,
            bool forceNormalizeTemplates = false)
        {
            await EnsureDefaultTerminasiStepTemplateAsync();

            var templates = await _db.StatusPengadaanTemplate
                .Where(x => x.IsActive && (x.TemplateKey ?? StatusPengadaanStructureHelper.DefaultTemplateKey) == StatusPengadaanStructureHelper.DefaultTemplateKey)
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToListAsync();

            if (!templates.Any())
            {
                return new List<StatusPengadaanReadDto>();
            }

            var templatesChanged = false;
            for (var index = 0; index < templates.Count; index++)
            {
                var template = templates[index];
                var originalTemplateKey = template.TemplateKey;
                var originalNodeType = template.NodeType;
                var originalCode = template.Code;
                var originalTitle = template.Title;
                var originalNo = template.No;
                var originalAlur = template.AlurPengadaanIT;
                var originalSortOrder = template.SortOrder;

                StatusPengadaanStructureHelper.NormalizeTemplateRow(template);
                template.SortOrder ??= (index + 1) * 10;

                if (forceNormalizeTemplates ||
                    !string.Equals(originalTemplateKey, template.TemplateKey, StringComparison.Ordinal) ||
                    !string.Equals(originalNodeType, template.NodeType, StringComparison.Ordinal) ||
                    !string.Equals(originalCode, template.Code, StringComparison.Ordinal) ||
                    !string.Equals(originalTitle, template.Title, StringComparison.Ordinal) ||
                    !string.Equals(originalNo, template.No, StringComparison.Ordinal) ||
                    !string.Equals(originalAlur, template.AlurPengadaanIT, StringComparison.Ordinal) ||
                    originalSortOrder != template.SortOrder)
                {
                    templatesChanged = true;
                }
            }

            var actionableTemplateIds = StatusPengadaanStructureHelper.ResolveActionableTemplateIds(templates);

            var rows = await _db.StatusPengadaan
                .Where(x => x.ProcurementItemId == item.Id)
                .OrderBy(x => x.Id)
                .ToListAsync();

            var rowsChanged = false;

            if (rows.Any() && rows.All(x => !x.TemplateNodeId.HasValue) && rows.Count == templates.Count)
            {
                for (var index = 0; index < rows.Count; index++)
                {
                    rows[index].TemplateNodeId = templates[index].Id;
                    rowsChanged = true;
                }
            }

            foreach (var template in templates)
            {
                var linkedRow = rows.FirstOrDefault(x => x.TemplateNodeId == template.Id);
                if (linkedRow == null)
                {
                    linkedRow = StatusPengadaanStructureHelper.CreateProgressRow(template, item);
                    _db.StatusPengadaan.Add(linkedRow);
                    rows.Add(linkedRow);
                    rowsChanged = true;
                }

                if (!string.Equals(linkedRow.No, template.No, StringComparison.Ordinal) ||
                    !string.Equals(linkedRow.AlurPengadaanIT, template.AlurPengadaanIT, StringComparison.Ordinal) ||
                    !string.Equals(linkedRow.DenganDetail, template.DenganDetail, StringComparison.Ordinal) ||
                    !string.Equals(linkedRow.Persetujuan, template.Persetujuan, StringComparison.Ordinal))
                {
                    linkedRow.No = template.No;
                    linkedRow.AlurPengadaanIT = template.AlurPengadaanIT;
                    linkedRow.DenganDetail = template.DenganDetail;
                    linkedRow.Persetujuan = template.Persetujuan;
                    rowsChanged = true;
                }

                var isActionableTemplate = actionableTemplateIds.Contains(template.Id);

                if (isActionableTemplate)
                {
                    if (string.IsNullOrWhiteSpace(linkedRow.Status))
                    {
                        linkedRow.Status = "Not Yet";
                        rowsChanged = true;
                    }
                }
                else if (!string.IsNullOrWhiteSpace(linkedRow.Status))
                {
                    linkedRow.Status = null;
                    rowsChanged = true;
                }
            }

            if (templatesChanged || rowsChanged)
            {
                await _db.SaveChangesAsync();
            }

            var templateMap = templates.ToDictionary(x => x.Id, x => x);

            return rows
                .Where(x => x.TemplateNodeId.HasValue && templateMap.ContainsKey(x.TemplateNodeId.Value))
                .Select(x =>
                {
                    var template = x.TemplateNodeId.HasValue ? templateMap[x.TemplateNodeId.Value] : null;
                    var isStructuredTemplate = template != null;

                    return new StatusPengadaanReadDto
                    {
                        Id = x.Id,
                        No = x.No,
                        AlurPengadaanIT = x.AlurPengadaanIT,
                        DenganDetail = isStructuredTemplate ? null : x.DenganDetail,
                        Persetujuan = x.Persetujuan,
                        Status = x.Status,
                        TemplateNodeId = x.TemplateNodeId,
                        TemplateKey = template?.TemplateKey,
                        ParentTemplateId = template?.ParentTemplateId,
                        NodeType = template?.NodeType ?? StatusPengadaanStructureHelper.InferNodeType(x.No, x.AlurPengadaanIT),
                        Code = template?.Code,
                        Title = template?.Title,
                        SortOrder = template?.SortOrder,
                        IsActionable = template != null && actionableTemplateIds.Contains(template.Id),
                        ProcurementItemId = x.ProcurementItemId,
                        NewID = x.NewID,
                        ExistingID = x.ExistingID,
                        CreatedAt = x.CreatedAt,
                        UpdatedAt = x.UpdatedAt,
                        ExtraData = string.IsNullOrWhiteSpace(x.ExtraData)
                            ? null
                            : JsonConvert.DeserializeObject<Dictionary<string, object>>(x.ExtraData)
                    };
                })
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToList();
        }

        private async Task EnsureDefaultTerminasiStepTemplateAsync()
        {
            const string terminasiLabel = "Terminasi";
            var defaultTemplateKey = StatusPengadaanStructureHelper.DefaultTemplateKey;

            var exists = await _db.StatusPengadaanTemplate
                .AsNoTracking()
                .AnyAsync(x =>
                    (x.TemplateKey ?? defaultTemplateKey) == defaultTemplateKey &&
                    x.IsActive &&
                    (x.NodeType ?? string.Empty) == StatusPengadaanStructureHelper.NodeStep &&
                    (
                        (x.Code ?? string.Empty) == "8" ||
                        (x.No ?? string.Empty) == "8" ||
                        (x.Title ?? string.Empty).Contains(terminasiLabel) ||
                        (x.AlurPengadaanIT ?? string.Empty).Contains(terminasiLabel)
                    ));

            if (exists)
            {
                return;
            }

            var parentSectionId = await _db.StatusPengadaanTemplate
                .AsNoTracking()
                .Where(x =>
                    (x.TemplateKey ?? defaultTemplateKey) == defaultTemplateKey &&
                    x.IsActive &&
                    (x.NodeType ?? string.Empty) == StatusPengadaanStructureHelper.NodeStep &&
                    x.ParentTemplateId.HasValue)
                .OrderByDescending(x => x.SortOrder ?? int.MaxValue)
                .ThenByDescending(x => x.Id)
                .Select(x => x.ParentTemplateId)
                .FirstOrDefaultAsync();

            if (!parentSectionId.HasValue)
            {
                parentSectionId = await _db.StatusPengadaanTemplate
                    .AsNoTracking()
                    .Where(x =>
                        (x.TemplateKey ?? defaultTemplateKey) == defaultTemplateKey &&
                        x.IsActive &&
                        (x.NodeType ?? string.Empty) == StatusPengadaanStructureHelper.NodeSection)
                    .OrderByDescending(x => x.SortOrder ?? int.MaxValue)
                    .ThenByDescending(x => x.Id)
                    .Select(x => (long?)x.Id)
                    .FirstOrDefaultAsync();
            }

            var nextSortOrder = (await _db.StatusPengadaanTemplate
                .AsNoTracking()
                .Where(x => (x.TemplateKey ?? defaultTemplateKey) == defaultTemplateKey && x.IsActive)
                .Select(x => (int?)(x.SortOrder ?? 0))
                .MaxAsync() ?? 0) + 10;

            var template = new StatusPengadaanTemplate
            {
                TemplateKey = defaultTemplateKey,
                ParentTemplateId = parentSectionId,
                NodeType = StatusPengadaanStructureHelper.NodeStep,
                Code = "8",
                Title = terminasiLabel,
                No = "8",
                AlurPengadaanIT = terminasiLabel,
                SortOrder = nextSortOrder,
                IsActive = true
            };

            StatusPengadaanStructureHelper.NormalizeTemplateRow(template);
            _db.StatusPengadaanTemplate.Add(template);
            await _db.SaveChangesAsync();
        }









    }
}
