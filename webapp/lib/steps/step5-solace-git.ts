/**
 * Step 5 — Solace Git Feature Branch + input.json Commit
 * ========================================================
 * Status    : Implemented (repo details + input.json schema still pending from Rohini)
 * Owner     : Rohini Mondal (Solace Team) + DevOps Team
 *
 * Activation: set these env vars (or pass via form input.github + input.solace):
 *   GITHUB_PAT                 — PAT or Azure Service Principal token (repo write access)
 *   SOLACE_GITHUB_REPO_OWNER   — GitHub org/owner of Solace config repo
 *   SOLACE_GITHUB_REPO_NAME    — Solace config repo name
 *   SOLACE_GITHUB_BASE_BRANCH  — Branch to branch from (default: dev)
 *   SOLACE_INPUT_JSON_PATH     — Path to input.json inside the repo
 *
 * Confluence (manual process today):
 *   https://marsaoh.atlassian.net/wiki/spaces/IH/pages/4731961464/
 *   Solace+Event+Broker+GitHub+Action+Pipeline#RDP
 *
 * GitHub API v3 calls:
 *   GET  /repos/{owner}/{repo}/git/ref/heads/{base}    → get base branch SHA
 *   POST /repos/{owner}/{repo}/git/refs                → create feature branch
 *   GET  /repos/{owner}/{repo}/contents/{path}         → get existing file SHA (update flow)
 *   PUT  /repos/{owner}/{repo}/contents/{path}         → commit input.json
 *
 * Branch name: feature/solace-{partnerId}-{countryCode}
 *
 * NOTE: input.json schema is based on the known manual process. Confirm exact
 *       field names with Rohini Mondal once the Confluence RDP schema is shared.
 */

const GH_API = "https://api.github.com";

// ── Config ────────────────────────────────────────────────────────────────────

export interface SolaceGitConfig {
  githubApiBase:  string;
  repoOwner:      string;
  repoName:       string;
  baseBranch:     string;
  githubPat:      string;
  inputJsonPath:  string;
  countryCode:    string;
  partnerId:      string;
  subscriptionTopics: string[];
  /** Output of Step 3 — passed in by orchestrator state */
  enumVersionId:  string;
  /** Output of Step 3 — passed in by orchestrator state */
  eventVersionId: string;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface SolaceGitResult {
  success:        boolean;
  branchCreated:  boolean;
  branchName:     string;
  fileCommitted:  boolean;
  commitSha:      string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _ghHeaders(pat: string): Record<string, string> {
  return {
    Authorization: `token ${pat}`,
    Accept:        "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function _ghGet(url: string, pat: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, { headers: _ghHeaders(pat) });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub GET ${url} → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function _ghPost(url: string, pat: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { ..._ghHeaders(pat), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub POST ${url} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function _ghPut(url: string, pat: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { ..._ghHeaders(pat), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub PUT ${url} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

/** Build the input.json payload.
 *
 * Schema is based on the Solace GitHub Actions pipeline (Confluence RDP page).
 * Key names prefixed with TODO comments should be confirmed with Rohini Mondal.
 */
function _buildInputJson(cfg: SolaceGitConfig): object {
  return {
    // Core partner identifiers
    partnerID:          cfg.partnerId,       // BTP ClientID = receiver_name
    countryCode:        cfg.countryCode,

    // Subscription topics for this partner/country
    subscriptionTopics: cfg.subscriptionTopics.filter(t => t.trim()),

    // Version IDs from Step 3 (empty string if Step 3 was skipped)
    enumVersionId:      cfg.enumVersionId  || undefined,
    eventVersionId:     cfg.eventVersionId || undefined,

    // Metadata
    createdAt: new Date().toISOString(),
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function _getBaseSha(cfg: SolaceGitConfig): Promise<string> {
  const apiBase = cfg.githubApiBase || GH_API;
  const url     = `${apiBase}/repos/${cfg.repoOwner}/${cfg.repoName}/git/ref/heads/${cfg.baseBranch}`;
  const resp    = await _ghGet(url, cfg.githubPat);
  if (!resp) throw new Error(`Step 5: base branch '${cfg.baseBranch}' not found in ${cfg.repoOwner}/${cfg.repoName}.`);
  const sha = ((resp.object as Record<string, unknown>)?.sha as string) ?? '';
  if (!sha) throw new Error(`Step 5: could not read SHA from branch ref response.`);
  return sha;
}

async function _createBranch(sha: string, branchName: string, cfg: SolaceGitConfig): Promise<void> {
  const apiBase = cfg.githubApiBase || GH_API;
  const url     = `${apiBase}/repos/${cfg.repoOwner}/${cfg.repoName}/git/refs`;
  await _ghPost(url, cfg.githubPat, { ref: `refs/heads/${branchName}`, sha });
}

async function _getExistingFileSha(path: string, branchName: string, cfg: SolaceGitConfig): Promise<string | null> {
  const apiBase = cfg.githubApiBase || GH_API;
  const url     = `${apiBase}/repos/${cfg.repoOwner}/${cfg.repoName}/contents/${path}?ref=${encodeURIComponent(branchName)}`;
  const resp    = await _ghGet(url, cfg.githubPat);
  return resp ? (resp.sha as string) ?? null : null;
}

async function _commitInputJson(
  branchName: string,
  content:    object,
  cfg:        SolaceGitConfig
): Promise<string> {
  const apiBase     = cfg.githubApiBase || GH_API;
  const path        = cfg.inputJsonPath || 'config/input.json';
  const url         = `${apiBase}/repos/${cfg.repoOwner}/${cfg.repoName}/contents/${path}`;
  const existingSha = await _getExistingFileSha(path, branchName, cfg);

  const body: Record<string, unknown> = {
    message: `feat(solace): add config for ${cfg.countryCode.toUpperCase()} — ${cfg.partnerId}`,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    branch:  branchName,
  };
  if (existingSha) body.sha = existingSha;

  const resp    = await _ghPut(url, cfg.githubPat, body);
  const commit  = resp.commit as Record<string, unknown> | undefined;
  return (commit?.sha as string) ?? '';
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 5: Create Solace config feature branch and commit input.json.
 *
 * Returns early with "not yet implemented" (→ skipped in orchestrator) when
 * required credentials have not been configured.
 */
export async function run(cfg: SolaceGitConfig): Promise<SolaceGitResult> {
  if (!cfg.githubPat || !cfg.repoOwner || !cfg.repoName) {
    throw new Error(
      "not yet implemented — Step 5 requires GITHUB_PAT, SOLACE_GITHUB_REPO_OWNER, " +
      "SOLACE_GITHUB_REPO_NAME from Rohini Mondal + DevOps Team."
    );
  }

  const branchName = `feature/solace-${cfg.partnerId}-${cfg.countryCode}`.toLowerCase().replace(/[^a-z0-9/._-]/g, '-');

  const sha = await _getBaseSha(cfg);
  await _createBranch(sha, branchName, cfg);

  const inputJson = _buildInputJson(cfg);
  const commitSha = await _commitInputJson(branchName, inputJson, cfg);

  return {
    success:       true,
    branchCreated: true,
    branchName,
    fileCommitted: true,
    commitSha,
  };
}
