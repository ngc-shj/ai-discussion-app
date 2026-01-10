'use client';

interface ProgressStatusProps {
  isSearching: boolean;
  isSummarizing: boolean;
  isSummaryStreaming?: boolean;
  isGeneratingFollowUps?: boolean;
  providerName: string;
  providerColor: string;
  currentRound: number;
  totalRounds: number;
  currentProviderIndex: number;
  totalProviders: number;
  elapsedTime?: string;
}

export function ProgressStatus({
  isSearching,
  isSummarizing,
  isSummaryStreaming = false,
  isGeneratingFollowUps = false,
  providerName,
  providerColor,
  elapsedTime,
}: ProgressStatusProps) {
  return (
    <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
      {isSearching ? (
        <>
          <div className="animate-spin w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-cyan-400 border-t-transparent rounded-full shrink-0" />
          <span className="text-cyan-400 font-medium truncate">
            <svg className="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Web検索中...
            {elapsedTime && <span className="ml-1 text-cyan-300/70">{elapsedTime}</span>}
          </span>
        </>
      ) : isGeneratingFollowUps ? (
        <>
          <div className="animate-spin w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-green-400 border-t-transparent rounded-full shrink-0" />
          <span className="text-green-400 font-medium truncate">
            フォローアップ質問を生成中...
          </span>
        </>
      ) : isSummaryStreaming ? (
        <>
          <div className="w-3.5 h-3.5 md:w-4 md:h-4 bg-purple-400 rounded-full animate-pulse shrink-0" />
          <span className="text-purple-400 font-medium truncate">
            統合回答を出力中...
          </span>
        </>
      ) : isSummarizing ? (
        <>
          <div className="animate-spin w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-purple-400 border-t-transparent rounded-full shrink-0" />
          <span className="text-purple-400 font-medium truncate">
            統合回答を生成中...
            {elapsedTime && <span className="ml-1 text-purple-300/70">{elapsedTime}</span>}
          </span>
        </>
      ) : (
        <>
          <div
            className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: providerColor }}
          />
          <span className="text-gray-300 truncate">
            <span className="font-medium" style={{ color: providerColor }}>
              {providerName}
            </span>
            <span className="hidden sm:inline">{' の応答待ち...'}</span>
            <span className="sm:hidden">...</span>
            {elapsedTime && <span className="ml-1 text-gray-400">{elapsedTime}</span>}
          </span>
        </>
      )}
    </div>
  );
}

interface ProgressInfoProps {
  isSearching: boolean;
  isSummarizing: boolean;
  isSummaryStreaming?: boolean;
  isGeneratingFollowUps?: boolean;
  currentRound: number;
  totalRounds: number;
  currentProviderIndex: number;
  totalProviders: number;
}

export function ProgressInfo({
  isSearching,
  isSummarizing,
  isSummaryStreaming = false,
  isGeneratingFollowUps = false,
  currentRound,
  totalRounds,
  currentProviderIndex,
  totalProviders,
}: ProgressInfoProps) {
  return (
    <div className="text-gray-400">
      {isSearching ? (
        <span className="hidden sm:inline">最新情報を取得中</span>
      ) : isGeneratingFollowUps ? (
        <span className="hidden sm:inline">提案を準備中</span>
      ) : isSummaryStreaming ? (
        <span className="hidden sm:inline">統合回答を出力中</span>
      ) : isSummarizing ? (
        <span className="hidden sm:inline">最終ステップ</span>
      ) : (
        <span>
          <span className="hidden sm:inline">ラウンド </span>{currentRound}/{totalRounds}
          <span className="hidden sm:inline"> ・ AI {currentProviderIndex + 1}/{totalProviders}</span>
        </span>
      )}
    </div>
  );
}
