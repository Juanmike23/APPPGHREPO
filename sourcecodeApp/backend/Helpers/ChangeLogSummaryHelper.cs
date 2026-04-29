/*
 * PGH-DOC
 * File: Helpers/ChangeLogSummaryHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan parser dan formatter summary change log yang dipakai lintas endpoint.
 * Kenapa perlu:
 * - Perlu agar summary JSON/legacy, label kolom, dan detail perubahan tetap konsisten di seluruh fitur.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System.Text.Json;
using System.Text.RegularExpressions;
using PGH.Dtos.ChangeLog;

namespace PGH.Helpers;

public static class ChangeLogSummaryHelper
{
    private static readonly JsonSerializerOptions SummaryJsonOptions = new(JsonSerializerDefaults.Web);
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
        ["LHA"] = "Evidence LHA"
    };

    public static ChangeLogSummaryResult ParseSummary(string? rawSummary, string? changeType)
    {
        var summaryText = string.IsNullOrWhiteSpace(rawSummary)
            ? BuildDefaultSummary(changeType)
            : rawSummary!.Trim();

        if (summaryText.StartsWith("{", StringComparison.Ordinal))
        {
            try
            {
                var payload = JsonSerializer.Deserialize<ChangeSummaryPayload>(summaryText, SummaryJsonOptions);
                if (payload != null)
                {
                    return FromPayload(payload, changeType);
                }
            }
            catch
            {
            }
        }

        return FromLegacyText(summaryText, changeType);
    }

    public static string BuildDefaultSummary(string? changeType)
    {
        return string.IsNullOrWhiteSpace(changeType)
            ? "Perubahan data tercatat."
            : changeType.Trim().ToUpperInvariant() switch
        {
            "POST" => "Menambahkan baris baru.",
            "DELETE" => "Menghapus baris.",
            "UPDATE" => "Memperbarui data.",
            "IMPORT" => "Import data tercatat.",
            _ => "Perubahan data tercatat."
        };
    }

    public static string GetHumanFriendlyColumnLabel(string? field)
    {
        var raw = string.IsNullOrWhiteSpace(field) ? string.Empty : field.Trim();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return "-";
        }

        if (HumanFriendlyColumnLabels.TryGetValue(raw, out var label))
        {
            return label;
        }

        return Regex.Replace(raw, "([a-z0-9])([A-Z])", "$1 $2")
            .Replace("_", " ")
            .Trim();
    }

    private static ChangeLogSummaryResult FromPayload(ChangeSummaryPayload payload, string? fallbackChangeType)
    {
        var details = (payload.Fields ?? new List<ChangeSummaryFieldPayload>())
            .Select(field => new ChangeLogDetailDto
            {
                Field = field.Field,
                Label = string.IsNullOrWhiteSpace(field.Label)
                    ? GetHumanFriendlyColumnLabel(field.Field)
                    : field.Label!,
                Before = NormalizeDisplayValue(field.Before),
                After = NormalizeDisplayValue(field.After)
            })
            .ToList();

        var display = !string.IsNullOrWhiteSpace(payload.Message)
            ? payload.Message!
            : BuildDefaultSummary(payload.Kind ?? fallbackChangeType);

        return new ChangeLogSummaryResult
        {
            Display = display,
            Details = details
        };
    }

    private static ChangeLogSummaryResult FromLegacyText(string summaryText, string? changeType)
    {
        var fieldMatch = Regex.Match(
            summaryText,
            "Field\\s+'(?<field>[^']+)'\\s+changed\\s+from\\s+'(?<before>[^']*)'\\s+to\\s+'(?<after>[^']*)'",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        if (fieldMatch.Success)
        {
            var field = fieldMatch.Groups["field"].Value;
            var detail = new ChangeLogDetailDto
            {
                Field = field,
                Label = GetHumanFriendlyColumnLabel(field),
                Before = NormalizeDisplayValue(fieldMatch.Groups["before"].Value),
                After = NormalizeDisplayValue(fieldMatch.Groups["after"].Value)
            };

            return new ChangeLogSummaryResult
            {
                Display = $"Mengubah {detail.Label}.",
                Details = new List<ChangeLogDetailDto> { detail }
            };
        }

        return new ChangeLogSummaryResult
        {
            Display = string.IsNullOrWhiteSpace(summaryText)
                ? BuildDefaultSummary(changeType)
                : summaryText,
            Details = new List<ChangeLogDetailDto>()
        };
    }

    private static string? NormalizeDisplayValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private sealed class ChangeSummaryPayload
    {
        public string? Kind { get; init; }
        public string? Message { get; init; }
        public List<ChangeSummaryFieldPayload>? Fields { get; init; }
    }

    private sealed class ChangeSummaryFieldPayload
    {
        public string Field { get; init; } = string.Empty;
        public string? Label { get; init; }
        public string? Before { get; init; }
        public string? After { get; init; }
    }
}

public sealed class ChangeLogSummaryResult
{
    public string Display { get; init; } = string.Empty;
    public List<ChangeLogDetailDto> Details { get; init; } = new();
}
