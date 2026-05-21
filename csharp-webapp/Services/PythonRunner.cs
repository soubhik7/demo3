using System.Diagnostics;
using System.Text.RegularExpressions;

namespace OnboardingApp.Services;

public class ProcessResult
{
    public int    ExitCode       { get; set; }
    public string StandardOutput { get; set; } = "";
    public string ErrorOutput    { get; set; } = "";
    public bool   Success        => ExitCode == 0;
}

public class PythonRunner
{
    private readonly string _pythonExe;
    private readonly string _scriptsDir;

    public PythonRunner(IConfiguration config, IWebHostEnvironment env)
    {
        _pythonExe  = config["Python:Executable"] ?? "python";

        // Allow override in appsettings.json; otherwise resolve relative to project root
        var cfgScripts = config["Python:ScriptsDir"] ?? "";
        _scriptsDir = string.IsNullOrWhiteSpace(cfgScripts)
            ? Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "scripts"))
            : cfgScripts;
    }

    /// <summary>
    /// Run patch_config.py — Steps 7+8 (YAML patch + translation rows).
    /// Writes outputs to caller-supplied paths so nothing touches the source YAML.
    /// </summary>
    public Task<ProcessResult> RunPatchConfig(
        string inputPath,
        string yamlPath,
        string outYaml,
        string outTranslations)
    {
        var script = Path.Combine(_scriptsDir, "patch_config.py");
        var args   = $"\"{script}\" "
                   + $"--input \"{inputPath}\" "
                   + $"--yaml \"{yamlPath}\" "
                   + $"--out-yaml \"{outYaml}\" "
                   + $"--out-translations \"{outTranslations}\"";

        return RunProcess(args);
    }

    /// <summary>
    /// Run orchestrator.py — all 10 steps (stubs skip gracefully).
    /// </summary>
    public Task<ProcessResult> RunOrchestrator(string inputPath, string yamlPath)
    {
        var script = Path.Combine(_scriptsDir, "orchestrator.py");
        var args   = $"\"{script}\" --input \"{inputPath}\" --yaml \"{yamlPath}\"";
        return RunProcess(args);
    }

    /// <summary>
    /// Quick Python version check so the UI can surface a helpful error early.
    /// </summary>
    public async Task<string> GetPythonVersion()
    {
        try
        {
            var r = await RunProcess("--version");
            return r.Success
                ? r.StandardOutput.Trim() + r.ErrorOutput.Trim()   // Python 3.x prints to stderr on some builds
                : "python not found";
        }
        catch
        {
            return "python not found";
        }
    }

    // ── internals ─────────────────────────────────────────────────────────────

    private async Task<ProcessResult> RunProcess(string args)
    {
        var psi = new ProcessStartInfo
        {
            FileName               = _pythonExe,
            Arguments              = args,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            UseShellExecute        = false,
            CreateNoWindow         = true,
        };

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start Python process.");

        var stdout = await process.StandardOutput.ReadToEndAsync();
        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        return new ProcessResult
        {
            ExitCode       = process.ExitCode,
            StandardOutput = StripAnsi(stdout),
            ErrorOutput    = StripAnsi(stderr),
        };
    }

    private static string StripAnsi(string text) =>
        Regex.Replace(text, @"\x1B\[[0-9;]*[mK]", "");
}
