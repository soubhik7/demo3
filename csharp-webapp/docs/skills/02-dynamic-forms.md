# Skill 02 — Dynamic Forms: Vanilla JS, Dynamic Tables, Section Toggles

## What this skill covers
- Managing form state as a plain JS object (no React, no Vue)
- Building and collecting form fields dynamically
- Add/remove rows in a table (combos, UOM mappings, any list)
- Toggling optional collapsible sections with a checkbox
- Pre-filling the form from an uploaded JSON file
- Client-side validation before submitting
- Submitting as JSON via `fetch` API and navigating to a result page

## File
- `wwwroot/app.js`

---

## Core pattern — form state object

Keep mutable arrays (dynamic rows) in a `state` object.
Simple scalar fields are read directly from the DOM on submit.

```js
const state = {
  items: [{ value_from: '', value_to: '' }],   // dynamic table rows
  extras: [],                                   // another dynamic list
  includeOptional: false,                       // toggle flag
};
```

**Rule:** only put things in `state` that change dynamically (add/remove rows, toggle flags).
Static fields (text inputs, checkboxes) are read with `getVal()` / `getCb()` at submit time.

---

## Helper utilities

```js
const getVal = id => document.getElementById(id)?.value?.trim() || '';
const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
const getCb  = id => document.getElementById(id)?.checked ?? false;
const setCb  = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };

function esc(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}
```

---

## Dynamic table pattern (add / remove rows)

### HTML (static structure)
```html
<div style="overflow-x:auto; border:1px solid var(--gray-200); border-radius:var(--radius)">
  <table class="combo-table">
    <thead><tr>
      <th>Column A</th>
      <th>Column B</th>
      <th style="width:40px"></th>
    </tr></thead>
    <tbody id="items-table"></tbody>
  </table>
</div>
<button type="button" class="add-row-btn" onclick="addItem()">+ Add row</button>
```

### JS — render, add, remove
```js
function renderItems() {
  document.getElementById('items-table').innerHTML =
    state.items.map((row, i) => `
      <tr>
        <td><input class="field-input" style="font-size:.82rem"
             value="${esc(row.value_from)}"
             oninput="state.items[${i}].value_from = this.value"
             placeholder="internal value"></td>
        <td><input class="field-input" style="font-size:.82rem"
             value="${esc(row.value_to)}"
             oninput="state.items[${i}].value_to = this.value"
             placeholder="external value"></td>
        <td>
          <button type="button" class="remove-btn"
                  onclick="removeItem(${i})"
                  ${state.items.length === 1 ? 'disabled' : ''}>×</button>
        </td>
      </tr>
    `).join('');
}

function addItem()       { state.items.push({ value_from: '', value_to: '' }); renderItems(); }
function removeItem(i)   { state.items.splice(i, 1); renderItems(); }
```

**Pattern rule:** always call `render*()` after any mutation of `state.*`.

---

## Optional section toggle

### HTML
```html
<!-- In card-header -->
<label class="section-toggle">
  <input type="checkbox" id="include-mykey"> Include TST
</label>

<!-- Section body (hidden by default) -->
<div class="section-body" id="section-mykey">
  <!-- fields inside -->
</div>
```

### JS — generic loop (handles all toggleable sections)
```js
function setupToggles() {
  ['tst', 'prod', 'btp', 'solace'].forEach(key => {
    const cb   = document.getElementById(`include-${key}`);
    const body = document.getElementById(`section-${key}`);
    if (!cb || !body) return;
    cb.addEventListener('change', () => {
      body.classList.toggle('active', cb.checked);
    });
  });
}
```

```css
/* CSS — section-body is hidden until .active is added */
.section-body         { display: none; }
.section-body.active  { display: block; }
```

**To add a new toggleable section:** just give it `id="include-<key>"` and `id="section-<key>"` — the loop picks it up automatically with no JS change needed.

---

## buildJson() — collecting the full form into a POST-ready object

