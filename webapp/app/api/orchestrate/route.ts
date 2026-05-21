/**
 * POST /api/orchestrate
 *
 * Runs the full 3PL onboarding automation from a single JSON input.
 * Steps that are not yet implemented (TODO/blocked) are skipped with a
 * "skipped" status — they do not fail the overall run.
 *
 * Steps 7+8 (YAML patch + translation row generation) are always executed
 * when the input is valid, since they are fully implemented.
 *
 * Request body: OnboardingInput (same schema as /api/run)
 *
 * Response: OrchestrationResult
 *   {
 *     runId, success, steps: [{step, status, detail}],
 *     btpClientId, muleFeatureBranch, prUrl,
 *     runResult: { run_id, yaml_patch_applied, translation_rows, ... },
 *     errors: []
 *   }
 *
 * SECURITY IMPROVEMENTS:
 * - Rate limiting to prevent abuse
 * - Request body size limits
 * - Comprehensive input validation
 * - Sanitized error messages
 * - Secure headers
 */

import { NextRequest, NextResponse } from "next/server";
import { validate } from "@/lib/validate";
import { orchestrate } from "@/lib/orchestrator";
import type { OnboardingInput } from "@/lib/types";
import { getSecurityHeaders, sanitizeError, checkRateLimit, getClientIdentifier } from "@/lib/security";

// SECURITY: Maximum request body size (1MB)
const MAX_BODY_SIZE = 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Rate limiting - 10 orchestrations per minute per client
    const clientId = getClientIdentifier(req.headers);
    const rateLimit = checkRateLimit(clientId, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
            ...getSecurityHeaders(),
          }
        }
      );
    }

    // SECURITY: Check Content-Type header
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415, headers: getSecurityHeaders() }
      );
    }

    // SECURITY: Parse JSON with size limit
    let input: OnboardingInput;
    try {
      const text = await req.text();
      if (text.length > MAX_BODY_SIZE) {
        return NextResponse.json(
          { error: 'Request body too large (max 1MB)' },
          { status: 413, headers: getSecurityHeaders() }
        );
      }
      input = JSON.parse(text) as OnboardingInput;
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    // SECURITY: Comprehensive validation with sanitization
    const validationErrors = validate(input);
    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 422, headers: getSecurityHeaders() }
      );
    }

    // Execute orchestration
    const result = await orchestrate(input);
    const httpStatus = result.success ? 200 : 207; // 207 = partial success
    
    // SECURITY: Return with secure headers
    return NextResponse.json(result, {
      status: httpStatus,
      headers: getSecurityHeaders(),
    });
  } catch (err) {
    // SECURITY: Sanitize error messages to prevent information disclosure
    const isDev = process.env.NODE_ENV === 'development';
    const message = sanitizeError(err, isDev);
    console.error("[orchestrate] unexpected error:", err);
    
    return NextResponse.json(
      { error: message },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}
