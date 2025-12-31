import { NextResponse } from 'next/server';
import { checkProviderAvailability } from '@/lib/ai-providers';

export async function GET() {
  try {
    const availability = await checkProviderAvailability();
    return NextResponse.json(availability);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
