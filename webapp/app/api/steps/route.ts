import { NextResponse } from 'next/server';
import { STEP_REGISTRY } from '@/lib/steps/registry';
import { getSecurityHeaders } from '@/lib/security';

/** GET /api/steps — returns the full step registry for the UI tools dashboard. */
export async function GET() {
  return NextResponse.json(STEP_REGISTRY, { headers: getSecurityHeaders() });
}
