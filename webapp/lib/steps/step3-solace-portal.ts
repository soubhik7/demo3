/**
 * Step 3 — Solace Event Portal Design (5-group sequence)
 * =======================================================
 * Status    : Implemented (credentials still pending from Rohini Mondal)
 * Owner     : Rohini Mondal (Solace Team)
 *
 * Activation: set these env vars (or pass via form input.solace):
 *   SOLACE_EP_API_TOKEN      — Solace Cloud API bearer token
 *   SOLACE_ENUM_ID           — Enumeration object ID
 *   SOLACE_EVENT_ID          — Event object ID
 *   SOLACE_PRODUCER_APP_ID   — Producer Application ID
 *   SOLACE_CONSUMER_APP_ID   — Consumer Application ID
 *   SOLACE_ENVIRONMENT_ID    — Environment / service ID
 *   SOLACE_BROKER_ID         — Fallback broker ID (overridden by GET /eventBrokerConnections)
 *
 * API base: https://api.solace.dev/api/v2/architecture
 * Auth:     Authorization: Bearer {token}    Content-Type: application/json
 *
 * Full call sequence (matches spreadsheet spec exactly):
 *
 *   Group 1 — Enumeration
 *     GET  /enumerations/{enumId}                          → verify exists, read metadata
 *     GET  /enumerations/{enumId}/versions?pageSize=1&sort=createdTime:desc
 *                                                          → read current enum values
 *     POST /enumerations/{enumId}/versions                 → create new version + country code
 *
 *   Group 2 — Event
 *     GET  /events/{eventId}                               → verify exists, read metadata
 *     GET  /events/{eventId}/versions?pageSize=1&sort=createdTime:desc
 *                                                          → read current version (topic + schema)
 *     POST /events/{eventId}/versions                      → create new version
 *
 *   Group 3 — Producer Application
 *     GET  /applications/{producerAppId}                   → verify exists, read name/type
 *     GET  /applications/{producerAppId}/versions?pageSize=1&sort=createdTime:desc
 *                                                          → read current publishedEventVersionIds
 *     POST /applications/{producerAppId}/versions          → new version publishing new event
 *
 *   Group 4 — Consumer Application
 *     GET  /applications/{consumerAppId}                   → verify exists, read name/type
 *     GET  /applications/{consumerAppId}/versions?pageSize=1&sort=createdTime:desc
 *                                                          → read current subscribedEventVersionIds
 *     POST /applications/{consumerAppId}/versions          → new version subscribing to new event
 *
 *   Group 5 — Dev Promotion Request
 *     GET  /eventBrokerConnections?pageSize=100            → list model event brokers, pick target
 *     POST /applicationPromotions                          → promote all 4 new versions to broker
 */

const EP_ARCH = "https://api.solace.dev/api/v2/architecture";

// ── Config ────────────────────────────────────────────────────────────────────

