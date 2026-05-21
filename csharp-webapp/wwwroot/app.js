/**
 * 3PL Onboarding Web App — Vanilla JS
 * Works with the C# ASP.NET Core backend (OnboardingController).
 */
'use strict';

// ── Transaction type definitions (mirrors Python VALID_TX_CODES) ──────────────
const TX_CODES = [
  { code: 'sal_008', type: 'SHIPMENT',              defaultOn: true  },
  { code: 'sal_011', type: 'SALES_RETURN_RECEIPT',  defaultOn: true  },
  { code: 'pur_019', type: 'RECADV',                defaultOn: true  },
  { code: 'man_001', type: 'FINISHED_GOOD',         defaultOn: false },
  { code: 'inv_002', type: 'RECLASSMENT',           defaultOn: true  },
  { code: 'inv_003', type: 'INVENTORY',             defaultOn: true  },
  { code: 'inv_004', type: 'STOCK_ADJUSTMENT',      defaultOn: true  },
  { code: 'wms_004', type: 'TO_SHIP_CONFIRMATION',  defaultOn: false },
  { code: 'wms_005', type: 'TO_REC_CONFIRMATION',   defaultOn: false },
];

const MSG_TYPES = ['despatchStock', 'receiptAdvice', 'stockAdjustment'];

// ── App state ─────────────────────────────────────────────────────────────────
const state = {
  combos: [{ value_from: '', value_to: '' }],
  uoms:   [{ value_from: 'EA', value_to: 'UNIT' }],
  includeTst:  false,
  includeProd: false,
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildTxGrid();
  buildMsgPills();
  renderCombos();
  renderUoms();
  setupToggles();
  setupSubmitButtons();
  setupFileUpload();
  checkPythonHealth();
});

// ── Python health check ───────────────────────────────────────────────────────
async function checkPythonHealth() {
  try {
    const r    = await fetch('/api/health');
    const data = await r.json();
    const el   = document.getElementById('python-status');
    if (!el) return;
    if (data.python && !data.python.includes('not found')) {
      el.textContent = '✓ ' + data.python;
      el.className   = 'text-sm';
      el.style.color = '#15803d';
    } else {
      el.textContent = '⚠ Python not found — check PATH or set Python:Executable in appsettings.json';
      el.className   = 'text-sm';
      el.style.color = '#b45309';
    }
  } catch { /* silent */ }
}

// ── Transaction type grid ─────────────────────────────────────────────────────
function buildTxGrid() {
  const grid = document.getElementById('tx-grid');
  if (!grid) return;
  grid.innerHTML = TX_CODES.map(({ code, type, defaultOn }) => `
    <label class="tx-item${defaultOn ? ' checked' : ''}" id="tx-label-${code}">
      <input type="checkbox" id="tx-${code}" ${defaultOn ? 'checked' : ''}
             onchange="updateTxItem('${code}')">
      <div>
        <div class="tx-code">${code}</div>
        <div class="tx-type">${type}</div>
      </div>
    </label>
  `).join('');
}

function updateTxItem(code) {
  const cb  = document.getElementById('tx-' + code);
  const lbl = document.getElementById('tx-label-' + code);
  if (cb && lbl) lbl.className = 'tx-item' + (cb.checked ? ' checked' : '');
}

// ── Message type pills ────────────────────────────────────────────────────────
function buildMsgPills() {
  const container = document.getElementById('msg-pills');
  if (!container) return;
  container.innerHTML = MSG_TYPES.map(mt => `
    <label class="msg-pill${mt === 'despatchStock' ? ' checked' : ''}" id="msg-label-${mt}">
      <input type="checkbox" id="msg-${mt}" ${mt === 'despatchStock' ? 'checked' : ''}
             onchange="updateMsgPill('${mt}')">
      <span>${mt}</span>
    </label>
  `).join('');
}

function updateMsgPill(mt) {
  const cb  = document.getElementById('msg-' + mt);
  const lbl = document.getElementById('msg-label-' + mt);
  if (cb && lbl) lbl.className = 'msg-pill' + (cb.checked ? ' checked' : '');
}

