/**
 * Step 4 — Solace Queue Subscription Patch
 * ==========================================
 * Status    : Implemented (credentials still pending from Rohini Mondal)
 * Owner     : Rohini Mondal (Solace Team)
 *
 * Activation: set these env vars (or pass via form input.solace):
 *   SOLACE_SEMP_HOST      — SEMP v2 broker hostname
 *   SOLACE_SEMP_PORT      — SEMP v2 port (default: 943)
 *   SOLACE_SEMP_USERNAME  — SEMP admin username
 *   SOLACE_SEMP_PASSWORD  — SEMP admin password
 *   SOLACE_VPN_UAT        — VPN name for UAT
 *   SOLACE_VPN_PROD       — VPN name for PROD
 *   SOLACE_QUEUE_NAME     — Existing queue to append subscriptions to
 *
 * SEMP v2 endpoints used:
 *   GET  /SEMP/v2/config/msgVpns/{vpn}/queues/{queue}/subscriptions
 *   POST /SEMP/v2/config/msgVpns/{vpn}/queues/{queue}/subscriptions
 *
 * Safety: GET existing subscriptions first → duplicate-check per topic
 *         → POST only new topics. Never overwrites existing subscriptions.
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface SolaceQueueConfig {
  sempHost:     string;
  sempPort:     string;
  sempUsername: string;
  sempPassword: string;
  vpnNameUat:   string;
  vpnNameProd:  string;
  queueName:    string;
  /** All new subscription topics from onboarding input */
  newTopics:    string[];
  partnerId:    string;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface SolaceQueueResult {
  success:             boolean;
  uatSnapshot:         string[];
  prodSnapshot:        string[];
  uatTopicsAdded:      number;
  prodTopicsAdded:     number;
  uatTopicsSkipped:    number;
  prodTopicsSkipped:   number;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function _sempBase(cfg: SolaceQueueConfig): string {
  const port = cfg.sempPort || '943';
  const host = cfg.sempHost.replace(/^https?:\/\//, '');
  return `https://${host}:${port}/SEMP/v2/config`;
}

async function _getSubscriptions(cfg: SolaceQueueConfig, vpn: string): Promise<string[]> {
  const url = `${_sempBase(cfg)}/msgVpns/${encodeURIComponent(vpn)}/queues/${encodeURIComponent(cfg.queueName)}/subscriptions?count=100`;
  const res = await fetch(url, {
    headers: {
      Authorization: _basicAuth(cfg.sempUsername, cfg.sempPassword),
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SEMP GET subscriptions (${vpn}) → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json() as { data?: { subscriptionTopic: string }[] };
  return (json.data ?? []).map(s => s.subscriptionTopic);
}

async function _addSubscription(cfg: SolaceQueueConfig, vpn: string, topic: string): Promise<void> {
  const url = `${_sempBase(cfg)}/msgVpns/${encodeURIComponent(vpn)}/queues/${encodeURIComponent(cfg.queueName)}/subscriptions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: _basicAuth(cfg.sempUsername, cfg.sempPassword),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscriptionTopic: topic, msgVpnName: vpn }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SEMP POST subscription "${topic}" (${vpn}) → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function _patchVpn(
  cfg: SolaceQueueConfig,
  vpn: string,
  topics: string[]
): Promise<{ snapshot: string[]; added: number; skipped: number }> {
  const snapshot = await _getSubscriptions(cfg, vpn);
  let added = 0;
  let skipped = 0;
  for (const topic of topics) {
    if (!topic.trim()) continue;
    if (snapshot.includes(topic)) {
      skipped++;
    } else {
      await _addSubscription(cfg, vpn, topic);
      added++;
    }
  }
  return { snapshot, added, skipped };
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Execute Step 4: Append new subscription topics to the existing Solace queue
 * on both UAT and PROD VPNs.
 *
 * Returns early with "not yet implemented" (→ skipped in orchestrator) when
 * required credentials have not been configured.
 */
export async function run(cfg: SolaceQueueConfig): Promise<SolaceQueueResult> {
  if (!cfg.sempHost || !cfg.sempUsername || !cfg.sempPassword || !cfg.vpnNameUat || !cfg.queueName) {
    throw new Error(
      "not yet implemented — Step 4 requires SOLACE_SEMP_HOST, SOLACE_SEMP_USERNAME, " +
      "SOLACE_SEMP_PASSWORD, SOLACE_VPN_UAT, SOLACE_QUEUE_NAME from Rohini Mondal."
    );
  }

  const topics = cfg.newTopics.filter(t => t.trim().length > 0);
  if (!topics.length) {
    throw new Error("Step 4: no subscription topics provided in onboarding input.");
  }

  const uat  = await _patchVpn(cfg, cfg.vpnNameUat, topics);
  const prod = cfg.vpnNameProd
    ? await _patchVpn(cfg, cfg.vpnNameProd, topics)
    : { snapshot: [], added: 0, skipped: 0 };

  return {
    success:          true,
    uatSnapshot:      uat.snapshot,
    prodSnapshot:     prod.snapshot,
    uatTopicsAdded:   uat.added,
    prodTopicsAdded:  prod.added,
    uatTopicsSkipped: uat.skipped,
    prodTopicsSkipped:prod.skipped,
  };
}
