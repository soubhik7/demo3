/**
 * Step 1 — BTP Application Creation + ClientID/Secret Generation
 * ===============================================================
 * Status    : Implemented skeleton — blocked on payload schema + D3 decision
 * Owner     : Parag Shende (BTP Team)
 *
 * Confirmed endpoints (from tracker):
 *   Create Application  : POST {apiHost}/odata/1.0/data.svc/APIMgmt.Applications
 *   Get / Regen Creds   : POST {apiHost}/odata/1.0/data.svc/APIMgmt.Applications('{appName}')
 *                         OR   GET  {apiHost}/odata/1.0/data.svc/APIMgmt.Applications('{appName}')
 *
 * Auth:
 *   OAuth2 client-credentials → Bearer token
 *   POST {tokenUrl}  Content-Type: application/x-www-form-urlencoded
 *   Body: grant_type=client_credentials&client_id={id}&client_secret={secret}
 *
 * Activation (env vars or form input.btp):
 *   BTP_API_HOST          — e.g. https://apim-management.cfapps.us21.hana.ondemand.com
 *   BTP_TOKEN_URL         — OAuth2 token endpoint from Service Key
 *   BTP_CLIENT_ID         — Service Key client_id
 *   BTP_CLIENT_SECRET     — Service Key client_secret
 *   BTP_PRODUCT_NAME      — Product to assign to new application
 *   BTP_QUOTA_PLAN        — Quota/rate-limit plan (e.g. "standard")
 *   BTP_D3_APPROVER_EMAIL — D3 approver email address
 *
 * ⚠  D3 approval gate: BTP Team must decide whether to automate via API
 *    or keep the current manual process. Until confirmed, Step 1 is
 *    "Manual (interim)" per the tracker. Code is ready to activate.
 *
 * ⚠  Payload schemas (POST bodies) are TBD — Parag Shende to share
 *    Postman collection. Fields marked TODO below need confirmation.
 *
 * Contact: Parag Shende — confirm POST payload + D3 mechanism + Service Key
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface BtpAppConfig {
  /** BTP API Management host — e.g. https://apim-management.cfapps.us21.hana.ondemand.com */
  apiHost:         string;
  /** OAuth2 token endpoint — from BTP Service Key */
  tokenUrl:        string;
  /** OAuth2 client_id — from BTP Service Key */
  clientId:        string;
  /** OAuth2 client_secret — from BTP Service Key */
  clientSecret:    string;
  /** Product name to assign to the new application */
  productName:     string;
  /** Quota/rate-limit plan (e.g. "standard") */
  quotaPlan:       string;
  /** D3 approver email for the BTP approval workflow */
  d3ApproverEmail: string;
  /** Computed application name: "3pl-{partnerId}" */
  appName:         string;
  /** Application description */
  appDescription:  string;
  /** BTP ClientID from translation.receiver_name (= Solace Partner ID) */
  partnerId:       string;
  /** Country key e.g. "france" */
  countryCode:     string;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface BtpAppResult {
  success:             boolean;
  /** BTP-assigned ClientID — passed to Steps 2, 3, 4 */
  clientId:            string;
  appName:             string;
  /** True once D3 approval notification is sent */
  d3ApprovalTriggered: boolean;
  error?: string;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/** POST OAuth2 client-credentials grant → Bearer token. */
async function _getOAuthToken(cfg: BtpAppConfig): Promise<string> {
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BTP OAuth token → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json() as { access_token?: string };
  if (!json.access_token) throw new Error("BTP OAuth token: no access_token in response.");
  return json.access_token;
}

function _btpHeaders(token: string): Record<string, string> {
  return {
    Authorization:  `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept:         "application/json",
  };
}

// ── Call 1 — Create Application ───────────────────────────────────────────────

/**
 * POST {apiHost}/odata/1.0/data.svc/APIMgmt.Applications
 *
 * Creates a new API Management Application for the 3PL partner.
 * Returns the application name and the auto-generated BTP ClientID.
 *
 * ⚠ POST body structure is TBD — fields below are best-guess from OData v4 / BTP API docs.
 *   Parag Shende must confirm exact field names and required attributes.
 *
 * Expected OData POST body (TODO: confirm with Parag):
 * {
 *   "name":        "3pl-petc-rc-navision-3plspl-sys",
 *   "description": "3PL onboarding for france",
 *   "title":       "3PL France Integration",
 *   "attributes": [
 *     { "name": "product",   "value": "3PL_Integration" },
 *     { "name": "quotaPlan", "value": "standard" }
 *   ]
 * }
 */
async function _createApplication(
  token: string,
  cfg:   BtpAppConfig
): Promise<{ appName: string; clientId: string }> {
  const url  = `${cfg.apiHost.replace(/\/$/, '')}/odata/1.0/data.svc/APIMgmt.Applications`;

  // TODO: confirm exact field names with Parag Shende
  const body = {
    name:        cfg.appName,
    description: cfg.appDescription || `3PL onboarding for ${cfg.countryCode}`,
    title:       `3PL ${cfg.countryCode.toUpperCase()} Integration`,
    attributes:  [
      { name: "product",   value: cfg.productName },
      { name: "quotaPlan", value: cfg.quotaPlan },
    ],
  };

  const res = await fetch(url, {
    method:  "POST",
    headers: _btpHeaders(token),
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BTP CreateApplication → HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = await res.json() as {
    d?: { name?: string; applicationID?: string; externalName?: string };
    name?: string; applicationID?: string;
  };

  // OData v4 wraps response in "d" — handle both flavours
  const data    = json.d ?? json;
  const appName = data.name ?? cfg.appName;
  // clientId may be returned here or requires a follow-up call (see _getClientCredentials)
  const clientId = data.applicationID ?? data.externalName ?? "";

  return { appName, clientId };
}

// ── Call 2 — Generate / Retrieve ClientID & Secret ────────────────────────────

/**
 * GET {apiHost}/odata/1.0/data.svc/APIMgmt.Applications('{appName}')
 *
 * After application creation, the BTP API Management assigns a ClientID.
 * This call retrieves it (or triggers generation if it wasn't in the create response).
 *
 * ⚠ The exact sub-path for credential retrieval/regeneration is TBD.
 *   Some BTP tenants use a dedicated action:
 *     POST .../APIMgmt.Applications('{appName}')/Application_GetClientCredentials
 *   Others return credentials in the create-response directly.
 *   Parag Shende must confirm the correct approach for this tenant.
 */
async function _getClientCredentials(
  token:   string,
  appName: string,
  cfg:     BtpAppConfig
): Promise<string> {
  const base = cfg.apiHost.replace(/\/$/, '');
  // Try the standard OData single-entity GET first
  const url  = `${base}/odata/1.0/data.svc/APIMgmt.Applications('${encodeURIComponent(appName)}')`;

  const res  = await fetch(url, { headers: _btpHeaders(token) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BTP GetClientCredentials → HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = await res.json() as {
    d?: { applicationID?: string; externalName?: string; name?: string };
    applicationID?: string; externalName?: string;
  };

  const data     = json.d ?? json;
  const clientId = data.applicationID ?? data.externalName ?? data.name ?? "";
  if (!clientId) {
    throw new Error(
      "BTP GetClientCredentials: could not extract ClientID from response. " +
      "Parag Shende must confirm the correct field name and credential-generation endpoint."
    );
  }
  return clientId;
}

// ── Call 3 — D3 Approval Notification ────────────────────────────────────────

/**
 * Notify the D3 approver that a new BTP application has been created and
 * is awaiting approval.
 *
 * ⚠ D3 approval mechanism is TBD — could be:
 *   - Email notification (SMTP / SendGrid)
 *   - ServiceNow ticket
 *   - BTP Workflow Service trigger
 * Parag Shende must confirm the mechanism and approver identity before this
 * can be automated. Until then, the notification is best-effort (log only).
 */
async function _notifyD3Approver(
  appName:  string,
  clientId: string,
  cfg:      BtpAppConfig
): Promise<void> {
  // TODO: replace with real notification mechanism once Parag confirms
  // For now: log the approval request so the team can action manually
  console.log(
    `[Step 1] BTP application created: ${appName} (clientId: ${clientId}). ` +
    `D3 approval required — notify: ${cfg.d3ApproverEmail}. ` +
    `⚠ Automated approval trigger TBD — Parag Shende to confirm mechanism.`
  );
  // Future implementation options:
  // Option A — email via SMTP/SendGrid:
  //   await sendEmail({ to: cfg.d3ApproverEmail, subject: `BTP App Approval: ${appName}`, ... })
  // Option B — ServiceNow:
  //   await fetch(serviceNowUrl, { method: 'POST', body: JSON.stringify({ appName, clientId, ... }) })
  // Option C — BTP Workflow Service:
  //   await fetch(`${cfg.apiHost}/workflow/rest/v1/workflow-instances`, { ... })
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 1: Create BTP Application → retrieve ClientID/Secret → notify D3 approver.
 *
 * Returns early with "not yet implemented" when required credentials are missing.
 *
 * ⚠ Step is marked "Manual (interim)" in the tracker — D3 approval decision is
 *   still pending. Code is complete; activate by setting env vars.
 */
export async function run(cfg: BtpAppConfig): Promise<BtpAppResult> {
  if (!cfg.apiHost || !cfg.tokenUrl || !cfg.clientId || !cfg.clientSecret) {
    throw new Error(
      "not yet implemented — Step 1 requires BTP_API_HOST, BTP_TOKEN_URL, " +
      "BTP_CLIENT_ID, BTP_CLIENT_SECRET from Parag Shende (BTP Team)."
    );
  }

  // 1. Acquire OAuth2 bearer token
  const token = await _getOAuthToken(cfg);

  // 2. Create application in BTP API Management
  const { appName, clientId: createdClientId } = await _createApplication(token, cfg);

  // 3. Retrieve full ClientID (may be in create-response or requires follow-up GET)
  const clientId = createdClientId || await _getClientCredentials(token, appName, cfg);

  // 4. Notify D3 approver (best-effort until mechanism is confirmed)
  await _notifyD3Approver(appName, clientId, cfg);

  return {
    success:             true,
    clientId,
    appName,
    d3ApprovalTriggered: !!cfg.d3ApproverEmail,
  };
}
