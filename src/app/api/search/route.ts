import { NextRequest, NextResponse } from 'next/server';
import { fetchSearchResults } from '@/lib/search';
import { enrichSearchResultsWithContent } from '@/lib/search/jina-reader';
import { SearchProviderType } from '@/types';

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
    return NextResponse.json(
      { error: '検索クエリが指定されていません' },
      { status: 400 }
    );
  }

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
      const enrichedResults = await enrichSearchResultsWithContent(
        result.results,
        { apiKey: process.env.JINA_API_KEY },
        fullContentMaxResults
      );
      return NextResponse.json({
        ...result,
        results: enrichedResults,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Search error:', error);
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
      return NextResponse.json(
        { error: '検索クエリが指定されていません' },
        { status: 400 }
      );
    }

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
      const enrichedResults = await enrichSearchResultsWithContent(
        result.results,
        { apiKey: process.env.JINA_API_KEY },
        fullContentLimit
      );
      return NextResponse.json({
        ...result,
        results: enrichedResults,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      {
        error: '検索に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
