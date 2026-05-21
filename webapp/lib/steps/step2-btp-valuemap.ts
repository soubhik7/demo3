/**
 * Step 2 — BTP Value Mapping (Upsert → Save Version → Deploy)
 * ==============================================================
 * Status    : TODO
 * Owner     : Parag Shende (BTP Team)
 * Blocked on:
 *   - Postman collection + sample payloads for all 3 API calls
 *   - Service Instance + Service Key for BTP Integration Suite access
 *   - Confirmation that 3PL ValueMapping entries are EDITABLE after initial config
 *     (CRITICAL: if locked, this step cannot be automated at all)
 *
 * Known endpoints (DEV):
 *   Upsert entry : POST .../api/v1/UpsertValMaps
 *   Save version : POST .../api/v1/ValueMappingDesigntimeArtifactSaveAsVersion
 *   Deploy       : POST .../api/v1/DeployValueMappingsDesigntimeArtifact
 *
 * Base host: https://effem-glb-ci-dev01-pr.integrationsuite.cfapps.us21.hana.ondemand.com
 *
 * Contact: Parag Shende — test APIs, share Postman collection + Service Key
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface BtpValueMappingConfig {
  /**
   * BTP Integration Suite base URL.
   * Known DEV: https://effem-glb-ci-dev01-pr.integrationsuite.cfapps.us21.hana.ondemand.com
   */
  baseUrl: string;
  /** TODO: OAuth2 token URL — from Service Key */
  tokenUrl: string;
  /** TODO: client_id — from Service Key (store in Key Vault) */
  clientId: string;
  /** TODO: client_secret — from Service Key (store in Key Vault) */
  clientSecret: string;

  /** TODO: Artifact ID for the 3PL ValueMapping artifact — Parag to confirm */
  artifactId: string;
  /** TODO: Package ID that contains the ValueMapping artifact — Parag to confirm */
  packageId: string;

  /** Values from onboarding input + Step 1 output */
  partnerId: string;   // BTP ClientID (output of Step 1)
  countryCode: string;
  /** TODO: Mapping entries to upsert — confirm schema with Parag */
  mappingEntries: Array<{ sourceValue: string; targetValue: string }>;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface BtpValueMappingResult {
  success: boolean;
  upserted: boolean;
  versionSaved: boolean;
  deployed: boolean;
  error?: string;
}

// ── Helpers (stubs) ───────────────────────────────────────────────────────────

/**
 * TODO: OAuth2 client-credentials token request against BTP token URL.
 */
async function _getOAuthToken(_config: BtpValueMappingConfig): Promise<string> {
  // TODO: POST to config.tokenUrl with client_id + client_secret
  throw new Error(
    "Step 2: getOAuthToken not implemented — Service Key (tokenUrl + credentials) needed from Parag Shende"
  );
}

/**
 * TODO: POST to UpsertValMaps to add/update translation mapping entries.
 * Payload schema TBD — Parag to share sample from Postman collection.
 */
async function _upsertValueMapping(
  _token: string,
  _config: BtpValueMappingConfig
): Promise<void> {
  // TODO: POST ${config.baseUrl}/api/v1/UpsertValMaps
  // body: { artifactId, packageId, mappingEntries }
  throw new Error(
    "Step 2: upsertValueMapping not implemented — payload schema needed from Parag Shende"
  );
}

/**
 * TODO: POST to SaveAsVersion to create a new design-time version.
 */
async function _saveAsVersion(
  _token: string,
  _config: BtpValueMappingConfig
): Promise<void> {
  // TODO: POST ${config.baseUrl}/api/v1/ValueMappingDesigntimeArtifactSaveAsVersion
  throw new Error(
    "Step 2: saveAsVersion not implemented — payload schema needed from Parag Shende"
  );
}

/**
 * TODO: POST to DeployValueMappingsDesigntimeArtifact to deploy the new version.
 */
async function _deployValueMapping(
  _token: string,
  _config: BtpValueMappingConfig
): Promise<void> {
  // TODO: POST ${config.baseUrl}/api/v1/DeployValueMappingsDesigntimeArtifact
  throw new Error(
    "Step 2: deployValueMapping not implemented — payload schema needed from Parag Shende"
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 2: Upsert value mapping → save version → deploy.
 *
 * TODO: Implement when Parag Shende provides:
 *   - Postman collection with sample payloads for all 3 calls
 *   - Service Instance + Service Key for BTP Integration Suite
 *   - Artifact ID + Package ID for the 3PL ValueMapping artifact
 *   - Confirmation that entries are editable (not locked after initial config)
 */
export async function run(_config: BtpValueMappingConfig): Promise<BtpValueMappingResult> {
  // TODO: Step 2 implementation
  // const token = await _getOAuthToken(config)
  // await _upsertValueMapping(token, config)
  // await _saveAsVersion(token, config)
  // await _deployValueMapping(token, config)
  // return { success: true, upserted: true, versionSaved: true, deployed: true }

  throw new Error(
    "Step 2 (BTP Value Mapping) not yet implemented.\n" +
      "Blocked on: Postman collection + Service Key + artifact IDs from Parag Shende;\n" +
      "CRITICAL: confirm 3PL ValueMapping entries are editable."
  );
}