// ── Dynamic combo tables ──────────────────────────────────────────────────────
function renderCombos() {
  const el = document.getElementById('combos-table');
  if (!el) return;
  el.innerHTML = state.combos.map((row, i) => `
    <tr>
      <td><input class="field-input" style="font-size:.82rem" value="${esc(row.value_from)}"
           oninput="state.combos[${i}].value_from = this.value"
           placeholder="PLANT-FR1-PLANT-FR2"></td>
      <td><input class="field-input" style="font-size:.82rem" value="${esc(row.value_to)}"
           oninput="state.combos[${i}].value_to = this.value"
           placeholder="spl_001"></td>
      <td><button type="button" class="remove-btn"
           onclick="removeCombo(${i})" ${state.combos.length === 1 ? 'disabled' : ''}>×</button></td>
    </tr>
  `).join('');
}

function addCombo() {
  state.combos.push({ value_from: '', value_to: '' });
  renderCombos();
}

function removeCombo(i) {
  state.combos.splice(i, 1);
  renderCombos();
}

function renderUoms() {
  const el = document.getElementById('uoms-table');
  if (!el) return;
  el.innerHTML = state.uoms.map((row, i) => `
    <tr>
      <td><input class="field-input" style="font-size:.82rem" value="${esc(row.value_from)}"
           oninput="state.uoms[${i}].value_from = this.value"
           placeholder="EA"></td>
      <td><input class="field-input" style="font-size:.82rem" value="${esc(row.value_to)}"
           oninput="state.uoms[${i}].value_to = this.value"
           placeholder="UNIT"></td>
      <td><button type="button" class="remove-btn"
           onclick="removeUom(${i})" ${state.uoms.length === 1 ? 'disabled' : ''}>×</button></td>
    </tr>
  `).join('');
}

function addUom() {
  state.uoms.push({ value_from: '', value_to: '' });
  renderUoms();
}

function removeUom(i) {
  state.uoms.splice(i, 1);
  renderUoms();
}

// ── Optional section toggles (TST / PROD) ─────────────────────────────────────
function setupToggles() {
  ['tst', 'prod'].forEach(env => {
    const cb   = document.getElementById(`include-${env}`);
    const body = document.getElementById(`section-${env}`);
    if (!cb || !body) return;
    cb.addEventListener('change', () => {
      body.classList.toggle('active', cb.checked);
      state['include' + env.charAt(0).toUpperCase() + env.slice(1)] = cb.checked;
    });
  });
}

// ── File upload (pre-fill form from JSON) ─────────────────────────────────────
function setupFileUpload() {
  const input = document.getElementById('json-file-input');
  if (!input) return;
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      fillFormFromJson(data);
    } catch (e) {
      showAlert('error', 'Could not parse JSON: ' + e.message);
    }
    input.value = '';
  });
}

