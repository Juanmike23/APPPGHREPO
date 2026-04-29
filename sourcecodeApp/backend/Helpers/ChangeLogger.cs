/*
 * PGH-DOC
 * File: Helpers/ChangeLogger.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan logika bantu bersama agar kode fitur tetap konsisten.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Newtonsoft.Json;

public static class ChangeLogger
{
    public static string GetDifferences<T>(T original, T updated)
    {
        var originalDict = JsonConvert.DeserializeObject<Dictionary<string, object>>(JsonConvert.SerializeObject(original))
            ?? new Dictionary<string, object>();
        var updatedDict = JsonConvert.DeserializeObject<Dictionary<string, object>>(JsonConvert.SerializeObject(updated))
            ?? new Dictionary<string, object>();

        var diff = new Dictionary<string, object>();

        foreach (var kvp in updatedDict)
        {
            originalDict.TryGetValue(kvp.Key, out var originalValue);

            if (!object.Equals(originalValue, kvp.Value))
            {
                diff[kvp.Key] = new { From = originalValue, To = kvp.Value };
            }
        }

        return JsonConvert.SerializeObject(diff, Formatting.Indented);
    }
}
