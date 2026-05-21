/**
 * POST /api/github/device-start
 *
 * Initiates the GitHub Device Authorization Flow.
 * Returns the user_code the user must enter at https://github.com/login/device,
 * plus the device_code the client uses to poll for the access token.
 *
 * Requires env var: GITHUB_OAUTH_CLIENT_ID
 * Scope requested:  repo (needed to push branches and create PRs)
 *
 * Setup: create a GitHub OAuth App in your org with "Device Flow" enabled.
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecurityHeaders, checkRateLimit, getClientIdentifier } from '@/lib/security';

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';

export async function POST(req: NextRequest) {
  const clientId = getClientIdentifier(req.headers);
  const rateLimit = checkRateLimit(clientId, 5, 60000); // 5 per minute — prevent abuse
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)), ...getSecurityHeaders() } }
    );
  }

  const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!githubClientId) {
    return NextResponse.json(
      { error: 'GITHUB_OAUTH_CLIENT_ID is not configured on the server. Contact your administrator.' },
      { status: 503, headers: getSecurityHeaders() }
    );
  }

  try {
    const res = await fetch(GITHUB_DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: githubClientId,
        scope:     'repo',
      }).toString(),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub returned ${res.status}. Try again.` },
        { status: 502, headers: getSecurityHeaders() }
      );
    }

    const json = await res.json() as {
      device_code:       string;
      user_code:         string;
      verification_uri:  string;
      expires_in:        number;
      interval:          number;
      error?:            string;
    };

    if (json.error) {
      return NextResponse.json(
        { error: `GitHub error: ${json.error}` },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // Return all fields — device_code is needed by the client to poll
    return NextResponse.json(
      {
        device_code:      json.device_code,
        user_code:        json.user_code,
        verification_uri: json.verification_uri,
        expires_in:       json.expires_in,
        interval:         json.interval,
      },
      { status: 200, headers: getSecurityHeaders() }
    );
  } catch (err) {
    console.error('[device-start] fetch error:', err);
    return NextResponse.json(
      { error: 'Could not reach GitHub. Check your network.' },
      { status: 502, headers: getSecurityHeaders() }
    );
  }
}
