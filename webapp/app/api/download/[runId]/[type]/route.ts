import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getFilePath, loadRunMeta } from '@/lib/fileStore';
import { isValidRunId, isValidFileType, getSecurityHeaders, sanitizeError, checkRateLimit, getClientIdentifier } from '@/lib/security';

const MIME: Record<string, string> = {
  'yaml':      'text/yaml',
  'app-yaml':  'text/yaml',
  'tst-yaml':  'text/yaml',
  'prod-yaml': 'text/yaml',
  'xlsx':      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'csv':       'text/csv',
};

const EXT: Record<string, string> = {
  'yaml':      '.yaml',
  'app-yaml':  '.yaml',
  'tst-yaml':  '.yaml',
  'prod-yaml': '.yaml',
  'xlsx':      '.xlsx',
  'csv':       '.csv',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string; type: string }> },
) {
  try {
    const { runId, type } = await params;

    const clientId = getClientIdentifier(req.headers);
    const rateLimit = checkRateLimit(clientId, 50, 60000);
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

    if (!isValidRunId(runId)) {
      return NextResponse.json({ error: 'Invalid run ID format' }, { status: 400, headers: getSecurityHeaders() });
    }

    if (!isValidFileType(type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400, headers: getSecurityHeaders() });
    }

    const filePath = getFilePath(runId, type);
    if (!filePath) {
      return NextResponse.json({ error: 'File not found' }, { status: 404, headers: getSecurityHeaders() });
    }

    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 413, headers: getSecurityHeaders() });
    }

    const meta = loadRunMeta(runId);
    const slug = meta?.country_key ?? runId.slice(0, 8);
    const sanitizedSlug = slug.replace(/[^a-z0-9_-]/gi, '');

    const filenameMap: Record<string, string> = {
      'yaml':      `dev_patched_${sanitizedSlug}${EXT[type]}`,
      'app-yaml':  `app_patched_${sanitizedSlug}${EXT[type]}`,
      'tst-yaml':  `tst_patched_${sanitizedSlug}${EXT[type]}`,
      'prod-yaml': `prod_patched_${sanitizedSlug}${EXT[type]}`,
      'xlsx':      `translations_${sanitizedSlug}${EXT[type]}`,
      'csv':       `translations_${sanitizedSlug}${EXT[type]}`,
    };
    const filename = filenameMap[type] ?? `output_${sanitizedSlug}${EXT[type] ?? ''}`;

    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': MIME[type] ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...getSecurityHeaders(),
      },
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    const message = sanitizeError(error, isDev);
    console.error('[download] Error:', error);
    return NextResponse.json({ error: message }, { status: 500, headers: getSecurityHeaders() });
  }
}
