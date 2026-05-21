/**
 * Step 2 — BTP Integration Suite Value Mapping (Upsert → Save Version → Deploy)
 * ===============================================================================
 * Status    : Implemented skeleton — blocked on payload schema confirmation
 * Owner     : Parag Shende (BTP Team)
 *
 * !! CRITICAL WARNING !!
 * ─────────────────────────────────────────────────────────────────────────────
 * Parag's note from tracker:
 *   "For 3PL ValueMapping these APIs may not work. 3PL value mapping are
 *    configured with existing entries for 3PL and 3PL. Once API is configured
 *    cannot be Edited."
 *
 * This means: if the ValueMapping object was already created manually, the
 * UpsertValMaps API call may FAIL (HTTP 4xx or silently skip) for existing entries.
 * Step 2 may be unautomatable and remain "Manual" permanently.
 * Parag Shende must test and confirm before activating this step.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Confirmed endpoints (DEV tenant):
 *   Base     : https://effem-glb-ci-dev01-pr.integrationsuite.cfapps.us21.hana.ondemand.com
 *   Upsert   : POST {baseUrl}/api/v1/UpsertValMaps
 *   Version  : POST {baseUrl}/api/v1/ValueMappingDesigntimeArtifactSaveAsVersion
 *   Deploy   : POST {baseUrl}/api/v1/DeployValueMappingsDesigntimeArtifact
 *
 * Auth: OAuth2 client-credentials → Bearer token (same BTP Service Key as Step 1)
 *
 * Activation (env vars or form input.btp):
 *   BTP_SUITE_BASE_URL         — Integration Suite host (default: DEV above)
 *   BTP_TOKEN_URL              — OAuth2 token endpoint from Service Key
 *   BTP_CLIENT_ID              — Service Key client_id
 *   BTP_CLIENT_SECRET          — Service Key client_secret
 *   BTP_VALUEMAP_ARTIFACT_ID   — Artifact ID of the 3PL ValueMapping object
 *   BTP_VALUEMAP_PACKAGE_ID    — Package ID containing the ValueMapping artifact
 *
 * ⚠  Payload schemas are inferred from SAP CPI/Integration Suite API conventions.
 *    Parag Shende must confirm exact field names via Postman collection before
 *    activating this step in production.
 *
 * Contact: Parag Shende — confirm editability, artifact/package IDs, POST bodies
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface BtpValueMappingConfig {
  /**
   * BTP Integration Suite base URL.
   * DEV: https://effem-glb-ci-dev01-pr.integrationsuite.cfapps.us21.hana.ondemand.com
   */
  baseUrl:      string;
  /** OAuth2 token endpoint — from BTP Service Key */
  tokenUrl:     string;
  /** OAuth2 client_id — from BTP Service Key */
  clientId:     string;
  /** OAuth2 client_secret — from BTP Service Key */
  clientSecret: string;

  /**
   * Artifact ID of the 3PL ValueMapping design-time artifact.
   * Parag Shende must supply this — visible in Integration Suite UI → Artifacts tab.
   */
  artifactId: string;
  /**
   * Package ID that owns the ValueMapping artifact.
   * Parag Shende must supply this — visible in Integration Suite UI → Packages tab.
   */
  packageId: string;

  /** BTP ClientID / Solace Partner ID — output of Step 1 */
  partnerId:   string;
  /** Country key e.g. "france" */
  countryCode: string;

  /**
   * Plant/customer mapping entries to upsert.
   * Each entry maps an internal Mars value to a 3PL-external value.
   *
   * ⚠ Schema below is inferred from SAP CPI ValueMapping conventions.
   *   Parag Shende must confirm exact field names (SrcValue/TgtValue vs From/To etc.)
   */
  mappingEntries: Array<{
    /** Internal Mars source value (e.g. plant code "1234") */
    sourceValue: string;
    /** 3PL external target value */
    targetValue: string;
  }>;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface BtpValueMappingResult {
  success:      boolean;
  /** True when at least one UpsertValMaps call completed without HTTP error */
  upserted:     boolean;
  /** True when SaveAsVersion completed */
  versionSaved: boolean;
  /** True when Deploy completed */
  deployed:     boolean;
  /** Artifact ID that was operated on */
  artifactId:   string;
  error?: string;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/** POST OAuth2 client-credentials grant → Bearer token. */
async function _getOAuthToken(cfg: BtpValueMappingConfig): Promise<string> {
  const res = await fetch(cfg.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BTP ValueMap OAuth token → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json() as { access_token?: string };
  if (!json.access_token) throw new Error("BTP ValueMap OAuth token: no access_token in response.");
  return json.access_token;
}

function _btpHeaders(token: string): Record<string, string> {
  return {
    Authorization:  `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept:         "application/json",
  };
}

// ── Call 1 — Upsert Value Mapping Entries ─────────────────────────────────────

/**
 * POST {baseUrl}/api/v1/UpsertValMaps
 *
 * Inserts or updates plant/customer translation mapping entries in the
 * 3PL ValueMapping artifact.
 *
 * !! CRITICAL !!
 * If the ValueMapping was already configured manually, the API may reject
 * edits (locked after initial config per Parag's note). Test against DEV first.
 *
 * ⚠ Body schema inferred from SAP CPI OData conventions — confirm with Parag:
 * {
 *   "Id":        "3PL_ValueMapping",           // artifactId
 *   "PackageId": "3PLIntegration",             // packageId
 *   "ValMapSchema": [                          // schema header row (may be optional for upsert)
 *     { "SrcAgency": "Mars", "SrcId": "PlantCode", "TgtAgency": "3PL", "TgtId": "WarehouseCode" }
 *   ],
 *   "ValMapTableEntry": [                      // data rows
 *     { "SrcValue": "1234", "TgtValue": "WH-001" },
 *     ...
 *   ]
 * }
 */
async function _upsertValueMapping(
  token: string,
  cfg:   BtpValueMappingConfig
): Promise<void> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/api/v1/UpsertValMaps`;

  // TODO: confirm exact body schema with Parag Shende via Postman collection
  const body = {
    Id:        cfg.artifactId,
    PackageId: cfg.packageId,
    // ValMapSchema header — agencies/dimension names
    // ⚠ Parag must confirm whether SrcAgency/TgtAgency are required and what values to use
    ValMapSchema: [
      {
        SrcAgency: "Mars",
        SrcId:     "PlantCode",
        TgtAgency: cfg.partnerId || "3PL",
        TgtId:     "WarehouseCode",
      },
    ],
    // Data rows from onboarding input
    ValMapTableEntry: cfg.mappingEntries.map(e => ({
      SrcValue: e.sourceValue,
      TgtValue: e.targetValue,
    })),
  };

  const res = await fetch(url, {
    method:  "POST",
    headers: _btpHeaders(token),
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Surface the CRITICAL warning when entries appear locked
    const locked = res.status === 400 || res.status === 409 || res.status === 403;
    const hint   = locked
      ? " ⚠ CRITICAL: ValueMapping entries may be locked after initial config — confirm with Parag Shende."
      : "";
    throw new Error(
      `BTP UpsertValMaps → HTTP ${res.status}: ${text.slice(0, 400)}${hint}`
    );
  }
}

// ── Call 2 — Save Design-time Version ────────────────────────────────────────

/**
 * POST {baseUrl}/api/v1/ValueMappingDesigntimeArtifactSaveAsVersion
 *
 * Creates a new immutable design-time version of the ValueMapping artifact
 * after entries have been upserted.
 *
 * ⚠ SAP CPI convention: OData function import — params passed as URL query string.
 *   POST .../ValueMappingDesigntimeArtifactSaveAsVersion?Id='artifactId'&PackageId='pkgId'
 *   Body may be empty or contain a JSON version comment.
 *   Parag Shende must confirm exact parameter encoding (query string vs body).
 *
 * Example query-param form (SAP CPI standard):
 *   ?Id='3PL_ValueMapping'&PackageId='3PLIntegration'&Comment='3PL onboarding france'
 */
async function _saveAsVersion(
  token:   string,
  cfg:     BtpValueMappingConfig,
  comment: string
): Promise<void> {
  // SAP CPI uses OData-style single-quoted params in the query string
  const params = new URLSearchParams({
    Id:        `'${cfg.artifactId}'`,
    PackageId: `'${cfg.packageId}'`,
    Comment:   `'${comment}'`,
  });
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/api/v1/ValueMappingDesigntimeArtifactSaveAsVersion?${params.toString()}`;

  const res = await fetch(url, {
    method:  "POST",
    headers: _btpHeaders(token),
    // Body may be empty for this OData function import
    body:    JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `BTP SaveAsVersion → HTTP ${res.status}: ${text.slice(0, 400)}` +
      "\n⚠ Parag Shende to confirm exact query-string vs body parameter encoding."
    );
  }
}

// ── Call 3 — Deploy Value Mapping ─────────────────────────────────────────────

/**
 * POST {baseUrl}/api/v1/DeployValueMappingsDesigntimeArtifact
 *
 * Deploys the saved design-time version to the runtime.
 * Must be called after SaveAsVersion completes.
 *
 * ⚠ SAP CPI convention: OData function import — Id as query param.
 *   POST .../DeployValueMappingsDesigntimeArtifact?Id='artifactId'
 *   Parag Shende must confirm if PackageId is also required here.
 */
async function _deployValueMapping(
  token: string,
  cfg:   BtpValueMappingConfig
): Promise<void> {
  const params = new URLSearchParams({ Id: `'${cfg.artifactId}'` });
  const url    = `${cfg.baseUrl.replace(/\/$/, '')}/api/v1/DeployValueMappingsDesigntimeArtifact?${params.toString()}`;

  const res = await fetch(url, {
    method:  "POST",
    headers: _btpHeaders(token),
    body:    JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `BTP DeployValueMapping → HTTP ${res.status}: ${text.slice(0, 400)}` +
      "\n⚠ Parag Shende to confirm exact parameter encoding and whether PackageId is required."
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 2: Upsert ValueMapping entries → save version → deploy.
 *
 * Returns early with "not yet implemented" when required credentials or artifact
 * IDs are missing (safeRun will mark as "skipped" rather than "error").
 *
 * !! CRITICAL !!
 * This step may be permanently blocked if the 3PL ValueMapping object is locked
 * after initial manual configuration. Parag Shende must test and confirm before
 * enabling in production.
 *
 * ⚠ Step is marked "Automated (pending confirmation)" in the tracker.
 *    Activate by setting BTP_VALUEMAP_ARTIFACT_ID and BTP_VALUEMAP_PACKAGE_ID
 *    in addition to the shared BTP credential env vars.
 */
export async function run(cfg: BtpValueMappingConfig): Promise<BtpValueMappingResult> {
  // Credential + artifact-ID guard — missing any of these causes safeRun → "skipped"
  if (!cfg.tokenUrl || !cfg.clientId || !cfg.clientSecret) {
    throw new Error(
      "not yet implemented — Step 2 requires BTP_TOKEN_URL, BTP_CLIENT_ID, " +
      "BTP_CLIENT_SECRET from Parag Shende (BTP Team)."
    );
  }
  if (!cfg.artifactId || !cfg.packageId) {
    throw new Error(
      "not yet implemented — Step 2 requires BTP_VALUEMAP_ARTIFACT_ID and " +
      "BTP_VALUEMAP_PACKAGE_ID from Parag Shende (BTP Team)."
    );
  }

  // If no mapping entries were supplied, skip gracefully rather than sending an empty upsert
  if (!cfg.mappingEntries || cfg.mappingEntries.length === 0) {
    console.log(
      "[Step 2] No mapping entries supplied — skipping UpsertValMaps. " +
      "Provide plant/customer combinations in the form to activate this step."
    );
    return {
      success:      true,
      upserted:     false,
      versionSaved: false,
      deployed:     false,
      artifactId:   cfg.artifactId,
    };
  }

  // 1. Acquire OAuth2 bearer token
  const token = await _getOAuthToken(cfg);

  // 2. Upsert mapping entries (CRITICAL: may fail if entries are locked)
  await _upsertValueMapping(token, cfg);

  // 3. Save a new design-time version
  const comment = `3PL onboarding — ${cfg.countryCode} / ${cfg.partnerId}`;
  await _saveAsVersion(token, cfg, comment);

  // 4. Deploy the new version to runtime
  await _deployValueMapping(token, cfg);

  console.log(
    `[Step 2] ValueMapping updated and deployed: artifact=${cfg.artifactId}, ` +
    `partner=${cfg.partnerId}, entries=${cfg.mappingEntries.length}`
  );

  return {
    success:      true,
    upserted:     true,
    versionSaved: true,
    deployed:     true,
    artifactId:   cfg.artifactId,
  };
}
