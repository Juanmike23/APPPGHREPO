namespace PGH.Helpers;

public static class UploadLimitHelper
{
    private const long OneMegabyte = 1024L * 1024L;

    public const long ProfilePhotoMaxFileBytes = 5L * OneMegabyte;
    public const long ProfilePhotoMaxRequestBytes = 6L * OneMegabyte;

    public const long UserImageMaxFileBytes = 8L * OneMegabyte;
    public const long UserImageMaxRequestBytes = 10L * OneMegabyte;

    public const long AuditEvidenceMaxFileBytes = 10L * OneMegabyte;
    public const long AuditEvidenceMaxRequestBytes = 12L * OneMegabyte;

    public const long GenericImportMaxFileBytes = 50L * OneMegabyte;
    public const long GenericImportMaxRequestBytes = 55L * OneMegabyte;

    public const long ComplianceDocumentMaxFileBytes = 50L * OneMegabyte;
    public const long ComplianceDocumentMaxRequestBytes = 55L * OneMegabyte;

    public const long PlanningDirectoryMaxFileBytes = 100L * OneMegabyte;
    public const long PlanningDirectoryMaxRequestBytes = 105L * OneMegabyte;

    public const long OpexImportMaxFileBytes = 100L * OneMegabyte;
    public const long OpexImportMaxRequestBytes = 105L * OneMegabyte;

    public static string ToDisplaySize(long bytes)
    {
        if (bytes <= 0)
        {
            return "0 MB";
        }

        var wholeMegabytes = bytes / OneMegabyte;
        if (bytes % OneMegabyte == 0)
        {
            return $"{wholeMegabytes} MB";
        }

        return $"{Math.Round(bytes / (double)OneMegabyte, 1):0.#} MB";
    }
}
