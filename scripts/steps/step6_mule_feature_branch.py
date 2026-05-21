"""
Step 6 — MuleSoft Feature Branch Creation
==========================================
Status   : TODO
Owner    : Sravani Kare (Contractor) + DevOps Team
Blocked on:
  - GitHub repository URL for the MuleSoft project
  - Base branch name (dev or main?)
  - Branch naming convention
  - Azure Service Principal or GitHub App with branch-create rights on the Mule repo

What to do when unblocked:
  1. Sravani to confirm: repo URL, base branch, branch naming pattern
  2. DevOps to provision: Azure Service Principal (or GitHub App) with repo write access
     and share the PAT / client credentials
  3. Store credentials in Key Vault (never in code)
  4. Replace NotImplementedError below with real GitHub API call

API: GitHub REST API v3
  GET  /repos/{owner}/{repo}/git/ref/heads/{base}  ← get base branch SHA
  POST /repos/{owner}/{repo}/git/refs              ← create new branch

Note: Steps 7 + 8 (YAML patch + translation rows) are DONE.
      Step 6 creates the branch that Steps 7+8 commit to.
      Step 9 raises the PR after Steps 7+8 write the files.

Contact: Sravani Kare (repo URL, branch convention) + DevOps (Service Principal)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# TODO: uncomment when HTTP calls are ready
# import requests


# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class MuleBranchConfig:
    """Fill in when Sravani Kare + DevOps share the repo and credential details."""

    # TODO: GitHub repo details — Sravani Kare to confirm
    github_api_base: str = "https://api.github.com"
    repo_owner: str = ""     # TODO: GitHub org (e.g. "mars-global")
    repo_name: str = ""      # TODO: MuleSoft repo name (Sravani to share)
    base_branch: str = "dev" # TODO: confirm with Sravani — is it "dev" or "main"?

    # TODO: Azure Service Principal / GitHub PAT — DevOps to provision
    # NEVER hard-code this — read from Key Vault or environment variable
    github_pat: str = ""     # TODO: os.environ["GITHUB_PAT"] or Key Vault lookup

    # Branch naming — TODO: confirm pattern with Sravani
    branch_prefix: str = "feature/3pl-onboard"  # e.g. feature/3pl-onboard-spl-france

    # Values from onboarding input
    partner_id: str = ""      # BTP ClientID
    country_code: str = ""    # ISO country code


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class MuleBranchResult:
    success: bool
    branch_name: str = ""
    branch_sha: str = ""
    error: Optional[str] = None


# ── Helpers (stubs) ──────────────────────────────────────────────────────────

def _get_base_sha(config: MuleBranchConfig) -> str:
    """TODO: GET SHA of the base branch HEAD."""
    # TODO:
    # url = f"{config.github_api_base}/repos/{config.repo_owner}/{config.repo_name}/git/ref/heads/{config.base_branch}"
    # headers = {"Authorization": f"token {config.github_pat}", "Accept": "application/vnd.github+json"}
    # response = requests.get(url, headers=headers)
    # response.raise_for_status()
    # return response.json()["object"]["sha"]
    raise NotImplementedError("GET base branch SHA — repo URL + PAT needed (Sravani Kare + DevOps)")


def _create_branch(sha: str, branch_name: str, config: MuleBranchConfig) -> None:
    """TODO: POST to create the new feature branch."""
    # TODO:
    # url = f"{config.github_api_base}/repos/{config.repo_owner}/{config.repo_name}/git/refs"
    # headers = {"Authorization": f"token {config.github_pat}", "Accept": "application/vnd.github+json"}
    # payload = {"ref": f"refs/heads/{branch_name}", "sha": sha}
    # response = requests.post(url, json=payload, headers=headers)
    # response.raise_for_status()
    raise NotImplementedError("Create Mule feature branch — repo URL + PAT needed (Sravani Kare + DevOps)")


# ── Main ─────────────────────────────────────────────────────────────────────

def run(config: MuleBranchConfig) -> MuleBranchResult:
    """
    Execute Step 6: Create MuleSoft feature branch from dev/main.

    TODO: Implement when Sravani Kare + DevOps provide:
      - GitHub repo URL (owner + name)
      - Base branch name (dev or main)
      - Branch naming convention
      - Azure Service Principal or GitHub PAT with branch-create rights

    Branch name will be: {branch_prefix}-{partner_id}-{country_code}
    e.g.: feature/3pl-onboard-petc-rc-navision-spl-france
    """
    # TODO: Step 6 implementation
    # branch_name = f"{config.branch_prefix}-{config.partner_id}-{config.country_code}"
    # sha         = _get_base_sha(config)
    # _create_branch(sha, branch_name, config)
    # return MuleBranchResult(success=True, branch_name=branch_name, branch_sha=sha)

    raise NotImplementedError(
        "Step 6 (Mule Feature Branch) not yet implemented.\n"
        "Blocked on: GitHub repo URL from Sravani Kare;\n"
        "Azure Service Principal / GitHub PAT from DevOps Team."
    )
