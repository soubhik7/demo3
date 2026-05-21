using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using OnboardingApp.Services;

namespace OnboardingApp.Controllers;

[ApiController]
[Route("api")]
public class OnboardingController : ControllerBase
{
    private readonly PythonRunner     _py;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration  _config;

    public OnboardingController(PythonRunner py, IWebHostEnvironment env, IConfiguration config)
    {
        _py     = py;
        _env    = env;
        _config = config;
    }

    // ── GET /api/health ───────────────────────────────────────────────────────
    [HttpGet("health")]
    public async Task<IActionResult> Health()
    {
        var version = await _py.GetPythonVersion();
        return Ok(new { status = "ok", python = version });
    }

    // ── POST /api/run ─────────────────────────────────────────────────────────
    /// <summary>
    /// Steps 7+8: patch YAML + generate translation rows.
    /// Accepts the onboarding JSON as the request body.
    /// </summary>
    [HttpPost("run")]
    public async Task<IActionResult> Run([FromBody] JsonElement body)
    {
        var (runId, outputDir) = CreateRunDir();
        var inputPath = await SaveInput(outputDir, body);

        var yamlPath  = ResolveDevYaml();
        var outYaml   = Path.Combine(outputDir, "patched.yaml");
        var outXlsx   = Path.Combine(outputDir, "translations.xlsx");

        var result = await _py.RunPatchConfig(inputPath, yamlPath, outYaml, outXlsx);

        var consoleLog = result.StandardOutput
                       + (string.IsNullOrWhiteSpace(result.ErrorOutput) ? "" : "\n" + result.ErrorOutput);

        await System.IO.File.WriteAllTextAsync(Path.Combine(outputDir, "output.txt"), consoleLog);
        await SaveMetadata(outputDir, runId, body, result.Success);

        if (!result.Success)
        {
            return BadRequest(new
            {
                error      = "Python script exited with an error. See console_output for details.",
                console_output = consoleLog,
                run_id     = runId,
            });
        }

        return Ok(new
        {
            run_id         = runId,
            success        = true,
            country_key    = GetString(body, "country_key"),
            console_output = consoleLog,
            files          = new[] { "patched.yaml", "translations.xlsx", "translations.csv" },
        });
    }

