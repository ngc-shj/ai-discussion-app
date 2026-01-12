import { NextRequest, NextResponse } from 'next/server';
import { fetchSearchResults, performSearch, DefaultAIConfig } from '@/lib/search';
import { enrichSearchResultsWithContent } from '@/lib/search/jina-reader';
import { SearchProviderType, SearchConfig } from '@/types';
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
    if (result.warnings && result.warnings.length > 0) {
      log.warn('Search completed with warnings', { query, resultCount: result.results.length, duration, warnings: result.warnings.map(w => w.type) });
    } else {
      log.info('Search completed', { query, resultCount: result.results.length, duration });
    }
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
      // 関連性フィルタリング用パラメータ
      topic,
      relevanceFilter,
      defaultAIProvider,
      defaultAIModel,
    } = body;

    if (!query) {
      log.warn('Missing query parameter', { method: 'POST' });
      return NextResponse.json(
        { error: '検索クエリが指定されていません' },
        { status: 400 }
      );
    }

    log.info('Search request received', {
      method: 'POST',
      query,
      searchType: type,
      maxResults: limit,
      provider,
      fetchFullContent,
      relevanceFilterEnabled: relevanceFilter?.enabled,
    });

    // 関連性フィルタリングが有効な場合はperformSearchを使用
    if (relevanceFilter?.enabled && topic) {
      const searchConfig: SearchConfig = {
        enabled: true,
        provider: provider as SearchProviderType | undefined,
        maxResults: limit,
        searchType: type as 'web' | 'news' | 'images',
        language,
        engines: engines?.split?.(',').filter(Boolean) || engines,
        timing: { onStart: false, eachRound: false, beforeSummary: false, onDemand: false },
        fetchFullContent,
        fullContentMaxResults: fullContentLimit,
        relevanceFilter,
      };

      const defaultAI: DefaultAIConfig | undefined = defaultAIProvider
        ? { provider: defaultAIProvider, model: defaultAIModel }
        : undefined;

      const { results, warnings } = await performSearch(query, searchConfig, topic, defaultAI);

      // filteredCountをwarningから抽出
      const lowRelevanceWarning = warnings?.find(w => w.type === 'low_relevance');
      const filteredCount = lowRelevanceWarning
        ? parseInt(lowRelevanceWarning.message.match(/（(\d+)件除外）/)?.[1] || '0', 10)
        : 0;

      const duration = Date.now() - startTime;
      if (warnings && warnings.length > 0) {
        log.warn('Search completed with warnings', { query, resultCount: results.length, duration, filteredCount, warnings: warnings.map(w => w.type) });
      } else {
        log.info('Search completed with relevance filtering', { query, resultCount: results.length, duration, filteredCount });
      }
      return NextResponse.json({
        results,
        query,
        totalResults: results.length,
        provider: provider || 'default',
        warnings,
        filteredCount, // フィルタで除外された件数
      });
    }

    // 従来の検索処理
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
    if (result.warnings && result.warnings.length > 0) {
      log.warn('Search completed with warnings', { query, resultCount: result.results.length, duration, warnings: result.warnings.map(w => w.type) });
    } else {
      log.info('Search completed', { query, resultCount: result.results.length, duration });
    }
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
