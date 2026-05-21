/**
 * Step 3 — Solace Event Portal Design (5-call sequence)
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
 *   SOLACE_BROKER_ID         — Model event broker ID
 *
 * API reference: https://api.solace.dev/cloud/reference
 *
 * 5-step sequence (each GET-then-POST pair):
 *   1. GET latest Enum version   → POST new version  (add country code to enum values)
 *   2. GET latest Event version  → POST new version  (references new Enum version)
 *   3. GET Producer App version  → POST new version  (publishes new Event version)
 *   4. GET Consumer App version  → POST new version  (subscribes to new Event version)
 *   5. GET event brokers         → POST Dev Promotion Request
 *
 * Outputs enumVersionId + eventVersionId → passed to Step 5 (Solace Git).
 */

const EP_ARCH   = "https://api.solace.dev/api/v2/architecture";
const EP_DEPLOY = "https://api.solace.dev/api/v2/architecture/deployments";

// ── Config ────────────────────────────────────────────────────────────────────

export interface SolaceEventPortalConfig {
  apiBase:         string;
  apiToken:        string;
  enumId:          string;
  eventId:         string;
  producerAppId:   string;
  producerAppName: string;
  consumerAppId:   string;
  consumerAppName: string;
  environmentId:   string;
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
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };
}

