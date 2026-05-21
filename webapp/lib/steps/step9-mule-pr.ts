/**
 * Step 9 — MuleSoft Pull Request + Reviewer Notification
 * =========================================================
 * Status    : TODO
 * Owner     : Sravani Kare (Contractor)
 * Blocked on:
 *   - GitHub repo URL (same as Step 6 — shared together)
 *   - GitHub PAT or Service Principal (same as Step 6)
 *   - Reviewer GitHub handle (Sravani's handle or team handle)
 *   - Notification channel: email / Teams / Slack?
 *   - Reviewer email address for notification
 *   - PR description template / checklist (confirm with Sravani)
 *
 * API: GitHub REST API v3
 *   POST /repos/{owner}/{repo}/pulls  ← raise pull request
 *   POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
 *
 * Notification options (pick one — TODO: confirm with Sravani):
 *   A. Email via SMTP relay or Azure Communication Services / SendGrid
 *   B. Teams incoming webhook
 *   C. Slack webhook
 *
 * Contact: Sravani Kare — reviewer handle, email, notification channel preference
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface MulePRConfig {
  /** GitHub API base. Default: https://api.github.com */
  githubApiBase: string;
  /** TODO: GitHub org — same as Step 6 */
  repoOwner: string;
  /** TODO: MuleSoft repo name — same as Step 6 */
  repoName: string;
  /** TODO: GitHub PAT / Service Principal token — same as Step 6, from Key Vault */
  githubPat: string;

  /** TODO: PR target branch — confirm with Sravani ("dev" or "main"?) */
  baseBranch: string;
  /** TODO: Reviewer GitHub handle — Sravani to provide (e.g. "skare-contractor") */
  reviewerGithubHandle: string;
  /** TODO: Optional label to apply to the PR (e.g. "3pl-onboarding") */
  prLabel: string;

  /** TODO: Notification channel — Sravani to choose: "email" | "teams" | "slack" */
  notificationChannel: "email" | "teams" | "slack";
  /** TODO: Option A — reviewer's email address */
  reviewerEmail: string;
  /** TODO: Option A — SMTP relay host */
  smtpHost: string;
  /** TODO: Option A — sender email address */
  smtpFrom: string;
  /** TODO: Option B — Teams incoming webhook URL */
  teamsWebhookUrl: string;
  /** TODO: Option C — Slack webhook URL */
  slackWebhookUrl: string;

  /** Values from onboarding + previous steps */
  featureBranch: string;     // output of Step 6
  countryKey: string;
  partnerId: string;
  yamlDiffSummary: string;   // YAML block added in Step 7
  translationRowCount: number; // output of Step 8
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface MulePRResult {
  success: boolean;
  prNumber: number;
  prUrl: string;
  notificationSent: boolean;
  error?: string;
}

// ── Helpers (stubs) ───────────────────────────────────────────────────────────

/** Build the pull request description from onboarding metadata. */
function _buildPrBody(config: MulePRConfig): string {
  // TODO: confirm with Sravani what the PR body should contain
  return `## 3PL Onboarding — ${config.countryKey.charAt(0).toUpperCase() + config.countryKey.slice(1)} (${config.partnerId})

### Changes
- Added \`${config.countryKey}\` country block to \`dev.yaml\`
- Generated ${config.translationRowCount} translation table rows

### YAML block added
\`\`\`yaml
${config.yamlDiffSummary}
\`\`\`

### Checklist
- [ ] YAML indentation matches existing entries (3-space)
- [ ] Transaction types verified with business team
- [ ] Translation rows imported into SharePoint \`TranslationData_TST\` list
- [ ] DEV deployment verified after merge

---
*Raised automatically by 3PL Onboarding Automation*
`;
}

function _authHeaders(config: MulePRConfig): Record<string, string> {
  return {
    Authorization: `token ${config.githubPat}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

/** TODO: POST to GitHub API to create the pull request. */
async function _createPullRequest(
  _config: MulePRConfig
): Promise<{ prNumber: number; prUrl: string }> {
  // TODO:
  // const url = `${config.githubApiBase}/repos/${config.repoOwner}/${config.repoName}/pulls`
  // const payload = {
  //   title: `feat: 3PL onboarding ${config.partnerId} - ${config.countryKey}`,
  //   head: config.featureBranch,
  //   base: config.baseBranch,
  //   body: _buildPrBody(config),
  // }
  // const res = await fetch(url, { method: 'POST', headers: _authHeaders(config), body: JSON.stringify(payload) })
  // const data = await res.json()
  // if (config.reviewerGithubHandle) {
  //   await fetch(`${url}/${data.number}/requested_reviewers`, {
  //     method: 'POST',
  //     headers: _authHeaders(config),
  //     body: JSON.stringify({ reviewers: [config.reviewerGithubHandle] }),
  //   })
  // }
  // return { prNumber: data.number, prUrl: data.html_url }
  throw new Error(
    "Step 9: createPullRequest — GitHub repo + PAT + reviewer handle needed from Sravani Kare"
  );
}

/** TODO: Option A — send email notification to reviewer via SMTP. */
async function _sendEmailNotification(_prUrl: string, _config: MulePRConfig): Promise<void> {
  // TODO: use nodemailer or Azure Communication Services to send email
  // subject: `[Action Required] 3PL Onboarding PR — ${countryKey}`
  // body: "A new onboarding PR has been raised: ${prUrl}\nPlease review and merge to deploy to DEV."
  throw new Error(
    "Step 9: sendEmailNotification — SMTP details + reviewer email needed from Sravani / DevOps"
  );
}

/** TODO: Option B — post Teams Adaptive Card to incoming webhook. */
async function _sendTeamsNotification(_prUrl: string, _config: MulePRConfig): Promise<void> {
  // TODO: POST to config.teamsWebhookUrl with MessageCard payload
  throw new Error(
    "Step 9: sendTeamsNotification — Teams webhook URL needed from Sravani Kare"
  );
}

/** TODO: Option C — post Slack message to webhook. */
async function _sendSlackNotification(_prUrl: string, _config: MulePRConfig): Promise<void> {
  // TODO: POST to config.slackWebhookUrl with { text: "..." } payload
  throw new Error(
    "Step 9: sendSlackNotification — Slack webhook URL needed from Sravani Kare"
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 9: Raise GitHub PR + notify Mule reviewer.
 *
 * TODO: Implement when Sravani Kare provides:
 *   - GitHub repo URL + PAT (if not already done for Step 6)
 *   - Reviewer GitHub handle for PR assignment
 *   - Notification channel choice (email / Teams / Slack)
 *   - Reviewer email address
 *   - PR description template / checklist
 */
export async function run(_config: MulePRConfig): Promise<MulePRResult> {
  // TODO: Step 9 implementation
  // const { prNumber, prUrl } = await _createPullRequest(config)
  //
  // if (config.notificationChannel === "email") {
  //   await _sendEmailNotification(prUrl, config)
  // } else if (config.notificationChannel === "teams") {
  //   await _sendTeamsNotification(prUrl, config)
  // } else if (config.notificationChannel === "slack") {
  //   await _sendSlackNotification(prUrl, config)
  // }
  //
  // return { success: true, prNumber, prUrl, notificationSent: true }

  throw new Error(
    "Step 9 (PR + notify) not yet implemented.\n" +
      "Blocked on: GitHub repo URL + PAT + reviewer handle + notification channel from Sravani Kare."
  );
}
