"""
3PL Inbound Onboarding Orchestrator
=====================================
Runs all 10 automation steps in sequence.

Steps marked TODO raise NotImplementedError — the orchestrator catches them,
logs a SKIPPED warning, and continues so that implemented steps still run.

Usage:
  python orchestrator.py --input ../config/sample_onboarding_input.json
  python orchestrator.py --input input.json --yaml ../config/dev.yaml --dry-run

Steps:
  1  BTP Application Creation          [TODO - Parag Shende]
  2  BTP Value Mapping                 [TODO - Parag Shende]
  3  Solace Event Portal (5-call seq)  [TODO - Rohini Mondal]
  4  Solace Queue Subscription Patch   [TODO - Rohini Mondal]
  5  Solace Git / input.json           [TODO - Rohini Mondal + DevOps]
  6  MuleSoft Feature Branch           [TODO - Sravani Kare + DevOps]
  7  MuleSoft YAML Patch               [DONE]
  8  MuleSoft Translation Rows         [DONE]
  9  MuleSoft PR + Notify              [TODO - Sravani Kare]
  10 SharePoint / Manual Review Gate   [MANUAL]
"""
from __future__ import annotations

import argparse
import json
import sys
import textwrap
from pathlib import Path
from typing import Any, Optional

# ── path setup ───────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
CONFIG_DIR  = SCRIPT_DIR.parent / "config"
OUTPUTS_DIR = SCRIPT_DIR.parent / "outputs"

sys.path.insert(0, str(SCRIPT_DIR))
from steps import (
    step1_btp_app_creation,
    step2_btp_value_mapping,
    step3_solace_event_portal,
    step4_solace_queue_patch,
    step5_solace_git_input,
    step6_mule_feature_branch,
    step9_mule_pr_notify,
)
import patch_config  # Steps 7 + 8 (DONE)


# ── ANSI colours ─────────────────────────────────────────────────────────────
class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    CYAN   = "\033[96m"
    DIM    = "\033[2m"


def _banner(step: int, title: str) -> None:
    print(f"\n{C.BOLD}{C.CYAN}{'='*60}{C.RESET}")
    print(f"{C.BOLD}  Step {step}: {title}{C.RESET}")
    print(f"{C.BOLD}{C.CYAN}{'='*60}{C.RESET}")


def _ok(msg: str) -> None:
    print(f"{C.GREEN}  [OK]     {msg}{C.RESET}")


def _skip(msg: str) -> None:
    print(f"{C.YELLOW}  [SKIP]   {msg}{C.RESET}")


def _warn(msg: str) -> None:
    print(f"{C.YELLOW}  [WARN]   {msg}{C.RESET}")


def _err(msg: str) -> None:
    print(f"{C.RED}  [ERROR]  {msg}{C.RESET}")


def _info(msg: str) -> None:
    print(f"{C.DIM}  [INFO]   {msg}{C.RESET}")


def _manual(msg: str) -> None:
    print(f"{C.CYAN}  [MANUAL] {msg}{C.RESET}")


# ── Orchestration state ───────────────────────────────────────────────────────

class OrchestrationState:
    """Collects outputs from each step for use in downstream steps."""

    def __init__(self) -> None:
        # Step 1 output
        self.btp_client_id: str = ""
        self.btp_app_name:   str = ""

        # Step 3 output
        self.solace_enum_version_id:  str = ""
        self.solace_event_version_id: str = ""

        # Step 6 output
        self.mule_feature_branch: str = ""

        # Step 7 output
        self.yaml_diff_summary: str = ""

        # Step 8 output
        self.translation_row_count: int = 0

        # Step-level status
        self.statuses: dict[str, str] = {}

    def record(self, step: str, status: str) -> None:
        self.statuses[step] = status

    def summary(self) -> str:
        lines = [f"\n{'='*60}", "  ORCHESTRATION SUMMARY", f"{'='*60}"]
        for step, status in self.statuses.items():
            icon = "[OK]    " if status == "ok"      else \
                   "[SKIP]  " if status == "skipped" else \
                   "[MANUAL]" if status == "manual"  else "[ERROR] "
            lines.append(f"  {icon} {step}")
        lines.append(f"{'='*60}")
        return "\n".join(lines)


# ── Step runners ─────────────────────────────────────────────────────────────

