/*
 * PGH-DOC
 * File: Data/AppDbContext.cs
 * Apa fungsi bagian ini:
 * - File ini mengatur konteks database, mapping tabel, dan lifecycle penyimpanan data.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */


using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using PGH.Helpers;
using PGH.Models;
using PGH.Models.Audit;
using PGH.Models.Compliance;
using PGH.Models.Human;
using PGH.Models.ImportTable;
using PGH.Models.Planing.BusinessPlan;
using PGH.Models.Planing.Realization;
using PGH.Models.Procurement;
using PGH.Models.User;
using PGH.Models.ChangeLog;
using System.IO;
using System.Security.Claims;
using System.Text.Json;
//using refactorbackend.Models.Procurement;
using WebApplication2.Controllers;


namespace WebApplication2.Data
{
    public class AppDbContext : DbContext
    {
        public const string PendingAuditEvidenceChangesItemKey = "__PGH_PENDING_AUDIT_EVIDENCE_CHANGES";
        public const string PendingComplianceDocumentChangesItemKey = "__PGH_PENDING_COMPLIANCE_DOCUMENT_CHANGES";

        private static readonly JsonSerializerOptions ChangeSummaryJsonOptions = new(JsonSerializerDefaults.Web);
        private static readonly HashSet<string> IgnoredAutomaticLogFields = new(StringComparer.OrdinalIgnoreCase)
        {
            "Id",
            "CreatedAt",
            "UpdatedAt",
            "IsDeleted",
            "DeletedAt",
            "DeletedBy",
            "ExtraData",
            "SuggestionSeed",
            "WeeklyPeriodId",
            "WeeklyTableInstanceId",
            "LogicalRowKey",
            "DocumentPeriodReportGroupId"
        };

        private static readonly Dictionary<string, string> HumanFriendlyColumnLabels = new(StringComparer.OrdinalIgnoreCase)
        {
            ["NO"] = "Nomor",
            ["TAHUN"] = "Tahun",
            ["NAMAAUDIT"] = "Nama Audit",
            ["RINGKASANAUDIT"] = "Ringkasan Audit",
            ["PEMANTAUAN"] = "Pemantauan",
            ["JENISAUDIT"] = "Jenis Audit",
            ["SOURCE"] = "Sumber Audit",
            ["PICAUDIT"] = "PIC Audit",
            ["DEPARTMENT"] = "Department",
            ["PICAPLIKASI"] = "PIC Aplikasi",
            ["IN"] = "Tanggal Mulai",
            ["JATUHTEMPO"] = "Jatuh Tempo",
            ["LINK"] = "Link",
            ["STATUS"] = "Status Audit",
            ["KETERANGAN"] = "Keterangan",
            ["RHA"] = "Evidence RHA",
            ["LHA"] = "Evidence LHA",
            ["PeriodName"] = "Nama Event",
            ["Period"] = "Jenis Periode",
            ["Scope"] = "Scope",
            ["TableName"] = "Nama Table",
            ["Year"] = "Tahun",
            ["DocumentToSubmit"] = "Dokumen",
            ["DocumentId"] = "File Dokumen",
            ["ProgressPercent"] = "Progress",
            ["DocumentPeriodReportGroupId"] = "Compliance Events",
            ["FileName"] = "Nama File",
            ["ContentType"] = "Tipe File",
            ["FileSizeBytes"] = "Ukuran File",
            ["SourceType"] = "Source",
            ["ProcurementItemId"] = "Procurement Item",
            ["TemplateNodeId"] = "Template Node",
            ["TemplateKey"] = "Template",
            ["ParentTemplateId"] = "Parent Template Node",
            ["NodeType"] = "Jenis Node",
            ["Code"] = "Kode",
            ["Title"] = "Judul",
            ["SortOrder"] = "Urutan",
            ["IsActive"] = "Aktif",
            ["ChildProcurementItemId"] = "Child Procurement",
            ["ParentProcurementItemId"] = "Parent Procurement",
            ["RelationType"] = "Jenis Relasi",
            ["ConfidenceScore"] = "Confidence Score",
            ["LinkSource"] = "Sumber Link",
            ["project_id"] = "Project ID",
            ["Status_Pengadaan"] = "Status Pengadaan",
            ["TipePengadaan"] = "Tipe Pengadaan",
            ["NilaiPengajuanAPS"] = "Nilai Pengadaan (Pengajuan APS)",
            ["NilaiApproveSTA"] = "Nilai di Approve STA",
            ["PICPFA"] = "PIC PFA",
            ["TglKirimkePFA"] = "Tgl Kirim ke PFA",
            ["SisaBulan"] = "Sisa Bulan",
            ["NoPKS"] = "No PKS",
            ["NoSPK"] = "No SPK",
            ["TglPKS"] = "Tgl PKS",
            ["TglSPK"] = "Tgl SPK",
            ["WaktuMulai"] = "Waktu Mulai",
            ["JatuhTempo"] = "Jatuh Tempo",
            ["JenisAnggaran"] = "Jenis Anggaran",
            ["NilaiKontrak"] = "Nilai Kontrak",
            ["PlanningDashboardTableId"] = "Table Dashboard",
            ["MonthIndex"] = "Bulan",
            ["TargetPct"] = "Target Guardrail (%)",
            ["MataAnggaranParent"] = "Mata Anggaran (Parent)",
            ["MataAnggaranChild"] = "Mata Anggaran (Child)",
            ["RowType"] = "Tipe Baris",
            ["Accumulated"] = "Accumulated",
            ["RealizationLastYearThisMonth"] = "Realisasi Periode Tahun Lalu",
            ["RealizationThisYearThisMonth"] = "Realisasi Periode Tahun Ini",
            ["GrowthRp"] = "Growth (Rp)",
            ["Growth"] = "Growth (%)",
            ["FullYearFY"] = "Full Year (FY)",
            ["toAngThisYear"] = "to Ang Tahun Ini",
            ["toAngYTDThisYear"] = "to Ang YTD Tahun Ini",
            ["SisaFY"] = "Sisa FY",
            ["BusinessPlanFile"] = "File Business Plan"
        };

        private readonly IHttpContextAccessor? _httpContextAccessor;
        private bool _isWritingAutomaticLogs;
        private int _automaticLogSuppressionDepth;



        public AppDbContext(
            DbContextOptions<AppDbContext> options,
            IHttpContextAccessor? httpContextAccessor = null) : base(options)
        {
            _httpContextAccessor = httpContextAccessor;
        }



        //-----------------------------GENERIC MODEL -----------------------------//
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<UserImage> UserImages { get; set; }

        public DbSet<ImportSession> ImportSession { get; set; }
        public DbSet<ImportData> ImportData { get; set; }

        public DbSet<ColumnOrder> ColumnOrders { get; set; }

        public DbSet<ChangeLog> ChangeLog { get; set; }

        //-----------------------------Auit MODEL -----------------------------//
        public DbSet<ListAudit> ListAudit { get; set; }
        public DbSet<CalendarEvents> CalendarEvents { get; set; }

        //-----------------------------Compliance MODEL -----------------------------//
        public DbSet<WeeklyPeriod> WeeklyPeriods { get; set; }
        public DbSet<WeeklyTableInstance> WeeklyTableInstances { get; set; }
        public DbSet<WeeklyTable> WeeklyTable { get; set; }
        public DbSet<DocumentPeriodReportGroup> DocumentPeriodReportGroups { get; set; }
        public DbSet<DocumentPeriodReport> DocumentPeriodReport { get; set; }
        public DbSet<Documents> Documents { get; set; }



        //-----------------------------Procurement MODEL -----------------------------//


        //public DbSet<APS> APS { get; set; }
        public DbSet<ProcurementItem> ProcurementItems { get; set; }
        public DbSet<ProcurementRelation> ProcurementRelations { get; set; }
        public DbSet<StatusPengadaan> StatusPengadaan { get; set; }

