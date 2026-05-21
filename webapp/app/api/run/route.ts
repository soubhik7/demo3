import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '@/lib/validate';
import {
  buildYamlBlock, buildYamlBlockForEnv,
  patchYaml, patchValidCountriesList, patchNavisionInstance,
  buildTranslationRows, buildCsv,
} from '@/lib/core';
import {
  ensureOutputRoot, saveRunFiles, buildExcelBuffer,
  getDefaultYamlPath, getEnvYamlPath,
} from '@/lib/fileStore';
import { TX_CODE_ORDER } from '@/lib/constants';
import type { OnboardingInput, RunResult } from '@/lib/types';
import { getSecurityHeaders, sanitizeError, checkRateLimit, getClientIdentifier } from '@/lib/security';

const MAX_BODY_SIZE = 1024 * 1024;

function readYamlSafe(filePath: string): string {
  const stats = fs.statSync(filePath);
  if (stats.size > 10 * 1024 * 1024) throw new Error('Source YAML file too large');
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Applies the three incremental patches to a dev/app-style YAML:
 *  1. patchValidCountriesList (silently skipped if key absent)
 *  2. patchNavisionInstance   (silently skipped if key absent)
 *  3. patchYaml               (appends nav block)
 */
function applyAllPatches(
  yaml: string,
  countryCode: string,
  countryKey: string,
  navBlock: string,
): string {
  let out = patchValidCountriesList(yaml, countryCode);
  out = patchNavisionInstance(out, countryCode, countryKey);
  out = patchYaml(out, countryKey, navBlock);
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const clientId = getClientIdentifier(req.headers);
    const rateLimit = checkRateLimit(clientId, 20, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
            ...getSecurityHeaders(),
          },
        }
      );
    }

    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415, headers: getSecurityHeaders() }
      );
    }

    let data: OnboardingInput;
    try {
      const text = await req.text();
      if (text.length > MAX_BODY_SIZE) {
        return NextResponse.json(
          { error: 'Request body too large (max 1MB)' },
          { status: 413, headers: getSecurityHeaders() }
        );
      }
      data = JSON.parse(text) as OnboardingInput;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const errors = validate(data);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 422, headers: getSecurityHeaders() });
    }

    // ── Build nav blocks ──────────────────────────────────────────────────────
    const devBlock = buildYamlBlock(data);
    const tstBlock = data.nav_tst  ? buildYamlBlockForEnv(data, data.nav_tst)  : null;
    const prodBlock = data.nav_prod ? buildYamlBlockForEnv(data, data.nav_prod) : null;

    // ── Patch dev.yaml ────────────────────────────────────────────────────────
    const devYamlPath = getDefaultYamlPath();
    const originalDev = readYamlSafe(devYamlPath);
    let patchedDev: string;
    try {
      patchedDev = patchYaml(originalDev, data.country_key, devBlock);
    } catch (e: unknown) {
      return NextResponse.json(
        { errors: { country_key: e instanceof Error ? e.message : 'YAML patch failed' } },
        { status: 422, headers: getSecurityHeaders() }
      );
    }

    // ── Patch app.yaml (validCountriesList + instance + nav block) ────────────
    let patchedApp: string | undefined;
    let appYamlBlock: string | undefined;
    const appYamlPath = getEnvYamlPath('app');
    if (appYamlPath) {
      const originalApp = readYamlSafe(appYamlPath);
      try {
        patchedApp = applyAllPatches(originalApp, data.country_code, data.country_key, devBlock);
        appYamlBlock = devBlock;
      } catch (e: unknown) {
        return NextResponse.json(
          { errors: { country_key: e instanceof Error ? e.message : 'app.yaml patch failed' } },
          { status: 422, headers: getSecurityHeaders() }
        );
      }
    }

    // ── Patch tst.yaml ────────────────────────────────────────────────────────
    let patchedTst: string | undefined;
    const tstYamlPath = getEnvYamlPath('tst');
    if (tstBlock && tstYamlPath) {
      const originalTst = readYamlSafe(tstYamlPath);
      try {
        patchedTst = patchYaml(originalTst, data.country_key, tstBlock);
      } catch (e: unknown) {
        return NextResponse.json(
          { errors: { country_key: e instanceof Error ? e.message : 'tst.yaml patch failed' } },
          { status: 422, headers: getSecurityHeaders() }
        );
      }
    }

    // ── Patch prod.yaml ───────────────────────────────────────────────────────
    let patchedProd: string | undefined;
    const prodYamlPath = getEnvYamlPath('prod');
    if (prodBlock && prodYamlPath) {
      const originalProd = readYamlSafe(prodYamlPath);
      try {
        patchedProd = patchYaml(originalProd, data.country_key, prodBlock);
      } catch (e: unknown) {
        return NextResponse.json(
          { errors: { country_key: e instanceof Error ? e.message : 'prod.yaml patch failed' } },
          { status: 422, headers: getSecurityHeaders() }
        );
      }
    }

    // ── Translation rows + Excel/CSV ──────────────────────────────────────────
    const rows = buildTranslationRows(data);
    if (rows.length > 10000) {
      return NextResponse.json(
        { error: 'Too many translation rows generated (max 10000)' },
        { status: 422, headers: getSecurityHeaders() }
      );
    }

    const excelBuffer = await buildExcelBuffer(rows);
    const csvContent  = buildCsv(rows);

    // ── Assemble result ───────────────────────────────────────────────────────
    const runId = uuidv4();
    const txEnabled = TX_CODE_ORDER.filter(c => data.nav.transaction_types[c]?.enabled);

    const meta: RunResult = {
      run_id: runId,
      country_key: data.country_key,
      country_code: data.country_code,
      nav_host: data.nav.host,
      nav_company: data.nav.company,
      routing_code: data.nav.routing_code,
      tx_enabled: txEnabled,
      receiver_name: data.translation.receiver_name,
      yaml_block: devBlock,
      ...(appYamlBlock  && { app_yaml_block:  appYamlBlock }),
      ...(tstBlock       && { tst_yaml_block:  tstBlock }),
      ...(prodBlock      && { prod_yaml_block: prodBlock }),
      translation_rows: rows,
      created_at: new Date().toISOString(),
    };

    ensureOutputRoot();
    saveRunFiles(runId, meta, patchedDev, excelBuffer as Buffer, csvContent, patchedApp, patchedTst, patchedProd);

    return NextResponse.json(meta, { status: 200, headers: getSecurityHeaders() });
  } catch (err) {
    const isDev = process.env.NODE_ENV === 'development';
    const message = sanitizeError(err, isDev);
    console.error('[run] Error:', err);
    return NextResponse.json({ error: message }, { status: 500, headers: getSecurityHeaders() });
  }
}
