/*
 * PGH-DOC
 * File: Controllers/🧾AuditController/ListAuditController.cs
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
using Newtonsoft.Json.Linq;
using PGH.Dtos.Audit;
using PGH.Dtos.Common;
using PGH.Helpers;
using PGH.Dtos.Planing.Realization;
using PGH.Dtos.Procurement;
using PGH.Models.Audit;
using System.Data;
using System.Globalization;
using System.Linq.Expressions;
using System.Reflection;
using System.Text.RegularExpressions;
using WebApplication2.Data;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ListAuditController : ControllerBase
    {
        private const string SyntheticNumberColumn = "NO";
        private const string DistinctTotalColumn = "Total";
        private const string EmptyFilterToken = "__EMPTY__";
        private const string InvalidStatusFilterToken = "__INVALID_STATUS__";
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
        private static readonly string[] DefaultExportColumns =
        [
            SyntheticNumberColumn,
            nameof(ListAudit.TAHUN),
            nameof(ListAudit.NAMAAUDIT),
            nameof(ListAudit.RINGKASANAUDIT),
            nameof(ListAudit.PEMANTAUAN),
            nameof(ListAudit.JENISAUDIT),
            nameof(ListAudit.SOURCE),
            nameof(ListAudit.PICAUDIT),
            nameof(ListAudit.DEPARTMENT),
            nameof(ListAudit.PICAPLIKASI),
            nameof(ListAudit.IN),
            nameof(ListAudit.JATUHTEMPO),
            nameof(ListAudit.LINK),
            nameof(ListAudit.STATUS),
            nameof(ListAudit.KETERANGAN),
            nameof(ListAudit.CreatedAt),
            nameof(ListAudit.UpdatedAt),
            nameof(ListAudit.RHA),
            nameof(ListAudit.LHA)
        ];
        private static readonly (string Left, string Right)[] PreferredExportColumnPairs =
        [
            (nameof(ListAudit.DEPARTMENT), nameof(ListAudit.PICAPLIKASI))
        ];
        private static readonly Dictionary<string, string> ExportColumnLabels =
            new(StringComparer.OrdinalIgnoreCase)
            {
                [SyntheticNumberColumn] = "Nomor",
                [nameof(ListAudit.TAHUN)] = "Tahun",
                [nameof(ListAudit.NAMAAUDIT)] = "Nama Audit",
                [nameof(ListAudit.RINGKASANAUDIT)] = "Ringkasan Audit",
                [nameof(ListAudit.PEMANTAUAN)] = "Pemantauan",
                [nameof(ListAudit.JENISAUDIT)] = "Jenis Audit",
                [nameof(ListAudit.SOURCE)] = "Source",
                [nameof(ListAudit.PICAUDIT)] = "PIC Audit",
                [nameof(ListAudit.DEPARTMENT)] = "Department",
                [nameof(ListAudit.PICAPLIKASI)] = "PIC Aplikasi",
                [nameof(ListAudit.IN)] = "IN",
                [nameof(ListAudit.JATUHTEMPO)] = "Jatuh Tempo",
                [nameof(ListAudit.LINK)] = "Link",
                [nameof(ListAudit.STATUS)] = "Status",
                [nameof(ListAudit.KETERANGAN)] = "Keterangan",
                [nameof(ListAudit.CreatedAt)] = "CreatedAt",
                [nameof(ListAudit.UpdatedAt)] = "UpdatedAt",
                [nameof(ListAudit.RHA)] = "RHA",
                [nameof(ListAudit.LHA)] = "LHA"
            };
        private static readonly HashSet<string> ReservedExportQueryKeys =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "format",
                "viewKey",
                "type",
                "columns",
                "search",
                "searchColumns"
            };
        private static readonly HashSet<string> AllowedExportFilterColumns =
            new(StringComparer.OrdinalIgnoreCase)
            {
                nameof(ListAudit.TAHUN),
                nameof(ListAudit.NAMAAUDIT),
                nameof(ListAudit.RINGKASANAUDIT),
                nameof(ListAudit.PEMANTAUAN),
                nameof(ListAudit.JENISAUDIT),
                nameof(ListAudit.SOURCE),
                nameof(ListAudit.PICAUDIT),
                nameof(ListAudit.DEPARTMENT),
                nameof(ListAudit.PICAPLIKASI),
                nameof(ListAudit.IN),
                nameof(ListAudit.JATUHTEMPO),
                nameof(ListAudit.LINK),
                nameof(ListAudit.STATUS),
                nameof(ListAudit.KETERANGAN)
            };
        private static readonly HashSet<string> AllowedExportSearchColumns =
            new(StringComparer.OrdinalIgnoreCase)
            {
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
            };
        private static readonly HashSet<string> StringExportFilterColumns =
            new(StringComparer.OrdinalIgnoreCase)
            {
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
            };
        private static readonly HashSet<string> NumericExportFilterColumns =
            new(StringComparer.OrdinalIgnoreCase)
            {
                nameof(ListAudit.TAHUN)
            };
        private static readonly HashSet<string> DateExportFilterColumns =
            new(StringComparer.OrdinalIgnoreCase)
            {
                nameof(ListAudit.IN),
                nameof(ListAudit.JATUHTEMPO)
            };
        private const int MaxQuerySearchLength = 200;
        private static readonly Regex UnsupportedSearchControlCharsRegex =
            new(@"[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]", RegexOptions.Compiled);
        private const int DefaultQueryPageSize = 50;
        private const int MaxQueryPageSize = 200;
        private static readonly HashSet<string> AllowedQuerySortColumns =
            new(StringComparer.OrdinalIgnoreCase)
            {
                nameof(ListAudit.CreatedAt),
                nameof(ListAudit.UpdatedAt),
                nameof(ListAudit.TAHUN),
                nameof(ListAudit.NAMAAUDIT),
                nameof(ListAudit.RINGKASANAUDIT),
                nameof(ListAudit.PEMANTAUAN),
                nameof(ListAudit.JENISAUDIT),
                nameof(ListAudit.SOURCE),
                nameof(ListAudit.PICAUDIT),
                nameof(ListAudit.DEPARTMENT),
                nameof(ListAudit.PICAPLIKASI),
                nameof(ListAudit.IN),
                nameof(ListAudit.JATUHTEMPO),
                nameof(ListAudit.LINK),
                nameof(ListAudit.STATUS),
                nameof(ListAudit.KETERANGAN)
            };
        private static readonly string[] QueryDistinctDisplayColumns =
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
            nameof(ListAudit.IN),
            nameof(ListAudit.JATUHTEMPO),
            nameof(ListAudit.LINK),
            nameof(ListAudit.STATUS),
            nameof(ListAudit.KETERANGAN)
        ];
        private static readonly HashSet<string> AllowedQueryDistinctColumns =
            new(QueryDistinctDisplayColumns, StringComparer.OrdinalIgnoreCase);
        private static readonly TableQuerySchema ListAuditQuerySchema = new(
            displayColumns: QueryDistinctDisplayColumns,
            filterableColumns: AllowedExportFilterColumns,
            searchableColumns: AllowedExportSearchColumns,
            sortableColumns: AllowedQuerySortColumns);
        private static readonly Dictionary<string, PropertyInfo> ListAuditQueryPropertyMap =
            typeof(ListAudit)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .ToDictionary(property => property.Name, StringComparer.OrdinalIgnoreCase);
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;


        public ListAuditController(IConfiguration config, IMapper mapper, AppDbContext db, IWebHostEnvironment env)
        {

            _mapper = mapper;
            _db = db;
            _env = env;

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

        private IQueryable<ListAudit> BuildOrderedListAuditQuery()
        {
            return _db.ListAudit
                .AsNoTracking()
                .OrderByDescending(p => p.CreatedAt)
                .ThenByDescending(p => p.Id);
        }

        private static string NormalizeExportToken(string value) =>
            new string(value.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

        private static string BuildUnsupportedExportFilterOperatorMessage(string filterKey, string operatorToken)
        {
            var canonicalColumn = NormalizeExportColumnKey(filterKey) ?? filterKey.Trim();
            var normalizedOperator = string.IsNullOrWhiteSpace(operatorToken) ? "unknown" : operatorToken.Trim().ToLowerInvariant();
            return $"Unsupported export filter: operator {normalizedOperator} on {canonicalColumn}";
        }

        private static IEnumerable<KeyValuePair<string, string?>> GetExportFiltersFromQuery(IQueryCollection query)
        {
            foreach (var kvp in query)
            {
                if (ReservedExportQueryKeys.Contains(kvp.Key))
                {
                    continue;
                }

                yield return new KeyValuePair<string, string?>(kvp.Key, kvp.Value.FirstOrDefault());
            }
        }

        private static List<string>? ResolveRequestedSearchColumns(IEnumerable<string>? rawSearchColumns)
        {
            if (rawSearchColumns == null)
            {
                return null;
            }

            var selected = new List<string>();
            foreach (var raw in rawSearchColumns)
            {
                if (string.IsNullOrWhiteSpace(raw))
                {
                    continue;
                }

                var splitValues = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var splitValue in splitValues)
                {
                    var key = NormalizeExportColumnKey(splitValue);
                    if (key == null ||
                        !AllowedExportSearchColumns.Contains(key) ||
                        selected.Contains(key, StringComparer.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    selected.Add(key);
                }
            }

            return selected.Count == 0 ? null : selected;
        }

        private static string? NormalizeExportColumnKey(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var token = NormalizeExportToken(value);
            return token switch
            {
                "NO" or "NOMOR" => SyntheticNumberColumn,
                "TAHUN" => nameof(ListAudit.TAHUN),
                "NAMAAUDIT" => nameof(ListAudit.NAMAAUDIT),
                "RINGKASANAUDIT" => nameof(ListAudit.RINGKASANAUDIT),
                "PEMANTAUAN" => nameof(ListAudit.PEMANTAUAN),
                "JENISAUDIT" => nameof(ListAudit.JENISAUDIT),
                "SOURCE" => nameof(ListAudit.SOURCE),
                "PICAUDIT" => nameof(ListAudit.PICAUDIT),
                "DEPARTMENT" => nameof(ListAudit.DEPARTMENT),
                "PICAPLIKASI" => nameof(ListAudit.PICAPLIKASI),
                "IN" => nameof(ListAudit.IN),
                "JATUHTEMPO" => nameof(ListAudit.JATUHTEMPO),
                "LINK" => nameof(ListAudit.LINK),
                "STATUS" => nameof(ListAudit.STATUS),
                "KETERANGAN" => nameof(ListAudit.KETERANGAN),
                "CREATEDAT" => nameof(ListAudit.CreatedAt),
                "UPDATEDAT" => nameof(ListAudit.UpdatedAt),
                "RHA" => nameof(ListAudit.RHA),
                "LHA" => nameof(ListAudit.LHA),
                _ => DefaultExportColumns.FirstOrDefault(x =>
                    string.Equals(x, value, StringComparison.OrdinalIgnoreCase))
            };
        }

        private static List<string>? ResolveRequestedExportColumns(IEnumerable<string>? rawColumns)
        {
            if (rawColumns == null)
            {
                return null;
            }

            var selected = new List<string>();

            foreach (var raw in rawColumns)
            {
                if (string.IsNullOrWhiteSpace(raw))
                {
                    continue;
                }

                var splitValues = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var splitValue in splitValues)
                {
                    var key = NormalizeExportColumnKey(splitValue);
                    if (key == null || selected.Contains(key, StringComparer.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    selected.Add(key);
                }
            }

            return selected.Count == 0 ? null : selected;
        }

        private async Task<List<string>> ResolveExportColumnsAsync(string viewKey, IEnumerable<string>? rawSelectedColumns)
        {
            var selectedColumns = ResolveRequestedExportColumns(rawSelectedColumns);
            var selectedSet = selectedColumns != null
                ? new HashSet<string>(selectedColumns, StringComparer.OrdinalIgnoreCase)
                : null;
            var orderedColumns = await _db.ColumnOrders
                .AsNoTracking()
                .Where(x => x.TableName == "ListAudit" && x.ViewKey == viewKey)
                .OrderBy(x => x.ColumnIndex)
                .Select(x => x.ColumnKey)
                .ToListAsync();

            var resolved = new List<string>();

            foreach (var rawKey in orderedColumns)
            {
                var key = NormalizeExportColumnKey(rawKey);
                if (key == null ||
                    resolved.Contains(key, StringComparer.OrdinalIgnoreCase) ||
                    (selectedSet != null && !selectedSet.Contains(key)))
                {
                    continue;
                }

                resolved.Add(key);
            }

            foreach (var key in DefaultExportColumns)
            {
                if ((selectedSet == null || selectedSet.Contains(key)) &&
                    !resolved.Contains(key, StringComparer.OrdinalIgnoreCase))
                {
                    resolved.Add(key);
                }
            }

            return NormalizePreferredExportColumnOrder(resolved);
        }

        private static List<string> NormalizePreferredExportColumnOrder(List<string> columns)
        {
            var ordered = columns.ToList();

            foreach (var (left, right) in PreferredExportColumnPairs)
            {
                var leftIndex = ordered.FindIndex(x => string.Equals(x, left, StringComparison.OrdinalIgnoreCase));
                var rightIndex = ordered.FindIndex(x => string.Equals(x, right, StringComparison.OrdinalIgnoreCase));

                if (leftIndex < 0 || rightIndex < 0 || leftIndex < rightIndex)
                {
                    continue;
                }

                var leftValue = ordered[leftIndex];
                ordered.RemoveAt(leftIndex);
                rightIndex = ordered.FindIndex(x => string.Equals(x, right, StringComparison.OrdinalIgnoreCase));
                ordered.Insert(rightIndex, leftValue);
            }

            return ordered;
        }

        private IActionResult? ApplyExportTypeFilter(ref IQueryable<ListAudit> query, string? type)
        {
            type = type?.Trim().ToLowerInvariant();

            if (type == "internal")
            {
                query = query.Where(a =>
                    a.JENISAUDIT != null &&
                    a.JENISAUDIT.Trim().ToLower() == "internal");
            }
            else if (type == "external" || type == "eksternal")
            {
                query = query.Where(a =>
                    a.JENISAUDIT != null &&
                    (a.JENISAUDIT.Trim().ToLower() == "external" ||
                     a.JENISAUDIT.Trim().ToLower() == "eksternal"));
            }
            else if (!string.IsNullOrWhiteSpace(type) && type != "all")
            {
                return BadRequest(new
                {
                    message = $"Invalid type value '{type}'. Must be internal, external, or all."
                });
            }

            return null;
        }

        private static string NormalizeExportFilterMode(string? mode) =>
            string.IsNullOrWhiteSpace(mode) ? "and" : mode.Trim().ToLowerInvariant();

        private static string? NormalizeStructuredExportOperator(string? rawOperator)
        {
            var value = rawOperator?.Trim().ToLowerInvariant();
            return value switch
            {
                null or "" => "=",
                "=" or "==" or "eq" => "=",
                "!=" or "<>" or "ne" => "!=",
                "<" => "<",
                "<=" => "<=",
                ">" => ">",
                ">=" => ">=",
                "contains" => "contains",
                _ => null
            };
        }

        private static string NormalizeQuerySortDirection(string? rawDirection) =>
            string.Equals(rawDirection?.Trim(), "desc", StringComparison.OrdinalIgnoreCase) ? "desc" : "asc";

        private static (int page, int pageSize) NormalizeQueryPaging(int page, int pageSize)
        {
            var normalizedPage = page < 1 ? 1 : page;
            var normalizedPageSize = pageSize <= 0 ? DefaultQueryPageSize : Math.Min(pageSize, MaxQueryPageSize);
            return (normalizedPage, normalizedPageSize);
        }

        private IActionResult? ApplyQuerySort(
            ref IQueryable<ListAudit> query,
            ListAuditExportSortRequest? sort)
        {
            if (sort == null || string.IsNullOrWhiteSpace(sort.Column))
            {
                return null;
            }

            var column = NormalizeExportColumnKey(sort.Column);
            if (column == null || !AllowedQuerySortColumns.Contains(column))
            {
                return BadRequest(new
                {
                    message = $"Unsupported query sort column: {sort.Column}"
                });
            }

            var direction = NormalizeQuerySortDirection(sort.Direction);

            query = (column, direction) switch
            {
                (nameof(ListAudit.CreatedAt), "desc") => query.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id),
                (nameof(ListAudit.CreatedAt), _) => query.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id),
                (nameof(ListAudit.UpdatedAt), "desc") => query.OrderByDescending(x => x.UpdatedAt).ThenByDescending(x => x.Id),
                (nameof(ListAudit.UpdatedAt), _) => query.OrderBy(x => x.UpdatedAt).ThenBy(x => x.Id),
                (nameof(ListAudit.TAHUN), "desc") => query.OrderByDescending(x => x.TAHUN).ThenByDescending(x => x.Id),
                (nameof(ListAudit.TAHUN), _) => query.OrderBy(x => x.TAHUN).ThenBy(x => x.Id),
                (nameof(ListAudit.NAMAAUDIT), "desc") => query.OrderByDescending(x => x.NAMAAUDIT).ThenByDescending(x => x.Id),
                (nameof(ListAudit.NAMAAUDIT), _) => query.OrderBy(x => x.NAMAAUDIT).ThenBy(x => x.Id),
                (nameof(ListAudit.RINGKASANAUDIT), "desc") => query.OrderByDescending(x => x.RINGKASANAUDIT).ThenByDescending(x => x.Id),
                (nameof(ListAudit.RINGKASANAUDIT), _) => query.OrderBy(x => x.RINGKASANAUDIT).ThenBy(x => x.Id),
                (nameof(ListAudit.PEMANTAUAN), "desc") => query.OrderByDescending(x => x.PEMANTAUAN).ThenByDescending(x => x.Id),
                (nameof(ListAudit.PEMANTAUAN), _) => query.OrderBy(x => x.PEMANTAUAN).ThenBy(x => x.Id),
                (nameof(ListAudit.JENISAUDIT), "desc") => query.OrderByDescending(x => x.JENISAUDIT).ThenByDescending(x => x.Id),
                (nameof(ListAudit.JENISAUDIT), _) => query.OrderBy(x => x.JENISAUDIT).ThenBy(x => x.Id),
                (nameof(ListAudit.SOURCE), "desc") => query.OrderByDescending(x => x.SOURCE).ThenByDescending(x => x.Id),
                (nameof(ListAudit.SOURCE), _) => query.OrderBy(x => x.SOURCE).ThenBy(x => x.Id),
                (nameof(ListAudit.PICAUDIT), "desc") => query.OrderByDescending(x => x.PICAUDIT).ThenByDescending(x => x.Id),
                (nameof(ListAudit.PICAUDIT), _) => query.OrderBy(x => x.PICAUDIT).ThenBy(x => x.Id),
                (nameof(ListAudit.DEPARTMENT), "desc") => query.OrderByDescending(x => x.DEPARTMENT).ThenByDescending(x => x.Id),
                (nameof(ListAudit.DEPARTMENT), _) => query.OrderBy(x => x.DEPARTMENT).ThenBy(x => x.Id),
                (nameof(ListAudit.PICAPLIKASI), "desc") => query.OrderByDescending(x => x.PICAPLIKASI).ThenByDescending(x => x.Id),
                (nameof(ListAudit.PICAPLIKASI), _) => query.OrderBy(x => x.PICAPLIKASI).ThenBy(x => x.Id),
                (nameof(ListAudit.IN), "desc") => query.OrderByDescending(x => x.IN).ThenByDescending(x => x.Id),
                (nameof(ListAudit.IN), _) => query.OrderBy(x => x.IN).ThenBy(x => x.Id),
                (nameof(ListAudit.JATUHTEMPO), "desc") => query.OrderByDescending(x => x.JATUHTEMPO).ThenByDescending(x => x.Id),
                (nameof(ListAudit.JATUHTEMPO), _) => query.OrderBy(x => x.JATUHTEMPO).ThenBy(x => x.Id),
                (nameof(ListAudit.LINK), "desc") => query.OrderByDescending(x => x.LINK).ThenByDescending(x => x.Id),
                (nameof(ListAudit.LINK), _) => query.OrderBy(x => x.LINK).ThenBy(x => x.Id),
                (nameof(ListAudit.STATUS), "desc") => query.OrderByDescending(x => x.STATUS).ThenByDescending(x => x.Id),
                (nameof(ListAudit.STATUS), _) => query.OrderBy(x => x.STATUS).ThenBy(x => x.Id),
                (nameof(ListAudit.KETERANGAN), "desc") => query.OrderByDescending(x => x.KETERANGAN).ThenByDescending(x => x.Id),
                (nameof(ListAudit.KETERANGAN), _) => query.OrderBy(x => x.KETERANGAN).ThenBy(x => x.Id),
                _ => query
            };

            return null;
        }

        private static object? NormalizeQueryDistinctValue(object? value)
        {
            return value switch
            {
                null => null,
                string stringValue => string.IsNullOrWhiteSpace(stringValue) ? null : stringValue.Trim(),
                DateTime dateTimeValue => dateTimeValue,
                DateTimeOffset dateTimeOffsetValue => dateTimeOffsetValue,
                _ => value
            };
        }

        private static string BuildQueryDistinctToken(object? value)
        {
            if (value == null)
            {
                return "__NULL__";
            }

            return value switch
            {
                string stringValue => $"str:{stringValue}",
                DateTime dateTimeValue => $"dt:{dateTimeValue:O}",
                DateTimeOffset dateTimeOffsetValue => $"dto:{dateTimeOffsetValue:O}",
                _ => $"obj:{Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty}"
            };
        }

        private static string BuildQueryDistinctOrderKey(object? value)
        {
            if (value == null)
            {
                return string.Empty;
            }

            return value switch
            {
                string stringValue => stringValue,
                DateTime dateTimeValue => dateTimeValue.ToString("O", CultureInfo.InvariantCulture),
                DateTimeOffset dateTimeOffsetValue => dateTimeOffsetValue.ToString("O", CultureInfo.InvariantCulture),
                _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty
            };
        }

        private static string BuildQueryDistinctRowKey(string distinctColumn, object? groupValue)
        {
            var normalizedColumn = string.IsNullOrWhiteSpace(distinctColumn)
                ? "unknown"
                : distinctColumn.Trim().ToLowerInvariant();
            var token = BuildQueryDistinctToken(groupValue);
            return $"distinct:{Uri.EscapeDataString(normalizedColumn)}:{Uri.EscapeDataString(token)}";
        }

        private static object? ReadListAuditQueryPropertyValue(ListAudit row, string column)
        {
            if (!ListAuditQueryPropertyMap.TryGetValue(column, out var property))
            {
                return null;
            }

            return property.GetValue(row);
        }

        private IActionResult? ValidateQueryDistinct(
            ListAuditExportDistinctRequest? distinct,
            out string? distinctColumn)
        {
            distinctColumn = null;
            if (distinct == null || string.IsNullOrWhiteSpace(distinct.Column))
            {
                return null;
            }

            distinctColumn = NormalizeExportColumnKey(distinct.Column);
            if (distinctColumn == null || !AllowedQueryDistinctColumns.Contains(distinctColumn))
            {
                return BadRequest(new
                {
                    message = $"Unsupported query distinct column: {distinct.Column}"
                });
            }

            return null;
        }

        private sealed class QueryDistinctGroup
        {
            public required object GroupValue { get; init; }
            public int Total { get; set; }
            public Dictionary<string, Dictionary<string, (object? Value, int Count)>> Counts { get; } =
                new(StringComparer.OrdinalIgnoreCase);
        }

        private ListAuditQueryResponse BuildDistinctQueryResponse(
            List<ListAudit> rows,
            string distinctColumn,
            int requestedPage,
            int pageSize)
        {
            var grouped = new Dictionary<string, QueryDistinctGroup>(StringComparer.Ordinal);

            foreach (var row in rows)
            {
                var normalizedGroupValue = NormalizeQueryDistinctValue(
                    ReadListAuditQueryPropertyValue(row, distinctColumn));
                if (normalizedGroupValue == null)
                {
                    continue;
                }

                var groupToken = BuildQueryDistinctToken(normalizedGroupValue);
                if (!grouped.TryGetValue(groupToken, out var group))
                {
                    group = new QueryDistinctGroup
                    {
                        GroupValue = normalizedGroupValue
                    };
                    grouped[groupToken] = group;
                }

                group.Total += 1;

                foreach (var column in QueryDistinctDisplayColumns)
                {
                    if (string.Equals(column, distinctColumn, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var normalizedValue = NormalizeQueryDistinctValue(
                        ReadListAuditQueryPropertyValue(row, column));
                    var valueToken = BuildQueryDistinctToken(normalizedValue);

                    if (!group.Counts.TryGetValue(column, out var columnCounts))
                    {
                        columnCounts = new Dictionary<string, (object? Value, int Count)>(StringComparer.Ordinal);
                        group.Counts[column] = columnCounts;
                    }

                    if (columnCounts.TryGetValue(valueToken, out var existing))
                    {
                        columnCounts[valueToken] = (existing.Value, existing.Count + 1);
                    }
                    else
                    {
                        columnCounts[valueToken] = (normalizedValue, 1);
                    }
                }
            }

            var orderedGroups = grouped.Values
                .OrderBy(group => BuildQueryDistinctOrderKey(group.GroupValue), StringComparer.OrdinalIgnoreCase)
                .ToList();

            var effectivePageSize = pageSize <= 0 ? DefaultQueryPageSize : pageSize;
            var totalCount = orderedGroups.Count;
            var totalPages = totalCount == 0
                ? 1
                : (int)Math.Ceiling(totalCount / (double)effectivePageSize);
            var effectivePage = Math.Min(Math.Max(requestedPage, 1), totalPages);
            var skip = (effectivePage - 1) * effectivePageSize;

            var projectedRows = orderedGroups
                .Skip(skip)
                .Take(effectivePageSize)
                .Select((group, index) =>
                {
                    var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["Id"] = skip + index + 1L,
                        ["__rowKey"] = BuildQueryDistinctRowKey(distinctColumn, group.GroupValue),
                        [distinctColumn] = group.GroupValue,
                        ["Total"] = group.Total
                    };

                    foreach (var column in QueryDistinctDisplayColumns)
                    {
                        if (string.Equals(column, distinctColumn, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        if (!group.Counts.TryGetValue(column, out var columnCounts) || columnCounts.Count == 0)
                        {
                            row[column] = Array.Empty<object>();
                            continue;
                        }

                        row[column] = columnCounts.Values
                            .OrderByDescending(item => item.Count)
                            .ThenBy(item => BuildQueryDistinctOrderKey(item.Value), StringComparer.OrdinalIgnoreCase)
                            .Select(item => new
                            {
                                value = item.Value,
                                count = item.Count
                            })
                            .ToList();
                    }

                    return (object)row;
                })
                .ToList();

            return new ListAuditQueryResponse
            {
                Rows = projectedRows,
                Page = effectivePage,
                PageSize = effectivePageSize,
                TotalCount = totalCount,
                TotalPages = totalPages,
                HasPreviousPage = effectivePage > 1,
                HasNextPage = effectivePage < totalPages
            };
        }

        private static Expression BuildTrimmedStringExpression(Expression propertyExpression) =>
            Expression.Call(propertyExpression, typeof(string).GetMethod(nameof(string.Trim), Type.EmptyTypes)!);

        private static Expression BuildNormalizedStringExpression(Expression propertyExpression)
        {
            var trimmed = BuildTrimmedStringExpression(propertyExpression);
            return Expression.Call(trimmed, typeof(string).GetMethod(nameof(string.ToLower), Type.EmptyTypes)!);
        }

        private static Expression BuildIsEmptyStringExpression(Expression propertyExpression)
        {
            var nullConstant = Expression.Constant(null, typeof(string));
            var emptyString = Expression.Constant(string.Empty);
            var trimmed = BuildTrimmedStringExpression(propertyExpression);

            return Expression.OrElse(
                Expression.Equal(propertyExpression, nullConstant),
                Expression.Equal(trimmed, emptyString));
        }

        private static Expression BuildKnownAuditStatusExpression(Expression normalizedPropertyExpression)
        {
            var knownStatuses = new[]
            {
                "open",
                "in progress",
                "inprogress",
                "progress",
                "berjalan",
                "closed",
                "close",
                "selesai",
                "done"
            };

            Expression? expression = null;
            foreach (var knownStatus in knownStatuses)
            {
                var statusEquals = Expression.Equal(
                    normalizedPropertyExpression,
                    Expression.Constant(knownStatus));

                expression = expression == null
                    ? statusEquals
                    : Expression.OrElse(expression, statusEquals);
            }

            return expression ?? Expression.Constant(false);
        }

        private static Expression BuildIsInvalidAuditStatusExpression(Expression propertyExpression)
        {
            var nullConstant = Expression.Constant(null, typeof(string));
            var emptyString = Expression.Constant(string.Empty);
            var trimmed = BuildTrimmedStringExpression(propertyExpression);
            var normalized = BuildNormalizedStringExpression(propertyExpression);
            var hasValue = Expression.AndAlso(
                Expression.NotEqual(propertyExpression, nullConstant),
                Expression.NotEqual(trimmed, emptyString));

            return Expression.AndAlso(
                hasValue,
                Expression.Not(BuildKnownAuditStatusExpression(normalized)));
        }

        private IActionResult? TryResolveStructuredExportFilters(
            JToken? rawFilters,
            out List<ListAuditExportFilterRequest> filters)
        {
            filters = [];

            if (rawFilters == null ||
                rawFilters.Type is JTokenType.Null or JTokenType.Undefined)
            {
                return null;
            }

            if (rawFilters.Type == JTokenType.Object)
            {
                foreach (var property in ((JObject)rawFilters).Properties())
                {
                    filters.Add(new ListAuditExportFilterRequest
                    {
                        Column = property.Name,
                        Operator = "=",
                        Value = property.Value.Type == JTokenType.Null ? null : property.Value.ToString()
                    });
                }

                return null;
            }

            if (rawFilters.Type != JTokenType.Array)
            {
                return BadRequest(new
                {
                    message = "Export filters must be an object map or an array of filter objects."
                });
            }

            foreach (var item in (JArray)rawFilters)
            {
                if (item.Type != JTokenType.Object)
                {
                    return BadRequest(new
                    {
                        message = "Export filters must be an array of objects."
                    });
                }

                var filter = item.ToObject<ListAuditExportFilterRequest>();
                if (filter == null)
                {
                    return BadRequest(new
                    {
                        message = "Invalid export filter payload."
                    });
                }

                filters.Add(filter);
            }

            return null;
        }

        private static bool TryBuildStringExportFilterExpression(
            string column,
            string @operator,
            string value,
            ParameterExpression parameter,
            out Expression? expression,
            out string? errorMessage)
        {
            expression = null;
            errorMessage = null;

            if (@operator is not "=" and not "!=" and not "contains")
            {
                errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, @operator);
                return false;
            }

            var property = Expression.Property(parameter, column);
            var nullConstant = Expression.Constant(null, typeof(string));
            var notNull = Expression.NotEqual(property, nullConstant);
            var normalizedProperty = BuildNormalizedStringExpression(property);
            var normalizedValueToken = value.Trim().ToLowerInvariant();

            if (normalizedValueToken == EmptyFilterToken.ToLowerInvariant())
            {
                if (@operator == "contains")
                {
                    errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, @operator);
                    return false;
                }

                var isEmptyExpression = BuildIsEmptyStringExpression(property);
                expression = @operator switch
                {
                    "=" => isEmptyExpression,
                    "!=" => Expression.Not(isEmptyExpression),
                    _ => null
                };

                return expression != null;
            }

            if (string.Equals(column, nameof(ListAudit.STATUS), StringComparison.OrdinalIgnoreCase) &&
                normalizedValueToken == InvalidStatusFilterToken.ToLowerInvariant())
            {
                if (@operator == "contains")
                {
                    errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, @operator);
                    return false;
                }

                var isInvalidStatusExpression = BuildIsInvalidAuditStatusExpression(property);
                expression = @operator switch
                {
                    "=" => isInvalidStatusExpression,
                    "!=" => Expression.Not(isInvalidStatusExpression),
                    _ => null
                };

                return expression != null;
            }

            var normalizedValue = Expression.Constant(normalizedValueToken);

            expression = @operator switch
            {
                "=" => Expression.AndAlso(
                    notNull,
                    Expression.Equal(normalizedProperty, normalizedValue)),
                "!=" => Expression.OrElse(
                    Expression.Equal(property, nullConstant),
                    Expression.NotEqual(normalizedProperty, normalizedValue)),
                "contains" => Expression.AndAlso(
                    notNull,
                    Expression.Call(
                        normalizedProperty,
                        typeof(string).GetMethod(nameof(string.Contains), [typeof(string)])!,
                        normalizedValue)),
                _ => null
            };

            return expression != null;
        }

        private static bool TryBuildNumericExportFilterExpression(
            string column,
            string @operator,
            string value,
            ParameterExpression parameter,
            out Expression? expression,
            out string? errorMessage)
        {
            expression = null;
            errorMessage = null;

            if (@operator == "contains")
            {
                errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, @operator);
                return false;
            }

            var normalizedValueToken = value.Trim().ToLowerInvariant();
            if (normalizedValueToken == EmptyFilterToken.ToLowerInvariant())
            {
                var propertyExpression = Expression.Property(parameter, column);
                var isEmptyExpression = BuildIsEmptyStringExpression(propertyExpression);

                expression = @operator switch
                {
                    "=" => isEmptyExpression,
                    "!=" => Expression.Not(isEmptyExpression),
                    _ => null
                };

                if (expression == null)
                {
                    errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, @operator);
                    return false;
                }

                return true;
            }

            if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedValue))
            {
                errorMessage = $"Invalid export filter value for {column}. Expected a valid number.";
                return false;
            }

            var property = Expression.Property(parameter, column);
            var nullConstant = Expression.Constant(null, typeof(string));
            var trimmedProperty = BuildTrimmedStringExpression(property);
            var emptyString = Expression.Constant(string.Empty);
            var hasValue = Expression.AndAlso(
                Expression.NotEqual(property, nullConstant),
                Expression.NotEqual(trimmedProperty, emptyString));
            var normalizedValue = Expression.Constant(parsedValue.ToString(CultureInfo.InvariantCulture));
            var equalityExpression = Expression.Equal(trimmedProperty, normalizedValue);
            var compareCall = Expression.Call(
                typeof(string).GetMethod(nameof(string.Compare), [typeof(string), typeof(string)])!,
                trimmedProperty,
                normalizedValue);
            var zero = Expression.Constant(0);

            expression = @operator switch
            {
                "=" => Expression.AndAlso(hasValue, equalityExpression),
                "!=" => Expression.OrElse(
                    Expression.Not(hasValue),
                    Expression.NotEqual(trimmedProperty, normalizedValue)),
                "<" => Expression.AndAlso(hasValue, Expression.LessThan(compareCall, zero)),
                "<=" => Expression.AndAlso(hasValue, Expression.LessThanOrEqual(compareCall, zero)),
                ">" => Expression.AndAlso(hasValue, Expression.GreaterThan(compareCall, zero)),
                ">=" => Expression.AndAlso(hasValue, Expression.GreaterThanOrEqual(compareCall, zero)),
                _ => null
            };

            if (expression == null)
            {
                errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, @operator);
                return false;
            }

            return true;
        }

        private static bool TryBuildDateExportFilterExpression(
            string column,
            string @operator,
            string value,
            ParameterExpression parameter,
            out Expression? expression,
            out string? errorMessage)
        {
            expression = null;
            errorMessage = null;

            if (@operator == "contains")
            {
                errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, @operator);
                return false;
            }

            if (!DateTime.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AllowWhiteSpaces,
                out var parsedDate))
            {
                errorMessage = $"Invalid export filter value for {column}. Expected a valid date.";
                return false;
            }

            var property = Expression.Property(parameter, column);
            var hasValue = Expression.Property(property, nameof(Nullable<DateTime>.HasValue));
            var valueExpression = Expression.Property(property, nameof(Nullable<DateTime>.Value));
            var start = Expression.Constant(parsedDate.Date);
            var end = Expression.Constant(parsedDate.Date.AddDays(1));

            expression = @operator switch
            {
                "=" => Expression.AndAlso(
                    hasValue,
                    Expression.AndAlso(
                        Expression.GreaterThanOrEqual(valueExpression, start),
                        Expression.LessThan(valueExpression, end))),
                "!=" => Expression.OrElse(
                    Expression.Not(hasValue),
                    Expression.OrElse(
                        Expression.LessThan(valueExpression, start),
                        Expression.GreaterThanOrEqual(valueExpression, end))),
                "<" => Expression.AndAlso(hasValue, Expression.LessThan(valueExpression, start)),
                "<=" => Expression.AndAlso(hasValue, Expression.LessThan(valueExpression, end)),
                ">" => Expression.AndAlso(hasValue, Expression.GreaterThanOrEqual(valueExpression, end)),
                ">=" => Expression.AndAlso(hasValue, Expression.GreaterThanOrEqual(valueExpression, start)),
                _ => null
            };

            if (expression == null)
            {
                errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, @operator);
                return false;
            }

            return true;
        }

        private static bool TryBuildStructuredExportFilterExpression(
            ListAuditExportFilterRequest filter,
            ParameterExpression parameter,
            out Expression? expression,
            out string? errorMessage)
        {
            expression = null;
            errorMessage = null;

            var rawColumn = filter.Column?.Trim();
            var column = NormalizeExportColumnKey(rawColumn);
            if (column == null || !AllowedExportFilterColumns.Contains(column))
            {
                errorMessage = $"Unsupported export filter column: {rawColumn}";
                return false;
            }

            var @operator = NormalizeStructuredExportOperator(filter.Operator);
            if (@operator == null)
            {
                errorMessage = BuildUnsupportedExportFilterOperatorMessage(column, filter.Operator ?? string.Empty);
                return false;
            }

            var value = filter.Value?.Trim();
            if (string.IsNullOrWhiteSpace(value))
            {
                return true;
            }

            if (StringExportFilterColumns.Contains(column))
            {
                return TryBuildStringExportFilterExpression(column, @operator, value, parameter, out expression, out errorMessage);
            }

            if (NumericExportFilterColumns.Contains(column))
            {
                return TryBuildNumericExportFilterExpression(column, @operator, value, parameter, out expression, out errorMessage);
            }

            if (DateExportFilterColumns.Contains(column))
            {
                return TryBuildDateExportFilterExpression(column, @operator, value, parameter, out expression, out errorMessage);
            }

            errorMessage = $"Unsupported export filter column: {rawColumn}";
            return false;
        }

        private IActionResult? ApplyStructuredExportFilters(
            ref IQueryable<ListAudit> query,
            IReadOnlyCollection<ListAuditExportFilterRequest> filters,
            string? mode)
        {
            if (filters.Count == 0)
            {
                return null;
            }

            var normalizedMode = NormalizeExportFilterMode(mode);
            if (normalizedMode is not "and" and not "or")
            {
                return BadRequest(new
                {
                    message = $"Unsupported export filter mode: {mode}"
                });
            }

            var parameter = Expression.Parameter(typeof(ListAudit), "a");
            Expression? body = null;

            foreach (var filter in filters)
            {
                if (!TryBuildStructuredExportFilterExpression(filter, parameter, out var filterExpression, out var errorMessage))
                {
                    return BadRequest(new
                    {
                        message = errorMessage
                    });
                }

                if (filterExpression == null)
                {
                    continue;
                }

                body = body == null
                    ? filterExpression
                    : normalizedMode == "or"
                        ? Expression.OrElse(body, filterExpression)
                        : Expression.AndAlso(body, filterExpression);
            }

            if (body == null)
            {
                return null;
            }

            var lambda = Expression.Lambda<Func<ListAudit, bool>>(body, parameter);
            query = query.Where(lambda);
            return null;
        }

        private static bool TryParseExportFilterKey(
            string rawKey,
            out string columnKey,
            out string operatorToken)
        {
            columnKey = rawKey.Trim();
            operatorToken = "eq";

            var doubleUnderscoreIndex = columnKey.IndexOf("__", StringComparison.Ordinal);
            if (doubleUnderscoreIndex > 0)
            {
                operatorToken = columnKey[(doubleUnderscoreIndex + 2)..];
                columnKey = columnKey[..doubleUnderscoreIndex];
                return true;
            }

            var colonIndex = columnKey.IndexOf(':');
            if (colonIndex > 0)
            {
                operatorToken = columnKey[(colonIndex + 1)..];
                columnKey = columnKey[..colonIndex];
                return true;
            }

            var bracketIndex = columnKey.IndexOf('[');
            if (bracketIndex > 0 && columnKey.EndsWith("]", StringComparison.Ordinal))
            {
                operatorToken = columnKey[(bracketIndex + 1)..^1];
                columnKey = columnKey[..bracketIndex];
                return true;
            }

            return true;
        }

        private static IQueryable<ListAudit> ApplyStringExportEqualityFilter(
            IQueryable<ListAudit> query,
            string column,
            string value)
        {
            var normalizedValue = value.Trim().ToLowerInvariant();

            if (normalizedValue == EmptyFilterToken.ToLowerInvariant())
            {
                return column switch
                {
                    nameof(ListAudit.TAHUN) => query.Where(a => a.TAHUN == null || a.TAHUN.Trim() == string.Empty),
                    nameof(ListAudit.NAMAAUDIT) => query.Where(a => a.NAMAAUDIT == null || a.NAMAAUDIT.Trim() == string.Empty),
                    nameof(ListAudit.RINGKASANAUDIT) => query.Where(a => a.RINGKASANAUDIT == null || a.RINGKASANAUDIT.Trim() == string.Empty),
                    nameof(ListAudit.PEMANTAUAN) => query.Where(a => a.PEMANTAUAN == null || a.PEMANTAUAN.Trim() == string.Empty),
                    nameof(ListAudit.JENISAUDIT) => query.Where(a => a.JENISAUDIT == null || a.JENISAUDIT.Trim() == string.Empty),
                    nameof(ListAudit.SOURCE) => query.Where(a => a.SOURCE == null || a.SOURCE.Trim() == string.Empty),
                    nameof(ListAudit.PICAUDIT) => query.Where(a => a.PICAUDIT == null || a.PICAUDIT.Trim() == string.Empty),
                    nameof(ListAudit.DEPARTMENT) => query.Where(a => a.DEPARTMENT == null || a.DEPARTMENT.Trim() == string.Empty),
                    nameof(ListAudit.PICAPLIKASI) => query.Where(a => a.PICAPLIKASI == null || a.PICAPLIKASI.Trim() == string.Empty),
                    nameof(ListAudit.LINK) => query.Where(a => a.LINK == null || a.LINK.Trim() == string.Empty),
                    nameof(ListAudit.STATUS) => query.Where(a => a.STATUS == null || a.STATUS.Trim() == string.Empty),
                    nameof(ListAudit.KETERANGAN) => query.Where(a => a.KETERANGAN == null || a.KETERANGAN.Trim() == string.Empty),
                    _ => query
                };
            }

            if (column == nameof(ListAudit.STATUS) &&
                normalizedValue == InvalidStatusFilterToken.ToLowerInvariant())
            {
                return query.Where(a =>
                    a.STATUS != null &&
                    a.STATUS.Trim() != string.Empty &&
                    a.STATUS.Trim().ToLower() != "open" &&
                    a.STATUS.Trim().ToLower() != "in progress" &&
                    a.STATUS.Trim().ToLower() != "inprogress" &&
                    a.STATUS.Trim().ToLower() != "progress" &&
                    a.STATUS.Trim().ToLower() != "berjalan" &&
                    a.STATUS.Trim().ToLower() != "closed" &&
                    a.STATUS.Trim().ToLower() != "close" &&
                    a.STATUS.Trim().ToLower() != "selesai" &&
                    a.STATUS.Trim().ToLower() != "done");
            }

            return column switch
            {
                nameof(ListAudit.TAHUN) => query.Where(a => a.TAHUN != null && a.TAHUN.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.NAMAAUDIT) => query.Where(a => a.NAMAAUDIT != null && a.NAMAAUDIT.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.RINGKASANAUDIT) => query.Where(a => a.RINGKASANAUDIT != null && a.RINGKASANAUDIT.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.PEMANTAUAN) => query.Where(a => a.PEMANTAUAN != null && a.PEMANTAUAN.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.JENISAUDIT) => query.Where(a => a.JENISAUDIT != null && a.JENISAUDIT.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.SOURCE) => query.Where(a => a.SOURCE != null && a.SOURCE.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.PICAUDIT) => query.Where(a => a.PICAUDIT != null && a.PICAUDIT.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.DEPARTMENT) => query.Where(a => a.DEPARTMENT != null && a.DEPARTMENT.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.PICAPLIKASI) => query.Where(a => a.PICAPLIKASI != null && a.PICAPLIKASI.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.LINK) => query.Where(a => a.LINK != null && a.LINK.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.STATUS) => query.Where(a => a.STATUS != null && a.STATUS.Trim().ToLower() == normalizedValue),
                nameof(ListAudit.KETERANGAN) => query.Where(a => a.KETERANGAN != null && a.KETERANGAN.Trim().ToLower() == normalizedValue),
                _ => query
            };
        }

        private static bool TryApplyDateExportEqualityFilter(
            ref IQueryable<ListAudit> query,
            string column,
            string value)
        {
            if (!DateTime.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AllowWhiteSpaces,
                out var parsedDate))
            {
                return false;
            }

            var start = parsedDate.Date;
            var end = start.AddDays(1);

            query = column switch
            {
                nameof(ListAudit.IN) => query.Where(a => a.IN >= start && a.IN < end),
                nameof(ListAudit.JATUHTEMPO) => query.Where(a => a.JATUHTEMPO >= start && a.JATUHTEMPO < end),
                _ => query
            };

            return true;
        }

        private static IQueryable<ListAudit> ApplyExportSearchFilter(
            IQueryable<ListAudit> query,
            string search,
            IReadOnlyCollection<string> searchColumns)
        {
            var normalizedSearch = search.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalizedSearch) || searchColumns.Count == 0)
            {
                return query;
            }

            var parameter = Expression.Parameter(typeof(ListAudit), "a");
            Expression? body = null;

            foreach (var column in searchColumns)
            {
                var property = Expression.Property(parameter, column);
                var notNull = Expression.NotEqual(property, Expression.Constant(null, typeof(string)));
                var toLower = Expression.Call(property, typeof(string).GetMethod(nameof(string.ToLower), Type.EmptyTypes)!);
                var contains = Expression.Call(
                    toLower,
                    typeof(string).GetMethod(nameof(string.Contains), [typeof(string)])!,
                    Expression.Constant(normalizedSearch));
                var condition = Expression.AndAlso(notNull, contains);
                body = body == null ? condition : Expression.OrElse(body, condition);
            }

            if (body == null)
            {
                return query;
            }

            var lambda = Expression.Lambda<Func<ListAudit, bool>>(body, parameter);
            return query.Where(lambda);
        }

        private IActionResult? ValidateAndNormalizeSearchTerm(
            string? search,
            out string? normalizedSearch)
        {
            normalizedSearch = null;

            if (string.IsNullOrWhiteSpace(search))
            {
                return null;
            }

            if (UnsupportedSearchControlCharsRegex.IsMatch(search))
            {
                return BadRequest(new
                {
                    message = "Search term contains unsupported control characters."
                });
            }

            normalizedSearch = Regex.Replace(search, @"\s+", " ").Trim();
            if (string.IsNullOrWhiteSpace(normalizedSearch))
            {
                return null;
            }

            if (normalizedSearch.Length > MaxQuerySearchLength)
            {
                return BadRequest(new
                {
                    message = $"Search term is too long. Maximum {MaxQuerySearchLength} characters."
                });
            }

            return null;
        }

        private IActionResult? ApplyValidatedExportSearchFilter(
            ref IQueryable<ListAudit> query,
            string? search,
            IEnumerable<string>? searchColumns)
        {
            var searchValidationError = ValidateAndNormalizeSearchTerm(search, out var normalizedSearch);
            if (searchValidationError != null)
            {
                return searchValidationError;
            }

            if (string.IsNullOrWhiteSpace(normalizedSearch))
            {
                return null;
            }

            var resolvedSearchColumns = ResolveRequestedSearchColumns(searchColumns)
                ?? AllowedExportSearchColumns.ToList();

            if (searchColumns != null && searchColumns.Any() && resolvedSearchColumns.Count == 0)
            {
                return BadRequest(new
                {
                    message = "Unsupported export search columns."
                });
            }

            var unsupportedSearchColumn = searchColumns?
                .SelectMany(x => (x ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .FirstOrDefault(x =>
                {
                    var normalized = NormalizeExportColumnKey(x);
                    return normalized == null || !AllowedExportSearchColumns.Contains(normalized);
                });

            if (!string.IsNullOrWhiteSpace(unsupportedSearchColumn))
            {
                return BadRequest(new
                {
                    message = $"Unsupported export search column: {unsupportedSearchColumn}"
                });
            }

            query = ApplyExportSearchFilter(query, normalizedSearch, resolvedSearchColumns);
            return null;
        }

        private IActionResult? ApplyExportFilters(
            ref IQueryable<ListAudit> query,
            string? type,
            IEnumerable<KeyValuePair<string, string?>> filters,
            string? search = null,
            IEnumerable<string>? searchColumns = null,
            bool allowSearch = false)
        {
            var typeError = ApplyExportTypeFilter(ref query, type);
            if (typeError != null)
            {
                return typeError;
            }

            if (!allowSearch && (!string.IsNullOrWhiteSpace(search) || (searchColumns?.Any() ?? false)))
            {
                return BadRequest(new
                {
                    message = "Unsupported export filter: search is not supported on GET /api/ListAudit/export. Use equality column filters only."
                });
            }

            foreach (var kvp in filters)
            {
                if (!TryParseExportFilterKey(kvp.Key, out var rawColumnKey, out var operatorToken))
                {
                    return BadRequest(new
                    {
                        message = $"Invalid export filter key '{kvp.Key}'."
                    });
                }

                if (!string.Equals(operatorToken, "eq", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new
                    {
                        message = BuildUnsupportedExportFilterOperatorMessage(rawColumnKey, operatorToken)
                    });
                }

                var column = NormalizeExportColumnKey(rawColumnKey);
                if (column == null || !AllowedExportFilterColumns.Contains(column))
                {
                    return BadRequest(new
                    {
                        message = $"Unsupported export filter column: {rawColumnKey}"
                    });
                }

                var value = kvp.Value?.Trim();
                if (string.IsNullOrEmpty(value))
                {
                    continue;
                }

                if (column is nameof(ListAudit.IN) or nameof(ListAudit.JATUHTEMPO))
                {
                    if (!TryApplyDateExportEqualityFilter(ref query, column, value))
                    {
                        return BadRequest(new
                        {
                            message = $"Invalid export filter value for {column}. Expected a valid date."
                        });
                    }

                    continue;
                }

                query = ApplyStringExportEqualityFilter(query, column, value);
            }

            if (allowSearch)
            {
                return ApplyValidatedExportSearchFilter(ref query, search, searchColumns);
            }

            return null;
        }

        private static List<string> ResolveDistinctExportColumns(
            IEnumerable<string>? rawColumns,
            string distinctColumn)
        {
            var resolved = new List<string>();

            if (rawColumns != null)
            {
                foreach (var raw in rawColumns)
                {
                    if (string.IsNullOrWhiteSpace(raw))
                    {
                        continue;
                    }

                    var splitValues = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    foreach (var splitValue in splitValues)
                    {
                        if (string.Equals(splitValue, DistinctTotalColumn, StringComparison.OrdinalIgnoreCase))
                        {
                            if (!resolved.Contains(DistinctTotalColumn, StringComparer.OrdinalIgnoreCase))
                            {
                                resolved.Add(DistinctTotalColumn);
                            }

                            continue;
                        }

                        var key = NormalizeExportColumnKey(splitValue);
                        if (key == null ||
                            !QueryDistinctDisplayColumns.Contains(key, StringComparer.OrdinalIgnoreCase) ||
                            resolved.Contains(key, StringComparer.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        resolved.Add(key);
                    }
                }
            }

            if (!resolved.Contains(distinctColumn, StringComparer.OrdinalIgnoreCase))
            {
                resolved.Insert(0, distinctColumn);
            }

            if (!resolved.Contains(DistinctTotalColumn, StringComparer.OrdinalIgnoreCase))
            {
                resolved.Add(DistinctTotalColumn);
            }

            return resolved;
        }

        private List<Dictionary<string, object?>> BuildDistinctExportRows(
            IReadOnlyList<ListAudit> rows,
            string distinctColumn)
        {
            var grouped = new Dictionary<string, QueryDistinctGroup>(StringComparer.Ordinal);

            foreach (var row in rows)
            {
                var normalizedGroupValue = NormalizeQueryDistinctValue(
                    ReadListAuditQueryPropertyValue(row, distinctColumn));
                if (normalizedGroupValue == null)
                {
                    continue;
                }

                var groupToken = BuildQueryDistinctToken(normalizedGroupValue);
                if (!grouped.TryGetValue(groupToken, out var group))
                {
                    group = new QueryDistinctGroup
                    {
                        GroupValue = normalizedGroupValue
                    };
                    grouped[groupToken] = group;
                }

                group.Total += 1;

                foreach (var column in QueryDistinctDisplayColumns)
                {
                    if (string.Equals(column, distinctColumn, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var normalizedValue = NormalizeQueryDistinctValue(
                        ReadListAuditQueryPropertyValue(row, column));
                    var valueToken = BuildQueryDistinctToken(normalizedValue);

                    if (!group.Counts.TryGetValue(column, out var columnCounts))
                    {
                        columnCounts = new Dictionary<string, (object? Value, int Count)>(StringComparer.Ordinal);
                        group.Counts[column] = columnCounts;
                    }

                    if (columnCounts.TryGetValue(valueToken, out var existing))
                    {
                        columnCounts[valueToken] = (existing.Value, existing.Count + 1);
                    }
                    else
                    {
                        columnCounts[valueToken] = (normalizedValue, 1);
                    }
                }
            }

            return grouped.Values
                .OrderBy(group => BuildQueryDistinctOrderKey(group.GroupValue), StringComparer.OrdinalIgnoreCase)
                .Select(group =>
                {
                    var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                    {
                        [distinctColumn] = group.GroupValue,
                        [DistinctTotalColumn] = group.Total
                    };

                    foreach (var column in QueryDistinctDisplayColumns)
                    {
                        if (string.Equals(column, distinctColumn, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        if (!group.Counts.TryGetValue(column, out var columnCounts) || columnCounts.Count == 0)
                        {
                            row[column] = Array.Empty<AuditListDistinctExportValueItem>();
                            continue;
                        }

                        row[column] = columnCounts.Values
                            .OrderByDescending(item => item.Count)
                            .ThenBy(item => BuildQueryDistinctOrderKey(item.Value), StringComparer.OrdinalIgnoreCase)
                            .Select(item => new AuditListDistinctExportValueItem
                            {
                                Value = item.Value,
                                Count = item.Count
                            })
                            .ToList();
                    }

                    return row;
                })
                .ToList();
        }

        //MUTATED GET by type of JENIS AUDIT
        //[HttpGet]
        //public async Task<ActionResult<IEnumerable<ListAuditReadDto>>> GetAll()
        //{
        //    var query =
        //    from p in _db.ListAudit
        //        on new { EntityId = p.Id, TableName = "ListAudit" }
        //        equals new { EntityId = r.EntityId, TableName = r.TableName }
        //        into gj
        //    from order in gj.DefaultIfEmpty()
        //    orderby (order == null ? p.Id : (long)order.RowId)
        //    select p;


        //    var list = await query.ToListAsync();
        //    var dtoList = _mapper.Map<List<ListAuditReadDto>>(list);

        //    return Ok(dtoList);
        //}



        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchListAudit(long id, [FromBody] Dictionary<string, object> changes)
        {
            var listaudit = await _db.ListAudit.FindAsync(id);
            if (listaudit == null)
                return NotFound($"ListAudit with id {id} not found.");

            // Deserialize ExtraData into dictionary
            var extraDict = string.IsNullOrWhiteSpace(listaudit.ExtraData)
                ? new Dictionary<string, object>()
                : JsonConvert.DeserializeObject<Dictionary<string, object>>(listaudit.ExtraData) ?? new Dictionary<string, object>() ?? new Dictionary<string, object>();

            foreach (var kvp in changes)
            {
                if (string.Equals(kvp.Key, SyntheticNumberColumn, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(kvp.Key, "Nomor", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var property = typeof(ListAudit).GetProperty(kvp.Key);

                if (property != null && property.Name != nameof(ListAudit.ExtraData))
                {
                    if (property.Name is nameof(ListAudit.Id) or nameof(ListAudit.CreatedAt) or nameof(ListAudit.UpdatedAt))
                    {
                        return BadRequest($"Field '{property.Name}' cannot be updated directly.");
                    }

                    // Update normal property dynamically
                    var targetType = Nullable.GetUnderlyingType(property.PropertyType)
                 ?? property.PropertyType;

                    if (targetType == typeof(byte[]))
                    {
                        return BadRequest(
                            $"Field '{property.Name}' must be updated via /api/ListAudit/image/{id}/{property.Name}.");
                    }

                    object? convertedValue = null;

                    if (kvp.Value == null)
                    {
                        convertedValue = null;
                    }
                    else if (targetType == typeof(DateTime))
                    {
                        var textValue = kvp.Value.ToString();
                        convertedValue = DateTime.Parse(textValue ?? string.Empty);
                    }
                    else if (targetType.IsEnum)
                    {
                        var textValue = kvp.Value.ToString();
                        convertedValue = Enum.Parse(targetType, textValue ?? string.Empty);
                    }
                    else
                    {
                        convertedValue = Convert.ChangeType(kvp.Value, targetType);
                    }

                    if (targetType == typeof(string))
                    {
                        convertedValue = AuditListExportHelper.StripInlineFormatTags(convertedValue?.ToString());
                    }

                    property.SetValue(listaudit, convertedValue);

                   
                }
                else
                {
                    // Treat as ExtraData field
                    extraDict[kvp.Key] = kvp.Value is string textValue
                        ? AuditListExportHelper.StripInlineFormatTags(textValue) ?? string.Empty
                        : kvp.Value!;
                }
            }

            listaudit.UpdatedAt = DateTime.UtcNow;
            listaudit.ExtraData = JsonConvert.SerializeObject(extraDict, Formatting.None);
            AuditListExportHelper.SanitizeEntity(listaudit, ListAuditSanitizedStringPropertyNames);
            await _db.SaveChangesAsync();

            return Ok(new { Message = "Updated successfully", listaudit });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ListAudit listaudit)
        {
            var now = DateTime.UtcNow;
            AuditListExportHelper.SanitizeEntity(listaudit, ListAuditSanitizedStringPropertyNames);
            listaudit.CreatedAt = now;
            listaudit.UpdatedAt = now;
            _db.ListAudit.Add(listaudit);
            await _db.SaveChangesAsync();
            return Ok(listaudit);
        }

        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest("No IDs provided.");

            var rows = await _db.ListAudit.Where(a => ids.Contains(a.Id)).ToListAsync();
            if (!rows.Any())
                return NotFound("No matching rows found.");

            _db.ListAudit.RemoveRange(rows);
            await _db.SaveChangesAsync();

            return Ok(new { DeletedCount = rows.Count });
        }




        [HttpPost("extra/bulk")]
        public async Task<IActionResult> AddExtraDataFieldToAll([FromBody] Dictionary<string, object> newField)
        {
            if (newField == null || newField.Count == 0)
                return BadRequest("No field provided.");

            var listauditList = await _db.ListAudit.ToListAsync();

            foreach (var listaudit in listauditList)
            {
                var dict = string.IsNullOrWhiteSpace(listaudit.ExtraData)
                    ? new Dictionary<string, object>()
                    : JsonConvert.DeserializeObject<Dictionary<string, object>>(listaudit.ExtraData) ?? new Dictionary<string, object>() ?? new Dictionary<string, object>();

                foreach (var kvp in newField)
                {
                    if (!dict.ContainsKey(kvp.Key)) // only add if missing
                        dict[kvp.Key] = kvp.Value!;
                }

                listaudit.ExtraData = JsonConvert.SerializeObject(dict, Formatting.None);
            }

            await _db.SaveChangesAsync();
            return Ok(new { Message = "Field(s) added to all rows." });
        }


        [HttpDelete("extra/bulk/{key}")]
        public async Task<IActionResult> DeleteExtraDataFieldFromAll(string key)
        {
            var listauditList = await _db.ListAudit.ToListAsync();

            foreach (var listaudit in listauditList)
            {
                var dict = string.IsNullOrWhiteSpace(listaudit.ExtraData)
                    ? new Dictionary<string, object>()
                    : JsonConvert.DeserializeObject<Dictionary<string, object>>(listaudit.ExtraData) ?? new Dictionary<string, object>() ?? new Dictionary<string, object>();

                if (dict.Remove(key))
                {
                    listaudit.ExtraData = JsonConvert.SerializeObject(dict, Formatting.None);
                }
            }

            await _db.SaveChangesAsync();
            return Ok(new { Message = $"Field '{key}' deleted from all rows." });
        }



        //------------------------------ Added Controller----------------------------//
        [HttpGet("image/{id}/{column}")]
        public async Task<IActionResult> GetImage(long id, string column)
        {
            var listaudit = await _db.ListAudit.FindAsync(id);
            if (listaudit == null)
                return NotFound($"ListAudit with id {id} not found.");

            var prop = typeof(ListAudit).GetProperty(column);
            if (prop == null || prop.PropertyType != typeof(byte[]))
                return BadRequest("Invalid image column name.");

            var imageData = prop.GetValue(listaudit) as byte[];
            if (imageData == null || imageData.Length == 0)
                return NotFound($"No data in column '{column}' for this record.");

            var contentType = DocumentUploadPolicyHelper.DetectImageContentType(imageData);
            return File(imageData, contentType);
        }

        [HttpPost("image/{id}/{column}")]
        [RequestSizeLimit(UploadLimitHelper.AuditEvidenceMaxRequestBytes)]
        public async Task<IActionResult> UploadImageToColumn(long id, string column, IFormFile file)
        {
            var mutationForbidden = EnsureCanMutateAuditEvidence();
            if (mutationForbidden != null)
                return mutationForbidden;
            // 🔍 Step 1: Validate ID and record
            var listaudit = await _db.ListAudit.FindAsync(id);
            if (listaudit == null)
                return NotFound($"ListAudit with id {id} not found.");

            // 🔍 Step 2: Validate file
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            if (file.Length > UploadLimitHelper.AuditEvidenceMaxFileBytes)
                return BadRequest($"Ukuran file evidence maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.AuditEvidenceMaxFileBytes)}.");

            if (!DocumentUploadPolicyHelper.IsAuditEvidenceImageAllowed(file.FileName, file.ContentType))
                return BadRequest("Format evidence audit harus JPG, JPEG, PNG, WEBP, atau GIF.");

            try
            {
                // 🔍 Step 3: Read file into byte[]
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                var fileBytes = ms.ToArray();
                var detectedContentType = DocumentUploadPolicyHelper.DetectImageContentType(fileBytes);
                if (string.Equals(detectedContentType, "application/octet-stream", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("File evidence audit harus berupa gambar JPG, JPEG, PNG, WEBP, atau GIF yang valid.");

                // 🔍 Step 4: Find property by name
                var prop = typeof(ListAudit).GetProperty(column);
                if (prop == null)
                    return BadRequest($"Column '{column}' does not exist in ListAudit model.");

                if (prop.PropertyType != typeof(byte[]))
                    return BadRequest($"Column '{column}' is not a byte[] type (varbinary).");

                // 🔍 Step 5: Save the binary data
                prop.SetValue(listaudit, fileBytes);
                var safeFileName = System.IO.Path.GetFileName(file.FileName ?? string.Empty);
                if (!HttpContext.Items.TryGetValue(AppDbContext.PendingAuditEvidenceChangesItemKey, out var rawPendingChanges) ||
                    rawPendingChanges is not List<AppDbContext.PendingAuditEvidenceChange> pendingChanges)
                {
                    pendingChanges = new List<AppDbContext.PendingAuditEvidenceChange>();
                    HttpContext.Items[AppDbContext.PendingAuditEvidenceChangesItemKey] = pendingChanges;
                }

                pendingChanges.Add(new AppDbContext.PendingAuditEvidenceChange(
                    id,
                    prop.Name,
                    string.IsNullOrWhiteSpace(safeFileName) ? "file-tanpa-nama" : safeFileName,
                    detectedContentType,
                    fileBytes.LongLength));
                await _db.SaveChangesAsync();

                return Ok(new
                {
                    Message = "Image uploaded and saved successfully.",
                    Column = column,
                    Id = id,
                    Size = fileBytes.Length
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error uploading image", Error = ex.Message });
            }
        }


        private IActionResult? EnsureCanMutateAuditEvidence()
        {
            var level = FeatureAccessResolver.GetUserLevel(User) ?? string.Empty;
            if (FeatureAccessResolver.CanPerform(level, Request.Method))
            {
                return null;
            }

            return StatusCode(403, new { message = "Anda tidak memiliki akses untuk mengunggah evidence audit." });
        }

        //get column only
        [HttpGet("column/{columnName}")]
        public async Task<IActionResult> GetColumnValues(string columnName, [FromQuery] string? type = null)
        {
            var prop = typeof(ListAudit).GetProperty(columnName);
            if (prop == null)
                return BadRequest($"Column '{columnName}' does not exist.");

            // Normalize the query param
            type = type?.Trim().ToLower();

            IQueryable<ListAudit> query = _db.ListAudit;

            if (type == "internal")
            {
                query = query.Where(a =>
                    a.JENISAUDIT != null &&
                    a.JENISAUDIT.Trim().ToLower() == "internal");
            }
            else if (type == "external" || type == "eksternal") // ✅ supports both spellings
            {
                query = query.Where(a =>
                    a.JENISAUDIT != null &&
                    (a.JENISAUDIT.Trim().ToLower() == "external" ||
                     a.JENISAUDIT.Trim().ToLower() == "eksternal"));
            }

            var audits = await query.ToListAsync();

            var result = audits.Select(a => new
            {
                Id = a.Id,
                JenisAudit = a.JENISAUDIT,
                Value = prop.GetValue(a)
            }).ToList();

            return Ok(result);
        }


        //[HttpGet("filter")]
        //public async Task<IActionResult> GetFiltered()
        //{
        //    var queryParams = HttpContext.Request.Query;

        //    IQueryable<ListAudit> query = _db.ListAudit.AsQueryable();

        //    if (queryParams.Any())
        //    {
        //        foreach (var kvp in queryParams)
        //        {
        //            var column = kvp.Key;
        //            var value = kvp.Value.ToString();

        //            var prop = typeof(ListAudit).GetProperty(column);
        //            if (prop == null)
        //                return BadRequest($"Column '{column}' does not exist in ListAudit.");

        //            query = query.Where(e =>
        //                EF.Property<object>(e, column) != null &&
        //                EF.Property<object>(e, column).ToString() == value);
        //        }
        //    }

        //    var result = await query.ToListAsync();
        //    var dtoList = _mapper.Map<List<SummaryAuditReadDto>>(result);

        //    return Ok(dtoList);
        //}



        //summary
        [HttpGet("summary")]
        public async Task<ActionResult<IEnumerable<SummaryAuditReadDto>>> GetSummary()
        {
            var query = _db.ListAudit
                .AsNoTracking()
                .OrderByDescending(p => p.CreatedAt)
                .ThenByDescending(p => p.Id);


            var list = await query.ToListAsync();
            var dtoList = _mapper.Map<List<SummaryAuditReadDto>>(list);

            return Ok(dtoList);
        }

        //total list audit
        [HttpGet("total")]
        public async Task<IActionResult> GetListAuditTotal()
        {
            // Count total ListAudit rows
            var totalRows = await _db.ListAudit.CountAsync();

            // Count distinct NAMAAUDIT values
            var distinctNamaAudit = await _db.ListAudit
                .Select(a => a.NAMAAUDIT)
                .Distinct()
                .CountAsync();

            // Return clean JSON response
            return Ok(new
            {
                TotalRows = totalRows,
                DistinctNamaAudit = distinctNamaAudit
            });
        }

        //GET with type
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ListAuditReadDto>>> GetAll([FromQuery] string? type = null)
        {
            // Normalize type parameter
            type = type?.Trim().ToLower();

            var query = BuildOrderedListAuditQuery();

            // ✅ Apply optional filter before executing
            if (type == "internal")
            {
                query = query.Where(p =>
                    p.JENISAUDIT != null &&
                    p.JENISAUDIT.Trim().ToLower() == "internal");
            }
            else if (type == "external" || type == "eksternal")
            {
                query = query.Where(p =>
                    p.JENISAUDIT != null &&
                    (p.JENISAUDIT.Trim().ToLower() == "external" ||
                     p.JENISAUDIT.Trim().ToLower() == "eksternal"));
            }

            // Fetch filtered data
            var list = await query.ToListAsync();

            // Map to DTOs
            var dtoList = _mapper.Map<List<ListAuditReadDto>>(list);
            for (int i = 0; i < dtoList.Count; i++)
            {
                dtoList[i].NO = (i + 1).ToString(CultureInfo.InvariantCulture);
            }

            return Ok(dtoList);
        }

        [HttpPost("query")]
        public async Task<IActionResult> Query(
            [FromBody] ListAuditQueryRequest? request,
            CancellationToken cancellationToken = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async _ =>
                {
                    request ??= new ListAuditQueryRequest();

                    var filterParseError = TryResolveStructuredExportFilters(request.Filters, out var filters);
                    if (filterParseError != null)
                    {
                        return filterParseError;
                    }

                    var (page, pageSize) = NormalizeQueryPaging(request.Page, request.PageSize);
                    var query = BuildOrderedListAuditQuery();

                    var typeError = ApplyExportTypeFilter(ref query, request.Type);
                    if (typeError != null)
                    {
                        return typeError;
                    }

                    var structuredFilterError = ApplyStructuredExportFilters(ref query, filters, request.Mode);
                    if (structuredFilterError != null)
                    {
                        return structuredFilterError;
                    }

                    var searchError = ApplyValidatedExportSearchFilter(ref query, request.Search, request.SearchColumns);
                    if (searchError != null)
                    {
                        return searchError;
                    }

                    var distinctError = ValidateQueryDistinct(request.Distinct, out var distinctColumn);
                    if (distinctError != null)
                    {
                        return distinctError;
                    }

                    var sortError = ApplyQuerySort(ref query, request.Sort);
                    if (sortError != null)
                    {
                        return sortError;
                    }

                    var globalQueryRequest = new TableQueryRequest
                    {
                        Page = page,
                        PageSize = pageSize,
                        FocusId = request.FocusId,
                        Distinct = string.IsNullOrWhiteSpace(distinctColumn)
                            ? null
                            : new TableDistinctRequest { Column = distinctColumn }
                    };

                    var response = await TableQueryHelper.ExecuteAsync(
                        query,
                        globalQueryRequest,
                        ListAuditQuerySchema,
                        cancellationToken);

                    if (string.IsNullOrWhiteSpace(distinctColumn))
                    {
                        var rows = response.Rows
                            .OfType<ListAudit>()
                            .ToList();

                        var dtoRows = _mapper.Map<List<ListAuditReadDto>>(rows);
                        var skip = (response.Page - 1) * response.PageSize;

                        for (int index = 0; index < dtoRows.Count; index++)
                        {
                            dtoRows[index].NO = (skip + index + 1).ToString(CultureInfo.InvariantCulture);
                        }

                        response.Rows = dtoRows.Cast<object>().ToList();
                    }

                    return Ok(new ListAuditQueryResponse
                    {
                        Rows = response.Rows,
                        Page = response.Page,
                        PageSize = response.PageSize,
                        TotalCount = response.TotalCount,
                        TotalPages = response.TotalPages,
                        HasPreviousPage = response.HasPreviousPage,
                        HasNextPage = response.HasNextPage
                    });
                },
                "Audit detail request was canceled.",
                cancellationToken);
        }

        private async Task<IActionResult> BuildExportResponseAsync(
            IQueryable<ListAudit> query,
            string? format,
            string? viewKey,
            IEnumerable<string>? columns)
        {
            format = format?.Trim().ToLowerInvariant() ?? "xlsx";
            viewKey = string.IsNullOrWhiteSpace(viewKey) ? "default" : viewKey;
            if (format is not "xlsx" and not "csv")
            {
                return BadRequest(new
                {
                    message = "Invalid format. Supported formats are xlsx and csv."
                });
            }

            var requestedColumns = ResolveRequestedExportColumns(columns);
            if (columns != null && columns.Any() && requestedColumns == null)
            {
                return BadRequest(new
                {
                    message = "No valid export columns were provided.",
                    allowedColumns = DefaultExportColumns
                });
            }

            var rows = await query.ToListAsync();
            var resolvedColumns = await ResolveExportColumnsAsync(viewKey, requestedColumns);
            var timestamp = DateTime.Now.ToString("yyyy_MM_dd", CultureInfo.InvariantCulture);

            if (format == "csv")
            {
                var csvBytes = AuditListExportHelper.BuildCsvExport(
                    rows,
                    resolvedColumns,
                    SyntheticNumberColumn,
                    ExportColumnLabels);
                return File(csvBytes, "text/csv", $"AuditList_{timestamp}.csv");
            }

            var xlsxBytes = AuditListExportHelper.BuildXlsxExport(rows, resolvedColumns, ExportColumnLabels);
            return File(
                xlsxBytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"AuditList_{timestamp}.xlsx");
        }

        private async Task<IActionResult> BuildDistinctExportResponseAsync(
            IQueryable<ListAudit> query,
            string distinctColumn,
            string? format,
            IEnumerable<string>? columns)
        {
            format = format?.Trim().ToLowerInvariant() ?? "xlsx";
            if (format is not "xlsx" and not "csv")
            {
                return BadRequest(new
                {
                    message = "Invalid format. Supported formats are xlsx and csv."
                });
            }

            var rows = await query.ToListAsync();
            var exportRows = BuildDistinctExportRows(rows, distinctColumn);
            var resolvedColumns = ResolveDistinctExportColumns(columns, distinctColumn);
            var timestamp = DateTime.Now.ToString("yyyy_MM_dd", CultureInfo.InvariantCulture);

            if (format == "csv")
            {
                var csvBytes = AuditListExportHelper.BuildDistinctCsvExport(exportRows, resolvedColumns, ExportColumnLabels);
                return File(csvBytes, "text/csv", $"AuditList_Distinct_{timestamp}.csv");
            }

            var xlsxBytes = AuditListExportHelper.BuildDistinctXlsxExport(
                exportRows,
                resolvedColumns,
                distinctColumn,
                DistinctTotalColumn,
                ExportColumnLabels);
            return File(
                xlsxBytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"AuditList_Distinct_{timestamp}.xlsx");
        }

        private async Task<IActionResult> ExportCoreAsync(
            string? format,
            string? type,
            string? viewKey,
            IEnumerable<string>? columns,
            IEnumerable<KeyValuePair<string, string?>> filters,
            string? search = null,
            IEnumerable<string>? searchColumns = null,
            bool allowSearch = false)
        {
            var query = BuildOrderedListAuditQuery();
            var filterError = ApplyExportFilters(
                ref query,
                type,
                filters,
                search,
                searchColumns,
                allowSearch);
            if (filterError != null)
            {
                return filterError;
            }

            return await BuildExportResponseAsync(query, format, viewKey, columns);
        }

        [HttpGet("export")]
        public async Task<IActionResult> Export(
            [FromQuery] string format = "xlsx",
            [FromQuery] string? type = null,
            [FromQuery] string viewKey = "default",
            [FromQuery(Name = "columns")] string[]? columns = null)
        {
            return await ExportCoreAsync(
                format,
                type,
                viewKey,
                columns,
                GetExportFiltersFromQuery(Request.Query),
                Request.Query["search"].FirstOrDefault(),
                Request.Query["searchColumns"].Select(x => x ?? string.Empty).ToArray(),
                allowSearch: false);
        }

        [HttpPost("export")]
        public async Task<IActionResult> ExportWithBody([FromBody] ListAuditExportRequest? request)
        {
            if (request == null)
            {
                return BadRequest(new
                {
                    message = "Export request body is required."
                });
            }

            var filterParseError = TryResolveStructuredExportFilters(request.Filters, out var filters);
            if (filterParseError != null)
            {
                return filterParseError;
            }

            var query = BuildOrderedListAuditQuery();
            var typeError = ApplyExportTypeFilter(ref query, request.Type);
            if (typeError != null)
            {
                return typeError;
            }

            var filterError = ApplyStructuredExportFilters(ref query, filters, request.Mode);
            if (filterError != null)
            {
                return filterError;
            }

            var searchError = ApplyValidatedExportSearchFilter(ref query, request.Search, request.SearchColumns);
            if (searchError != null)
            {
                return searchError;
            }

            var sortError = ApplyQuerySort(ref query, request.Sort);
            if (sortError != null)
            {
                return sortError;
            }

            var distinctError = ValidateQueryDistinct(request.Distinct, out var distinctColumn);
            if (distinctError != null)
            {
                return distinctError;
            }

            if (!string.IsNullOrWhiteSpace(distinctColumn))
            {
                return await BuildDistinctExportResponseAsync(
                    query,
                    distinctColumn,
                    request.Format,
                    request.Columns);
            }

            return await BuildExportResponseAsync(query, request.Format, request.ViewKey, request.Columns);
        }



        //----------------------SUMMARY-----------------//

        [HttpGet("distinct/namaaudit")]
        public async Task<IActionResult> GetDistinctNamaAuditSummary([FromQuery] string? type = null)
        {
            // --- 1️⃣ Fetch all records ---
            var audits = await _db.ListAudit.ToListAsync();

            // --- 2️⃣ Normalize and map 'type' to DB values ---
            if (!string.IsNullOrWhiteSpace(type))
            {
                string normalizedType = type.Trim().ToLower();

                // Map English input to DB values
                string? dbValue = normalizedType switch
                {
                    "internal" => "Internal",
                    "external" => "Eksternal",
                    _ => null
                };

                if (!string.IsNullOrWhiteSpace(dbValue))
                {
                    audits = audits
                        .Where(a => string.Equals(
                            a.JENISAUDIT?.Trim(),
                            dbValue,
                            StringComparison.OrdinalIgnoreCase))
                        .ToList();
                }
            }

            // --- 3️⃣ Map to DTOs ---
            var dtoList = _mapper.Map<List<SummaryAuditReadDto>>(audits);

            // --- 4️⃣ Get properties except NAMAAUDIT and Id ---
            var props = typeof(SummaryAuditReadDto)
                .GetProperties()
                .Where(p => p.Name != nameof(SummaryAuditReadDto.Id)
                         && p.Name != nameof(SummaryAuditReadDto.NAMAAUDIT))
                .ToList();

            // --- 5️⃣ Group by NAMAAUDIT ---
            var grouped = dtoList
                .GroupBy(a => a.NAMAAUDIT ?? "Unknown")
                .Select(g =>
                {
                    var total = g.Count();
                    var formattedNamaAudit = $"{g.Key} ({total})";

                    var columnSummaries = new Dictionary<string, string>();

                    foreach (var prop in props)
                    {
                        var name = prop.Name;
                        var breakdown = g.GroupBy(a => prop.GetValue(a)?.ToString() ?? "Unknown")
                                         .Select(x => $"{x.Key} ({x.Count()})")
                                         .ToList();

                        columnSummaries[name] = string.Join(", ", breakdown);
                    }

                    return new SummaryAuditReadDto
                    {
                        Id = g.FirstOrDefault()?.Id ?? 0,
                        JenisDocAudit = columnSummaries.GetValueOrDefault(nameof(SummaryAuditReadDto.JenisDocAudit)),
                        NAMAAUDIT = formattedNamaAudit,
                        LINK = columnSummaries.GetValueOrDefault(nameof(SummaryAuditReadDto.LINK)),
                        STATUS = columnSummaries.GetValueOrDefault(nameof(SummaryAuditReadDto.STATUS)),
                        PICAUDIT = columnSummaries.GetValueOrDefault(nameof(SummaryAuditReadDto.PICAUDIT)),
                        TAHUN = columnSummaries.GetValueOrDefault(nameof(SummaryAuditReadDto.TAHUN)),
                        SOURCE = columnSummaries.GetValueOrDefault(nameof(SummaryAuditReadDto.SOURCE)),
                        JumlahTemuan = columnSummaries.GetValueOrDefault(nameof(SummaryAuditReadDto.JumlahTemuan))
                    };
                })
                .OrderBy(x => x.NAMAAUDIT)
                .ToList();

            return Ok(grouped);
        }





        [HttpGet("filter")]
        public async Task<IActionResult> GetFiltered([FromQuery] string? type = null)
        {
            var queryParams = HttpContext.Request.Query;
            IQueryable<ListAudit> query = _db.ListAudit.AsQueryable();

            // 🔹 Handle special parameter: type (not part of model)
            if (!string.IsNullOrEmpty(type))
            {
                type = type.Trim().ToLowerInvariant();

                switch (type)
                {
                    case "internal":
                        query = query.Where(a =>
                            a.JENISAUDIT != null &&
                            EF.Functions.Like(a.JENISAUDIT.ToLower(), "%internal%"));
                        break;

                    case "external":
                        query = query.Where(a =>
                            a.JENISAUDIT != null &&
                            EF.Functions.Like(a.JENISAUDIT.ToLower(), "%eksternal%"));
                        break;

                    // 👇 optionally: handle "all" (no filter)
                    case "all":
                        break;

                    default:
                        return BadRequest($"Invalid type value '{type}'. Must be internal, external, or all.");
                }
            }

            // 🔹 Handle dynamic model-based filtering
            if (queryParams.Any())
            {
                foreach (var kvp in queryParams)
                {
                    var column = kvp.Key;
                    if (string.Equals(column, "type", StringComparison.OrdinalIgnoreCase))
                        continue; // skip since handled above

                    var value = kvp.Value.FirstOrDefault()?.Trim();
                    if (string.IsNullOrEmpty(value)) continue;

                    var prop = typeof(ListAudit).GetProperty(column);
                    if (prop == null)
                        return BadRequest($"Column '{column}' does not exist in ListAudit.");

                    var normalizedValue = value.ToLowerInvariant();

                    if (string.IsNullOrEmpty(normalizedValue) ||
                        normalizedValue == "undefined" ||
                        normalizedValue == "null" ||
                        normalizedValue == "(null)")
                    {
                        query = query.Where(e =>
                            EF.Property<object>(e, column) == null ||
                            EF.Property<string>(e, column) == "");
                    }
                    else if (normalizedValue.Contains("%"))
                    {
                        query = query.Where(e =>
                            EF.Property<string>(e, column) != null &&
                            EF.Functions.Like(EF.Property<string>(e, column), value));
                    }
                    else
                    {
                        query = query.Where(e =>
                            EF.Property<string>(e, column) != null &&
                            EF.Functions.Like(
                                EF.Property<string>(e, column).ToLower(),
                                $"%{normalizedValue}%"
                            ));
                    }
                }
            }

            var result = await query.ToListAsync();
            var dtoList = _mapper.Map<List<SummaryAuditReadDto>>(result);

            return Ok(dtoList);
        }



    }
}




