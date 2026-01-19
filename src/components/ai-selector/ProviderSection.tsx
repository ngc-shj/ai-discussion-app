'use client';

import { useState, useRef, useEffect } from 'react';
import { AIProviderType, ModelInfo, getLocalModelColor } from '@/types';
import { ModelFilterType } from '@/hooks/useAISelector';

interface ProviderInfo {
  id: AIProviderType;
  name: string;
  color: string;
  isLocal?: boolean;
}

interface ProviderSectionProps {
  provider: ProviderInfo;
  isAvailable: boolean;
  isExpanded: boolean;
  allModels: ModelInfo[];
  filteredModels: ModelInfo[];
  selectedCount: number;
  modelFilter: ModelFilterType;
  disabled?: boolean;
  supportAgentModelId?: string;
  supportAgentProvider?: string;
  onToggleExpanded: () => void;
  onAddParticipant: (modelId: string, displayName: string, color: string) => void;
  onSetSupportAgent: (modelId: string) => void;
  getParticipantCount: (modelId: string) => number;
}

export function ProviderSection({
  provider,
  isAvailable,
  isExpanded,
  allModels,
  filteredModels,
  selectedCount,
  modelFilter,
  disabled,
  supportAgentModelId,
  supportAgentProvider,
  onToggleExpanded,
  onAddParticipant,
  onSetSupportAgent,
  getParticipantCount,
}: ProviderSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 検索モードに入ったらinputにフォーカス
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchMode]);

  // 折りたたみ時に検索モードをリセット
  useEffect(() => {
    if (!isExpanded) {
      setIsSearchMode(false);
      setSearchQuery('');
    }
  }, [isExpanded]);

  // 検索クエリでフィルタリング
  const searchFilteredModels = searchQuery
    ? filteredModels.filter((model) =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredModels;

  const handleHeaderClick = () => {
    if (!isAvailable) return;
    // ヘッダークリックは常に開閉トグル
    onToggleExpanded();
    if (isExpanded) {
      setIsSearchMode(false);
      setSearchQuery('');
    }
  };

  const handleSearchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      onToggleExpanded();
    }
    setIsSearchMode(true);
  };

  const handleSearchBlur = () => {
    // 検索クエリが空なら検索モードを終了
    if (!searchQuery) {
      setIsSearchMode(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setIsSearchMode(false);
    }
  };

  return (
    <div
      className={`rounded-lg bg-gray-800 overflow-hidden ${
        !isAvailable ? 'opacity-50' : ''
      }`}
    >
      {/* プロバイダーヘッダー */}
      <div
        className={`w-full flex items-center gap-2 p-3 ${
          isAvailable ? 'hover:bg-gray-700/50 cursor-pointer' : 'cursor-not-allowed'
        } transition-colors`}
        onClick={handleHeaderClick}
      >
        {/* 折りたたみ矢印 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isAvailable) {
              onToggleExpanded();
              if (isExpanded) {
                setIsSearchMode(false);
                setSearchQuery('');
              }
            }
          }}
          disabled={!isAvailable}
          className="p-0 bg-transparent border-none"
          title={isExpanded ? '折りたたむ' : '展開する'}
          aria-label={isExpanded ? '折りたたむ' : '展開する'}
        >
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: provider.color }}
        >
          {provider.name.charAt(0)}
        </div>

        {/* 検索モード時は検索入力を表示 */}
        {isSearchMode ? (
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={handleSearchBlur}
            onKeyDown={handleSearchKeyDown}
            onClick={(e) => e.stopPropagation()}
            placeholder={`${provider.name}のモデルを検索...`}
            className="flex-1 bg-gray-700 text-gray-200 text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        ) : (
          <span className="text-gray-200 font-medium">{provider.name}</span>
        )}

        {selectedCount > 0 && !isSearchMode && (
          <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
            {selectedCount}
          </span>
        )}

        {!isSearchMode && (
          <>
            <span className="ml-auto text-xs text-gray-500">
              {allModels.length}モデル
            </span>
            {/* 検索ボタン（展開時のみ表示） */}
            {isExpanded && allModels.length > 5 && (
              <button
                type="button"
                onClick={handleSearchClick}
                className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded"
                title="モデルを検索"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </>
        )}

        {isSearchMode && searchQuery && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSearchQuery('');
              searchInputRef.current?.focus();
            }}
            className="p-1 text-gray-400 hover:text-gray-200"
            title="クリア"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {!isAvailable && (
          <span className="text-xs text-red-400">利用不可</span>
        )}
      </div>

      {/* モデル一覧（折りたたみ可能） */}
      {isAvailable && isExpanded && (
        <div className="px-3 pb-3 space-y-1 ml-6 max-h-48 overflow-y-auto mr-2">
          {searchFilteredModels.length > 0 ? (
            <>
              {searchFilteredModels.map((model) => {
                const modelColor = provider.isLocal ? getLocalModelColor(model.id) : provider.color;
                const displayName = model.name;
                const count = getParticipantCount(model.id);
                const isSupportAgent = supportAgentProvider === provider.id && supportAgentModelId === model.id;

                return (
                  <div
                    key={model.id}
                    className={`flex items-center gap-2 p-3 sm:p-2 min-h-[44px] rounded hover:bg-gray-700/50 transition-colors ${
                      isSupportAgent ? 'bg-purple-900/30 ring-1 ring-purple-500/50' : ''
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: modelColor }}
                    />
                    <span className="text-sm text-gray-300 truncate flex-1" title={model.name}>
                      {model.name}
                    </span>
                    {isSupportAgent && (
                      <span className="text-xs text-purple-400 shrink-0">サポート</span>
                    )}
                    {count > 0 && (
                      <span className="text-xs text-blue-400 shrink-0">×{count}</span>
                    )}
                    {/* ロール選択ドロップダウン + 追加ボタン */}
                    <select
                      value=""
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'participant') {
                          onAddParticipant(model.id, displayName, modelColor);
                        } else if (value === 'support') {
                          onSetSupportAgent(model.id);
                        }
                        e.target.value = '';
                      }}
                      disabled={disabled}
                      className="shrink-0 w-24 sm:w-20 px-2 sm:px-1 py-1 sm:py-0.5 text-sm sm:text-xs bg-gray-700 text-gray-300 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title="追加先を選択"
                    >
                      <option value="" disabled>追加...</option>
                      <option value="participant">参加者</option>
                      <option value="support">{isSupportAgent ? 'サポート✓' : 'サポート'}</option>
                    </select>
                  </div>
                );
              })}
              {searchQuery && searchFilteredModels.length < filteredModels.length && (
                <div className="text-xs text-gray-500 pl-2 pt-1">
                  {searchFilteredModels.length}/{filteredModels.length} 件表示
                </div>
              )}
              {!searchQuery && modelFilter !== 'all' && allModels.length > filteredModels.length && (
                <div className="text-xs text-gray-500 pl-2 pt-1">
                  他 {allModels.length - filteredModels.length} モデル（「すべて」で表示）
                </div>
              )}
            </>
          ) : searchQuery ? (
            <div className="text-xs text-gray-400 p-2">
              「{searchQuery}」に一致するモデルがありません
            </div>
          ) : (
            <div className="text-xs text-gray-400 flex items-center gap-2 p-2">
              <div className="animate-spin w-3 h-3 border-2 border-gray-500 border-t-gray-300 rounded-full" />
              モデル一覧を取得中...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
