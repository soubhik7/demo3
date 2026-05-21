# Skill 07 — Security: Path Traversal, UUID Validation, Input Sanitisation

## What this skill covers
- Path traversal prevention (the #1 risk when serving user-named files)
- UUID validation on run IDs used in file paths
- Whitelisting allowed file types in download endpoints
- Sanitising error messages (no stack traces or paths in responses)
- No telemetry, no outbound calls on startup
- Rate limiting considerations
- Corporate laptop safety (no admin rights needed, localhost only)

---

## Threat 1 — Path traversal via runId

If a user passes `../../../etc/passwd` as a `runId`, a naive `Path.Combine` will
escape the `outputs/` directory.

### ❌ Vulnerable
```csharp
// runId = "../../appsettings.json"
var path = Path.Combine(_env.ContentRootPath, "outputs", runId, "file.yaml");
// → resolves to: ...csharp-webapp/appsettings.json
return PhysicalFile(path, "text/plain", "file.yaml");   // leaks config!
```

### ✅ Fix — UUID validation before any path use
```csharp
[HttpGet("download/{runId}/{type}")]
public IActionResult Download(string runId, string type)
{
    // UUID v4 format check — rejects "../../../" entirely
    if (!Guid.TryParse(runId, out _))
        return BadRequest(new { error = "Invalid run ID format." });

    // ... rest of method is safe
}

// Helper — call this at the top of EVERY endpoint that uses runId in a path
private static bool IsValidRunId(string id) => Guid.TryParse(id, out _);
```

A UUID like `3f8a2c1d-4b5e-6789-abcd-ef0123456789` can never be a traversal path.

---

## Threat 2 — Arbitrary file type download

Never let the user choose which filename to serve directly:

### ❌ Vulnerable
```csharp
// type = "../../../../appsettings.json"
var path = Path.Combine(outputDir, type);
return PhysicalFile(path, "text/plain", type);
```

### ✅ Fix — whitelist allowed types
```csharp
var allowed = new Dictionary<string, (string file, string mime)>(StringComparer.OrdinalIgnoreCase)
{
    ["yaml"] = ("patched.yaml",      "application/x-yaml"),
    ["xlsx"] = ("translations.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ["csv"]  = ("translations.csv",  "text/csv"),
    ["log"]  = ("output.txt",        "text/plain"),
};

if (!allowed.TryGetValue(type, out var info))
    return BadRequest(new { error = $"Unknown type '{type}'." });

// Now info.file is a known safe filename — never user-controlled
var path = Path.Combine(outputDir, info.file);
```

---

## Threat 3 — Stack traces / paths in error responses

Never return raw exception messages in production — they reveal directory structure,
file names, and implementation details.

### ❌ Vulnerable
```csharp
catch (Exception ex) {
    return StatusCode(500, ex.ToString());
    // reveals: "at OnboardingController.Run() in /Users/soubhik/..."
}
```

### ✅ Fix — sanitised error
```csharp
catch (Exception ex) {
    // Log internally (ILogger)
    _logger.LogError(ex, "Run failed for runId {RunId}", runId);

    // Return generic message to client
    return StatusCode(500, new { error = "An internal error occurred. Check the server log." });
}
```

For the Python console output (which is user-visible), it's fine to return it as-is
since it's the script's own output, not a C# stack trace.

---

## Threat 4 — Oversized request bodies

ASP.NET Core defaults to 30 MB. For a JSON config form, 1 MB is plenty:

```csharp
// In Program.cs, before builder.Build():
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 1_048_576;  // 1 MB
});

// Or via attribute on the controller method:
[RequestSizeLimit(1_048_576)]
[HttpPost("run")]
public async Task<IActionResult> Run([FromBody] JsonElement body) { ... }
```

---

## Threat 5 — SSRF via configurable URLs

If your app lets users specify a URL or host to call (e.g. a NAV SOAP endpoint):

```csharp
// Block private IP ranges and loopback
private static readonly string[] BlockedPrefixes = {
    "localhost", "127.", "10.", "172.16.", "172.17.", "172.31.",
    "192.168.", "0.0.0.0", "::1", "fe80:"
};

private static bool IsSsrfSafe(string host) =>
    !BlockedPrefixes.Any(p => host.StartsWith(p, StringComparison.OrdinalIgnoreCase));
```

This prevents the app from being used to probe internal network services.

---

## No telemetry — by design

This stack has zero outbound calls on startup:
- **ASP.NET Core / Kestrel** — no telemetry by default
- **`System.Text.Json`** — no network calls
- **PythonRunner** — only calls local `python3` subprocess
- **No Streamlit** — Streamlit phones home to `api.segment.io` on every start

To verify, monitor outbound connections:
```bash
# macOS/Linux
lsof -i -n -P | grep dotnet

# Should show only: localhost:5050 (LISTEN)
# No external IPs
```

---

## Corporate laptop safety checklist

| Check | Status | Notes |
|---|---|---|
| No npm/Node required | ✅ | dotnet + python3 only |
| No admin rights to run | ✅ | `dotnet run` works as standard user |
| Binds to localhost only | ✅ | `"Urls": "http://localhost:5050"` |
| No outbound calls on startup | ✅ | No telemetry from ASP.NET Core |
| No Google Fonts / CDN calls | ✅ | System fonts, all CSS local |
| No NuGet download at runtime | ✅ | Packages restored at build time |
| Python packages offline-installable | ✅ | `pip install --no-index --find-links .` from wheel files |

---

## Security headers (optional, for production)

Add to `Program.cs` after `app.Build()`:

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Frame-Options"]        = "DENY";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"]        = "strict-origin-when-cross-origin";
    // Only add HSTS in production with HTTPS:
    // context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000";
    await next();
});
```

---

## Security checklist for every new endpoint
- [ ] UUID validation on every `runId` path parameter
- [ ] Whitelist on every `type` / `format` / `filename` parameter
- [ ] Never concatenate user input directly into file paths
- [ ] Request size limit on POST endpoints
- [ ] Sanitised error messages (no stack traces, no file paths)
- [ ] Only serve files from inside `outputs/{runId}/` — never from project root
- [ ] No outbound HTTP calls in startup code
