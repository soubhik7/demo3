# Skill 03 — C# ASP.NET Core API: Minimal Setup, Controllers, File Serving

## What this skill covers
- Zero-boilerplate ASP.NET Core setup (no Startup.cs)
- Controller pattern for JSON APIs
- Accepting JSON body, file uploads, route params
- Streaming file downloads (`PhysicalFile`)
- Health check endpoint
- Static file serving from `wwwroot/`
- Per-request run directory creation (UUID isolation)
- Saving metadata alongside outputs

## Files
- `Program.cs`
- `Controllers/OnboardingController.cs`
- `csharp-webapp.csproj`

---

## Minimal project file

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <AssemblyName>MyApp</AssemblyName>
    <RootNamespace>MyApp</RootNamespace>
  </PropertyGroup>
</Project>
```

**No extra NuGet packages needed.** `System.Text.Json`, `Microsoft.AspNetCore`, and all required types come with the SDK.

---

## Program.cs — always 8 lines

```csharp
using MyApp.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddSingleton<PythonRunner>();   // omit if no Python calls

var app = builder.Build();
app.UseDefaultFiles();   // serves wwwroot/index.html for GET /
app.UseStaticFiles();    // serves wwwroot/*.css, *.js, etc.
app.MapControllers();
app.Run();
```

`UseDefaultFiles()` must come before `UseStaticFiles()`.

---

## Controller skeleton

```csharp
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using MyApp.Services;

namespace MyApp.Controllers;

[ApiController]
[Route("api")]
public class MainController : ControllerBase
{
    private readonly PythonRunner     _py;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration   _cfg;

    public MainController(PythonRunner py, IWebHostEnvironment env, IConfiguration cfg)
    { _py = py; _env = env; _cfg = cfg; }