        public DbSet<StatusPengadaanTemplate> StatusPengadaanTemplate { get; set; }



        //-----------------------------Planning MODEL -----------------------------//

        public DbSet<OpexTemplate> OpexTemplate { get; set; }
        public DbSet<OpexTemplateMonthlySnapshot> OpexTemplateMonthlySnapshots { get; set; }
        public DbSet<OpexTemplateHeader> OpexTemplateHeaders { get; set; }
        public DbSet<OpexBudgetGuardrailConfig> OpexBudgetGuardrailConfigs { get; set; }

        public DbSet<PlanningDashboardTable> PlanningDashboardTables { get; set; }

        //BusinessPlan (directory)
        public DbSet<BusinessPlanFile> BusinessPlanFile { get; set; }



        //-----------------------------Human Resource MODEL -----------------------------//
        // Human Resource
        public DbSet<FTE> FTE { get; set; }
        public DbSet<NonFTE> NonFTE { get; set; }
        public DbSet<KebutuhanFTE> KebutuhanFTE { get; set; }

        // Human Training
        public DbSet<BNU> BNU { get; set; }
        public DbSet<InternalTraining> InternalTraining { get; set; }
        public DbSet<KompetensiPegawai> KompetensiPegawai { get; set; }

        public override int SaveChanges() =>
            SaveChangesAsync().GetAwaiter().GetResult();

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
            SaveChangesWithAutomaticLogsAsync(cancellationToken);

        public IDisposable SuppressAutomaticLogs()
        {
            _automaticLogSuppressionDepth++;
            return new AutomaticLogSuppressionScope(this);
        }

        private async Task<int> SaveChangesWithAutomaticLogsAsync(CancellationToken cancellationToken)
        {
            if (_isWritingAutomaticLogs || _automaticLogSuppressionDepth > 0)
            {
                return await base.SaveChangesAsync(cancellationToken);
            }

            ApplyManagedTimestamps();
            var pendingLogs = CaptureFeatureChanges();

            var result = await base.SaveChangesAsync(cancellationToken);
            await PersistAutomaticLogsAsync(pendingLogs, cancellationToken);

            return result;
        }

        private void ApplyManagedTimestamps()
        {
            var utcNow = DateTime.UtcNow;

            foreach (var entry in ChangeTracker.Entries()
                         .Where(e => e.State is EntityState.Added or EntityState.Modified))
            {
                if (entry.Entity is ChangeLog)
                {
                    continue;
                }

                HumanDepartmentCanonicalHelper.NormalizeEntityDisplayValues(entry.Entity);

                if (entry.State == EntityState.Added)
                {
                    TrySetManagedTimestamp(entry, "CreatedAt", utcNow, overwrite: false);
                }

                if (entry.Entity is KebutuhanFTE kebutuhanFte)
                {
                    var existingValue = kebutuhanFte.Existing ?? 0;
                    var kebutuhanValue = kebutuhanFte.Kebutuhan ?? 0;
                    kebutuhanFte.Gap = kebutuhanValue > existingValue
                        ? kebutuhanValue - existingValue
                        : 0;
                }

                TrySetManagedTimestamp(entry, "UpdatedAt", utcNow, overwrite: true);
            }
        }

        private static void TrySetManagedTimestamp(
            EntityEntry entry,
            string propertyName,
            DateTime value,
            bool overwrite)
        {
            var property = entry.Properties.FirstOrDefault(item =>
                string.Equals(item.Metadata.Name, propertyName, StringComparison.OrdinalIgnoreCase));

            if (property == null)
            {
                return;
            }

            var clrType = Nullable.GetUnderlyingType(property.Metadata.ClrType) ?? property.Metadata.ClrType;
            if (clrType != typeof(DateTime))
            {
                return;
            }

            if (!overwrite)
            {
                if (property.CurrentValue is DateTime currentDateTime && currentDateTime != default)
                {
                    return;
                }
            }

            property.CurrentValue = value;
        }

        private List<PendingFeatureChange> CaptureFeatureChanges()
        {
            var changes = new List<PendingFeatureChange>();
            var userId = FeatureAccessResolver.GetUserId(_httpContextAccessor?.HttpContext?.User ?? new ClaimsPrincipal());
            var ipAddress = _httpContextAccessor?.HttpContext?.Connection.RemoteIpAddress?.ToString();

            foreach (var entry in ChangeTracker.Entries()
                         .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
            {
                if (entry.Entity is ChangeLog)
                {
                    continue;
                }

                var tableName = entry.Metadata.GetTableName();
                if (string.IsNullOrWhiteSpace(tableName) ||
                    FeatureAccessResolver.ResolveStreamForTable(tableName) == null)
                {
                    continue;
                }

                var changeType = IsSoftDeleteOperation(entry)
                    ? "DELETE"
                    : MapChangeType(entry.State);
                var changeSummary = BuildAutomaticChangeSummary(entry, tableName, changeType);

                if (entry.State == EntityState.Modified && string.IsNullOrWhiteSpace(changeSummary))
                {
                    continue;
                }

                changes.Add(new PendingFeatureChange(
                    entry,
                    tableName,
                    changeType,
                    userId,
                    ipAddress,
                    changeSummary));
            }

            return changes;
        }

        private async Task PersistAutomaticLogsAsync(
            IEnumerable<PendingFeatureChange> pendingChanges,
            CancellationToken cancellationToken)
        {
            var logs = new List<ChangeLog>();

            foreach (var change in pendingChanges)
            {
                if (!TryGetPrimaryKeyValue(change.Entry, out var entityId))
                {
                    continue;
                }

                logs.Add(new ChangeLog
                {
                    TableName = change.TableName,
                    EntityId = entityId,
                    ScopeTableName = ResolveAutomaticScopeTableName(change.Entry, change.TableName),
                    ScopeEntityId = ResolveAutomaticScopeEntityId(change.Entry, change.TableName),
                    ChangedBy = change.UserId,
                    ChangeType = change.ChangeType,
                    ChangeSummary = change.ChangeSummary,
                    Timestamp = DateTime.UtcNow,
                    IPAddress = change.IpAddress
                });
            }

            if (logs.Count == 0)
            {
                return;
            }

            _isWritingAutomaticLogs = true;
            try
            {
                ChangeLog.AddRange(logs);
                await base.SaveChangesAsync(cancellationToken);
            }
            finally
            {
                _isWritingAutomaticLogs = false;
            }
        }

        private static bool TryGetPrimaryKeyValue(EntityEntry entry, out long entityId)
        {
            var pkProperty = entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey());
            if (pkProperty?.CurrentValue == null)
            {
                entityId = 0;
                return false;
            }

            try
            {
                entityId = Convert.ToInt64(pkProperty.CurrentValue);
                return true;
            }
            catch
            {
                entityId = 0;
                return false;
            }
        }

        private static string MapChangeType(EntityState state) =>
            state switch
            {
                EntityState.Added => "POST",
                EntityState.Modified => "UPDATE",
                EntityState.Deleted => "DELETE",
                _ => state.ToString().ToUpperInvariant()
            };

        private static bool IsSoftDeleteOperation(EntityEntry entry)
        {
            if (entry.State != EntityState.Modified)
            {
                return false;
            }

            var isDeletedProperty = entry.Properties.FirstOrDefault(item =>
                string.Equals(item.Metadata.Name, "IsDeleted", StringComparison.OrdinalIgnoreCase));

            if (isDeletedProperty == null)
            {
                return false;
            }

            if (!TryReadBooleanProperty(isDeletedProperty.OriginalValue, out var originalValue) ||
                !TryReadBooleanProperty(isDeletedProperty.CurrentValue, out var currentValue))
            {
                return false;
            }

            return !originalValue && currentValue;
        }

