# /add-python-step

Implement or stub a new step in the Python orchestration pipeline
(`scripts/orchestrator.py` + `scripts/steps/step<N>_<name>.py`).

## What to ask the user first
- Step number (1–10, or a new number)
- Step name / short description
- Owner / responsible team member
- Is this step **ready to implement** or a **stub** (NotImplementedError)?
- Input: what fields from the onboarding JSON does it consume?
- Output: what does it return (e.g. a client ID, a branch name, a URL)?
- Any downstream steps that depend on its output?

## Step module pattern — stub (not yet implemented)

Create `scripts/steps/step<N>_<slug>.py`:

```python
"""
Step <N>: <Title>
Owner: <Name>
Status: TODO — awaiting credentials / schema confirmation

Input fields used:
  - data["<field1>"]
  - data["<field2>"]

Output written to OrchestrationState:
  - state.<output_field>
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class <StepName>Config:
    partner_id:   str = ""
    country_code: str = ""
    # TODO: add fields once <Owner> confirms schema


@dataclass
class <StepName>Result:
    <output_field>: str = ""
    raw_responses:  dict = field(default_factory=dict)


def run(cfg: <StepName>Config) -> <StepName>Result:
    raise NotImplementedError(
        "Step <N> (<Title>) not yet implemented — awaiting credentials from <Owner>."
    )
```

## Step module pattern — implemented

```python
def run(cfg: <StepName>Config) -> <StepName>Result:
    import requests  # or whatever library is needed

    headers = {"Authorization": f"Bearer {cfg.api_token}"}
    resp = requests.post(
        f"{cfg.api_host}/api/v1/<endpoint>",
        json={"partnerId": cfg.partner_id},
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    return <StepName>Result(
        <output_field>=data["<key>"],
        raw_responses=data,
    )
```

## Wiring into orchestrator.py

1. **Import** at the top of `orchestrator.py`:
```python
from steps import step<N>_<slug>
```

2. **Add a runner function** (copy the existing `_run_stepN` pattern):
```python
def _run_step<N>(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(<N>, "<Title>")
    cfg = step<N>_<slug>.<StepName>Config(
        partner_id   = state.btp_client_id or data.get("partner_id", ""),
        country_code = data.get("country_code", ""),
        # TODO: fill remaining fields from data / Key Vault
    )
    try:
        if dry_run:
            _skip("dry-run: skipping Step <N>")
            state.record("Step <N> — <Title>", "skipped")
            return
        result = step<N>_<slug>.run(cfg)
        state.<output_field> = result.<output_field>
        _ok(f"Step <N> complete: {result.<output_field>}")
        state.record("Step <N> — <Title>", "ok")
    except NotImplementedError as e:
        _skip(str(e).splitlines()[0])
        state.record("Step <N> — <Title>", "skipped")
```

3. **Add to `OrchestrationState`** if the step produces output used downstream:
```python
# In OrchestrationState.__init__
self.<output_field>: str = ""
```

4. **Call it in `main()`** in the right sequence order:
```python
_run_step<N>(data, state, args.dry_run)
```

## Wiring into the C# PythonRunner (if step needs its own endpoint)

Add a method to `Services/PythonRunner.cs` — see `/add-api-endpoint` command.

## Step status lifecycle

| Status | Meaning |
|---|---|
| `"ok"` | Step ran and succeeded |
| `"skipped"` | `NotImplementedError` raised (stub) or `--dry-run` |
| `"error"` | Exception other than `NotImplementedError` |
| `"manual"` | Step requires human action (Step 10 pattern) |

## Checklist
- [ ] Module file created in `scripts/steps/`
- [ ] Imported and called in `orchestrator.py`
- [ ] State fields added to `OrchestrationState` if needed
- [ ] Step listed in the 10-step reference table on `result.html`
- [ ] Required env vars documented in project README env-var table
