# Skills Library — C# + HTML/CSS + Python Web App Stack

This folder documents every reusable pattern used to build the 3PL Onboarding webapp.
Each skill is self-contained — copy the pattern, adapt the names, and it works in any
new application built on this stack.

---

## Stack at a glance

```
Browser  ←→  ASP.NET Core (C#)  ←→  Python scripts
HTML/CSS/JS    controllers            patch_config.py
vanilla JS     PythonRunner.cs        orchestrator.py
               file serving           steps/step*.py
```

**No npm. No Node. No React. No NuGet extras.**
Everything runs with `dotnet run` + `python3`.

---

## Skill index

| # | File | What it covers | When you need it |
|---|------|----------------|-----------------|
| 1 | [01-ui-design.md](01-ui-design.md) | CSS tokens, card layout, responsive grid, buttons, alerts | Every new app — the visual language |
| 2 | [02-dynamic-forms.md](02-dynamic-forms.md) | Vanilla JS form state, dynamic tables, section toggles, JSON pre-fill | Any app with a multi-section input form |
| 3 | [03-csharp-api.md](03-csharp-api.md) | ASP.NET Core minimal setup, controllers, file download, health check | Building the backend routes |
| 4 | [04-python-bridge.md](04-python-bridge.md) | C# → Python subprocess, ANSI stripping, error capture, configurable path | Calling any Python script from C# |
| 5 | [05-orchestration.md](05-orchestration.md) | Multi-step pipeline, skip/error lifecycle, inter-step state, dry-run | Multi-step automation workflows |
| 6 | [06-output-management.md](06-output-management.md) | UUID run dirs, metadata.json, per-run isolation, file streaming | Any app that generates downloadable files |
| 7 | [07-security.md](07-security.md) | Path traversal prevention, UUID validation, input sanitisation | Every endpoint that touches the filesystem |
| 8 | [08-configuration.md](08-configuration.md) | appsettings.json, environment overrides, no hardcoded paths | Any app with environment-specific settings |

---

## Claude Code slash commands

These commands are in `.claude/commands/` — type them inside Claude Code:

| Command | What it does |
|---------|-------------|
| `/new-webapp` | Scaffold a brand-new app from this template |
| `/add-form-section` | Add a new card section to index.html + wire JS |
| `/add-api-endpoint` | Add a new C# controller method |
| `/add-python-step` | Implement or stub a new orchestration step |
| `/add-download-type` | Add a new output file with download button |

---

## Hooks (`.claude/settings.json`)

| Event | Trigger | Action |
|-------|---------|--------|
| `PostToolUse` | Edit/Write on `*.cs` file | Auto-runs `dotnet build` — catches compile errors immediately |
| `Stop` | End of every Claude session | Reminds to restart server if `appsettings.json` changed |

---

## Quick-start for a new app

```bash
# 1. Copy the template
cp -r csharp-webapp my-new-app
cd my-new-app

# 2. Rename assembly in .csproj
#    Change AssemblyName + RootNamespace to MyNewApp

# 3. Change namespace in all .cs files
#    s/OnboardingApp/MyNewApp/g

# 4. Change port in appsettings.json (pick a free port)

# 5. Run
dotnet run   # → http://localhost:<PORT>
```

Then use `/add-form-section`, `/add-api-endpoint`, `/add-python-step` to build out the app.