function fillFormFromJson(data) {
  setVal('country_key',    (data.country_key    || '').toLowerCase().replace(/[^a-z]/g, ''));
  setVal('country_code',   (data.country_code   || '').toLowerCase());
  setVal('partner_comment', data.partner_comment || '');
  setVal('created_by',      data.created_by      || '');

  const nav = data.nav || {};
  setVal('nav_protocol',     nav.protocol     || 'https');
  setVal('nav_host',         nav.host         || '');
  setVal('nav_port',         nav.port         || '7124');
  setVal('nav_username',     nav.username     || 'SVC_UAT_MULESOFT');
  setVal('nav_domain',       nav.domain       || 'mars-ad.net');
  setVal('nav_company',      nav.company      || '');
  setVal('nav_service',      nav.service      || 'InterfaceWebServices');
  setVal('nav_soap_port',    nav.soap_port    || '7124');
  setVal('nav_soap_path',    nav.soap_path    || '');
  setVal('nav_routing_code', nav.routing_code || '');
  setCb('nav_use_common_cert', nav.use_common_cert !== false);

  // TX codes
  const tx = nav.transaction_types || {};
  TX_CODES.forEach(({ code }) => {
    const entry = tx[code];
    const enabled = entry ? !!entry.enabled : false;
    const cb = document.getElementById('tx-' + code);
    if (cb) { cb.checked = enabled; updateTxItem(code); }
  });

  // TST
  if (data.nav_tst) {
    const tstCb = document.getElementById('include-tst');
    if (tstCb) { tstCb.checked = true; tstCb.dispatchEvent(new Event('change')); }
    const t = data.nav_tst;
    setVal('tst_host',         t.host         || '');
    setVal('tst_company',      t.company      || '');
    setVal('tst_soap_path',    t.soap_path    || '');
    setVal('tst_routing_code', t.routing_code || '');
    setVal('tst_port',         t.port         || '');
    setVal('tst_username',     t.username     || '');
  }

  // PROD
  if (data.nav_prod) {
    const prodCb = document.getElementById('include-prod');
    if (prodCb) { prodCb.checked = true; prodCb.dispatchEvent(new Event('change')); }
    const p = data.nav_prod;
    setVal('prod_host',         p.host         || '');
    setVal('prod_company',      p.company      || '');
    setVal('prod_soap_path',    p.soap_path    || '');
    setVal('prod_routing_code', p.routing_code || '');
    setVal('prod_port',         p.port         || '');
    setVal('prod_username',     p.username     || '');
  }

  // Translation
  const t = data.translation || {};
  setVal('receiver_name', t.receiver_name || '');

  const msgTypes = t.message_types || [];
  MSG_TYPES.forEach(mt => {
    const cb = document.getElementById('msg-' + mt);
    if (cb) { cb.checked = msgTypes.includes(mt); updateMsgPill(mt); }
  });

  if (Array.isArray(t.source_destination_combinations) && t.source_destination_combinations.length > 0) {
    state.combos = t.source_destination_combinations.map(r => ({
      value_from: r.value_from || '', value_to: r.value_to || ''
    }));
    renderCombos();
  }

  if (Array.isArray(t.uom_mappings) && t.uom_mappings.length > 0) {
    state.uoms = t.uom_mappings.map(r => ({
      value_from: r.value_from || '', value_to: r.value_to || ''
    }));
    renderUoms();
  }

  showAlert('success', 'JSON loaded — review the form and click Run when ready.');
}

// ── Build JSON from form ──────────────────────────────────────────────────────
function buildJson() {
  const txTypes = {};
  TX_CODES.forEach(({ code, type }) => {
    const cb = document.getElementById('tx-' + code);
    txTypes[code] = { enabled: cb ? cb.checked : false, type };
  });

  const msgTypes = MSG_TYPES.filter(mt => {
    const cb = document.getElementById('msg-' + mt);
    return cb && cb.checked;
  });

  const json = {
    country_key:     (getVal('country_key')    || '').toLowerCase().replace(/[^a-z]/g, ''),
    country_code:    (getVal('country_code')   || '').toLowerCase(),
    partner_comment:  getVal('partner_comment') || '',
    created_by:       getVal('created_by')      || '',
    nav: {
      protocol:          getVal('nav_protocol')     || 'https',
      host:              getVal('nav_host')          || '',
      port:              getVal('nav_port')          || '7124',
      username:          getVal('nav_username')      || 'SVC_UAT_MULESOFT',
      domain:            getVal('nav_domain')        || 'mars-ad.net',
      company:           getVal('nav_company')       || '',
      service:           getVal('nav_service')       || 'InterfaceWebServices',
      soap_port:         getVal('nav_soap_port')     || '7124',
      soap_path:         getVal('nav_soap_path')     || '',
      routing_code:      getVal('nav_routing_code')  || '',
      use_common_cert:   getCb('nav_use_common_cert'),
      transaction_types: txTypes,
    },
    translation: {
      receiver_name:                 getVal('receiver_name') || '',
      message_types:                 msgTypes,
      source_destination_combinations: state.combos.filter(r => r.value_from || r.value_to),
      uom_mappings:                  state.uoms.filter(r => r.value_from || r.value_to),
    },
  };

  // Optional TST / PROD
  if (document.getElementById('include-tst')?.checked) {
    const host = getVal('tst_host'), port = getVal('tst_port'), user = getVal('tst_username');
    json.nav_tst = {
      host:         host         || '',
      company:      getVal('tst_company')      || '',
      soap_path:    getVal('tst_soap_path')    || '',
      routing_code: getVal('tst_routing_code') || '',
      ...(port ? { port } : {}),
      ...(user ? { username: user } : {}),
    };
  }

  if (document.getElementById('include-prod')?.checked) {
    const host = getVal('prod_host'), port = getVal('prod_port'), user = getVal('prod_username');
    json.nav_prod = {
      host:         host         || '',
      company:      getVal('prod_company')      || '',
      soap_path:    getVal('prod_soap_path')    || '',
      routing_code: getVal('prod_routing_code') || '',
      ...(port ? { port } : {}),
      ...(user ? { username: user } : {}),
    };
  }

  return json;
}

