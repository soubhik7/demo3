import { NextRequest, NextResponse } from 'next/server';
import { loadRunMeta } from '@/lib/fileStore';
import { isValidRunId, getSecurityHeaders, sanitizeError, checkRateLimit, getClientIdentifier } from '@/lib/security';

/**
 * GET /api/result/[runId]
 * Retrieves metadata for a specific automation run.
 *
 * SECURITY IMPROVEMENTS:
 * - Rate limiting to prevent abuse
 * - UUID validation to prevent path traversal
 * - Secure headers
 * - Sanitized error messages
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;

    // SECURITY: Rate limiting - 100 requests per minute per client
    const clientId = getClientIdentifier(req.headers);
    const rateLimit = checkRateLimit(clientId, 100, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
            ...getSecurityHeaders(),
          }
        }
      );
    }

    // SECURITY: Validate runId format to prevent path traversal
    if (!isValidRunId(runId)) {
      return NextResponse.json(
        { error: 'Invalid run ID format' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Load metadata with path traversal protection
    const meta = loadRunMeta(runId);
    if (!meta) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }

    // SECURITY: Return with secure headers
    return NextResponse.json(meta, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        ...getSecurityHeaders(),
      },
    });
  } catch (error) {
    // SECURITY: Sanitize error messages
    const isDev = process.env.NODE_ENV === 'development';
    const message = sanitizeError(error, isDev);
    console.error('[result] Error:', error);
    
    return NextResponse.json(
      { error: message },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}
