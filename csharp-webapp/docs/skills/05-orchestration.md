# Skill 05 — Flow Orchestration: Multi-Step Pipeline, Skip/Error Lifecycle

## What this skill covers
- Designing a numbered multi-step pipeline
- Step lifecycle: `ok` | `skipped` | `error` | `manual`
- Gracefully skipping unimplemented stubs (`NotImplementedError`)
- Inter-step state object (passing outputs from one step as inputs to the next)
- Dry-run mode (validate only, no side effects)
- Summary report at the end
- Mirroring the same pipeline in both Python CLI and C# web layer

## Files
- `scripts/orchestrator.py` — Python CLI orchestrator
- `scripts/steps/step*.py` — individual step modules
- `Controllers/OnboardingController.cs` → `/api/orchestrate` endpoint

---

## Step lifecycle states

```
┌──────────────────────────────────────────────────┐
│  Step execution                                  │
│                                                  │
│  run()  ──► success    ──► status = "ok"         │
│         ──► NotImplementedError ──► "skipped"    │
│         ──► any other Exception ──► "error"      │
│         ──► dry_run=True        ──► "skipped"    │
│  (special) manual action        ──► "manual"     │
└──────────────────────────────────────────────────┘
```

The orchestrator **never stops** on a skip — it always continues to the next step.
Only a real error (`"error"` status) indicates something went wrong.

---

## OrchestrationState — inter-step data carrier

```python
class OrchestrationState:
    """Collects outputs from each step for use in downstream steps."""

    def __init__(self) -> None:
        # Step 1 → Steps 2,3,4,5,6
        self.btp_client_id:   str = ""
        self.btp_app_name:    str = ""

        # Step 3 → Step 5
        self.solace_enum_version_id:  str = ""
        self.solace_event_version_id: str = ""

        # Step 6 → Step 9
        self.mule_feature_branch: str = ""

        # Step 7 output (used in Step 9 PR description)
        self.yaml_diff_summary:    str = ""

        # Step 8 output
        self.translation_row_count: int = 0

        # Status tracking
        self.statuses: dict[str, str] = {}

    def record(self, step: str, status: str) -> None:
        self.statuses[step] = status

    def summary(self) -> str:
        lines = ["=" * 60, "  ORCHESTRATION SUMMARY", "=" * 60]
        icons = {"ok": "[OK]    ", "skipped": "[SKIP]  ",
                 "manual": "[MANUAL]", "error": "[ERROR] "}
        for step, status in self.statuses.items():
            lines.append(f"  {icons.get(status, '[?]    ')} {step}")
        lines.append("=" * 60)
        return "\n".join(lines)
```

---

## Step runner pattern

Each step follows the same structure — banner, config, try/except:

```python
def _run_step_n(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(N, "Step Title")

    cfg = step_n_module.StepNConfig(
        partner_id   = state.btp_client_id or data.get("partner_id", ""),
        country_code = data.get("country_code", ""),
        # pull secrets from Key Vault / env vars, not from data
    )

    try:
        if dry_run:
            _skip("dry-run: skipping Step N")
            state.record("Step N — Title", "skipped")
            return

        result = step_n_module.run(cfg)

        # Write outputs to state for downstream steps
        state.some_output_field = result.output_value
        _ok(f"Step N complete: {result.output_value}")
        state.record("Step N — Title", "ok")

    except NotImplementedError as e:
        # Stub — skip gracefully
        _skip(str(e).splitlines()[0])
        state.record("Step N — Title", "skipped")

    except Exception as e:
        # Real error — log but continue
        _err(str(e))
        state.record("Step N — Title", "error")
```

---

## Step module template

```python
# scripts/steps/step_n_title.py
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class StepNConfig:
    partner_id:    str = ""
    country_code:  str = ""
    api_token:     str = ""   # from env var / Key Vault
    # add all required fields


@dataclass
class StepNResult:
    output_id:      str = ""
    output_name:    str = ""
    raw_responses:  dict = field(default_factory=dict)


def run(cfg: StepNConfig) -> StepNResult:
    # Stub — raise this until implementation is ready
    raise NotImplementedError(
        "Step N (Title) not yet implemented — awaiting credentials from <Owner>."
    )

    # When implementing, replace above with actual logic:
    # import requests
    # resp = requests.post(cfg.api_host + "/endpoint", ...)
    # return StepNResult(output_id=resp.json()["id"])
```