    // ── POST /api/orchestrate ─────────────────────────────────────────────────
    /// <summary>
    /// Full 10-step orchestration. Steps 1–6 and 9 are stubs and skip gracefully.
    /// Steps 7+8 run; Step 10 is manual.
    /// </summary>
    [HttpPost("orchestrate")]
    public async Task<IActionResult> Orchestrate([FromBody] JsonElement body)
    {
        var (runId, outputDir) = CreateRunDir();
        var inputPath = await SaveInput(outputDir, body);

        // Give orchestrator a per-run copy of dev.yaml so it does not modify the original
        var devYaml   = ResolveDevYaml();
        var workYaml  = Path.Combine(outputDir, "dev_working.yaml");
        System.IO.File.Copy(devYaml, workYaml, overwrite: true);

        var result = await _py.RunOrchestrator(inputPath, workYaml);

        var consoleLog = result.StandardOutput
                       + (string.IsNullOrWhiteSpace(result.ErrorOutput) ? "" : "\n" + result.ErrorOutput);

        await System.IO.File.WriteAllTextAsync(Path.Combine(outputDir, "output.txt"), consoleLog);
        await SaveMetadata(outputDir, runId, body, result.Success);

        // Move generated files from project-root outputs/ to our run dir
        var rootOutputs = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "outputs"));
        var countryKey  = GetString(body, "country_key");
        if (!string.IsNullOrWhiteSpace(countryKey) && Directory.Exists(rootOutputs))
        {
            foreach (var src in Directory.GetFiles(rootOutputs, $"{countryKey}_*"))
            {
                var dest = Path.Combine(outputDir, Path.GetFileName(src));
                if (!System.IO.File.Exists(dest))
                    System.IO.File.Move(src, dest);
            }
        }

        return Ok(new
        {
            run_id         = runId,
            success        = result.Success,
            country_key    = countryKey,
            console_output = consoleLog,
        });
    }

    // ── GET /api/result/{runId} ───────────────────────────────────────────────
    [HttpGet("result/{runId}")]
    public IActionResult GetResult(string runId)
    {
        if (!IsValidRunId(runId))
            return BadRequest(new { error = "Invalid run ID format." });

        var outputDir = Path.Combine(_env.ContentRootPath, "outputs", runId);
        if (!Directory.Exists(outputDir))
            return NotFound(new { error = "Run not found." });

        var files = Directory.GetFiles(outputDir)
            .Select(Path.GetFileName)
            .Where(f => f != "input.json" && f != "output.txt" && f != "metadata.json")
            .ToList();

        var consolePath = Path.Combine(outputDir, "output.txt");
        var console     = System.IO.File.Exists(consolePath)
            ? System.IO.File.ReadAllText(consolePath)
            : "";

        var metaPath = Path.Combine(outputDir, "metadata.json");
        object? meta = null;
        if (System.IO.File.Exists(metaPath))
        {
            try { meta = JsonSerializer.Deserialize<object>(System.IO.File.ReadAllText(metaPath)); }
            catch { /* ignore */ }
        }

        return Ok(new { run_id = runId, files, console_output = console, metadata = meta });
    }

    // ── GET /api/download/{runId}/{type} ──────────────────────────────────────
    [HttpGet("download/{runId}/{type}")]
    public IActionResult Download(string runId, string type)
    {
        if (!IsValidRunId(runId))
            return BadRequest(new { error = "Invalid run ID." });

        var allowed = new Dictionary<string, (string file, string mime)>(StringComparer.OrdinalIgnoreCase)
        {
            ["yaml"] = ("patched.yaml",       "application/x-yaml"),
            ["xlsx"] = ("translations.xlsx",   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            ["csv"]  = ("translations.csv",    "text/csv"),
            ["log"]  = ("output.txt",          "text/plain"),
        };

        if (!allowed.TryGetValue(type, out var info))
            return BadRequest(new { error = $"Unknown type '{type}'. Use yaml, xlsx, csv, or log." });

        var path = Path.Combine(_env.ContentRootPath, "outputs", runId, info.file);
        if (!System.IO.File.Exists(path))
            return NotFound(new { error = $"File '{info.file}' not found for this run." });

        return PhysicalFile(path, info.mime, info.file);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private (string runId, string outputDir) CreateRunDir()
    {
        var runId     = Guid.NewGuid().ToString();
        var outputDir = Path.Combine(_env.ContentRootPath, "outputs", runId);
        Directory.CreateDirectory(outputDir);
        return (runId, outputDir);
    }

    private static async Task<string> SaveInput(string outputDir, JsonElement body)
    {
        var path = Path.Combine(outputDir, "input.json");
        var opts = new JsonSerializerOptions { WriteIndented = true };
        await System.IO.File.WriteAllTextAsync(path, JsonSerializer.Serialize(body, opts));
        return path;
    }

    private async Task SaveMetadata(string outputDir, string runId, JsonElement body, bool success)
    {
        var meta = new
        {
            run_id      = runId,
            created_at  = DateTime.UtcNow.ToString("o"),
            country_key = GetString(body, "country_key"),
            success,
        };
        var path = Path.Combine(outputDir, "metadata.json");
        await System.IO.File.WriteAllTextAsync(path,
            JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
    }

    private string ResolveDevYaml()
    {
        var cfgDir = _config["Python:ConfigDir"] ?? "";
        var dir = string.IsNullOrWhiteSpace(cfgDir)
            ? Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "config"))
            : cfgDir;
        return Path.Combine(dir, "dev.yaml");
    }

    private static string GetString(JsonElement body, string key) =>
        body.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? ""
            : "";

    private static bool IsValidRunId(string runId) =>
        Guid.TryParse(runId, out _);
}
