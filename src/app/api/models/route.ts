import { NextResponse } from 'next/server';
import { listAllModels } from '@/lib/ai-providers';
import { logger } from '@/lib/logger';

const log = logger.api.child({ route: '/api/models' });

export async function GET() {
  const startTime = Date.now();

  try {
    const models = await listAllModels();
    const duration = Date.now() - startTime;
    log.debug('Models listed', { modelCount: Object.keys(models).length, duration });
    return NextResponse.json(models);
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('Models list failed', error, { duration });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