---

## Orchestrator main loop

```python
def main() -> None:
    # ... arg parsing, file loading ...

    state = OrchestrationState()

    _run_step1(data, state, args.dry_run)   # BTP App Creation
    _run_step2(data, state, args.dry_run)   # BTP Value Mapping
    _run_step3(data, state, args.dry_run)   # Solace Event Portal
    _run_step4(data, state, args.dry_run)   # Solace Queue Patch
    _run_step5(data, state, args.dry_run)   # Solace Git
    _run_step6(data, state, args.dry_run)   # Mule Feature Branch
    _run_steps7_8(data, yaml_path, state, args.dry_run)  # YAML + Translations (DONE)
    _run_step9(data, state, args.dry_run)   # Mule PR + Notify
    _run_step10(state)                      # Manual gate (always runs)

    print(state.summary())
```

---

## C# orchestrate endpoint

The C# layer calls `orchestrator.py` and captures the full log:

```csharp
[HttpPost("orchestrate")]
public async Task<IActionResult> Orchestrate([FromBody] JsonElement body)
{
    var (runId, outputDir) = CreateRunDir();
    var inputPath = await SaveInput(outputDir, body);

    // Use a per-run copy of the config YAML so the original is never modified
    var devYaml  = ResolveDevYaml();
    var workYaml = Path.Combine(outputDir, "dev_working.yaml");
    File.Copy(devYaml, workYaml, overwrite: true);

    var result = await _py.RunOrchestrator(inputPath, workYaml);

    var log = result.StandardOutput
            + (result.ErrorOutput.Length > 0 ? "\n" + result.ErrorOutput : "");

    await File.WriteAllTextAsync(Path.Combine(outputDir, "output.txt"), log);
    await SaveMetadata(outputDir, runId, body, result.Success);

    return Ok(new { run_id = runId, success = result.Success, console_output = log });
}
```

---

## Dry-run mode

Pass `--dry-run` to validate input and preview without writing anything:

```bash
python orchestrator.py --input input.json --dry-run
```

In C#, add a `dryRun` query param:

```csharp
[HttpPost("orchestrate")]
public async Task<IActionResult> Orchestrate(
    [FromBody] JsonElement body,
    [FromQuery] bool dryRun = false)
{
    // ...
    var result = await _py.RunOrchestrator(inputPath, workYaml, dryRun);
}
```

```csharp
// In PythonRunner:
public Task<ProcessResult> RunOrchestrator(string input, string yaml, bool dryRun = false)
{
    var args = $"\"{script}\" --input \"{input}\" --yaml \"{yaml}\""
             + (dryRun ? " --dry-run" : "");
    return RunProcess(args);
}
```

---

## Step dependency diagram

```
Step 1 ──► btp_client_id ──► Steps 2, 3, 4, 5, 6, 9
Step 3 ──► solace_enum_version_id  ──► Step 5
        ──► solace_event_version_id ──► Step 5
Step 6 ──► mule_feature_branch ──► Step 9
Step 7 ──► yaml_diff_summary   ──► Step 9 (PR description)
Step 8 ──► translation_row_count ──► Step 9 (PR description)
```

When implementing a step, check what upstream state it needs and what it
must write back for downstream steps.

---

## Adding a new step

1. Create `scripts/steps/step<N>_<slug>.py` (use the stub template above)
2. Import in `orchestrator.py`
3. Add `_run_step<N>()` runner function
4. Add state fields to `OrchestrationState.__init__()` if step produces outputs
5. Insert call in `main()` at the right sequence position
6. Update the step reference table in `result.html`
7. Document required env vars in README

---

## Reuse checklist for a new pipeline
- [ ] Define `OrchestrationState` with all inter-step fields
- [ ] Create a stub `step_n_*.py` for every planned step
- [ ] Each runner follows: banner → config → try/NotImplementedError/except
- [ ] All steps call `state.record(name, status)`
- [ ] `main()` calls all steps in dependency order
- [ ] `--dry-run` flag skips all writes
- [ ] C# endpoint copies the source config file before passing to orchestrator
