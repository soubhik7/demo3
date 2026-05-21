"""
Step 9 — MuleSoft Pull Request + Reviewer Notification
========================================================
Status   : TODO
Owner    : Sravani Kare (Contractor)
Blocked on:
  - GitHub repo URL (same as Step 6 — shared together)
  - GitHub PAT or Service Principal (same as Step 6)
  - Reviewer GitHub handle (Sravani's handle or team handle)
  - Notification channel: email / Teams / Slack?
  - Reviewer email address for notification
  - PR description template / checklist (what should the PR body contain?)

What to do when unblocked:
  1. Sravani to confirm: reviewer GitHub handle, email, notification channel
  2. Implement GitHub API call to create the PR
  3. Implement notification (Teams webhook / SMTP / SendGrid)
  4. Replace NotImplementedErrors below

API: GitHub REST API v3
  POST /repos/{owner}/{repo}/pulls  ← raise pull request

Notification options (pick one — TODO: confirm with Sravani):
  A. Email via SMTP relay or Azure Communication Services / SendGrid
  B. Teams webhook (incoming webhook URL)
  C. Slack webhook

Contact: Sravani Kare — reviewer handle, email, notification channel preference
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# TODO: uncomment relevant imports when channel is confirmed
# import requests
# import smtplib                     # Option A: email
# from email.mime.text import MIMEText


# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class MulePRConfig:
    """Fill in when Sravani Kare shares the PR and notification details."""

    # TODO: GitHub repo — same as Step 6 (Sravani Kare to share)
    github_api_base: str = "https://api.github.com"
    repo_owner: str = ""        # TODO: GitHub org
    repo_name: str = ""         # TODO: MuleSoft repo name
    github_pat: str = ""        # TODO: from Key Vault / env var

    # TODO: PR details — Sravani to confirm
    base_branch: str = "dev"    # TODO: PR target branch (dev or main?)
    reviewer_github_handle: str = ""   # TODO: e.g. "skare-contractor"
    pr_label: str = ""          # TODO: optional label (e.g. "3pl-onboarding")

    # TODO: notification — Sravani to choose A/B/C
    notification_channel: str = "email"   # TODO: "email" | "teams" | "slack"
    reviewer_email: str = ""              # TODO: Option A — Sravani's email
    teams_webhook_url: str = ""           # TODO: Option B — Teams incoming webhook
    slack_webhook_url: str = ""           # TODO: Option C — Slack webhook
    smtp_host: str = ""                   # TODO: Option A — SMTP relay host
    smtp_from: str = ""                   # TODO: Option A — sender address

    # Values from onboarding + previous steps
    feature_branch: str = ""    # output of Step 6
    country_key: str = ""
    partner_id: str = ""
    yaml_diff_summary: str = "" # output of Step 7 (YAML block that was added)
    translation_row_count: int = 0       # output of Step 8


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class MulePRResult:
    success: bool
    pr_number: int = 0
    pr_url: str = ""
    notification_sent: bool = False
    error: Optional[str] = None


# ── Helpers (stubs) ──────────────────────────────────────────────────────────

def _build_pr_body(config: MulePRConfig) -> str:
    """Build the pull request description from onboarding metadata."""
    # TODO: confirm with Sravani what the PR body should contain
    return f"""## 3PL Onboarding — {config.country_key.title()} ({config.partner_id})

### Changes
- Added `{config.country_key}` country block to `dev.yaml`
- Generated {config.translation_row_count} translation table rows

### YAML block added
```yaml
{config.yaml_diff_summary}
```

### Checklist
- [ ] YAML indentation matches existing entries (3-space)
- [ ] Transaction types verified with business team
- [ ] Translation rows imported into SharePoint `TranslationData_TST` list
- [ ] DEV deployment verified after merge