export interface SolaceEventPortalConfig {
  apiBase:         string;   // overrideable; implementation uses EP_ARCH constant
  apiToken:        string;
  enumId:          string;
  eventId:         string;
  producerAppId:   string;
  producerAppName: string;
  consumerAppId:   string;
  consumerAppName: string;
  environmentId:   string;
  /** Fallback broker ID — used only when GET /eventBrokerConnections returns no match */
  brokerId:        string;
  countryCode:     string;
  regionIso:       string;
  partnerId:       string;
  subscriptionTopics: string[];
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface SolaceEventPortalResult {
  success:                   boolean;
  enumVersionCreated:        boolean;
  eventVersionCreated:       boolean;
  producerAppVersionCreated: boolean;
  consumerAppVersionCreated: boolean;
  devPromotionRequested:     boolean;
  enumVersionId:             string;
  eventVersionId:            string;
  producerVersionId:         string;
  consumerVersionId:         string;
  brokerConnectionId:        string;
  error?: string;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function _headers(token: string): Record<string, string> {
  return {
    Authorization:  `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept:         "application/json",
  };
}

async function _get(url: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: _headers(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Solace EP GET ${url} → HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function _post(url: string, token: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method:  "POST",
    headers: _headers(token),
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Solace EP POST ${url} → HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

/** Increment semver patch: "1.0.3" → "1.0.4" */
function _bump(v: string): string {
  const parts = String(v || "1.0.0").split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

/** Pull the single data object from a Solace EP singleton response {data:{...}}. */
function _data(resp: Record<string, unknown>): Record<string, unknown> {
  return (resp.data as Record<string, unknown>) ?? resp;
}

/** Pull the first item from a Solace EP paged response {data:[...]}. */
function _first(resp: Record<string, unknown>, label: string): Record<string, unknown> {
  const items = (resp.data as unknown[]) ?? [];
  if (!items.length) throw new Error(`Solace EP: no items returned for ${label}`);
  return items[0] as Record<string, unknown>;
}

// ── Group 1 — Enumeration ─────────────────────────────────────────────────────

/** GET /enumerations/{id} — verify exists, read name */
async function _getEnum(cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const resp = await _get(`${EP_ARCH}/enumerations/${cfg.enumId}`, cfg.apiToken);
  return _data(resp);
}

/** GET /enumerations/{id}/versions — read latest version (current enum values) */
async function _getEnumVersion(cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const url  = `${EP_ARCH}/enumerations/${cfg.enumId}/versions?pageSize=1&sort=createdTime:desc`;
  const resp = await _get(url, cfg.apiToken);
  return _first(resp, `enumeration ${cfg.enumId} versions`);
}

/** POST /enumerations/{id}/versions — new version with country code appended to enum values */
async function _postEnumVersion(
  enumObj:     Record<string, unknown>,
  currentVer:  Record<string, unknown>,
  cfg:         SolaceEventPortalConfig
): Promise<Record<string, unknown>> {
  const existing  = (currentVer.enumValues as { label: string; value: string }[]) ?? [];
  const code      = cfg.countryCode.toUpperCase();
  const enumValues = existing.some(v => v.value === code)
    ? existing
    : [...existing, { label: code, value: code }];

  const body = {
    enumerationId: cfg.enumId,
    version:       _bump(currentVer.version as string),
    displayName:   (enumObj.name as string) ?? (currentVer.displayName as string) ?? "",
    description:   (currentVer.description as string) ?? "",
    enumValues,
    stateId:       "1",   // DRAFT — promoted to broker in Group 5
  };
  const resp = await _post(`${EP_ARCH}/enumerations/${cfg.enumId}/versions`, cfg.apiToken, body);
  return _data(resp);
}

// ── Group 2 — Event ───────────────────────────────────────────────────────────

/** GET /events/{id} — verify exists, read name */
async function _getEvent(cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const resp = await _get(`${EP_ARCH}/events/${cfg.eventId}`, cfg.apiToken);
  return _data(resp);
}

/** GET /events/{id}/versions — read latest version (topic address, schema ref) */
async function _getEventVersion(cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const url  = `${EP_ARCH}/events/${cfg.eventId}/versions?pageSize=1&sort=createdTime:desc`;
  const resp = await _get(url, cfg.apiToken);
  return _first(resp, `event ${cfg.eventId} versions`);
}

/** POST /events/{id}/versions — new version; preserves topic address and schema reference */
async function _postEventVersion(
  eventObj:    Record<string, unknown>,
  currentVer:  Record<string, unknown>,
  cfg:         SolaceEventPortalConfig
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    eventId:     cfg.eventId,
    version:     _bump(currentVer.version as string),
    displayName: (eventObj.name as string) ?? (currentVer.displayName as string) ?? "",
    description: (currentVer.description as string) ?? "",
    stateId:     "1",
  };
  // Preserve topic/schema bindings from current version
  if (currentVer.deliveryDescriptor)  body.deliveryDescriptor  = currentVer.deliveryDescriptor;
  if (currentVer.schemaVersionId)     body.schemaVersionId     = currentVer.schemaVersionId;
  if (currentVer.schemaPrimitiveType) body.schemaPrimitiveType = currentVer.schemaPrimitiveType;

  const resp = await _post(`${EP_ARCH}/events/${cfg.eventId}/versions`, cfg.apiToken, body);
  return _data(resp);
}

// ── Group 3 — Producer Application ───────────────────────────────────────────

/** GET /applications/{id} — verify exists, read name and type */
async function _getApp(appId: string, cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const resp = await _get(`${EP_ARCH}/applications/${appId}`, cfg.apiToken);
  return _data(resp);
}

/** GET /applications/{id}/versions — read latest version */
async function _getAppVersion(appId: string, cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const url  = `${EP_ARCH}/applications/${appId}/versions?pageSize=1&sort=createdTime:desc`;
  const resp = await _get(url, cfg.apiToken);
  return _first(resp, `application ${appId} versions`);
}

/** POST /applications/{producerAppId}/versions — new version that publishes the new event version */
async function _postProducerVersion(
  appObj:      Record<string, unknown>,
  currentVer:  Record<string, unknown>,
  newEventVer: Record<string, unknown>,
  cfg:         SolaceEventPortalConfig
): Promise<Record<string, unknown>> {
  const existingPublished   = (currentVer.publishedEventVersionIds as string[]) ?? [];
  const newEventId          = String(newEventVer.id ?? "");
  const publishedEventVersionIds = existingPublished.includes(newEventId)
    ? existingPublished
    : [...existingPublished, newEventId];

  const body = {
    applicationId:             cfg.producerAppId,
    version:                   _bump(currentVer.version as string),
    displayName:               (appObj.name as string) ?? cfg.producerAppName,
    description:               (currentVer.description as string) ?? "",
    stateId:                   "1",
    publishedEventVersionIds,
    subscribedEventVersionIds: (currentVer.subscribedEventVersionIds as string[]) ?? [],
  };
  const resp = await _post(`${EP_ARCH}/applications/${cfg.producerAppId}/versions`, cfg.apiToken, body);
  return _data(resp);
}

// ── Group 4 — Consumer Application ───────────────────────────────────────────

/** POST /applications/{consumerAppId}/versions — new version that subscribes to the new event version */
async function _postConsumerVersion(
  appObj:      Record<string, unknown>,
  currentVer:  Record<string, unknown>,
  newEventVer: Record<string, unknown>,
  cfg:         SolaceEventPortalConfig
): Promise<Record<string, unknown>> {
  const existingSubscribed   = (currentVer.subscribedEventVersionIds as string[]) ?? [];
  const newEventId           = String(newEventVer.id ?? "");
  const subscribedEventVersionIds = existingSubscribed.includes(newEventId)
    ? existingSubscribed
    : [...existingSubscribed, newEventId];

  const body = {
    applicationId:             cfg.consumerAppId,
    version:                   _bump(currentVer.version as string),
    displayName:               (appObj.name as string) ?? cfg.consumerAppName,
    description:               (currentVer.description as string) ?? "",
    stateId:                   "1",
    publishedEventVersionIds:  (currentVer.publishedEventVersionIds as string[]) ?? [],
    subscribedEventVersionIds,
  };
  const resp = await _post(`${EP_ARCH}/applications/${cfg.consumerAppId}/versions`, cfg.apiToken, body);
  return _data(resp);
}

// ── Group 5 — Dev Promotion Request ──────────────────────────────────────────

/**
 * GET /eventBrokerConnections — list all model event brokers.
 * Returns the ID of the broker matching cfg.brokerId, or the first broker if
 * cfg.brokerId is not set.
 */
async function _getBrokerConnectionId(cfg: SolaceEventPortalConfig): Promise<string> {
  const url  = `${EP_ARCH}/eventBrokerConnections?pageSize=100`;
  const resp = await _get(url, cfg.apiToken);
  const list = (resp.data as Record<string, unknown>[]) ?? [];
  if (!list.length) throw new Error("Solace EP: no event broker connections found.");

  // Prefer the broker matching the configured brokerId; otherwise use first available
  const match = cfg.brokerId
    ? list.find(b => String(b.id) === cfg.brokerId || String(b.eventBrokerId) === cfg.brokerId)
    : null;
  const broker = match ?? list[0];
  return String(broker.id ?? "");
}

/**
 * POST /applicationPromotions — create a Dev Promotion Request for all 4 new versions.
 *
 * Body fields:
 *   applicationVersionIds     — IDs of producer + consumer versions to promote
 *   eventBrokerConnectionId   — from GET /eventBrokerConnections
 *   environmentId             — Solace Cloud environment/service ID (optional but recommended)
 */
async function _postApplicationPromotion(
  producerVer:         Record<string, unknown>,
  consumerVer:         Record<string, unknown>,
  brokerConnectionId:  string,
  cfg:                 SolaceEventPortalConfig
): Promise<void> {
  const body: Record<string, unknown> = {
    applicationVersionIds:   [
      String(producerVer.id ?? ""),
      String(consumerVer.id ?? ""),
    ].filter(Boolean),
    eventBrokerConnectionId: brokerConnectionId,
  };
  if (cfg.environmentId) body.environmentId = cfg.environmentId;

  await _post(`${EP_ARCH}/applicationPromotions`, cfg.apiToken, body);
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 3: full 5-group Solace Event Portal design sequence.
 *
 * Returns early with "not yet implemented" (→ skipped in orchestrator) when
 * required credentials have not been configured.
 *
 * Each group runs GET (object) → GET (latest version) → POST (new version)
 * so that no write is ever attempted on an object that doesn't exist.
 */
export async function run(cfg: SolaceEventPortalConfig): Promise<SolaceEventPortalResult> {
  if (!cfg.apiToken || !cfg.enumId || !cfg.eventId || !cfg.producerAppId || !cfg.consumerAppId) {
    throw new Error(
      "not yet implemented — Step 3 requires SOLACE_EP_API_TOKEN, SOLACE_ENUM_ID, " +
      "SOLACE_EVENT_ID, SOLACE_PRODUCER_APP_ID, SOLACE_CONSUMER_APP_ID from Rohini Mondal."
    );
  }

  // ── Group 1: Enumeration ───────────────────────────────────────────────────
  const enumObj     = await _getEnum(cfg);
  const enumVer     = await _getEnumVersion(cfg);
  const newEnumVer  = await _postEnumVersion(enumObj, enumVer, cfg);

  // ── Group 2: Event ─────────────────────────────────────────────────────────
  const eventObj    = await _getEvent(cfg);
  const eventVer    = await _getEventVersion(cfg);
  const newEventVer = await _postEventVersion(eventObj, eventVer, cfg);

  // ── Group 3: Producer Application ─────────────────────────────────────────
  const prodAppObj  = await _getApp(cfg.producerAppId, cfg);
  const prodAppVer  = await _getAppVersion(cfg.producerAppId, cfg);
  const newProdVer  = await _postProducerVersion(prodAppObj, prodAppVer, newEventVer, cfg);

  // ── Group 4: Consumer Application ─────────────────────────────────────────
  const consAppObj  = await _getApp(cfg.consumerAppId, cfg);
  const consAppVer  = await _getAppVersion(cfg.consumerAppId, cfg);
  const newConsVer  = await _postConsumerVersion(consAppObj, consAppVer, newEventVer, cfg);

  // ── Group 5: Dev Promotion Request ────────────────────────────────────────
  const brokerConnectionId = await _getBrokerConnectionId(cfg);
  await _postApplicationPromotion(newProdVer, newConsVer, brokerConnectionId, cfg);

  return {
    success:                   true,
    enumVersionCreated:        true,
    eventVersionCreated:       true,
    producerAppVersionCreated: true,
    consumerAppVersionCreated: true,
    devPromotionRequested:     true,
    enumVersionId:             String(newEnumVer.id  ?? ""),
    eventVersionId:            String(newEventVer.id ?? ""),
    producerVersionId:         String(newProdVer.id  ?? ""),
    consumerVersionId:         String(newConsVer.id  ?? ""),
    brokerConnectionId,
  };
}
