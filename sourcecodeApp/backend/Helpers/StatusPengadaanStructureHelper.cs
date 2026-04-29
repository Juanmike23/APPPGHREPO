/*
 * PGH-DOC
 * File: Helpers/StatusPengadaanStructureHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika bantu bersama agar kode fitur tetap konsisten.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using PGH.Models.Procurement;

namespace PGH.Helpers
{
    public static class StatusPengadaanStructureHelper
    {
        public const string DefaultTemplateKey = "DEFAULT";
        public const string NodeSection = "Section";
        public const string NodeStep = "Step";
        public const string NodeItem = "Item";
        public const string NodePoint = "Point";

        public static string NormalizeNodeType(string? nodeType)
        {
            var normalized = string.Concat((nodeType ?? string.Empty).Trim().Where(ch => !char.IsWhiteSpace(ch)))
                .ToLowerInvariant();

            return normalized switch
            {
                "section" => NodeSection,
                "step" => NodeStep,
                "item" => NodeItem,
                "point" => NodePoint,
                _ => string.Empty
            };
        }

        public static bool IsActionableNode(string? nodeType)
        {
            var normalized = NormalizeNodeType(nodeType);
            return normalized == NodePoint;
        }

        public static ISet<long> ResolveActionableTemplateIds(IEnumerable<StatusPengadaanTemplate> templates)
        {
            var activeTemplates = (templates ?? Enumerable.Empty<StatusPengadaanTemplate>())
                .Where(template => template != null && template.IsActive)
                .ToList();

            var childTypesByParent = activeTemplates
                .Where(template => template.ParentTemplateId.HasValue)
                .GroupBy(template => template.ParentTemplateId!.Value)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .Select(child => NormalizeNodeType(child.NodeType))
                        .Where(nodeType => !string.IsNullOrWhiteSpace(nodeType))
                        .ToList());

            var actionableIds = new HashSet<long>();

            foreach (var template in activeTemplates)
            {
                var normalizedNodeType = NormalizeNodeType(template.NodeType);
                if (normalizedNodeType == NodePoint)
                {
                    actionableIds.Add(template.Id);
                    continue;
                }

                childTypesByParent.TryGetValue(template.Id, out var childTypes);
                childTypes ??= new List<string>();

                if (normalizedNodeType == NodeItem)
                {
                    var hasPointChildren = childTypes.Any(childType => childType == NodePoint);
                    if (!hasPointChildren)
                    {
                        actionableIds.Add(template.Id);
                    }

                    continue;
                }

                if (normalizedNodeType == NodeStep)
                {
                    var hasChecklistChildren = childTypes.Any(childType =>
                        childType == NodeItem || childType == NodePoint);

                    if (!hasChecklistChildren)
                    {
                        actionableIds.Add(template.Id);
                    }
                }
            }

            return actionableIds;
        }

        public static string InferNodeType(
            string? legacyNo,
            string? legacyAlur,
            string? title = null)
        {
            var no = (legacyNo ?? string.Empty).Trim();
            var alur = (legacyAlur ?? string.Empty).Trim();
            var currentTitle = (title ?? string.Empty).Trim();

            if (RegexIsSingleLetter(no))
            {
                return NodeSection;
            }

            if (RegexIsNumber(no))
            {
                return NodeStep;
            }

            if (RegexIsLetterDot(alur) || RegexIsLetterDot(currentTitle))
            {
                return NodeItem;
            }

            return NodePoint;
        }

        public static void NormalizeTemplateRow(StatusPengadaanTemplate row)
        {
            row.TemplateKey = string.IsNullOrWhiteSpace(row.TemplateKey)
                ? DefaultTemplateKey
                : row.TemplateKey.Trim().ToUpperInvariant();

            row.NodeType = NormalizeNodeType(row.NodeType);
            if (string.IsNullOrWhiteSpace(row.NodeType))
            {
                row.NodeType = InferNodeType(row.No, row.AlurPengadaanIT, row.Title);
            }

            row.Code = string.IsNullOrWhiteSpace(row.Code)
                ? DeriveCode(row)
                : row.Code.Trim();

            row.Title = string.IsNullOrWhiteSpace(row.Title)
                ? DeriveTitle(row)
                : row.Title.Trim();

            var normalizedNodeType = NormalizeNodeType(row.NodeType);
            if (normalizedNodeType == NodeSection || normalizedNodeType == NodeStep || normalizedNodeType == NodeItem)
            {
                row.DenganDetail = null;
                row.Persetujuan = null;
                row.Status = null;
            }
            else if (normalizedNodeType == NodePoint)
            {
                row.DenganDetail = null;
            }

            SyncLegacyFields(row);
        }

        public static StatusPengadaan CreateProgressRow(StatusPengadaanTemplate template, ProcurementItem item)
        {
            NormalizeTemplateRow(template);

            return new StatusPengadaan
            {
                TemplateNodeId = template.Id,
                ProcurementItemId = item.Id,
                NewID = ProcurementCanonicalHelper.NormalizeSourceType(item.SourceType) == ProcurementCanonicalHelper.SourceNew
                    ? item.Id
                    : null,
                ExistingID = ProcurementCanonicalHelper.NormalizeSourceType(item.SourceType) == ProcurementCanonicalHelper.SourceExisting
                    ? item.Id
                    : null,
                No = template.No,
                AlurPengadaanIT = template.AlurPengadaanIT,
                DenganDetail = template.DenganDetail,
                Persetujuan = template.Persetujuan,
                Status = IsActionableNode(template.NodeType)
                    ? (string.IsNullOrWhiteSpace(template.Status) ? "Not Yet" : template.Status)
                    : template.Status,
                ExtraData = template.ExtraData
            };
        }

        public static string DeriveCode(StatusPengadaanTemplate row)
        {
            var nodeType = NormalizeNodeType(row.NodeType);
            if (nodeType == NodeSection || nodeType == NodeStep)
            {
                return (row.No ?? string.Empty).Trim();
            }

            if (nodeType == NodeItem)
            {
                return ExtractLetterDotCode(row.AlurPengadaanIT) ?? ExtractLetterDotCode(row.Title) ?? string.Empty;
            }

            return string.Empty;
        }

        public static string DeriveTitle(StatusPengadaanTemplate row)
        {
            var nodeType = NormalizeNodeType(row.NodeType);
            if (nodeType == NodeSection || nodeType == NodeStep)
            {
                return (row.AlurPengadaanIT ?? string.Empty).Trim();
            }

            if (nodeType == NodeItem)
            {
                return ExtractLetterDotTitle(row.AlurPengadaanIT)
                    ?? ExtractLetterDotTitle(row.Title)
                    ?? (row.AlurPengadaanIT ?? row.Title ?? string.Empty).Trim();
            }

            return (row.Title ?? row.DenganDetail ?? row.Persetujuan ?? string.Empty).Trim();
        }

        public static void SyncLegacyFields(StatusPengadaanTemplate row)
        {
            var nodeType = NormalizeNodeType(row.NodeType);
            var code = (row.Code ?? string.Empty).Trim();
            var title = (row.Title ?? string.Empty).Trim();

            if (nodeType == NodeSection || nodeType == NodeStep)
            {
                row.No = code;
                row.AlurPengadaanIT = title;
                return;
            }

            row.No = null;

            if (nodeType == NodeItem)
            {
                row.AlurPengadaanIT = string.IsNullOrWhiteSpace(code)
                    ? title
                    : $"{code}. {title}".Trim();
                return;
            }

            row.AlurPengadaanIT = null;
        }

        private static bool RegexIsSingleLetter(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return normalized.Length == 1 && char.IsLetter(normalized[0]);
        }

        private static bool RegexIsNumber(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return normalized.Length > 0 && normalized.All(char.IsDigit);
        }

        private static bool RegexIsLetterDot(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return normalized.Length >= 3 &&
                   char.IsLetter(normalized[0]) &&
                   normalized[1] == '.';
        }

        private static string? ExtractLetterDotCode(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (!RegexIsLetterDot(normalized))
            {
                return null;
            }

            return normalized[..1].ToLowerInvariant();
        }

        private static string? ExtractLetterDotTitle(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (!RegexIsLetterDot(normalized))
            {
                return null;
            }

            var dotIndex = normalized.IndexOf(". ", StringComparison.Ordinal);
            if (dotIndex < 0 || dotIndex + 2 >= normalized.Length)
            {
                return null;
            }

            return normalized[(dotIndex + 2)..].Trim();
        }
    }
}
