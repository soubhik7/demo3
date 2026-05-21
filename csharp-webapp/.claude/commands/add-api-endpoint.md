# /add-api-endpoint

Add a new API endpoint to `Controllers/OnboardingController.cs` (or a new controller
file if the domain is distinct).

## What to ask the user first
- HTTP method: `GET` | `POST` | `PUT` | `DELETE`
- Route path (e.g. `/api/validate`, `/api/export/{runId}`)
- What does it accept? (JSON body | file upload | route params | query params)
- What does it return? (JSON | file download | plain text)
- Does it call Python? If yes, which script and arguments?
- Does it write files to the `outputs/{runId}/` directory?

## Controller method pattern — POST with JSON body → runs Python

```csharp
// ── POST /api/<route> ─────────────────────────────────────────────────────
[HttpPost("<route>")]
public async Task<IActionResult> <MethodName>([FromBody] JsonElement body)
{
    var (runId, outputDir) = CreateRunDir();
    var inputPath = await SaveInput(outputDir, body);

    // Call Python
    var result = await _py.Run<ScriptName>(inputPath, /* extra args */);

    var log = result.StandardOutput
            + (string.IsNullOrWhiteSpace(result.ErrorOutput) ? "" : "\n" + result.ErrorOutput);
    await System.IO.File.WriteAllTextAsync(Path.Combine(outputDir, "output.txt"), log);
    await SaveMetadata(outputDir, runId, body, result.Success);

    if (!result.Success)
        return BadRequest(new { error = "Script failed.", console_output = log, run_id = runId });

    return Ok(new { run_id = runId, success = true, console_output = log });
}
```

## Controller method pattern — GET file download

```csharp
[HttpGet("<route>/{runId}/{type}")]
public IActionResult Download<Name>(string runId, string type)
{
    if (!IsValidRunId(runId))
        return BadRequest(new { error = "Invalid run ID." });

    var allowed = new Dictionary<string, (string file, string mime)>(StringComparer.OrdinalIgnoreCase)
    {
        ["<type1>"] = ("<filename.ext>", "<mime/type>"),
    };

    if (!allowed.TryGetValue(type, out var info))
        return BadRequest(new { error = $"Unknown type '{type}'." });

    var path = Path.Combine(_env.ContentRootPath, "outputs", runId, info.file);
    if (!System.IO.File.Exists(path))
        return NotFound(new { error = "File not found." });

    return PhysicalFile(path, info.mime, info.file);
}
```

## Adding a new PythonRunner method

In `Services/PythonRunner.cs`, add a method following the existing pattern:

```csharp
public Task<ProcessResult> Run<ScriptName>(string inputPath, string extraArg)
{
    var script = Path.Combine(_scriptsDir, "<script_name>.py");
    var args   = $"\"{script}\" --input \"{inputPath}\" --extra \"{extraArg}\"";
    return RunProcess(args);
}
```

## Common MIME types

| Extension | MIME type |
|---|---|
| `.yaml` / `.yml` | `application/x-yaml` |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `.csv` | `text/csv` |
| `.json` | `application/json` |
| `.txt` | `text/plain` |
| `.pdf` | `application/pdf` |
| `.zip` | `application/zip` |

## Security checklist before finishing
- [ ] UUID validation on any `runId` route param (`IsValidRunId()` helper already exists)
- [ ] Whitelist allowed `type` values — never pass user input directly to a file path
- [ ] Use `Path.Combine` + `GetFullPath` — never string-concat paths
- [ ] Return sanitised error messages (no stack traces, no file paths in production)
