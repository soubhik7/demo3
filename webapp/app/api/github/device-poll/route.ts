/**
 * POST /api/github/device-poll
 *
 * Proxies a single poll to GitHub's token endpoint.
 * The client calls this repeatedly (at the interval returned by device-start)
 * until status is "authorized" or "expired"/"denied".
 *
 * Body: { device_code: string }
 *
 * Returns:
 *   { status: "pending" }                         — user hasn't authorized yet
 *   { status: "slow_down", interval: number }      — back off by +5s
 *   { status: "authorized", token: string }        — token ready; auto-fills PAT field
 *   { status: "expired" }                          — code expired, restart flow
 *   { status: "denied" }                           — user denied access
 *   { status: "error", detail: string }            — unexpected GitHub response
 *
 * Security:
 *   - Token is passed directly to the client and NEVER stored server-side.
 *   - Rate limited to 30 polls/minute per client (GitHub already throttles at 5s intervals).
 *   - device_code format is validated before forwarding to GitHub.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecurityHeaders, checkRateLimit, getClientIdentifier } from '@/lib/security';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const DEVICE_CODE_RE  = /^[a-zA-Z0-9_\-]{10,80}$/;

export async function POST(req: NextRequest) {
  const clientId = getClientIdentifier(req.headers);
  const rateLimit = checkRateLimit(clientId, 30, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)), ...getSecurityHeaders() } }
    );
  }

  const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!githubClientId) {
    return NextResponse.json(
      { error: 'GITHUB_OAUTH_CLIENT_ID is not configured.' },
      { status: 503, headers: getSecurityHeaders() }
    );
  }

  let body: { device_code?: string };
  try {
    body = await req.json() as { device_code?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: getSecurityHeaders() });
  }

  const { device_code } = body;
  if (!device_code || !DEVICE_CODE_RE.test(device_code)) {
    return NextResponse.json(
      { error: 'Missing or invalid device_code' },
      { status: 400, headers: getSecurityHeaders() }
    );
  }

  try {
    const res = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id:   githubClientId,
        device_code,
        grant_type:  'urn:ietf:params:oauth:grant-type:device_code',
      }).toString(),
    });

    const json = await res.json() as {
      access_token?: string;
      token_type?:   string;
      scope?:        string;
      error?:        string;
      interval?:     number;
    };

    // Token granted
    if (json.access_token) {
      return NextResponse.json(
        { status: 'authorized', token: json.access_token },
        { status: 200, headers: getSecurityHeaders() }
      );
    }

    // Map GitHub error codes to our status values
    switch (json.error) {
      case 'authorization_pending':
        return NextResponse.json({ status: 'pending' }, { status: 200, headers: getSecurityHeaders() });

      case 'slow_down':
        return NextResponse.json(
          { status: 'slow_down', interval: (json.interval ?? 5) + 5 },
          { status: 200, headers: getSecurityHeaders() }
        );

      case 'expired_token':
        return NextResponse.json({ status: 'expired' }, { status: 200, headers: getSecurityHeaders() });

      case 'access_denied':
        return NextResponse.json({ status: 'denied' }, { status: 200, headers: getSecurityHeaders() });

      default:
        return NextResponse.json(
          { status: 'error', detail: json.error ?? 'unknown GitHub response' },
          { status: 200, headers: getSecurityHeaders() }
        );
    }
  } catch (err) {
    console.error('[device-poll] fetch error:', err);
    return NextResponse.json(
      { error: 'Could not reach GitHub.' },
      { status: 502, headers: getSecurityHeaders() }
    );
  }
}