    // Endpoints go here...
}
```

---

## Endpoint patterns

### GET — health check
```csharp
[HttpGet("health")]
public async Task<IActionResult> Health()
{
    var version = await _py.GetPythonVersion();
    return Ok(new { status = "ok", python = version });
}
```

### POST — accept JSON body, run Python, return run ID
```csharp
[HttpPost("run")]
public async Task<IActionResult> Run([FromBody] JsonElement body)
{
    var (runId, outputDir) = CreateRunDir();
    var inputPath = await SaveInput(outputDir, body);

    var result = await _py.RunScript(inputPath);

    var log = result.StandardOutput
            + (result.ErrorOutput.Length > 0 ? "\n" + result.ErrorOutput : "");
    await File.WriteAllTextAsync(Path.Combine(outputDir, "output.txt"), log);
    await SaveMetadata(outputDir, runId, body, result.Success);

    if (!result.Success)
        return BadRequest(new { error = "Script failed.", console_output = log, run_id = runId });

    return Ok(new { run_id = runId, success = true, console_output = log });
}
```

### GET — stream file download
```csharp
[HttpGet("download/{runId}/{type}")]
public IActionResult Download(string runId, string type)
{
    // 1. Validate runId — NEVER skip this
    if (!Guid.TryParse(runId, out _))
        return BadRequest(new { error = "Invalid run ID." });

    // 2. Whitelist allowed types — NEVER pass user input to file path directly
    var allowed = new Dictionary<string, (string file, string mime)>(StringComparer.OrdinalIgnoreCase)
    {
        ["yaml"] = ("output.yaml",        "application/x-yaml"),
        ["xlsx"] = ("output.xlsx",        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        ["csv"]  = ("output.csv",         "text/csv"),
        ["log"]  = ("output.txt",         "text/plain"),
    };

    if (!allowed.TryGetValue(type, out var info))
        return BadRequest(new { error = $"Unknown type '{type}'." });

    // 3. Resolve and serve
    var path = Path.Combine(_env.ContentRootPath, "outputs", runId, info.file);
    if (!File.Exists(path))
        return NotFound(new { error = "File not found." });

    return PhysicalFile(path, info.mime, info.file);  // 3rd arg = download filename
}
```

### GET — load run result metadata
```csharp
[HttpGet("result/{runId}")]
public IActionResult GetResult(string runId)
{
    if (!Guid.TryParse(runId, out _))
        return BadRequest(new { error = "Invalid run ID." });

    var outputDir = Path.Combine(_env.ContentRootPath, "outputs", runId);
    if (!Directory.Exists(outputDir))
        return NotFound(new { error = "Run not found." });

    var files = Directory.GetFiles(outputDir)
        .Select(Path.GetFileName)
        .Where(f => f != "input.json" && f != "output.txt" && f != "metadata.json")
        .ToList();

    var log  = File.Exists(Path.Combine(outputDir, "output.txt"))
             ? File.ReadAllText(Path.Combine(outputDir, "output.txt")) : "";

    object? meta = null;
    var metaPath = Path.Combine(outputDir, "metadata.json");
    if (File.Exists(metaPath))
        meta = JsonSerializer.Deserialize<object>(File.ReadAllText(metaPath));

    return Ok(new { run_id = runId, files, console_output = log, metadata = meta });
}
```

---

## Helper methods (copy into every controller)

```csharp
// Create a UUID-named output directory for this run
private (string runId, string outputDir) CreateRunDir()
{
    var runId     = Guid.NewGuid().ToString();
    var outputDir = Path.Combine(_env.ContentRootPath, "outputs", runId);
    Directory.CreateDirectory(outputDir);
    return (runId, outputDir);
}

// Persist the request JSON so it can be replayed or audited
private static async Task<string> SaveInput(string outputDir, JsonElement body)
{
    var path = Path.Combine(outputDir, "input.json");
    await File.WriteAllTextAsync(path,
        JsonSerializer.Serialize(body, new JsonSerializerOptions { WriteIndented = true }));
    return path;
}

// Write a metadata.json alongside outputs
private async Task SaveMetadata(string outputDir, string runId, JsonElement body, bool success)
{
    var meta = new {
        run_id     = runId,
        created_at = DateTime.UtcNow.ToString("o"),
        key_field  = GetString(body, "key_field"),
        success,
    };
    await File.WriteAllTextAsync(
        Path.Combine(outputDir, "metadata.json"),
        JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
}

// Safe string extraction from JsonElement
private static string GetString(JsonElement body, string key) =>
    body.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
        ? v.GetString() ?? "" : "";

// UUID validation — always use before using runId in a path
private static bool IsValidRunId(string id) => Guid.TryParse(id, out _);
```

---

## Dependency injection

Services registered in `Program.cs` with `.AddSingleton<T>()` are auto-injected
via constructor parameters — no manual resolution needed:

```csharp
// Register
builder.Services.AddSingleton<PythonRunner>();
builder.Services.AddSingleton<MyCustomService>();

// Injected automatically into any controller constructor
public MyController(PythonRunner py, MyCustomService svc) { ... }
```

Use `AddSingleton` for stateless services (PythonRunner, config wrappers).
Use `AddScoped` for per-request services.

---

## appsettings.json access in controllers

```csharp
// In constructor
private readonly string _scriptDir;
public MyController(IConfiguration cfg) {
    _scriptDir = cfg["Python:ScriptsDir"] ?? "";
}

// Or inject directly into service constructors
```

---

## Running and hot-reload

```bash
dotnet run          # start once
dotnet watch run    # hot-reload on .cs file save (dev only)
```

Default URL is set in `appsettings.json`:
```json
"Urls": "http://localhost:5050"
```

---

## Reuse checklist for a new app
- [ ] Copy `.csproj`, change `AssemblyName` + `RootNamespace`
- [ ] Copy `Program.cs` verbatim (change `using` namespace)
- [ ] Copy helper methods (`CreateRunDir`, `SaveInput`, `SaveMetadata`, `GetString`, `IsValidRunId`) into the new controller
- [ ] Add new endpoints following the POST/GET patterns above
- [ ] Register any new services in `Program.cs`
- [ ] Keep `Download()` whitelist updated whenever new file types are added