        private static bool TryReadBooleanProperty(object? value, out bool parsedValue)
        {
            switch (value)
            {
                case bool boolValue:
                    parsedValue = boolValue;
                    return true;
                case string text when bool.TryParse(text, out var textValue):
                    parsedValue = textValue;
                    return true;
                default:
                    parsedValue = false;
                    return false;
            }
        }

        private static string? ResolveAutomaticScopeTableName(EntityEntry entry, string tableName)
        {
            if (string.Equals(tableName, "PlanningDashboardTable", StringComparison.OrdinalIgnoreCase))
            {
                return "PlanningDashboardTable";
            }

            if (string.Equals(tableName, "WeeklyTable", StringComparison.OrdinalIgnoreCase))
            {
                return TryGetLongPropertyValue(entry, nameof(PGH.Models.Compliance.WeeklyTable.WeeklyTableInstanceId)).HasValue
                    ? "WeeklyTableInstance"
                    : null;
            }

            if (string.Equals(tableName, "WeeklyTableInstance", StringComparison.OrdinalIgnoreCase))
            {
                return "WeeklyTableInstance";
            }

            if (string.Equals(tableName, "DocumentPeriodReport", StringComparison.OrdinalIgnoreCase))
            {
                return TryGetLongPropertyValue(entry, nameof(PGH.Models.Compliance.DocumentPeriodReport.DocumentPeriodReportGroupId)).HasValue
                    ? "DocumentPeriodReportGroup"
                    : null;
            }

            if (string.Equals(tableName, "DocumentPeriodReportGroup", StringComparison.OrdinalIgnoreCase))
            {
                return "DocumentPeriodReportGroup";
            }

            if (string.Equals(tableName, "OpexTemplate", StringComparison.OrdinalIgnoreCase))
            {
                return TryGetLongPropertyValue(entry, nameof(global::PGH.Models.Planing.Realization.OpexTemplate.PlanningDashboardTableId)).HasValue
                    ? "PlanningDashboardTable"
                    : null;
            }

            return null;
        }

        private static long? ResolveAutomaticScopeEntityId(EntityEntry entry, string tableName)
        {
            if (string.Equals(tableName, "PlanningDashboardTable", StringComparison.OrdinalIgnoreCase) &&
                TryGetPrimaryKeyValue(entry, out var planningTableId))
            {
                return planningTableId;
            }

            if (string.Equals(tableName, "WeeklyTable", StringComparison.OrdinalIgnoreCase))
            {
                return TryGetLongPropertyValue(entry, nameof(PGH.Models.Compliance.WeeklyTable.WeeklyTableInstanceId));
            }

            if (string.Equals(tableName, "WeeklyTableInstance", StringComparison.OrdinalIgnoreCase) &&
                TryGetPrimaryKeyValue(entry, out var scopeEntityId))
            {
                return scopeEntityId;
            }

            if (string.Equals(tableName, "DocumentPeriodReport", StringComparison.OrdinalIgnoreCase))
            {
                return TryGetLongPropertyValue(entry, nameof(PGH.Models.Compliance.DocumentPeriodReport.DocumentPeriodReportGroupId));
            }

            if (string.Equals(tableName, "OpexTemplate", StringComparison.OrdinalIgnoreCase))
            {
                return TryGetLongPropertyValue(entry, nameof(global::PGH.Models.Planing.Realization.OpexTemplate.PlanningDashboardTableId));
            }

            if (string.Equals(tableName, "DocumentPeriodReportGroup", StringComparison.OrdinalIgnoreCase) &&
                TryGetPrimaryKeyValue(entry, out var documentScopeEntityId))
            {
                return documentScopeEntityId;
            }

            return null;
        }

        private static long? TryGetLongPropertyValue(EntityEntry entry, string propertyName)
        {
            var property = entry.Properties.FirstOrDefault(item =>
                string.Equals(item.Metadata.Name, propertyName, StringComparison.OrdinalIgnoreCase));

            if (property == null)
            {
                return null;
            }

            foreach (var candidate in new[] { property.CurrentValue, property.OriginalValue })
            {
                if (candidate == null)
                {
                    continue;
                }

                try
                {
                    return Convert.ToInt64(candidate);
                }
                catch
                {
                }
            }

            return null;
        }

        private string? BuildAutomaticChangeSummary(EntityEntry entry, string tableName, string changeType)
        {
            if (string.Equals(tableName, "WeeklyTableInstance", StringComparison.OrdinalIgnoreCase))
            {
                return BuildWeeklyTableInstanceSummary(entry, changeType);
            }

            if (string.Equals(tableName, "PlanningDashboardTable", StringComparison.OrdinalIgnoreCase))
            {
                return BuildPlanningDashboardTableSummary(entry, changeType);
            }

            if (string.Equals(tableName, "DocumentPeriodReportGroup", StringComparison.OrdinalIgnoreCase))
            {
                return BuildDocumentPeriodReportGroupSummary(entry, changeType);
            }

            if (string.Equals(tableName, "DocumentPeriodReport", StringComparison.OrdinalIgnoreCase))
            {
                var documentPeriodReportSummary = BuildDocumentPeriodReportSummary(entry, changeType);
                if (!string.IsNullOrWhiteSpace(documentPeriodReportSummary))
                {
                    return documentPeriodReportSummary;
                }
            }

            if (string.Equals(tableName, "BusinessPlanFile", StringComparison.OrdinalIgnoreCase))
            {
                var businessPlanFileSummary = BuildBusinessPlanFileSummary(entry, changeType);
                if (!string.IsNullOrWhiteSpace(businessPlanFileSummary))
                {
                    return businessPlanFileSummary;
                }
            }

            if (string.Equals(tableName, "ListAudit", StringComparison.OrdinalIgnoreCase))
            {
                var listAuditSummary = BuildListAuditSummary(entry, changeType);
                if (!string.IsNullOrWhiteSpace(listAuditSummary))
                {
                    return listAuditSummary;
                }
            }

            if (string.Equals(changeType, "POST", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "POST",
                    Message = "Menambahkan baris baru."
                });
            }

