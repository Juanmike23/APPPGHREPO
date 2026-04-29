/*
 * PGH-DOC
 * File: Helpers/ProcurementCanonicalHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika bantu bersama agar kode fitur tetap konsisten.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.EntityFrameworkCore;
using PGH.Dtos.Procurement;
using PGH.Models.Procurement;
using System.Globalization;
using System.Reflection;
using WebApplication2.Data;

namespace PGH.Helpers
{
    public static class ProcurementCanonicalHelper
    {
        public const string SourceNew = "NEW";
        public const string SourceExisting = "EXISTING";

        public static string NormalizeSourceType(string? source)
        {
            var normalized = string.Concat((source ?? string.Empty).Trim().Where(ch => !char.IsWhiteSpace(ch)))
                .ToLowerInvariant();

            return normalized switch
            {
                "new" or "newprocure" => SourceNew,
                "existing" or "existingprocure" or "exs" => SourceExisting,
                _ => SourceNew
            };
        }

        public static string ToLegacySourceName(string? sourceType) =>
            NormalizeSourceType(sourceType) == SourceExisting ? "ExistingProcure" : "NewProcure";

        public static string ToLegacyForeignKey(string? sourceType) =>
            NormalizeSourceType(sourceType) == SourceExisting ? "existingprocure" : "newprocure";

        public static string ToUiSourceLabel(string? sourceType) =>
            NormalizeSourceType(sourceType) == SourceExisting ? "Existing" : "New";

        public static string ResolveSourceTypeForImport(string? tipePengadaan, string? fallbackSourceType)
        {
            if (TryResolveSourceTypeFromTipePengadaan(tipePengadaan, out var sourceType))
            {
                return sourceType;
            }

            return NormalizeSourceType(fallbackSourceType);
        }

        public static bool TryResolveSourceTypeFromTipePengadaan(string? tipePengadaan, out string sourceType)
        {
            var token = NormalizeFieldToken(tipePengadaan);
            if (string.IsNullOrWhiteSpace(token))
            {
                sourceType = string.Empty;
                return false;
            }

            // Keep import behavior aligned with legacy "All Pengadaan" sheet semantics.
            // "Baru" -> NEW, "Perpanjangan"/variants -> EXISTING.
            if (token.Contains("perpanjangan") || token.Contains("existing") || token.StartsWith("exs") || token.Contains("renew"))
            {
                sourceType = SourceExisting;
                return true;
            }

            if (token.Contains("baru") || token.Contains("new"))
            {
                sourceType = SourceNew;
                return true;
            }

            sourceType = string.Empty;
            return false;
        }

        public static bool IsProtectedField(string fieldName)
        {
            if (string.IsNullOrWhiteSpace(fieldName))
            {
                return false;
            }

            return fieldName.Equals("No", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("project_id", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("Status_Pengadaan", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("SisaBulan", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("CreatedAt", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("UpdatedAt", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("Source", StringComparison.OrdinalIgnoreCase)
                   || fieldName.Equals("SourceType", StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeFieldToken(string? fieldName)
        {
            if (string.IsNullOrWhiteSpace(fieldName))
            {
                return string.Empty;
            }

            return new string(fieldName.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        }

        public static string ResolveCanonicalFieldName(string? fieldName)
        {
            var normalized = NormalizeFieldToken(fieldName);

            return normalized switch
            {
                "dept" => nameof(ProcurementItem.Department),
                "department" => nameof(ProcurementItem.Department),
                "jenispengadaan" => nameof(ProcurementItem.TipePengadaan),
                "tipepengadaan" => nameof(ProcurementItem.TipePengadaan),
                "tipe" => nameof(ProcurementItem.TipePengadaan),
                "source" => nameof(ProcurementItem.SourceType),
                "sourcetype" => nameof(ProcurementItem.SourceType),
                "nilaipengadaanpengajuanaps" => nameof(ProcurementItem.NilaiPengajuanAPS),
                "nilaipengajuanaps" => nameof(ProcurementItem.NilaiPengajuanAPS),
                "nilaidiapprovesta" => nameof(ProcurementItem.NilaiApproveSTA),
                "nilaiapprovesta" => nameof(ProcurementItem.NilaiApproveSTA),
                "nilaidisetujuista" => nameof(ProcurementItem.NilaiApproveSTA),
                "nilaikontrakpfa" => nameof(ProcurementItem.NilaiKontrak),
                "picpfa" => nameof(ProcurementItem.PICPFA),
                "tglkirimkepfa" => nameof(ProcurementItem.TglKirimkePFA),
                "keterangan" => nameof(ProcurementItem.Keterangan),
                "projectid" => nameof(ProcurementItem.project_id),
                "statuspengadaan" => nameof(ProcurementItem.Status_Pengadaan),
                "sisabulan" => "SisaBulan",
                "createdat" => nameof(ProcurementItem.CreatedAt),
                "updatedat" => nameof(ProcurementItem.UpdatedAt),
                "nomor" => nameof(ProcurementItem.No),
                _ => fieldName?.Trim() ?? string.Empty
            };
        }

        public static void ApplyPatchToItem(ProcurementItem item, Dictionary<string, object> updates)
        {
            var props = typeof(ProcurementItem).GetProperties(BindingFlags.Public | BindingFlags.Instance);

            foreach (var kv in updates)
            {
                var key = ResolveCanonicalFieldName(kv.Key);
                if (string.IsNullOrWhiteSpace(key) || IsProtectedField(key))
                {
                    continue;
                }

                var prop = props.FirstOrDefault(p => p.Name.Equals(key, StringComparison.OrdinalIgnoreCase));
                if (prop != null && prop.CanWrite && !prop.Name.Equals(nameof(ProcurementItem.ExtraData), StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        prop.SetValue(item, ConvertIncomingValue(kv.Value, prop.PropertyType));
                    }
                    catch
                    {
                    }
                }
            }
        }

        public static async Task ApplyProjectIdentityAsync(AppDbContext db, ProcurementItem row)
        {
            row.CreatedAt ??= DateTime.UtcNow;

            if (!TryGetProjectDepartmentToken(row.Department, out var departmentToken))
            {
                row.No = null;
                row.project_id = null;
                return;
            }

            if (!TryGetProjectTypeToken(row, out var typeToken))
            {
                row.No = null;
                row.project_id = null;
                return;
            }

            var yearToken = ResolveProjectYear(row.CreatedAt);

            var siblings = await db.ProcurementItems
                .AsNoTracking()
                .Where(item =>
                    item.Id != row.Id &&
                    item.Department != null &&
                    item.Department.Trim() != string.Empty)
                .Select(item => new
                {
                    item.Department,
                    item.TipePengadaan,
                    item.No,
                    item.project_id,
                    item.CreatedAt,
                    item.UpdatedAt
                })
                .ToListAsync();

            var maxSequence = siblings
                .Where(item =>
                    string.Equals(item.Department?.Trim(), departmentToken, StringComparison.OrdinalIgnoreCase) &&
                    TryGetProjectTypeToken(item.TipePengadaan, out var siblingTypeToken) &&
                    string.Equals(siblingTypeToken, typeToken, StringComparison.OrdinalIgnoreCase) &&
                    ResolveProjectYear(item.CreatedAt ?? item.UpdatedAt) == yearToken)
                .Select(item => ResolveStoredSequenceValue(item.No, item.project_id))
                .DefaultIfEmpty(0)
                .Max();

            var nextNumber = maxSequence + 1;
            row.No = nextNumber.ToString(CultureInfo.InvariantCulture);
            row.project_id = $"{departmentToken}/{typeToken}/{yearToken}/{nextNumber}";

            if (string.IsNullOrWhiteSpace(row.Status_Pengadaan))
            {
                row.Status_Pengadaan = await ResolveInitialStatusPengadaanAsync(db);
            }
        }

        public static bool TryGetProjectDepartmentToken(string? department, out string token)
        {
            if (string.IsNullOrWhiteSpace(department))
            {
                token = string.Empty;
                return false;
            }

            token = department.Trim().ToUpperInvariant();
            return true;
        }

        public static bool TryGetProjectTypeToken(ProcurementItem row, out string token) =>
            TryGetProjectTypeToken(row.TipePengadaan, out token);

        public static bool TryGetProjectTypeToken(string? typeValue, out string token)
        {
            if (string.IsNullOrWhiteSpace(typeValue))
            {
                token = string.Empty;
                return false;
            }

            token = NormalizeProjectTypeToken(typeValue);
            return !string.IsNullOrWhiteSpace(token);
        }

        public static string NormalizeProjectTypeToken(string? rawValue)
        {
            var normalized = (rawValue ?? string.Empty).Trim().ToUpperInvariant();
            normalized = normalized
                .Replace("/", " ")
                .Replace("_", " ")
                .Replace("-", " ");

            return string.Join(
                "-",
                normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }

        public static int ResolveProjectYear(DateTime? createdAt) =>
            (createdAt ?? DateTime.UtcNow).Year;

        public static int ResolveStoredSequenceValue(string? noValue, string? projectId)
        {
            if (TryParsePositiveInt(noValue, out var direct))
            {
                return direct;
            }

            if (TryParseProjectSequence(projectId, out var derived))
            {
                return derived;
            }

            return 0;
        }

        public static bool TryParsePositiveInt(string? rawValue, out int parsed) =>
            int.TryParse(rawValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed) && parsed > 0;

        public static bool TryParseProjectSequence(string? projectId, out int parsed)
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

        public static NewProcureReadDto ToNewDto(ProcurementItem item) => new()
        {
            Id = item.Id,
            Status_Pengadaan = item.Status_Pengadaan,
            project_id = item.project_id,
            No = item.No,
            Department = item.Department,
            PIC = item.PIC,
            Vendor = item.Vendor,
            TipePengadaan = item.TipePengadaan,
            Perjanjian = item.Perjanjian,
            NilaiPengajuanAPS = item.NilaiPengajuanAPS,
            NilaiApproveSTA = item.NilaiApproveSTA,
            NilaiKontrak = item.NilaiKontrak,
            JenisAnggaran = item.JenisAnggaran,
            NoPKS = item.NoPKS,
            TglPKS = item.TglPKS,
            NoSPK = item.NoSPK,
            TglSPK = item.TglSPK,
            WaktuMulai = item.WaktuMulai,
            JatuhTempo = item.JatuhTempo,
            PICPFA = item.PICPFA,
            TglKirimkePFA = item.TglKirimkePFA,
            Keterangan = item.Keterangan,
            SisaBulan = CalculateRemainingMonths(item.JatuhTempo),
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
        };

        public static ExistingProcureReadDto ToExistingDto(ProcurementItem item) => new()
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
            SisaBulan = CalculateRemainingMonths(item.JatuhTempo),
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
        };

        public static AllProcureBaseDto ToAllDto(ProcurementItem item) => new()
        {
            Id = item.Id,
            Source = ToUiSourceLabel(item.SourceType),
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
            SisaBulan = CalculateRemainingMonths(item.JatuhTempo),
            JenisAnggaran = item.JenisAnggaran,
            NilaiKontrak = item.NilaiKontrak,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
        };

        public static ProcureReminderDto ToReminderDto(ProcurementItem item)
        {
            var now = DateTime.UtcNow;
            var deadline = item.JatuhTempo;
            var daysRemaining = deadline.HasValue ? Math.Max(0, (deadline.Value.Date - now.Date).Days) : 0;
            var monthsRemaining = CalculateRemainingMonths(deadline) ?? 0;
            var colorCode = !deadline.HasValue
                ? "secondary"
                : monthsRemaining <= 1
                    ? "danger"
                    : monthsRemaining <= 3
                        ? "warning"
                        : monthsRemaining <= 6
                            ? "success"
                            : "secondary";
            var statusLabel = !deadline.HasValue
                ? "Tanpa Jatuh Tempo"
                : monthsRemaining <= 1
                    ? "<= 1 Bulan"
                    : monthsRemaining <= 3
                        ? "<= 3 Bulan"
                        : monthsRemaining <= 6
                            ? "<= 6 Bulan"
                            : "> 6 Bulan";

            return new ProcureReminderDto
            {
                Id = item.Id,
                Type = NormalizeSourceType(item.SourceType) == SourceExisting ? "existing" : "new",
                Dept = item.Department,
                PIC = item.PIC,
                Vendor = item.Vendor,
                Perjanjian = item.Perjanjian,
                JatuhTempo = item.JatuhTempo,
                Status_Pengadaan = item.Status_Pengadaan,
                SisaBulan = monthsRemaining,
                DaysRemaining = daysRemaining,
                Countdown = deadline.HasValue ? $"{daysRemaining} days" : "-",
                Status = statusLabel,
                ColorCode = colorCode
            };
        }

        public static int? CalculateRemainingMonths(DateTime? dueDate)
        {
            if (!dueDate.HasValue)
            {
                return null;
            }

            var today = DateTime.UtcNow.Date;
            var target = dueDate.Value.Date;
            return ((target.Year - today.Year) * 12) + target.Month - today.Month;
        }

        private static async Task<string> ResolveInitialStatusPengadaanAsync(AppDbContext db)
        {
            var templates = await db.StatusPengadaanTemplate
                .AsNoTracking()
                .Where(x => x.IsActive && (x.TemplateKey ?? StatusPengadaanStructureHelper.DefaultTemplateKey) == StatusPengadaanStructureHelper.DefaultTemplateKey)
                .OrderBy(x => x.SortOrder ?? int.MaxValue)
                .ThenBy(x => x.Id)
                .ToListAsync();

            if (!templates.Any())
            {
                return "Not Started";
            }

            foreach (var template in templates)
            {
                StatusPengadaanStructureHelper.NormalizeTemplateRow(template);
            }

            var actionableIds = StatusPengadaanStructureHelper.ResolveActionableTemplateIds(templates);
            var firstActionable = templates.FirstOrDefault(template => actionableIds.Contains(template.Id));

            if (firstActionable == null)
            {
                return "Not Started";
            }

            var title = firstActionable.Title
                ?? firstActionable.DenganDetail
                ?? firstActionable.Persetujuan
                ?? firstActionable.AlurPengadaanIT
                ?? string.Empty;

            title = title.Trim();
            return string.IsNullOrWhiteSpace(title) ? "Not Started" : title;
        }

        private static object? ConvertIncomingValue(object? value, Type propertyType)
        {
            if (value == null || value is DBNull)
            {
                return null;
            }

            var targetType = Nullable.GetUnderlyingType(propertyType) ?? propertyType;
            if (targetType == typeof(string))
            {
                return value.ToString();
            }

            if (targetType == typeof(DateTime))
            {
                if (DateTime.TryParse(value.ToString(), out var parsedDate))
                {
                    return DateTime.SpecifyKind(parsedDate, DateTimeKind.Unspecified);
                }

                return null;
            }

            return Convert.ChangeType(value, targetType, CultureInfo.InvariantCulture);
        }
    }
}