// ── Client-side validation ────────────────────────────────────────────────────
function validateForm(json) {
  const errors = [];
  if (!json.country_key)                    errors.push('Country Key is required (lowercase letters only).');
  if (!json.nav.host)                       errors.push('NAV Host is required.');
  if (!json.nav.company)                    errors.push('NAV Company is required.');
  if (!json.nav.soap_path)                  errors.push('NAV SOAP Path is required.');
  if (!json.nav.routing_code)               errors.push('NAV Routing Code is required.');
  if (!json.translation.receiver_name)      errors.push('BTP ClientID / Receiver Name is required.');
  if (json.translation.message_types.length === 0) errors.push('At least one Message Type must be selected.');
  const txEnabled = Object.values(json.nav.transaction_types).filter(v => v.enabled);
  if (txEnabled.length === 0)               errors.push('At least one Transaction Type must be enabled.');
  return errors;
}

// ── Submit ────────────────────────────────────────────────────────────────────
function setupSubmitButtons() {
  document.getElementById('btn-run')?.addEventListener('click', () => submitForm('run'));
  document.getElementById('btn-orchestrate')?.addEventListener('click', () => submitForm('orchestrate'));
}

async function submitForm(mode) {
  clearAlerts();
  const json = buildJson();
  const errors = validateForm(json);

  if (errors.length > 0) {
    showAlert('error', '<strong>Please fix the following:</strong><ul style="margin:.4rem 0 0 1.2rem">'
      + errors.map(e => `<li>${e}</li>`).join('') + '</ul>');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  setLoading(true, mode === 'orchestrate' ? 'Running all 10 steps…' : 'Patching YAML + generating translations…');

  try {
    const endpoint = mode === 'orchestrate' ? '/api/orchestrate' : '/api/run';
    const res  = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(json),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      const msg = data.error || 'Unknown server error.';
      const log = data.console_output ? `\n\nConsole output:\n${data.console_output}` : '';
      showAlert('error', msg + (log ? `<pre style="margin-top:.5rem;font-size:.75rem;white-space:pre-wrap">${esc(log)}</pre>` : ''));
      return;
    }

    // Navigate to result page
    window.location.href = `/result.html?run_id=${encodeURIComponent(data.run_id)}&mode=${mode}`;
  } catch (e) {
    setLoading(false);
    showAlert('error', 'Could not reach the server: ' + e.message);
  }
}

