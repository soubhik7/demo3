# Skill 04 — Python Bridge: C# → Python Subprocess

## What this skill covers
- Calling any Python script from C# via `System.Diagnostics.Process`
- Capturing stdout + stderr cleanly
- Stripping ANSI colour codes from Python output
- Configurable Python executable path (handles `python` vs `python3` vs `py`)
- Quick Python version health check
- Error handling and exit code checking

## File
- `Services/PythonRunner.cs`

---

## ProcessResult model

```csharp
public class ProcessResult
{
    public int    ExitCode       { get; set; }
    public string StandardOutput { get; set; } = "";
    public string ErrorOutput    { get; set; } = "";
    public bool   Success        => ExitCode == 0;  // computed — no setter needed
}
```

---

## PythonRunner service — full pattern

```csharp
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace MyApp.Services;

public class PythonRunner
{
    private readonly string _pythonExe;   // e.g. "python3", "python", "py"
    private readonly string _scriptsDir;  // absolute path to scripts folder

    public PythonRunner(IConfiguration config, IWebHostEnvironment env)
    {
        _pythonExe  = config["Python:Executable"] ?? "python3";

        var cfgDir  = config["Python:ScriptsDir"] ?? "";
        _scriptsDir = string.IsNullOrWhiteSpace(cfgDir)
            ? Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "scripts"))
            : cfgDir;
    }

    // ── Public methods — one per script ──────────────────────────────────────

    public Task<ProcessResult> RunMyScript(string inputPath, string outPath)
    {
        var script = Path.Combine(_scriptsDir, "my_script.py");
        var args   = $"\"{script}\" --input \"{inputPath}\" --output \"{outPath}\"";
        return RunProcess(args);
    }

    public async Task<string> GetPythonVersion()
    {
        try
        {
            var r = await RunProcess("--version");
            // Python 3.x prints version to stderr on some builds
            var v = (r.StandardOutput + r.ErrorOutput).Trim();
            return string.IsNullOrWhiteSpace(v) ? "python not found" : v;
        }
        catch { return "python not found"; }
    }

    // ── Core subprocess runner ────────────────────────────────────────────────

    private async Task<ProcessResult> RunProcess(string args)
    {
        var psi = new ProcessStartInfo
        {
            FileName               = _pythonExe,
            Arguments              = args,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            UseShellExecute        = false,   // MUST be false to redirect streams
            CreateNoWindow         = true,    // no console popup on Windows
        };

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start Python process.");

        // Read stdout + stderr concurrently — avoids deadlock on large output
        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        return new ProcessResult
        {
            ExitCode       = process.ExitCode,
            StandardOutput = StripAnsi(await stdoutTask),
            ErrorOutput    = StripAnsi(await stderrTask),
        };
    }

    // Strip ANSI escape sequences (colours, bold, reset) — Python CLIs use these
    private static string StripAnsi(string text) =>
        Regex.Replace(text, @"\x1B\[[0-9;]*[mKJH]", "");
}
```

---

## Argument quoting rules

Always wrap paths in double quotes — handles spaces in directory names:

```csharp
// ✅ Correct
var args = $"\"{scriptPath}\" --input \"{inputPath}\" --output \"{outputPath}\"";

// ❌ Wrong — breaks on paths with spaces
var args = $"{scriptPath} --input {inputPath}";
```

On Windows, use verbatim paths — `Path.Combine` handles the separator correctly.

---

## Concurrent stdout/stderr reading — why it matters

If you read stdout then stderr sequentially, the process can deadlock when
one pipe fills its buffer while the other is not being drained.

```csharp
// ✅ Correct — read both concurrently
var stdoutTask = process.StandardOutput.ReadToEndAsync();
var stderrTask = process.StandardError.ReadToEndAsync();
await process.WaitForExitAsync();
var stdout = await stdoutTask;
var stderr = await stderrTask;

// ❌ Wrong — potential deadlock
var stdout = await process.StandardOutput.ReadToEndAsync();  // blocks here
var stderr = await process.StandardError.ReadToEndAsync();   // never reached
await process.WaitForExitAsync();
```

---

## Configuring the Python executable

In `appsettings.json`:
```json
"Python": {
  "Executable": "python3",
  "ScriptsDir": "",
  "ConfigDir":  ""
}
```

| OS / Setup | Value to use |
|---|---|
| macOS / Linux (standard) | `"python3"` |
| Windows (standard) | `"python"` |
| Windows Python Launcher | `"py"` |
| Full path (when not in PATH) | `"C:\\Python312\\python.exe"` |
| Virtual env (Windows) | `".\\venv\\Scripts\\python.exe"` |
| Virtual env (Mac/Linux) | `"./venv/bin/python3"` |

---

## Error handling patterns

### Script returned non-zero exit code
```csharp
var result = await _py.RunMyScript(inputPath, outputPath);

if (!result.Success)
{
    var detail = result.StandardOutput + "\n" + result.ErrorOutput;
    return BadRequest(new {
        error          = "Python script failed.",
        console_output = detail,
        exit_code      = result.ExitCode,
    });
}
```

### Python not found
The `GetPythonVersion()` method returns `"python not found"` instead of throwing.
The health endpoint surfaces this to the UI:

```csharp
[HttpGet("health")]
public async Task<IActionResult> Health()
{
    var version = await _py.GetPythonVersion();
    return Ok(new { status = "ok", python = version });
}
```

In `app.js`, the health check updates a status badge in the header:
```js
async function checkHealth() {
    const { python } = await (await fetch('/api/health')).json();
    const el = document.getElementById('python-status');
    el.textContent = python.includes('not found')
        ? '⚠ Python not found'
        : '✓ ' + python;
}
```

---

## Combining stdout + stderr for the log file

Python writes info to stdout and errors to stderr. Combine both for the console log:

```csharp
var log = result.StandardOutput
        + (string.IsNullOrWhiteSpace(result.ErrorOutput) ? "" : "\n" + result.ErrorOutput);
await File.WriteAllTextAsync(Path.Combine(outputDir, "output.txt"), log);
```

---

## Adding a new script method

Pattern: one public method per script, named `Run<ScriptName>`:

```csharp
public Task<ProcessResult> RunNewScript(
    string inputPath,
    string outputPath,
    bool dryRun = false)
{
    var script = Path.Combine(_scriptsDir, "new_script.py");
    var args   = $"\"{script}\" --input \"{inputPath}\" --output \"{outputPath}\""
               + (dryRun ? " --dry-run" : "");
    return RunProcess(args);
}
```

Then call it from the controller:
```csharp
var result = await _py.RunNewScript(inputPath, outputPath, dryRun: false);
```

---

## Reuse checklist for a new app
- [ ] Copy `PythonRunner.cs` verbatim, change namespace only
- [ ] Register in `Program.cs`: `builder.Services.AddSingleton<PythonRunner>()`
- [ ] Add one `public Task<ProcessResult> Run<Name>(...)` method per script
- [ ] Always quote all path arguments
- [ ] Always read stdout and stderr concurrently
- [ ] Call `GetPythonVersion()` from the health endpoint
- [ ] Set `Python:Executable` in `appsettings.json` for the target OS