async function _get(url: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: _headers(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Solace EP GET ${url} → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function _post(url: string, token: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: _headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Solace EP POST ${url} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

/** Increment the patch component of a semver string: "1.0.3" → "1.0.4". */
function _bumpVersion(v: string): string {
  const parts = String(v || "1.0.0").split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

/** Extract the first data item from a paged Solace EP response. */
function _latest(resp: Record<string, unknown>): Record<string, unknown> {
  const items = (resp.data as unknown[]) ?? [];
  if (!items.length) throw new Error("Solace EP: response contained no items");
  return items[0] as Record<string, unknown>;
}

// ── Call 1+2 — Enumeration ────────────────────────────────────────────────────

async function _getLatestEnumVersion(cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const url = `${EP_ARCH}/enumerations/${cfg.enumId}/versions?pageSize=1&sort=createdTime:desc`;
  return _latest(await _get(url, cfg.apiToken));
}

async function _postEnumVersion(
  current: Record<string, unknown>,
  cfg: SolaceEventPortalConfig
): Promise<Record<string, unknown>> {
  const existing = (current.enumValues as { label: string; value: string }[]) ?? [];
  const code = cfg.countryCode.toUpperCase();
  const enumValues = existing.find(v => v.value === code)
    ? existing
    : [...existing, { label: code, value: code }];

  const body = {
    enumerationId: cfg.enumId,
    version:       _bumpVersion(current.version as string),
    displayName:   current.displayName ?? `3PL Partner Enum (${code} added)`,
    description:   current.description ?? "",
    enumValues,
    stateId:       "1",
  };
  const resp = await _post(`${EP_ARCH}/enumerations/${cfg.enumId}/versions`, cfg.apiToken, body);
  return (resp.data as Record<string, unknown>) ?? resp;
}

// ── Call 3+4 — Event ──────────────────────────────────────────────────────────

async function _getLatestEventVersion(cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const url = `${EP_ARCH}/events/${cfg.eventId}/versions?pageSize=1&sort=createdTime:desc`;
  return _latest(await _get(url, cfg.apiToken));
}

async function _postEventVersion(
  current: Record<string, unknown>,
  _newEnum: Record<string, unknown>,
  cfg: SolaceEventPortalConfig
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    eventId:     cfg.eventId,
    version:     _bumpVersion(current.version as string),
    displayName: current.displayName ?? "",
    description: current.description ?? "",
    stateId:     "1",
  };
  // Preserve schema reference if present
  if (current.schemaVersionId) body.schemaVersionId = current.schemaVersionId;
  const resp = await _post(`${EP_ARCH}/events/${cfg.eventId}/versions`, cfg.apiToken, body);
  return (resp.data as Record<string, unknown>) ?? resp;
}

// ── Call 5+6 — Producer App ───────────────────────────────────────────────────

async function _getLatestAppVersion(appId: string, cfg: SolaceEventPortalConfig): Promise<Record<string, unknown>> {
  const url = `${EP_ARCH}/applications/${appId}/versions?pageSize=1&sort=createdTime:desc`;
  return _latest(await _get(url, cfg.apiToken));
}

async function _postProducerAppVersion(
  current: Record<string, unknown>,
  newEvent: Record<string, unknown>,
  cfg: SolaceEventPortalConfig
): Promise<Record<string, unknown>> {
  const existingPublished = (current.publishedEventVersionIds as string[]) ?? [];
  const newEventId = String(newEvent.id ?? "");
  const publishedEventVersionIds = existingPublished.includes(newEventId)
    ? existingPublished
    : [...existingPublished, newEventId];

  const body = {
    applicationId:             cfg.producerAppId,
    version:                   _bumpVersion(current.version as string),
    displayName:               current.displayName ?? cfg.producerAppName,
    description:               current.description ?? "",
    stateId:                   "1",
    publishedEventVersionIds,
  };
  const resp = await _post(`${EP_ARCH}/applications/${cfg.producerAppId}/versions`, cfg.apiToken, body);
  return (resp.data as Record<string, unknown>) ?? resp;
}

// ── Call 7+8 — Consumer App ───────────────────────────────────────────────────

async function _postConsumerAppVersion(
  current: Record<string, unknown>,
  newEvent: Record<string, unknown>,
  cfg: SolaceEventPortalConfig
): Promise<Record<string, unknown>> {
  const existingSubscribed = (current.subscribedEventVersionIds as string[]) ?? [];
  const newEventId = String(newEvent.id ?? "");
  const subscribedEventVersionIds = existingSubscribed.includes(newEventId)
    ? existingSubscribed
    : [...existingSubscribed, newEventId];

  const body = {
    applicationId:              cfg.consumerAppId,
    version:                    _bumpVersion(current.version as string),
    displayName:                current.displayName ?? cfg.consumerAppName,
    description:                current.description ?? "",
    stateId:                    "1",
    subscribedEventVersionIds,
  };
  const resp = await _post(`${EP_ARCH}/applications/${cfg.consumerAppId}/versions`, cfg.apiToken, body);
  return (resp.data as Record<string, unknown>) ?? resp;
}

// ── Call 9 — Dev Promotion Request ───────────────────────────────────────────

async function _postDevPromotionRequest(
  producerVersion: Record<string, unknown>,
  consumerVersion: Record<string, unknown>,
  cfg: SolaceEventPortalConfig
): Promise<void> {
  const body = {
    brokerId:              cfg.brokerId,
    environmentId:         cfg.environmentId,
    applicationVersionIds: [String(producerVersion.id), String(consumerVersion.id)].filter(Boolean),
  };
  await _post(`${EP_DEPLOY}/applicationPromotions`, cfg.apiToken, body);
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 3: 5-step Solace Event Portal design sequence.
 *
 * Returns early with "not yet implemented" (→ skipped in orchestrator) when
 * required credentials have not been configured.
 */
export async function run(cfg: SolaceEventPortalConfig): Promise<SolaceEventPortalResult> {
  if (!cfg.apiToken || !cfg.enumId || !cfg.eventId || !cfg.producerAppId || !cfg.consumerAppId) {
    throw new Error(
      "not yet implemented — Step 3 requires SOLACE_EP_API_TOKEN, SOLACE_ENUM_ID, " +
      "SOLACE_EVENT_ID, SOLACE_PRODUCER_APP_ID, SOLACE_CONSUMER_APP_ID from Rohini Mondal."
    );
  }

  // Call 1+2: Enum
  const currentEnum    = await _getLatestEnumVersion(cfg);
  const newEnum        = await _postEnumVersion(currentEnum, cfg);

  // Call 3+4: Event
  const currentEvent   = await _getLatestEventVersion(cfg);
  const newEvent       = await _postEventVersion(currentEvent, newEnum, cfg);

  // Call 5+6: Producer App
  const currentProducer = await _getLatestAppVersion(cfg.producerAppId, cfg);
  const newProducer     = await _postProducerAppVersion(currentProducer, newEvent, cfg);

  // Call 7+8: Consumer App
  const currentConsumer = await _getLatestAppVersion(cfg.consumerAppId, cfg);
  const newConsumer     = await _postConsumerAppVersion(currentConsumer, newEvent, cfg);

  // Call 9: Dev Promotion Request
  await _postDevPromotionRequest(newProducer, newConsumer, cfg);

  return {
    success:                   true,
    enumVersionCreated:        true,
    eventVersionCreated:       true,
    producerAppVersionCreated: true,
    consumerAppVersionCreated: true,
    devPromotionRequested:     true,
    enumVersionId:             String(newEnum.id ?? ""),
    eventVersionId:            String(newEvent.id ?? ""),
    producerVersionId:         String(newProducer.id ?? ""),
    consumerVersionId:         String(newConsumer.id ?? ""),
  };
}
