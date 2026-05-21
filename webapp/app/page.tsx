'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { OnboardingInput, Combo, EnvNavConfig, BtpInput, SolaceInput, GitHubInput } from '@/lib/types';
import { VALID_TX_CODES, TX_CODE_ORDER } from '@/lib/constants';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_TX: OnboardingInput['nav']['transaction_types'] = Object.fromEntries(
  TX_CODE_ORDER.map(c => [c, { enabled: ['sal_008','pur_019','inv_002','inv_003','inv_004'].includes(c), type: VALID_TX_CODES[c] }])
);

const EMPTY_ENV_NAV: EnvNavConfig = { host: '', company: '', soap_path: '', routing_code: '' };

const EMPTY_BTP: BtpInput = {
  apiHost: '', tokenUrl: '', clientId: '', clientSecret: '',
  suiteBaseUrl: '', productName: '', quotaPlan: '',
  d3ApproverEmail: '', valuemapArtifactId: '', valuemapPackageId: '',
};

const EMPTY_SOLACE: SolaceInput = {
  epApiToken: '', enumId: '', eventId: '',
  producerAppId: '', producerAppName: '',
  consumerAppId: '', consumerAppName: '',
  environmentId: '', brokerId: '', sempHost: '', sempPort: '943',
  sempUsername: '', sempPassword: '', vpnNameUat: '', vpnNameProd: '',
  queueName: '', subscriptionTopics: [''],
};

const EMPTY_GITHUB: GitHubInput = {
  githubPat: '', solaceRepoOwner: '', solaceRepoName: '', solaceBaseBranch: 'dev',
  solaceInputJsonPath: '', muleRepoOwner: '', muleRepoName: '', muleBaseBranch: 'dev',
  muleReviewerHandle: '', reviewerEmail: '',
  notificationChannel: 'email',
};

const INITIAL: OnboardingInput = {
  partner_comment: '', country_key: '', country_code: '', created_by: '',
  nav: {
    protocol: 'https', host: '', port: '7124', username: 'SVC_UAT_MULESOFT',
    domain: 'mars-ad.net', company: '', service: 'InterfaceWebServices',
    soap_port: '7124', soap_path: '', routing_code: '', use_common_cert: true,
    transaction_types: DEFAULT_TX,
  },
  nav_tst: undefined, nav_prod: undefined,
  translation: {
    receiver_name: '', message_types: ['despatchStock'],
    source_destination_combinations: [{ value_from: '', value_to: '' }],
    uom_mappings: [{ value_from: 'EA', value_to: 'UNIT' }],
  },
  btp: undefined, solace: undefined, github: undefined,
};

// ── Primitive helpers ─────────────────────────────────────────────────────────

function Badge({ n, color }: { n: number | string; color: string }) {
  return <span className={`section-badge ${color}`}>{n}</span>;
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="field-label">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="field-error">{msg}</p> : null;
}

function Input({
  value, onChange, placeholder, err, type = 'text', className = '',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  err?: string; type?: string; className?: string;
}) {
  return (
    <>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`field-input ${err ? 'border-red-400 focus:ring-red-400' : ''} ${className}`}
        autoComplete={type === 'password' ? 'new-password' : undefined}
      />
      <Err msg={err} />
    </>
  );
}

function ComboTable({
  rows, onChange, addLabel, col1, col2, placeholder1, placeholder2,
}: {
  rows: Combo[]; onChange: (rows: Combo[]) => void;
  addLabel: string; col1: string; col2: string;
  placeholder1: string; placeholder2: string;
}) {
  const update = (i: number, k: keyof Combo, v: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add    = () => onChange([...rows, { value_from: '', value_to: '' }]);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 w-1/2">{col1}</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 w-5/12">{col2}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-2 py-1.5">
                  <input className="field-input text-xs" value={row.value_from}
                    onChange={e => update(i, 'value_from', e.target.value)} placeholder={placeholder1} />
                </td>
                <td className="px-2 py-1.5">
                  <input className="field-input text-xs" value={row.value_to}
                    onChange={e => update(i, 'value_to', e.target.value)} placeholder={placeholder2} />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button type="button" onClick={() => remove(i)} disabled={rows.length === 1}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition text-lg leading-none">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="mt-2 text-brand text-xs font-medium hover:underline">
        + {addLabel}
      </button>
    </div>
  );
}

// ── Section toggle wrapper ────────────────────────────────────────────────────