---
*Raised automatically by 3PL Onboarding Automation*
"""


def _create_pull_request(config: MulePRConfig) -> dict:
    """TODO: POST to GitHub API to create the pull request."""
    # TODO:
    # url = f"{config.github_api_base}/repos/{config.repo_owner}/{config.repo_name}/pulls"
    # headers = {"Authorization": f"token {config.github_pat}", "Accept": "application/vnd.github+json"}
    # payload = {
    #     "title": f"feat: 3PL onboarding {config.partner_id} - {config.country_key}",
    #     "head": config.feature_branch,
    #     "base": config.base_branch,
    #     "body": _build_pr_body(config),
    # }
    # if config.reviewer_github_handle:
    #     # POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
    #     ...
    # response = requests.post(url, json=payload, headers=headers)
    # response.raise_for_status()
    # return response.json()
    raise NotImplementedError("Create PR — GitHub repo + PAT + reviewer handle needed from Sravani Kare")


def _send_email_notification(pr_url: str, config: MulePRConfig) -> None:
    """TODO: Option A — send email notification to reviewer."""
    # TODO: confirm SMTP host/credentials with DevOps/Azure team
    # subject = f"[Action Required] 3PL Onboarding PR — {config.country_key.title()}"
    # body = f"A new onboarding PR has been raised:\n{pr_url}\n\nPlease review and merge to deploy to DEV."
    # msg = MIMEText(body)
    # msg["Subject"] = subject
    # msg["From"] = config.smtp_from
    # msg["To"] = config.reviewer_email
    # with smtplib.SMTP(config.smtp_host) as server:
    #     server.sendmail(config.smtp_from, [config.reviewer_email], msg.as_string())
    raise NotImplementedError("Email notification — SMTP details + reviewer email needed from Sravani / DevOps")


def _send_teams_notification(pr_url: str, config: MulePRConfig) -> None:
    """TODO: Option B — post Teams adaptive card to incoming webhook."""
    # TODO: confirm Teams webhook URL with Sravani
    # payload = {
    #     "@type": "MessageCard",
    #     "summary": f"3PL Onboarding PR — {config.country_key}",
    #     "text": f"New onboarding PR ready for review: [{config.country_key}]({pr_url})"
    # }
    # response = requests.post(config.teams_webhook_url, json=payload)
    # response.raise_for_status()
    raise NotImplementedError("Teams notification — webhook URL needed from Sravani Kare")


def _send_slack_notification(pr_url: str, config: MulePRConfig) -> None:
    """TODO: Option C — post Slack message to webhook."""
    # TODO: confirm Slack webhook URL with Sravani
    # payload = {"text": f":pr: New 3PL onboarding PR ready: <{pr_url}|{config.country_key}>"}
    # response = requests.post(config.slack_webhook_url, json=payload)
    # response.raise_for_status()
    raise NotImplementedError("Slack notification — webhook URL needed from Sravani Kare")


# ── Main ─────────────────────────────────────────────────────────────────────

def run(config: MulePRConfig) -> MulePRResult:
    """
    Execute Step 9: Raise GitHub PR + notify Mule reviewer.

    TODO: Implement when Sravani Kare provides:
      - GitHub repo URL + PAT (if not already done for Step 6)
      - Reviewer GitHub handle for PR assignment
      - Notification channel choice (email / Teams / Slack)
      - Reviewer email address
      - PR description template / checklist (confirm what should be included)
    """
    # TODO: Step 9 implementation
    # pr_data = _create_pull_request(config)
    # pr_url  = pr_data["html_url"]
    # pr_num  = pr_data["number"]
    #
    # if config.notification_channel == "email":
    #     _send_email_notification(pr_url, config)
    # elif config.notification_channel == "teams":
    #     _send_teams_notification(pr_url, config)
    # elif config.notification_channel == "slack":
    #     _send_slack_notification(pr_url, config)
    #
    # return MulePRResult(success=True, pr_number=pr_num, pr_url=pr_url, notification_sent=True)

    raise NotImplementedError(
        "Step 9 (PR + notify) not yet implemented.\n"
        "Blocked on: GitHub repo URL + PAT + reviewer handle + notification channel from Sravani Kare."
    )
