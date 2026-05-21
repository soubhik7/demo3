# /new-webapp

Scaffold a brand-new C# + HTML/CSS + Python web application using the
3PL Onboarding app as the reference template.

## What to ask the user first
- **App name** (used as the project folder, assembly name, page title)
- **Purpose** — what does the form collect? What does the backend do with it?
- **Backend language for core logic**: Python (subprocess) | pure C# | both
- **Output files** produced (e.g. YAML, Excel, PDF, JSON)?
- **Optional sections** in the form? (toggle-able groups of fields)
- **Dynamic tables** needed? (add/remove rows, like combos/UOM tables)
- **Port number** for local dev (default: 5050; pick a free port)

## Files to create (copy-and-adapt from csharp-webapp/)

```
<app-name>/
├── <app-name>.csproj            ← change AssemblyName + RootNamespace
├── Program.cs                   ← identical (no changes needed)
├── appsettings.json             ← change Urls port + Python:Executable if needed
├── Controllers/
│   └── <Domain>Controller.cs   ← adapt from OnboardingController.cs
├── Services/
│   └── PythonRunner.cs         ← identical if calling Python; omit if pure C#
└── wwwroot/
    ├── index.html               ← new form sections for this domain
    ├── result.html              ← adapt download buttons + step table
    ├── style.css                ← identical (design tokens are generic)
    └── app.js                  ← adapt TX_CODES, MSG_TYPES, buildJson(), validateForm()
```

## Minimal .csproj (copy verbatim, change names)

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <AssemblyName><AppName></AssemblyName>
    <RootNamespace><AppName></RootNamespace>
  </PropertyGroup>
</Project>
```

## appsettings.json template

```json
{
  "Logging": { "LogLevel": { "Default": "Information" } },
  "Python": {
    "Executable": "python3",
    "ScriptsDir": "",
    "ConfigDir":  ""
  },
  "AllowedHosts": "*",
  "Urls": "http://localhost:<PORT>"
}
```

## Program.cs — always identical

```csharp
using <AppName>.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddSingleton<PythonRunner>();   // omit if no Python

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();
app.Run();
```

## Controller skeleton for a new domain

```csharp
[ApiController]
[Route("api")]
public class <Domain>Controller : ControllerBase
{
    private readonly PythonRunner _py;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;

    public <Domain>Controller(PythonRunner py, IWebHostEnvironment env, IConfiguration config)
    { _py = py; _env = env; _config = config; }

    [HttpGet("health")]
    public async Task<IActionResult> Health()
    {
        var v = await _py.GetPythonVersion();
        return Ok(new { status = "ok", python = v });
    }

    [HttpPost("run")]
    public async Task<IActionResult> Run([FromBody] JsonElement body)
    {
        var (runId, outputDir) = CreateRunDir();
        var inputPath = await SaveInput(outputDir, body);
        var result    = await _py.Run<Script>(inputPath);
        // ... same pattern as OnboardingController
        return Ok(new { run_id = runId, success = result.Success });
    }

    // ... paste Download() + helper methods from OnboardingController unchanged
}
```

## JS buildJson() template

Adapt to collect whatever fields your form has:

```js
function buildJson() {
  return {
    // top-level fields
    <field1>: getVal('<field1_id>') || '',
    <field2>: getCb('<checkbox_id>'),

    // nested object
    config: {
      host:    getVal('config_host') || '',
      port:    getVal('config_port') || '',
    },

    // dynamic rows (same pattern as combos/UOM)
    items: state.items,

    // optional section
    ...(document.getElementById('include-optional')?.checked ? {
      optional: { field: getVal('optional_field') }
    } : {}),
  };
}
```

## JS validateForm() template

```js
function validateForm(json) {
  const errors = [];
  if (!json.<required_field>)   errors.push('<Label> is required.');
  if (!json.config.host)         errors.push('Host is required.');
  // add more as needed
  return errors;
}
```

## Skills used — reference docs

All reusable patterns for this stack are documented in `docs/skills/`:

| Skill doc | What it covers |
|---|---|
| `01-ui-design.md` | Card layout, CSS tokens, responsive grid |
| `02-dynamic-forms.md` | Vanilla JS form, dynamic tables, toggles |
| `03-csharp-api.md` | ASP.NET Core minimal setup, controllers, file serving |
| `04-python-bridge.md` | Subprocess wrapper, ANSI stripping, error handling |
| `05-orchestration.md` | Multi-step pipeline, skip/error lifecycle |
| `06-output-management.md` | UUID run dirs, metadata.json, per-run isolation |
| `07-security.md` | Path traversal, UUID validation, input sanitisation |
| `08-configuration.md` | appsettings.json, environment overrides |

## Quick-start commands after scaffolding

```bash
cd <app-name>
dotnet run               # starts on http://localhost:<PORT>
# or
dotnet watch run         # hot-reload (recompiles on .cs file save)
```
