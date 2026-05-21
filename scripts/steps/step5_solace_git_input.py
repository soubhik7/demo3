"""
Step 5 — Solace Git Feature Branch + input.json Population
============================================================
Status   : TODO
Owner    : Rohini Mondal (Solace Team) + DevOps Team
Blocked on:
  - GitHub repository URL for the Solace config repo
  - Branch naming convention
  - Exact file path(s) to update inside the repo
  - input.json schema and sample file
  - Azure Service Principal (or GitHub App) with branch-create rights
  - GitHub Actions pipeline name and its required inputs

Confluence reference (manual process today):
  https://marsaoh.atlassian.net/wiki/spaces/IH/pages/4731961464/
  Solace+Event+Broker+GitHub+Action+Pipeline#RDP

What to do when unblocked:
  1. Rohini to share: repo URL, file path, branch naming, input.json schema + sample
  2. DevOps to provision: Azure Service Principal or GitHub App with repo write access
  3. Map onboarding JSON fields → input.json fields
  4. Implement: create branch → write input.json → commit → trigger pipeline (if applicable)
  5. Replace NotImplementedErrors below

API: GitHub REST API v3
  POST /repos/{owner}/{repo}/git/refs         ← create branch
  PUT  /repos/{owner}/{repo}/contents/{path}  ← create/update file

Contact: Rohini Mondal + DevOps Team
"""
from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field
from typing import Optional

# TODO: uncomment when HTTP calls are ready
# import requests


# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class SolaceGitConfig:
    """Fill in when Rohini + DevOps share the repo and credential details."""

    # TODO: GitHub repo details — Rohini to confirm
    github_api_base: str = "https://api.github.com"
    repo_owner: str = ""           # TODO: GitHub org/user
    repo_name: str = ""            # TODO: Solace config repo name
    base_branch: str = "dev"       # TODO: confirm base branch name with Rohini

    # TODO: Azure Service Principal / GitHub PAT — DevOps to provision
    github_pat: str = ""           # TODO: store in Key Vault, not in code

    # TODO: file path inside repo — Rohini to confirm
    input_json_path: str = ""      # TODO: e.g. "config/input.json" or "solace/partner-config.json"

    # Branch naming — TODO: confirm convention with Rohini
    branch_prefix: str = "feature/solace-onboard"  # TODO: confirm naming pattern

    # Values from onboarding input
    country_code: str = ""
    partner_id: str = ""           # BTP ClientID
    subscription_topics: list = field(default_factory=list)
    enum_version_id: str = ""      # from Step 3 output
    event_version_id: str = ""     # from Step 3 output


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class SolaceGitResult:
    success: bool
    branch_created: bool = False
    branch_name: str = ""
    file_committed: bool = False
    commit_sha: str = ""
    error: Optional[str] = None


# ── input.json builder (stub) ────────────────────────────────────────────────

def _build_input_json(config: SolaceGitConfig) -> dict:
    """
    TODO: Build the input.json payload from onboarding config.

    Schema TBD — Rohini to share sample input.json from the manual process.
    The manual steps are documented at the Confluence RDP page.

    Currently using a placeholder structure based on known fields.
    Replace with real schema once Rohini confirms.
    """
    # TODO: confirm all field names and structure with Rohini Mondal
    return {
        # TODO: verify field names match what the GitHub Actions pipeline expects
        "partnerID":          config.partner_id,         # TODO: confirm key name
        "countryCode":        config.country_code,        # TODO: confirm key name
        "subscriptionTopics": config.subscription_topics, # TODO: confirm structure
        "enumVersionId":      config.enum_version_id,     # TODO: needed? confirm
        "eventVersionId":     config.event_version_id,    # TODO: needed? confirm
        # TODO: add other fields once Rohini shares the full schema
    }


# ── Helpers (stubs) ──────────────────────────────────────────────────────────

def _get_branch_sha(config: SolaceGitConfig) -> str:
    """TODO: GET the SHA of the base branch HEAD (needed to create new branch)."""
    # TODO:
    # url = f"{config.github_api_base}/repos/{config.repo_owner}/{config.repo_name}/git/ref/heads/{config.base_branch}"
    # headers = {"Authorization": f"token {config.github_pat}", "Accept": "application/vnd.github+json"}
    # response = requests.get(url, headers=headers)
    # response.raise_for_status()
    # return response.json()["object"]["sha"]
    raise NotImplementedError("GET branch SHA — repo details + PAT needed (Rohini + DevOps)")


def _create_branch(sha: str, branch_name: str, config: SolaceGitConfig) -> None:
    """TODO: POST to create the new feature branch from base branch SHA."""
    # TODO:
    # url = f"{config.github_api_base}/repos/{config.repo_owner}/{config.repo_name}/git/refs"
    # headers = {"Authorization": f"token {config.github_pat}", "Accept": "application/vnd.github+json"}
    # payload = {"ref": f"refs/heads/{branch_name}", "sha": sha}
    # response = requests.post(url, json=payload, headers=headers)
    # response.raise_for_status()
    raise NotImplementedError("Create branch — repo details + PAT needed (Rohini + DevOps)")


def _commit_input_json(branch_name: str, content: dict, config: SolaceGitConfig) -> str:
    """TODO: PUT input.json content to the new feature branch."""
    # TODO:
    # encoded = base64.b64encode(json.dumps(content, indent=2).encode()).decode()
    # url = f"{config.github_api_base}/repos/{config.repo_owner}/{config.repo_name}/contents/{config.input_json_path}"
    # headers = {"Authorization": f"token {config.github_pat}", "Accept": "application/vnd.github+json"}
    # payload = {
    #     "message": f"feat: Solace onboarding {config.partner_id} - {config.country_code}",
    #     "content": encoded,
    #     "branch": branch_name,
    # }
    # response = requests.put(url, json=payload, headers=headers)
    # response.raise_for_status()
    # return response.json()["commit"]["sha"]
    raise NotImplementedError("Commit input.json — repo details + PAT + file path needed (Rohini + DevOps)")


# ── Main ─────────────────────────────────────────────────────────────────────

def run(config: SolaceGitConfig) -> SolaceGitResult:
    """
    Execute Step 5: Create feature branch + commit input.json for Solace pipeline.

    TODO: Implement when Rohini Mondal + DevOps provide:
      - GitHub repo URL (owner + name)
      - Exact file path for input.json inside the repo
      - input.json schema (sample from manual process at Confluence RDP page)
      - Azure Service Principal or GitHub PAT with write access to repo
      - Base branch name (dev / main)
      - Branch naming convention
    """
    # TODO: Step 5 implementation
    # branch_name = f"{config.branch_prefix}-{config.partner_id}-{config.country_code}"
    # sha         = _get_branch_sha(config)
    # _create_branch(sha, branch_name, config)
    # content     = _build_input_json(config)
    # commit_sha  = _commit_input_json(branch_name, content, config)
    # return SolaceGitResult(success=True, branch_created=True, branch_name=branch_name,
    #                         file_committed=True, commit_sha=commit_sha)

    raise NotImplementedError(
        "Step 5 (Solace Git / input.json) not yet implemented.\n"
        "Blocked on: repo URL + file path + input.json schema from Rohini Mondal;\n"
        "Azure Service Principal from DevOps Team."
    )
