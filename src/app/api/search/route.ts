import { NextRequest, NextResponse } from 'next/server';
import { fetchSearchResults } from '@/lib/search';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const searchType = (searchParams.get('type') || 'web') as 'web' | 'news' | 'images';
  const maxResults = parseInt(searchParams.get('limit') || '5', 10);
  const language = searchParams.get('lang') || 'ja';
  const engines = searchParams.get('engines')?.split(',').filter(Boolean);

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
    });

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
    });

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
