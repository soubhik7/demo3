/**
 * Step 6 — MuleSoft Feature Branch Creation
 * ============================================
 * Status    : TODO
 * Owner     : Sravani Kare (Contractor) + DevOps Team
 * Blocked on:
 *   - GitHub repository URL for the MuleSoft project
 *   - Base branch name (dev or main?)
 *   - Branch naming convention
 *   - Azure Service Principal or GitHub App with branch-create rights on the Mule repo
 *
 * API: GitHub REST API v3
 *   GET  /repos/{owner}/{repo}/git/ref/heads/{base}  ← get base branch SHA
 *   POST /repos/{owner}/{repo}/git/refs              ← create new branch
 *
 * Note: Steps 7+8 (YAML patch + translation rows) are DONE.
 *       Step 6 creates the branch that Steps 7+8 commit to.
 *       Step 9 raises the PR after Steps 7+8 write the files.
 *
 * Contact: Sravani Kare (repo URL, branch convention) + DevOps (Service Principal)
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface MuleBranchConfig {
  /** GitHub API base. Default: https://api.github.com */
  githubApiBase: string;
  /** TODO: GitHub org — Sravani Kare to confirm */
  repoOwner: string;
  /** TODO: MuleSoft repo name — Sravani Kare to share */
  repoName: string;
  /** TODO: PR target branch — confirm with Sravani ("dev" or "main"?) */
  baseBranch: string;
  /**
   * TODO: GitHub PAT or Azure Service Principal token — DevOps to provision.
   * NEVER hard-code — read from Key Vault or environment variable.
   */
  githubPat: string;

  /** Branch naming prefix — e.g. "feature/3pl-onboard" */
  branchPrefix: string;

  /** Values from onboarding input + Step 1 output */
  partnerId: string;   // BTP ClientID (output of Step 1)
  countryCode: string;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface MuleBranchResult {
  success: boolean;
  /** Created branch name — passed to Step 9 for the PR */
  branchName: string;
  /** HEAD SHA of the newly created branch */
  branchSha: string;
  error?: string;
}

// ── Helpers (stubs) ───────────────────────────────────────────────────────────

function _authHeaders(config: MuleBranchConfig): Record<string, string> {
  return {
    Authorization: `token ${config.githubPat}`,
    Accept: "application/vnd.github+json",
  };
}

/** TODO: GET the SHA of the base branch HEAD. */
async function _getBaseSha(_config: MuleBranchConfig): Promise<string> {
  // TODO: GET ${githubApiBase}/repos/${repoOwner}/${repoName}/git/ref/heads/${baseBranch}
  throw new Error(
    "Step 6: getBaseSha — GitHub repo URL + PAT needed (Sravani Kare + DevOps)"
  );
}

/** TODO: POST to create the new feature branch from the base branch SHA. */
async function _createBranch(
  _sha: string,
  _branchName: string,
  _config: MuleBranchConfig
): Promise<void> {
  // TODO: POST ${githubApiBase}/repos/${repoOwner}/${repoName}/git/refs
  // body: { ref: `refs/heads/${branchName}`, sha }
  throw new Error(
    "Step 6: createBranch — GitHub repo URL + PAT needed (Sravani Kare + DevOps)"
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 6: Create MuleSoft feature branch from dev/main.
 *
 * TODO: Implement when Sravani Kare + DevOps provide:
 *   - GitHub repo URL (owner + name)
 *   - Base branch name (dev or main)
 *   - Branch naming convention
 *   - Azure Service Principal or GitHub PAT with branch-create rights
 *
 * Output: branchName is passed to Step 9 for the pull request.
 * Branch name will be: {branchPrefix}-{partnerId}-{countryCode}
 * e.g.: feature/3pl-onboard-petc-rc-navision-spl-france
 */
export async function run(_config: MuleBranchConfig): Promise<MuleBranchResult> {
  // TODO: Step 6 implementation
  // const branchName = `${config.branchPrefix}-${config.partnerId}-${config.countryCode}`
  // const sha        = await _getBaseSha(config)
  // await _createBranch(sha, branchName, config)
  // return { success: true, branchName, branchSha: sha }

  throw new Error(
    "Step 6 (Mule Feature Branch) not yet implemented.\n" +
      "Blocked on: GitHub repo URL from Sravani Kare;\n" +
      "Azure Service Principal / GitHub PAT from DevOps Team."
  );
}
