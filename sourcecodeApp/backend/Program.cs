/*
 * PGH-DOC

 * File: Program.cs

 * Apa fungsi bagian ini:

 * - File ini menginisialisasi konfigurasi utama aplikasi backend saat startup.

 * Kenapa perlu:

 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.

 * Aturan khususnya apa:

 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.

 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.

 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json.Serialization;
using OfficeOpenXml; // ✅ EPPlus
using PGH.Helpers;
using refactorbackend.Mappers;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using WebApplication2.Data;

var builder = WebApplication.CreateBuilder(args);

static bool IsMissingOrPlaceholder(string? value) =>
    string.IsNullOrWhiteSpace(value) ||
    value.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase);

var authSensitivePermitsPerMinute = Math.Max(
    1,
    builder.Configuration.GetValue<int?>("Security:RateLimit:AuthSensitivePermitsPerMinute") ?? 12);
var authRefreshPermitsPerMinute = Math.Max(
    1,
    builder.Configuration.GetValue<int?>("Security:RateLimit:AuthRefreshPermitsPerMinute") ?? 30);
var dashboardHeavyPermitsPerMinute = Math.Max(
    6,
    builder.Configuration.GetValue<int?>("Security:RateLimit:DashboardHeavyPermitsPerMinute") ?? 24);

ExcelPackage.License.SetNonCommercialOrganization("PGH");

builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes
        .Concat(
        [
            "application/json",
            "application/problem+json",
            "text/json",
            "image/svg+xml"
        ])
        .Distinct(StringComparer.OrdinalIgnoreCase);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Fastest;
});
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Fastest;
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        if (!context.HttpContext.Response.HasStarted)
        {
            context.HttpContext.Response.ContentType = "application/json";
            await context.HttpContext.Response.WriteAsJsonAsync(new
            {
                message = "Terlalu banyak request. Coba lagi sebentar."
            }, cancellationToken: token);
        }
    };

    options.AddPolicy("auth-sensitive", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var path = httpContext.Request.Path.Value?.ToLowerInvariant() ?? "/api/auth";
        var key = $"{ip}:{path}";

        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = authSensitivePermitsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });

    options.AddPolicy("auth-refresh", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var key = $"refresh:{ip}";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = authRefreshPermitsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });

    options.AddPolicy("dashboard-heavy", httpContext =>
    {
        var path = httpContext.Request.Path.Value?.ToLowerInvariant() ?? "/api/dashboard";
        var userId = FeatureAccessResolver.GetUserId(httpContext.User);
        var clientKey = !string.IsNullOrWhiteSpace(userId)
            ? $"user:{userId}"
            : $"ip:{httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
        var key = $"{clientKey}:{path}";

        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = dashboardHeavyPermitsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });
});

static string NormalizeConfiguredOrigin(string value)
{
    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
    {
        throw new InvalidOperationException($"Invalid absolute URL configured: {value}");
    }

    return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
}

static string? TryResolveRequestOrigin(HttpContext context)
{
    var originHeader = context.Request.Headers.Origin.FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(originHeader) &&
        Uri.TryCreate(originHeader, UriKind.Absolute, out var originUri))
    {
        return originUri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
    }

    var refererHeader = context.Request.Headers.Referer.FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(refererHeader) &&
        Uri.TryCreate(refererHeader, UriKind.Absolute, out var refererUri))
    {
        return refererUri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
    }

    return null;
}

static string? TryNormalizeOrigin(string? value)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return null;
    }

    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
    {
        return null;
    }

    return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
}

static bool IsPrivateOrLocalIp(IPAddress ipAddress)
{
    if (IPAddress.IsLoopback(ipAddress))
    {
        return true;
    }

    if (ipAddress.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
    {
        // IPv6 loopback/local link/site local untuk dev LAN.
        return ipAddress.IsIPv6LinkLocal || ipAddress.IsIPv6SiteLocal;
    }

    var bytes = ipAddress.GetAddressBytes();
    if (bytes.Length != 4)
    {
        return false;
    }

    // 10.0.0.0/8
    if (bytes[0] == 10) return true;
    // 172.16.0.0/12
    if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
    // 192.168.0.0/16
    if (bytes[0] == 192 && bytes[1] == 168) return true;
    // 127.0.0.0/8 loopback IPv4
    if (bytes[0] == 127) return true;

    return false;
}

static bool IsDevelopmentLanOrigin(string? origin)
{
    if (string.IsNullOrWhiteSpace(origin))
    {
        return false;
    }

    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
    {
        return false;
    }

    if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
    {
        return false;
    }

    // Frontend dev default port.
    if (uri.Port != 3000)
    {
        return false;
    }

    if (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    if (!IPAddress.TryParse(uri.Host, out var ipAddress))
    {
        return false;
    }

    return IsPrivateOrLocalIp(ipAddress);
}

static bool IsUnsafeHttpMethod(string method) =>
    HttpMethods.IsPost(method) ||
    HttpMethods.IsPut(method) ||
    HttpMethods.IsPatch(method) ||
    HttpMethods.IsDelete(method);

static async Task WriteProblemDetailsAsync(
    HttpContext context,
    int statusCode,
    string title,
    string detail,
    string? type = null)
{
    if (context.Response.HasStarted)
    {
        return;
    }

    context.Response.Clear();
    context.Response.StatusCode = statusCode;
    context.Response.ContentType = "application/problem+json";

    var problem = new ProblemDetails
    {
        Status = statusCode,
        Title = title,
        Detail = detail,
        Type = type ?? $"https://httpstatuses.com/{statusCode}",
        Instance = context.Request.Path
    };
    problem.Extensions["traceId"] = context.TraceIdentifier;

    await context.Response.WriteAsJsonAsync(problem);
}

var jwtSecret = builder.Configuration["Jwt:SecretKey"] ?? string.Empty;
var hasWeakJwtSecret =
    IsMissingOrPlaceholder(jwtSecret) ||
    jwtSecret.Length < 32;

//if (hasWeakJwtSecret)
//{
//    throw new InvalidOperationException(
//        "Jwt:SecretKey must be configured securely and be at least 32 characters. " +
//        "Set it via dotnet user-secrets or the Jwt__SecretKey environment variable.");
//}

var frontendUrl = builder.Configuration["Frontend:BaseUrl"];
if (string.IsNullOrWhiteSpace(frontendUrl))
{
    throw new InvalidOperationException("Frontend:BaseUrl is not configured.");
}

var frontendOrigin = NormalizeConfiguredOrigin(frontendUrl);
var configuredFrontendOrigins =
    builder.Configuration.GetSection("Frontend:AllowedOrigins").Get<string[]>() ??
    Array.Empty<string>();
var frontendOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    frontendOrigin
};
foreach (var configuredOrigin in configuredFrontendOrigins)
{
    if (string.IsNullOrWhiteSpace(configuredOrigin))
    {
        continue;
    }

    frontendOrigins.Add(NormalizeConfiguredOrigin(configuredOrigin));
}

var backendUrl = builder.Configuration["Backend:BaseUrl"];
var backendOrigin = string.IsNullOrWhiteSpace(backendUrl)
    ? null
    : NormalizeConfiguredOrigin(backendUrl);

var allowedRequestOrigins = new HashSet<string>(frontendOrigins, StringComparer.OrdinalIgnoreCase);
var allowDevLanOrigins = builder.Environment.IsDevelopment() &&
    (builder.Configuration.GetValue<bool?>("Frontend:AllowDevLanOrigins") ?? true);

if (!string.IsNullOrWhiteSpace(backendOrigin))
{
    allowedRequestOrigins.Add(backendOrigin);
}

bool IsAllowedOrigin(string? origin)
{
    var normalized = TryNormalizeOrigin(origin);
    if (string.IsNullOrWhiteSpace(normalized))
    {
        return false;
    }

    if (allowedRequestOrigins.Contains(normalized))
    {
        return true;
    }

    return allowDevLanOrigins && IsDevelopmentLanOrigin(normalized);
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"];
if (string.IsNullOrWhiteSpace(jwtIssuer) || jwtIssuer.Contains("${", StringComparison.Ordinal))
{
    jwtIssuer = backendOrigin ?? frontendOrigin;
    builder.Configuration["Jwt:Issuer"] = jwtIssuer;
}

var jwtAudience = builder.Configuration["Jwt:Audience"];
if (string.IsNullOrWhiteSpace(jwtAudience) || jwtAudience.Contains("${", StringComparison.Ordinal))
{
    jwtAudience = backendOrigin ?? frontendOrigin;
    builder.Configuration["Jwt:Audience"] = jwtAudience;
}

var securityHeadersEnabled = builder.Configuration.GetValue<bool?>("Security:EnableSecurityHeaders") ?? true;
var forceHttpsRedirection = builder.Configuration.GetValue<bool?>("Security:ForceHttpsRedirection") ?? false;
var useForwardedHeaders = builder.Configuration.GetValue<bool?>("Security:UseForwardedHeaders") ?? false;
var enableHsts = builder.Configuration.GetValue<bool?>("Security:EnableHsts")
    ?? !builder.Environment.IsDevelopment();
var enableResponseCompression = builder.Configuration.GetValue<bool?>("Performance:EnableResponseCompression") ?? true;

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", p =>
        p.SetIsOriginAllowed(origin => IsAllowedOrigin(origin))
         .AllowAnyMethod()
         .AllowAnyHeader()
         .WithExposedHeaders(
            "X-Total-Count",
            "X-Returned-Count",
            "X-Result-Limit",
            "X-Result-Offset",
            "X-Has-More",
            "X-Log-Scope")
         .AllowCredentials()
    );
});


// ✅ Controllers with NewtonsoftJson
builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling =
            Newtonsoft.Json.ReferenceLoopHandling.Ignore;
        options.SerializerSettings.ContractResolver = new DefaultContractResolver();
    });

// ✅ Database
var dbRetryEnabled = builder.Configuration.GetValue<bool?>("Database:Retry:Enabled") ?? true;
var dbRetryMaxCount = Math.Max(1, builder.Configuration.GetValue<int?>("Database:Retry:MaxRetryCount") ?? 5);
var dbRetryDelaySeconds = Math.Max(1, builder.Configuration.GetValue<int?>("Database:Retry:MaxRetryDelaySeconds") ?? 10);
var dbRetryMaxDelay = TimeSpan.FromSeconds(dbRetryDelaySeconds);
var connectionString = builder.Configuration.GetConnectionString("PGHAzure");

if (IsMissingOrPlaceholder(connectionString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:PGHAzure is not configured. " +
        "Set it via dotnet user-secrets or the ConnectionStrings__PGHAzure environment variable.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        if (dbRetryEnabled)
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: dbRetryMaxCount,
                maxRetryDelay: dbRetryMaxDelay,
                errorNumbersToAdd: null);
        }
    });
});

// ✅ AutoMapper
builder.Services.AddAutoMapper(_ => { }, typeof(GlobalMappingProfile).Assembly);



// ✅ Authentication (JWT in cookies)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var config = builder.Configuration;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = config["Jwt:Issuer"],
            ValidAudience = config["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret))
        };

        // 👇 Read token from cookie "access_token"
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {


                // Cookie first (browser)
                if (context.Request.Cookies.ContainsKey("access_token"))
                {
                    context.Token = context.Request.Cookies["access_token"];
                    return Task.CompletedTask;
                }

                // Fallback to Authorization header (Postman)
                var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
                if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
                {
                    context.Token = authHeader.Substring("Bearer ".Length);
                }

                return Task.CompletedTask;
            }
        };

    });

var app = builder.Build();

using (var startupScope = app.Services.CreateScope())
{
    var startupDb = startupScope.ServiceProvider.GetRequiredService<AppDbContext>();
    var startupLogger = startupScope.ServiceProvider
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("StartupSchemaBootstrap");
    var startupEnvironment = startupScope.ServiceProvider.GetRequiredService<IHostEnvironment>();

    await DatabaseSchemaBootstrapper.EnsureCriticalSchemaAsync(
        startupDb,
        startupLogger);

    try
    {
        var migratedBusinessPlanFiles = await BusinessPlanFileStorageMigrationHelper
            .MigrateLegacyFilesAsync(
                startupDb,
                startupEnvironment.ContentRootPath,
                startupLogger);

        if (migratedBusinessPlanFiles > 0)
        {
            startupLogger.LogInformation(
                "Migrated {Count} legacy business plan file(s) from SQL blob storage to filesystem.",
                migratedBusinessPlanFiles);
        }
    }
    catch (Exception ex)
    {
        startupLogger.LogWarning(
            ex,
            "Business plan file storage migration failed during startup. API startup will continue.");
    }

}

// ✅ CORS must be before auth
// CORS diaktifkan setelah UseRouting, sebelum auth/authorization.

if (useForwardedHeaders)
{
    var forwardedOptions = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
    };
    forwardedOptions.KnownIPNetworks.Clear();
    forwardedOptions.KnownProxies.Clear();
    app.UseForwardedHeaders(forwardedOptions);
}

if (forceHttpsRedirection)
{
    app.UseHttpsRedirection();
}

if (enableHsts && !app.Environment.IsDevelopment())
{
    app.UseHsts();
}

if (enableResponseCompression)
{
    app.UseResponseCompression();
}

app.UseRouting();
app.UseCors("AllowFrontend");
app.UseRateLimiter();

// Global exception handling untuk API: response konsisten dalam format ProblemDetails.
app.Use(async (context, next) =>
{
    var logger = context.RequestServices
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("GlobalExceptionHandler");

    try
    {
        await next();
    }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
    {
        logger.LogInformation(
            "Request dibatalkan oleh client/browser atau AbortController frontend. Method: {Method}, Path: {Path}, TraceId: {TraceId}",
            context.Request.Method,
            context.Request.Path,
            context.TraceIdentifier);

        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = 499;
        }
    }
    catch (OperationCanceledException ex)
    {
        logger.LogWarning(
            ex,
            "Request dibatalkan oleh server/pipeline. Method: {Method}, Path: {Path}, TraceId: {TraceId}",
            context.Request.Method,
            context.Request.Path,
            context.TraceIdentifier);
        await WriteProblemDetailsAsync(
            context,
            StatusCodes.Status408RequestTimeout,
            "Request timeout",
            "Request timeout atau dibatalkan.");
    }
    catch (UnauthorizedAccessException ex)
    {
        logger.LogWarning(ex, "Unauthorized access. Path: {Path}", context.Request.Path);
        await WriteProblemDetailsAsync(
            context,
            StatusCodes.Status403Forbidden,
            "Forbidden",
            "Akses ditolak untuk operasi ini.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Unhandled exception. Path: {Path}", context.Request.Path);
        await WriteProblemDetailsAsync(
            context,
            StatusCodes.Status500InternalServerError,
            "Internal Server Error",
            "Terjadi error pada server. Silakan coba lagi.");
    }
});

if (securityHeadersEnabled)
{
    app.Use(async (context, next) =>
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

        if (context.Request.IsHttps)
        {
            context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        }

        await next();
    });
}

app.Use(async (context, next) =>
{
    if (IsUnsafeHttpMethod(context.Request.Method) &&
        context.Request.Path.StartsWithSegments("/api"))
    {
        var requestOrigin = TryResolveRequestOrigin(context);
        if (!string.IsNullOrWhiteSpace(requestOrigin) &&
            !IsAllowedOrigin(requestOrigin))
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "Invalid request origin."
            });
            return;
        }
    }

    await next();
});

app.MapGet("/", () => Results.Ok(new
{
    service = "pghBackend",
    status = "ok",
    environment = app.Environment.EnvironmentName,
    timeUtc = DateTime.UtcNow
})).AllowAnonymous();

app.MapGet("/healthz", () => Results.Ok(new
{
    service = "pghBackend",
    status = "healthy",
    timeUtc = DateTime.UtcNow
})).AllowAnonymous();

static Task WriteForbiddenAsync(HttpContext context)
{
    context.Response.StatusCode = 403;
    return context.Response.WriteAsJsonAsync(new
    {
        message = FeatureAccessResolver.AccessDeniedMessage
    });
}

// ✅ Authentication & Authorization
app.UseAuthentication();
app.Use(async (context, next) =>
{
    var method = context.Request.Method;
    var endpoint = context.GetEndpoint();

    if (method == HttpMethods.Options)
    {
        context.Response.StatusCode = 204;
        return;
    }

    if (endpoint == null)
    {
        await next();
        return;
    }

    if (endpoint.Metadata.GetMetadata<IAllowAnonymous>() != null ||
        FeatureAccessResolver.IsPublicEndpoint(context.Request.Path))
    {
        await next();
        return;
    }

    var authResult = await context.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
    if (!authResult.Succeeded || authResult.Principal == null)
    {
        context.Response.StatusCode = 401;
        await context.Response.WriteAsJsonAsync(new { message = "Unauthorized" });
        return;
    }

    context.User = authResult.Principal;

    if (FeatureAccessResolver.IsSelfServiceAccountEndpoint(context.Request))
    {
        await next();
        return;
    }

    var level = FeatureAccessResolver.GetUserLevel(context.User);
    if (string.IsNullOrWhiteSpace(level))
    {
        await WriteForbiddenAsync(context);
        return;
    }

    if (FeatureAccessResolver.IsExecutive(context.User))
    {
        if (!FeatureAccessResolver.IsReadOnlyRequest(context.Request))
        {
            await WriteForbiddenAsync(context);
            return;
        }

        await next();
        return;
    }

    if (FeatureAccessResolver.IsAdmin(context.User))
    {
        await next();
        return;
    }

    var requiredStream = FeatureAccessResolver.ResolveRequestedStream(context);
    if (!FeatureAccessResolver.CanAccessRequest(context.User, context, requiredStream))
    {
        await WriteForbiddenAsync(context);
        return;
    }

    if (!FeatureAccessResolver.CanMutateComplianceResource(context.User, context.Request, requiredStream))
    {
        await WriteForbiddenAsync(context);
        return;
    }

    if (!FeatureAccessResolver.CanPerform(level, method))
    {
        await WriteForbiddenAsync(context);
        return;
    }

    try
    {
        await next();
    }
    catch (UnauthorizedAccessException)
    {
        await WriteForbiddenAsync(context);
    }
});


app.UseAuthorization();




// ✅ Static files for /Photos
//app.UseStaticFiles(new StaticFileOptions
//{
//    FileProvider = new PhysicalFileProvider(
//        Path.Combine(Directory.GetCurrentDirectory(), "Photos")),
//    RequestPath = "/Photos"
//});

// ✅ Controllers
app.MapControllers();

try
{
    app.Run();
}
catch (OperationCanceledException) when (app.Lifetime.ApplicationStopping.IsCancellationRequested)
{
    var shutdownLogger = app.Services
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("ApplicationShutdown");

    shutdownLogger.LogInformation("Application shutdown canceled pending work during host stop.");
}
