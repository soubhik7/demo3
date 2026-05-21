# Skill 06 — Output Management: UUID Run Dirs, Metadata, File Isolation

## What this skill covers
- Per-run isolated output directories (`outputs/{uuid}/`)
- Why UUIDs prevent collisions and path traversal
- What files to save in each run directory
- `metadata.json` schema and usage
- Streaming files back to the browser
- Cleaning up old runs (optional)

## Files
- `Controllers/OnboardingController.cs` — `CreateRunDir()`, `SaveInput()`, `SaveMetadata()`
- `wwwroot/result.html` + `wwwroot/app.js` — result page, download buttons

---

## Per-run directory structure

Every API call that produces output gets its own directory named by a UUID v4:

```
csharp-webapp/outputs/
└── 3f8a2c1d-4b5e-6789-abcd-ef0123456789/
    ├── input.json          ← the exact JSON posted by the user
    ├── patched.yaml        ← primary output (YAML patch)
    ├── translations.xlsx   ← Excel output
    ├── translations.csv    ← CSV output
    ├── output.txt          ← combined Python stdout + stderr
    └── metadata.json       ← run metadata (see below)
```

**Benefits:**
- Concurrent users never overwrite each other's files
- Run ID in the URL → direct link to results
- Each run is self-contained and auditable
- UUID validation blocks path traversal (see [07-security.md](07-security.md))

---

## Creating the run directory (C#)

```csharp
private (string runId, string outputDir) CreateRunDir()
{
    var runId     = Guid.NewGuid().ToString();   // e.g. "3f8a2c1d-4b5e-6789-..."
    var outputDir = Path.Combine(_env.ContentRootPath, "outputs", runId);
    Directory.CreateDirectory(outputDir);
    return (runId, outputDir);
}
```

Call at the start of every endpoint that produces files:
```csharp
var (runId, outputDir) = CreateRunDir();
```

---

## Saving the input JSON

Always persist the raw request body alongside outputs — enables replay and audit:

```csharp
private static async Task<string> SaveInput(string outputDir, JsonElement body)
{
    var path = Path.Combine(outputDir, "input.json");
    await File.WriteAllTextAsync(path,
        JsonSerializer.Serialize(body, new JsonSerializerOptions { WriteIndented = true }));
    return path;
}
```

The saved `input.json` is also the file passed to Python:
```csharp
var inputPath = await SaveInput(outputDir, body);
var result    = await _py.RunScript(inputPath);   // Python reads from file, not pipe
```

---

## metadata.json schema

Save a small JSON alongside each run so the result page can show stats
without re-running the script:

```csharp
private async Task SaveMetadata(
    string outputDir, string runId, JsonElement body, bool success)
{
    var meta = new {
        run_id      = runId,
        created_at  = DateTime.UtcNow.ToString("o"),   // ISO 8601
        country_key = GetString(body, "country_key"),  // adapt to your key field
        success,
    };
    await File.WriteAllTextAsync(
        Path.Combine(outputDir, "metadata.json"),
        JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
}
```

Resulting file:
```json
{
  "run_id":      "3f8a2c1d-4b5e-6789-abcd-ef0123456789",
  "created_at":  "2026-05-21T13:42:00.000Z",
  "country_key": "france",
  "success":     true
}
```

---

## Saving the Python console log

```csharp
var log = result.StandardOutput
        + (string.IsNullOrWhiteSpace(result.ErrorOutput) ? "" : "\n" + result.ErrorOutput);

await File.WriteAllTextAsync(Path.Combine(outputDir, "output.txt"), log);
```

---

## Result endpoint — list files + return log

```csharp
[HttpGet("result/{runId}")]
public IActionResult GetResult(string runId)
{
    if (!Guid.TryParse(runId, out _)) return BadRequest(new { error = "Invalid run ID." });

    var outputDir = Path.Combine(_env.ContentRootPath, "outputs", runId);
    if (!Directory.Exists(outputDir)) return NotFound(new { error = "Run not found." });

    // List user-visible output files (exclude internal files)
    var files = Directory.GetFiles(outputDir)
        .Select(Path.GetFileName)
        .Where(f => f != "input.json" && f != "output.txt" && f != "metadata.json")
        .ToList();

    // Read metadata + log
    var log = File.Exists(Path.Combine(outputDir, "output.txt"))
        ? File.ReadAllText(Path.Combine(outputDir, "output.txt")) : "";

    object? meta = null;
    var metaPath = Path.Combine(outputDir, "metadata.json");
    if (File.Exists(metaPath))
        meta = JsonSerializer.Deserialize<object>(File.ReadAllText(metaPath));

    return Ok(new { run_id = runId, files, console_output = log, metadata = meta });
}
```

