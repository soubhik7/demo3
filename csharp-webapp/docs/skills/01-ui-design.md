# Skill 01 — UI Design: CSS Tokens, Card Layout, Responsive Grid

## What this skill covers
- CSS custom property (token) system for consistent theming
- Card-based section layout
- Responsive 2- and 3-column grids
- Form controls (input, select, checkbox)
- Buttons, alerts, loading overlay
- No external dependencies — no Tailwind, no Bootstrap, no Google Fonts

## Files
- `wwwroot/style.css` — all styles live here
- `wwwroot/index.html` — consumes the classes

---

## Design token system

Define all colours and sizes once in `:root`. Every component references variables —
changing the brand colour is a one-line edit.

```css
:root {
  /* Brand */
  --brand:       #1d4ed8;   /* primary buttons, focus rings, links */
  --brand-dark:  #1e40af;   /* hover state */
  --brand-light: #eff6ff;   /* hover backgrounds */

  /* Semantic colours */
  --success:        #166534;
  --success-bg:     #f0fdf4;
  --success-border: #bbf7d0;
  --error:          #991b1b;
  --error-bg:       #fef2f2;
  --error-border:   #fecaca;
  --warn-bg:        #fffbeb;
  --warn-border:    #fde68a;
  --warn-text:      #92400e;

  /* Neutral grays (Tailwind-compatible scale) */
  --gray-50:  #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;

  /* Shape + shadow */
  --radius:    10px;
  --radius-lg: 16px;
  --shadow:    0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04);
  --shadow-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.04);
}
```

**To retheme any new app:** change only the `--brand*` variables.

---

## Page shell pattern

Sticky header + scrollable body with max-width:

```css
.page-header {
  background: white;
  border-bottom: 1px solid var(--gray-200);
  position: sticky; top: 0; z-index: 100;
  box-shadow: var(--shadow);
}
.page-body {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.75rem 1.5rem 4rem;
}
```

```html
<header class="page-header">
  <div class="page-header-inner">
    <div class="page-header-logo">App <span>Name</span></div>
    <div class="page-header-sub">Subtitle · Team name</div>
    <div id="status-indicator" style="margin-left:auto"></div>
  </div>
</header>
<main class="page-body">
  <!-- sections go here -->
</main>
```

---

## Card section pattern

Every logical group of fields lives in a `.card`. The header row contains
a numbered badge, title, subtitle, and optionally a toggle.

```css
.card        { background:white; border:1px solid var(--gray-200);
               border-radius:var(--radius-lg); box-shadow:var(--shadow);
               padding:1.5rem; margin-bottom:1.25rem; }
.card-header { display:flex; align-items:center; gap:.85rem; margin-bottom:1.25rem; }
.card-badge  { width:28px; height:28px; border-radius:50%;
               display:flex; align-items:center; justify-content:center;
               font-size:.72rem; font-weight:700; color:white; flex-shrink:0; }
```

```html
<div class="card" style="border-color:#bfdbfe">  <!-- accent border colour -->
  <div class="card-header">
    <div class="card-badge badge-blue">2</div>
    <div>
      <div class="card-title">Section Title</div>
      <div class="card-sub">Short description of what this section does</div>
    </div>
  </div>
  <!-- fields here -->
</div>
```

### Badge colour classes
| Class | Colour | Use for |
|---|---|---|
| `badge-gray` | Gray | General / identification |
| `badge-blue` | Blue | Primary config |
| `badge-orange` | Orange | TST environment |
| `badge-purple` | Purple | PROD environment |
| `badge-indigo` | Indigo | Transaction types |
| `badge-green` | Green | Translation / output |

---

## Responsive grid

```css
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; }

@media (max-width:640px) {
  .grid-2, .grid-3 { grid-template-columns:1fr; }
}
```

```html
<div class="grid-2 mb-4">
  <div class="field"> ... </div>
  <div class="field"> ... </div>
</div>
```

---

## Form field pattern

```css
.field-label { font-size:.8rem; font-weight:500; color:var(--gray-700); margin-bottom:.3rem; }
.field-input  { width:100%; border:1px solid var(--gray-300); border-radius:var(--radius);
                padding:.5rem .75rem; font-size:.875rem; transition:border-color .15s; }
.field-input:focus { outline:none; border-color:var(--brand);
                     box-shadow:0 0 0 3px rgba(29,78,216,.12); }
.field-error  { font-size:.73rem; color:#dc2626; margin-top:.25rem; }
```

```html
<div class="field">
  <label class="field-label" for="my_field">
    Field Label <span class="req">*</span>
  </label>
  <input class="field-input" id="my_field" type="text" placeholder="hint text">
  <div class="field-error" id="my_field_err"></div>
</div>
```

---

## Button system

```html
<!-- Primary action -->
<button class="btn btn-primary" type="button">▶ Run</button>

<!-- Secondary action (different colour) -->
<button class="btn btn-teal" type="button">⚙ Orchestrate</button>

<!-- Ghost / cancel -->
<button class="btn btn-ghost btn-sm" type="button">← Back</button>
```

Loading state (disable + show spinner):
```js
btn.disabled = true;
btn.innerHTML = '<span class="spinner"></span> Running…';
```

---

## Alert / notification pattern

```html
<!-- Error -->
<div class="alert alert-error">
  <span class="alert-icon">⚠</span>
  <div>Error message here</div>
</div>

<!-- Success -->
<div class="alert alert-success">
  <span class="alert-icon">✅</span>
  <div>Operation completed successfully.</div>
</div>

<!-- Warning hint -->
<div class="hint">
  This section is optional — fill in when credentials are available.
</div>
```

---

## Loading overlay

Full-page semi-transparent overlay with spinner — shown during async operations:

```html
<div id="loading-overlay">
  <div class="loading-spinner"></div>
  <div class="loading-text" id="loading-text">Running…</div>
</div>
```

```js
// Show
document.getElementById('loading-overlay').classList.add('visible');
// Hide
document.getElementById('loading-overlay').classList.remove('visible');
```

---

## Font stack (no external downloads)

```css
body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
               Roboto, "Helvetica Neue", Arial, sans-serif;
}
code, pre {
  font-family: ui-monospace, "Cascadia Code", "Fira Code",
               "Courier New", monospace;
}
```

System fonts load instantly, work offline, and are never blocked by corporate firewalls.

---

## Reuse checklist for a new app
- [ ] Copy `style.css` verbatim
- [ ] Update `--brand` / `--brand-dark` / `--brand-light` tokens for the new app's colour
- [ ] Update `--radius` if a different roundness is desired
- [ ] Use `.card` + `.card-header` + `.card-badge` for every form section
- [ ] Use `.grid-2` / `.grid-3` for field rows
- [ ] Use `.btn-primary` for the main action, `.btn-ghost` for secondary
- [ ] Use `.alert-error` / `.alert-success` for feedback messages
