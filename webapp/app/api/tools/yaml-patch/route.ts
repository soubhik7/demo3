/**
 * POST /api/tools/yaml-patch
 *
 * Standalone tool: patches all applicable MuleSoft YAML files for a given country.
 * Same logic as /api/run but returns the patched YAML content directly in the response
 * alongside a run_id for downloading via /api/download.
 *
 * Accepts the full OnboardingInput (nav + nav_tst + nav_prod fields are used).
 * Translation fields are required for validation but translation rows are NOT generated here.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '@/lib/validate';
import {
  buildYamlBlock, buildYamlBlockForEnv,
  patchYaml, patchValidCountriesList, patchNavisionInstance,
} from '@/lib/core';
import { ensureOutputRoot, saveRunFiles, buildExcelBuffer, getDefaultYamlPath, getEnvYamlPath } from '@/lib/fileStore';
import { buildTranslationRows, buildCsv } from '@/lib/core';
import type { OnboardingInput, ToolResult } from '@/lib/types';
import { getSecurityHeaders, sanitizeError, checkRateLimit, getClientIdentifier } from '@/lib/security';
import { TX_CODE_ORDER } from '@/lib/constants';

const MAX_BODY_SIZE = 1024 * 1024;

function readYamlSafe(filePath: string): string {
  const stats = fs.statSync(filePath);
  if (stats.size > 10 * 1024 * 1024) throw new Error('Source YAML file too large');
  return fs.readFileSync(filePath, 'utf-8');
}

export async function POST(req: NextRequest) {
  try {
    const clientId = getClientIdentifier(req.headers);
    const rateLimit = checkRateLimit(clientId, 20, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)), ...getSecurityHeaders() } }
      );
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415, headers: getSecurityHeaders() });
    }

    let data: OnboardingInput;
    try {
      const text = await req.text();
      if (text.length > MAX_BODY_SIZE) return NextResponse.json({ error: 'Request body too large' }, { status: 413, headers: getSecurityHeaders() });
      data = JSON.parse(text) as OnboardingInput;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: getSecurityHeaders() });
    }

    const errors = validate(data);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 422, headers: getSecurityHeaders() });
    }

    const devBlock  = buildYamlBlock(data);
    const tstBlock  = data.nav_tst  ? buildYamlBlockForEnv(data, data.nav_tst)  : null;
    const prodBlock = data.nav_prod ? buildYamlBlockForEnv(data, data.nav_prod) : null;

    let patchedDev: string;
    try {
      patchedDev = patchYaml(readYamlSafe(getDefaultYamlPath()), data.country_key, devBlock);
    } catch (e: unknown) {
      return NextResponse.json({ errors: { country_key: e instanceof Error ? e.message : 'YAML patch failed' } }, { status: 422, headers: getSecurityHeaders() });
    }

    let patchedApp: string | undefined;
    const appYamlPath = getEnvYamlPath('app');
    if (appYamlPath) {
      try {
        let yaml = readYamlSafe(appYamlPath);
        yaml = patchValidCountriesList(yaml, data.country_code);
        yaml = patchNavisionInstance(yaml, data.country_code, data.country_key);
        patchedApp = patchYaml(yaml, data.country_key, devBlock);
      } catch (e: unknown) {
        return NextResponse.json({ errors: { country_key: e instanceof Error ? e.message : 'app.yaml patch failed' } }, { status: 422, headers: getSecurityHeaders() });
      }
    }

    let patchedTst: string | undefined;
    const tstYamlPath = getEnvYamlPath('tst');
    if (tstBlock && tstYamlPath) {
      try {
        patchedTst = patchYaml(readYamlSafe(tstYamlPath), data.country_key, tstBlock);
      } catch (e: unknown) {
        return NextResponse.json({ errors: { country_key: e instanceof Error ? e.message : 'tst.yaml patch failed' } }, { status: 422, headers: getSecurityHeaders() });
      }
    }

    let patchedProd: string | undefined;
    const prodYamlPath = getEnvYamlPath('prod');
    if (prodBlock && prodYamlPath) {
      try {
        patchedProd = patchYaml(readYamlSafe(prodYamlPath), data.country_key, prodBlock);
      } catch (e: unknown) {
        return NextResponse.json({ errors: { country_key: e instanceof Error ? e.message : 'prod.yaml patch failed' } }, { status: 422, headers: getSecurityHeaders() });
      }
    }

    // Also save translation files so downloads work
    const rows        = buildTranslationRows(data);
    const excelBuffer = await buildExcelBuffer(rows);
    const csvContent  = buildCsv(rows);
    const runId       = uuidv4();
    const txEnabled   = TX_CODE_ORDER.filter(c => data.nav.transaction_types[c]?.enabled);

    const meta = {
      run_id: runId, country_key: data.country_key, country_code: data.country_code,
      nav_host: data.nav.host, nav_company: data.nav.company, routing_code: data.nav.routing_code,
      tx_enabled: txEnabled, receiver_name: data.translation.receiver_name,
      yaml_block: devBlock,
      ...(patchedApp  && { app_yaml_block:  devBlock }),
      ...(tstBlock     && { tst_yaml_block:  tstBlock }),
      ...(prodBlock    && { prod_yaml_block: prodBlock }),
      translation_rows: rows, created_at: new Date().toISOString(),
    };

    ensureOutputRoot();
    saveRunFiles(runId, meta, patchedDev, excelBuffer as Buffer, csvContent, patchedApp, patchedTst, patchedProd);

    const result: ToolResult = {
      step: 7, stepKey: 'yaml-patch', status: 'ok',
      detail: `Patched ${[true, !!patchedApp, !!patchedTst, !!patchedProd].filter(Boolean).length} YAML file(s)`,
      run_id: runId,
      data: {
        files_patched: ['dev.yaml', patchedApp && 'app.yaml', patchedTst && 'tst.yaml', patchedProd && 'prod.yaml'].filter(Boolean),
        yaml_block: devBlock,
        app_yaml_block:  patchedApp  ? devBlock   : undefined,
        tst_yaml_block:  tstBlock    ?? undefined,
        prod_yaml_block: prodBlock   ?? undefined,
      },
    };

    return NextResponse.json(result, { status: 200, headers: getSecurityHeaders() });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err, process.env.NODE_ENV === 'development') }, { status: 500, headers: getSecurityHeaders() });
  }
}
