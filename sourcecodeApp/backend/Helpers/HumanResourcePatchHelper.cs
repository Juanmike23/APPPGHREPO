/*
 * PGH-DOC
 * File: Helpers/HumanResourcePatchHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika patch generik untuk resource Human.
 * Kenapa perlu:
 * - Perlu agar patch entity Human konsisten lintas controller dan tidak mengulang refleksi/konversi nilai yang sama.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Newtonsoft.Json.Linq;
using System.Reflection;

namespace PGH.Helpers;

public static class HumanResourcePatchHelper
{
    public const string InvalidFieldsMessage = "Unknown or read-only field(s) in payload.";

    public static List<string> ApplyPatch<T>(
        T entity,
        IReadOnlyDictionary<string, object> updates,
        params string[] additionalReadOnlyFields)
        where T : class
    {
        var type = entity.GetType();
        var invalidFields = new List<string>();
        var readOnlyFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Id",
            "CreatedAt",
            "UpdatedAt"
        };

        foreach (var field in additionalReadOnlyFields)
        {
            if (!string.IsNullOrWhiteSpace(field))
            {
                readOnlyFields.Add(field);
            }
        }

        foreach (var kvp in updates)
        {
            var property = type.GetProperty(
                kvp.Key,
                BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);

            if (property == null || !property.CanWrite || readOnlyFields.Contains(property.Name))
            {
                invalidFields.Add(kvp.Key);
                continue;
            }

            var convertedValue = ConvertPatchValue(kvp.Value, property.PropertyType);
            property.SetValue(entity, convertedValue);
        }

        return invalidFields;
    }

    public static object? ConvertPatchValue(object? value, Type targetType)
    {
        var nullableUnderlying = Nullable.GetUnderlyingType(targetType);
        var actualType = nullableUnderlying ?? targetType;

        if (value == null)
        {
            return nullableUnderlying != null || !actualType.IsValueType
                ? null
                : Activator.CreateInstance(actualType);
        }

        if (value is JToken token)
        {
            return token.Type == JTokenType.Null
                ? null
                : token.ToObject(actualType);
        }

        return Convert.ChangeType(value, actualType);
    }
}
