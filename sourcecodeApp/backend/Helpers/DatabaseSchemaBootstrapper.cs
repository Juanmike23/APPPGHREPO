/*
 * PGH-DOC
 * File: Helpers/DatabaseSchemaBootstrapper.cs
 * Apa fungsi bagian ini:
 * - Menjamin kolom schema kritikal yang dibutuhkan fitur runtime tersedia saat aplikasi start.
 * Kenapa perlu:
 * - Mencegah runtime error "Invalid column name" ketika environment belum sinkron menjalankan migration SQL terbaru.
 * Aturan khususnya apa:
 * - Hanya untuk patch schema kritikal yang idempotent.
 * - Tetap pertahankan migration SQL sebagai source of truth perubahan schema.
 */

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebApplication2.Data;

namespace PGH.Helpers
{
    public static class DatabaseSchemaBootstrapper
    {
        private const string EnsureOpexFyColumnsSql = @"
IF OBJECT_ID(N'[Planing_Realization].[OpexTemplate]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'Planing_Realization.OpexTemplate', N'FullYearFY') IS NULL
    BEGIN
        ALTER TABLE [Planing_Realization].[OpexTemplate]
            ADD [FullYearFY] DECIMAL(28,12) NULL;
    END
    ELSE
    BEGIN
        ALTER TABLE [Planing_Realization].[OpexTemplate]
            ALTER COLUMN [FullYearFY] DECIMAL(28,12) NULL;
    END
END;

IF OBJECT_ID(N'[Planing_Realization].[OpexTemplateMonthlySnapshot]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'Planing_Realization.OpexTemplateMonthlySnapshot', N'SnapshotSource') IS NULL
    BEGIN
        ALTER TABLE [Planing_Realization].[OpexTemplateMonthlySnapshot]
            ADD [SnapshotSource] NVARCHAR(16) NOT NULL
                CONSTRAINT [DF_OpexTemplateMonthlySnapshot_SnapshotSource] DEFAULT (N'import');
    END;

    IF COL_LENGTH(N'Planing_Realization.OpexTemplateMonthlySnapshot', N'HasFullYearFyOverride') IS NULL
    BEGIN
        ALTER TABLE [Planing_Realization].[OpexTemplateMonthlySnapshot]
            ADD [HasFullYearFyOverride] BIT NOT NULL
                CONSTRAINT [DF_OpexTemplateMonthlySnapshot_HasFullYearFyOverride] DEFAULT (0);
    END;

    IF COL_LENGTH(N'Planing_Realization.OpexTemplateMonthlySnapshot', N'FullYearFY') IS NULL
    BEGIN
        ALTER TABLE [Planing_Realization].[OpexTemplateMonthlySnapshot]
            ADD [FullYearFY] DECIMAL(28,12) NULL;
    END
    ELSE
    BEGIN
        ALTER TABLE [Planing_Realization].[OpexTemplateMonthlySnapshot]
            ALTER COLUMN [FullYearFY] DECIMAL(28,12) NULL;
    END

    UPDATE [Planing_Realization].[OpexTemplateMonthlySnapshot]
    SET [SnapshotSource] = N'import'
    WHERE [SnapshotSource] IS NULL OR LTRIM(RTRIM([SnapshotSource])) = N'';
END;

IF OBJECT_ID(N'[Planing_Realization].[OpexBudgetGuardrailConfig]', N'U') IS NULL
BEGIN
    CREATE TABLE [Planing_Realization].[OpexBudgetGuardrailConfig]
    (
        [Id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_OpexBudgetGuardrailConfig] PRIMARY KEY,
        [PlanningDashboardTableId] BIGINT NOT NULL,
        [Year] INT NOT NULL,
        [MonthIndex] INT NOT NULL,
        [TargetPct] DECIMAL(9,4) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_OpexBudgetGuardrailConfig_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_OpexBudgetGuardrailConfig_UpdatedAt] DEFAULT (SYSUTCDATETIME())
    );

    CREATE UNIQUE INDEX [UX_OpexBudgetGuardrailConfig_TableYearMonth]
        ON [Planing_Realization].[OpexBudgetGuardrailConfig]([PlanningDashboardTableId], [Year], [MonthIndex]);

    ALTER TABLE [Planing_Realization].[OpexBudgetGuardrailConfig]
        ADD CONSTRAINT [FK_OpexBudgetGuardrailConfig_PlanningDashboardTable]
        FOREIGN KEY ([PlanningDashboardTableId])
        REFERENCES [Planing_Realization].[PlanningDashboardTable]([Id])
        ON DELETE CASCADE;
END
ELSE
BEGIN
    IF COL_LENGTH(N'Planing_Realization.OpexBudgetGuardrailConfig', N'TargetPct') IS NOT NULL
    BEGIN
        ALTER TABLE [Planing_Realization].[OpexBudgetGuardrailConfig]
            ALTER COLUMN [TargetPct] DECIMAL(9,4) NOT NULL;
    END
END;

IF OBJECT_ID(N'[Planing_BusinessPlan].[BusinessPlanFile]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'Planing_BusinessPlan.BusinessPlanFile', N'IsFolder') IS NULL
    BEGIN
        ALTER TABLE [Planing_BusinessPlan].[BusinessPlanFile]
            ADD [IsFolder] BIT NOT NULL
                CONSTRAINT [DF_BusinessPlanFile_IsFolder] DEFAULT (0);
    END;

    IF COL_LENGTH(N'Planing_BusinessPlan.BusinessPlanFile', N'ParentId') IS NULL
    BEGIN
        ALTER TABLE [Planing_BusinessPlan].[BusinessPlanFile]
            ADD [ParentId] BIGINT NULL;
    END;

    IF COL_LENGTH(N'Planing_BusinessPlan.BusinessPlanFile', N'FileSizeBytes') IS NULL
    BEGIN
        ALTER TABLE [Planing_BusinessPlan].[BusinessPlanFile]
            ADD [FileSizeBytes] BIGINT NULL;
    END;

    IF COL_LENGTH(N'Planing_BusinessPlan.BusinessPlanFile', N'FileStoragePath') IS NULL
    BEGIN
        ALTER TABLE [Planing_BusinessPlan].[BusinessPlanFile]
            ADD [FileStoragePath] NVARCHAR(1024) NULL;
    END;

    UPDATE [Planing_BusinessPlan].[BusinessPlanFile]
    SET [FileSizeBytes] = DATALENGTH([FileData])
    WHERE [IsFolder] = 0
      AND [FileData] IS NOT NULL
      AND ([FileSizeBytes] IS NULL OR [FileSizeBytes] < 0);

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'[Planing_BusinessPlan].[BusinessPlanFile]')
          AND name = N'IX_BusinessPlanFile_ParentId'
    )
    BEGIN
        CREATE INDEX [IX_BusinessPlanFile_ParentId]
            ON [Planing_BusinessPlan].[BusinessPlanFile]([ParentId]);
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'[Planing_BusinessPlan].[BusinessPlanFile]')
          AND name = N'IX_BusinessPlanFile_ParentId_IsFolder_FileName'
    )
    BEGIN
        CREATE INDEX [IX_BusinessPlanFile_ParentId_IsFolder_FileName]
            ON [Planing_BusinessPlan].[BusinessPlanFile]([ParentId], [IsFolder], [FileName]);
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = N'FK_BusinessPlanFile_BusinessPlanFile_ParentId'
          AND parent_object_id = OBJECT_ID(N'[Planing_BusinessPlan].[BusinessPlanFile]')
    )
    BEGIN
        ALTER TABLE [Planing_BusinessPlan].[BusinessPlanFile]
            ADD CONSTRAINT [FK_BusinessPlanFile_BusinessPlanFile_ParentId]
            FOREIGN KEY ([ParentId])
            REFERENCES [Planing_BusinessPlan].[BusinessPlanFile]([Id]);
    END;
END;
";

        public static async Task EnsureCriticalSchemaAsync(
            AppDbContext db,
            ILogger logger,
            CancellationToken cancellationToken = default)
        {
            try
            {
                await db.Database.ExecuteSqlRawAsync(EnsureOpexFyColumnsSql, cancellationToken);
                logger.LogInformation("Critical runtime schema bootstrap completed for required startup columns.");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Critical runtime schema bootstrap failed. Required startup columns might be missing.");
                throw;
            }
        }
    }
}
