# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**3PL Inbound Onboarding Automation** — Mars Navision Integration (EOS Transformation Delivery Team). A single onboarding JSON drives configuration of a new 3PL partner across SAP BTP, Solace, MuleSoft, and GitHub. Steps 7+8 (YAML patch + SharePoint translation rows) are fully automated; steps 1–6 and 9 are stubs awaiting external credentials from partner teams.

## Commands

### Web App (primary interface)

```bash
cd webapp
npm install
npm run dev      # development server — http://localhost:3000
npm run build    # production build (standalone output)
npm run start    # serve production build
npm run lint     # ESLint
```

### Python CLI

```bash
cd scripts
pip install -r requirements.txt

python patch_config.py                              # default input + YAML
python patch_config.py --input config/spl_france_input.json --dry-run
python patch_config.py --input config/spl_france_input.json

python orchestrator.py --input config/spl_france_input.json
python orchestrator.py --input config/spl_france_input.json --dry-run

python create_tracker_excel.py    # regenerate docs/3PL_Integration_Automation_Tracker.xlsx
python create_onboarding_excel.py # regenerate docs/3PL_Inbound_Onboarding_Requirements.xlsx
```

### Azure deployment

```bash
cd webapp
npm run build
az webapp up --name 3pl-onboarding --resource-group <rg> --runtime "NODE:20-lts" --sku B1
az webapp config set --name 3pl-onboarding --resource-group <rg> --startup-file "node server.js"
```

Keep `webapp/data/dev.yaml` in sync with `config/dev.yaml` after each patching run — the web app reads from `webapp/data/`.

## Architecture

### Two parallel implementations

The automation exists in two forms that must stay in sync:
- **`scripts/`** — Python CLI using `openpyxl`/`pyyaml`
- **`webapp/lib/`** — TypeScript Next.js server-side equivalents using `exceljs`

Core logic lives in `webapp/lib/core.ts` (`buildYamlBlock`, `patchYaml`, `buildTranslationRows`, `buildCsv`) and its Python equivalent in `scripts/patch_config.py`.

### Web app data flow

```
POST /api/run  ──►  validate()  ──►  buildYamlBlock()  ──►  patchYaml()
                                 ──►  buildTranslationRows()
                                 ──►  buildExcelBuffer()  (ExcelJS, server-only)
                                 ──►  saveRunFiles()  →  outputs/{uuid}/
                                 ──►  returns RunResult (run_id used as key)

GET /api/result/[runId]          ──►  loadRunMeta()
GET /api/download/[runId]/[type] ──►  getFilePath()  →  stream file
POST /api/orchestrate            ──►  orchestrate()  (all 10 steps, stubs skip gracefully)
```

The web app's output directory is `webapp/outputs/{runId}/` containing `patched.yaml`, `translations.xlsx`, `translations.csv`, and `metadata.json`.

### Orchestrator step lifecycle

`orchestrate()` in `webapp/lib/orchestrator.ts` (and `scripts/orchestrator.py`) runs all 10 steps in sequence using a `safeRun` wrapper that catches errors from unimplemented stubs. A step throwing `"not yet implemented"` records status `"skipped"` rather than `"error"`. Steps 7+8 always run if input is valid.

Inter-step state is carried via a `State` object: `btpClientId` (Step 1→2,3,4,5,6), `solaceEnumVersionId`/`solaceEventVersionId` (Step 3→5), `muleFeatureBranch` (Step 6→9).

### YAML patching invariants

- 3-space property indent, 5-space transaction-type entries — must match `config/dev.yaml` exactly
- Duplicate-key guard: `patchYaml()` throws if `country_key` already exists
- `sanitizeCountryKey()` strips everything except `[a-z]` before use as a YAML key
- `TX_CODE_ORDER` in `webapp/lib/constants.ts` defines canonical ordering of transaction types

### Security layer (`webapp/lib/security.ts`)

All API routes apply: rate limiting (20 req/min per client), request body size cap (1 MB), UUID v4 validation on `runId` to prevent path traversal, hostname SSRF blocking for private ranges, and security response headers (CSP, X-Frame-Options, HSTS in prod). `sanitizeError()` redacts paths and secrets in production error messages.

### Implementing a TODO step

Each stub in `webapp/lib/steps/step*.ts` exports a single `run(params) → Promise<Result>` function that currently throws `"not yet implemented"`. To implement:
1. Fill in the `run()` body using the typed params already defined at the top of the file.
2. Set the corresponding env vars (see README env-var table) — the orchestrator reads them via `process.env`.
3. Mirror the change in the corresponding Python module under `scripts/steps/`.

### Next.js configuration notes

- `output: 'standalone'` — required for Azure App Service (`startup.txt` references `node server.js`)
- `serverExternalPackages: ['exceljs']` — keeps ExcelJS out of the browser bundle; import it with `await import('exceljs')` inside server-only functions
