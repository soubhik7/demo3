/**
 * Step 1 — BTP Application Creation
 * ====================================
 * Status    : TODO
 * Owner     : Parag Shende (BTP Team)
 * Blocked on:
 *   - Decision: automate via API or keep manual (D3 approval gate)
 *   - POST payload schema for APIMgmt.Applications (Parag to share)
 *   - D3 approver identity + approval SLA
 *   - Auth method: OAuth2 client credentials or service key?
 *
 * Known API base:
 *   https://apim-management-host/odata/1.0/data.svc/APIMgmt.Applications
 *
 * Contact: Parag Shende — share Postman collection + payload + auth method
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface BtpAppConfig {
  /** TODO: BTP API management host — Parag to confirm */
  apiHost: string;
  /** TODO: OAuth2 token URL for BTP Integration Suite */
  tokenUrl: string;
  /** TODO: OAuth2 client ID — from Service Key (never hardcode, read from Key Vault) */
  clientId: string;
  /** TODO: OAuth2 client secret — from Service Key */
  clientSecret: string;

  /** TODO: Application name to create (or naming convention — confirm with Parag) */
  appName: string;
  /** TODO: Application description template */
  appDescription: string;
  /** TODO: Product name to assign to the application */
  productName: string;
  /** TODO: Quota plan (rate-limit tier) — Parag to confirm */
  quotaPlan: string;

  /** TODO: D3 approver email — who must approve the new app? */
  d3ApproverEmail: string;

  /** Values from onboarding input */
  partnerId: string;
  countryCode: string;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface BtpAppResult {
  success: boolean;
  /** BTP-assigned ClientID — needed by Steps 2, 3, 4 */
  clientId: string;
  appName: string;
  d3ApprovalTriggered: boolean;
  error?: string;
}

// ── Helpers (stubs) ───────────────────────────────────────────────────────────

/**
 * TODO: POST OAuth2 client-credentials grant to get bearer token.
 * @throws when tokenUrl / clientId / clientSecret are not yet configured
 */
async function _getOAuthToken(_config: BtpAppConfig): Promise<string> {
  // TODO: const res = await fetch(config.tokenUrl, { method:'POST', ... })
  throw new Error(
    "Step 1: getOAuthToken not implemented — tokenUrl + client credentials needed from Parag Shende"
  );
}

/**
 * TODO: POST to APIMgmt.Applications to create the BTP application.
 * Payload schema TBD — Parag Shende to share Postman collection.
 */
async function _createApplication(
  _token: string,
  _config: BtpAppConfig
): Promise<{ clientId: string; appName: string }> {
  // TODO: const res = await fetch(`${config.apiHost}/odata/1.0/data.svc/APIMgmt.Applications`, {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ ... }),
  // })
  throw new Error(
    "Step 1: createApplication not implemented — payload schema + API host needed from Parag Shende"
  );
}

/**
 * TODO: Trigger D3 approval workflow for the newly created application.
 * Mechanism TBD — could be email, ServiceNow, or BTP workflow service.
 */
async function _triggerD3Approval(
  _appName: string,
  _config: BtpAppConfig
): Promise<void> {
  // TODO: confirm D3 approval mechanism with Parag Shende
  throw new Error(
    "Step 1: D3 approval trigger not implemented — approval mechanism + approver identity needed from Parag Shende"
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 1: Create BTP Application + trigger D3 approval.
 *
 * TODO: Implement when Parag Shende provides:
 *   - API host URL + OAuth2 credentials (Service Key)
 *   - POST payload schema for APIMgmt.Applications
 *   - D3 approver identity and approval mechanism
 *   - Confirmation that clientId is returned in create-response (or needs follow-up GET)
 *
 * Output: clientId is passed downstream to Steps 2, 3, 4.
 */
export async function run(_config: BtpAppConfig): Promise<BtpAppResult> {
  // TODO: Step 1 implementation
  // const token   = await _getOAuthToken(config)
  // const { clientId, appName } = await _createApplication(token, config)
  // await _triggerD3Approval(appName, config)
  // return { success: true, clientId, appName, d3ApprovalTriggered: true }

  throw new Error(
    "Step 1 (BTP App Creation) not yet implemented.\n" +
      "Blocked on: API payload schema + auth credentials from Parag Shende;\n" +
      "D3 approval mechanism + approver identity TBD."
  );
}
