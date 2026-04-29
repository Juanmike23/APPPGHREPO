/*
 * PGH-DOC
 * File: Helpers/SqlServerRetryHelper.cs
 * Apa fungsi bagian ini:
 * - File ini menyediakan utilitas retry dan klasifikasi error SQL Server transien.
 * Kenapa perlu:
 * - Perlu agar operasi save yang rawan transient failure bisa ditangani konsisten lintas controller.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace PGH.Helpers;

public static class SqlServerRetryHelper
{
    public static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        return ex.InnerException is SqlException sqlException &&
               (sqlException.Number == 2601 || sqlException.Number == 2627);
    }

    public static async Task SaveChangesWithTransientRetryAsync(
        DbContext dbContext,
        ILogger logger,
        string operationName,
        CancellationToken cancellationToken,
        int maxAttempts = 3)
    {
        var attempt = 0;
        var delay = TimeSpan.FromMilliseconds(180);

        while (true)
        {
            attempt++;
            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts && IsTransientDatabaseFailure(ex))
            {
                logger.LogWarning(
                    ex,
                    "Transient SQL failure on {OperationName}. Attempt {Attempt}/{MaxAttempts}, retry in {DelayMs}ms.",
                    operationName,
                    attempt,
                    maxAttempts,
                    (int)delay.TotalMilliseconds);

                await Task.Delay(delay, cancellationToken);
                delay = TimeSpan.FromMilliseconds(Math.Min(delay.TotalMilliseconds * 2, 1200));
            }
        }
    }

    public static bool IsTransientDatabaseFailure(Exception ex)
    {
        if (TryExtractSqlException(ex, out var sqlException) && sqlException != null)
        {
            return IsTransientSqlErrorNumber(sqlException.Number);
        }

        if (ex is InvalidOperationException invalidOp &&
            invalidOp.Message.Contains("transient failure", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }

    private static bool TryExtractSqlException(Exception ex, out SqlException? sqlException)
    {
        for (var current = ex; current != null; current = current.InnerException!)
        {
            if (current is SqlException found)
            {
                sqlException = found;
                return true;
            }

            if (current.InnerException == null)
            {
                break;
            }
        }

        sqlException = null;
        return false;
    }

    private static bool IsTransientSqlErrorNumber(int number)
    {
        return number switch
        {
            -2 or
            53 or
            233 or
            4060 or
            10928 or 10929 or
            40197 or 40501 or 40540 or 40613 or
            49918 or 49919 or 49920 => true,
            _ => false
        };
    }
}
