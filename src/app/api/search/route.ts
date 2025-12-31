import { NextRequest, NextResponse } from 'next/server';
import { SearchResult } from '@/types';

const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL || 'http://localhost:8080';

interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
  publishedDate?: string;
  img_src?: string;
  thumbnail?: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
  query: string;
  number_of_results: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const searchType = searchParams.get('type') || 'web';
  const maxResults = parseInt(searchParams.get('limit') || '5', 10);
  const language = searchParams.get('lang') || 'ja';
  const engines = searchParams.get('engines');

  if (!query) {
    return NextResponse.json(
      { error: '検索クエリが指定されていません' },
      { status: 400 }
    );
  }

  try {
    // SearXNGのエンドポイントを構築
    const url = new URL('/search', SEARXNG_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', language);

    // 検索タイプに応じたカテゴリを設定
    if (searchType === 'news') {
      url.searchParams.set('categories', 'news');
    } else if (searchType === 'images') {
      url.searchParams.set('categories', 'images');
    } else {
      url.searchParams.set('categories', 'general');
    }

    // 特定のエンジンを指定
    if (engines) {
      url.searchParams.set('engines', engines);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SearXNG returned status ${response.status}`);
    }

    const data: SearXNGResponse = await response.json();

    // 結果を整形して返す
    const results: SearchResult[] = data.results
      .slice(0, maxResults)
      .map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content || '',
        engine: result.engine,
        publishedDate: result.publishedDate,
      }));

    return NextResponse.json({
      query: data.query,
      results,
      totalResults: data.number_of_results,
    });
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
    const { query, type = 'web', limit = 5, language = 'ja', engines } = body;

    if (!query) {
      return NextResponse.json(
        { error: '検索クエリが指定されていません' },
        { status: 400 }
      );
    }

    // GETと同じロジックを使用
    const url = new URL('/search', SEARXNG_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', language);

    if (type === 'news') {
      url.searchParams.set('categories', 'news');
    } else if (type === 'images') {
      url.searchParams.set('categories', 'images');
    } else {
      url.searchParams.set('categories', 'general');
    }

    if (engines) {
      url.searchParams.set('engines', engines);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SearXNG returned status ${response.status}`);
    }

    const data: SearXNGResponse = await response.json();

    const results: SearchResult[] = data.results
      .slice(0, limit)
      .map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content || '',
        engine: result.engine,
        publishedDate: result.publishedDate,
      }));

    return NextResponse.json({
      query: data.query,
      results,
      totalResults: data.number_of_results,
    });
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