// ── Result page logic ─────────────────────────────────────────────────────────
async function loadResult() {
  const params  = new URLSearchParams(window.location.search);
  const runId   = params.get('run_id');
  const mode    = params.get('mode') || 'run';

  if (!runId) {
    showAlert('error', 'No run_id in URL. <a href="/">Go back</a>.');
    return;
  }

  document.getElementById('run-id-display')?.textContent && (
    document.getElementById('run-id-display').textContent = runId
  );

  try {
    const res  = await fetch(`/api/result/${encodeURIComponent(runId)}`);
    const data = await res.json();

    if (!res.ok) {
      showAlert('error', data.error || 'Failed to load result.');
      return;
    }

    // Stat cards
    const meta = data.metadata || {};
    setStat('stat-run-id',   runId.slice(0, 8) + '…',    'Run ID');
    setStat('stat-country',  meta.country_key  || '—',   'Country Key');
    setStat('stat-status',   meta.success ? '✅ Success' : '⚠ Check log', 'Status');
    setStat('stat-created',  formatDate(meta.created_at), 'Created At');

    // Download buttons
    buildDownloadButtons(runId, data.files || []);

    // Console output
    const consoleEl = document.getElementById('console-output');
    if (consoleEl && data.console_output) {
      consoleEl.innerHTML = coloriseConsole(esc(data.console_output));
    }

    // Banner
    const banner = document.getElementById('result-banner');
    if (banner) {
      if (meta.success) {
        banner.className = 'alert alert-success mb-4';
        banner.innerHTML = `<span class="alert-icon">✅</span>
          <div><strong>Automation complete</strong> — country key: <strong>${esc(meta.country_key || '')}</strong>.
          Download your files below.</div>`;
      } else {
        banner.className = 'alert alert-warn mb-4';
        banner.innerHTML = `<span class="alert-icon">⚠</span>
          <div><strong>Script exited with errors.</strong> Check the console log below for details.</div>`;
      }
      banner.style.display = 'flex';
    }
  } catch (e) {
    showAlert('error', 'Failed to fetch result: ' + e.message);
  }
}

function buildDownloadButtons(runId, files) {
  const row = document.getElementById('dl-row');
  if (!row) return;
  const map = {
    'patched.yaml':       { type: 'yaml', label: '⬇ Patched YAML',        cls: 'dl-yaml' },
    'translations.xlsx':  { type: 'xlsx', label: '⬇ Translations (Excel)', cls: 'dl-xlsx' },
    'translations.csv':   { type: 'csv',  label: '⬇ Translations (CSV)',   cls: 'dl-csv'  },
    'output.txt':         { type: 'log',  label: '⬇ Console Log',          cls: 'dl-log'  },
  };
  const btns = files.map(f => {
    const info = map[f];
    if (!info) return '';
    return `<a class="dl-btn ${info.cls}"
               href="/api/download/${encodeURIComponent(runId)}/${info.type}"
               download>${info.label}</a>`;
  }).join('');
  row.innerHTML = btns || '<span style="color:var(--gray-400);font-size:.83rem">No output files found for this run.</span>';
}

function coloriseConsole(text) {
  return text
    .split('\n')
    .map(line => {
      if (/\[OK\]/.test(line))     return `<span class="ok-line">${line}</span>`;
      if (/\[SKIP\]/.test(line))   return `<span class="skip-line">${line}</span>`;
      if (/\[ERROR\]/.test(line))  return `<span class="err-line">${line}</span>`;
      return line;
    })
    .join('\n');
}

function setStat(id, value, label) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

// ── Utility ───────────────────────────────────────────────────────────────────
function getVal(id)   { return document.getElementById(id)?.value || ''; }
function setVal(id, v){ const el = document.getElementById(id); if (el) el.value = v; }
function getCb(id)    { return document.getElementById(id)?.checked ?? false; }
function setCb(id, v) { const el = document.getElementById(id); if (el) el.checked = v; }

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showAlert(type, html) {
  const box = document.getElementById('alert-box');
  if (!box) return;
  box.className = `alert alert-${type} mb-4`;
  box.innerHTML = `<span class="alert-icon">${type === 'error' ? '⚠' : type === 'success' ? '✅' : 'ℹ'}</span><div>${html}</div>`;
  box.style.display = 'flex';
}

function clearAlerts() {
  const box = document.getElementById('alert-box');
  if (box) box.style.display = 'none';
}

function setLoading(on, msg = 'Running…') {
  const overlay = document.getElementById('loading-overlay');
  const text    = document.getElementById('loading-text');
  if (overlay) overlay.classList.toggle('visible', on);
  if (text)    text.textContent = msg;
  ['btn-run', 'btn-orchestrate'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = on;
  });
}
