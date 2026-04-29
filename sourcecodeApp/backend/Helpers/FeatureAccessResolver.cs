/*
 * PGH-DOC
 * File: Helpers/FeatureAccessResolver.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika bantu bersama agar kode fitur tetap konsisten.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using System.Text.RegularExpressions;

namespace PGH.Helpers;

public static class FeatureAccessResolver
{
    public const string AccessDeniedMessage = "You do not have access to this resource.";
    public const string AuditStream = "audit";
    public const string ComplianceStream = "compliance";
    public const string PlanningStream = "planning";
    public const string ProcurementStream = "procurement";
    public const string HumanResourceStream = "humanresource";
    public const string EnterpriseStream = "enterprise";
    public const string AdminStream = "admin";

    private static readonly Dictionary<string, string> ControllerStreamMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ChartAudit"] = AuditStream,
        ["CalendarEvents"] = AuditStream,
        ["ListAudit"] = AuditStream,
        ["Timeline"] = AuditStream,

        ["WeeklyTable"] = ComplianceStream,
        ["WeeklyTableInstance"] = ComplianceStream,
        ["Documents"] = ComplianceStream,
        ["DocumentPeriodReportGroup"] = ComplianceStream,
        ["DocumentPeriodReport"] = ComplianceStream,

        ["OpexTemplate"] = PlanningStream,
        ["OpexBudgetGuardrailConfig"] = PlanningStream,
        ["PlanningDashboardTable"] = PlanningStream,
        ["BusinessPlanFile"] = PlanningStream,
        ["BusinessPlanDirectory"] = PlanningStream,

        ["AllProcure"] = ProcurementStream,
        ["APSChart"] = ProcurementStream,
        ["ExistingProcure"] = ProcurementStream,
        ["NewProcure"] = ProcurementStream,
        ["ProcurementItem"] = ProcurementStream,
        ["ProcurementRelation"] = ProcurementStream,
        ["ParentChild"] = ProcurementStream,
        ["StatusPengadaan"] = ProcurementStream,
        ["AllResource"] = HumanResourceStream,
        ["BNU"] = HumanResourceStream,
        ["ChartHuman"] = HumanResourceStream,
        ["FTE"] = HumanResourceStream,
        ["InternalTraining"] = HumanResourceStream,
        ["KebutuhanFTE"] = HumanResourceStream,
        ["KompetensiPegawai"] = HumanResourceStream,
        ["NonFTE"] = HumanResourceStream
    };

    private static readonly Dictionary<string, string> TableStreamMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ListAudit"] = AuditStream,
        ["CalendarEvents"] = AuditStream,

        ["WeeklyTable"] = ComplianceStream,
        ["WeeklyTableInstance"] = ComplianceStream,
        ["Documents"] = ComplianceStream,
        ["DocumentPeriodReportGroup"] = ComplianceStream,
        ["DocumentPeriodReport"] = ComplianceStream,

        ["OpexTemplate"] = PlanningStream,
        ["OpexBudgetGuardrailConfig"] = PlanningStream,
        ["PlanningDashboardTable"] = PlanningStream,
        ["BusinessPlanFile"] = PlanningStream,

        ["AllProcure"] = ProcurementStream,
        ["ExistingProcure"] = ProcurementStream,
        ["NewProcure"] = ProcurementStream,
        ["ProcurementItem"] = ProcurementStream,
        ["ProcurementRelation"] = ProcurementStream,
        ["ParentChild"] = ProcurementStream,
        ["StatusPengadaan"] = ProcurementStream,
        ["StatusPengadaanTemplate"] = ProcurementStream,

        ["FTE"] = HumanResourceStream,
        ["NonFTE"] = HumanResourceStream,
        ["KebutuhanFTE"] = HumanResourceStream,
        ["BNU"] = HumanResourceStream,
        ["InternalTraining"] = HumanResourceStream,
        ["KompetensiPegawai"] = HumanResourceStream
    };

    private static readonly Regex PlanningOpexOverviewRoute = new(
        "^/api/opex/table/[0-9]+/overview$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static readonly Regex PlanningOpexMaxMonthRoute = new(
        "^/api/opex/table/[0-9]+/maxmonth$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static readonly Regex PlanningOpexBudgetGuardrailTargetsRoute = new(
        "^/api/opex/table/[0-9]+/budget-guardrail-targets$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static readonly Regex HumanOverviewRoute = new(
        "^/api/charthuman/overview(?:/[^/]+)?$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static readonly Regex HumanDashboardRoute = new(
        "^/api/charthuman/dashboard(?:/[^/]+)?$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    public static bool IsPublicEndpoint(PathString path) =>
        path.StartsWithSegments("/api/auth/login") ||
        path.StartsWithSegments("/api/auth/refresh");

    public static bool IsSelfServiceAccountEndpoint(HttpRequest request)
    {
        var path = NormalizeRequestPath(request.Path.Value);

        return path switch
        {
            "/api/auth/me" => HttpMethods.IsGet(request.Method),
            "/api/auth/profile" => HttpMethods.IsGet(request.Method) || HttpMethods.IsPatch(request.Method),
            "/api/auth/profile/photo" => HttpMethods.IsPost(request.Method),
            "/api/auth/change-password" => HttpMethods.IsPost(request.Method),
            _ => false
        };
    }

    public static string? ResolveRequestedStream(HttpContext context)
    {
        var controller = context.Request.RouteValues["controller"]?.ToString();
        if (!string.IsNullOrWhiteSpace(controller) &&
            ControllerStreamMap.TryGetValue(controller, out var controllerStream))
        {
            return controllerStream;
        }

        if (string.Equals(controller, "Import", StringComparison.OrdinalIgnoreCase))
        {
            var target = context.Request.RouteValues["target"]?.ToString()
                ?? context.Request.RouteValues["tableName"]?.ToString();

            return ResolveStreamForTable(target);
        }

        if (string.Equals(controller, "ColumnOrder", StringComparison.OrdinalIgnoreCase))
        {
            return ResolveStreamForTable(context.Request.Query["tableName"].ToString());
        }

        if (string.Equals(controller, "ChangeLog", StringComparison.OrdinalIgnoreCase))
        {
            return ResolveStreamForTable(context.Request.RouteValues["tableName"]?.ToString());
        }

        return null;
    }

    public static string? ResolveStreamForTable(string? tableName)
    {
        if (string.IsNullOrWhiteSpace(tableName))
        {
            return null;
        }

        if (TableStreamMap.TryGetValue(tableName.Trim(), out var tableStream))
        {
            return tableStream;
        }

        var normalized = CleanupToken(tableName);

        foreach (var entry in TableStreamMap)
        {
            if (CleanupToken(entry.Key) == normalized)
            {
                return entry.Value;
            }
        }

        return NormalizeStream(tableName);
    }

    public static string? GetUserStream(ClaimsPrincipal user) =>
        GetEffectiveStream(GetUserLevel(user), user.FindFirst("stream")?.Value);

    public static string? GetUserLevel(ClaimsPrincipal user) =>
        NormalizeLevel(user.FindFirst("level")?.Value ?? user.FindFirst(ClaimTypes.Role)?.Value);

    public static string? NormalizeStream(string? value)
    {
        return CleanupToken(value) switch
        {
            "" => null,
            "audit" => AuditStream,
            "streamaudit" => AuditStream,
            "compliance" => ComplianceStream,
            "planning" => PlanningStream,
            "planing" => PlanningStream,
            "planingrealization" => PlanningStream,
            "planingbusinessplan" => PlanningStream,
            "procurement" => ProcurementStream,
            "procure" => ProcurementStream,
            "pengadaan" => ProcurementStream,
            "enterprise" => EnterpriseStream,
            "admin" => AdminStream,
            "humanresource" => HumanResourceStream,
            "humanresources" => HumanResourceStream,
            "human" => HumanResourceStream,
            "hr" => HumanResourceStream,
            "humantraining" => HumanResourceStream,
            _ => null
        };
    }

    public static string? NormalizeLevel(string? value)
    {
        return CleanupToken(value) switch
        {
            "" => null,
            "executive" => "executive",
            "manager" => "manager",
            "admin" => "admin",
            _ => null
        };
    }

    public static string? GetEffectiveStream(string? level, string? stream)
    {
        return NormalizeLevel(level) switch
        {
            "executive" => EnterpriseStream,
            "admin" => AdminStream,
            _ => NormalizeStream(stream)
        };
    }

    public static string ToDisplayStream(string stream) =>
        NormalizeStream(stream) switch
        {
            AuditStream => "Audit",
            ComplianceStream => "Compliance",
            PlanningStream => "Planning",
            ProcurementStream => "Procurement",
            HumanResourceStream => "Human Resource",
            EnterpriseStream => "Enterprise",
            AdminStream => "Admin",
            _ => stream
        };

    public static string ToDisplayLevel(string level) =>
        NormalizeLevel(level) switch
        {
            "executive" => "Executive",
            "manager" => "Manager",
            "admin" => "Admin",
            _ => level
        };

    public static bool IsReadOnlyMethod(string method) =>
        HttpMethods.IsGet(method) ||
        HttpMethods.IsHead(method) ||
        HttpMethods.IsOptions(method);

    public static bool IsReadOnlyRequest(HttpRequest request)
    {
        if (IsReadOnlyMethod(request.Method))
        {
            return true;
        }

        if (!HttpMethods.IsPost(request.Method))
        {
            return false;
        }

        var path = NormalizeRequestPath(request.Path.Value);
        return path.EndsWith("/query", StringComparison.OrdinalIgnoreCase) ||
               path.EndsWith("/export", StringComparison.OrdinalIgnoreCase) ||
               path.EndsWith("/filter-values", StringComparison.OrdinalIgnoreCase);
    }

    public static bool CanPerform(string level, string method)
    {
        if (IsReadOnlyMethod(method))
        {
            return true;
        }

        return NormalizeLevel(level) switch
        {
            "executive" => false,
            "manager" => true,
            "admin" => true,
            _ => false
        };
    }

    public static bool CanMutateComplianceResource(
        ClaimsPrincipal user,
        HttpRequest request,
        string? targetStream)
    {
        if (IsReadOnlyRequest(request))
        {
            return true;
        }

        if (!string.Equals(NormalizeStream(targetStream), ComplianceStream, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (IsAdmin(user))
        {
            return true;
        }

        return IsManager(user) &&
               string.Equals(GetUserStream(user), ComplianceStream, StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsExecutive(ClaimsPrincipal user) =>
        string.Equals(GetUserLevel(user), "executive", StringComparison.OrdinalIgnoreCase);

    public static bool IsManager(ClaimsPrincipal user) =>
        string.Equals(GetUserLevel(user), "manager", StringComparison.OrdinalIgnoreCase);

    public static bool IsAdmin(ClaimsPrincipal user) =>
        string.Equals(GetUserLevel(user), "admin", StringComparison.OrdinalIgnoreCase);

    public static bool HasGlobalStreamAccess(ClaimsPrincipal user) =>
        IsExecutive(user) || IsAdmin(user);

    public static bool CanAccessRequestedStream(ClaimsPrincipal user, string? targetStream)
    {
        if (string.IsNullOrWhiteSpace(targetStream))
        {
            return true;
        }

        if (HasGlobalStreamAccess(user))
        {
            return true;
        }

        var userStream = GetUserStream(user);
        return !string.IsNullOrWhiteSpace(userStream) &&
               string.Equals(userStream, targetStream, StringComparison.OrdinalIgnoreCase);
    }

    public static bool CanAccessRequest(ClaimsPrincipal user, HttpContext context, string? targetStream)
    {
        if (CanAccessRequestedStream(user, targetStream))
        {
            return true;
        }

        return CanManagerAccessCrossStreamSummary(user, context, targetStream);
    }

    public static string? GetUserId(ClaimsPrincipal user) =>
        user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    public static IReadOnlyCollection<string> GetTablesForController(string? controller)
    {
        if (string.IsNullOrWhiteSpace(controller))
        {
            return Array.Empty<string>();
        }

        return controller.Trim() switch
        {
            "AllProcure" => ["ProcurementItem"],
            "NewProcure" => ["ProcurementItem"],
            "ExistingProcure" => ["ProcurementItem"],
            "ParentChild" => ["ProcurementRelation"],
            "AllResource" => ["FTE", "NonFTE"],
            "Documents" => ["Documents"],
            "BusinessPlanDirectory" => ["BusinessPlanFile"],
            "DocumentPeriodReport" => ["DocumentPeriodReport", "DocumentPeriodReportGroup"],
            "Timeline" => ["CalendarEvents"],
            _ when TableStreamMap.ContainsKey(controller.Trim()) => [controller.Trim()],
            _ => Array.Empty<string>()
        };
    }

    public static IReadOnlyCollection<string> GetTablesForStream(string? stream)
    {
        var normalizedStream = NormalizeStream(stream);
        if (normalizedStream == null)
        {
            return Array.Empty<string>();
        }

        if (normalizedStream is EnterpriseStream or AdminStream)
        {
            return TableStreamMap.Keys
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        return TableStreamMap
            .Where(x => string.Equals(x.Value, normalizedStream, StringComparison.OrdinalIgnoreCase))
            .Select(x => x.Key)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static bool CanManagerAccessCrossStreamSummary(
        ClaimsPrincipal user,
        HttpContext context,
        string? targetStream)
    {
        if (!IsManager(user) || !HttpMethods.IsGet(context.Request.Method))
        {
            return false;
        }

        var normalizedTargetStream = NormalizeStream(targetStream);
        if (string.IsNullOrWhiteSpace(normalizedTargetStream))
        {
            return false;
        }

        var userStream = GetUserStream(user);
        if (string.IsNullOrWhiteSpace(userStream))
        {
            return false;
        }

        if (string.Equals(userStream, normalizedTargetStream, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return normalizedTargetStream switch
        {
            AuditStream => IsAllowedAuditDashboardSummary(context.Request),
            ComplianceStream => IsAllowedComplianceDashboardSummary(context.Request),
            ProcurementStream => IsAllowedProcurementDashboardSummary(context.Request),
            HumanResourceStream => IsAllowedHumanDashboardSummary(context.Request),
            PlanningStream => IsAllowedPlanningDashboardSummary(context.Request),
            _ => false
        };
    }

    private static bool IsAllowedAuditDashboardSummary(HttpRequest request)
    {
        var path = NormalizeRequestPath(request.Path.Value);

        return path switch
        {
            "/api/chartaudit/dashboard-all" => true,
            "/api/chartaudit/dashboard-compare" => true,
            "/api/timeline/timeline" => HasAllowedAuditTimelineSummaryQuery(request.Query),
            _ => false
        };
    }

    private static bool IsAllowedComplianceDashboardSummary(HttpRequest request)
    {
        var path = NormalizeRequestPath(request.Path.Value);
        return path switch
        {
            "/api/weeklytable/tables" => HasNoQuery(request) || HasSingleIntegerQuery(request.Query, "periodId"),
            "/api/weeklytable/active-table" => HasNoQuery(request) || HasSingleIntegerQuery(request.Query, "periodId"),
            "/api/weeklytable/status-summary" => HasAllowedWeeklyStatusSummaryQuery(request.Query),
            "/api/documentperiodreport" => HasSingleIntegerQuery(request.Query, "groupId"),
            "/api/documentperiodreport/groups" => HasNoQuery(request),
            "/api/documentperiodreport/active-group" => HasNoQuery(request),
            "/api/documentperiodreport/progress-summary" => HasNoQuery(request),
            _ => false
        };
    }

    private static bool IsAllowedProcurementDashboardSummary(HttpRequest request)
    {
        var path = NormalizeRequestPath(request.Path.Value);
        return path switch
        {
            "/api/apschart/dashboard-summary" => HasNoQuery(request),
            "/api/apschart/chart/overview" => HasNoQuery(request),
            "/api/apschart/chart/duedue" => HasAllowedProcurementDueQuery(request.Query),
            "/api/apschart/chart/by-status" => HasNoQuery(request),
            "/api/apschart/combined-status" => HasAllowedProcurementCombinedStatusQuery(request.Query),
            "/api/apschart/checkpoint-funnel" => HasAllowedProcurementCheckpointFunnelQuery(request.Query),
            "/api/apschart/reminders/counts" => HasNoQuery(request),
            _ => false
        };
    }

    private static bool IsAllowedHumanDashboardSummary(HttpRequest request)
    {
        var path = NormalizeRequestPath(request.Path.Value);

        if ((HumanOverviewRoute.IsMatch(path) || HumanDashboardRoute.IsMatch(path)) && HasNoQuery(request))
        {
            return true;
        }

        return false;
    }

    private static bool IsAllowedPlanningDashboardSummary(HttpRequest request)
    {
        var path = NormalizeRequestPath(request.Path.Value);

        if (path == "/api/planningdashboardtable/tables" ||
            path == "/api/planningdashboardtable/active-table")
        {
            return HasExactScopeQuery(request.Query, "scope", "opex");
        }

        if (path == "/api/opex/home-summary")
        {
            return HasNoQuery(request);
        }

        if (PlanningOpexMaxMonthRoute.IsMatch(path))
        {
            return HasSingleIntegerQuery(request.Query, "year");
        }

        if (PlanningOpexBudgetGuardrailTargetsRoute.IsMatch(path))
        {
            return HasSingleIntegerQuery(request.Query, "year");
        }

        if (PlanningOpexOverviewRoute.IsMatch(path))
        {
            return HasAllowedPlanningOverviewQuery(request.Query);
        }

        return false;
    }

    private static bool HasSingleIntegerQuery(IQueryCollection query, string key)
    {
        if (query.Count != 1 ||
            !query.TryGetValue(key, out var values) ||
            values.Count != 1 ||
            !int.TryParse(values[0], out _))
        {
            return false;
        }

        return true;
    }

    private static bool HasExactScopeQuery(IQueryCollection query, string key, string value)
    {
        return query.Count == 1 &&
               query.TryGetValue(key, out var values) &&
               values.Count == 1 &&
               string.Equals(values[0], value, StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasAllowedPlanningOverviewQuery(IQueryCollection query)
    {
        foreach (var key in query.Keys)
        {
            var values = query[key];
            if (values.Count != 1)
            {
                return false;
            }

            if (string.Equals(key, "year", StringComparison.OrdinalIgnoreCase))
            {
                if (!int.TryParse(values[0], out _))
                {
                    return false;
                }
                continue;
            }

            if (string.Equals(key, "mode", StringComparison.OrdinalIgnoreCase))
            {
                if ((values[0] ?? string.Empty).ToLowerInvariant() is not "total" and not "monthly")
                {
                    return false;
                }
                continue;
            }

            if (string.Equals(key, "period", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(values[0]))
                {
                    return false;
                }
                continue;
            }

            if (string.Equals(key, "kroonly", StringComparison.OrdinalIgnoreCase))
            {
                if (!bool.TryParse(values[0], out _))
                {
                    return false;
                }
                continue;
            }

            return false;
        }

        return query.TryGetValue("year", out var yearValues) &&
               yearValues.Count == 1 &&
               int.TryParse(yearValues[0], out _);
    }

    private static bool HasNoQuery(HttpRequest request) =>
        request.Query.Count == 0;

    private static bool HasAllowedWeeklyStatusSummaryQuery(IQueryCollection query)
    {
        if (query.Count == 0)
        {
            return true;
        }

        foreach (var key in query.Keys)
        {
            if (!string.Equals(key, "periodId", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(key, "tableId", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var values = query[key];
            if (values.Count != 1 || !long.TryParse(values[0], out _))
            {
                return false;
            }
        }

        return true;
    }

    private static bool HasAllowedAuditTimelineSummaryQuery(IQueryCollection query)
    {
        foreach (var key in query.Keys)
        {
            var values = query[key];
            if (values.Count != 1)
            {
                return false;
            }

            if (string.Equals(key, "mode", StringComparison.OrdinalIgnoreCase))
            {
                if ((values[0] ?? string.Empty).ToLowerInvariant() is not "all"
                    and not "open"
                    and not "inprogress"
                    and not "closed"
                    and not "unknown"
                    and not "anomaly")
                {
                    return false;
                }
                continue;
            }

            if (string.Equals(key, "distinct", StringComparison.OrdinalIgnoreCase))
            {
                if (!bool.TryParse(values[0], out _))
                {
                    return false;
                }
                continue;
            }

            if (string.Equals(key, "type", StringComparison.OrdinalIgnoreCase))
            {
                if ((values[0] ?? string.Empty).ToLowerInvariant() is not "all"
                    and not "internal"
                    and not "external")
                {
                    return false;
                }
                continue;
            }

            if (string.Equals(key, "rangeStart", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(key, "rangeEnd", StringComparison.OrdinalIgnoreCase))
            {
                if (!DateOnly.TryParse(values[0], out _))
                {
                    return false;
                }
                continue;
            }

            return false;
        }

        return true;
    }

    private static bool HasExactQuery(HttpRequest request, params (string Key, string Value)[] expected)
    {
        if (request.Query.Count != expected.Length)
        {
            return false;
        }

        foreach (var (key, value) in expected)
        {
            if (!request.Query.TryGetValue(key, out var values) ||
                values.Count != 1 ||
                !string.Equals(values[0], value, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return true;
    }

    private static bool HasAllowedProcurementDueQuery(IQueryCollection query)
    {
        if (query.Count != 2 ||
            !query.TryGetValue("months", out var monthValues) ||
            !query.TryGetValue("type", out var typeValues) ||
            monthValues.Count != 1 ||
            typeValues.Count != 1)
        {
            return false;
        }

        var validMonth = monthValues[0] is "1" or "3" or "6";
        var validType = (typeValues[0] ?? string.Empty).ToLowerInvariant() is "all" or "new" or "existing";

        return validMonth && validType;
    }

    private static bool HasAllowedProcurementCombinedStatusQuery(IQueryCollection query)
    {
        if (query.Count == 0)
        {
            return true;
        }

        string? type = null;
        string? columnName = null;

        foreach (var key in query.Keys)
        {
            if (string.Equals(key, "type", StringComparison.OrdinalIgnoreCase))
            {
                var values = query[key];
                if (values.Count != 1)
                {
                    return false;
                }

                type = values[0];
                continue;
            }

            if (string.Equals(key, "columnName", StringComparison.OrdinalIgnoreCase))
            {
                var values = query[key];
                if (values.Count != 1)
                {
                    return false;
                }

                columnName = values[0];
                continue;
            }

            return false;
        }

        if (!string.IsNullOrWhiteSpace(type) &&
            type is not "all" and not "new" and not "existing")
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(columnName) &&
            CleanupToken(columnName) != "statuspengadaan")
        {
            return false;
        }

        return true;
    }

    private static bool HasAllowedProcurementCheckpointFunnelQuery(IQueryCollection query)
    {
        if (query.Count == 0)
        {
            return true;
        }

        if (query.Count != 1 || !query.TryGetValue("type", out var values) || values.Count != 1)
        {
            return false;
        }

        return (values[0] ?? string.Empty).ToLowerInvariant() is "all" or "new" or "existing";
    }

    private static string CleanupToken(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return new string(value
            .Where(char.IsLetterOrDigit)
            .Select(char.ToLowerInvariant)
            .ToArray());
    }

    private static string NormalizeRequestPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "/";
        }

        var normalized = value.Trim();
        if (normalized.Length > 1)
        {
            normalized = normalized.TrimEnd('/');
        }

        return normalized.ToLowerInvariant();
    }
}