def _run_step1(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(1, "BTP Application Creation")
    cfg = step1_btp_app_creation.BtpAppConfig(
        partner_id=data.get("partner_id", ""),
        # TODO: fill remaining fields from data once Parag confirms schema
    )
    try:
        if dry_run:
            _skip("dry-run: skipping Step 1")
            state.record("Step 1 — BTP App Creation", "skipped")
            return
        result = step1_btp_app_creation.run(cfg)
        state.btp_client_id = result.client_id
        state.btp_app_name  = result.app_name
        _ok(f"BTP app created — clientId: {result.client_id}")
        state.record("Step 1 — BTP App Creation", "ok")
    except NotImplementedError as e:
        _skip(str(e).splitlines()[0])
        state.record("Step 1 — BTP App Creation", "skipped")


def _run_step2(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(2, "BTP Value Mapping")
    cfg = step2_btp_value_mapping.BtpValueMappingConfig(
        partner_id=state.btp_client_id or data.get("partner_id", ""),
        country_code=data.get("country_code", ""),
        # TODO: fill remaining fields once Parag confirms schema
    )
    try:
        if dry_run:
            _skip("dry-run: skipping Step 2")
            state.record("Step 2 — BTP Value Mapping", "skipped")
            return
        result = step2_btp_value_mapping.run(cfg)
        _ok("BTP value mapping deployed")
        state.record("Step 2 — BTP Value Mapping", "ok")
    except NotImplementedError as e:
        _skip(str(e).splitlines()[0])
        state.record("Step 2 — BTP Value Mapping", "skipped")


def _run_step3(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(3, "Solace Event Portal Design (5-call sequence)")
    cfg = step3_solace_event_portal.SolaceEventPortalConfig(
        country_code=data.get("country_code", ""),
        region_iso=data.get("region_iso", ""),
        partner_id=state.btp_client_id or data.get("partner_id", ""),
        subscription_topics=data.get("subscription_topics", []),
        # TODO: fill api_token, enum_id, event_id, etc. from Key Vault
    )
    try:
        if dry_run:
            _skip("dry-run: skipping Step 3")
            state.record("Step 3 — Solace Event Portal", "skipped")
            return
        result = step3_solace_event_portal.run(cfg)
        state.solace_enum_version_id  = result.raw_responses.get("enum_version_id", "")
        state.solace_event_version_id = result.raw_responses.get("event_version_id", "")
        _ok("Solace Event Portal design steps complete")
        state.record("Step 3 — Solace Event Portal", "ok")
    except NotImplementedError as e:
        _skip(str(e).splitlines()[0])
        state.record("Step 3 — Solace Event Portal", "skipped")


def _run_step4(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(4, "Solace Queue Subscription Patch")
    cfg = step4_solace_queue_patch.SolaceQueueConfig(
        partner_id=state.btp_client_id or data.get("partner_id", ""),
        new_subscription_topic=data.get("subscription_topic", ""),
        # TODO: fill semp_host, vpn_name_uat/prod, queue_name from Key Vault
    )
    try:
        if dry_run:
            _skip("dry-run: skipping Step 4")
            state.record("Step 4 — Solace Queue Patch", "skipped")
            return
        result = step4_solace_queue_patch.run(cfg)
        _ok("Solace queue subscription appended")
        state.record("Step 4 — Solace Queue Patch", "ok")
    except NotImplementedError as e:
        _skip(str(e).splitlines()[0])
        state.record("Step 4 — Solace Queue Patch", "skipped")


def _run_step5(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(5, "Solace Git Feature Branch + input.json")
    cfg = step5_solace_git_input.SolaceGitConfig(
        country_code=data.get("country_code", ""),
        partner_id=state.btp_client_id or data.get("partner_id", ""),
        subscription_topics=data.get("subscription_topics", []),
        enum_version_id=state.solace_enum_version_id,
        event_version_id=state.solace_event_version_id,
        # TODO: fill repo_owner, repo_name, github_pat from Key Vault
    )
    try:
        if dry_run:
            _skip("dry-run: skipping Step 5")
            state.record("Step 5 — Solace Git / input.json", "skipped")
            return
        result = step5_solace_git_input.run(cfg)
        _ok(f"Solace branch + input.json committed: {result.branch_name}")
        state.record("Step 5 — Solace Git / input.json", "ok")
    except NotImplementedError as e:
        _skip(str(e).splitlines()[0])
        state.record("Step 5 — Solace Git / input.json", "skipped")


def _run_step6(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(6, "MuleSoft Feature Branch Creation")
    nav = data.get("nav", {})
    cfg = step6_mule_feature_branch.MuleBranchConfig(
        partner_id=state.btp_client_id or data.get("partner_id", ""),
        country_code=data.get("country_code", data.get("country_key", "")),
        # TODO: fill repo_owner, repo_name, github_pat from Key Vault
    )
    try:
        if dry_run:
            _skip("dry-run: skipping Step 6")
            state.record("Step 6 — Mule Feature Branch", "skipped")
            return
        result = step6_mule_feature_branch.run(cfg)
        state.mule_feature_branch = result.branch_name
        _ok(f"Mule feature branch created: {result.branch_name}")
        state.record("Step 6 — Mule Feature Branch", "ok")
    except NotImplementedError as e:
        _skip(str(e).splitlines()[0])
        state.record("Step 6 — Mule Feature Branch", "skipped")


def _run_steps7_8(data: dict, yaml_path: Path, state: OrchestrationState, dry_run: bool) -> None:
    _banner(7, "MuleSoft YAML Patch + Translation Rows (Steps 7 & 8)")
    errors = patch_config.validate(data)
    if errors:
        for e in errors:
            _err(e)
        state.record("Step 7 — Mule YAML Patch", "error")
        state.record("Step 8 — Translation Rows", "error")
        return

    country_key = data["country_key"]
    if dry_run:
        _skip(f"dry-run: would patch dev.yaml with country '{country_key}'")
        state.record("Step 7 — Mule YAML Patch", "skipped")
        state.record("Step 8 — Translation Rows", "skipped")
        return

    try:
        new_block = patch_config.build_yaml_block(data)
        yaml_text = yaml_path.read_text(encoding="utf-8")
        patched   = patch_config.patch_yaml(yaml_text, country_key, new_block)
        yaml_path.write_text(patched, encoding="utf-8")
        _ok(f"dev.yaml patched with '{country_key}' block")
        state.yaml_diff_summary = new_block
        state.record("Step 7 — Mule YAML Patch", "ok")
    except ValueError as e:
        _err(str(e))
        state.record("Step 7 — Mule YAML Patch", "error")
        return

    OUTPUTS_DIR.mkdir(exist_ok=True)
    rows = patch_config.build_translation_rows(data)
    state.translation_row_count = len(rows)

    xlsx_path = OUTPUTS_DIR / f"{country_key}_translation.xlsx"
    csv_path  = OUTPUTS_DIR / f"{country_key}_translation.csv"
    patch_config.write_excel(rows, str(xlsx_path))
    patch_config.write_csv(rows, str(csv_path))
    _ok(f"Generated {len(rows)} translation rows -> {xlsx_path.name}, {csv_path.name}")
    state.record("Step 8 — Translation Rows", "ok")


def _run_step9(data: dict, state: OrchestrationState, dry_run: bool) -> None:
    _banner(9, "MuleSoft PR + Reviewer Notification")
    cfg = step9_mule_pr_notify.MulePRConfig(
        feature_branch=state.mule_feature_branch,
        country_key=data.get("country_key", ""),
        partner_id=state.btp_client_id or data.get("partner_id", ""),
        yaml_diff_summary=state.yaml_diff_summary,
        translation_row_count=state.translation_row_count,
        # TODO: fill repo_owner, repo_name, github_pat, reviewer, notification from Key Vault
    )
    try:
        if dry_run:
            _skip("dry-run: skipping Step 9")
            state.record("Step 9 — Mule PR + Notify", "skipped")
            return
        result = step9_mule_pr_notify.run(cfg)
        _ok(f"PR raised: {result.pr_url} | Notified: {result.notification_sent}")
        state.record("Step 9 — Mule PR + Notify", "ok")
    except NotImplementedError as e:
        _skip(str(e).splitlines()[0])
        state.record("Step 9 — Mule PR + Notify", "skipped")


def _run_step10(state: OrchestrationState) -> None:
    _banner(10, "SharePoint / Manual Review Gate")
    _manual("Upload translation XLSX to SharePoint TranslationData_TST list.")
    _manual("Verify DEV deployment after MuleSoft PR is merged.")
    _manual("Confirm Solace subscriptions are live in UAT.")
    state.record("Step 10 — SharePoint / Manual Review", "manual")


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="3PL Inbound Onboarding Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
          Steps with NotImplementedError are skipped with a WARN and the run continues.
          Use --dry-run to validate input and preview outputs without writing anything.
        """),
    )
    parser.add_argument("--input", "-i", help="Path to onboarding JSON",
                        default=str(CONFIG_DIR / "sample_onboarding_input.json"))
    parser.add_argument("--yaml", "-y",  help="Path to MuleSoft dev.yaml",
                        default=str(CONFIG_DIR / "dev.yaml"))
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate + preview without making any changes")
    args = parser.parse_args()

    input_path = Path(args.input)
    yaml_path  = Path(args.yaml)

    if not input_path.exists():
        _err(f"Input file not found: {input_path}")
        sys.exit(1)
    if not yaml_path.exists():
        _err(f"YAML file not found: {yaml_path}")
        sys.exit(1)

    with open(input_path, encoding="utf-8") as f:
        data = json.load(f)

    if args.dry_run:
        print(f"\n{C.YELLOW}[DRY-RUN] No files will be written or APIs called.{C.RESET}")

    print(f"\n{C.BOLD}3PL Onboarding Orchestrator{C.RESET}")
    print(f"  Input : {input_path}")
    print(f"  YAML  : {yaml_path}")
    print(f"  Output: {OUTPUTS_DIR}")

    state = OrchestrationState()

    _run_step1(data, state, args.dry_run)
    _run_step2(data, state, args.dry_run)
    _run_step3(data, state, args.dry_run)
    _run_step4(data, state, args.dry_run)
    _run_step5(data, state, args.dry_run)
    _run_step6(data, state, args.dry_run)
    _run_steps7_8(data, yaml_path, state, args.dry_run)
    _run_step9(data, state, args.dry_run)
    _run_step10(state)

    print(state.summary())


if __name__ == "__main__":
    main()
