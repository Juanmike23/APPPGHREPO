/*
 * PGH-DOC
 * File: Controllers/AuthController.cs
 * Apa fungsi bagian ini:
 * - File ini menangani endpoint API dan alur request/response fitur.
 * Kenapa perlu:
 * - Perlu agar alur bisnis, keamanan data, dan integrasi antar unit bisa dipelihara tanpa duplikasi logika.
 * Aturan khususnya apa:
 * - Gunakan helper/global engine yang sudah ada; hindari membuat query engine custom per unit.
 * - Perubahan schema wajib lewat sql/migrations dan tercatat di SchemaScriptHistory.
 * - Jaga CreatedAt/UpdatedAt serta validasi akses sesuai role.
 */

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using PGH.Models;     // User, RefreshToken
using PGH.Helpers;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Data;
using System.Threading;
using System.Threading.Tasks;
using WebApplication2.Data;

using PGH.Models.User;
using PGH.Models.ChangeLog;


namespace pghBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class AuthController : ControllerBase
    {
        private const string UserAccessAuditTableName = "UserAccessAudit";
        private static readonly JsonSerializerOptions AuditJsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        private readonly AppDbContext _context;
        private readonly IMemoryCache _memoryCache;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthController> _logger;
        private const int LoginFailureLimit = 8;
        private static readonly TimeSpan LoginFailureWindow = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan LoginLockoutDuration = TimeSpan.FromMinutes(10);

        public AuthController(
            AppDbContext context,
            IMemoryCache memoryCache,
            IConfiguration configuration,
            ILogger<AuthController> logger)
        {
            _context = context;
            _memoryCache = memoryCache;
            _configuration = configuration;
            _logger = logger;
        }


        [Authorize]
        [HttpGet("me")]
        public IActionResult Me()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            var name = User.FindFirst(ClaimTypes.Name)?.Value;
            var level = FeatureAccessResolver.ToDisplayLevel(
                FeatureAccessResolver.GetUserLevel(User) ?? "executive");
            var stream = FeatureAccessResolver.ToDisplayStream(
                FeatureAccessResolver.GetUserStream(User) ?? FeatureAccessResolver.EnterpriseStream);

            return Ok(new { userId, email, name, level, stream });
        }

        // ===== Login =====
        [AllowAnonymous]
        [EnableRateLimiting("auth-sensitive")]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { message = "Email dan password wajib diisi." });

            try
            {
                var email = request.Email.Trim().ToLowerInvariant();
                var loginAttemptKey = BuildLoginAttemptKey(email);
                if (TryGetActiveLoginLockout(loginAttemptKey, out var retryAfter))
                {
                    Response.Headers["Retry-After"] = Math.Ceiling(retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                    return StatusCode(StatusCodes.Status429TooManyRequests, new
                    {
                        message = "Terlalu banyak percobaan login. Coba lagi beberapa menit lagi."
                    });
                }
                _logger.LogInformation("[LOGIN] Request received. Email = {Email}", email);

                // cari user
                var user = await _context.Users.FirstOrDefaultAsync(
                    u => u.Email.ToLower() == email && !u.IsDeleted, ct);

                if (user == null)
                {
                    RegisterLoginFailure(loginAttemptKey);
                    _logger.LogWarning("❌ [LOGIN] User not found in DB. Email = {Email}", email);
                    return Unauthorized(new { message = "Email atau password salah." });
                }

                _logger.LogInformation("[LOGIN] User found. Email = {Email}", user.Email);

                bool pwOk;
                try
                {
                    pwOk = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
                }
                catch (Exception exVerify)
                {
                    RegisterLoginFailure(loginAttemptKey);
                    _logger.LogError(exVerify, "[LOGIN] Password verification crashed. Email = {Email}", email);
                    return Unauthorized(new { message = "Email atau password salah." });
                }

                if (!pwOk)
                {
                    RegisterLoginFailure(loginAttemptKey);
                    _logger.LogWarning("[LOGIN] Password mismatch. Email = {Email}", email);
                    return Unauthorized(new { message = "Email atau password salah." });
                }

                // kalau lolos → generate token
                var accessTokenExpiryMinutes = _configuration.GetValue<int?>("Jwt:AccessTokenExpiryMinutes") ?? 60;
                var refreshTokenExpiryDays = _configuration.GetValue<int?>("Jwt:RefreshTokenExpiryDays") ?? 7;

                var (accessToken, accessExpiresAt) = GenerateJwtToken(user, accessTokenExpiryMinutes);

                var refreshRaw = GenerateRefreshToken();
                var refreshHash = Sha256Base64(refreshRaw);
                var refreshExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpiryDays);

                _context.RefreshTokens.Add(new RefreshToken
                {
                    TokenHash = refreshHash,
                    UserId = user.Id,
                    ExpiresAt = refreshExpiresAt,
                    IsRevoked = false,
                    CreatedAt = DateTime.UtcNow,
                    UserAgent = Request.Headers.UserAgent.ToString(),
                    CreatedByIp = HttpContext.Connection.RemoteIpAddress?.ToString()
                });

                await _context.SaveChangesAsync(ct);

                Response.Cookies.Append("access_token", accessToken, BuildCookieOptions(accessExpiresAt));
                Response.Cookies.Append("refresh_token", refreshRaw, BuildCookieOptions(refreshExpiresAt));
                ClearLoginFailures(loginAttemptKey);

                _logger.LogInformation("[LOGIN] Success for {Email}", user.Email);

                return Ok(new
                {
                    message = "Login berhasil.",
                    accessTokenExpiresAt = accessExpiresAt,
                    refreshTokenExpiresAt = refreshExpiresAt,
                    user = BuildAuthUserResponse(user)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[LOGIN] Unexpected error.");
                return StatusCode(500, new { message = "Terjadi kesalahan server." });
            }
        }

        [HttpGet("gen-hash")]
        public IActionResult GenHash([FromQuery] string password)
        {
            if (string.IsNullOrEmpty(password))
                return BadRequest("Password required");

            var hash = BCrypt.Net.BCrypt.HashPassword(password);    
            return Ok(new { password, hash });
        }

        // ===== Profile =====
        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> Profile(CancellationToken ct)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);
            if (user == null) return Unauthorized();

            return Ok(BuildAuthUserResponse(user));
        }

        [Authorize]
        [HttpPatch("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken ct)
        {
            if (request == null)
            {
                return BadRequest(new { message = "Payload profile tidak valid." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);
            if (user == null)
            {
                return Unauthorized();
            }

            var nextName = (request.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(nextName))
            {
                return BadRequest(new { message = "Nama tidak boleh kosong." });
            }

            if (nextName.Length > 120)
            {
                return BadRequest(new { message = "Nama maksimal 120 karakter." });
            }

            if (string.Equals(user.Name, nextName, StringComparison.Ordinal))
            {
                return Ok(new
                {
                    message = "Tidak ada perubahan profile.",
                    user = BuildAuthUserResponse(user)
                });
            }

            user.Name = nextName;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Profil berhasil diperbarui.",
                user = BuildAuthUserResponse(user)
            });
        }

        [Authorize]
        [HttpPost("profile/photo")]
        [RequestSizeLimit(UploadLimitHelper.ProfilePhotoMaxRequestBytes)]
        public async Task<IActionResult> UpdateProfilePhoto([FromForm] IFormFile? file, CancellationToken ct)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "File foto profil belum dipilih." });
            }

            if (file.Length > UploadLimitHelper.ProfilePhotoMaxFileBytes)
            {
                return BadRequest(new
                {
                    message = $"Ukuran file maksimal {UploadLimitHelper.ToDisplaySize(UploadLimitHelper.ProfilePhotoMaxFileBytes)}."
                });
            }

            var mimeType = (file.ContentType ?? string.Empty).Trim().ToLowerInvariant();
            var allowedMimeTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp"
            };

            if (!allowedMimeTypes.Contains(mimeType))
            {
                return BadRequest(new { message = "Format foto harus JPG, PNG, atau WEBP." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            var userExists = await _context.Users.AnyAsync(u => u.Id == userId && !u.IsDeleted, ct);
            if (!userExists)
            {
                return Unauthorized();
            }

            await using var stream = new MemoryStream();
            await file.CopyToAsync(stream, ct);
            var photoBytes = stream.ToArray();

            var oldImages = await _context.UserImages
                .Where(x => x.UserId == userId)
                .ToListAsync(ct);
            if (oldImages.Count > 0)
            {
                _context.UserImages.RemoveRange(oldImages);
            }

            _context.UserImages.Add(new UserImage
            {
                UserId = userId,
                MimeType = mimeType,
                ImageData = photoBytes,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync(ct);

            return Ok(new { message = "Foto profil berhasil diperbarui." });
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
        {
            if (request == null)
            {
                return BadRequest(new { message = "Payload password tidak valid." });
            }

            var currentPassword = request.CurrentPassword?.Trim() ?? string.Empty;
            var newPassword = request.NewPassword?.Trim() ?? string.Empty;
            var confirmPassword = request.ConfirmPassword?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(currentPassword) ||
                string.IsNullOrWhiteSpace(newPassword) ||
                string.IsNullOrWhiteSpace(confirmPassword))
            {
                return BadRequest(new { message = "Semua kolom password wajib diisi." });
            }

            if (!string.Equals(newPassword, confirmPassword, StringComparison.Ordinal))
            {
                return BadRequest(new { message = "Konfirmasi password baru tidak sama." });
            }

            if (newPassword.Length < 8)
            {
                return BadRequest(new { message = "Password baru minimal 8 karakter." });
            }

            if (newPassword.Length > 128)
            {
                return BadRequest(new { message = "Password baru maksimal 128 karakter." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);
            if (user == null)
            {
                return Unauthorized();
            }

            var currentPasswordValid = BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash);
            if (!currentPasswordValid)
            {
                return Unauthorized(new { message = "Password saat ini tidak sesuai." });
            }

            var newPasswordIsSameAsCurrent = BCrypt.Net.BCrypt.Verify(newPassword, user.PasswordHash);
            if (newPasswordIsSameAsCurrent)
            {
                return BadRequest(new { message = "Password baru tidak boleh sama dengan password saat ini." });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
            user.UpdatedAt = DateTime.UtcNow;

            var currentRefreshTokenRaw = Request.Cookies["refresh_token"];
            var currentRefreshHash = string.IsNullOrWhiteSpace(currentRefreshTokenRaw)
                ? null
                : Sha256Base64(currentRefreshTokenRaw);

            var activeOtherTokens = await _context.RefreshTokens
                .Where(r =>
                    r.UserId == user.Id &&
                    !r.IsRevoked &&
                    (currentRefreshHash == null || r.TokenHash != currentRefreshHash))
                .ToListAsync(ct);

            foreach (var token in activeOtherTokens)
            {
                token.IsRevoked = true;
                token.RevokedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Password berhasil diperbarui.",
                revokedOtherSessions = activeOtherTokens.Count
            });
        }

        [Authorize]
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(CancellationToken ct)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async cancellationToken =>
                {
                    var adminOnly = EnsureAdminOnly();
                    if (adminOnly != null)
                        return adminOnly;

                    var users = await _context.Users
                        .AsNoTracking()
                        .Where(u => !u.IsDeleted)
                        .OrderBy(u => u.Name)
                        .ThenBy(u => u.Email)
                        .Select(u => new AdminUserAccessUserResponse
                        {
                            Id = u.Id,
                            Email = u.Email,
                            Name = u.Name,
                            Level = FeatureAccessResolver.ToDisplayLevel(
                                FeatureAccessResolver.NormalizeLevel(u.Level) ?? "executive"),
                            Stream = FeatureAccessResolver.ToDisplayStream(
                                FeatureAccessResolver.GetEffectiveStream(
                                    FeatureAccessResolver.NormalizeLevel(u.Level) ?? "executive",
                                    u.Stream) ?? FeatureAccessResolver.EnterpriseStream),
                            CreatedAt = u.CreatedAt,
                            UpdatedAt = u.UpdatedAt
                        })
                        .ToListAsync(cancellationToken);

                    return Ok(users);
                },
                "User access admin request was canceled.",
                ct);
        }

        [Authorize]
        [HttpGet("users/access-audit")]
        public async Task<IActionResult> GetUserAccessAudit([FromQuery] int take = 100, CancellationToken ct = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async cancellationToken =>
                {
                    var adminOnly = EnsureAdminOnly();
                    if (adminOnly != null)
                        return adminOnly;

                    take = Math.Clamp(take, 1, 500);

                    var logs = await _context.ChangeLog
                        .AsNoTracking()
                        .Where(x => x.TableName == UserAccessAuditTableName)
                        .OrderByDescending(x => x.Timestamp)
                        .Take(take)
                        .ToListAsync(cancellationToken);

                    return Ok(MapUserAccessAuditLogs(logs));
                },
                "User access admin request was canceled.",
                ct);
        }

        [Authorize]
        [HttpGet("users/{userId:guid}/access-audit")]
        public async Task<IActionResult> GetUserAccessAuditByUser(Guid userId, [FromQuery] int take = 100, CancellationToken ct = default)
        {
            return await RequestCancellationHelper.ExecuteAsync(
                this,
                async cancellationToken =>
                {
                    var adminOnly = EnsureAdminOnly();
                    if (adminOnly != null)
                        return adminOnly;

                    take = Math.Clamp(take, 1, 500);

                    var logs = await _context.ChangeLog
                        .AsNoTracking()
                        .Where(x =>
                            x.TableName == UserAccessAuditTableName &&
                            x.ChangeSummary != null &&
                            x.ChangeSummary.Contains(userId.ToString()))
                        .OrderByDescending(x => x.Timestamp)
                        .Take(take)
                        .ToListAsync(cancellationToken);

                    var results = MapUserAccessAuditLogs(logs)
                        .Where(x => string.Equals(x.TargetUserId, userId.ToString(), StringComparison.OrdinalIgnoreCase))
                        .ToList();

                    return Ok(results);
                },
                "User access admin request was canceled.",
                ct);
        }

        // ===== Check User =====
        [HttpGet("check")]
        public async Task<IActionResult> CheckUser([FromQuery] string email, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "Email is required" });

            var user = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower() && !u.IsDeleted, ct);

            if (user == null)
                return NotFound(new { exists = false, message = "User not found" });

            return Ok(new
            {
                exists = true,
                id = user.Id,
                email = user.Email,
                name = user.Name
            });
        }

        // ===== Refresh =====
        [AllowAnonymous]
        [EnableRateLimiting("auth-refresh")]
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh(CancellationToken ct)
        {
            var refreshToken = Request.Cookies["refresh_token"];
            if (string.IsNullOrEmpty(refreshToken))
            {
                ClearAuthCookies();
                return Unauthorized(new { message = "Refresh token missing." });
            }

            var refreshHash = Sha256Base64(refreshToken);
            var accessTokenExpiryMinutes = _configuration.GetValue<int?>("Jwt:AccessTokenExpiryMinutes") ?? 60;
            var refreshTokenExpiryDays = _configuration.GetValue<int?>("Jwt:RefreshTokenExpiryDays") ?? 7;
            var strategy = _context.Database.CreateExecutionStrategy();
            var flow = await strategy.ExecuteAsync(async () =>
            {
                var now = DateTime.UtcNow;
                await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

                var stored = await _context.RefreshTokens
                    .Include(r => r.User)
                    .FirstOrDefaultAsync(r => r.TokenHash == refreshHash, ct);

                if (stored == null)
                {
                    await transaction.RollbackAsync(ct);
                    return (
                        Success: false,
                        Message: "Refresh token invalid or expired.",
                        AccessToken: (string?)null,
                        AccessExpiresAt: (DateTime?)null,
                        RefreshToken: (string?)null,
                        RefreshExpiresAt: (DateTime?)null);
                }

                if (stored.IsRevoked)
                {
                    var revokedReplacementCount = await RevokeRefreshTokenReplacementChainAsync(
                        stored.ReplacedByTokenHash,
                        now,
                        ct);

                    if (revokedReplacementCount > 0)
                    {
                        _logger.LogWarning(
                            "Refresh token reuse detected. UserId={UserId}, revokedReplacementCount={RevokedReplacementCount}",
                            stored.UserId,
                            revokedReplacementCount);
                        await _context.SaveChangesAsync(ct);
                    }

                    await transaction.CommitAsync(ct);
                    return (
                        Success: false,
                        Message: revokedReplacementCount > 0
                            ? "Refresh token sudah pernah dipakai. Sesi ditutup demi keamanan. Silakan login ulang."
                            : "Refresh token invalid or expired.",
                        AccessToken: (string?)null,
                        AccessExpiresAt: (DateTime?)null,
                        RefreshToken: (string?)null,
                        RefreshExpiresAt: (DateTime?)null);
                }

                if (stored.ExpiresAt < now)
                {
                    stored.IsRevoked = true;
                    stored.RevokedAt = now;
                    await _context.SaveChangesAsync(ct);
                    await transaction.CommitAsync(ct);
                    return (
                        Success: false,
                        Message: "Refresh token invalid or expired.",
                        AccessToken: (string?)null,
                        AccessExpiresAt: (DateTime?)null,
                        RefreshToken: (string?)null,
                        RefreshExpiresAt: (DateTime?)null);
                }

                // Revoke token bila user sudah tidak aktif.
                if (stored.User == null || stored.User.IsDeleted)
                {
                    await _context.RefreshTokens
                        .Where(r => r.Id == stored.Id && !r.IsRevoked)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(r => r.IsRevoked, true)
                            .SetProperty(r => r.RevokedAt, now), ct);

                    await transaction.CommitAsync(ct);
                    return (
                        Success: false,
                        Message: "User account is no longer active.",
                        AccessToken: (string?)null,
                        AccessExpiresAt: (DateTime?)null,
                        RefreshToken: (string?)null,
                        RefreshExpiresAt: (DateTime?)null);
                }

                var (newAccess, accessExpiresAt) = GenerateJwtToken(stored.User, accessTokenExpiryMinutes);
                var newRefreshRaw = GenerateRefreshToken();
                var newRefreshHash = Sha256Base64(newRefreshRaw);
                var refreshExpiresAt = now.AddDays(refreshTokenExpiryDays);

                // Compare-and-set revoke: cegah race condition saat refresh paralel.
                var revokeAffected = await _context.RefreshTokens
                    .Where(r => r.Id == stored.Id && !r.IsRevoked)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(r => r.IsRevoked, true)
                        .SetProperty(r => r.RevokedAt, now)
                        .SetProperty(r => r.ReplacedByTokenHash, newRefreshHash), ct);

                if (revokeAffected == 0)
                {
                    await transaction.RollbackAsync(ct);
                    return (
                        Success: false,
                        Message: "Refresh token sudah tidak aktif. Silakan login ulang.",
                        AccessToken: (string?)null,
                        AccessExpiresAt: (DateTime?)null,
                        RefreshToken: (string?)null,
                        RefreshExpiresAt: (DateTime?)null);
                }

                _context.RefreshTokens.Add(new RefreshToken
                {
                    TokenHash = newRefreshHash,
                    UserId = stored.UserId,
                    ExpiresAt = refreshExpiresAt,
                    CreatedAt = now,
                    CreatedByIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = Request.Headers.UserAgent.ToString(),
                    IsRevoked = false
                });

                await _context.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);

                return (
                    Success: true,
                    Message: "Token refreshed",
                    AccessToken: (string?)newAccess,
                    AccessExpiresAt: (DateTime?)accessExpiresAt,
                    RefreshToken: (string?)newRefreshRaw,
                    RefreshExpiresAt: (DateTime?)refreshExpiresAt);
            });

            if (!flow.Success ||
                string.IsNullOrWhiteSpace(flow.AccessToken) ||
                !flow.AccessExpiresAt.HasValue ||
                string.IsNullOrWhiteSpace(flow.RefreshToken) ||
                !flow.RefreshExpiresAt.HasValue)
            {
                ClearAuthCookies();
                return Unauthorized(new { message = flow.Message ?? "Refresh token invalid." });
            }

            Response.Cookies.Append("access_token", flow.AccessToken, BuildCookieOptions(flow.AccessExpiresAt.Value));
            Response.Cookies.Append("refresh_token", flow.RefreshToken, BuildCookieOptions(flow.RefreshExpiresAt.Value));

            return Ok(new
            {
                message = flow.Message,
                accessTokenExpiresAt = flow.AccessExpiresAt,
                refreshTokenExpiresAt = flow.RefreshExpiresAt
            });
        }

        [Authorize]
        [EnableRateLimiting("auth-sensitive")]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
        {
            var adminOnly = EnsureAdminOnly();
            if (adminOnly != null)
                return adminOnly;

            if (request == null)
                return BadRequest(new { message = "Payload register tidak valid." });

            var email = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
            var password = request.Password ?? string.Empty;
            var name = (request.Name ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                return BadRequest(new { message = "Email dan password wajib diisi." });

            var emailValidator = new EmailAddressAttribute();
            if (!emailValidator.IsValid(email))
                return BadRequest(new { message = "Format email tidak valid." });

            if (password.Length < 8)
                return BadRequest(new { message = "Password minimal 8 karakter." });

            if (password.Length > 128)
                return BadRequest(new { message = "Password maksimal 128 karakter." });

            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Nama wajib diisi." });

            if (name.Length > 120)
                return BadRequest(new { message = "Nama maksimal 120 karakter." });

            if (!TryResolveAccessAssignment(
                    string.IsNullOrWhiteSpace(request.Level) ? "Executive" : request.Level,
                    request.Stream,
                    out var normalizedLevel,
                    out var normalizedStream,
                    out var accessError))
            {
                return BadRequest(new { message = accessError });
            }

            // ✅ Check if already exists
            var exists = await _context.Users.AnyAsync(u => u.Email == email, ct);
            if (exists) return Conflict(new { message = "Email sudah terdaftar." });

            // ✅ Hash password
            var hashed = BCrypt.Net.BCrypt.HashPassword(password);

            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                Name = name,
              
                PasswordHash = hashed,
                CreatedAt = DateTime.UtcNow,

                Stream = FeatureAccessResolver.ToDisplayStream(
                    normalizedStream ?? FeatureAccessResolver.EnterpriseStream),
                Level = FeatureAccessResolver.ToDisplayLevel(normalizedLevel)
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync(ct);

            return Ok(new { message = "Akun berhasil dibuat.", user.Id, user.Email, user.Stream, user.Level, });
        }

        [Authorize]
        [HttpPatch("users/{userId:guid}/access")]
        public async Task<IActionResult> UpdateUserAccess(Guid userId, [FromBody] UpdateUserAccessRequest request, CancellationToken ct)
        {
            var adminOnly = EnsureAdminOnly();
            if (adminOnly != null)
                return adminOnly;

            if (request == null)
            {
                return BadRequest(new { message = "Payload akses user tidak valid." });
            }

            var actorUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.Equals(actorUserId, userId.ToString(), StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Admin tidak bisa mengubah akses akun sendiri melalui endpoint ini." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);
            if (user == null)
                return NotFound(new { message = "User tidak ditemukan." });

            if (string.IsNullOrWhiteSpace(request.Level) && string.IsNullOrWhiteSpace(request.Stream))
            {
                return BadRequest(new { message = "Minimal kirim Level atau Stream untuk diperbarui." });
            }

            var currentLevel = FeatureAccessResolver.ToDisplayLevel(
                FeatureAccessResolver.NormalizeLevel(user.Level) ?? "executive");
            var currentStream = FeatureAccessResolver.ToDisplayStream(
                FeatureAccessResolver.GetEffectiveStream(
                    FeatureAccessResolver.NormalizeLevel(user.Level) ?? "executive",
                    user.Stream) ?? FeatureAccessResolver.EnterpriseStream);

            var requestedLevelInput = request.Level ?? user.Level;
            var requestedStreamInput = request.Stream;
            if (string.IsNullOrWhiteSpace(request.Level))
            {
                requestedStreamInput ??= user.Stream;
            }

            if (!TryResolveAccessAssignment(
                    requestedLevelInput,
                    requestedStreamInput,
                    out var normalizedLevel,
                    out var normalizedStream,
                    out var accessError))
            {
                return BadRequest(new { message = accessError });
            }

            var nextLevel = FeatureAccessResolver.ToDisplayLevel(normalizedLevel);
            var nextStream = FeatureAccessResolver.ToDisplayStream(
                normalizedStream ?? FeatureAccessResolver.EnterpriseStream);

            if (string.Equals(user.Level, nextLevel, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(user.Stream, nextStream, StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new
                {
                    message = "Tidak ada perubahan akses.",
                    user = MapAdminUserAccessUser(user),
                    revokedRefreshTokens = 0,
                    reloginRequired = false
                });
            }

            user.Level = nextLevel;
            user.Stream = nextStream;
            user.UpdatedAt = DateTime.UtcNow;

            var activeRefreshTokens = await _context.RefreshTokens
                .Where(r => r.UserId == user.Id && !r.IsRevoked)
                .ToListAsync(ct);

            foreach (var token in activeRefreshTokens)
            {
                token.IsRevoked = true;
                token.RevokedAt = DateTime.UtcNow;
            }

            _context.ChangeLog.Add(new ChangeLog
            {
                TableName = UserAccessAuditTableName,
                ChangeType = "ACCESS_UPDATE",
                ChangedBy = actorUserId,
                Timestamp = DateTime.UtcNow,
                IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                ChangeSummary = JsonSerializer.Serialize(new
                {
                    targetUserId = user.Id,
                    targetEmail = user.Email,
                    targetName = user.Name,
                    previousLevel = currentLevel,
                    previousStream = currentStream,
                    newLevel = user.Level,
                    newStream = user.Stream,
                    changedByUserId = actorUserId,
                    changedByEmail = User.FindFirst(ClaimTypes.Email)?.Value,
                    changedByName = User.FindFirst(ClaimTypes.Name)?.Value
                })
            });

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Akses user berhasil diperbarui.",
                user = MapAdminUserAccessUser(user),
                revokedRefreshTokens = activeRefreshTokens.Count,
                reloginRequired = true
            });
        }

        public class RegisterRequest
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string? Name { get; set; }
            public string? Stream { get; set; } // optional
            public string? Level { get; set; } // optional
        }

        public class UpdateUserAccessRequest
        {
            public string? Stream { get; set; }
            public string? Level { get; set; }
        }

        public class UpdateProfileRequest
        {
            public string? Name { get; set; }
        }

        public class ChangePasswordRequest
        {
            public string? CurrentPassword { get; set; }
            public string? NewPassword { get; set; }
            public string? ConfirmPassword { get; set; }
        }

        // ===== Logout =====
        [AllowAnonymous]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout(CancellationToken ct)
        {
            var refreshToken = Request.Cookies["refresh_token"];
            if (!string.IsNullOrEmpty(refreshToken))
            {
                var refreshHash = Sha256Base64(refreshToken);
                var stored = await _context.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == refreshHash, ct);
                if (stored != null)
                {
                    stored.IsRevoked = true;
                    stored.RevokedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(ct);
                }
            }

            ClearAuthCookies();

            return Ok(new { message = "Logout successful" });
        }

        private async Task<int> RevokeRefreshTokenReplacementChainAsync(
            string? startingHash,
            DateTime revokedAt,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(startingHash))
            {
                return 0;
            }

            var revokedCount = 0;
            var nextHash = startingHash;
            var visited = new HashSet<string>(StringComparer.Ordinal);

            while (!string.IsNullOrWhiteSpace(nextHash) && visited.Add(nextHash))
            {
                var token = await _context.RefreshTokens
                    .FirstOrDefaultAsync(r => r.TokenHash == nextHash, ct);

                if (token == null)
                {
                    break;
                }

                if (!token.IsRevoked)
                {
                    token.IsRevoked = true;
                    token.RevokedAt = revokedAt;
                    revokedCount += 1;
                }

                nextHash = token.ReplacedByTokenHash;
            }

            return revokedCount;
        }

        // ===== Helpers =====
        private CookieOptions BuildCookieOptions(DateTime expiresUtc)
        {
            var isHttps = Request.IsHttps;

            return new CookieOptions
            {
                HttpOnly = true,
                Secure = isHttps,
                SameSite = SameSiteMode.Lax,
                Expires = expiresUtc,
                MaxAge = expiresUtc - DateTime.UtcNow,
                Path = "/",
                IsEssential = true
            };
        }

        private CookieOptions BuildDeleteCookieOptions()
        {
            return new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UnixEpoch,
                MaxAge = TimeSpan.Zero,
                IsEssential = true
            };
        }

        private void ClearAuthCookies()
        {
            var options = BuildDeleteCookieOptions();
            Response.Cookies.Delete("access_token", options);
            Response.Cookies.Delete("refresh_token", options);
        }

        private IActionResult? EnsureAdminOnly()
        {
            if (FeatureAccessResolver.IsAdmin(User))
            {
                return null;
            }

            return StatusCode(403, new { message = "Hanya Admin yang boleh mengelola user." });
        }

        private static bool TryResolveAccessAssignment(
            string? levelInput,
            string? streamInput,
            out string normalizedLevel,
            out string? normalizedStream,
            out string errorMessage)
        {
            normalizedLevel = FeatureAccessResolver.NormalizeLevel(levelInput) ?? string.Empty;
            normalizedStream = null;
            errorMessage = string.Empty;

            if (string.IsNullOrWhiteSpace(normalizedLevel))
            {
                errorMessage = "Level tidak valid. Gunakan Executive, Manager, atau Admin.";
                return false;
            }

            var requestedStream = FeatureAccessResolver.NormalizeStream(streamInput);
            normalizedStream = FeatureAccessResolver.GetEffectiveStream(normalizedLevel, streamInput);

            if (normalizedLevel == "executive")
            {
                if (!string.IsNullOrWhiteSpace(streamInput) &&
                    !string.Equals(
                        requestedStream,
                        FeatureAccessResolver.EnterpriseStream,
                        StringComparison.OrdinalIgnoreCase))
                {
                    errorMessage = "Executive harus menggunakan stream Enterprise.";
                    return false;
                }

                return true;
            }

            if (normalizedLevel == "admin")
            {
                if (!string.IsNullOrWhiteSpace(streamInput) &&
                    !string.Equals(
                        requestedStream,
                        FeatureAccessResolver.AdminStream,
                        StringComparison.OrdinalIgnoreCase))
                {
                    errorMessage = "Admin harus menggunakan stream Admin.";
                    return false;
                }

                return true;
            }

            if (normalizedStream == null)
            {
                errorMessage = "Stream tidak valid. Gunakan Audit, Compliance, Planning, Procurement, atau Human Resource.";
                return false;
            }

            return true;
        }

        private static AdminUserAccessUserResponse MapAdminUserAccessUser(User user)
        {
            var normalizedLevel = FeatureAccessResolver.NormalizeLevel(user.Level) ?? "executive";
            var normalizedStream = FeatureAccessResolver.GetEffectiveStream(normalizedLevel, user.Stream);

            return new AdminUserAccessUserResponse
            {
                Id = user.Id,
                Email = user.Email,
                Name = user.Name,
                Level = FeatureAccessResolver.ToDisplayLevel(normalizedLevel),
                Stream = FeatureAccessResolver.ToDisplayStream(
                    normalizedStream ?? FeatureAccessResolver.EnterpriseStream),
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt
            };
        }

        private static List<UserAccessAuditResponse> MapUserAccessAuditLogs(IEnumerable<ChangeLog> logs)
        {
            var results = new List<UserAccessAuditResponse>();

            foreach (var log in logs)
            {
                if (string.IsNullOrWhiteSpace(log.ChangeSummary))
                {
                    continue;
                }

                try
                {
                    var payload = JsonSerializer.Deserialize<UserAccessAuditPayload>(log.ChangeSummary, AuditJsonOptions);
                    if (payload == null || string.IsNullOrWhiteSpace(payload.TargetUserId))
                    {
                        continue;
                    }

                    results.Add(new UserAccessAuditResponse
                    {
                        Id = log.Id,
                        TargetUserId = payload.TargetUserId,
                        TargetEmail = payload.TargetEmail,
                        TargetName = payload.TargetName,
                        PreviousLevel = payload.PreviousLevel,
                        PreviousStream = payload.PreviousStream,
                        NewLevel = payload.NewLevel,
                        NewStream = payload.NewStream,
                        ChangedByUserId = payload.ChangedByUserId,
                        ChangedByEmail = payload.ChangedByEmail,
                        ChangedByName = payload.ChangedByName,
                        ChangedAt = log.Timestamp,
                        IpAddress = log.IPAddress
                    });
                }
                catch
                {
                    // Ignore malformed audit rows so one bad entry does not break the list endpoint.
                }
            }

            return results;
        }

        public class UserAccessAuditResponse
        {
            public long Id { get; set; }
            public string TargetUserId { get; set; } = string.Empty;
            public string? TargetEmail { get; set; }
            public string? TargetName { get; set; }
            public string? PreviousLevel { get; set; }
            public string? PreviousStream { get; set; }
            public string? NewLevel { get; set; }
            public string? NewStream { get; set; }
            public string? ChangedByUserId { get; set; }
            public string? ChangedByEmail { get; set; }
            public string? ChangedByName { get; set; }
            public DateTime ChangedAt { get; set; }
            public string? IpAddress { get; set; }
        }

        public sealed class AdminUserAccessUserResponse
        {
            public Guid Id { get; set; }
            public string Email { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string Level { get; set; } = string.Empty;
            public string Stream { get; set; } = string.Empty;
            public DateTime CreatedAt { get; set; }
            public DateTime UpdatedAt { get; set; }
        }

        private sealed class UserAccessAuditPayload
        {
            public string TargetUserId { get; set; } = string.Empty;
            public string? TargetEmail { get; set; }
            public string? TargetName { get; set; }
            public string? PreviousLevel { get; set; }
            public string? PreviousStream { get; set; }
            public string? NewLevel { get; set; }
            public string? NewStream { get; set; }
            public string? ChangedByUserId { get; set; }
            public string? ChangedByEmail { get; set; }
            public string? ChangedByName { get; set; }
        }


        private (string token, DateTime expiresAt) GenerateJwtToken(User user, int expiryMinutes)
        {
            var secret = _configuration["Jwt:SecretKey"]
                ?? throw new InvalidOperationException("Jwt:SecretKey missing in configuration.");
            var issuer = _configuration["Jwt:Issuer"] ?? "pgh";
            var audience = _configuration["Jwt:Audience"] ?? "pgh-client";

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);
            var normalizedLevel = FeatureAccessResolver.NormalizeLevel(user.Level) ?? "executive";
            var normalizedStream = FeatureAccessResolver.GetEffectiveStream(normalizedLevel, user.Stream);
            var displayLevel = FeatureAccessResolver.ToDisplayLevel(normalizedLevel);
            var displayStream = FeatureAccessResolver.ToDisplayStream(
                normalizedStream ?? FeatureAccessResolver.EnterpriseStream);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.Name ?? string.Empty),
                new Claim("level", displayLevel),
                new Claim("stream", displayStream),
                new Claim(ClaimTypes.Role, displayLevel)

            };

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: expiresAt,
                signingCredentials: creds
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
            return (tokenString, expiresAt);
        }

        private static string GenerateRefreshToken()
        {
            var randomBytes = new byte[64];
            RandomNumberGenerator.Fill(randomBytes);
            return Convert.ToBase64String(randomBytes);
        }

        private static string Sha256Base64(string value)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(value));
            return Convert.ToBase64String(bytes);
        }

        private string BuildLoginAttemptKey(string email)
        {
            var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            return $"auth:login:{remoteIp}:{email}";
        }

        private bool TryGetActiveLoginLockout(string key, out TimeSpan retryAfter)
        {
            if (_memoryCache.TryGetValue<LoginAttemptState>(key, out var state) &&
                state?.LockedUntilUtc is DateTimeOffset lockedUntilUtc &&
                lockedUntilUtc > DateTimeOffset.UtcNow)
            {
                retryAfter = lockedUntilUtc - DateTimeOffset.UtcNow;
                return true;
            }

            retryAfter = TimeSpan.Zero;
            return false;
        }

        private void RegisterLoginFailure(string key)
        {
            var now = DateTimeOffset.UtcNow;
            var state = _memoryCache.TryGetValue<LoginAttemptState>(key, out var cached)
                ? cached ?? new LoginAttemptState(0, null)
                : new LoginAttemptState(0, null);

            var nextFailedCount = state.FailedCount + 1;
            var lockedUntilUtc = nextFailedCount >= LoginFailureLimit
                ? now.Add(LoginLockoutDuration)
                : (DateTimeOffset?)null;

            _memoryCache.Set(
                key,
                new LoginAttemptState(nextFailedCount, lockedUntilUtc),
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = LoginFailureWindow + LoginLockoutDuration
                });
        }

        private void ClearLoginFailures(string key) => _memoryCache.Remove(key);

        private sealed record LoginAttemptState(int FailedCount, DateTimeOffset? LockedUntilUtc);

        // Inline request model
        public class LoginRequest
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        private static object BuildAuthUserResponse(User user)
        {
            return new
            {
                id = user.Id,
                email = user.Email,
                name = user.Name,
                stream = FeatureAccessResolver.ToDisplayStream(
                    FeatureAccessResolver.GetEffectiveStream(
                        FeatureAccessResolver.NormalizeLevel(user.Level) ?? "executive",
                        user.Stream) ?? FeatureAccessResolver.EnterpriseStream),
                level = FeatureAccessResolver.ToDisplayLevel(
                    FeatureAccessResolver.NormalizeLevel(user.Level) ?? "executive")
            };
        }
    }
}
