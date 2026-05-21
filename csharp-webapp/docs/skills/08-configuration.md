# Skill 08 — Configuration: appsettings.json, Environment Overrides, No Hardcodes

## What this skill covers
- `appsettings.json` structure for this stack
- Overriding settings per environment (dev vs production)
- Accessing config in controllers and services
- Making paths configurable (scripts dir, config dir, port)
- Environment variables as a fallback for secrets
- What should and should NOT go in `appsettings.json`

## File
- `appsettings.json`

---

## appsettings.json template

```json
{
  "Logging": {
    "LogLevel": {
      "Default":             "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Python": {
    "Executable": "python3",
    "ScriptsDir": "",
    "ConfigDir":  ""
  },
  "AllowedHosts": "*",
  "Urls": "http://localhost:5050"
}
```

### Key fields

| Key | Default | When to change |
|---|---|---|
| `Python:Executable` | `"python3"` | `"python"` on Windows, `"py"` for Windows Launcher, full path if not in PATH |
| `Python:ScriptsDir` | `""` (auto-resolved) | Override if scripts are in a non-standard location |
| `Python:ConfigDir`  | `""` (auto-resolved) | Override if config YAML is in a non-standard location |
| `Urls`              | `"http://localhost:5050"` | Change port if 5050 is in use |

---

## Reading config in services

```csharp
// In constructor — IConfiguration is auto-injected
public PythonRunner(IConfiguration config, IWebHostEnvironment env)
{
    _pythonExe = config["Python:Executable"] ?? "python3";

    var cfgScriptsDir = config["Python:ScriptsDir"] ?? "";
    _scriptsDir = string.IsNullOrWhiteSpace(cfgScriptsDir)
        ? Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "scripts"))
        : cfgScriptsDir;
}
```

### Pattern for path resolution

```csharp
private string ResolvePath(IConfiguration config, IWebHostEnvironment env,
                            string configKey, string relativeDefault)
{
    var cfgVal = config[configKey] ?? "";
    return string.IsNullOrWhiteSpace(cfgVal)
        ? Path.GetFullPath(Path.Combine(env.ContentRootPath, relativeDefault))
        : cfgVal;
}

// Usage
_scriptsDir = ResolvePath(config, env, "Python:ScriptsDir", "../scripts");
_configDir  = ResolvePath(config, env, "Python:ConfigDir",  "../config");
```

---

## Environment-specific overrides

ASP.NET Core merges config files in order — later files override earlier:

```
appsettings.json                   ← base (committed to git)
appsettings.Development.json       ← dev overrides (gitignored or committed)
appsettings.Production.json        ← prod overrides (gitignored — contains secrets)
Environment variables              ← highest priority (use in CI/CD)
```

### appsettings.Development.json example
```json
{
  "Logging": { "LogLevel": { "Default": "Debug" } },
  "Urls": "http://localhost:5050"
}
```

### appsettings.Production.json example (never commit)
```json
{
  "Python": { "Executable": "python3", "ScriptsDir": "/opt/app/scripts" },
  "Urls": "http://0.0.0.0:80"
}
```

---

## Environment variables — override any config key

Environment variable names use `__` (double underscore) as the section separator:

```bash
# Override Python executable
Python__Executable=python3

# Override port
Urls=http://localhost:8080

# On Windows (PowerShell)
$env:Python__Executable = "python"
```

This makes the app work in Docker / Azure App Service without changing any files:
```dockerfile
ENV Python__Executable=python3
ENV Urls=http://0.0.0.0:80
```

---

## What belongs in appsettings.json vs elsewhere

### ✅ appsettings.json
- Python executable name / path
- Scripts and config directory paths
- Port number
- Log level
- Feature flags

### ❌ Never in appsettings.json (use env vars or Key Vault)
- API keys, tokens, passwords
- GitHub PATs
- SMTP passwords
- Azure service principal credentials

### Reading a secret from an env var (fallback pattern)
```csharp
// Read from env var first, fall back to appsettings
var apiToken = Environment.GetEnvironmentVariable("MY_API_TOKEN")
            ?? config["ExternalServices:MyApiToken"]
            ?? throw new InvalidOperationException("MY_API_TOKEN is required.");
```

---

## Changing the port

Edit `appsettings.json`:
```json
"Urls": "http://localhost:5051"
```

Or pass at runtime without editing:
```bash
dotnet run --urls "http://localhost:5051"
```

Or set env var:
```bash
ASPNETCORE_URLS=http://localhost:5051 dotnet run
```

---

## Setting `ContentRootPath` correctly

`env.ContentRootPath` is the directory containing the `.csproj` file — this is
where the app resolves relative paths.

| Scenario | ContentRootPath |
|---|---|
| `dotnet run` (from project dir) | `/path/to/csharp-webapp` |
| `dotnet run` (from parent dir) | `/path/to/csharp-webapp` (set by SDK) |
| Published + deployed | `/path/to/published/output` |

**Always use `Path.Combine(env.ContentRootPath, ...)` — never hardcode absolute paths.**

---

## .gitignore for config

```gitignore
# Secrets — never commit
appsettings.Production.json
appsettings.*.local.json

# Runtime outputs
outputs/
```

---

## Reuse checklist for a new app
- [ ] Copy `appsettings.json`, change port + assembly name
- [ ] Add a `Python:Executable` entry (default `python3` on Mac/Linux, `python` on Windows)
- [ ] All directory paths use `env.ContentRootPath` as the base — no hardcoded absolute paths
- [ ] Secrets read from environment variables, not from config file
- [ ] `appsettings.Production.json` added to `.gitignore`
- [ ] `Urls` key set to a free local port