function OptionalSection({
  badge, badgeColor, borderColor, title, subtitle, hint,
  enabled, onToggle, toggleLabel, children,
}: {
  badge: string | number; badgeColor: string; borderColor: string;
  title: string; subtitle: string; hint?: string;
  enabled: boolean; onToggle: (v: boolean) => void; toggleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`section-card ${borderColor}`}>
      <div className="section-title">
        <Badge n={badge} color={badgeColor} />
        <div className="flex-1">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer ml-auto shrink-0">
          <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
          <span className="text-sm text-gray-600">{toggleLabel}</span>
        </label>
      </div>
      {hint && !enabled && (
        <p className="mt-3 text-xs text-gray-400 italic">{hint}</p>
      )}
      {enabled && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}

// ── ENV NAV section (TST / PROD) ──────────────────────────────────────────────

function EnvNavSection({
  envLabel, envKey, data, onChange, errors,
}: {
  envLabel: string; envKey: 'nav_tst' | 'nav_prod';
  data: EnvNavConfig | undefined;
  onChange: (v: EnvNavConfig | undefined) => void;
  errors: Record<string, string>;
}) {
  const enabled     = data !== undefined;
  const nav         = data ?? EMPTY_ENV_NAV;
  const set         = (k: keyof EnvNavConfig, v: string) => onChange({ ...nav, [k]: v });
  const borderColor = envKey === 'nav_tst' ? 'border-orange-100' : 'border-purple-100';
  const badgeColor  = envKey === 'nav_tst' ? 'bg-orange-600'     : 'bg-purple-600';
  const badge       = envKey === 'nav_tst' ? 'T'                  : 'P';

  return (
    <OptionalSection
      badge={badge} badgeColor={badgeColor} borderColor={borderColor}
      title={`${envLabel} NAV Config`}
      subtitle={`Server details that differ from DEV for ${envLabel} — patches ${envLabel.toLowerCase()}.yaml`}
      enabled={enabled}
      onToggle={v => onChange(v ? { ...EMPTY_ENV_NAV } : undefined)}
      toggleLabel={`Include ${envLabel}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label required>Host</Label>
          <Input value={nav.host} onChange={v => set('host', v)}
            placeholder="azr-xxx1234.mars-ad.net" err={errors[`${envKey}.host`]} />
        </div>
        <div>
          <Label required>Company</Label>
          <Input value={nav.company} onChange={v => set('company', v)}
            placeholder={`Company(${envLabel} - Royal Canin France)`} err={errors[`${envKey}.company`]} />
        </div>
      </div>
      <div>
        <Label required>SOAP Path</Label>
        <Input value={nav.soap_path} onChange={v => set('soap_path', v)}
          placeholder={`/sop_fra_${envLabel.toLowerCase()}_01/WS/.../Codeunit/InterfaceWebServices?wsdl`}
          err={errors[`${envKey}.soap_path`]} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label required>Routing Code</Label>
          <Input value={nav.routing_code} onChange={v => set('routing_code', v.toUpperCase())}
            placeholder={`NAV_FM_IN_${envLabel.toUpperCase()}_FRA`} err={errors[`${envKey}.routing_code`]} />
        </div>
        <div>
          <Label>Port override</Label>
          <Input value={nav.port ?? ''} onChange={v => set('port', v)} placeholder="7124 (same as DEV)" />
        </div>
        <div>
          <Label>Username override</Label>
          <Input value={nav.username ?? ''} onChange={v => set('username', v)} placeholder="SVC_UAT_MULESOFT" />
        </div>
      </div>
    </OptionalSection>
  );
}

// ── SAP BTP section ───────────────────────────────────────────────────────────

function BtpSection({
  data, onChange,
}: { data: BtpInput | undefined; onChange: (v: BtpInput | undefined) => void }) {
  const btp = data ?? EMPTY_BTP;
  const s = (k: keyof BtpInput, v: string) => onChange({ ...btp, [k]: v });

  return (
    <OptionalSection
      badge="B" badgeColor="bg-rose-600" borderColor="border-rose-100"
      title="SAP BTP Integration Suite"
      subtitle="Steps 1 + 2 — App creation and Value Mapping (currently stubbed, awaiting Parag Shende)"
      hint="Provide these credentials once Parag Shende shares the Service Key and payload schema."
      enabled={data !== undefined}
      onToggle={v => onChange(v ? { ...EMPTY_BTP } : undefined)}
      toggleLabel="Include BTP config"
    >
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Steps 1+2 are stubbed. Filling this section now means it will be used automatically once implemented.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>API Management Host</Label>
          <Input value={btp.apiHost} onChange={v => s('apiHost', v)}
            placeholder="https://apim-management.cfapps.us21.hana.ondemand.com" />
        </div>
        <div>
          <Label>OAuth2 Token URL</Label>
          <Input value={btp.tokenUrl} onChange={v => s('tokenUrl', v)}
            placeholder="https://...authentication.us21.hana.ondemand.com/oauth/token" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Client ID (Service Key)</Label>
          <Input value={btp.clientId} onChange={v => s('clientId', v)} placeholder="sb-xxxxx" />
        </div>
        <div>
          <Label>Client Secret</Label>
          <Input type="password" value={btp.clientSecret} onChange={v => s('clientSecret', v)} placeholder="••••••••" />
        </div>
      </div>

      <div>
        <Label>Integration Suite Base URL</Label>
        <Input value={btp.suiteBaseUrl} onChange={v => s('suiteBaseUrl', v)}
          placeholder="https://effem-glb-ci-dev01-pr.integrationsuite.cfapps.us21.hana.ondemand.com" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Product Name</Label>
          <Input value={btp.productName} onChange={v => s('productName', v)} placeholder="3PL_Integration" />
        </div>
        <div>
          <Label>Quota Plan</Label>
          <Input value={btp.quotaPlan} onChange={v => s('quotaPlan', v)} placeholder="standard" />
        </div>
        <div>
          <Label>D3 Approver Email</Label>
          <Input value={btp.d3ApproverEmail} onChange={v => s('d3ApproverEmail', v)} placeholder="approver@effem.com" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Value Map Artifact ID</Label>
          <Input value={btp.valuemapArtifactId} onChange={v => s('valuemapArtifactId', v)} placeholder="NAV_3PL_ValueMapping" />
        </div>
        <div>
          <Label>Value Map Package ID</Label>
          <Input value={btp.valuemapPackageId} onChange={v => s('valuemapPackageId', v)} placeholder="NAVIntegration3PL" />
        </div>
      </div>
    </OptionalSection>
  );
}

// ── Solace section ────────────────────────────────────────────────────────────

function SolaceSection({
  data, onChange,
}: { data: SolaceInput | undefined; onChange: (v: SolaceInput | undefined) => void }) {
  const sol = data ?? EMPTY_SOLACE;
  const s = (k: keyof SolaceInput, v: unknown) => onChange({ ...sol, [k]: v });

  const updateTopic = (i: number, v: string) => {
    const topics = [...sol.subscriptionTopics];
    topics[i] = v;
    s('subscriptionTopics', topics);
  };
  const addTopic    = () => s('subscriptionTopics', [...sol.subscriptionTopics, '']);
  const removeTopic = (i: number) => s('subscriptionTopics', sol.subscriptionTopics.filter((_, idx) => idx !== i));

  return (
    <OptionalSection
      badge="S" badgeColor="bg-cyan-700" borderColor="border-cyan-100"
      title="Solace Event Portal + Broker"
      subtitle="Steps 3 + 4 + 5 — Event Portal bindings, queue subscriptions, Git update (stubbed, awaiting Rohini Mondal)"
      hint="Provide these once Rohini Mondal shares the EP API token and object IDs."
      enabled={data !== undefined}
      onToggle={v => onChange(v ? { ...EMPTY_SOLACE } : undefined)}
      toggleLabel="Include Solace config"
    >
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Steps 3+4+5 are stubbed. Filling this now prepares the input for when they are implemented.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>EP API Token</Label>
          <Input type="password" value={sol.epApiToken} onChange={v => s('epApiToken', v)} placeholder="••••••••" />
        </div>
        <div>
          <Label>Region ISO</Label>
          <Input value={sol.regionIso ?? ''} onChange={v => s('regionIso', v)} placeholder="eu-west-1 (optional)" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Enum ID</Label>
          <Input value={sol.enumId} onChange={v => s('enumId', v)} placeholder="3pl-partner-enum-id" />
        </div>
        <div>
          <Label>Event ID</Label>
          <Input value={sol.eventId} onChange={v => s('eventId', v)} placeholder="3pl-inbound-event-id" />
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-1">Producer &amp; Consumer Apps</p>
      <p className="text-xs text-gray-400">Provide the display name shown in Event Portal UI and the API object ID.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Producer App Name</Label>
          <Input value={sol.producerAppName} onChange={v => s('producerAppName', v)} placeholder="petc-rc-mulesoft-producer" />
        </div>
        <div>
          <Label>Producer App ID</Label>
          <Input value={sol.producerAppId} onChange={v => s('producerAppId', v)} placeholder="mulesoft-producer-app-id" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Consumer App Name</Label>
          <Input value={sol.consumerAppName} onChange={v => s('consumerAppName', v)} placeholder="petc-rc-navision-3plspl-consumer" />
        </div>
        <div>
          <Label>Consumer App ID</Label>
          <Input value={sol.consumerAppId} onChange={v => s('consumerAppId', v)} placeholder="3pl-consumer-app-id" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Environment ID</Label>
          <Input value={sol.environmentId} onChange={v => s('environmentId', v)} placeholder="solace-env-id" />
        </div>
        <div>
          <Label>Broker ID</Label>
          <Input value={sol.brokerId} onChange={v => s('brokerId', v)} placeholder="solace-broker-id" />
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-2">SEMP Broker Config</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>SEMP Host</Label>
          <Input value={sol.sempHost} onChange={v => s('sempHost', v)} placeholder="marstest-saz-use2-glb01.messaging.solace.cloud" />
        </div>
        <div>
          <Label>SEMP Port</Label>
          <Input value={sol.sempPort} onChange={v => s('sempPort', v)} placeholder="943" />
        </div>
        <div>
          <Label>SEMP Username</Label>
          <Input value={sol.sempUsername} onChange={v => s('sempUsername', v)} placeholder="admin" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>SEMP Password</Label>
          <Input type="password" value={sol.sempPassword} onChange={v => s('sempPassword', v)} placeholder="••••••••" />
        </div>
        <div>
          <Label>VPN Name UAT</Label>
          <Input value={sol.vpnNameUat} onChange={v => s('vpnNameUat', v)} placeholder="effem-vpn-uat" />
        </div>
        <div>
          <Label>VPN Name PROD</Label>
          <Input value={sol.vpnNameProd} onChange={v => s('vpnNameProd', v)} placeholder="effem-vpn-prod" />
        </div>
      </div>
      <div>
        <Label>Queue Name</Label>
        <Input value={sol.queueName} onChange={v => s('queueName', v)} placeholder="Q.3PL.INBOUND.EFFEM" />
      </div>

      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-1">Subscription Topics</p>
      <div className="space-y-2">
        {sol.subscriptionTopics.map((t, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input className="field-input text-sm flex-1" value={t}
              onChange={e => updateTopic(i, e.target.value)}
              placeholder="mars/3pl/petc-rc-navision-3plspl-sys/despatchStock/>" />
            <button type="button" onClick={() => removeTopic(i)} disabled={sol.subscriptionTopics.length === 1}
              className="text-gray-400 hover:text-red-500 disabled:opacity-30 text-xl leading-none">×</button>
          </div>
        ))}
        <button type="button" onClick={addTopic} className="text-brand text-xs font-medium hover:underline">
          + Add topic
        </button>
      </div>
    </OptionalSection>
  );
}

// ── GitHub Device Code Login ──────────────────────────────────────────────────

type DeviceState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'waiting'; userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresAt: number }
  | { phase: 'authorized'; login: string }
  | { phase: 'expired' }
  | { phase: 'denied' }
  | { phase: 'error'; detail: string };

function GitHubDeviceLogin({ onToken }: { onToken: (token: string) => void }) {
  const [state, setState] = useState<DeviceState>({ phase: 'idle' });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied]           = useState(false);
  const pollRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current)  { clearTimeout(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Start countdown timer
  const startTimer = useCallback((expiresAt: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s === 0) {
        stopPolling();
        setState({ phase: 'expired' });
      }
    }, 1000);
  }, [stopPolling]);

  // Poll GitHub via our proxy endpoint
  const schedulePoll = useCallback((deviceCode: string, intervalSecs: number) => {
    pollRef.current = setTimeout(async () => {
      try {
        const res  = await fetch('/api/github/device-poll', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ device_code: deviceCode }),
        });
        const data = await res.json() as {
          status: string; token?: string; interval?: number; detail?: string;
        };

        if (data.status === 'authorized' && data.token) {
          stopPolling();
          onToken(data.token);
          setState({ phase: 'authorized', login: 'GitHub' });
          return;
        }
        if (data.status === 'expired')  { stopPolling(); setState({ phase: 'expired' }); return; }
        if (data.status === 'denied')   { stopPolling(); setState({ phase: 'denied' });  return; }
        if (data.status === 'error')    { stopPolling(); setState({ phase: 'error', detail: data.detail ?? 'Unknown' }); return; }

        // pending or slow_down — keep polling
        const nextInterval = data.status === 'slow_down' ? (data.interval ?? intervalSecs + 5) : intervalSecs;
        schedulePoll(deviceCode, nextInterval);
      } catch {
        schedulePoll(deviceCode, intervalSecs); // retry on network hiccup
      }
    }, intervalSecs * 1000);
  }, [onToken, stopPolling]);

  const start = async () => {
    stopPolling();
    setState({ phase: 'loading' });
    try {
      const res  = await fetch('/api/github/device-start', { method: 'POST' });
      const data = await res.json() as {
        user_code?: string; verification_uri?: string; device_code?: string;
        expires_in?: number; interval?: number; error?: string;
      };

      if (!res.ok || data.error) {
        setState({ phase: 'error', detail: data.error ?? `HTTP ${res.status}` });
        return;
      }

      const expiresAt = Date.now() + (data.expires_in ?? 900) * 1000;
      setState({
        phase:           'waiting',
        userCode:        data.user_code!,
        verificationUri: data.verification_uri!,
        deviceCode:      data.device_code!,
        interval:        data.interval ?? 5,
        expiresAt,
      });
      setSecondsLeft(data.expires_in ?? 900);
      startTimer(expiresAt);
      schedulePoll(data.device_code!, data.interval ?? 5);
    } catch {
      setState({ phase: 'error', detail: 'Could not reach the server.' });
    }
  };

  const cancel = () => {
    stopPolling();
    setState({ phase: 'idle' });
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (state.phase === 'idle') {
    return (
      <button
        type="button"
        onClick={start}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        Login with GitHub
      </button>
    );
  }

  if (state.phase === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        Contacting GitHub…
      </div>
    );
  }

  if (state.phase === 'authorized') {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <span className="text-green-600 text-lg">✓</span>
        <p className="text-sm text-green-800 font-medium">GitHub authorized — PAT auto-filled</p>
      </div>
    );
  }

  if (state.phase === 'expired') {
    return (
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <p className="text-sm text-amber-800 flex-1">Code expired. Please start again.</p>
        <button type="button" onClick={start} className="text-xs text-brand font-medium hover:underline">Retry</button>
      </div>
    );
  }

  if (state.phase === 'denied') {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <p className="text-sm text-red-800 flex-1">Access denied by GitHub.</p>
        <button type="button" onClick={start} className="text-xs text-brand font-medium hover:underline">Retry</button>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <p className="text-sm text-red-800 flex-1">{state.detail}</p>
        <button type="button" onClick={start} className="text-xs text-brand font-medium hover:underline">Retry</button>
      </div>
    );
  }

  // phase === 'waiting'
  const w = state as Extract<DeviceState, { phase: 'waiting' }>;
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 space-y-4">
      {/* Step instruction */}
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">GitHub Device Authorization</p>

      {/* Step 1: copy code */}
      <div>
        <p className="text-xs text-gray-400 mb-2">
          <span className="text-white font-semibold">Step 1</span> — Copy this one-time code:
        </p>
        <div className="flex items-center gap-3">
          <code className="text-2xl font-mono font-bold tracking-[0.25em] text-green-400 bg-gray-800 px-4 py-2 rounded-lg border border-gray-600 select-all">
            {w.userCode}
          </code>
          <button
            type="button"
            onClick={() => copyCode(w.userCode)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600 transition-colors"
          >
            {copied ? (
              <><span className="text-green-400">✓</span> Copied!</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg> Copy</>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: open GitHub */}
      <div>
        <p className="text-xs text-gray-400 mb-2">
          <span className="text-white font-semibold">Step 2</span> — Open GitHub and paste the code:
        </p>
        <a
          href={w.verificationUri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          Open github.com/login/device
          <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
        </a>
      </div>

      {/* Step 3: waiting */}
      <div className="flex items-center justify-between border-t border-gray-700 pt-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="animate-spin h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          <span><span className="text-white font-semibold">Step 3</span> — Waiting for you to authorize…</span>
          <span className="text-gray-500">Expires in <span className="text-amber-400 font-mono">{fmtTime(secondsLeft)}</span></span>
        </div>
        <button type="button" onClick={cancel}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── GitHub / Notification section ─────────────────────────────────────────────

function GitHubSection({
  data, onChange,
}: { data: GitHubInput | undefined; onChange: (v: GitHubInput | undefined) => void }) {
  const gh = data ?? EMPTY_GITHUB;
  const s = (k: keyof GitHubInput, v: string) => onChange({ ...gh, [k]: v });

  return (
    <OptionalSection
      badge="G" badgeColor="bg-gray-700" borderColor="border-gray-200"
      title="GitHub + Notification Config"
      subtitle="Steps 5 + 6 + 9 — Solace Git, MuleSoft feature branch, PR creation and notification (stubbed)"
      hint="Provide a GitHub PAT with repo write access and reviewer details once Sravani Kare confirms."
      enabled={data !== undefined}
      onToggle={v => onChange(v ? { ...EMPTY_GITHUB } : undefined)}
      toggleLabel="Include GitHub config"
    >
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Steps 5+6+9 are stubbed. Input is persisted and forwarded once they are implemented.
      </p>

      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">GitHub Authentication</p>
        <p className="text-xs text-gray-500 mb-3">
          Authorize via GitHub Device Flow <span className="text-green-700 font-medium">(recommended)</span> — no PAT copy-paste needed.
          Or paste a token manually below.
        </p>
        <GitHubDeviceLogin onToken={v => s('githubPat', v)} />
      </div>

      <div>
        <Label>GitHub Personal Access Token</Label>
        <Input type="password" value={gh.githubPat} onChange={v => s('githubPat', v)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
        <p className="text-xs text-gray-400 mt-1">
          Filled automatically after device login, or paste a fine-grained PAT with <code className="bg-gray-100 px-1 rounded">repo</code> write access.
        </p>
      </div>

      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-1">Solace Repository</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Org / Owner</Label>
          <Input value={gh.solaceRepoOwner} onChange={v => s('solaceRepoOwner', v)} placeholder="MarsIncorporated" />
        </div>
        <div>
          <Label>Repo Name</Label>
          <Input value={gh.solaceRepoName} onChange={v => s('solaceRepoName', v)} placeholder="solace-config" />
        </div>
        <div>
          <Label>Base Branch</Label>
          <Input value={gh.solaceBaseBranch} onChange={v => s('solaceBaseBranch', v)} placeholder="dev" />
        </div>
      </div>
      <div>
        <Label>input.json Path in Repo</Label>
        <Input value={gh.solaceInputJsonPath} onChange={v => s('solaceInputJsonPath', v)}
          placeholder="config/input.json" />
      </div>

      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-1">MuleSoft Repository</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Org / Owner</Label>
          <Input value={gh.muleRepoOwner} onChange={v => s('muleRepoOwner', v)} placeholder="MarsIncorporated" />
        </div>
        <div>
          <Label>Repo Name</Label>
          <Input value={gh.muleRepoName} onChange={v => s('muleRepoName', v)} placeholder="mule-nav-integration" />
        </div>
        <div>
          <Label>Base Branch</Label>
          <Input value={gh.muleBaseBranch} onChange={v => s('muleBaseBranch', v)} placeholder="dev" />
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide pt-1">PR + Notification</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Reviewer GitHub Handle</Label>
          <Input value={gh.muleReviewerHandle} onChange={v => s('muleReviewerHandle', v)} placeholder="sravani-kare" />
        </div>
        <div>
          <Label>Reviewer Email</Label>
          <Input type="email" value={gh.reviewerEmail} onChange={v => s('reviewerEmail', v)}
            placeholder="sravani.kare@effem.com" />
        </div>
      </div>
      <div>
        <Label>Notification Channel</Label>
        <select
          value={gh.notificationChannel}
          onChange={e => s('notificationChannel', e.target.value)}
          className="field-input"
        >
          <option value="email">Email (SMTP)</option>
          <option value="teams">Microsoft Teams Webhook</option>
          <option value="slack">Slack Webhook</option>
        </select>
      </div>
      {gh.notificationChannel === 'email' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>SMTP Host</Label>
            <Input value={gh.smtpHost ?? ''} onChange={v => s('smtpHost', v)} placeholder="smtp.office365.com" />
          </div>
          <div>
            <Label>From Address</Label>
            <Input value={gh.smtpFrom ?? ''} onChange={v => s('smtpFrom', v)} placeholder="automation@effem.com" />
          </div>
        </div>
      )}
      {gh.notificationChannel === 'teams' && (
        <div>
          <Label>Teams Webhook URL</Label>
          <Input value={gh.teamsWebhookUrl ?? ''} onChange={v => s('teamsWebhookUrl', v)}
            placeholder="https://effem.webhook.office.com/..." />
        </div>
      )}
      {gh.notificationChannel === 'slack' && (
        <div>
          <Label>Slack Webhook URL</Label>
          <Input value={gh.slackWebhookUrl ?? ''} onChange={v => s('slackWebhookUrl', v)}
            placeholder="https://hooks.slack.com/services/..." />
        </div>
      )}
    </OptionalSection>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type RunMode = 'yaml-only' | 'orchestrate';

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm]         = useState<OnboardingInput>(INITIAL);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(false);
  const [runMode, setRunMode]   = useState<RunMode>('yaml-only');
  const [serverError, setServerError] = useState('');

  const setNav   = (k: keyof OnboardingInput['nav'], v: unknown) =>
    setForm(f => ({ ...f, nav: { ...f.nav, [k]: v } }));
  const setTrans = (k: keyof OnboardingInput['translation'], v: unknown) =>
    setForm(f => ({ ...f, translation: { ...f.translation, [k]: v } }));

  const toggleTx = (code: string) =>
    setNav('transaction_types', {
      ...form.nav.transaction_types,
      [code]: { ...form.nav.transaction_types[code], enabled: !form.nav.transaction_types[code].enabled },
    });

  const toggleMsgType = (mt: string) => {
    const curr = form.translation.message_types;
    setTrans('message_types', curr.includes(mt) ? curr.filter(x => x !== mt) : [...curr, mt]);
  };

  const handleSubmit = async (e: React.FormEvent, mode: RunMode) => {
    e.preventDefault();
    setLoading(true);
    setRunMode(mode);
    setErrors({});
    setServerError('');

    const endpoint = mode === 'orchestrate' ? '/api/orchestrate' : '/api/run';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors)  setErrors(data.errors);
        else if (data.details) setErrors(data.details);
        else setServerError(data.error ?? 'Unknown server error');
      } else {
        if (mode === 'orchestrate') {
          // Orchestration result — go to result page with run_id from embedded runResult
          const runId = data.runResult?.run_id ?? data.runId;
          if (runId) router.push(`/result/${runId}?mode=orchestrate`);
          else setServerError('Orchestration completed but no run ID returned.');
        } else {
          router.push(`/result/${data.run_id}`);
        }
      }
    } catch {
      setServerError('Could not reach the server. Is the app running?');
    } finally {
      setLoading(false);
    }
  };

  const yamlCount = [true, !!form.nav_tst, !!form.nav_prod, true].filter(Boolean).length;

  return (
    <form noValidate>

      {/* ── Section 1: Partner Identification ─────────────────── */}
      <div className="section-card">
        <div className="section-title">
          <Badge n={1} color="bg-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-800">Partner Identification</h2>
            <p className="text-xs text-gray-500">Basic details for this onboarding request</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label required>Country Key</Label>
            <Input value={form.country_key}
              onChange={v => setForm(f => ({ ...f, country_key: v.toLowerCase().replace(/[^a-z]/g, '') }))}
              placeholder="e.g. france" err={errors.country_key} />
            <p className="text-xs text-gray-400 mt-1">Full nav block key — lowercase letters only</p>
          </div>
          <div>
            <Label required>Country Code</Label>
            <Input value={form.country_code}
              onChange={v => setForm(f => ({ ...f, country_code: v.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
              placeholder="e.g. fr" err={errors.country_code} />
            <p className="text-xs text-gray-400 mt-1">Short routing code — added to validCountriesList</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Partner Comment</Label>
            <Input value={form.partner_comment}
              onChange={v => setForm(f => ({ ...f, partner_comment: v }))}
              placeholder="e.g. Added France for SPL partner" />
          </div>
          <div>
            <Label>Created By</Label>
            <Input value={form.created_by}
              onChange={v => setForm(f => ({ ...f, created_by: v }))}
              placeholder="Your name" />
          </div>
        </div>
      </div>

      {/* ── Section 2: DEV NAV Config ─────────────────────────── */}
      <div className="section-card border-blue-100">
        <div className="section-title">
          <Badge n={2} color="bg-blue-700" />
          <div>
            <h2 className="font-semibold text-gray-800">DEV NAV Server Configuration</h2>
            <p className="text-xs text-gray-500">Navision SOAP endpoint — DEV environment (also used for app.yaml base nav block)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label required>Host</Label>
            <Input value={form.nav.host} onChange={v => setNav('host', v)}
              placeholder="azr-xxx1234.mars-ad.net" err={errors['nav.host']} />
          </div>
          <div>
            <Label required>Company</Label>
            <Input value={form.nav.company} onChange={v => setNav('company', v)}
              placeholder="Company(UAT - Royal Canin France)" err={errors['nav.company']} />
          </div>
        </div>

        <div className="mb-4">
          <Label required>SOAP Path</Label>
          <Input value={form.nav.soap_path} onChange={v => setNav('soap_path', v)}
            placeholder="/sop_fra_uat_01/WS/UAT - Royal Canin France/Codeunit/InterfaceWebServices?wsdl"
            err={errors['nav.soap_path']} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label required>Routing Code</Label>
            <Input value={form.nav.routing_code} onChange={v => setNav('routing_code', v)}
              placeholder="NAV_FM_IN_UAT_FRA" err={errors['nav.routing_code']} />
          </div>
          <div>
            <Label>Port</Label>
            <Input value={form.nav.port} onChange={v => setNav('port', v)} placeholder="7124" />
          </div>
          <div>
            <Label>SOAP Port</Label>
            <Input value={form.nav.soap_port} onChange={v => setNav('soap_port', v)} placeholder="7124" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label>Username</Label>
            <Input value={form.nav.username} onChange={v => setNav('username', v)} placeholder="SVC_UAT_MULESOFT" />
          </div>
          <div>
            <Label>Domain</Label>
            <Input value={form.nav.domain} onChange={v => setNav('domain', v)} placeholder="mars-ad.net" />
          </div>
          <div>
            <Label>Service</Label>
            <Input value={form.nav.service} onChange={v => setNav('service', v)} placeholder="InterfaceWebServices" />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.nav.use_common_cert}
            onChange={e => setNav('use_common_cert', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
          <span className="text-sm text-gray-700">
            Use common certificate <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">nav-nonprod.jks</code>
          </span>
        </label>
      </div>

      {/* ── TST + PROD Nav overrides ──────────────────────────── */}
      <EnvNavSection envLabel="TST" envKey="nav_tst"
        data={form.nav_tst} onChange={v => setForm(f => ({ ...f, nav_tst: v }))} errors={errors} />
      <EnvNavSection envLabel="PROD" envKey="nav_prod"
        data={form.nav_prod} onChange={v => setForm(f => ({ ...f, nav_prod: v }))} errors={errors} />

      {/* ── Section 3: Transaction Types ──────────────────────── */}
      <div className="section-card border-indigo-100">
        <div className="section-title">
          <Badge n={3} color="bg-indigo-600" />
          <div>
            <h2 className="font-semibold text-gray-800">Transaction Types</h2>
            <p className="text-xs text-gray-500">Select all transaction types supported by this partner (same across all environments)</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {TX_CODE_ORDER.map(code => (
            <label key={code} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
              form.nav.transaction_types[code].enabled
                ? 'bg-indigo-50 border-indigo-300'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}>
              <input type="checkbox" checked={form.nav.transaction_types[code].enabled}
                onChange={() => toggleTx(code)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <div>
                <p className="text-xs font-mono font-semibold text-gray-700">{code}</p>
                <p className="text-xs text-gray-500">{VALID_TX_CODES[code]}</p>
              </div>
            </label>
          ))}
        </div>
        <Err msg={errors.transaction_types} />
      </div>

      {/* ── Section 4: Translation ────────────────────────────── */}
      <div className="section-card border-green-100">
        <div className="section-title">
          <Badge n={4} color="bg-green-700" />
          <div>
            <h2 className="font-semibold text-gray-800">Translation Configuration</h2>
            <p className="text-xs text-gray-500">BTP ClientID, message types, plant/customer mappings, UOM mappings</p>
          </div>
        </div>

        <div className="mb-5">
          <Label required>BTP ClientID / Receiver Name</Label>
          <Input value={form.translation.receiver_name}
            onChange={v => setTrans('receiver_name', v)}
            placeholder="petc-rc-navision-3plspl-sys"
            err={errors['translation.receiver_name']} />
          <p className="text-xs text-gray-400 mt-1">BTP ClientID from provisioning — also used as Solace 3PL Partner ID</p>
        </div>

        <div className="mb-5">
          <Label>Message Types</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {['despatchStock', 'receiptAdvice', 'stockAdjustment'].map(mt => (
              <label key={mt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                form.translation.message_types.includes(mt)
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
                <input type="checkbox" checked={form.translation.message_types.includes(mt)}
                  onChange={() => toggleMsgType(mt)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <span className="font-mono text-xs">{mt}</span>
              </label>
            ))}
          </div>
          <Err msg={errors['translation.message_types']} />
        </div>

        <div className="mb-5">
          <Label>Plant / Customer Combinations</Label>
          <p className="text-xs text-gray-400 mb-2">Internal Mars codes → 3PL external codes</p>
          <ComboTable rows={form.translation.source_destination_combinations}
            onChange={rows => setTrans('source_destination_combinations', rows)}
            addLabel="Add combination" col1="ValueFrom (internal)" col2="ValueTo (3PL)"
            placeholder1="PLANT-FR1-PLANT-FR2" placeholder2="spl_001" />
          <Err msg={errors.combinations} />
        </div>

        <div>
          <Label>UOM Mappings</Label>
          <p className="text-xs text-gray-400 mb-2">Internal Mars units → 3PL units</p>
          <ComboTable rows={form.translation.uom_mappings}
            onChange={rows => setTrans('uom_mappings', rows)}
            addLabel="Add UOM mapping" col1="Internal UOM" col2="3PL UOM"
            placeholder1="EA" placeholder2="UNIT" />
        </div>
      </div>

      {/* ── Section 5: SAP BTP ────────────────────────────────── */}
      <BtpSection data={form.btp} onChange={v => setForm(f => ({ ...f, btp: v }))} />

      {/* ── Section 6: Solace ─────────────────────────────────── */}
      <SolaceSection data={form.solace} onChange={v => setForm(f => ({ ...f, solace: v }))} />

      {/* ── Section 7: GitHub + Notifications ────────────────── */}
      <GitHubSection data={form.github} onChange={v => setForm(f => ({ ...f, github: v }))} />

      {/* ── Submit area ───────────────────────────────────────── */}
      {serverError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {serverError}
        </div>
      )}
      {Object.keys(errors).length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          Please fix the highlighted fields above before submitting.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-5">
        <p className="text-sm font-semibold text-gray-700 mb-1">Run Mode</p>
        <p className="text-xs text-gray-500 mb-4">
          <strong>YAML + Translation</strong> patches the config files and generates translation rows instantly.{' '}
          <strong>Full Orchestration</strong> additionally runs BTP / Solace / GitHub steps (stubbed steps are skipped automatically).
        </p>
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <p className="text-xs text-gray-400">
            Will patch: <code className="bg-gray-100 px-1 rounded">app.yaml</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">dev.yaml</code>
            {form.nav_tst  && <>, <code className="bg-gray-100 px-1 rounded">tst.yaml</code></>}
            {form.nav_prod && <>, <code className="bg-gray-100 px-1 rounded">prod.yaml</code></>}
            {' '}+ translation rows ({yamlCount} file{yamlCount !== 1 ? 's' : ''})
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={e => handleSubmit(e, 'yaml-only')}
              className="btn-primary flex items-center gap-2 bg-blue-700 hover:bg-blue-800"
            >
              {loading && runMode === 'yaml-only' ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>Running…</>
              ) : '▶  YAML + Translation'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={e => handleSubmit(e, 'orchestrate')}
              className="btn-primary flex items-center gap-2 bg-brand hover:opacity-90"
            >
              {loading && runMode === 'orchestrate' ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>Orchestrating…</>
              ) : '⚙  Full Orchestration (10 Steps)'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
