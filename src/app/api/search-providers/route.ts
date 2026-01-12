import { NextResponse } from 'next/server';
import { getAvailableSearchProviders, getDefaultSearchProvider } from '@/lib/search';

export async function GET() {
  const providers = getAvailableSearchProviders();
  const defaultProvider = getDefaultSearchProvider();

  return NextResponse.json({
    providers,
    defaultProvider,
  });
}
