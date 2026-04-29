/*
 * PGH-DOC
 * File: Controllers/ImportController.cs
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
using ExcelDataReader;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Drawing;
using PGH.Helpers;
using PGH.Dtos.ImportTable;
using PGH.Models.Audit;
using PGH.Models.Compliance;
using PGH.Models.ImportTable;
using PGH.Models.Procurement;
using System.Collections;
using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Linq.Expressions;
using System.Text.RegularExpressions;

using Twilio.TwiML.Messaging;
using WebApplication2.Data;

namespace refactorbackend.Controllers
{
    [ApiController]
    [Route("api/import")]
    public class ImportController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IMapper _mapper;
        private static readonly Regex RichTextTagRegex = new("</?(b|i|u)>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex ComparableWhitespaceRegex = new(@"\s+", RegexOptions.Compiled);
        private static readonly Lazy<Dictionary<string, Type>> TypesByNameCache =
            new(BuildTypeMap);
        private static readonly Lazy<HashSet<Type>> DbSetEntityTypesCache =
            new(BuildDbSetEntityTypes);
        private static readonly Lazy<IReadOnlyList<string>> SupportedImportTargetNamesCache =
            new(BuildSupportedImportTargetNames);
        private static readonly string[] ListAuditSanitizedStringPropertyNames =
        [
            nameof(ListAudit.TAHUN),
            nameof(ListAudit.NAMAAUDIT),
            nameof(ListAudit.RINGKASANAUDIT),
            nameof(ListAudit.PEMANTAUAN),
            nameof(ListAudit.JENISAUDIT),
            nameof(ListAudit.SOURCE),
            nameof(ListAudit.PICAUDIT),
            nameof(ListAudit.DEPARTMENT),
            nameof(ListAudit.PICAPLIKASI),
            nameof(ListAudit.LINK),
            nameof(ListAudit.STATUS),
            nameof(ListAudit.KETERANGAN)
        ];
        private static readonly string[] ListAuditColumnsOrdered =
        [
            "TAHUN",
            "NAMAAUDIT",
            "RINGKASANAUDIT",
            "PEMANTAUAN",
            "JENISAUDIT",
            "SOURCE",
            "PICAUDIT",
            "DEPARTMENT",
            "PICAPLIKASI",
            "IN",
            "JATUHTEMPO",
            "LINK",
            "STATUS",
            "KETERANGAN",
            "RHA",
            "LHA"
        ];
        private static readonly string[] WeeklyTableColumnsOrdered =
        [
            "Progress",
            "Status",
            "Highlights",
            "WorkInProgress",
            "Target",
            "NextToDo"
        ];
        private static readonly Dictionary<string, string[]> HumanImportColumnsByTarget =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["FTE"] =
                [
                    "NPP",
                    "Nama",
                    "JenjangJabatan",
                    "Posisi",
                    "Department"
                ],
                ["NonFTE"] =
                [
                    "NPP",
                    "Nama",
                    "JenisKelamin",
                    "TanggalLahir",
                    "TanggalJoinBNI",
                    "ManmonthManagedService",
                    "Department",
                    "Role",
                    "Vendor"
                ],
                ["KebutuhanFTE"] =
                [
                    "DIREKTORAT",
                    "KODEJOB",
                    "JOB",
                    "Department",
                    "Existing",
                    "Kebutuhan",
                    "Gap"
                ],
                ["BNU"] =
                [
                    "UsulanTraining",
                    "BulanTahun",
                    "JumlahPerserta",
                    "SentralDesentral",
                    "DivisiDepartment",
                    "Biaya"
                ],
                ["InternalTraining"] =
                [
                    "UsulanTraining",
                    "Start",
                    "End",
                    "JumlahPerserta",
                    "DivisiDepartment",
                    "Fasilitator",
                    "Biaya"
                ],
                ["KompetensiPegawai"] =
                [
                    "NPP",
                    "Nama",
                    "Department",
                    "JudulTraining",
                    "TahunPelaksanaan",
                    "SertifikasiNonSerifikasi"
                ]
            };
        private static readonly Dictionary<string, string> HumanImportColumnLabels =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["NPP"] = "NPP",
                ["Nama"] = "Nama",
                ["JenjangJabatan"] = "Jenjang Jabatan",
                ["Posisi"] = "Posisi",
                ["Department"] = "Department",
                ["JenisKelamin"] = "Jenis Kelamin",
                ["TanggalLahir"] = "Tanggal Lahir",
                ["TanggalJoinBNI"] = "Tanggal Join BNI",
                ["ManmonthManagedService"] = "Manmonth Managed Service",
                ["Role"] = "Role",
                ["Vendor"] = "Vendor",
                ["DIREKTORAT"] = "Direktorat",
                ["KODEJOB"] = "Kode Job",
                ["JOB"] = "Job",
                ["Existing"] = "Existing",
                ["Kebutuhan"] = "Kebutuhan",
                ["Gap"] = "Gap",
                ["UsulanTraining"] = "Usulan Training",
                ["BulanTahun"] = "Bulan/Tahun",
                ["JumlahPerserta"] = "Jumlah Peserta",
                ["SentralDesentral"] = "Sentral/Desentral",
                ["DivisiDepartment"] = "Divisi/Department",
                ["Fasilitator"] = "Fasilitator",
                ["Biaya"] = "Biaya",
                ["JudulTraining"] = "Judul Training",
                ["TahunPelaksanaan"] = "Tahun Pelaksanaan",
                ["SertifikasiNonSerifikasi"] = "Sertifikasi/Non-Sertifikasi"
            };
        private static readonly Dictionary<string, Dictionary<string, string>> HumanImportHeaderAliasesByTarget =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["BNU"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["JUMLAHPESERTA"] = "JumlahPerserta"
                },
                ["InternalTraining"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["JUMLAHPESERTA"] = "JumlahPerserta"
                },
                ["KompetensiPegawai"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["SERTIFIKASINONSERTIFIKASI"] = "SertifikasiNonSerifikasi"
                }
            };
        private static readonly HashSet<string> WeeklyTableAllowedColumns =
            new(WeeklyTableColumnsOrdered, StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> WeeklyTableManagedHeaderTokens =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "ID",
                "WEEKLYPERIODID",
                "WEEKLYTABLEINSTANCEID",
                "LOGICALROWKEY",
                "CREATEDAT",
                "UPDATEDAT",
                "EXTRADATA"
            };
        private static readonly string[] ProcurementColumnsOrdered =
        [
            "Department",
            "PIC",
            "Vendor",
            "TipePengadaan",
            "Perjanjian",
            "NilaiPengajuanAPS",
            "NilaiApproveSTA",
            "NilaiKontrak",
            "JenisAnggaran",
            "NoPKS",
            "TglPKS",
            "NoSPK",
            "TglSPK",
            "WaktuMulai",
            "JatuhTempo",
            "PICPFA",
            "TglKirimkePFA",
            "Keterangan"
        ];
        private static readonly string[] ProcurementBusinessCompareColumns =
        [
            "Department",
            "PIC",
            "Vendor",
            "TipePengadaan",
            "Perjanjian",
            "NilaiPengajuanAPS",
            "NilaiApproveSTA",
            "NilaiKontrak",
            "JenisAnggaran",
            "NoPKS",
            "TglPKS",
            "NoSPK",
            "TglSPK",
            "WaktuMulai",
            "JatuhTempo",
            "PICPFA",
            "TglKirimkePFA",
            "Keterangan"
        ];
        private static readonly HashSet<string> ListAuditAllowedColumns =
            new(ListAuditColumnsOrdered, StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, string> WeeklyTableColumnLabels =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["Progress"] = "Progress",
                ["Status"] = "Status",
                ["Highlights"] = "Highlights",
                ["WorkInProgress"] = "Work In Progress",
                ["Target"] = "Target",
                ["NextToDo"] = "Next To Do"
            };
        private static readonly Dictionary<string, string> WeeklyStatusProgressMap =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["Open"] = "0%",
                ["Analisa / Review"] = "17%",
                ["Koordinasi"] = "33%",
                ["Diskusi / Meeting"] = "50%",
                ["Collection"] = "67%",
                ["Validation"] = "83%",
                ["Done"] = "100%"
            };
        private static readonly List<PropertyInfo> WeeklyTableBusinessCompareProperties =
            typeof(PGH.Models.Compliance.WeeklyTable)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(prop => WeeklyTableAllowedColumns.Contains(prop.Name))
                .Where(prop => prop.CanRead && prop.CanWrite)
                .ToList();
        private static readonly List<PropertyInfo> ListAuditBusinessCompareProperties =
            typeof(ListAudit)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(prop => ListAuditAllowedColumns.Contains(prop.Name))
                .Where(prop =>
                    !prop.Name.Equals("RHA", StringComparison.OrdinalIgnoreCase) &&
                    !prop.Name.Equals("LHA", StringComparison.OrdinalIgnoreCase))
                .Where(prop => prop.CanRead && prop.CanWrite)
                .ToList();
        private static readonly Dictionary<string, string> ListAuditColumnLabels =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["TAHUN"] = "Tahun",
                ["NAMAAUDIT"] = "Nama Audit",
                ["RINGKASANAUDIT"] = "Ringkasan Audit",
                ["PEMANTAUAN"] = "Pemantauan",
                ["JENISAUDIT"] = "Jenis Audit",
                ["SOURCE"] = "Source",
                ["PICAUDIT"] = "PIC Audit",
                ["DEPARTMENT"] = "Department",
                ["PICAPLIKASI"] = "PIC Aplikasi",
                ["IN"] = "IN",
                ["JATUHTEMPO"] = "Jatuh Tempo",
                ["LINK"] = "Link",
                ["STATUS"] = "Status",
                ["KETERANGAN"] = "Keterangan",
                ["RHA"] = "RHA",
                ["LHA"] = "LHA"
            };
        private static readonly HashSet<string> ListAuditManagedHeaderTokens =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "CREATEDAT",
                "UPDATEDAT"
            };
        private static readonly HashSet<string> ListAuditIgnoredHeaderTokens =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "NO",
                "NOMOR"
            };
        private static readonly HashSet<string> ListAuditManagedPropertyNames =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "CreatedAt",
                "UpdatedAt"
            };
        private static readonly Dictionary<string, string> ListAuditHeaderAliases =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["TAHUN"] = "TAHUN",
                ["NAMAAUDIT"] = "NAMAAUDIT",
                ["RINGKASANAUDIT"] = "RINGKASANAUDIT",
                ["PEMANTAUAN"] = "PEMANTAUAN",
                ["JENISAUDIT"] = "JENISAUDIT",
                ["SOURCE"] = "SOURCE",
                ["SUMBERAUDIT"] = "SOURCE",
                ["PICAUDIT"] = "PICAUDIT",
                ["DEPARTMENT"] = "DEPARTMENT",
                ["DEPARTEMENT"] = "DEPARTMENT",
                ["DEPARTEMEN"] = "DEPARTMENT",
                ["PICAPLIKASI"] = "PICAPLIKASI",
                ["IN"] = "IN",
                ["TANGGALMULAI"] = "IN",
                ["JATUHTEMPO"] = "JATUHTEMPO",
                ["LINK"] = "LINK",
                ["STATUS"] = "STATUS",
                ["STATUSAUDIT"] = "STATUS",
                ["KETERANGAN"] = "KETERANGAN",
                ["RHA"] = "RHA",
                ["LHA"] = "LHA"
            };

        public ImportController(AppDbContext db, IMapper mapper)
        {
            _db = db;
            _mapper = mapper;
        }

        private IActionResult? EnsureTableAccess(string? tableName)
        {
            var targetStream = FeatureAccessResolver.ResolveStreamForTable(tableName);
            if (FeatureAccessResolver.CanAccessRequestedStream(User, targetStream))
            {
                return null;
            }

            return StatusCode(403, new { message = "Table access is not allowed for this stream." });
        }

        private IActionResult? EnsureImportSessionAccess(ImportSession session) =>
            EnsureTableAccess(session.TargetTable);

        private static string SanitizeHeader(string header)
        {
            if (string.IsNullOrWhiteSpace(header)) return string.Empty;
            var cleaned = new string(header.Where(char.IsLetterOrDigit).ToArray());
            return cleaned.Trim();
        }

        private static bool IsListAuditTarget(string? target) =>
            string.Equals(target, "ListAudit", StringComparison.OrdinalIgnoreCase);

        private static bool IsProcurementProcureTarget(string? target) =>
            string.Equals(target, "NewProcure", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(target, "ExistingProcure", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(target, "AllProcure", StringComparison.OrdinalIgnoreCase);

        private static Type EnsureResolvedType(Type? candidate, string typeRole, string? target) =>
            candidate ?? throw new InvalidOperationException(
                $"Resolved {typeRole} type is missing for target '{target ?? "(null)"}'.");

        private static string? ResolveDefaultUpsertKey(string? target)
        {
            if (string.Equals(target, "FTE", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(target, "NonFTE", StringComparison.OrdinalIgnoreCase))
            {
                return "NPP";
            }

            if (string.Equals(target, "KebutuhanFTE", StringComparison.OrdinalIgnoreCase))
            {
                return "KODEJOB";
            }

            if (string.Equals(target, "BNU", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(target, "InternalTraining", StringComparison.OrdinalIgnoreCase))
            {
                return "UsulanTraining";
            }

            if (string.Equals(target, "KompetensiPegawai", StringComparison.OrdinalIgnoreCase))
            {
                return "NPP";
            }

            return null;
        }

        private static bool IsWeeklyTableTarget(string? target) =>
            string.Equals(target, "WeeklyTable", StringComparison.OrdinalIgnoreCase);

        private static bool IsHumanStrictImportTarget(string? target) =>
            !string.IsNullOrWhiteSpace(target) &&
            HumanImportColumnsByTarget.ContainsKey(target);

        private static bool ShouldPreferLatestProcurementHeaderMatch(string normalizedColumn) =>
            string.Equals(
                normalizedColumn,
                nameof(ProcurementItem.Keterangan),
                StringComparison.OrdinalIgnoreCase);

        private static string NormalizeHeaderToken(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            return new string(value.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        }

        private static string NormalizeHeaderForTarget(string target, string header)
        {
            if (IsProcurementProcureTarget(target))
            {
                var procurementCanonical = ProcurementCanonicalHelper.ResolveCanonicalFieldName(header);
                if (string.IsNullOrWhiteSpace(procurementCanonical) || string.Equals(procurementCanonical, header.Trim(), StringComparison.Ordinal))
                {
                    var sanitized = SanitizeHeader(header);
                    procurementCanonical = ProcurementCanonicalHelper.ResolveCanonicalFieldName(sanitized);
                }

                if (string.IsNullOrWhiteSpace(procurementCanonical))
                {
                    return string.Empty;
                }

                if (ProcurementCanonicalHelper.IsProtectedField(procurementCanonical))
                {
                    return string.Empty;
                }

                return procurementCanonical;
            }

            if (HumanImportColumnsByTarget.TryGetValue(target, out var humanColumns))
            {
                var humanToken = NormalizeHeaderToken(header);
                if (string.IsNullOrWhiteSpace(humanToken))
                {
                    return string.Empty;
                }

                var directMatch = humanColumns.FirstOrDefault(column =>
                    string.Equals(NormalizeHeaderToken(column), humanToken, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrWhiteSpace(directMatch))
                {
                    return directMatch;
                }

                var labelMatch = humanColumns.FirstOrDefault(column =>
                    HumanImportColumnLabels.TryGetValue(column, out var label) &&
                    string.Equals(NormalizeHeaderToken(label), humanToken, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrWhiteSpace(labelMatch))
                {
                    return labelMatch;
                }

                if (HumanImportHeaderAliasesByTarget.TryGetValue(target, out var aliasMap) &&
                    aliasMap.TryGetValue(humanToken, out var aliasedColumn))
                {
                    return aliasedColumn;
                }

                return SanitizeHeader(header);
            }

            if (!IsListAuditTarget(target))
            {
                return SanitizeHeader(header);
            }

            var token = NormalizeHeaderToken(header);
            if (ListAuditIgnoredHeaderTokens.Contains(token))
            {
                return string.Empty;
            }

            return ListAuditHeaderAliases.TryGetValue(token, out var canonical)
                ? canonical
                : token;
        }

        private static bool IsListAuditEvidenceColumn(string? column) =>
            string.Equals(column, "RHA", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(column, "LHA", StringComparison.OrdinalIgnoreCase);

        private static bool ContainsListAuditEvidenceColumn(IEnumerable<string> headers) =>
            headers.Any(IsListAuditEvidenceColumn);

        private static string GetListAuditManagedColumnName(string rawValue)
        {
            var token = NormalizeHeaderToken(rawValue);
            return token switch
            {
                "CREATEDAT" => "CreatedAt",
                "UPDATEDAT" => "UpdatedAt",
                _ => rawValue.Trim()
            };
        }

        private static string GetImportSessionFilePath(ImportSession session) =>
            Path.Combine("import-temp", session.ImportId + "_" + session.FileName);

        private static bool IsOpenXmlWorkbook(string? fileName)
        {
            var ext = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
            return ext is ".xlsx";
        }

        private static ExcelWorksheet ResolveImportWorksheet(ExcelPackage package, string? sheetName)
        {
            if (!string.IsNullOrWhiteSpace(sheetName))
            {
                var worksheet = package.Workbook.Worksheets
                    .FirstOrDefault(x => string.Equals(x.Name, sheetName, StringComparison.OrdinalIgnoreCase));

                return worksheet ?? throw new InvalidOperationException($"Sheet '{sheetName}' not found in workbook.");
            }

            if (package.Workbook.Worksheets.Count != 1)
            {
                throw new InvalidOperationException(
                    "SheetName is required for ListAudit evidence import when workbook contains multiple sheets.");
            }

            return package.Workbook.Worksheets.First();
        }

        private static List<int> GetNonEmptyWorksheetRows(ExcelWorksheet worksheet)
        {
            var result = new List<int>();
            if (worksheet.Dimension == null)
            {
                return result;
            }

            for (int row = worksheet.Dimension.Start.Row; row <= worksheet.Dimension.End.Row; row++)
            {
                var hasCellValue = false;
                for (int col = worksheet.Dimension.Start.Column; col <= worksheet.Dimension.End.Column; col++)
                {
                    if (!string.IsNullOrWhiteSpace(worksheet.Cells[row, col].Text))
                    {
                        hasCellValue = true;
                        break;
                    }
                }

                var hasPicture = worksheet.Drawings
                    .OfType<ExcelPicture>()
                    .Any(d => d.From.Row + 1 == row);

                if (hasCellValue || hasPicture)
                {
                    result.Add(row);
                }
            }

            return result;
        }

        private static byte[]? GetExcelPictureBytes(ExcelPicture picture)
        {
            var bytes = picture.Image.ImageBytes;
            return bytes is { Length: > 0 } ? bytes : null;
        }

        private static Dictionary<int, Dictionary<string, byte[]>> ExtractListAuditEvidenceMap(
            string filePath,
            string? sheetName,
            IReadOnlyList<string> headers,
            IReadOnlyList<ImportData> dataRows)
        {
            var result = new Dictionary<int, Dictionary<string, byte[]>>();
            if (headers.Count == 0 || dataRows.Count == 0)
            {
                return result;
            }

            var evidenceColumns = headers
                .Select((header, index) => new { header, index })
                .Where(x => IsListAuditEvidenceColumn(x.header))
                .ToDictionary(x => x.index + 1, x => x.header, EqualityComparer<int>.Default);

            if (evidenceColumns.Count == 0)
            {
                return result;
            }

            using var package = new ExcelPackage(new FileInfo(filePath));
            var worksheet = ResolveImportWorksheet(package, sheetName);
            var nonEmptyRows = GetNonEmptyWorksheetRows(worksheet);
            if (nonEmptyRows.Count == 0)
            {
                return result;
            }

            var actualRowByStagedRow = nonEmptyRows
                .Select((actualRow, stagedIndex) => new { actualRow, stagedRow = stagedIndex + 1 })
                .ToDictionary(x => x.stagedRow, x => x.actualRow);

            var dataRowNumbers = dataRows
                .Select(x => x.RowNumber)
                .ToHashSet();

            var stagedRowByActualRow = actualRowByStagedRow
                .Where(x => dataRowNumbers.Contains(x.Key))
                .ToDictionary(x => x.Value, x => x.Key);

            foreach (var picture in worksheet.Drawings.OfType<ExcelPicture>())
            {
                var actualRow = picture.From.Row + 1;
                var actualCol = picture.From.Column + 1;

                if (!stagedRowByActualRow.TryGetValue(actualRow, out var stagedRow))
                {
                    continue;
                }

                if (!evidenceColumns.TryGetValue(actualCol, out var column))
                {
                    continue;
                }

                var imageBytes = GetExcelPictureBytes(picture);
                if (imageBytes == null || imageBytes.Length == 0)
                {
                    continue;
                }

                if (!result.TryGetValue(stagedRow, out var rowMap))
                {
                    rowMap = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
                    result[stagedRow] = rowMap;
                }

                rowMap[column] = imageBytes;
            }

            return result;
        }

        private static void IgnoreEmptyListAuditColumns(List<string> headers, List<ImportData> rows)
        {
            for (int i = 0; i < headers.Count; i++)
            {
                if (!headers[i].StartsWith("__EMPTY_", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var hasValue = rows.Any(row =>
                {
                    var values = ImportHeaderHelper.DeserializeRowValues(row);
                    return i < values.Count &&
                           !string.IsNullOrWhiteSpace(values[i]);
                });

                if (!hasValue)
                {
                    headers[i] = string.Empty;
                }
            }
        }

        private static IReadOnlyList<string> GetExpectedImportColumns(string target)
        {
            if (IsListAuditTarget(target))
            {
                return ListAuditColumnsOrdered;
            }

            if (IsWeeklyTableTarget(target))
            {
                return WeeklyTableColumnsOrdered;
            }

            if (IsProcurementProcureTarget(target))
            {
                return ProcurementColumnsOrdered;
            }

            if (HumanImportColumnsByTarget.TryGetValue(target, out var humanColumns))
            {
                return humanColumns;
            }

            var dtoType = ResolveType($"{target}CreateDto");
            if (dtoType == null)
            {
                return Array.Empty<string>();
            }

            return dtoType
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(p => p.CanRead && p.CanWrite)
                .Where(p => !p.Name.Equals("Id", StringComparison.OrdinalIgnoreCase))
                .Where(p => !p.Name.Equals("ExtraData", StringComparison.OrdinalIgnoreCase))
                .Where(p => !p.Name.Equals("CreatedAt", StringComparison.OrdinalIgnoreCase))
                .Where(p => !p.Name.Equals("UpdatedAt", StringComparison.OrdinalIgnoreCase))
                .Where(p => !IsProcurementProcureTarget(target) || !p.Name.Equals("No", StringComparison.OrdinalIgnoreCase))
                .Where(p => !IsProcurementProcureTarget(target) || !p.Name.Equals("project_id", StringComparison.OrdinalIgnoreCase))
                .Where(p => !IsProcurementProcureTarget(target) || !p.Name.Equals("SisaBulan", StringComparison.OrdinalIgnoreCase))
                .Select(p => p.Name)
                .ToList();
        }

        private static string GetImportColumnLabel(string target, string column)
        {
            if (IsListAuditTarget(target) && ListAuditColumnLabels.TryGetValue(column, out var label))
            {
                return label;
            }

            if (IsWeeklyTableTarget(target) && WeeklyTableColumnLabels.TryGetValue(column, out var weeklyLabel))
            {
                return weeklyLabel;
            }

            if (HumanImportColumnsByTarget.ContainsKey(target) &&
                HumanImportColumnLabels.TryGetValue(column, out var humanLabel))
            {
                return humanLabel;
            }

            return column;
        }

        private static object? GetFixedFieldValue(
            IReadOnlyDictionary<string, object>? fixedFields,
            string key)
        {
            if (fixedFields == null || fixedFields.Count == 0)
            {
                return null;
            }

            foreach (var entry in fixedFields)
            {
                if (string.Equals(entry.Key, key, StringComparison.OrdinalIgnoreCase))
                {
                    return entry.Value;
                }
            }

            return null;
        }

        private static long? TryConvertToLong(object? value)
        {
            if (value == null)
            {
                return null;
            }

            try
            {
                var text = Convert.ToString(value, CultureInfo.InvariantCulture);
                return long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
                    ? parsed
                    : null;
            }
            catch
            {
                return null;
            }
        }

        private async Task<Dictionary<string, object>?> NormalizeFixedFieldsForTargetAsync(
            string target,
            Dictionary<string, object>? fixedFields)
        {
            if (!IsWeeklyTableTarget(target))
            {
                return fixedFields == null || fixedFields.Count == 0
                    ? fixedFields
                    : new Dictionary<string, object>(fixedFields, StringComparer.OrdinalIgnoreCase);
            }

            var normalized = fixedFields == null || fixedFields.Count == 0
                ? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, object>(fixedFields, StringComparer.OrdinalIgnoreCase);

            var weeklyTableInstanceId = TryConvertToLong(
                GetFixedFieldValue(normalized, "WeeklyTableInstanceId"));
            var weeklyPeriodId = TryConvertToLong(
                GetFixedFieldValue(normalized, "WeeklyPeriodId"));

            if (weeklyTableInstanceId is > 0)
            {
                var tableInstance = await _db.WeeklyTableInstances
                    .AsNoTracking()
                    .Where(item => item.Id == weeklyTableInstanceId.Value)
                    .Select(item => new { item.Id, item.WeeklyPeriodId })
                    .FirstOrDefaultAsync();

                if (tableInstance != null)
                {
                    normalized["WeeklyTableInstanceId"] = tableInstance.Id;
                    if (tableInstance.WeeklyPeriodId.HasValue)
                    {
                        normalized["WeeklyPeriodId"] = tableInstance.WeeklyPeriodId.Value;
                    }

                    return normalized;
                }
            }

            var fallbackScope = await ResolveWeeklyImportScopeAsync(weeklyPeriodId);
            if (fallbackScope == null)
            {
                return normalized.Count == 0 ? null : normalized;
            }

            normalized["WeeklyTableInstanceId"] = fallbackScope.Value.TableId;
            normalized["WeeklyPeriodId"] = fallbackScope.Value.PeriodId;
            return normalized;
        }

        private async Task<(long TableId, long PeriodId)?> ResolveWeeklyImportScopeAsync(long? requestedPeriodId)
        {
            if (requestedPeriodId is > 0)
            {
                var scopedTable = await _db.WeeklyTableInstances
                    .AsNoTracking()
                    .Where(item => item.WeeklyPeriodId == requestedPeriodId.Value)
                    .OrderByDescending(item => item.IsDefault)
                    .ThenBy(item => item.CreatedAt)
                    .ThenBy(item => item.Id)
                    .Select(item => new { item.Id, item.WeeklyPeriodId })
                    .FirstOrDefaultAsync();

                if (scopedTable?.WeeklyPeriodId is > 0)
                {
                    return (scopedTable.Id, scopedTable.WeeklyPeriodId.Value);
                }
            }

            var today = DateTime.Today;
            var currentYear = ISOWeek.GetYear(today);
            var currentWeek = ISOWeek.GetWeekOfYear(today);

            var fallbackTable = await (
                from table in _db.WeeklyTableInstances.AsNoTracking()
                join period in _db.WeeklyPeriods.AsNoTracking()
                    on table.WeeklyPeriodId equals period.Id
                where !period.IsLegacy
                orderby
                    period.Year == currentYear && period.WeekNumber == currentWeek descending,
                    period.WeekStartDate descending,
                    period.UpdatedAt descending,
                    period.CreatedAt descending,
                    table.IsDefault descending,
                    table.CreatedAt,
                    table.Id
                select new
                {
                    table.Id,
                    table.WeeklyPeriodId
                })
                .FirstOrDefaultAsync();

            if (fallbackTable?.WeeklyPeriodId is > 0)
            {
                return (fallbackTable.Id, fallbackTable.WeeklyPeriodId.Value);
            }

            return null;
        }

        private static bool ColumnHasAnyCellValue(List<ImportData> rows, int columnIndex)
        {
            foreach (var row in rows)
            {
                var values = ImportHeaderHelper.DeserializeRowValues(row);
                if (columnIndex >= values.Count)
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(values[columnIndex]))
                {
                    return true;
                }
            }

            return false;
        }

        private Task<Dictionary<string, bool>> DetectListAuditEvidencePresenceAsync(
            ImportSession session,
            string? sheetName,
            IReadOnlyList<string> headers,
            IReadOnlyList<ImportData> dataRows)
        {
            var result = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
            {
                ["RHA"] = false,
                ["LHA"] = false
            };

            if (!ContainsListAuditEvidenceColumn(headers))
            {
                return Task.FromResult(result);
            }

            var filePath = GetImportSessionFilePath(session);
            if (!System.IO.File.Exists(filePath) || !IsOpenXmlWorkbook(session.FileName))
            {
                return Task.FromResult(result);
            }

            var evidenceMap = ExtractListAuditEvidenceMap(filePath, sheetName, headers, dataRows);
            foreach (var rowMap in evidenceMap.Values)
            {
                if (rowMap.TryGetValue("RHA", out var rhaBytes) && rhaBytes.Length > 0)
                {
                    result["RHA"] = true;
                }

                if (rowMap.TryGetValue("LHA", out var lhaBytes) && lhaBytes.Length > 0)
                {
                    result["LHA"] = true;
                }
            }

            return Task.FromResult(result);
        }

        private IActionResult? ValidateHeadersForTarget(string target, List<string> headers)
        {
            if (IsWeeklyTableTarget(target))
            {
                var weeklyManagedHeaders = headers
                    .Where(h => !string.IsNullOrWhiteSpace(h) && WeeklyTableManagedHeaderTokens.Contains(NormalizeHeaderToken(h)))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(x => x)
                    .ToList();

                if (weeklyManagedHeaders.Count > 0)
                {
                    return BadRequest(new
                    {
                        message = "WeeklyTable import cannot accept managed columns.",
                        blockedHeaders = weeklyManagedHeaders
                    });
                }

                var weeklyUnknownHeaders = headers
                    .Where(h => !string.IsNullOrWhiteSpace(h) && !WeeklyTableAllowedColumns.Contains(h))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(x => x)
                    .ToList();

                if (weeklyUnknownHeaders.Count > 0)
                {
                    return BadRequest(new
                    {
                        message = "WeeklyTable import contains unknown headers.",
                        unknownHeaders = weeklyUnknownHeaders,
                        allowedHeaders = WeeklyTableColumnsOrdered
                    });
                }

                var weeklyDuplicateHeaders = headers
                    .Where(h => !string.IsNullOrWhiteSpace(h))
                    .GroupBy(h => h, StringComparer.OrdinalIgnoreCase)
                    .Where(g => g.Count() > 1)
                    .Select(g => g.Key)
                    .OrderBy(x => x)
                    .ToList();

                if (weeklyDuplicateHeaders.Count > 0)
                {
                    return BadRequest(new
                    {
                        message = "WeeklyTable import contains duplicate headers after normalization.",
                        duplicateHeaders = weeklyDuplicateHeaders
                    });
                }

                return null;
            }

            if (!IsListAuditTarget(target))
            {
                return null;
            }

            var managedHeaders = headers
                .Where(h => !string.IsNullOrWhiteSpace(h) && ListAuditManagedHeaderTokens.Contains(h))
                .Select(GetListAuditManagedColumnName)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .ToList();

            if (managedHeaders.Count > 0)
            {
                return BadRequest(new
                {
                    message = "ListAudit import cannot accept managed columns.",
                    blockedHeaders = managedHeaders
                });
            }

            var unknownHeaders = headers
                .Where(h => !string.IsNullOrWhiteSpace(h) && !ListAuditAllowedColumns.Contains(h))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .ToList();

            if (unknownHeaders.Count > 0)
            {
                return BadRequest(new
                {
                    message = "ListAudit import contains unknown headers.",
                    unknownHeaders,
                    allowedHeaders = ListAuditColumnsOrdered
                });
            }

            var duplicateHeaders = headers
                .Where(h => !string.IsNullOrWhiteSpace(h))
                .GroupBy(h => h, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .OrderBy(x => x)
                .ToList();

            if (duplicateHeaders.Count > 0)
            {
                return BadRequest(new
                {
                    message = "ListAudit import contains duplicate headers after alias normalization.",
                    duplicateHeaders
                });
            }

            return null;
        }

        private IActionResult? ValidateFixedFieldsForTarget(string target, Dictionary<string, object>? fixedFields)
        {
            if (!IsListAuditTarget(target) || fixedFields == null || fixedFields.Count == 0)
            {
                return null;
            }

            var blockedFields = fixedFields.Keys
                .Where(k => !string.IsNullOrWhiteSpace(k) && ListAuditManagedPropertyNames.Contains(k))
                .Select(GetListAuditManagedColumnName)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .ToList();

            if (blockedFields.Count == 0)
            {
                return null;
            }

            return BadRequest(new
            {
                message = "ListAudit import cannot rewrite managed metadata fields.",
                blockedFields
            });
        }

        private static bool HasDbSetForEntity(Type entityType) =>
            DbSetEntityTypesCache.Value.Contains(entityType);

        [HttpGet("columns/{tableName}")]
        public async Task<IActionResult> GetColumns(
     string tableName,
     [FromQuery] bool extraData = false
 )
        {
            if (string.IsNullOrWhiteSpace(tableName))
                return BadRequest("Invalid table name.");

            var tableAccess = EnsureTableAccess(tableName);
            if (tableAccess != null)
                return tableAccess;

            if (IsProcurementProcureTarget(tableName.Trim()))
            {
                return Ok(ProcurementColumnsOrdered);
            }

            // Sanitize input (prevent SQL injection)
            var safeTable = tableName
                .Replace("[", "")
                .Replace("]", "")
                .Replace(";", "")
                .Trim();

            // 1️⃣ Find the schema dynamically
            var schemaSql = @"
        SELECT TABLE_SCHEMA AS Value
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = @name
    ";

            var schema = await _db.Database
                .SqlQueryRaw<string>(schemaSql, new SqlParameter("@name", safeTable))
                .FirstOrDefaultAsync();

            if (schema == null)
                return BadRequest($"Table '{safeTable}' not found in any schema.");

            // 2️⃣ Load physical columns
            var physicalColumnsSql = @"
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @table AND TABLE_SCHEMA = @schema
        ORDER BY ORDINAL_POSITION
    ";

            var columns = await _db.Database.SqlQueryRaw<string>(
                physicalColumnsSql,
                new SqlParameter("@table", safeTable),
                new SqlParameter("@schema", schema)
            ).ToListAsync();

            // 3️⃣ Detect ExtraData column
            var hasExtraData = columns
                .Any(c => c.Equals("ExtraData", StringComparison.OrdinalIgnoreCase));

            // ✅ MINIMAL FIX: respect query flag
            if (!hasExtraData || !extraData)
            {
                columns.RemoveAll(c => c.Equals("ExtraData", StringComparison.OrdinalIgnoreCase));

                if (IsListAuditTarget(safeTable))
                {
                    return Ok(ListAuditColumnsOrdered);
                }

                if (IsWeeklyTableTarget(safeTable))
                {
                    return Ok(WeeklyTableColumnsOrdered);
                }

                if (IsProcurementProcureTarget(safeTable))
                {
                    return Ok(ProcurementColumnsOrdered);
                }

                return Ok(columns);
            }

            // 4️⃣ Read ExtraData JSON keys (only when requested)
            var extraSql = $@"
        SELECT ExtraData AS Value
        FROM [{schema}].[{safeTable}]
        WHERE ExtraData IS NOT NULL
    ";

            var extraRows = await _db.Database
                .SqlQueryRaw<string>(extraSql)
                .ToListAsync();

            var jsonKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in extraRows)
            {
                try
                {
                    if (string.IsNullOrWhiteSpace(row)) continue;

                    var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(row);
                    if (dict == null) continue;

                    foreach (var key in dict.Keys)
                        jsonKeys.Add(key);
                }
                catch
                {
                    // Ignore malformed JSON
                }
            }

            // Remove physical ExtraData column
            columns.RemoveAll(c => c.Equals("ExtraData", StringComparison.OrdinalIgnoreCase));

            // Add JSON keys as virtual columns
            columns.AddRange(jsonKeys.OrderBy(x => x));

            if (IsListAuditTarget(safeTable))
            {
                return Ok(ListAuditColumnsOrdered);
            }

            if (IsWeeklyTableTarget(safeTable))
            {
                return Ok(WeeklyTableColumnsOrdered);
            }

            if (IsProcurementProcureTarget(safeTable))
            {
                return Ok(ProcurementColumnsOrdered);
            }

            return Ok(columns);
        }




        // =====================================
        // STEP 1: Upload Excel → Stage in DB
        [HttpPost("{target}")]
        [RequestSizeLimit(UploadLimitHelper.GenericImportMaxRequestBytes)]
        public async Task<IActionResult> Import(string target, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("File is required.");

            if (file.Length > UploadLimitHelper.GenericImportMaxFileBytes)
                return BadRequest($"Ukuran file import maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.GenericImportMaxFileBytes)}.");

            if (!IsOpenXmlWorkbook(file.FileName))
                return BadRequest(new
                {
                    message = "Import only supports .xlsx files."
                });

            var tableAccess = EnsureTableAccess(target);
            if (tableAccess != null)
                return tableAccess;

            var session = new ImportSession
            {
                TargetTable = target,
                UploadedBy = "System",
                UploadedAt = DateTime.UtcNow,
                FileName = file.FileName,
                Status = "Processing",
                ErrorCount = 0
            };

            _db.ImportSession.Add(session);
            await _db.SaveChangesAsync();

            // ⭐ SAVE UPLOADED FILE TO TEMP
            var folder = "import-temp";
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            var storedPath = Path.Combine(folder, session.ImportId + "_" + file.FileName);
            using (var fs = new FileStream(storedPath, FileMode.Create))
            {
                await file.CopyToAsync(fs);
            }

            try
            {
                System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

                // ⭐ NOW READ FROM SAVED FILE, NOT FROM request stream
                using var stream = System.IO.File.OpenRead(storedPath);
                using var reader = ExcelReaderFactory.CreateReader(stream);

               
                var staged = new List<ImportData>();

                int sheetIndex = 0;

                do
                {
                    var sheetName = reader.Name;
                    int rowNumber = 0;

                    while (reader.Read())
                    {
                        var rowValues = new List<string>();
                        for (int i = 0; i < reader.FieldCount; i++)
                            rowValues.Add(reader.GetValue(i)?.ToString()?.Trim() ?? string.Empty);

                        // 🔥 SKIP COMPLETELY EMPTY ROWS
                        if (rowValues.All(v => string.IsNullOrWhiteSpace(v)))
                            continue;

                        rowNumber++;

                        staged.Add(new ImportData
                        {
                            ImportId = session.ImportId,
                            SheetName = sheetName,
                            SheetIndex = sheetIndex,
                            RowNumber = rowNumber,
                            Data = JsonSerializer.Serialize(rowValues),
                            IsValid = true
                        });
                    }


                    sheetIndex++;

                } while (reader.NextResult());


                await _db.ImportData.AddRangeAsync(staged);
                session.Status = "Completed";
                await _db.SaveChangesAsync();

                return Ok(new
                {
                    message = $"{target} imported successfully with {staged.Count} rows.",
                    importId = session.ImportId,
                    target,
                    rowCount = staged.Count
                });
            }
            catch (Exception ex)
            {
                session.Status = "Failed";
                session.ErrorCount = 1;
                await _db.SaveChangesAsync();
                return StatusCode(500, $"Import failed: {ex.Message}");
            }
        }


        // =====================================
        // STEP 2: Promote Staged → Real Table
        // =====================================
        [HttpPost("promote/{target}/{importId}")]
        public async Task<IActionResult> PromoteToReal(
     string target,
     int importId,
     [FromQuery] string? mode,
     [FromBody] HeaderMapDto? body
 )
        {
            var tableAccess = EnsureTableAccess(target);
            if (tableAccess != null)
                return tableAccess;

            var session = await _db.ImportSession
                .FirstOrDefaultAsync(x => x.ImportId == importId);

            if (session == null)
                return NotFound("Import session not found.");

            var selectedSheetName = body?.SheetName;

            var rows = await _db.ImportData
        .Where(x =>
            x.ImportId == importId &&
            (string.IsNullOrEmpty(selectedSheetName)
             || x.SheetName == selectedSheetName)
        )
        .OrderBy(x => x.SheetIndex)
        .ThenBy(x => x.RowNumber)
        .ToListAsync();

            if (rows.Count < 2)
                return BadRequest("Not enough data to promote.");

            var resolvedImportRows = ImportHeaderHelper.ResolveHeadersAndDataRows(
                target,
                rows,
                GetExpectedImportColumns,
                NormalizeHeaderForTarget,
                body?.HeaderRowNumber);
            var headers = resolvedImportRows.Headers;
            if (headers == null || headers.Count == 0)
                return BadRequest("Header row is empty.");
            var dataRows = resolvedImportRows.DataRows;
            if (dataRows.Count == 0)
                return BadRequest("Not enough data to promote.");

            // =====================================================
            // 2️⃣ APPLY HEADER MAP (INDEX-BASED, SAFE)
            // =====================================================
            if (body?.HeaderMap != null)
            {
                for (int i = 0; i < headers.Count; i++)
                {
                    var key = $"__col_{i}__";

                    if (body.HeaderMap.TryGetValue(key, out var mapped))
                    {
                        headers[i] = mapped?.Trim() ?? string.Empty;
                    }
                }
            }

            if (IsListAuditTarget(target))
            {
                IgnoreEmptyListAuditColumns(headers, dataRows);
            }

            // =====================================================
            // 3️⃣ FINAL SANITIZATION (AFTER MAPPING)
            // =====================================================
            for (int i = 0; i < headers.Count; i++)
            {
                headers[i] = NormalizeHeaderForTarget(target, headers[i]);
            }

            // =====================================================
            // 4️⃣ RESOLVE TARGET TYPES
            // =====================================================
            var isProcurementTarget = IsProcurementProcureTarget(target);
            Type? dtoType = null;
            Type? entityType = null;

            if (!isProcurementTarget)
            {
                dtoType = ResolveType($"{target}CreateDto");
                entityType = ResolveType(target);

                if (dtoType == null || entityType == null)
                    return BadRequest($"Target '{target}' not found.");
            }

            var headerValidation = ValidateHeadersForTarget(target, headers);
            if (headerValidation != null)
            {
                return headerValidation;
            }

            var fixedFieldValidation = ValidateFixedFieldsForTarget(target, body?.FixedFields);
            if (fixedFieldValidation != null)
            {
                return fixedFieldValidation;
            }

            var normalizedFixedFields = await NormalizeFixedFieldsForTargetAsync(target, body?.FixedFields);

            Dictionary<int, Dictionary<string, byte[]>>? listAuditEvidenceMap = null;
            if (IsListAuditTarget(target) && ContainsListAuditEvidenceColumn(headers))
            {
                if (!IsOpenXmlWorkbook(session.FileName))
                {
                    return BadRequest(new
                    {
                        message = "ListAudit evidence import for RHA/LHA only supports .xlsx."
                    });
                }

                var filePath = GetImportSessionFilePath(session);
                if (!System.IO.File.Exists(filePath))
                {
                    return NotFound("Uploaded file not found. Enable temp saving during import.");
                }

                listAuditEvidenceMap = ExtractListAuditEvidenceMap(filePath, body?.SheetName, headers, dataRows);
            }

            bool isRewrite = string.Equals(mode, "rewrite", StringComparison.OrdinalIgnoreCase);
            bool isUpsert = string.Equals(mode, "upsert", StringComparison.OrdinalIgnoreCase);
            var resolvedUpsertKey = body?.UpsertKey;

            if (isUpsert &&
                !IsListAuditTarget(target) &&
                !IsWeeklyTableTarget(target) &&
                !IsHumanStrictImportTarget(target) &&
                !IsProcurementProcureTarget(target) &&
                string.IsNullOrWhiteSpace(resolvedUpsertKey))
            {
                resolvedUpsertKey = ResolveDefaultUpsertKey(target);
            }

            if (isUpsert &&
                !IsListAuditTarget(target) &&
                !IsWeeklyTableTarget(target) &&
                !IsHumanStrictImportTarget(target) &&
                !IsProcurementProcureTarget(target) &&
                string.IsNullOrWhiteSpace(resolvedUpsertKey))
            {
                return BadRequest("UpsertKey is required for upsert mode.");
            }


            int? rewriteYear = null;

            if (body?.FixedFields != null &&
                body.FixedFields.TryGetValue("Year", out var yearObj) &&
                int.TryParse(yearObj?.ToString(), out var y))
            {
                rewriteYear = y;
            }



            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync();
                try
                {
                    ImportPromoteSummary promoteSummary;
                    // =====================================================
                    // 6️⃣ REWRITE MODE (DYNAMIC COLUMN = VALUE)
                    // =====================================================
                    // =====================================================
                    // 6️⃣ REWRITE MODE (DYNAMIC COLUMN = VALUE)
                    // =====================================================
                    if (isRewrite && !IsProcurementProcureTarget(target))
                    {
                        _db.ChangeTracker.Clear();
                        var requiredEntityType = EnsureResolvedType(entityType, "entity", target);

                        var efEntity = _db.Model.GetEntityTypes()
                            .FirstOrDefault(t =>
                                t.ClrType == requiredEntityType ||
                                t.GetTableName()?.Equals(target, StringComparison.OrdinalIgnoreCase) == true);

                        if (efEntity == null)
                            throw new InvalidOperationException($"EF mapping not found for '{target}'.");

                        var tableName = efEntity.GetTableName();
                        var schema = efEntity.GetSchema() ?? "dbo";

                        if (string.IsNullOrWhiteSpace(tableName))
                            throw new InvalidOperationException($"Table name not found for '{target}'.");

                        // 🔥 USE body.FixedFields (NOT fixedFields)
                        if (body?.FixedFields != null && body.FixedFields.Any())
                        {
                            var conditions = new List<string>();
                            var parameters = new List<SqlParameter>();
                            int i = 0;

                            foreach (var kv in body.FixedFields)
                            {
                                var prop = requiredEntityType.GetProperty(
                                    kv.Key,
                                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                                );

                                if (prop == null)
                                    throw new InvalidOperationException(
                                        $"Rewrite column '{kv.Key}' not found on '{requiredEntityType.Name}'."
                                    );

                                var paramName = $"@p{i}";
                                conditions.Add($"[{prop.Name}] = {paramName}");
                                parameters.Add(new SqlParameter(paramName, kv.Value ?? DBNull.Value));
                                i++;
                            }

                            var whereClause = string.Join(" AND ", conditions);
                            var deleteSql = $"DELETE FROM [{schema}].[{tableName}] WHERE {whereClause}";

                            await _db.Database.ExecuteSqlRawAsync(
                                deleteSql,
                                parameters.ToArray()
                            );
                        }
                        else
                        {
                            // 🚨 explicit full-table rewrite
                            var deleteAllSql = $"DELETE FROM [{schema}].[{tableName}]";
                            await _db.Database.ExecuteSqlRawAsync(
                                deleteAllSql
                            );
                        }
                    }



                    // =====================================================
                    // 7️⃣ PROMOTE DATA
                    // =====================================================
                    if (IsProcurementProcureTarget(target))
                    {
                        promoteSummary = await PromoteProcurementCanonical(
                            target,
                            headers,
                            dataRows,
                            normalizedFixedFields,
                            isRewrite,
                            isUpsert,
                            body?.UpsertKey);
                    }
                    else if (IsWeeklyTableTarget(target) && isUpsert)
                    {
                        promoteSummary = await PromoteWeeklyTableContentUpsert(
                            EnsureResolvedType(dtoType, "dto", target),
                            headers,
                            dataRows,
                            normalizedFixedFields,
                            body?.IncludeDuplicates == true);
                    }
                    else if (IsHumanStrictImportTarget(target) && isUpsert)
                    {
                        promoteSummary = await PromoteHumanContentUpsert(
                            target,
                            EnsureResolvedType(dtoType, "dto", target),
                            EnsureResolvedType(entityType, "entity", target),
                            headers,
                            dataRows,
                            normalizedFixedFields,
                            body?.IncludeDuplicates == true);
                    }
                    else if (isRewrite)
                    {
                        // 🔥 HARD RESET EF STATE
                        _db.ChangeTracker.Clear();

                        promoteSummary = await PromoteDynamic(
                            EnsureResolvedType(dtoType, "dto", target),
                            EnsureResolvedType(entityType, "entity", target),
                            headers,
                            dataRows,
                            session,
                            normalizedFixedFields,
                            listAuditEvidenceMap
                        );
                    }
                    else if (isUpsert)
                    {
                        if (IsListAuditTarget(target))
                        {
                            promoteSummary = await PromoteListAuditContentUpsert(
                                EnsureResolvedType(dtoType, "dto", target),
                                headers,
                                dataRows,
                                session,
                                normalizedFixedFields,
                                listAuditEvidenceMap,
                                body?.IncludeDuplicates == true
                            );
                        }
                        else
                        {
                            var upsertKey = resolvedUpsertKey
                                ?? throw new InvalidOperationException("UpsertKey is required for upsert mode.");

                            promoteSummary = await PromoteDynamicUpsert(
                                EnsureResolvedType(dtoType, "dto", target),
                                EnsureResolvedType(entityType, "entity", target),
                                headers,
                                dataRows,
                                session,
                                normalizedFixedFields,
                                upsertKey,
                                listAuditEvidenceMap
                            );
                        }
                    }
                    else
                    {
                        promoteSummary = await PromoteDynamic(
                            EnsureResolvedType(dtoType, "dto", target),
                            EnsureResolvedType(entityType, "entity", target),
                            headers,
                            dataRows,
                            session,
                            normalizedFixedFields,
                            listAuditEvidenceMap
                        );
                    }

                    if (promoteSummary.ProcessedRows == 0)
                    {
                        await tx.RollbackAsync();
                        return BadRequest(new
                        {
                            message = "Promotion completed with 0 applied rows.",
                            target,
                            importId,
                            mode = isRewrite ? "rewrite" : isUpsert ? "upsert" : "insert",
                            summary = new
                            {
                                totalRows = promoteSummary.TotalRows,
                                processed = promoteSummary.ProcessedRows,
                                inserted = promoteSummary.InsertedRows,
                                updated = promoteSummary.UpdatedRows,
                                skipped = promoteSummary.SkippedRows,
                                duplicate = promoteSummary.DuplicateRows
                            }
                        });
                    }

                    session.Status = isRewrite ? "Rewritten" : "Promoted";
                    session.ErrorCount = promoteSummary.SkippedRows;
                    await _db.SaveChangesAsync();
                    await tx.CommitAsync();

                    return Ok(new
                    {
                        message = isRewrite
                            ? $"Import {importId} rewrote '{target}' successfully."
                            : $"Import {importId} promoted to '{target}' successfully.",
                        target,
                        importId,
                        mode = isRewrite ? "rewrite" : isUpsert ? "upsert" : "insert",
                        summary = new
                        {
                            totalRows = promoteSummary.TotalRows,
                            processed = promoteSummary.ProcessedRows,
                            inserted = promoteSummary.InsertedRows,
                            updated = promoteSummary.UpdatedRows,
                            skipped = promoteSummary.SkippedRows,
                            duplicate = promoteSummary.DuplicateRows
                        }
                    });
                }
                catch (Exception ex)
                {
                    try
                    {
                        await tx.RollbackAsync();
                    }
                    catch (Exception rollbackEx)
                    {
                        return StatusCode(500, new
                        {
                            message = "Promotion failed and transaction rollback also failed.",
                            originalError = ex.Message,
                            rollbackError = rollbackEx.Message
                        });
                    }

                    return StatusCode(500, new
                    {
                        message = "Promotion failed.",
                        error = ex.Message
                    });
                }
            });
        }

        [HttpPost("preview/{target}/{importId}")]
        public async Task<IActionResult> PreviewPromoteSummary(
            string target,
            int importId,
            [FromQuery] string? mode,
            [FromBody] HeaderMapDto? body)
        {
            var tableAccess = EnsureTableAccess(target);
            if (tableAccess != null)
                return tableAccess;

            var isListAuditPreview = IsListAuditTarget(target);
            var isWeeklyTablePreview = IsWeeklyTableTarget(target);
            var isHumanStrictPreview = IsHumanStrictImportTarget(target);
            var isProcurementPreview = IsProcurementProcureTarget(target);
            Type? dtoType = null;
            Type? entityType = null;

            if (!isProcurementPreview)
            {
                dtoType = ResolveType($"{target}CreateDto");
                entityType = ResolveType(target);

                if (dtoType == null || entityType == null)
                {
                    return BadRequest($"Target '{target}' not found.");
                }
            }

            var session = await _db.ImportSession
                .FirstOrDefaultAsync(x => x.ImportId == importId);

            if (session == null)
                return NotFound("Import session not found.");

            var sessionAccess = EnsureImportSessionAccess(session);
            if (sessionAccess != null)
                return sessionAccess;

            var selectedSheetName = body?.SheetName;

            var rows = await _db.ImportData
                .Where(x =>
                    x.ImportId == importId &&
                    (string.IsNullOrEmpty(selectedSheetName)
                     || x.SheetName == selectedSheetName))
                .OrderBy(x => x.SheetIndex)
                .ThenBy(x => x.RowNumber)
                .ToListAsync();

            if (rows.Count < 2)
                return BadRequest("Not enough data to preview.");

            var resolvedImportRows = ImportHeaderHelper.ResolveHeadersAndDataRows(
                target,
                rows,
                GetExpectedImportColumns,
                NormalizeHeaderForTarget,
                body?.HeaderRowNumber);
            var headers = resolvedImportRows.Headers;
            if (headers == null || headers.Count == 0)
                return BadRequest("Header row is empty.");
            var dataRows = resolvedImportRows.DataRows;
            if (dataRows.Count == 0)
                return BadRequest("Not enough data to preview.");

            if (body?.HeaderMap != null)
            {
                for (int i = 0; i < headers.Count; i++)
                {
                    var key = $"__col_{i}__";
                    if (body.HeaderMap.TryGetValue(key, out var mapped))
                    {
                        headers[i] = mapped?.Trim() ?? string.Empty;
                    }
                }
            }

            if (isListAuditPreview)
            {
                IgnoreEmptyListAuditColumns(headers, dataRows);
            }

            for (int i = 0; i < headers.Count; i++)
            {
                headers[i] = NormalizeHeaderForTarget(target, headers[i]);
            }

            var headerValidation = ValidateHeadersForTarget(target, headers);
            if (headerValidation != null)
            {
                return headerValidation;
            }

            var fixedFieldValidation = ValidateFixedFieldsForTarget(target, body?.FixedFields);
            if (fixedFieldValidation != null)
            {
                return fixedFieldValidation;
            }

            var normalizedFixedFields = await NormalizeFixedFieldsForTargetAsync(target, body?.FixedFields);

            Dictionary<int, Dictionary<string, byte[]>>? listAuditEvidenceMap = null;
            if (isListAuditPreview && ContainsListAuditEvidenceColumn(headers))
            {
                if (!IsOpenXmlWorkbook(session.FileName))
                {
                    return BadRequest(new
                    {
                        message = "ListAudit evidence import for RHA/LHA only supports .xlsx."
                    });
                }

                var filePath = GetImportSessionFilePath(session);
                if (!System.IO.File.Exists(filePath))
                {
                    return NotFound("Uploaded file not found. Enable temp saving during import.");
                }

                listAuditEvidenceMap = ExtractListAuditEvidenceMap(filePath, body?.SheetName, headers, dataRows);
            }

            var resolvedUpsertKey = body?.UpsertKey;
            if (!isListAuditPreview &&
                !isWeeklyTablePreview &&
                !isHumanStrictPreview &&
                !isProcurementPreview &&
                string.IsNullOrWhiteSpace(resolvedUpsertKey))
            {
                resolvedUpsertKey = ResolveDefaultUpsertKey(target);
            }

            string previewMode;
            if (isListAuditPreview || isWeeklyTablePreview || isHumanStrictPreview)
            {
                previewMode = "upsert";
                if (!string.IsNullOrWhiteSpace(mode) &&
                    !string.Equals(mode, "upsert", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new
                    {
                        message = isListAuditPreview
                            ? "Preview summary currently supports ListAudit upsert mode only."
                            : isWeeklyTablePreview
                                ? "Preview summary currently supports WeeklyTable upsert mode only."
                                : $"Preview summary currently supports {target} upsert mode only."
                    });
                }
            }
            else
            {
                if (string.Equals(mode, "rewrite", StringComparison.OrdinalIgnoreCase))
                {
                    previewMode = "rewrite";
                }
                else if (string.Equals(mode, "append", StringComparison.OrdinalIgnoreCase))
                {
                    previewMode = "append";
                }
                else if (string.Equals(mode, "upsert", StringComparison.OrdinalIgnoreCase))
                {
                    previewMode = "upsert";
                }
                else
                {
                    previewMode = isProcurementPreview || !string.IsNullOrWhiteSpace(resolvedUpsertKey)
                        ? "upsert"
                        : "append";
                }
            }

            if (string.Equals(previewMode, "upsert", StringComparison.OrdinalIgnoreCase) &&
                !isListAuditPreview &&
                !isWeeklyTablePreview &&
                !isHumanStrictPreview &&
                !isProcurementPreview &&
                string.IsNullOrWhiteSpace(resolvedUpsertKey))
            {
                return BadRequest(new
                {
                    message = "UpsertKey is required for upsert preview mode."
                });
            }

            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync();
                try
                {
                    ImportPromoteSummary summary;
                    if (isListAuditPreview)
                    {
                        summary = await PromoteListAuditContentUpsert(
                            dtoType ?? throw new InvalidOperationException($"Target '{target}' not found."),
                            headers,
                            dataRows,
                            session,
                            normalizedFixedFields,
                            listAuditEvidenceMap,
                            body?.IncludeDuplicates == true
                        );
                    }
                    else if (isWeeklyTablePreview)
                    {
                        summary = await PromoteWeeklyTableContentUpsert(
                            dtoType ?? throw new InvalidOperationException($"Target '{target}' not found."),
                            headers,
                            dataRows,
                            normalizedFixedFields,
                            body?.IncludeDuplicates == true
                        );
                    }
                    else if (isHumanStrictPreview)
                    {
                        summary = await PromoteHumanContentUpsert(
                            target,
                            dtoType ?? throw new InvalidOperationException($"Target '{target}' not found."),
                            entityType ?? throw new InvalidOperationException($"Target '{target}' not found."),
                            headers,
                            dataRows,
                            normalizedFixedFields,
                            body?.IncludeDuplicates == true
                        );
                    }
                    else if (isProcurementPreview)
                    {
                        var isRewrite = string.Equals(previewMode, "rewrite", StringComparison.OrdinalIgnoreCase);
                        var isUpsert = string.Equals(previewMode, "upsert", StringComparison.OrdinalIgnoreCase);
                        summary = await PromoteProcurementCanonical(
                            target,
                            headers,
                            dataRows,
                            normalizedFixedFields,
                            isRewrite,
                            isUpsert,
                            resolvedUpsertKey
                        );
                    }
                    else
                    {
                        var isRewrite = string.Equals(previewMode, "rewrite", StringComparison.OrdinalIgnoreCase);
                        var isUpsert = string.Equals(previewMode, "upsert", StringComparison.OrdinalIgnoreCase);
                        var dynamicDtoType =
                            dtoType ?? throw new InvalidOperationException($"Target '{target}' not found.");
                        var dynamicEntityType =
                            entityType ?? throw new InvalidOperationException($"Target '{target}' not found.");

                        if (isRewrite)
                        {
                            summary = await PromoteDynamic(
                                dynamicDtoType,
                                dynamicEntityType,
                                headers,
                                dataRows,
                                session,
                                normalizedFixedFields,
                                listAuditEvidenceMap
                            );
                        }
                        else if (isUpsert)
                        {
                            var upsertKey = resolvedUpsertKey
                                ?? throw new InvalidOperationException("UpsertKey is required for upsert preview mode.");

                            summary = await PromoteDynamicUpsert(
                                dynamicDtoType,
                                dynamicEntityType,
                                headers,
                                dataRows,
                                session,
                                normalizedFixedFields,
                                upsertKey,
                                listAuditEvidenceMap
                            );
                        }
                        else
                        {
                            summary = await PromoteDynamic(
                                dynamicDtoType,
                                dynamicEntityType,
                                headers,
                                dataRows,
                                session,
                                normalizedFixedFields,
                                listAuditEvidenceMap
                            );
                        }
                    }

                    await tx.RollbackAsync();
                    _db.ChangeTracker.Clear();

                    return Ok(new
                    {
                        message = summary.ProcessedRows == 0
                            ? "No changes."
                            : "Preview ready.",
                        target,
                        importId,
                        mode = previewMode,
                        summary = new
                        {
                            totalRows = summary.TotalRows,
                            processed = summary.ProcessedRows,
                            inserted = summary.InsertedRows,
                            updated = summary.UpdatedRows,
                            skipped = summary.SkippedRows,
                            duplicate = summary.DuplicateRows
                        },
                        rowStates = summary.RowStates.Select(rowState => new
                        {
                            index = rowState.PreviewIndex,
                            rowNumber = rowState.RowNumber,
                            status = rowState.Status,
                            label = rowState.Label,
                            existingValues = rowState.ExistingValues
                        })
                    });
                }
                catch (Exception ex)
                {
                    try
                    {
                        await tx.RollbackAsync();
                        _db.ChangeTracker.Clear();
                    }
                    catch
                    {
                    }

                    return StatusCode(500, new
                    {
                        message = "Preview failed.",
                        error = ex.Message
                    });
                }
            });
        }


        public class HeaderMapDto
        {
            public Dictionary<string, string>? HeaderMap { get; set; }

            public Dictionary<string, object>? FixedFields { get; set; }
            public string? UpsertKey { get; set; }
            public string? SheetName { get; set; }
            public int? HeaderRowNumber { get; set; }
            public bool IncludeDuplicates { get; set; }
        }

        public class ImportColumnDetectionItem
        {
            public string Column { get; set; } = string.Empty;
            public string Label { get; set; } = string.Empty;
            public string Status { get; set; } = "gray";
            public bool Detected { get; set; }
            public bool HasData { get; set; }
            public int? SourceIndex { get; set; }
            public string? RawHeader { get; set; }
        }

        private sealed class ImportPromoteSummary
        {
            public int TotalRows { get; set; }
            public int ProcessedRows => InsertedRows + UpdatedRows;
            public int InsertedRows { get; set; }
            public int UpdatedRows { get; set; }
            public int SkippedRows { get; set; }
            public int DuplicateRows { get; set; }
            public List<ImportPromoteRowState> RowStates { get; } = new();
        }

        private sealed class ImportPromoteRowState
        {
            public int PreviewIndex { get; set; }
            public int? RowNumber { get; set; }
            public string Status { get; set; } = string.Empty;
            public string Label { get; set; } = string.Empty;
            public List<string>? ExistingValues { get; set; }
        }

        private static void AddImportPromoteRowState(
            ImportPromoteSummary summary,
            int previewIndex,
            int? rowNumber,
            string status,
            string label,
            List<string>? existingValues = null)
        {
            summary.RowStates.Add(new ImportPromoteRowState
            {
                PreviewIndex = previewIndex,
                RowNumber = rowNumber,
                Status = status,
                Label = label,
                ExistingValues = existingValues
            });
        }





        // =====================================
        // STEP 3: GET – Import Sessions
        // =====================================
        [HttpGet("sessions")]
        public async Task<IActionResult> GetImportSessions()
        {
            var userStream = FeatureAccessResolver.GetUserStream(User);
            var allowedTables = FeatureAccessResolver.GetTablesForStream(userStream);

            var sessions = await _db.ImportSession
                .Where(s => s.TargetTable != null && allowedTables.Contains(s.TargetTable))
                .OrderByDescending(s => s.UploadedAt)
                .ToListAsync();

            return Ok(sessions);
        }

        [HttpGet("detect/{target}/{importId}")]
        public async Task<IActionResult> DetectImportColumns(
            string target,
            int importId,
            [FromQuery] string? sheet)
        {
            var tableAccess = EnsureTableAccess(target);
            if (tableAccess != null)
            {
                return tableAccess;
            }

            var session = await _db.ImportSession.FirstOrDefaultAsync(x => x.ImportId == importId);
            if (session == null)
            {
                return NotFound("Import session not found.");
            }

            var sessionAccess = EnsureImportSessionAccess(session);
            if (sessionAccess != null)
            {
                return sessionAccess;
            }

            var rows = await _db.ImportData
                .Where(x =>
                    x.ImportId == importId &&
                    (string.IsNullOrEmpty(sheet) || x.SheetName == sheet))
                .OrderBy(x => x.SheetIndex)
                .ThenBy(x => x.RowNumber)
                .ToListAsync();

            if (rows.Count == 0)
            {
                return BadRequest("Import session has no staged rows.");
            }

            var expectedColumns = GetExpectedImportColumns(target);
            if (expectedColumns.Count == 0)
            {
                return BadRequest($"No import column definition found for target '{target}'.");
            }

            var resolvedImportRows = ImportHeaderHelper.ResolveHeadersAndDataRows(
                target,
                rows,
                GetExpectedImportColumns,
                NormalizeHeaderForTarget);
            var rawHeaders = resolvedImportRows.Headers;

            var normalizedHeaders = rawHeaders
                .Select(h => NormalizeHeaderForTarget(target, h))
                .ToList();

            var dataRows = resolvedImportRows.DataRows;
            if (IsListAuditTarget(target))
            {
                IgnoreEmptyListAuditColumns(normalizedHeaders, dataRows);
            }

            var headerLookup = new Dictionary<string, (int Index, string RawHeader)>(StringComparer.OrdinalIgnoreCase);
            var duplicateDetectedColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            for (int i = 0; i < normalizedHeaders.Count; i++)
            {
                var normalized = normalizedHeaders[i];
                if (string.IsNullOrWhiteSpace(normalized))
                {
                    continue;
                }

                if (!headerLookup.TryAdd(normalized, (i, rawHeaders[i])))
                {
                    duplicateDetectedColumns.Add(normalized);
                    if (IsProcurementProcureTarget(target) &&
                        ShouldPreferLatestProcurementHeaderMatch(normalized))
                    {
                        // For Procurement Keterangan duplicates, keep the rightmost column
                        // so canonical mapping follows the newer sheet column (col 19).
                        headerLookup[normalized] = (i, rawHeaders[i]);
                    }
                }
            }

            var evidencePresence = IsListAuditTarget(target)
                ? await DetectListAuditEvidencePresenceAsync(session, sheet, normalizedHeaders, dataRows)
                : new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

            var columns = new List<ImportColumnDetectionItem>();
            var suggestedHeaderMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            foreach (var expectedColumn in expectedColumns)
            {
                headerLookup.TryGetValue(expectedColumn, out var match);

                var detected = match.RawHeader != null;
                var hasData = false;

                if (detected)
                {
                    hasData = IsListAuditEvidenceColumn(expectedColumn)
                        ? evidencePresence.GetValueOrDefault(expectedColumn)
                        : ColumnHasAnyCellValue(dataRows, match.Index);
                }

                var status = detected && hasData ? "green" : "gray";
                if (status == "green")
                {
                    suggestedHeaderMap[$"__col_{match.Index}__"] = expectedColumn;
                }

                columns.Add(new ImportColumnDetectionItem
                {
                    Column = expectedColumn,
                    Label = GetImportColumnLabel(target, expectedColumn),
                    Status = status,
                    Detected = detected,
                    HasData = hasData,
                    SourceIndex = detected ? match.Index : null,
                    RawHeader = detected ? match.RawHeader : null
                });
            }

            var unknownHeaders = normalizedHeaders
                .Where(h => !string.IsNullOrWhiteSpace(h))
                .Where(h => !expectedColumns.Contains(h, StringComparer.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(x => x)
                .ToList();

            return Ok(new
            {
                target,
                importId,
                headerRowNumber = resolvedImportRows.HeaderRowIndex + 1,
                sheetName = string.IsNullOrWhiteSpace(sheet) ? rows.FirstOrDefault()?.SheetName : sheet,
                columns,
                unknownHeaders,
                duplicateDetectedColumns = duplicateDetectedColumns.OrderBy(x => x).ToList(),
                suggestedHeaderMap
            });
        }

        // =====================================
        // NEW - STEP: LIST SHEETS FOR IMPORT SESSION
        // =====================================
        [HttpGet("sheets/{importId}")]
        public async Task<IActionResult> GetSheets(int importId)
        {
            var session = await _db.ImportSession.FirstOrDefaultAsync(x => x.ImportId == importId);


            if (session == null)
                return NotFound("Import session not found.");

            var sessionAccess = EnsureImportSessionAccess(session);
            if (sessionAccess != null)
                return sessionAccess;

            using var stream = new MemoryStream();
            var storedFile = Request.HttpContext.RequestServices.GetService<IWebHostEnvironment>();
            // IMPORTANT — You MUST store the file temporarily when uploading!
            // Example: wwwroot/import-temp/{importId}-${filename}
            // For now assume file saved here:
            var filePath = Path.Combine("import-temp", session.ImportId + "_" + session.FileName);

            if (!System.IO.File.Exists(filePath))
                return NotFound("Uploaded file not found. Enable temp saving during import.");

            if (!IsOpenXmlWorkbook(session.FileName))
                return BadRequest("Import only supports .xlsx files.");

            System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
            using var fs = System.IO.File.OpenRead(filePath);
            using var reader = ExcelReaderFactory.CreateReader(fs);


            var list = new List<string>();
            do
            {
                list.Add(reader.Name ?? string.Empty);  // <– Sheet name
            } while (reader.NextResult());

            return Ok(list);
        }


        // =====================================
        // STEP 4: GET – Import Data
        // =====================================
        [HttpGet("data/{importId}")]
        public async Task<IActionResult> GetImportData(int importId, [FromQuery] string? sheet)
        {
            var session = await _db.ImportSession.FirstOrDefaultAsync(x => x.ImportId == importId);
            if (session == null)
                return NotFound("Import session not found.");

            var sessionAccess = EnsureImportSessionAccess(session);
            if (sessionAccess != null)
                return sessionAccess;

            var data = await _db.ImportData
                .Where(d =>
                    d.ImportId == importId &&
                    (string.IsNullOrWhiteSpace(sheet) || d.SheetName == sheet))
                .OrderBy(d => d.SheetIndex)
                .ThenBy(d => d.RowNumber)
                .ToListAsync();

            return Ok(data);
        }


        // =====================================
        // STEP 5: List all available targets
        // =====================================
        [HttpGet("targets")]
        public IActionResult GetSupportedTargets()
        {
            var targets = SupportedImportTargetNamesCache.Value
                .Where(t =>
                {
                    var entityType = ResolveType(t);
                    if (entityType == null || !HasDbSetForEntity(entityType))
                    {
                        return false;
                    }

                    var targetStream = FeatureAccessResolver.ResolveStreamForTable(t);
                    return FeatureAccessResolver.CanAccessRequestedStream(User, targetStream);
                })
                .Distinct()
                .OrderBy(x => x)
                .ToList();

            return Ok(targets);
        }

        // =====================================
        // PRIVATE: Promotion Logic (Generic)
        // =====================================
        private async Task<ImportPromoteSummary> PromoteDynamic(
     Type dtoType,
     Type entityType,
     List<string> headers,
     List<ImportData> rows,
     ImportSession session,
     Dictionary<string, object>? fixedFields,
     Dictionary<int, Dictionary<string, byte[]>>? listAuditEvidenceMap
 )
        {
            var summary = new ImportPromoteSummary
            {
                TotalRows = rows.Count
            };
            var entityList = (IList)Activator.CreateInstance(
                typeof(List<>).MakeGenericType(entityType)
            )!;

            var excludedProps = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Id",
        "ID"
    };

            foreach (var row in rows)
            {
                var values = ImportHeaderHelper.DeserializeRowValues(row);
                var hasEvidence = listAuditEvidenceMap != null &&
                                  listAuditEvidenceMap.TryGetValue(row.RowNumber ?? 0, out var rowEvidenceMap) &&
                                  rowEvidenceMap.Count > 0;
                if (values.Count == 0)
                {
                    summary.SkippedRows++;
                    continue;
                }

                // 🔥 SKIP EMPTY ROWS
                if (values.All(v => string.IsNullOrWhiteSpace(v)) && !hasEvidence)
                {
                    summary.SkippedRows++;
                    continue;
                }


                // 1️⃣ Create DTO
                var dto = Activator.CreateInstance(dtoType)!;
                var extraData = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                var hasMappedInput = hasEvidence;

                // 2️⃣ Map Excel → DTO
                for (int i = 0; i < headers.Count && i < values.Count; i++)
                {
                    var column = headers[i];
                    var value = values[i];

                    if (string.IsNullOrWhiteSpace(column))
                    {
                        continue;
                    }

                    if (IsListAuditTarget(entityType.Name) && IsListAuditEvidenceColumn(column))
                    {
                        continue;
                    }

                    var prop = dtoType.GetProperty(
                        column,
                        BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                    );

                    if (prop != null && prop.CanWrite && !excludedProps.Contains(prop.Name))
                    {
                        try
                        {
                            var targetType =
                                Nullable.GetUnderlyingType(prop.PropertyType)
                                ?? prop.PropertyType;

                            var convertedValue = ConvertCellValue(value, targetType);
                            prop.SetValue(dto, convertedValue);
                            hasMappedInput = hasMappedInput || convertedValue != null;
                        }
                        catch
                        {
                            extraData[column] = value ?? string.Empty;
                            hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(value);
                        }
                    }
                    else
                    {
                        extraData[column] = ConvertExtraData(value) ?? string.Empty;
                        hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(value);
                    }

                }

                if (!hasMappedInput && extraData.Count == 0)
                {
                    summary.SkippedRows++;
                    continue;
                }

                // 3️⃣ Assign ExtraData to DTO (if exists)
                dtoType.GetProperty(
                    "ExtraData",
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                )?.SetValue(dto, extraData);

                // 4️⃣ Map DTO → Entity
                var entity = _mapper.Map(dto, dtoType, entityType);
                ApplyListAuditEvidence(entity, entityType, row.RowNumber ?? 0, listAuditEvidenceMap);

                // 5️⃣ APPLY FIXED FIELDS (SYSTEM TRUTH, OVERRIDES EXCEL)
                if (fixedFields != null)
                {
                    foreach (var kv in fixedFields)
                    {
                        var prop = entityType.GetProperty(
                            kv.Key,
                            BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                        );

                        if (prop == null || !prop.CanWrite) continue;

                        var targetType =
                            Nullable.GetUnderlyingType(prop.PropertyType)
                            ?? prop.PropertyType;

                        var value = Convert.ChangeType(kv.Value, targetType);
                        prop.SetValue(entity, value);
                    }
                }

                // 6️⃣ Serialize ExtraData into entity if entity supports it
                entityType.GetProperty(
                    "ExtraData",
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                )?.SetValue(entity, JsonSerializer.Serialize(extraData));

                ApplyListAuditInsertTimestamps(entity, entityType);

                entityList.Add(entity);
                summary.InsertedRows++;
            }

            if (summary.InsertedRows == 0)
            {
                return summary;
            }

            // 7️⃣ Resolve DbSet<TEntity>
            var dbSetProp = _db.GetType()
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .FirstOrDefault(p =>
                    p.PropertyType.IsGenericType &&
                    p.PropertyType.GenericTypeArguments[0] == entityType
                )
                ?? throw new InvalidOperationException(
                    $"No DbSet found for entity '{entityType.Name}'."
                );

            var dbSet = dbSetProp.GetValue(_db)!;

            // 8️⃣ Invoke AddRange(IEnumerable<TEntity>)
            var addRangeMethod = dbSet.GetType().GetMethods()
                .FirstOrDefault(m =>
                    m.Name == "AddRange" &&
                    m.GetParameters().Length == 1 &&
                    m.GetParameters()[0].ParameterType.IsGenericType &&
                    m.GetParameters()[0].ParameterType.GetGenericTypeDefinition() == typeof(IEnumerable<>)
                )
                ?? throw new InvalidOperationException(
                    $"AddRange(IEnumerable<{entityType.Name}>) not found."
                );

            addRangeMethod.Invoke(dbSet, new object[] { entityList });

            // 9️⃣ Persist
            await _db.SaveChangesAsync();
            return summary;
        }

        private async Task<ImportPromoteSummary> PromoteProcurementCanonical(
            string target,
            List<string> headers,
            List<ImportData> rows,
            Dictionary<string, object>? fixedFields,
            bool isRewrite,
            bool isUpsert,
            string? upsertKey)
        {
            var summary = new ImportPromoteSummary
            {
                TotalRows = rows.Count
            };

            var scopedSourceType = target.Equals("ExistingProcure", StringComparison.OrdinalIgnoreCase)
                ? ProcurementCanonicalHelper.SourceExisting
                : target.Equals("NewProcure", StringComparison.OrdinalIgnoreCase)
                    ? ProcurementCanonicalHelper.SourceNew
                    : null;
            var resolvedUpsertKey = string.IsNullOrWhiteSpace(upsertKey)
                ? null
                : ProcurementCanonicalHelper.ResolveCanonicalFieldName(upsertKey);

            if (isRewrite)
            {
                var baseQuery = _db.ProcurementItems.AsQueryable();
                if (!string.IsNullOrWhiteSpace(scopedSourceType))
                {
                    baseQuery = baseQuery.Where(x => x.SourceType == scopedSourceType);
                }
                if (fixedFields != null && fixedFields.Count > 0)
                {
                    var narrowed = await baseQuery.ToListAsync();
                    var rewriteIds = narrowed
                        .Where(item => fixedFields.All(kv => ProcurementFieldMatches(item, kv.Key, kv.Value)))
                        .Select(item => item.Id)
                        .ToList();

                    if (rewriteIds.Count > 0)
                    {
                        var relations = await _db.ProcurementRelations
                            .Where(x => rewriteIds.Contains(x.ChildProcurementItemId) || rewriteIds.Contains(x.ParentProcurementItemId))
                            .ToListAsync();
                        var statuses = await _db.StatusPengadaan
                            .Where(x => x.ProcurementItemId.HasValue && rewriteIds.Contains(x.ProcurementItemId.Value))
                            .ToListAsync();
                        var items = await _db.ProcurementItems.Where(x => rewriteIds.Contains(x.Id)).ToListAsync();

                        _db.ProcurementRelations.RemoveRange(relations);
                        _db.StatusPengadaan.RemoveRange(statuses);
                        _db.ProcurementItems.RemoveRange(items);
                        await _db.SaveChangesAsync();
                    }
                }
                else
                {
                    var items = await baseQuery.ToListAsync();
                    var itemIds = items.Select(x => x.Id).ToList();
                    if (itemIds.Count > 0)
                    {
                        var relations = await _db.ProcurementRelations
                            .Where(x => itemIds.Contains(x.ChildProcurementItemId) || itemIds.Contains(x.ParentProcurementItemId))
                            .ToListAsync();
                        var statuses = await _db.StatusPengadaan
                            .Where(x => x.ProcurementItemId.HasValue && itemIds.Contains(x.ProcurementItemId.Value))
                            .ToListAsync();

                        _db.ProcurementRelations.RemoveRange(relations);
                        _db.StatusPengadaan.RemoveRange(statuses);
                        _db.ProcurementItems.RemoveRange(items);
                        await _db.SaveChangesAsync();
                    }
                }
            }

            var existingItems = isUpsert
                ? await _db.ProcurementItems.ToListAsync()
                : new List<ProcurementItem>();
            var normalizedLegacyKeteranganRows = 0;
            if (isUpsert && existingItems.Count > 0)
            {
                normalizedLegacyKeteranganRows = NormalizeLegacyProcurementKeteranganInPlace(existingItems);
            }

            for (int previewIndex = 0; previewIndex < rows.Count; previewIndex++)
            {
                var row = rows[previewIndex];
                var values = ImportHeaderHelper.DeserializeRowValues(row);
                if (values.Count == 0)
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                if (values.All(v => string.IsNullOrWhiteSpace(v)))
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                var item = new ProcurementItem
                {
                    SourceType = scopedSourceType ?? ProcurementCanonicalHelper.SourceNew
                };
                var hasMappedInput = false;

                for (int i = 0; i < headers.Count && i < values.Count; i++)
                {
                    var column = ProcurementCanonicalHelper.ResolveCanonicalFieldName(headers[i]);
                    if (string.IsNullOrWhiteSpace(column))
                    {
                        continue;
                    }

                    var raw = values[i];
                    if (string.IsNullOrWhiteSpace(raw))
                    {
                        continue;
                    }

                    if (ProcurementCanonicalHelper.IsProtectedField(column))
                    {
                        continue;
                    }

                    var prop = typeof(ProcurementItem).GetProperty(
                        column,
                        BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                    if (prop != null && prop.CanWrite && !prop.Name.Equals(nameof(ProcurementItem.ExtraData), StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            prop.SetValue(item, ConvertCellValue(raw, Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType));
                            hasMappedInput = true;
                        }
                        catch
                        {
                            hasMappedInput = true;
                        }
                    }
                }

                if (fixedFields != null)
                {
                    foreach (var kv in fixedFields)
                    {
                        var fixedFieldKey = ProcurementCanonicalHelper.ResolveCanonicalFieldName(kv.Key);
                        if (ProcurementCanonicalHelper.IsProtectedField(fixedFieldKey))
                        {
                            continue;
                        }

                        var prop = typeof(ProcurementItem).GetProperty(
                            fixedFieldKey,
                            BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                        if (prop != null && prop.CanWrite)
                        {
                            try
                            {
                                prop.SetValue(item, Convert.ChangeType(kv.Value, Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType));
                            }
                            catch
                            {
                            }
                        }
                    }
                }

                if (!hasMappedInput)
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                var fallbackSourceType = scopedSourceType ?? ProcurementCanonicalHelper.SourceNew;
                item.SourceType = ProcurementCanonicalHelper.ResolveSourceTypeForImport(item.TipePengadaan, fallbackSourceType);
                item.ExtraData = null;
                await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, item);

                if (isUpsert)
                {
                    var normalizedItemSource = ProcurementCanonicalHelper.NormalizeSourceType(item.SourceType);
                    if (!string.IsNullOrWhiteSpace(resolvedUpsertKey))
                    {
                        var existing = existingItems.FirstOrDefault(existingItem =>
                            ProcurementCanonicalHelper.NormalizeSourceType(existingItem.SourceType) == normalizedItemSource &&
                            ProcurementFieldMatches(existingItem, resolvedUpsertKey, GetProcurementFieldValue(item, resolvedUpsertKey)));

                        if (existing == null)
                        {
                            _db.ProcurementItems.Add(item);
                            existingItems.Add(item);
                            summary.InsertedRows++;
                            AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
                        }
                        else
                        {
                            if (HasProcurementImportChanges(existing, item))
                            {
                                CopyProcurementImportValues(existing, item);
                                existing.ExtraData = null;
                                await ProcurementCanonicalHelper.ApplyProjectIdentityAsync(_db, existing);
                                summary.UpdatedRows++;
                                AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "updated", "Update");
                            }
                            else
                            {
                                summary.DuplicateRows++;
                                summary.SkippedRows++;
                                AddImportPromoteRowState(
                                    summary,
                                    previewIndex,
                                    row.RowNumber,
                                    "duplicate",
                                    "Duplicate",
                                    BuildProcurementPreviewValues(existing, headers));
                            }
                        }
                    }
                    else
                    {
                        var existingByContent = existingItems.FirstOrDefault(existingItem =>
                            ProcurementCanonicalHelper.NormalizeSourceType(existingItem.SourceType) == normalizedItemSource &&
                            AreProcurementBusinessEquivalent(existingItem, item));

                        if (existingByContent != null)
                        {
                            summary.DuplicateRows++;
                            summary.SkippedRows++;
                            AddImportPromoteRowState(
                                summary,
                                previewIndex,
                                row.RowNumber,
                                "duplicate",
                                "Duplicate",
                                BuildProcurementPreviewValues(existingByContent, headers));
                        }
                        else
                        {
                            _db.ProcurementItems.Add(item);
                            existingItems.Add(item);
                            summary.InsertedRows++;
                            AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
                        }
                    }
                }
                else
                {
                    _db.ProcurementItems.Add(item);
                    existingItems.Add(item);
                    summary.InsertedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
                }
            }

            if (summary.ProcessedRows > 0 || normalizedLegacyKeteranganRows > 0)
            {
                await _db.SaveChangesAsync();
            }

            return summary;
        }

        private async Task<ImportPromoteSummary> PromoteListAuditContentUpsert(
    Type dtoType,
    List<string> headers,
    List<ImportData> rows,
            ImportSession session,
            Dictionary<string, object>? fixedFields,
            Dictionary<int, Dictionary<string, byte[]>>? listAuditEvidenceMap,
            bool includeDuplicates = false)
        {
            var summary = new ImportPromoteSummary
            {
                TotalRows = rows.Count
            };

            if (ListAuditBusinessCompareProperties.Count == 0)
            {
                summary.SkippedRows = rows.Count;
                return summary;
            }

            var existingRows = await _db.ListAudit.ToListAsync();

            for (int previewIndex = 0; previewIndex < rows.Count; previewIndex++)
            {
                var row = rows[previewIndex];
                var values = ImportHeaderHelper.DeserializeRowValues(row);
                var hasEvidence = listAuditEvidenceMap != null &&
                                  listAuditEvidenceMap.TryGetValue(row.RowNumber ?? 0, out var rowEvidenceMap) &&
                                  rowEvidenceMap.Count > 0;

                if (values.Count == 0)
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                if (values.All(v => string.IsNullOrWhiteSpace(v)) && !hasEvidence)
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                var dto = Activator.CreateInstance(dtoType)!;
                var extraData = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                var hasMappedInput = hasEvidence;

                for (int i = 0; i < headers.Count && i < values.Count; i++)
                {
                    var column = headers[i];
                    var raw = values[i];

                    if (string.IsNullOrWhiteSpace(column))
                    {
                        continue;
                    }

                    if (IsListAuditEvidenceColumn(column))
                    {
                        continue;
                    }

                    var prop = dtoType.GetProperty(
                        column,
                        BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                    );

                    if (prop != null && prop.CanWrite)
                    {
                        try
                        {
                            var targetType =
                                Nullable.GetUnderlyingType(prop.PropertyType)
                                ?? prop.PropertyType;

                            var convertedValue = ConvertCellValue(raw, targetType);
                            prop.SetValue(dto, convertedValue);
                            hasMappedInput = hasMappedInput || convertedValue != null;
                        }
                        catch
                        {
                            extraData[column] = raw ?? string.Empty;
                            hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(raw);
                        }
                    }
                    else
                    {
                        extraData[column] = raw ?? string.Empty;
                        hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(raw);
                    }
                }

                if (!hasMappedInput && extraData.Count == 0)
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                dtoType.GetProperty("ExtraData")?.SetValue(dto, extraData);

                var entity = (ListAudit)_mapper.Map(dto, dtoType, typeof(ListAudit));
                ApplyListAuditEvidence(entity, typeof(ListAudit), row.RowNumber ?? 0, listAuditEvidenceMap);

                if (fixedFields != null)
                {
                    foreach (var kv in fixedFields)
                    {
                        var prop = typeof(ListAudit).GetProperty(
                            kv.Key,
                            BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                        );

                        if (prop == null || !prop.CanWrite) continue;

                        var targetType =
                            Nullable.GetUnderlyingType(prop.PropertyType)
                            ?? prop.PropertyType;

                        prop.SetValue(entity, Convert.ChangeType(kv.Value, targetType));
                    }
                }

                typeof(ListAudit).GetProperty("ExtraData")?.SetValue(
                    entity,
                    JsonSerializer.Serialize(extraData)
                );

                ApplyListAuditInsertTimestamps(entity, typeof(ListAudit));

                var matchingExisting = existingRows.FirstOrDefault(existing =>
                    ListAuditBusinessCompareProperties.All(prop =>
                        AreEquivalentValues(prop.GetValue(existing), prop.GetValue(entity))));

                if (matchingExisting != null)
                {
                    if (includeDuplicates)
                    {
                        _db.ListAudit.Add(entity);
                        existingRows.Add(entity);
                        summary.InsertedRows++;
                        AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
                        continue;
                    }

                    summary.SkippedRows++;
                    summary.DuplicateRows++;
                    AddImportPromoteRowState(
                        summary,
                        previewIndex,
                        row.RowNumber,
                        "duplicate",
                        "Duplicate",
                        BuildListAuditPreviewValues(matchingExisting, headers));
                    continue;
                }

                _db.ListAudit.Add(entity);
                existingRows.Add(entity);
                summary.InsertedRows++;
                AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
            }

            if (summary.InsertedRows > 0)
            {
                await _db.SaveChangesAsync();
            }

            return summary;
        }

        private async Task<ImportPromoteSummary> PromoteWeeklyTableContentUpsert(
            Type dtoType,
            List<string> headers,
            List<ImportData> rows,
            Dictionary<string, object>? fixedFields,
            bool includeDuplicates = false)
        {
            var summary = new ImportPromoteSummary
            {
                TotalRows = rows.Count
            };

            var weeklyPeriodId = TryConvertToLong(GetFixedFieldValue(fixedFields, "WeeklyPeriodId"));
            var weeklyTableInstanceId = TryConvertToLong(GetFixedFieldValue(fixedFields, "WeeklyTableInstanceId"));

            if (weeklyPeriodId is not > 0 || weeklyTableInstanceId is not > 0)
            {
                throw new InvalidOperationException("Weekly import requires resolved WeeklyPeriodId and WeeklyTableInstanceId.");
            }

            var existingRows = await _db.WeeklyTable
                .Where(row =>
                    row.WeeklyPeriodId == weeklyPeriodId.Value &&
                    row.WeeklyTableInstanceId == weeklyTableInstanceId.Value)
                .ToListAsync();

            foreach (var (row, previewIndex) in rows.Select((value, index) => (value, index)))
            {
                var values = ImportHeaderHelper.DeserializeRowValues(row);
                if (values.Count == 0)
                {
                    summary.SkippedRows++;
                    continue;
                }

                if (values.All(v => string.IsNullOrWhiteSpace(v)))
                {
                    summary.SkippedRows++;
                    continue;
                }

                var dto = Activator.CreateInstance(dtoType)!;
                var extraData = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                var hasMappedInput = false;

                for (int i = 0; i < headers.Count && i < values.Count; i++)
                {
                    var column = headers[i];
                    var raw = values[i];

                    if (string.IsNullOrWhiteSpace(column))
                    {
                        continue;
                    }

                    var prop = dtoType.GetProperty(
                        column,
                        BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                    if (prop != null && prop.CanWrite)
                    {
                        try
                        {
                            var targetType = Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType;
                            var convertedValue = ConvertCellValue(raw, targetType);
                            prop.SetValue(dto, convertedValue);
                            hasMappedInput = hasMappedInput || convertedValue != null;
                        }
                        catch
                        {
                            extraData[column] = raw ?? string.Empty;
                            hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(raw);
                        }
                    }
                    else
                    {
                        extraData[column] = raw ?? string.Empty;
                        hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(raw);
                    }
                }

                if (!hasMappedInput && extraData.Count == 0)
                {
                    summary.SkippedRows++;
                    continue;
                }

                dtoType.GetProperty("ExtraData")?.SetValue(dto, extraData);

                var entity = (WeeklyTable)_mapper.Map(dto, dtoType, typeof(WeeklyTable));
                entity.WeeklyPeriodId = weeklyPeriodId.Value;
                entity.WeeklyTableInstanceId = weeklyTableInstanceId.Value;
                entity.ExtraData = extraData.Count > 0 ? JsonSerializer.Serialize(extraData) : null;
                ApplyWeeklyTableInsertDefaults(entity);
                ApplyWeeklyTableBusinessDefaults(entity);

                var matchingExisting = existingRows.FirstOrDefault(existing =>
                    WeeklyTableBusinessCompareProperties.All(prop =>
                        AreEquivalentValues(prop.GetValue(existing), prop.GetValue(entity))));

                if (matchingExisting != null)
                {
                    if (includeDuplicates)
                    {
                        entity.LogicalRowKey = Guid.NewGuid();
                        _db.WeeklyTable.Add(entity);
                        existingRows.Add(entity);
                        summary.InsertedRows++;
                        AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
                        continue;
                    }

                    summary.SkippedRows++;
                    summary.DuplicateRows++;
                    AddImportPromoteRowState(
                        summary,
                        previewIndex,
                        row.RowNumber,
                        "duplicate",
                        "Duplicate",
                        BuildWeeklyTablePreviewValues(matchingExisting, headers));
                    continue;
                }

                _db.WeeklyTable.Add(entity);
                existingRows.Add(entity);
                summary.InsertedRows++;
                AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
            }

            if (summary.InsertedRows > 0)
            {
                await _db.SaveChangesAsync();
            }

            return summary;
        }

        private async Task<ImportPromoteSummary> PromoteHumanContentUpsert(
            string target,
            Type dtoType,
            Type entityType,
            List<string> headers,
            List<ImportData> rows,
            Dictionary<string, object>? fixedFields,
            bool includeDuplicates = false)
        {
            var summary = new ImportPromoteSummary
            {
                TotalRows = rows.Count
            };

            if (!HumanImportColumnsByTarget.TryGetValue(target, out var compareColumns))
            {
                summary.SkippedRows = rows.Count;
                return summary;
            }

            var compareProperties = compareColumns
                .Select(column => entityType.GetProperty(
                    column,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance))
                .Where(prop => prop != null && prop.CanRead && prop.CanWrite)
                .Cast<PropertyInfo>()
                .ToList();

            if (compareProperties.Count == 0)
            {
                summary.SkippedRows = rows.Count;
                return summary;
            }

            var dbSetProp = _db.GetType()
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .FirstOrDefault(p =>
                    p.PropertyType.IsGenericType &&
                    p.PropertyType.GenericTypeArguments[0] == entityType)
                ?? throw new InvalidOperationException(
                    $"No DbSet found for entity '{entityType.Name}'.");

            var entityQuery = (IQueryable)dbSetProp.GetValue(_db)!;
            var toListAsync = typeof(EntityFrameworkQueryableExtensions)
                .GetMethod(nameof(EntityFrameworkQueryableExtensions.ToListAsync))!
                .MakeGenericMethod(entityType);
            var existingRows = await InvokeToListAsyncAsObjects(toListAsync, entityQuery);

            foreach (var (row, previewIndex) in rows.Select((value, index) => (value, index)))
            {
                var values = ImportHeaderHelper.DeserializeRowValues(row);
                if (values.Count == 0)
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                if (values.All(v => string.IsNullOrWhiteSpace(v)))
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                var dto = Activator.CreateInstance(dtoType)!;
                var extraData = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                var hasMappedInput = false;

                for (int i = 0; i < headers.Count && i < values.Count; i++)
                {
                    var column = headers[i];
                    var raw = values[i];

                    if (string.IsNullOrWhiteSpace(column))
                    {
                        continue;
                    }

                    var prop = dtoType.GetProperty(
                        column,
                        BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                    if (prop != null && prop.CanWrite)
                    {
                        try
                        {
                            var targetType =
                                Nullable.GetUnderlyingType(prop.PropertyType)
                                ?? prop.PropertyType;

                            var convertedValue = ConvertCellValue(raw, targetType);
                            prop.SetValue(dto, convertedValue);
                            hasMappedInput = hasMappedInput || convertedValue != null;
                        }
                        catch
                        {
                            extraData[column] = raw ?? string.Empty;
                            hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(raw);
                        }
                    }
                    else
                    {
                        extraData[column] = raw ?? string.Empty;
                        hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(raw);
                    }
                }

                if (!hasMappedInput && extraData.Count == 0)
                {
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue;
                }

                dtoType.GetProperty("ExtraData")?.SetValue(dto, extraData);

                var entity = _mapper.Map(dto, dtoType, entityType);

                if (fixedFields != null)
                {
                    foreach (var kv in fixedFields)
                    {
                        var prop = entityType.GetProperty(
                            kv.Key,
                            BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                        if (prop == null || !prop.CanWrite) continue;

                        var targetType =
                            Nullable.GetUnderlyingType(prop.PropertyType)
                            ?? prop.PropertyType;

                        prop.SetValue(entity, Convert.ChangeType(kv.Value, targetType));
                    }
                }

                entityType.GetProperty("ExtraData")?.SetValue(
                    entity,
                    JsonSerializer.Serialize(extraData));

                HumanDepartmentCanonicalHelper.NormalizeEntityDisplayValues(entity);

                var now = DateTime.UtcNow;
                SetDateTimeProperty(entity, entityType, "CreatedAt", now, onlyIfUnset: true);
                SetDateTimeProperty(entity, entityType, "UpdatedAt", now, onlyIfUnset: false);

                var matchingExisting = existingRows.FirstOrDefault(existing =>
                    compareProperties.All(prop =>
                        AreEquivalentValues(
                            NormalizeHumanImportComparisonValue(prop, prop.GetValue(existing)),
                            NormalizeHumanImportComparisonValue(prop, prop.GetValue(entity)))));

                if (matchingExisting != null)
                {
                    if (includeDuplicates)
                    {
                        _db.Add(entity);
                        existingRows.Add(entity);
                        summary.InsertedRows++;
                        AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
                        continue;
                    }

                    summary.SkippedRows++;
                    summary.DuplicateRows++;
                    AddImportPromoteRowState(
                        summary,
                        previewIndex,
                        row.RowNumber,
                        "duplicate",
                        "Duplicate",
                        BuildDynamicPreviewValues(matchingExisting, entityType, headers));
                    continue;
                }

                _db.Add(entity);
                existingRows.Add(entity);
                summary.InsertedRows++;
                AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "new", "New");
            }

            if (summary.InsertedRows > 0)
            {
                await _db.SaveChangesAsync();
            }

            return summary;
        }

        private async Task<ImportPromoteSummary> PromoteDynamicUpsert(
    Type dtoType,
    Type entityType,
    List<string> headers,
    List<ImportData> rows,
    ImportSession session,
    Dictionary<string, object>? fixedFields,
    string upsertKey,
    Dictionary<int, Dictionary<string, byte[]>>? listAuditEvidenceMap
)
        {
            var summary = new ImportPromoteSummary
            {
                TotalRows = rows.Count
            };
            // =====================================
            // 1️⃣ Resolve PK property
            // =====================================
            var pkProp = entityType.GetProperty(
                upsertKey,
                BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
            );

            if (pkProp == null)
                throw new InvalidOperationException(
                    $"UpsertKey '{upsertKey}' not found on entity '{entityType.Name}'."
                );

            var pkType = Nullable.GetUnderlyingType(pkProp.PropertyType)
                         ?? pkProp.PropertyType;

            // =====================================
            // 2️⃣ Resolve DbSet<TEntity>
            // =====================================
            var dbSetProp = _db.GetType()
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .FirstOrDefault(p =>
                    p.PropertyType.IsGenericType &&
                    p.PropertyType.GenericTypeArguments[0] == entityType
                )
                ?? throw new InvalidOperationException(
                    $"No DbSet found for entity '{entityType.Name}'."
                );

            var dbSet = (IQueryable)dbSetProp.GetValue(_db)!;

            // =====================================
            // 3️⃣ Parse incoming rows → entities
            // =====================================
            var incoming = new List<(object Entity, int PreviewIndex, int? RowNumber)>();
            var incomingKeys = Activator.CreateInstance(
                typeof(List<>).MakeGenericType(pkType)
            )!;
            var addKeyMethod = incomingKeys.GetType().GetMethod("Add")!;

            foreach (var (row, previewIndex) in rows.Select((value, index) => (value, index)))
            {
                var values = ImportHeaderHelper.DeserializeRowValues(row);
                var hasEvidence = listAuditEvidenceMap != null &&
                                  listAuditEvidenceMap.TryGetValue(row.RowNumber ?? 0, out var rowEvidenceMap) &&
                                  rowEvidenceMap.Count > 0;
                if (values.Count == 0)
                {
                    summary.SkippedRows++;
                    continue;
                }

                if (values.All(v => string.IsNullOrWhiteSpace(v)) && !hasEvidence)
                {
                    summary.SkippedRows++;
                    continue;
                }

                var dto = Activator.CreateInstance(dtoType)!;
                var extraData = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                var hasMappedInput = hasEvidence;

                // Excel → DTO
                for (int i = 0; i < headers.Count && i < values.Count; i++)
                {
                    var column = headers[i];
                    var raw = values[i];

                    if (string.IsNullOrWhiteSpace(column))
                    {
                        continue;
                    }

                    if (IsListAuditTarget(entityType.Name) && IsListAuditEvidenceColumn(column))
                    {
                        continue;
                    }

                    var prop = dtoType.GetProperty(
                        column,
                        BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                    );

                    if (prop != null && prop.CanWrite)
                    {
                        try
                        {
                            var targetType =
                                Nullable.GetUnderlyingType(prop.PropertyType)
                                ?? prop.PropertyType;

                            var convertedValue = ConvertCellValue(raw, targetType);
                            prop.SetValue(dto, convertedValue);
                            hasMappedInput = hasMappedInput || convertedValue != null;
                        }
                        catch
                        {
                            extraData[column] = raw ?? string.Empty;
                            hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(raw);
                        }
                    }
                    else
                    {
                        extraData[column] = raw ?? string.Empty;
                        hasMappedInput = hasMappedInput || !string.IsNullOrWhiteSpace(raw);
                    }
                }

                if (!hasMappedInput && extraData.Count == 0)
                {
                    summary.SkippedRows++;
                    continue;
                }

                dtoType.GetProperty("ExtraData")?.SetValue(dto, extraData);

                // DTO → Entity
                var entity = _mapper.Map(dto, dtoType, entityType);
                ApplyListAuditEvidence(entity, entityType, row.RowNumber ?? 0, listAuditEvidenceMap);

                // Apply fixed fields (system truth)
                if (fixedFields != null)
                {
                    foreach (var kv in fixedFields)
                    {
                        var prop = entityType.GetProperty(
                            kv.Key,
                            BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                        );

                        if (prop == null || !prop.CanWrite) continue;

                        var targetType =
                            Nullable.GetUnderlyingType(prop.PropertyType)
                            ?? prop.PropertyType;

                        prop.SetValue(entity, Convert.ChangeType(kv.Value, targetType));
                    }
                }

                // Serialize ExtraData into entity if exists
                entityType.GetProperty("ExtraData")?.SetValue(
                    entity,
                    JsonSerializer.Serialize(extraData)
                );

                ApplyListAuditInsertTimestamps(entity, entityType);

                var pkValue = pkProp.GetValue(entity);
                if (pkValue == null)
                {
                    session.ErrorCount++;
                    summary.SkippedRows++;
                    AddImportPromoteRowState(summary, previewIndex, row.RowNumber, "skipped", "Skip");
                    continue; // cannot upsert without PK
                }

                incoming.Add((entity, previewIndex, row.RowNumber));
                addKeyMethod.Invoke(incomingKeys, new[] { pkValue });
            }

            if (incoming.Count == 0)
                return summary;

            var activeCompareProperties = GetActiveImportPropertiesForUpsertCompare(entityType, headers);

            // =====================================
            // 4️⃣ Load existing rows by PK (EF SAFE)
            // =====================================
            var param = Expression.Parameter(entityType, "x");
            var propAccess = Expression.Property(param, pkProp);

            var containsMethod = incomingKeys.GetType()
                .GetMethod("Contains", new[] { pkType })!;

            var containsCall = Expression.Call(
                Expression.Constant(incomingKeys),
                containsMethod,
                propAccess
            );

            var lambda = Expression.Lambda(containsCall, param);

            var whereMethod = typeof(Queryable)
                .GetMethods()
                .First(m => m.Name == "Where" && m.GetParameters().Length == 2)
                .MakeGenericMethod(entityType);

            var filteredQuery = (IQueryable)whereMethod.Invoke(
                null,
                new object[] { dbSet, lambda }
            )!;

            var toListAsync = typeof(EntityFrameworkQueryableExtensions)
                .GetMethod(nameof(EntityFrameworkQueryableExtensions.ToListAsync))!
                .MakeGenericMethod(entityType);

            var existing = await InvokeToListAsyncAsObjects(toListAsync, filteredQuery);

            var existingMap = existing.ToDictionary(e => pkProp.GetValue(e)!);

            // =====================================
            // 5️⃣ UPDATE or INSERT
            // =====================================
            foreach (var incomingItem in incoming)
            {
                var entity = incomingItem.Entity;
                var pk = pkProp.GetValue(entity)!;

                if (existingMap.TryGetValue(pk, out var existingEntity))
                {
                    // 🔁 UPDATE (non-null overwrite)
                    var changed = false;
                    foreach (var prop in activeCompareProperties)
                    {
                        var newValue = prop.GetValue(entity);
                        if (newValue == null) continue;

                        var currentValue = prop.GetValue(existingEntity);
                        if (AreEquivalentValues(currentValue, newValue))
                        {
                            continue;
                        }

                        prop.SetValue(existingEntity, newValue);
                        changed = true;
                    }

                    if (changed)
                    {
                        ApplyListAuditUpdateTimestamp(existingEntity, entityType);
                        summary.UpdatedRows++;
                        AddImportPromoteRowState(summary, incomingItem.PreviewIndex, incomingItem.RowNumber, "updated", "Update");
                    }
                    else
                    {
                        summary.DuplicateRows++;
                        summary.SkippedRows++;
                        AddImportPromoteRowState(summary, incomingItem.PreviewIndex, incomingItem.RowNumber, "skipped", "Skip", BuildDynamicPreviewValues(existingEntity, entityType, headers));
                    }
                }
                else
                {
                    // ➕ INSERT
                    ((dynamic)dbSet).Add(entity);
                    summary.InsertedRows++;
                    AddImportPromoteRowState(summary, incomingItem.PreviewIndex, incomingItem.RowNumber, "new", "New");
                }
            }

            if (summary.ProcessedRows > 0)
            {
                await _db.SaveChangesAsync();
            }

            return summary;
        }

        private static void ApplyListAuditEvidence(
            object entity,
            Type entityType,
            int rowNumber,
            Dictionary<int, Dictionary<string, byte[]>>? listAuditEvidenceMap)
        {
            if (!entityType.Name.Equals("ListAudit", StringComparison.OrdinalIgnoreCase) ||
                listAuditEvidenceMap == null ||
                !listAuditEvidenceMap.TryGetValue(rowNumber, out var evidenceByColumn))
            {
                return;
            }

            foreach (var evidence in evidenceByColumn)
            {
                var prop = entityType.GetProperty(
                    evidence.Key,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                if (prop == null || !prop.CanWrite || prop.PropertyType != typeof(byte[]))
                {
                    continue;
                }

                prop.SetValue(entity, evidence.Value);
            }
        }

        private static void ApplyListAuditInsertTimestamps(object entity, Type entityType)
        {
            if (!entityType.Name.Equals("ListAudit", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            SanitizeListAuditEntity(entity, entityType);
            var now = DateTime.UtcNow;
            SetDateTimeProperty(entity, entityType, "CreatedAt", now, onlyIfUnset: true);
            SetDateTimeProperty(entity, entityType, "UpdatedAt", now, onlyIfUnset: false);
        }

        private static void ApplyListAuditUpdateTimestamp(object entity, Type entityType)
        {
            if (!entityType.Name.Equals("ListAudit", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            SanitizeListAuditEntity(entity, entityType);
            SetDateTimeProperty(entity, entityType, "UpdatedAt", DateTime.UtcNow, onlyIfUnset: false);
        }

        private static bool ShouldSkipUpsertPropertyUpdate(Type entityType, string propertyName)
        {
            if (propertyName.Equals("Id", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (!entityType.Name.Equals("ListAudit", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return propertyName.Equals("CreatedAt", StringComparison.OrdinalIgnoreCase)
                   || propertyName.Equals("UpdatedAt", StringComparison.OrdinalIgnoreCase);
        }

        private static List<PropertyInfo> GetActiveImportPropertiesForUpsertCompare(Type entityType, IEnumerable<string> headers)
        {
            return headers
                .Where(h => !string.IsNullOrWhiteSpace(h))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(header => entityType.GetProperty(
                    header,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance))
                .Where(prop => prop != null && prop.CanRead && prop.CanWrite)
                .Where(prop => !ShouldSkipUpsertPropertyUpdate(entityType, prop!.Name))
                .Cast<PropertyInfo>()
                .ToList();
        }

        private static bool AreEquivalentValues(object? currentValue, object? newValue)
        {
            if (ReferenceEquals(currentValue, newValue))
            {
                return true;
            }

            if (currentValue == null || newValue == null)
            {
                return false;
            }

            if (currentValue is byte[] currentBytes && newValue is byte[] newBytes)
            {
                return currentBytes.SequenceEqual(newBytes);
            }

            if (currentValue is string currentString && newValue is string newString)
            {
                return string.Equals(
                    NormalizeComparableText(currentString),
                    NormalizeComparableText(newString),
                    StringComparison.OrdinalIgnoreCase);
            }

            return Equals(currentValue, newValue);
        }

        private static object? NormalizeHumanImportComparisonValue(PropertyInfo property, object? value)
        {
            if (value == null)
            {
                return null;
            }

            var propertyName = property.Name;
            if (!string.Equals(propertyName, "Department", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(propertyName, "DivisiDepartment", StringComparison.OrdinalIgnoreCase))
            {
                return value;
            }

            if (value is not string textValue)
            {
                return value;
            }

            return HumanDepartmentCanonicalHelper.NormalizeComparisonBucket(textValue)
                   ?? HumanDepartmentCanonicalHelper.NormalizeDisplayValue(textValue)
                   ?? textValue.Trim();
        }

        private static string NormalizeComparableText(string value) =>
            ComparableWhitespaceRegex
                .Replace(
                    RichTextTagRegex
                        .Replace(value ?? string.Empty, string.Empty)
                        .Replace("\r\n", "\n")
                        .Replace('\r', '\n'),
                    " ")
                .Trim();

        private static bool TryNormalizeLegacyProcurementKeterangan(string? rawValue, out string normalized)
        {
            normalized = string.Empty;
            if (string.IsNullOrWhiteSpace(rawValue))
            {
                return false;
            }

            var lineNormalized = rawValue
                .Replace("\r\n", "\n", StringComparison.Ordinal)
                .Replace('\r', '\n');

            if (!lineNormalized.Contains("\n\n", StringComparison.Ordinal))
            {
                return false;
            }

            var parts = lineNormalized
                .Split("\n\n", StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length < 2)
            {
                return false;
            }

            var candidate = parts[^1].Trim();
            if (string.IsNullOrWhiteSpace(candidate))
            {
                return false;
            }

            if (string.Equals(rawValue.Trim(), candidate, StringComparison.Ordinal))
            {
                return false;
            }

            normalized = candidate;
            return true;
        }

        private static int NormalizeLegacyProcurementKeteranganInPlace(IEnumerable<ProcurementItem> items)
        {
            var touched = 0;
            var now = DateTime.UtcNow;

            foreach (var item in items)
            {
                if (!TryNormalizeLegacyProcurementKeterangan(item.Keterangan, out var normalized))
                {
                    continue;
                }

                item.Keterangan = normalized;
                item.UpdatedAt = now;
                touched++;
            }

            return touched;
        }

        private static void SanitizeListAuditEntity(object entity, Type entityType)
        {
            foreach (var propertyName in ListAuditSanitizedStringPropertyNames)
            {
                var property = entityType.GetProperty(
                    propertyName,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                if (property?.PropertyType != typeof(string) || !property.CanRead || !property.CanWrite)
                {
                    continue;
                }

                var currentValue = property.GetValue(entity) as string;
                var sanitizedValue = RichTextTagRegex.Replace(currentValue ?? string.Empty, string.Empty);
                if (!string.Equals(currentValue, sanitizedValue, StringComparison.Ordinal))
                {
                    property.SetValue(entity, sanitizedValue);
                }
            }

            var extraDataProperty = entityType.GetProperty(
                "ExtraData",
                BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

            if (extraDataProperty?.PropertyType != typeof(string) || !extraDataProperty.CanRead || !extraDataProperty.CanWrite)
            {
                return;
            }

            var currentExtraData = extraDataProperty.GetValue(entity) as string;
            var sanitizedExtraData = RichTextTagRegex.Replace(currentExtraData ?? string.Empty, string.Empty);
            if (!string.Equals(currentExtraData, sanitizedExtraData, StringComparison.Ordinal))
            {
                extraDataProperty.SetValue(entity, sanitizedExtraData);
            }
        }

        private static List<string> BuildListAuditPreviewValues(ListAudit entity, IReadOnlyList<string> headers)
        {
            var values = new List<string>(headers.Count);

            foreach (var header in headers)
            {
                if (string.IsNullOrWhiteSpace(header))
                {
                    values.Add(string.Empty);
                    continue;
                }

                if (IsListAuditEvidenceColumn(header))
                {
                    var bytes = typeof(ListAudit)
                        .GetProperty(header, BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance)
                        ?.GetValue(entity) as byte[];
                    values.Add(bytes is { Length: > 0 } ? "Yes" : string.Empty);
                    continue;
                }

                var prop = typeof(ListAudit).GetProperty(
                    header,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
                );

                if (prop == null)
                {
                    values.Add(string.Empty);
                    continue;
                }

                var value = prop.GetValue(entity);
                values.Add(value switch
                {
                    null => string.Empty,
                    DateTime dt => dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    DateTimeOffset dto => dto.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    _ => value.ToString() ?? string.Empty
                });
            }

            return values;
        }

        private static List<string> BuildWeeklyTablePreviewValues(WeeklyTable entity, IReadOnlyList<string> headers)
        {
            var values = new List<string>(headers.Count);

            foreach (var header in headers)
            {
                if (string.IsNullOrWhiteSpace(header))
                {
                    values.Add(string.Empty);
                    continue;
                }

                var prop = typeof(WeeklyTable).GetProperty(
                    header,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                if (prop == null)
                {
                    values.Add(string.Empty);
                    continue;
                }

                var value = prop.GetValue(entity);
                values.Add(value switch
                {
                    null => string.Empty,
                    DateTime dt => dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    DateTimeOffset dto => dto.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    _ => value.ToString() ?? string.Empty
                });
            }

            return values;
        }

        private static List<string> BuildDynamicPreviewValues(
            object entity,
            Type entityType,
            IReadOnlyList<string> headers)
        {
            var values = new List<string>(headers.Count);

            foreach (var header in headers)
            {
                var prop = entityType.GetProperty(
                    header,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                if (prop == null)
                {
                    values.Add(string.Empty);
                    continue;
                }

                var value = prop.GetValue(entity);
                values.Add(value switch
                {
                    null => string.Empty,
                    DateTime dt => dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    DateTimeOffset dto => dto.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    _ => value.ToString() ?? string.Empty
                });
            }

            return values;
        }

        private static void ApplyWeeklyTableInsertDefaults(WeeklyTable entity)
        {
            var now = DateTime.UtcNow;
            entity.LogicalRowKey = entity.LogicalRowKey == Guid.Empty ? Guid.NewGuid() : entity.LogicalRowKey;
            entity.CreatedAt ??= now;
            entity.UpdatedAt = now;
        }

        private static void ApplyWeeklyTableBusinessDefaults(WeeklyTable entity)
        {
            var normalizedStatus = string.IsNullOrWhiteSpace(entity.Status)
                ? null
                : entity.Status.Trim();

            if (normalizedStatus != null)
            {
                entity.Status = normalizedStatus;
            }

            if (string.IsNullOrWhiteSpace(entity.Progress) &&
                normalizedStatus != null &&
                WeeklyStatusProgressMap.TryGetValue(normalizedStatus, out var mappedProgress))
            {
                entity.Progress = mappedProgress;
            }
        }

        private static void SetDateTimeProperty(
            object entity,
            Type entityType,
            string propertyName,
            DateTime value,
            bool onlyIfUnset)
        {
            var prop = entityType.GetProperty(
                propertyName,
                BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance
            );

            if (prop == null || !prop.CanWrite)
            {
                return;
            }

            var targetType = Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType;
            if (targetType != typeof(DateTime))
            {
                return;
            }

            if (onlyIfUnset)
            {
                var current = prop.GetValue(entity);
                if (current is DateTime dt && dt != default)
                {
                    return;
                }
            }

            prop.SetValue(entity, value);
        }

        private static async Task<List<object>> InvokeToListAsyncAsObjects(MethodInfo toListAsyncMethod, IQueryable query)
        {
            var invoked = toListAsyncMethod.Invoke(
                null,
                new object[] { query, CancellationToken.None }
            );

            if (invoked is not Task task)
            {
                throw new InvalidOperationException("Unable to execute dynamic ToListAsync task.");
            }

            await task;

            var resultProperty = task.GetType().GetProperty("Result");
            var result = resultProperty?.GetValue(task);
            if (result is not IEnumerable enumerable)
            {
                throw new InvalidOperationException("Dynamic ToListAsync did not return an enumerable result.");
            }

            return enumerable.Cast<object>().ToList();
        }

        private static object? GetProcurementFieldValue(ProcurementItem item, string fieldName)
        {
            var canonicalFieldName = ProcurementCanonicalHelper.ResolveCanonicalFieldName(fieldName);
            if (string.IsNullOrWhiteSpace(canonicalFieldName))
            {
                return null;
            }

            var prop = typeof(ProcurementItem).GetProperty(
                canonicalFieldName,
                BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);
            return prop?.GetValue(item);
        }

        private static bool ProcurementFieldMatches(ProcurementItem item, string fieldName, object? expectedValue)
        {
            var current = GetProcurementFieldValue(item, fieldName);
            var currentText = Convert.ToString(current, CultureInfo.InvariantCulture)?.Trim();
            var expectedText = Convert.ToString(expectedValue, CultureInfo.InvariantCulture)?.Trim();

            return string.Equals(currentText, expectedText, StringComparison.OrdinalIgnoreCase);
        }

        private static bool AreProcurementBusinessEquivalent(ProcurementItem left, ProcurementItem right)
        {
            foreach (var column in ProcurementBusinessCompareColumns)
            {
                var leftValue = GetProcurementFieldValue(left, column);
                var rightValue = GetProcurementFieldValue(right, column);
                if (!AreEquivalentValues(leftValue, rightValue))
                {
                    return false;
                }
            }

            return true;
        }

        private static bool HasProcurementImportChanges(ProcurementItem current, ProcurementItem incoming) =>
            !AreProcurementBusinessEquivalent(current, incoming);

        private static List<string> BuildProcurementPreviewValues(ProcurementItem entity, IReadOnlyList<string> headers)
        {
            var values = new List<string>(headers.Count);

            foreach (var header in headers)
            {
                var canonical = ProcurementCanonicalHelper.ResolveCanonicalFieldName(header);
                if (string.IsNullOrWhiteSpace(canonical) || ProcurementCanonicalHelper.IsProtectedField(canonical))
                {
                    values.Add(string.Empty);
                    continue;
                }

                var prop = typeof(ProcurementItem).GetProperty(
                    canonical,
                    BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);

                if (prop == null)
                {
                    values.Add(string.Empty);
                    continue;
                }

                var value = prop.GetValue(entity);
                values.Add(value switch
                {
                    null => string.Empty,
                    DateTime dt => dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    DateTimeOffset dto => dto.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    _ => value.ToString() ?? string.Empty
                });
            }

            return values;
        }

        private static void CopyProcurementImportValues(ProcurementItem target, ProcurementItem source)
        {
            target.Department = source.Department;
            target.PIC = source.PIC;
            target.Vendor = source.Vendor;
            target.TipePengadaan = source.TipePengadaan;
            target.Perjanjian = source.Perjanjian;
            target.NilaiPengajuanAPS = source.NilaiPengajuanAPS;
            target.NilaiApproveSTA = source.NilaiApproveSTA;
            target.NilaiKontrak = source.NilaiKontrak;
            target.JenisAnggaran = source.JenisAnggaran;
            target.NoPKS = source.NoPKS;
            target.TglPKS = source.TglPKS;
            target.NoSPK = source.NoSPK;
            target.TglSPK = source.TglSPK;
            target.WaktuMulai = source.WaktuMulai;
            target.JatuhTempo = source.JatuhTempo;
            target.PICPFA = source.PICPFA;
            target.TglKirimkePFA = source.TglKirimkePFA;
            target.Keterangan = source.Keterangan;
            target.ExtraData = null;
        }




        // =====================================
        // PRIVATE: Smart Type Conversion
        // =====================================
        private static object? ConvertCellValue(string? raw, Type targetType)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return null;

            raw = raw.Trim();

            // ===============================
            // BIGINT (IDR, MILLION INPUT)
            // ===============================
            if (targetType == typeof(long) || targetType == typeof(long?))
            {
                // normalize Indo decimal → invariant
                var normalized = raw.Replace(",", ".");

                // try parse as decimal first
                if (!decimal.TryParse(
                        normalized,
                        NumberStyles.Any,
                        CultureInfo.InvariantCulture,
                        out var millionValue))
                    return null;

                // convert million → IDR
                return (long)Math.Round(millionValue * 1_000_000m);
            }

            // ===============================
            // DECIMAL (PERCENT AWARE)
            // ===============================
            if (targetType == typeof(decimal) || targetType == typeof(decimal?))
            {
                var s = raw.Trim();

                bool hasPercentSymbol = s.Contains('%');

                // remove percent sign
                s = s.Replace("%", "");

                // normalize decimal separator
                s = s.Replace(",", ".");

                if (!decimal.TryParse(
                        s,
                        NumberStyles.Any,
                        CultureInfo.InvariantCulture,
                        out var dec))
                    return null;

                // 🔥 FIX:
                // If Excel already normalized percent (0.9901) OR original had %
                if (hasPercentSymbol || dec <= 1m)
                {
                    dec *= 100m;
                }

                return dec;
            }


            // ===============================
            // DateTime (existing logic)
            // ===============================
            if (targetType == typeof(DateTime) || targetType == typeof(DateTime?))
            {
                var parsed = ParseFlexibleDate(raw);
                if (parsed != null)
                    return parsed;

                if (double.TryParse(raw, out var serial))
                    return DateTime.FromOADate(serial);

                return null;
            }

            // ===============================
            // Boolean
            // ===============================
            if (targetType == typeof(bool) || targetType == typeof(bool?))
            {
                return raw.Equals("true", StringComparison.OrdinalIgnoreCase)
                    || raw.Equals("yes", StringComparison.OrdinalIgnoreCase)
                    || raw == "1";
            }

            // ===============================
            // Enum
            // ===============================
            if (targetType.IsEnum)
            {
                try { return Enum.Parse(targetType, raw, true); }
                catch { return null; }
            }

            // ===============================
            // Fallback (string etc)
            // ===============================
            return raw;
        }

        // =====================================
        // PRIVATE: Type Resolver (by name)
        // =====================================
        private static Type? ResolveType(string name)
        {
            if (TypesByNameCache.Value.TryGetValue(name, out var type))
            {
                return type;
            }

            return null;
        }

        private static Dictionary<string, Type> BuildTypeMap()
        {
            var result = new Dictionary<string, Type>(StringComparer.OrdinalIgnoreCase);

            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                Type[] types;
                try
                {
                    types = asm.GetTypes();
                }
                catch
                {
                    continue;
                }

                foreach (var type in types)
                {
                    result.TryAdd(type.Name, type);
                }
            }

            return result;
        }

        private static HashSet<Type> BuildDbSetEntityTypes()
        {
            return typeof(AppDbContext)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(property => property.PropertyType.IsGenericType)
                .Select(property => property.PropertyType.GenericTypeArguments[0])
                .ToHashSet();
        }

        private static IReadOnlyList<string> BuildSupportedImportTargetNames()
        {
            return TypesByNameCache.Value.Keys
                .Where(name => name.EndsWith("CreateDto", StringComparison.OrdinalIgnoreCase))
                .Select(name => name[..^"CreateDto".Length])
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name)
                .ToList();
        }


        public static DateTime? ParseFlexibleDate(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return null;

            input = input.Trim().ToUpper();

            // Normalize Indonesian → English months
            var map = new Dictionary<string, string>
    {
          {"JAN", "JAN"},
    {"FEB", "FEB"},
    {"PEB", "FEB"},
    {"MAR", "MAR"},
    {"APR", "APR"},
    {"MEI", "MAY"},
    {"JUN", "JUN"},
    {"JUL", "JUL"},
    {"AGU", "AUG"},
    {"AGS", "AUG"},
    {"AUG", "AUG"},
    {"SEP", "SEP"},
    {"SEPT", "SEP"},
    {"OKT", "OCT"},
    {"OCT", "OCT"},
    {"NOV", "NOV"},
    {"DES", "DEC"},
    {"DEC", "DEC"}
    };

            foreach (var kv in map)
                input = input.Replace(kv.Key, kv.Value);

            // Remove dots
            input = input.Replace(".", "");

            string[] formats =
            {
        "dd/MM/yyyy",
        "d/M/yyyy",
        "dd MMM yyyy",
        "d MMM yyyy",
        "yyyy-MM-dd",
        "MM/dd/yyyy"
    };

            if (DateTime.TryParseExact(
                input,
                formats,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var result))
                return result;

            // Last resort: system parser
            if (DateTime.TryParse(input, out result))
                return result;

            return null;
        }


        private static object? ConvertExtraData(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return null;

            raw = raw.Trim();

            // Try DateTime first
            var dt = ParseFlexibleDate(raw);
            if (dt != null)
                return dt;

            // Try decimal (for numbers or percentages)
            var s = raw.Replace(",", ".");
            bool hasPercent = s.Contains('%');
            s = s.Replace("%", "");
            if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var dec))
            {
                if (hasPercent || dec <= 1m) dec *= 100m;
                return dec;
            }

            // Try boolean
            if (raw.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                raw.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
                raw == "1")
                return true;
            if (raw.Equals("false", StringComparison.OrdinalIgnoreCase) ||
                raw.Equals("no", StringComparison.OrdinalIgnoreCase) ||
                raw == "0")
                return false;

            // Fallback → string
            return raw;
        }





    }






}