            if (string.Equals(changeType, "DELETE", StringComparison.OrdinalIgnoreCase))
            {
                var deletedFields = entry.Properties
                    .Where(ShouldIncludeInAutomaticDeleteLog)
                    .Select(BuildDeletedField)
                    .Where(field => field != null)
                    .Cast<AutomaticChangeField>()
                    .ToList();

                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "DELETE",
                    Message = deletedFields.Count > 0
                        ? "Menghapus baris. Isi terakhir disimpan di detail."
                        : "Menghapus baris.",
                    Fields = deletedFields
                });
            }

            var changedFields = entry.Properties
                .Where(ShouldIncludeInAutomaticLog)
                .Select(BuildChangeField)
                .Where(field => field != null)
                .Cast<AutomaticChangeField>()
                .ToList();

            if (changedFields.Count == 0)
            {
                return null;
            }

            var firstLabel = changedFields[0].Label;
            var message = changedFields.Count switch
            {
                1 => $"Mengubah {firstLabel}.",
                2 => $"Mengubah {firstLabel} dan {changedFields[1].Label}.",
                _ => $"Mengubah {firstLabel} dan {changedFields.Count - 1} kolom lainnya."
            };

            return SerializeSummary(new AutomaticChangeSummaryPayload
            {
                Kind = "UPDATE",
                Message = message,
                Fields = changedFields
            });
        }

        private string? BuildListAuditSummary(EntityEntry entry, string changeType)
        {
            if (string.Equals(changeType, "POST", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(changeType, "DELETE", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var changedFields = entry.Properties
                .Where(ShouldIncludeInAutomaticLog)
                .Select((property) => BuildChangeField(entry, property))
                .Where(field => field != null)
                .Cast<AutomaticChangeField>()
                .ToList();

            if (changedFields.Count == 0)
            {
                return null;
            }

            var evidenceFields = changedFields
                .Where((field) =>
                    string.Equals(field.Field, nameof(global::PGH.Models.Audit.ListAudit.RHA), StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(field.Field, nameof(global::PGH.Models.Audit.ListAudit.LHA), StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (evidenceFields.Count == 1 && changedFields.Count == 1)
            {
                var evidenceField = evidenceFields[0];
                var message = string.IsNullOrWhiteSpace(evidenceField.Before)
                    ? $"Mengunggah {evidenceField.Label}."
                    : $"Memperbarui {evidenceField.Label}.";

                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "UPDATE",
                    Message = message,
                    Fields = changedFields
                });
            }

            var firstLabel = changedFields[0].Label;
            var summaryMessage = changedFields.Count switch
            {
                1 => $"Mengubah {firstLabel}.",
                2 => $"Mengubah {firstLabel} dan {changedFields[1].Label}.",
                _ => $"Mengubah {firstLabel} dan {changedFields.Count - 1} kolom lainnya."
            };

            return SerializeSummary(new AutomaticChangeSummaryPayload
            {
                Kind = "UPDATE",
                Message = summaryMessage,
                Fields = changedFields
            });
        }

        private static string? BuildWeeklyTableInstanceSummary(EntityEntry entry, string changeType)
        {
            var tableName = ReadEntityValue(entry, nameof(WeeklyTableInstance.TableName)) ?? "Belum Diisi";

            if (string.Equals(changeType, "POST", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "POST",
                    Message = $"Menambahkan Weekly Table baru: {tableName}.",
                    Fields = BuildSelectedFields(entry, nameof(WeeklyTableInstance.TableName))
                });
            }

            if (string.Equals(changeType, "DELETE", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "DELETE",
                    Message = $"Menghapus Weekly Table: {tableName}.",
                    Fields = BuildSelectedDeletedFields(entry, nameof(WeeklyTableInstance.TableName))
                });
            }

            var changedFields = BuildSelectedFields(entry, nameof(WeeklyTableInstance.TableName));
            if (changedFields.Count == 0)
            {
                return null;
            }

            return SerializeSummary(new AutomaticChangeSummaryPayload
            {
                Kind = "UPDATE",
                Message = "Mengubah nama Weekly Table.",
                Fields = changedFields
            });
        }

        private static string? BuildPlanningDashboardTableSummary(EntityEntry entry, string changeType)
        {
            var scope = ReadEntityValue(entry, nameof(PlanningDashboardTable.Scope)) ?? "OPEX";
            var year = ReadEntityValue(entry, nameof(PlanningDashboardTable.Year)) ?? "-";
            var tableName = ReadEntityValue(entry, nameof(PlanningDashboardTable.TableName)) ?? "Belum Diisi";

            if (string.Equals(changeType, "POST", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "POST",
                    Message = $"Menambahkan dashboard {scope} tahun {year}: {tableName}.",
                    Fields = BuildSelectedFields(
                        entry,
                        nameof(PlanningDashboardTable.TableName),
                        nameof(PlanningDashboardTable.Year))
                });
            }

            if (string.Equals(changeType, "DELETE", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "DELETE",
                    Message = $"Menghapus dashboard {scope} tahun {year}: {tableName}.",
                    Fields = BuildSelectedDeletedFields(
                        entry,
                        nameof(PlanningDashboardTable.TableName),
                        nameof(PlanningDashboardTable.Year))
                });
            }

            var changedFields = BuildSelectedFields(
                entry,
                nameof(PlanningDashboardTable.TableName),
                nameof(PlanningDashboardTable.Year),
                nameof(PlanningDashboardTable.Scope));

            if (changedFields.Count == 0)
            {
                return null;
            }

            if (changedFields.Count == 1 &&
                string.Equals(changedFields[0].Field, nameof(PlanningDashboardTable.TableName), StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "UPDATE",
                    Message = $"Mengubah nama dashboard {scope} tahun {year}.",
                    Fields = changedFields
                });
            }

            return SerializeSummary(new AutomaticChangeSummaryPayload
            {
                Kind = "UPDATE",
                Message = $"Mengubah dashboard {scope} tahun {year}.",
                Fields = changedFields
            });
        }

        private static string? BuildDocumentPeriodReportGroupSummary(EntityEntry entry, string changeType)
        {
            var eventName = ReadEntityValue(entry, nameof(DocumentPeriodReportGroup.PeriodName)) ?? "Belum Diisi";

            if (string.Equals(changeType, "POST", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "POST",
                    Message = $"Menambahkan Events baru: {eventName}.",
                    Fields = BuildSelectedFields(
                        entry,
                        nameof(DocumentPeriodReportGroup.PeriodName),
                        nameof(DocumentPeriodReportGroup.Period))
                });
            }

            if (string.Equals(changeType, "DELETE", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "DELETE",
                    Message = $"Menghapus Events: {eventName}.",
                    Fields = BuildSelectedDeletedFields(
                        entry,
                        nameof(DocumentPeriodReportGroup.PeriodName),
                        nameof(DocumentPeriodReportGroup.Period))
                });
            }

            var changedFields = BuildSelectedFields(
                entry,
                nameof(DocumentPeriodReportGroup.PeriodName),
                nameof(DocumentPeriodReportGroup.Period));

            if (changedFields.Count == 0)
            {
                return null;
            }

            var message = changedFields.Count switch
            {
                1 when string.Equals(changedFields[0].Field, nameof(DocumentPeriodReportGroup.PeriodName), StringComparison.OrdinalIgnoreCase)
                    => "Mengubah nama Events.",
                1 when string.Equals(changedFields[0].Field, nameof(DocumentPeriodReportGroup.Period), StringComparison.OrdinalIgnoreCase)
                    => "Mengubah jenis periode Events.",
                1 => $"Mengubah {changedFields[0].Label} pada Events.",
                2 => "Mengubah nama dan jenis periode Events.",
                _ => $"Mengubah {changedFields[0].Label} dan {changedFields.Count - 1} kolom lainnya pada Events."
            };

            return SerializeSummary(new AutomaticChangeSummaryPayload
            {
                Kind = "UPDATE",
                Message = message,
                Fields = changedFields
            });
        }

        private string? BuildDocumentPeriodReportSummary(EntityEntry entry, string changeType)
        {
            if (!string.Equals(changeType, "UPDATE", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var changedFields = entry.Properties
                .Where(ShouldIncludeInAutomaticLog)
                .Select((property) => BuildChangeField(entry, property))
                .Where(field => field != null)
                .Cast<AutomaticChangeField>()
                .ToList();

            if (changedFields.Count == 0)
            {
                return null;
            }

            var documentField = changedFields.FirstOrDefault((field) =>
                string.Equals(field.Field, nameof(global::PGH.Models.Compliance.DocumentPeriodReport.DocumentId), StringComparison.OrdinalIgnoreCase));

            if (documentField != null && changedFields.Count == 1)
            {
                var message = documentField switch
                {
                    { Before: null, After: not null } => $"Mengunggah {documentField.Label}.",
                    { Before: not null, After: null } => $"Menghapus {documentField.Label}.",
                    { Before: not null, After: not null } => $"Memperbarui {documentField.Label}.",
                    _ => $"Mengubah {documentField.Label}."
                };

                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "UPDATE",
                    Message = message,
                    Fields = changedFields
                });
            }

            var firstLabel = changedFields[0].Label;
            var summaryMessage = changedFields.Count switch
            {
                1 => $"Mengubah {firstLabel}.",
                2 => $"Mengubah {firstLabel} dan {changedFields[1].Label}.",
                _ => $"Mengubah {firstLabel} dan {changedFields.Count - 1} kolom lainnya."
            };

            return SerializeSummary(new AutomaticChangeSummaryPayload
            {
                Kind = "UPDATE",
                Message = summaryMessage,
                Fields = changedFields
            });
        }

        private static string? BuildBusinessPlanFileSummary(EntityEntry entry, string changeType)
        {
            var isFolderPropertyName = nameof(global::PGH.Models.Planing.BusinessPlan.BusinessPlanFile.IsFolder);
            var fileNamePropertyName = nameof(global::PGH.Models.Planing.BusinessPlan.BusinessPlanFile.FileName);
            var contentTypePropertyName = nameof(global::PGH.Models.Planing.BusinessPlan.BusinessPlanFile.ContentType);
            var fileSizeBytesPropertyName = nameof(global::PGH.Models.Planing.BusinessPlan.BusinessPlanFile.FileSizeBytes);

            var isFolder = TryReadBooleanProperty(
                entry.Properties.FirstOrDefault((property) =>
                    string.Equals(property.Metadata.Name, isFolderPropertyName, StringComparison.OrdinalIgnoreCase))?.CurrentValue
                ?? entry.Properties.FirstOrDefault((property) =>
                    string.Equals(property.Metadata.Name, isFolderPropertyName, StringComparison.OrdinalIgnoreCase))?.OriginalValue,
                out var parsedIsFolder)
                && parsedIsFolder;

            var fileName = ReadEntityValue(entry, fileNamePropertyName) ?? "Belum Diisi";
            var subject = isFolder ? "folder" : "file";
            var fieldNames = isFolder
                ? new[] { fileNamePropertyName }
                : new[] { fileNamePropertyName, contentTypePropertyName, fileSizeBytesPropertyName };

            if (string.Equals(changeType, "POST", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "POST",
                    Message = isFolder
                        ? $"Menambahkan folder baru: {fileName}."
                        : $"Mengunggah file baru: {fileName}.",
                    Fields = BuildSelectedFields(entry, fieldNames)
                });
            }

            if (string.Equals(changeType, "DELETE", StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "DELETE",
                    Message = isFolder
                        ? $"Menghapus folder: {fileName}."
                        : $"Menghapus file: {fileName}.",
                    Fields = BuildSelectedDeletedFields(entry, fieldNames)
                });
            }

            var changedFields = BuildSelectedFields(entry, fieldNames);
            if (changedFields.Count == 0)
            {
                return null;
            }

            if (changedFields.Count == 1 &&
                string.Equals(changedFields[0].Field, fileNamePropertyName, StringComparison.OrdinalIgnoreCase))
            {
                return SerializeSummary(new AutomaticChangeSummaryPayload
                {
                    Kind = "UPDATE",
                    Message = isFolder ? "Mengubah nama folder." : "Mengubah nama file.",
                    Fields = changedFields
                });
            }

            return SerializeSummary(new AutomaticChangeSummaryPayload
            {
                Kind = "UPDATE",
                Message = $"Mengubah {subject} Business Plan.",
                Fields = changedFields
            });
        }

        private static List<AutomaticChangeField> BuildSelectedFields(EntityEntry entry, params string[] propertyNames)
        {
            var nameSet = new HashSet<string>(propertyNames, StringComparer.OrdinalIgnoreCase);
            return entry.Properties
                .Where(property => nameSet.Contains(property.Metadata.Name))
                .Select(BuildChangeField)
                .Where(field => field != null)
                .Cast<AutomaticChangeField>()
                .ToList();
        }

        private static List<AutomaticChangeField> BuildSelectedDeletedFields(EntityEntry entry, params string[] propertyNames)
        {
            var nameSet = new HashSet<string>(propertyNames, StringComparer.OrdinalIgnoreCase);
            return entry.Properties
                .Where(property => nameSet.Contains(property.Metadata.Name))
                .Select(BuildDeletedField)
                .Where(field => field != null)
                .Cast<AutomaticChangeField>()
                .ToList();
        }

        private static string? ReadEntityValue(EntityEntry entry, string propertyName)
        {
            var property = entry.Properties.FirstOrDefault((candidate) =>
                string.Equals(candidate.Metadata.Name, propertyName, StringComparison.OrdinalIgnoreCase));

            if (property == null)
            {
                return null;
            }

            return NormalizeChangeValue(property.CurrentValue) ?? NormalizeChangeValue(property.OriginalValue);
        }

        private static bool ShouldIncludeInAutomaticLog(PropertyEntry property)
        {
            var propertyName = property.Metadata.Name;
            if (IgnoredAutomaticLogFields.Contains(propertyName) || property.Metadata.IsPrimaryKey())
            {
                return false;
            }

            return property.IsModified;
        }

        private static bool ShouldIncludeInAutomaticDeleteLog(PropertyEntry property)
        {
            var propertyName = property.Metadata.Name;
            if (IgnoredAutomaticLogFields.Contains(propertyName) || property.Metadata.IsPrimaryKey())
            {
                return false;
            }

            return !string.IsNullOrWhiteSpace(NormalizeChangeValue(property.OriginalValue));
        }

        private static AutomaticChangeField? BuildChangeField(PropertyEntry property)
        {
            if (AreEquivalentValues(property.OriginalValue, property.CurrentValue))
            {
                return null;
            }

            var before = NormalizeChangeValue(property.OriginalValue);
            var after = NormalizeChangeValue(property.CurrentValue);

            if (property.OriginalValue is byte[] originalBytes && property.CurrentValue is byte[] currentBytes)
            {
                before = originalBytes.Length > 0 ? "Terisi" : null;
                after = currentBytes.Length > 0
                    ? (originalBytes.Length > 0 ? "Diperbarui" : "Terisi")
                    : null;
            }

            var propertyName = property.Metadata.Name;
            if (string.Equals(propertyName, nameof(global::PGH.Models.Planing.BusinessPlan.BusinessPlanFile.ContentType), StringComparison.OrdinalIgnoreCase))
            {
                before = BuildFriendlyFileTypeLabel(before);
                after = BuildFriendlyFileTypeLabel(after);
            }

            return new AutomaticChangeField
            {
                Field = propertyName,
                Label = GetHumanFriendlyColumnLabel(propertyName),
                Before = before,
                After = after
            };
        }

        private AutomaticChangeField? BuildChangeField(EntityEntry entry, PropertyEntry property)
        {
            var changeField = BuildChangeField(property);
            if (changeField == null)
            {
                return null;
            }

            var propertyName = property.Metadata.Name;
            var before = changeField.Before;
            var after = changeField.After;
            var evidenceMetadata = TryGetPendingAuditEvidenceChange(entry, propertyName);
            if (evidenceMetadata != null)
            {
                before = property.OriginalValue is byte[] previousBytes && previousBytes.Length > 0
                    ? BuildStoredEvidenceDisplay(previousBytes.Length)
                    : null;
                after = BuildEvidenceMetadataDisplay(evidenceMetadata);
            }
            else if (TryGetPendingDocumentLinkChange(entry, propertyName) is { } documentLinkChange)
            {
                before = documentLinkChange.BeforeDisplay;
                after = documentLinkChange.AfterDisplay;
            }
            else if ((propertyName.Equals(nameof(global::PGH.Models.Audit.ListAudit.RHA), StringComparison.OrdinalIgnoreCase) ||
                     propertyName.Equals(nameof(global::PGH.Models.Audit.ListAudit.LHA), StringComparison.OrdinalIgnoreCase)) &&
                     property.CurrentValue is byte[] currentEvidenceBytes &&
                     currentEvidenceBytes.Length > 0)
            {
                before = property.OriginalValue is byte[] previousEvidenceBytes && previousEvidenceBytes.Length > 0
                    ? BuildStoredEvidenceDisplay(previousEvidenceBytes.Length)
                    : null;
                after = BuildStoredEvidenceDisplay(currentEvidenceBytes.Length);
            }

            return new AutomaticChangeField
            {
                Field = changeField.Field,
                Label = changeField.Label,
                Before = before,
                After = after
            };
        }

        private PendingAuditEvidenceChange? TryGetPendingAuditEvidenceChange(EntityEntry entry, string propertyName)
        {
            if (_httpContextAccessor?.HttpContext?.Items == null ||
                !string.Equals(entry.Metadata.GetTableName(), "ListAudit", StringComparison.OrdinalIgnoreCase) ||
                !TryGetPrimaryKeyValue(entry, out var entityId))
            {
                return null;
            }

            if (!_httpContextAccessor.HttpContext.Items.TryGetValue(PendingAuditEvidenceChangesItemKey, out var rawValue) ||
                rawValue is not List<PendingAuditEvidenceChange> pendingChanges)
            {
                return null;
            }

            return pendingChanges.LastOrDefault((candidate) =>
                candidate.EntityId == entityId &&
                string.Equals(candidate.ColumnName, propertyName, StringComparison.OrdinalIgnoreCase));
        }

        private PendingDocumentLinkChange? TryGetPendingDocumentLinkChange(EntityEntry entry, string propertyName)
        {
            if (_httpContextAccessor?.HttpContext?.Items == null ||
                !string.Equals(entry.Metadata.GetTableName(), "DocumentPeriodReport", StringComparison.OrdinalIgnoreCase) ||
                !TryGetPrimaryKeyValue(entry, out var entityId))
            {
                return null;
            }

            if (!_httpContextAccessor.HttpContext.Items.TryGetValue(PendingComplianceDocumentChangesItemKey, out var rawValue) ||
                rawValue is not List<PendingDocumentLinkChange> pendingChanges)
            {
                return null;
            }

            return pendingChanges.LastOrDefault((candidate) =>
                candidate.EntityId == entityId &&
                string.Equals(candidate.ColumnName, propertyName, StringComparison.OrdinalIgnoreCase));
        }

        private static string BuildEvidenceMetadataDisplay(PendingAuditEvidenceChange metadata)
        {
            var fileName = string.IsNullOrWhiteSpace(metadata.FileName) ? "file-tanpa-nama" : metadata.FileName.Trim();
            var contentType = BuildFriendlyFileTypeLabel(metadata.ContentType, metadata.FileName);
            var fileSize = FormatFileSize(metadata.FileSizeBytes);
            return $"{fileName} ({contentType}, {fileSize})";
        }

        private static string BuildStoredEvidenceDisplay(long fileSizeBytes)
        {
            return $"File evidence tersimpan ({FormatFileSize(fileSizeBytes)})";
        }

        private static string FormatFileSize(long fileSizeBytes)
        {
            if (fileSizeBytes < 1024)
            {
                return $"{fileSizeBytes} B";
            }

            var kiloBytes = fileSizeBytes / 1024d;
            if (kiloBytes < 1024)
            {
                return $"{kiloBytes:0.##} KB";
            }

            var megaBytes = kiloBytes / 1024d;
            return $"{megaBytes:0.##} MB";
        }

        private static AutomaticChangeField? BuildDeletedField(PropertyEntry property)
        {
            var before = NormalizeChangeValue(property.OriginalValue);
            if (string.IsNullOrWhiteSpace(before))
            {
                return null;
            }

            var propertyName = property.Metadata.Name;
            if (string.Equals(propertyName, nameof(global::PGH.Models.Planing.BusinessPlan.BusinessPlanFile.ContentType), StringComparison.OrdinalIgnoreCase))
            {
                before = BuildFriendlyFileTypeLabel(before);
            }

            return new AutomaticChangeField
            {
                Field = propertyName,
                Label = GetHumanFriendlyColumnLabel(propertyName),
                Before = before,
                After = null
            };
        }

        private static string BuildFriendlyFileTypeLabel(string? contentType, string? fileName = null)
        {
            var normalizedContentType = string.IsNullOrWhiteSpace(contentType)
                ? null
                : contentType.Trim().ToLowerInvariant();
            var normalizedExtension = string.IsNullOrWhiteSpace(fileName)
                ? null
                : Path.GetExtension(fileName)?.Trim().ToLowerInvariant();

            var label = normalizedExtension switch
            {
                ".xlsx" => "Excel (.xlsx)",
                ".xls" => "Excel (.xls)",
                ".csv" => "CSV",
                ".pdf" => "PDF",
                ".docx" => "Word (.docx)",
                ".doc" => "Word (.doc)",
                ".pptx" => "PowerPoint (.pptx)",
                ".ppt" => "PowerPoint (.ppt)",
                ".png" => "PNG",
                ".jpg" or ".jpeg" => "JPG",
                ".webp" => "WEBP",
                ".gif" => "GIF",
                ".zip" => "ZIP",
                _ => normalizedContentType switch
                {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => "Excel (.xlsx)",
                    "application/vnd.ms-excel" => "Excel (.xls)",
                    "text/csv" => "CSV",
                    "application/pdf" => "PDF",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => "Word (.docx)",
                    "application/msword" => "Word (.doc)",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation" => "PowerPoint (.pptx)",
                    "application/vnd.ms-powerpoint" => "PowerPoint (.ppt)",
                    "image/png" => "PNG",
                    "image/jpeg" => "JPG",
                    "image/webp" => "WEBP",
                    "image/gif" => "GIF",
                    "application/zip" or "application/x-zip-compressed" => "ZIP",
                    _ => null
                }
            };

            if (!string.IsNullOrWhiteSpace(label))
            {
                return label;
            }

            if (!string.IsNullOrWhiteSpace(normalizedExtension))
            {
                return $"File ({normalizedExtension})";
            }

            return "File";
        }

        private static string? NormalizeChangeValue(object? value)
        {
            return value switch
            {
                null => null,
                string text => string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
                DateTime dateTime => dateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                DateTimeOffset dateTimeOffset => dateTimeOffset.UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                bool boolean => boolean ? "Ya" : "Tidak",
                byte[] bytes => bytes.Length == 0 ? null : "Terisi",
                _ => Convert.ToString(value)?.Trim()
            };
        }

        private static bool AreEquivalentValues(object? left, object? right)
        {
            if (left is byte[] leftBytes && right is byte[] rightBytes)
            {
                return leftBytes.SequenceEqual(rightBytes);
            }

            if (left is DateTime leftDateTime && right is DateTime rightDateTime)
            {
                return leftDateTime == rightDateTime;
            }

            return string.Equals(
                NormalizeChangeValue(left),
                NormalizeChangeValue(right),
                StringComparison.Ordinal);
        }

        private static string GetHumanFriendlyColumnLabel(string propertyName)
        {
            if (HumanFriendlyColumnLabels.TryGetValue(propertyName, out var label))
            {
                return label;
            }

            return propertyName
                .Replace("_", " ")
                .Select((ch, index) => index > 0 && char.IsUpper(ch) && !char.IsWhiteSpace(propertyName[index - 1])
                    ? $" {ch}"
                    : ch.ToString())
                .Aggregate(string.Empty, (acc, part) => acc + part)
                .Trim();
        }

        private static string SerializeSummary(AutomaticChangeSummaryPayload payload) =>
            JsonSerializer.Serialize(payload, ChangeSummaryJsonOptions);

        private sealed record PendingFeatureChange(
            EntityEntry Entry,
            string TableName,
            string ChangeType,
            string? UserId,
            string? IpAddress,
            string? ChangeSummary);

        private sealed class AutomaticChangeSummaryPayload
        {
            public string Kind { get; init; } = string.Empty;
            public string? Message { get; init; }
            public List<AutomaticChangeField> Fields { get; init; } = new();
        }

        private sealed class AutomaticChangeField
        {
            public string Field { get; init; } = string.Empty;
            public string Label { get; init; } = string.Empty;
            public string? Before { get; init; }
            public string? After { get; init; }
        }

        public sealed record PendingAuditEvidenceChange(
            long EntityId,
            string ColumnName,
            string FileName,
            string ContentType,
            long FileSizeBytes);

        public sealed record PendingDocumentLinkChange(
            long EntityId,
            string ColumnName,
            string? BeforeDisplay,
            string? AfterDisplay);

        private sealed class AutomaticLogSuppressionScope : IDisposable
        {
            private readonly AppDbContext _dbContext;
            private bool _disposed;

            public AutomaticLogSuppressionScope(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            public void Dispose()
            {
                if (_disposed)
                {
                    return;
                }

                if (_dbContext._automaticLogSuppressionDepth > 0)
                {
                    _dbContext._automaticLogSuppressionDepth--;
                }

                _disposed = true;
            }
        }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {

            //user
            modelBuilder.Entity<UserImage>()
    .HasOne(img => img.User)
    .WithMany(u => u.Images)
    .HasForeignKey(img => img.UserId)
    .OnDelete(DeleteBehavior.Cascade);   // 🔥 AUTO DELETE


            modelBuilder.Entity<RefreshToken>(entity =>
            {
                entity.ToTable("RefreshTokens");

                entity.Property(x => x.TokenHash)
                    .HasMaxLength(64)
                    .IsRequired();
                entity.Property(x => x.ReplacedByTokenHash)
                    .HasMaxLength(64);
                entity.Property(x => x.CreatedAt)
                    .HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.IsRevoked)
                    .HasDefaultValue(false);

                // Lookup utama saat refresh.
                entity.HasIndex(x => x.TokenHash)
                    .IsUnique()
                    .HasDatabaseName("UX_RefreshTokens_TokenHash");

                // Optimasi revoke/list token aktif per user.
                entity.HasIndex(x => new { x.UserId, x.IsRevoked, x.ExpiresAt })
                    .HasDatabaseName("IX_RefreshTokens_UserId_IsRevoked_ExpiresAt");
            });

            //Generic Schema
            modelBuilder.Entity<ImportSession>().ToTable("ImportSession", "staging");
            modelBuilder.Entity<ImportData>().ToTable("ImportData", "staging");

            modelBuilder.Entity<ColumnOrder>().ToTable("ColumnOrder"); // 👈 force singular

            modelBuilder.Entity<ChangeLog>(entity =>
            {
                entity.ToTable("ChangeLog", schema: "LogTrail");
                entity.Property(x => x.ScopeTableName).HasMaxLength(128);
                entity.HasIndex(x => new { x.ScopeTableName, x.ScopeEntityId, x.Timestamp });
            });

            //Audit Schema
            modelBuilder.Entity<ListAudit>(entity =>
            {
                entity.ToTable("ListAudit", schema: "Audit");
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            });
            modelBuilder.Entity<CalendarEvents>().ToTable("CalendarEvents", schema: "Audit");


            //Compliance Schema
            modelBuilder.Entity<WeeklyPeriod>(entity =>
            {
                entity.ToTable("WeeklyPeriod", schema: "Compliance");
                entity.Property(x => x.PeriodCode).HasMaxLength(64);
                entity.Property(x => x.DisplayName).HasMaxLength(128);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => x.PeriodCode).IsUnique();
            });

            modelBuilder.Entity<WeeklyTableInstance>(entity =>
            {
                entity.ToTable("WeeklyTableInstance", schema: "Compliance");
                entity.Property(x => x.TableName).HasMaxLength(160);
                entity.Property(x => x.SuggestionSeed);
                entity.Property(x => x.LogicalTableKey).HasDefaultValueSql("NEWID()");
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => x.WeeklyPeriodId);
                entity.HasIndex(x => new { x.WeeklyPeriodId, x.LogicalTableKey });
            });

            modelBuilder.Entity<WeeklyTable>(entity =>
            {
                entity.ToTable("WeeklyTable", schema: "Compliance");
                entity.Property(x => x.LogicalRowKey).HasDefaultValueSql("NEWID()");
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => x.WeeklyPeriodId);
                entity.HasIndex(x => x.WeeklyTableInstanceId);
                entity.HasIndex(x => new { x.WeeklyPeriodId, x.LogicalRowKey });
            });
            modelBuilder.Entity<Documents>().ToTable("Documents", schema: "Compliance");
            modelBuilder.Entity<DocumentPeriodReportGroup>(entity =>
            {
                entity.ToTable("DocumentPeriodReportGroup", schema: "Compliance");
                entity.Property(x => x.PeriodName).HasMaxLength(200);
                entity.Property(x => x.Period).HasMaxLength(64);
                entity.Property(x => x.SuggestionSeed);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => x.CreatedAt);
            });
            modelBuilder.Entity<DocumentPeriodReport>(entity =>
            {
                entity.ToTable("DocumentPeriodReport", schema: "Compliance", tableBuilder =>
                {
                    tableBuilder.HasCheckConstraint(
                        "CK_DocumentPeriodReport_ProgressPercent_Range",
                        "[ProgressPercent] >= 0 AND [ProgressPercent] <= 100");
                });

                entity.Property(x => x.ProgressPercent)
                    .HasPrecision(5, 2)
                    .HasDefaultValue(0m);
                entity.HasIndex(x => x.DocumentPeriodReportGroupId);
            });
            //Procurement Schema
            //modelBuilder.Entity<APS>().ToTable("APS", schema: "Procurement");
            modelBuilder.Entity<ProcurementItem>(entity =>
            {
                entity.ToTable("ProcurementItem", schema: "Procurement");
                entity.Property(x => x.SourceType).HasMaxLength(16);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => new { x.SourceType, x.CreatedAt });
            });
            modelBuilder.Entity<ProcurementRelation>(entity =>
            {
                entity.ToTable("ProcurementRelation", schema: "Procurement", tableBuilder =>
                {
                    tableBuilder.HasCheckConstraint(
                        "CK_ProcurementRelation_Child_Not_Same_As_Parent",
                        "[ChildProcurementItemId] <> [ParentProcurementItemId]");
                });
                entity.Property(x => x.RelationType).HasMaxLength(32);
                entity.Property(x => x.LinkSource).HasMaxLength(32);
                entity.Property(x => x.ConfidenceScore).HasPrecision(5, 2);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => new { x.ChildProcurementItemId, x.RelationType })
                    .IsUnique()
                    .HasDatabaseName("UX_ProcurementRelation_Child_RelationType");
                entity.HasIndex(x => new { x.ParentProcurementItemId, x.RelationType })
                    .HasDatabaseName("IX_ProcurementRelation_Parent_RelationType");
                entity.HasOne(x => x.ChildItem)
                    .WithMany(x => x.ParentRelations)
                    .HasForeignKey(x => x.ChildProcurementItemId)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(x => x.ParentItem)
                    .WithMany(x => x.ChildRelations)
                    .HasForeignKey(x => x.ParentProcurementItemId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            modelBuilder.Entity<StatusPengadaan>(entity =>
            {
                entity.ToTable("StatusPengadaan", schema: "Procurement");
                entity.HasIndex(x => x.ProcurementItemId);
                entity.HasIndex(x => x.TemplateNodeId);
                entity.HasOne<ProcurementItem>()
                    .WithMany(x => x.StatusPengadaanRows)
                    .HasForeignKey(x => x.ProcurementItemId)
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired(false);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            });
            modelBuilder.Entity<StatusPengadaanTemplate>(entity =>
            {
                entity.ToTable("StatusPengadaanTemplate", schema: "Procurement");
                entity.HasIndex(x => new { x.TemplateKey, x.SortOrder });
                entity.HasIndex(x => x.ParentTemplateId);
                entity.Property(x => x.TemplateKey).HasDefaultValue("DEFAULT");
                entity.Property(x => x.IsActive).HasDefaultValue(true);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            });

            //Planing Schema

            modelBuilder.Entity<OpexTemplate>(entity =>
            {
                entity.ToTable("OpexTemplate", schema: "Planing_Realization");

                entity.Property(x => x.SIT).HasMaxLength(64).IsRequired();
                entity.Property(x => x.MataAnggaranParent).HasMaxLength(256);
                entity.Property(x => x.MataAnggaranChild).HasMaxLength(512);
                entity.Property(x => x.RowType).HasMaxLength(16);
                entity.Property(x => x.IsKro).HasDefaultValue(false);

                entity.Property(x => x.Jan).HasPrecision(28, 12);
                entity.Property(x => x.Feb).HasPrecision(28, 12);
                entity.Property(x => x.Mar).HasPrecision(28, 12);
                entity.Property(x => x.Apr).HasPrecision(28, 12);
                entity.Property(x => x.May).HasPrecision(28, 12);
                entity.Property(x => x.Jun).HasPrecision(28, 12);
                entity.Property(x => x.Jul).HasPrecision(28, 12);
                entity.Property(x => x.Aug).HasPrecision(28, 12);
                entity.Property(x => x.Sep).HasPrecision(28, 12);
                entity.Property(x => x.Oct).HasPrecision(28, 12);
                entity.Property(x => x.Nov).HasPrecision(28, 12);
                entity.Property(x => x.Dec).HasPrecision(28, 12);

                entity.Property(x => x.Accumulated).HasPrecision(28, 12);
                entity.Property(x => x.RealizationLastYearThisMonth).HasPrecision(28, 12);
                entity.Property(x => x.RealizationThisYearThisMonth).HasPrecision(28, 12);
                entity.Property(x => x.GrowthRp).HasPrecision(28, 12);
                entity.Property(x => x.Growth).HasPrecision(28, 12);
                entity.Property(x => x.FullYearFY).HasPrecision(28, 12);
                entity.Property(x => x.YTD).HasPrecision(28, 12);
                entity.Property(x => x.toAngThisYear).HasPrecision(28, 12);
                entity.Property(x => x.toAngYTDThisYear).HasPrecision(28, 12);
                entity.Property(x => x.SisaFY).HasPrecision(28, 12);

                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

                entity.HasIndex(x => new { x.PlanningDashboardTableId, x.Year });
                entity.HasIndex(x => new { x.PlanningDashboardTableId, x.Year, x.IsKro });
                entity.HasIndex(x => new { x.PlanningDashboardTableId, x.Year, x.SIT })
                    .IsUnique()
                    .HasFilter("[SIT] IS NOT NULL");

                entity.HasOne(x => x.PlanningDashboardTable)
                    .WithMany()
                    .HasForeignKey(x => x.PlanningDashboardTableId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<OpexTemplateHeader>(entity =>
            {
                entity.ToTable("OpexTemplateHeader", schema: "Planing_Realization");

                entity.Property(x => x.RealizationLastYearLabel).HasMaxLength(256);
                entity.Property(x => x.RealizationThisYearLabel).HasMaxLength(256);
                entity.Property(x => x.GrowthRpLabel).HasMaxLength(256);
                entity.Property(x => x.GrowthPercentLabel).HasMaxLength(256);
                entity.Property(x => x.FullYearFyLabel).HasMaxLength(256);
                entity.Property(x => x.YtdLabel).HasMaxLength(256);
                entity.Property(x => x.ToAngThisYearLabel).HasMaxLength(256);
                entity.Property(x => x.ToAngYtdThisYearLabel).HasMaxLength(256);
                entity.Property(x => x.ReportMonthIndex).HasDefaultValue(12);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

                entity.HasIndex(x => new { x.PlanningDashboardTableId, x.Year }).IsUnique();

                entity.HasOne(x => x.PlanningDashboardTable)
                    .WithMany()
                    .HasForeignKey(x => x.PlanningDashboardTableId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<OpexTemplateMonthlySnapshot>(entity =>
            {
                entity.ToTable("OpexTemplateMonthlySnapshot", schema: "Planing_Realization");

                entity.Property(x => x.SIT).HasMaxLength(64);
                entity.Property(x => x.SnapshotSource).HasMaxLength(16).HasDefaultValue("import");
                entity.Property(x => x.ReportMonthIndex).HasDefaultValue(1);
                entity.Property(x => x.HasRealizationLastYearOverride).HasDefaultValue(false);
                entity.Property(x => x.HasRealizationThisYearOverride).HasDefaultValue(false);
                entity.Property(x => x.HasFullYearFyOverride).HasDefaultValue(false);
                entity.Property(x => x.RealizationLastYearThisMonth).HasPrecision(28, 12);
                entity.Property(x => x.RealizationThisYearThisMonth).HasPrecision(28, 12);
                entity.Property(x => x.FullYearFY).HasPrecision(28, 12);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

                entity.HasIndex(x => new { x.PlanningDashboardTableId, x.Year, x.ReportMonthIndex });
                entity.HasIndex(x => new { x.PlanningDashboardTableId, x.Year, x.ReportMonthIndex, x.SIT })
                    .IsUnique();

                entity.HasOne(x => x.PlanningDashboardTable)
                    .WithMany()
                    .HasForeignKey(x => x.PlanningDashboardTableId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<OpexBudgetGuardrailConfig>(entity =>
            {
                entity.ToTable("OpexBudgetGuardrailConfig", schema: "Planing_Realization");

                entity.Property(x => x.MonthIndex);
                entity.Property(x => x.TargetPct).HasPrecision(9, 4);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

                entity.HasIndex(x => new { x.PlanningDashboardTableId, x.Year, x.MonthIndex })
                    .IsUnique();

                entity.HasOne(x => x.PlanningDashboardTable)
                    .WithMany()
                    .HasForeignKey(x => x.PlanningDashboardTableId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<PlanningDashboardTable>(entity =>
            {
                entity.ToTable("PlanningDashboardTable", schema: "Planing_Realization");
                entity.Property(x => x.Scope).HasMaxLength(16).HasDefaultValue("OPEX");
                entity.Property(x => x.TableName).HasMaxLength(160);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => new { x.Scope, x.TableName })
                    .IsUnique();
                entity.HasIndex(x => new { x.Scope, x.Year })
                    .IsUnique();
                entity.HasIndex(x => new { x.Scope, x.IsDefault })
                    .IsUnique()
                    .HasFilter("[IsDefault] = 1");
            });

            modelBuilder.Entity<BusinessPlanFile>(entity =>
            {
                entity.ToTable("BusinessPlanFile", schema: "Planing_BusinessPlan");
                entity.Property(x => x.FileName).HasMaxLength(512);
                entity.Property(x => x.ContentType).HasMaxLength(256);
                entity.Property(x => x.FileStoragePath).HasMaxLength(1024);
                entity.Property(x => x.FileSizeBytes);
                entity.Property(x => x.IsFolder).HasDefaultValue(false);
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => x.UploadedAt);
                entity.HasIndex(x => x.ParentId);
                entity.HasIndex(x => new { x.ParentId, x.IsFolder, x.FileName });
                entity.HasOne(x => x.Parent)
                    .WithMany(x => x.Children)
                    .HasForeignKey(x => x.ParentId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            //HUMAN SCHEMA
            modelBuilder.Entity<FTE>(entity =>
            {
                entity.ToTable("FTE", "Human_Resource");
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => x.CreatedAt);
            });
            modelBuilder.Entity<NonFTE>(entity =>
            {
                entity.ToTable("NonFTE", "Human_Resource");
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => x.CreatedAt);
            });
            modelBuilder.Entity<KebutuhanFTE>(entity =>
            {
                entity.ToTable("KebutuhanFTE", "Human_Resource");
                entity.Property(x => x.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(x => x.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasIndex(x => x.CreatedAt);
            });

            modelBuilder.Entity<BNU>().ToTable("BNU", "Human_Training");
            modelBuilder.Entity<InternalTraining>().ToTable("InternalTraining", "Human_Training");
            modelBuilder.Entity<KompetensiPegawai>().ToTable("KompetensiPegawai", "Human_Training");
        }



    }
}
