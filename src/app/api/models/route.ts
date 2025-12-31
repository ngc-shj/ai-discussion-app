import { NextResponse } from 'next/server';
import { listAllModels } from '@/lib/ai-providers';

export async function GET() {
  try {
    const models = await listAllModels();
    return NextResponse.json(models);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
