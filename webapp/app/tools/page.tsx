import Link from 'next/link';
import type { StepDef } from '@/lib/steps/registry';

async function getSteps(): Promise<StepDef[]> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/steps`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: StepDef['status'] }) {
  if (status === 'implemented') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Ready
      </span>
    );
  }
  if (status === 'stub') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Stub
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Manual
    </span>
  );
}

function InputBadge({ section }: { section: string }) {
  const colors: Record<string, string> = {
    nav:         'bg-blue-100 text-blue-700',
    translation: 'bg-green-100 text-green-700',
    btp:         'bg-rose-100 text-rose-700',
    solace:      'bg-cyan-100 text-cyan-700',
    github:      'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${colors[section] ?? 'bg-gray-100 text-gray-600'}`}>
      {section}
    </span>
  );
}

function StepCard({ step }: { step: StepDef }) {
  const cardBorder = step.status === 'implemented'
    ? 'border-green-200'
    : step.status === 'stub'
    ? 'border-amber-200'
    : 'border-gray-200';

  return (
    <div className={`bg-white rounded-2xl border ${cardBorder} shadow-sm p-5 flex flex-col gap-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
            {step.id}
          </span>
          <h3 className="font-semibold text-gray-800 text-sm leading-tight">{step.name}</h3>
        </div>
        <StatusBadge status={step.status} />
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 leading-relaxed">{step.description}</p>

      {/* Input requirements */}
      {step.requiresInput.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs text-gray-400 mr-1">Requires:</span>
          {step.requiresInput.map(s => <InputBadge key={s} section={s} />)}
        </div>
      )}

      {/* Blocked reason (stubs) */}
      {step.blockedOn && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Blocked: </span>{step.blockedOn}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          <span className="font-medium text-gray-500">Owner:</span> {step.owner}
        </p>
        {step.toolEndpoint && step.status === 'implemented' && (
          <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
            POST {step.toolEndpoint}
          </span>
        )}
        {step.toolEndpoint && step.status === 'stub' && (
          <span className="text-xs font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            501 {step.toolEndpoint}
          </span>
        )}
        {!step.toolEndpoint && (
          <span className="text-xs text-gray-400 italic">Manual step — no API endpoint</span>
        )}
      </div>
    </div>
  );
}

export default async function ToolsDashboard() {
  const steps = await getSteps();

  const implemented = steps.filter(s => s.status === 'implemented');
  const stubs       = steps.filter(s => s.status === 'stub');
  const manual      = steps.filter(s => s.status === 'manual');

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Automation Tools Dashboard</h1>
        <p className="text-gray-500 text-sm">
          All 10 automation steps available as individual tools. Implemented tools can be called
          independently via their REST endpoint. Stubbed tools return <code className="bg-gray-100 px-1 rounded">HTTP 501</code> until
          the required credentials and APIs are confirmed.
        </p>
      </div>

      {/* ── Legend + stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{implemented.length}</p>
          <p className="text-xs text-green-600 font-medium">Ready</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{stubs.length}</p>
          <p className="text-xs text-amber-600 font-medium">Stubbed</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{manual.length}</p>
          <p className="text-xs text-gray-500 font-medium">Manual</p>
        </div>
      </div>

      {/* ── Input section legend ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-6 flex flex-wrap gap-3 items-center">
        <span className="text-xs font-semibold text-gray-600">Input sections:</span>
        {['nav', 'translation', 'btp', 'solace', 'github'].map(s => (
          <div key={s} className="flex items-center gap-1">
            <InputBadge section={s} />
            <span className="text-xs text-gray-500">
              {s === 'nav' ? '(MuleSoft NAV config)' :
               s === 'translation' ? '(BTP ClientID + mappings)' :
               s === 'btp' ? '(SAP BTP Suite)' :
               s === 'solace' ? '(Solace EP + broker)' :
               '(GitHub PAT + repos)'}
            </span>
          </div>
        ))}
      </div>

      {/* ── API reference ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-2">Quick API Reference</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
          <div className="space-y-1 text-gray-500">
            <p><span className="text-green-700">POST</span> /api/run — YAML patch + translation rows</p>
            <p><span className="text-green-700">POST</span> /api/orchestrate — Full 10-step orchestration</p>
            <p><span className="text-blue-700">GET</span>  /api/steps — Step registry (this page data)</p>
            <p><span className="text-blue-700">GET</span>  /api/result/[runId] — Run metadata</p>
            <p><span className="text-blue-700">GET</span>  /api/download/[runId]/[type] — Download file</p>
          </div>
          <div className="space-y-1 text-gray-500">
            <p><span className="text-green-700">POST</span> /api/tools/yaml-patch — Step 7 standalone</p>
            <p><span className="text-green-700">POST</span> /api/tools/translation — Step 8 standalone</p>
            <p><span className="text-amber-600">501</span>  /api/tools/btp-app — Step 1 (stub)</p>
            <p><span className="text-amber-600">501</span>  /api/tools/solace-portal — Step 3 (stub)</p>
            <p><span className="text-amber-600">501</span>  /api/tools/mule-branch — Step 6 (stub)</p>
          </div>
        </div>
      </div>

      {/* ── Step cards grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {steps.map(step => <StepCard key={step.id} step={step} />)}
      </div>

      {/* ── How to implement a stub ──────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-6">
        <p className="text-sm font-semibold text-blue-800 mb-2">How to Implement a Stubbed Step</p>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Open <code className="bg-blue-100 px-1 rounded">webapp/lib/steps/step{'{N}'}-*.ts</code> — the <code>run()</code> function body is the stub.</li>
          <li>Fill in the HTTP calls using the typed params already defined at the top of the file.</li>
          <li>Set the corresponding env vars (see README env-var table) as server-level fallbacks.</li>
          <li>Mirror the change in the matching Python module under <code className="bg-blue-100 px-1 rounded">scripts/steps/</code>.</li>
          <li>Update <code className="bg-blue-100 px-1 rounded">registry.ts</code>: change <code>status: &apos;stub&apos;</code> → <code>status: &apos;implemented&apos;</code>.</li>
        </ol>
      </div>

      <Link href="/" className="btn-ghost inline-flex items-center gap-2">
        ← New Onboarding Request
      </Link>
    </div>
  );
}
