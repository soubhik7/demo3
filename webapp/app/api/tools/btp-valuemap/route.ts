import { NextRequest, NextResponse } from 'next/server';
import { getSecurityHeaders } from '@/lib/security';
import { getStepByKey } from '@/lib/steps/registry';

export async function POST(_req: NextRequest) {
  const step = getStepByKey('btp-valuemap');
  return NextResponse.json(
    {
      step: step?.id, stepKey: 'btp-valuemap', status: 'skipped',
      detail: 'Not yet implemented',
      blockedOn: step?.blockedOn,
      owner: step?.owner,
    },
    { status: 501, headers: getSecurityHeaders() }
  );
}