```js
function buildJson() {
  return {
    // scalar fields — read from DOM at submit time
    country_key:  (getVal('country_key') || '').toLowerCase().replace(/[^a-z]/g, ''),
    country_code: getVal('country_code') || '',
    created_by:   getVal('created_by')   || '',

    // nested object
    nav: {
      host:         getVal('nav_host')         || '',
      company:      getVal('nav_company')      || '',
      routing_code: getVal('nav_routing_code') || '',
      use_common_cert: getCb('nav_use_common_cert'),
    },

    // dynamic rows from state
    items: state.items.filter(r => r.value_from || r.value_to),

    // optional section — include only when toggled on
    ...(document.getElementById('include-tst')?.checked ? {
      nav_tst: {
        host:         getVal('tst_host')         || '',
        routing_code: getVal('tst_routing_code') || '',
      }
    } : {}),
  };
}
```

---

## validateForm() — client-side checks before fetch

```js
function validateForm(json) {
  const errors = [];
  if (!json.country_key)        errors.push('Country Key is required.');
  if (!json.nav.host)           errors.push('NAV Host is required.');
  if (!json.nav.company)        errors.push('NAV Company is required.');
  if (!json.nav.routing_code)   errors.push('NAV Routing Code is required.');
  return errors;
}
```

Show errors before sending:
```js
const errors = validateForm(json);
if (errors.length > 0) {
  showAlert('error',
    '<strong>Fix these:</strong><ul>' +
    errors.map(e => `<li>${e}</li>`).join('') + '</ul>');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return;
}
```

---

## submitForm() — fetch + navigate

```js
async function submitForm(endpoint) {
  const json   = buildJson();
  const errors = validateForm(json);
  if (errors.length) { showErrors(errors); return; }

  setLoading(true, 'Processing…');
  try {
    const res  = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(json),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      showAlert('error', data.error || 'Server error');
      return;
    }
    // Navigate to result page
    window.location.href = `/result.html?run_id=${encodeURIComponent(data.run_id)}`;
  } catch (e) {
    setLoading(false);
    showAlert('error', 'Could not reach server: ' + e.message);
  }
}
```

---

## JSON file pre-fill pattern

Lets the user upload an existing JSON and have it fill every form field:

```html
<label class="upload-area">
  <input type="file" id="json-file-input" accept=".json">
  📂 Click to browse or drag a JSON file here
</label>
```

```js
document.getElementById('json-file-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    fillFormFromJson(data);
    showAlert('success', 'JSON loaded — review and submit when ready.');
  } catch (err) {
    showAlert('error', 'Invalid JSON: ' + err.message);
  }
  e.target.value = '';  // reset so same file can be re-loaded
});

function fillFormFromJson(data) {
  setVal('country_key',  data.country_key  || '');
  setVal('country_code', data.country_code || '');
  const nav = data.nav || {};
  setVal('nav_host',         nav.host         || '');
  setVal('nav_routing_code', nav.routing_code || '');
  // ... etc for all fields

  // Dynamic rows
  if (Array.isArray(data.items) && data.items.length) {
    state.items = data.items.map(r => ({ value_from: r.value_from || '', value_to: r.value_to || '' }));
    renderItems();
  }

  // Optional sections
  if (data.nav_tst) {
    const cb = document.getElementById('include-tst');
    if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
    setVal('tst_host',         data.nav_tst.host         || '');
    setVal('tst_routing_code', data.nav_tst.routing_code || '');
  }
}
```

---

## DOMContentLoaded bootstrap pattern

```js
document.addEventListener('DOMContentLoaded', () => {
  renderItems();        // draw initial table rows
  buildDynamicGrid();   // build checkbox grids from constants
  setupToggles();       // wire show/hide for optional sections
  setupSubmitButtons(); // attach click handlers to run/orchestrate buttons
  setupFileUpload();    // wire JSON file pre-fill
  checkHealth();        // ping /api/health to show Python status
});
```

---

## Reuse checklist for a new app
- [ ] Copy `app.js`, keeping the utility functions (`getVal`, `setVal`, `getCb`, `setCb`, `esc`, `showAlert`, `setLoading`)
- [ ] Rewrite `buildJson()` to match the new app's data shape
- [ ] Rewrite `validateForm()` for the new required fields
- [ ] Add `state.*` entries for any dynamic row lists
- [ ] Add `render*()` + `add*()` + `remove*()` for each dynamic table
- [ ] Add optional section IDs following `include-<key>` / `section-<key>` convention
- [ ] Call all setup functions in `DOMContentLoaded`
