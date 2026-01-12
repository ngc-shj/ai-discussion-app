import { NextRequest, NextResponse } from 'next/server';
import { fetchSearchResults } from '@/lib/search';
import { enrichSearchResultsWithContent } from '@/lib/search/jina-reader';
import { SearchProviderType } from '@/types';
import { logger } from '@/lib/logger';

const log = logger.api.child({ route: '/api/search' });

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const searchType = (searchParams.get('type') || 'web') as 'web' | 'news' | 'images';
  const maxResults = parseInt(searchParams.get('limit') || '5', 10);
  const language = searchParams.get('lang') || 'ja';
  const engines = searchParams.get('engines')?.split(',').filter(Boolean);
  const provider = searchParams.get('provider') as SearchProviderType | null;
  const fetchFullContent = searchParams.get('fullContent') === 'true';
  const fullContentMaxResults = parseInt(searchParams.get('fullContentLimit') || '3', 10);

  if (!query) {
    log.warn('Missing query parameter', { method: 'GET' });
    return NextResponse.json(
      { error: '検索クエリが指定されていません' },
      { status: 400 }
    );
  }

  const startTime = Date.now();
  log.info('Search request received', { method: 'GET', query, searchType, maxResults, provider, fetchFullContent });

  try {
    const result = await fetchSearchResults({
      query,
      searchType,
      maxResults,
      language,
      engines,
      provider: provider || undefined,
    });

    // 詳細コンテンツを取得
    if (fetchFullContent && result.results.length > 0) {
      log.debug('Fetching full content', { urlCount: Math.min(result.results.length, fullContentMaxResults) });
      const enrichedResults = await enrichSearchResultsWithContent(
        result.results,
        { apiKey: process.env.JINA_API_KEY },
        fullContentMaxResults
      );
      const duration = Date.now() - startTime;
      log.info('Search completed with full content', { query, resultCount: enrichedResults.length, duration });
      return NextResponse.json({
        ...result,
        results: enrichedResults,
      });
    }

    const duration = Date.now() - startTime;
    log.info('Search completed', { query, resultCount: result.results.length, duration });
    return NextResponse.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('Search failed', error, { method: 'GET', query, duration });
    return NextResponse.json(
      {
        error: '検索に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      query,
      type = 'web',
      limit = 5,
      language = 'ja',
      engines,
      provider,
      fetchFullContent = false,
      fullContentLimit = 3,
    } = body;

    if (!query) {
      log.warn('Missing query parameter', { method: 'POST' });
      return NextResponse.json(
        { error: '検索クエリが指定されていません' },
        { status: 400 }
      );
    }

    log.info('Search request received', { method: 'POST', query, searchType: type, maxResults: limit, provider, fetchFullContent });

    const result = await fetchSearchResults({
      query,
      searchType: type as 'web' | 'news' | 'images',
      maxResults: limit,
      language,
      engines: engines?.split?.(',').filter(Boolean) || engines,
      provider: provider as SearchProviderType | undefined,
    });

    // 詳細コンテンツを取得
    if (fetchFullContent && result.results.length > 0) {
      log.debug('Fetching full content', { urlCount: Math.min(result.results.length, fullContentLimit) });
      const enrichedResults = await enrichSearchResultsWithContent(
        result.results,
        { apiKey: process.env.JINA_API_KEY },
        fullContentLimit
      );
      const duration = Date.now() - startTime;
      log.info('Search completed with full content', { query, resultCount: enrichedResults.length, duration });
      return NextResponse.json({
        ...result,
        results: enrichedResults,
      });
    }

    const duration = Date.now() - startTime;
    log.info('Search completed', { query, resultCount: result.results.length, duration });
    return NextResponse.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('Search failed', error, { method: 'POST', duration });
    return NextResponse.json(
      {
        error: '検索に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
