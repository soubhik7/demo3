# /add-form-section

Add a new card section to the onboarding form in `wwwroot/index.html` and wire up any
required state in `wwwroot/app.js`.

## What to ask the user first
- Section number / badge label (e.g. `7`, `A`, `X`)
- Badge colour class (`badge-gray`, `badge-blue`, `badge-orange`, `badge-purple`, `badge-indigo`, `badge-green`)
- Section title and subtitle
- Is this section **optional** (toggle to show/hide)?  If yes, what is the toggle label?
- What **fields** does it contain?  For each field:
  - Field ID (snake_case, unique in the page)
  - Label text
  - Input type: `text` | `select` | `checkbox` | `combo-table` | `msg-pills`
  - Placeholder / default value
  - Required?

## HTML pattern — required section

```html
<!-- ── Section N: <Title> ───────────────────────────── -->
<div class="card" style="border-color:#<accent-hex>">
  <div class="card-header">
    <div class="card-badge <badge-class>">N</div>
    <div>
      <div class="card-title"><Title></div>
      <div class="card-sub"><Subtitle></div>
    </div>
  </div>

  <!-- fields go here -->
  <div class="grid-2 mb-4">
    <div class="field">
      <label class="field-label" for="<id>"><Label> <span class="req">*</span></label>
      <input class="field-input" id="<id>" type="text" placeholder="<placeholder>">
    </div>
  </div>
</div>
```

## HTML pattern — optional (toggle) section

```html
<div class="card" style="border-color:#<accent-hex>">
  <div class="card-header">
    <div class="card-badge <badge-class>">N</div>
    <div>
      <div class="card-title"><Title> <span style="font-weight:400;color:var(--gray-400)">(optional)</span></div>
      <div class="card-sub"><Subtitle></div>
    </div>
    <label class="section-toggle">
      <input type="checkbox" id="include-<key>"> Include <Label>
    </label>
  </div>
  <div class="section-body" id="section-<key>">
    <!-- fields go here -->
  </div>
</div>
```

## JS wiring — optional section toggle

Add to `setupToggles()` in `app.js` — the existing loop auto-handles any
`id="include-<key>"` + `id="section-<key>"` pair, so no JS change is needed unless
you need custom enable/disable logic.

## JS wiring — collect field in `buildJson()`

```js
// Simple text field
my_field: getVal('my_field_id') || '',

// Checkbox
use_feature: getCb('use_feature_id'),

// Optional section object
...(document.getElementById('include-mykey')?.checked ? {
  my_section: {
    field1: getVal('mykey_field1') || '',
    field2: getVal('mykey_field2') || '',
  }
} : {}),
```

## CSS accent colours reference

| Accent hex | border style |
|---|---|
| `#bfdbfe` | blue |
| `#fed7aa` | orange |
| `#ddd6fe` | purple |
| `#c7d2fe` | indigo |
| `#bbf7d0` | green |
| `#fde68a` | amber |
| `#f9a8d4` | pink |

## After adding the section

1. Add the new field IDs to `buildJson()` so they are included in the POST body.
2. Add any required-field checks to `validateForm()`.
3. If it produces a new output file, add a download button — use `/add-download-type`.
