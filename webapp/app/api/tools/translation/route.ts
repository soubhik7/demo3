/**
 * POST /api/tools/translation
 *
 * Standalone tool: generates SharePoint Translation Table rows (Excel + CSV)
 * for a given country/partner and saves them so they can be downloaded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '@/lib/validate';
import { buildYamlBlock, buildTranslationRows, buildCsv, patchYaml } from '@/lib/core';
import { ensureOutputRoot, saveRunFiles, buildExcelBuffer, getDefaultYamlPath } from '@/lib/fileStore';
import type { OnboardingInput, ToolResult } from '@/lib/types';
import { getSecurityHeaders, sanitizeError, checkRateLimit, getClientIdentifier } from '@/lib/security';
import { TX_CODE_ORDER } from '@/lib/constants';
import fs from 'fs';

const MAX_BODY_SIZE = 1024 * 1024;

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

    const rows = buildTranslationRows(data);
    if (rows.length > 10000) {
      return NextResponse.json({ error: 'Too many translation rows (max 10000)' }, { status: 422, headers: getSecurityHeaders() });
    }

    const excelBuffer = await buildExcelBuffer(rows);
    const csvContent  = buildCsv(rows);

    // Build a minimal patched YAML so saveRunFiles has a valid dev.yaml entry
    const devBlock = buildYamlBlock(data);
    let patchedDev = devBlock;
    try {
      const devYamlPath = getDefaultYamlPath();
      const stats = fs.statSync(devYamlPath);
      if (stats.size <= 10 * 1024 * 1024) {
        const raw = fs.readFileSync(devYamlPath, 'utf-8');
        patchedDev = patchYaml(raw, data.country_key, devBlock);
      }
    } catch { /* non-critical — translation tool works without YAML patch */ }

    const runId     = uuidv4();
    const txEnabled = TX_CODE_ORDER.filter(c => data.nav.transaction_types[c]?.enabled);

    const meta = {
      run_id: runId, country_key: data.country_key, country_code: data.country_code,
      nav_host: data.nav.host, nav_company: data.nav.company, routing_code: data.nav.routing_code,
      tx_enabled: txEnabled, receiver_name: data.translation.receiver_name,
      yaml_block: devBlock, translation_rows: rows, created_at: new Date().toISOString(),
    };

    ensureOutputRoot();
    saveRunFiles(runId, meta, patchedDev, excelBuffer as Buffer, csvContent);

    const result: ToolResult = {
      step: 8, stepKey: 'translation', status: 'ok',
      detail: `${rows.length} translation row(s) generated`,
      run_id: runId,
      data: {
        row_count: rows.length,
        receiver_name: data.translation.receiver_name,
        message_types: data.translation.message_types,
      },
    };

    return NextResponse.json(result, { status: 200, headers: getSecurityHeaders() });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err, process.env.NODE_ENV === 'development') }, { status: 500, headers: getSecurityHeaders() });
  }
}
