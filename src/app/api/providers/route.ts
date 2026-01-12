import { NextResponse } from 'next/server';
import { checkProviderAvailability } from '@/lib/ai-providers';
import { logger } from '@/lib/logger';

const log = logger.api.child({ route: '/api/providers' });

export async function GET() {
  const startTime = Date.now();

  try {
    const availability = await checkProviderAvailability();
    const duration = Date.now() - startTime;
    log.debug('Provider availability checked', { availability, duration });
    return NextResponse.json(availability);
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('Provider availability check failed', error, { duration });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
