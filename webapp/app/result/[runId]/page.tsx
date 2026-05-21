import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { RunResult } from '@/lib/types';
import { TRANSLATION_COLUMNS } from '@/lib/constants';

async function getResult(runId: string): Promise<RunResult | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/result/${runId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function DlButton({
  runId, type, label, color,
}: { runId: string; type: string; label: string; color: string }) {
  return (
    <a
      href={`/api/download/${runId}/${type}`}
      download
      className={`dl-btn ${color}`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v6m0 0l-3-3m3 3l3-3M12 3v9"/>
      </svg>
      {label}
    </a>
  );
}

function YamlBlock({
  title, subtitle, block, dotColor,
}: { title: string; subtitle: string; block: string; dotColor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} inline-block`} />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        <span className="text-xs text-gray-400">{subtitle}</span>
      </div>
      <pre className="bg-gray-900 text-green-300 text-xs font-mono p-5 overflow-x-auto leading-relaxed whitespace-pre">
        {block}
      </pre>
    </div>
  );
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const result = await getResult(runId);
  if (!result) notFound();

  const createdAt = new Date(result.created_at).toLocaleString();
  const envCount = [result.app_yaml_block, result.tst_yaml_block, result.prod_yaml_block]
    .filter(Boolean).length + 1; // +1 for dev

  return (
    <div>
      {/* ── Success banner ──────────────────────────────────────── */}
      <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-4 mb-6 flex items-start gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <h1 className="font-bold text-green-900 text-lg">
            Automation Complete — <span className="capitalize">{result.country_key}</span>
            {result.country_code && (
              <span className="ml-2 text-sm font-normal text-green-700">({result.country_code})</span>
            )}
          </h1>
          <p className="text-green-700 text-sm mt-0.5">
            {envCount} YAML{envCount > 1 ? 's' : ''} patched · {result.translation_rows.length} translation rows · {createdAt}
          </p>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Country Key"      value={result.country_key} sub={result.country_code ? `Code: ${result.country_code}` : undefined} />
        <StatCard label="Routing Code"     value={result.routing_code} />
        <StatCard label="TX Types Enabled" value={result.tx_enabled.length} sub={result.tx_enabled.join(' · ')} />
        <StatCard label="Translation Rows" value={result.translation_rows.length} sub={result.receiver_name} />
      </div>

      {/* ── YAML blocks ─────────────────────────────────────────── */}
      <YamlBlock
        title="YAML Block — dev.yaml"
        subtitle="nav block appended"
        block={result.yaml_block}
        dotColor="bg-blue-500"
      />

      {result.app_yaml_block && (
        <YamlBlock
          title="YAML Block — app.yaml (+ validCountriesList + navision.instance)"
          subtitle="nav block + routing list updated"
          block={result.app_yaml_block}
          dotColor="bg-teal-500"
        />
      )}

      {result.tst_yaml_block && (
        <YamlBlock
          title="YAML Block — tst.yaml"
          subtitle="TST nav block appended"
          block={result.tst_yaml_block}
          dotColor="bg-orange-500"
        />
      )}

      {result.prod_yaml_block && (
        <YamlBlock
          title="YAML Block — prod.yaml"
          subtitle="PROD nav block appended"
          block={result.prod_yaml_block}
          dotColor="bg-purple-500"
        />
      )}

      {/* ── Translation table ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="text-sm font-semibold text-gray-700">
            Translation Table Rows ({result.translation_rows.length})
          </span>
          <span className="ml-auto text-xs text-gray-400">Ready to import into SharePoint</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-blue-900 text-white">
              <tr>
                {TRANSLATION_COLUMNS.map(c => (
                  <th key={c} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.translation_rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                  {TRANSLATION_COLUMNS.map(c => (
                    <td key={c} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {(row as Record<string, string>)[c] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Downloads ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Download Patched Files</p>
        <div className="flex flex-wrap gap-3">
          <DlButton runId={runId} type="yaml"  label="dev.yaml patched"
            color="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100" />
          {result.app_yaml_block && (
            <DlButton runId={runId} type="app-yaml" label="app.yaml patched"
              color="border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100" />
          )}
          {result.tst_yaml_block && (
            <DlButton runId={runId} type="tst-yaml" label="tst.yaml patched"
              color="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100" />
          )}
          {result.prod_yaml_block && (
            <DlButton runId={runId} type="prod-yaml" label="prod.yaml patched"
              color="border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100" />
          )}
          <DlButton runId={runId} type="xlsx" label="Translation Excel"
            color="border-green-300 bg-green-50 text-green-700 hover:bg-green-100" />
          <DlButton runId={runId} type="csv"  label="Translation CSV"
            color="border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100" />
        </div>
      </div>

      {/* ── Next steps ──────────────────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6">
        <p className="text-sm font-semibold text-amber-800 mb-2">Next Steps</p>
        <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
          <li>Create a Git feature branch from <code className="bg-amber-100 px-1 rounded">dev</code></li>
          <li>Replace <code className="bg-amber-100 px-1 rounded">app.yaml</code> and <code className="bg-amber-100 px-1 rounded">dev.yaml</code> with the patched downloads above</li>
          {(result.tst_yaml_block || result.prod_yaml_block) && (
            <li>Replace{result.tst_yaml_block ? ' tst.yaml' : ''}{result.prod_yaml_block ? ' and prod.yaml' : ''} with their patched versions</li>
          )}
          <li>Commit and raise a PR — notify Sravani Kare for review</li>
          <li>Import the Translation Excel rows into SharePoint Translation list</li>
          <li>Monitor deployment after PR merge</li>
        </ol>
      </div>

      <Link href="/" className="btn-ghost inline-flex items-center gap-2">
        ← New Onboarding Request
      </Link>
    </div>
  );
}