---

## Download endpoint — stream a file

```csharp
[HttpGet("download/{runId}/{type}")]
public IActionResult Download(string runId, string type)
{
    if (!Guid.TryParse(runId, out _)) return BadRequest(new { error = "Invalid run ID." });

    var allowed = new Dictionary<string, (string file, string mime)>(StringComparer.OrdinalIgnoreCase)
    {
        ["yaml"] = ("patched.yaml",      "application/x-yaml"),
        ["xlsx"] = ("translations.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        ["csv"]  = ("translations.csv",  "text/csv"),
        ["log"]  = ("output.txt",        "text/plain"),
    };

    if (!allowed.TryGetValue(type, out var info)) return BadRequest(new { error = $"Unknown type." });

    var path = Path.Combine(_env.ContentRootPath, "outputs", runId, info.file);
    if (!File.Exists(path)) return NotFound(new { error = "File not found." });

    // PhysicalFile streams efficiently — no memory copy of large files
    return PhysicalFile(path, info.mime, info.file);
}
```

---

## Result page — JS side (result.html)

Navigate to the result page after a successful run:
```js
window.location.href = `/result.html?run_id=${encodeURIComponent(data.run_id)}`;
```

On the result page, load the run data:
```js
async function loadResult() {
    const runId = new URLSearchParams(window.location.search).get('run_id');
    const res   = await fetch(`/api/result/${encodeURIComponent(runId)}`);
    const data  = await res.json();

    buildDownloadButtons(runId, data.files);
    document.getElementById('console-output').textContent = data.console_output;
    // populate stat cards from data.metadata
}
```

Build download buttons from the file list:
```js
function buildDownloadButtons(runId, files) {
    const map = {
        'patched.yaml':      { type: 'yaml', label: '⬇ Patched YAML',  cls: 'dl-yaml' },
        'translations.xlsx': { type: 'xlsx', label: '⬇ Excel',          cls: 'dl-xlsx' },
        'translations.csv':  { type: 'csv',  label: '⬇ CSV',            cls: 'dl-csv'  },
        'output.txt':        { type: 'log',  label: '⬇ Log',            cls: 'dl-log'  },
    };
    document.getElementById('dl-row').innerHTML =
        files.map(f => map[f]
            ? `<a class="dl-btn ${map[f].cls}"
                  href="/api/download/${runId}/${map[f].type}"
                  download>${map[f].label}</a>`
            : ''
        ).join('');
}
```

---

## .gitignore — exclude run outputs

Add to `.gitignore` (or `csharp-webapp/.gitignore`):

```gitignore
# Per-run output files — never commit
csharp-webapp/outputs/
outputs/
```

---

## Optional: run cleanup (old runs)

To prevent unbounded disk growth, add a background cleanup:

```csharp
// In Program.cs or a hosted service:
var outputsRoot = Path.Combine(app.Environment.ContentRootPath, "outputs");
if (Directory.Exists(outputsRoot))
{
    foreach (var dir in Directory.GetDirectories(outputsRoot))
    {
        var created = Directory.GetCreationTimeUtc(dir);
        if (DateTime.UtcNow - created > TimeSpan.FromDays(7))
            Directory.Delete(dir, recursive: true);
    }
}
```

---

## Reuse checklist for a new app
- [ ] `outputs/` directory in project root (created at runtime by `Directory.CreateDirectory`)
- [ ] `CreateRunDir()` called at the start of every output-producing endpoint
- [ ] `SaveInput()` persists the request JSON for audit trail
- [ ] `SaveMetadata()` writes `metadata.json` with at minimum: `run_id`, `created_at`, `success`
- [ ] Console log saved to `output.txt`
- [ ] `GET /api/result/{runId}` returns `files`, `console_output`, `metadata`
- [ ] `GET /api/download/{runId}/{type}` uses `PhysicalFile` with whitelisted types
- [ ] `outputs/` added to `.gitignore`
