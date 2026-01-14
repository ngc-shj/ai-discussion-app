'use client';

import { useState, useEffect, ReactNode } from 'react';
import {
  DiscussionMode,
  DISCUSSION_MODE_PRESETS,
  DiscussionDepth,
  DISCUSSION_DEPTH_PRESETS,
  DirectionGuide,
  TerminationConfig,
  TERMINATION_PRESETS,
  SearchConfig,
  SEARCH_ENGINE_PRESETS,
  SearchProviderType,
} from '@/types';

// タブの種類
type OptionsTab = 'search' | 'discussion';

// アコーディオンコンポーネント
interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: ReactNode;
}

function Accordion({ title, defaultOpen = false, children, badge }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-600/50 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-700/30 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300">{title}</span>
          {badge}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 py-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// 検索プロバイダー情報
interface SearchProviderInfo {
  id: SearchProviderType;
  name: string;
  description: string;
  requiresApiKey: boolean;
  available: boolean;
}

interface DiscussionOptionsPanelProps {
  disabled?: boolean;
  onClose?: () => void;
  // Search
  searchConfig: SearchConfig;
  onSearchConfigChange: (config: SearchConfig) => void;
  // Mode
  discussionMode: DiscussionMode;
  onDiscussionModeChange: (mode: DiscussionMode) => void;
  // Depth
  discussionDepth: DiscussionDepth;
  onDiscussionDepthChange: (depth: DiscussionDepth) => void;
  // Keywords
  directionGuide: DirectionGuide;
  keywordInput: string;
  onKeywordInputChange: (input: string) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (keyword: string) => void;
  onKeywordKeyDown: (e: React.KeyboardEvent) => void;
  // Focus Areas
  focusAreaInput: string;
  onFocusAreaInputChange: (input: string) => void;
  onAddFocusArea: () => void;
  onRemoveFocusArea: (area: string) => void;
  onFocusAreaKeyDown: (e: React.KeyboardEvent) => void;
  // Avoid Topics
  avoidTopicInput: string;
  onAvoidTopicInputChange: (input: string) => void;
  onAddAvoidTopic: () => void;
  onRemoveAvoidTopic: (topic: string) => void;
  onAvoidTopicKeyDown: (e: React.KeyboardEvent) => void;
  // Termination
  terminationConfig: TerminationConfig;
  onTerminationConfigChange: (config: TerminationConfig) => void;
  termKeywordInput: string;
  onTermKeywordInputChange: (input: string) => void;
  onAddTermKeyword: () => void;
  onRemoveTermKeyword: (keyword: string) => void;
  onTermKeywordKeyDown: (e: React.KeyboardEvent) => void;
}

export function DiscussionOptionsPanel({
  disabled,
  onClose,
  searchConfig,
  onSearchConfigChange,
  discussionMode,
  onDiscussionModeChange,
  discussionDepth,
  onDiscussionDepthChange,
  directionGuide,
  keywordInput,
  onKeywordInputChange,
  onAddKeyword,
  onRemoveKeyword,
  onKeywordKeyDown,
  focusAreaInput,
  onFocusAreaInputChange,
  onAddFocusArea,
  onRemoveFocusArea,
  onFocusAreaKeyDown,
  avoidTopicInput,
  onAvoidTopicInputChange,
  onAddAvoidTopic,
  onRemoveAvoidTopic,
  onAvoidTopicKeyDown,
  terminationConfig,
  onTerminationConfigChange,
  termKeywordInput,
  onTermKeywordInputChange,
  onAddTermKeyword,
  onRemoveTermKeyword,
  onTermKeywordKeyDown,
}: DiscussionOptionsPanelProps) {
  const [activeTab, setActiveTab] = useState<OptionsTab>('search');

  const currentModePreset = DISCUSSION_MODE_PRESETS.find((m) => m.id === discussionMode);
  const currentDepthPreset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === discussionDepth);
  const currentTermPreset = TERMINATION_PRESETS.find((t) => t.id === terminationConfig.condition);

  // 各タブにカスタム設定があるかどうか
  const hasSearchCustom = searchConfig.enabled;
  const hasDiscussionCustom =
    discussionMode !== 'free' ||
    discussionDepth !== 3 ||
    directionGuide.keywords.length > 0 ||
    terminationConfig.condition !== 'rounds';

  return (
    <div className="flex flex-col h-full">
      {/* タブヘッダー */}
      <div className="flex items-center border-b border-gray-700 mb-3">
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'search'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          情報取得
          {hasSearchCustom && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('discussion')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'discussion'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          議論オプション
          {hasDiscussionCustom && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
        </button>
        {/* 閉じるボタン */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="議論オプションを閉じる"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* タブコンテンツ - flex-1で親いっぱいに広がる、両方レンダリングしてhiddenで切り替え（カクカク防止） */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${activeTab === 'search' ? '' : 'hidden'}`}>
        <div className="p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
          <SearchConfigSection
            disabled={disabled}
            searchConfig={searchConfig}
            onSearchConfigChange={onSearchConfigChange}
          />
        </div>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto ${activeTab === 'discussion' ? '' : 'hidden'}`}>
        <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg space-y-3">
          {/* 基本設定（常に表示） */}
          <div className="space-y-3">
            {/* 議論モード選択 */}
            <ModeSection
              disabled={disabled}
              discussionMode={discussionMode}
              onDiscussionModeChange={onDiscussionModeChange}
              currentModePreset={currentModePreset}
            />

            {/* 議論の深さ */}
            <DepthSection
              disabled={disabled}
              discussionDepth={discussionDepth}
              onDiscussionDepthChange={onDiscussionDepthChange}
              currentDepthPreset={currentDepthPreset}
            />
          </div>

          {/* 詳細設定 */}
          <Accordion
            title="詳細設定"
            defaultOpen={false}
            badge={
              (directionGuide.keywords.length > 0 ||
                (directionGuide.focusAreas?.length ?? 0) > 0 ||
                (directionGuide.avoidTopics?.length ?? 0) > 0 ||
                terminationConfig.condition !== 'rounds')
                ? <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                : undefined
            }
          >
            {/* 注目キーワード・深掘り領域・避けたいトピック */}
            <KeywordSection
              disabled={disabled}
              directionGuide={directionGuide}
              keywordInput={keywordInput}
              onKeywordInputChange={onKeywordInputChange}
              onAddKeyword={onAddKeyword}
              onRemoveKeyword={onRemoveKeyword}
              onKeywordKeyDown={onKeywordKeyDown}
              focusAreaInput={focusAreaInput}
              onFocusAreaInputChange={onFocusAreaInputChange}
              onAddFocusArea={onAddFocusArea}
              onRemoveFocusArea={onRemoveFocusArea}
              onFocusAreaKeyDown={onFocusAreaKeyDown}
              avoidTopicInput={avoidTopicInput}
              onAvoidTopicInputChange={onAvoidTopicInputChange}
              onAddAvoidTopic={onAddAvoidTopic}
              onRemoveAvoidTopic={onRemoveAvoidTopic}
              onAvoidTopicKeyDown={onAvoidTopicKeyDown}
            />

            {/* 終了条件 */}
            <TerminationSection
              disabled={disabled}
              terminationConfig={terminationConfig}
              onTerminationConfigChange={onTerminationConfigChange}
              currentTermPreset={currentTermPreset}
              termKeywordInput={termKeywordInput}
              onTermKeywordInputChange={onTermKeywordInputChange}
              onAddTermKeyword={onAddTermKeyword}
              onRemoveTermKeyword={onRemoveTermKeyword}
              onTermKeywordKeyDown={onTermKeywordKeyDown}
            />
          </Accordion>
        </div>
      </div>
    </div>
  );
}

// ============================================
// サブコンポーネント
// ============================================

interface SearchConfigSectionProps {
  disabled?: boolean;
  searchConfig: SearchConfig;
  onSearchConfigChange: (config: SearchConfig) => void;
}

function SearchConfigSection({ disabled, searchConfig, onSearchConfigChange }: SearchConfigSectionProps) {
  // timing のデフォルト値を確保
  const timing = searchConfig.timing || { onStart: true, eachRound: false, beforeSummary: false, onDemand: false };

  // 検索プロバイダー情報を取得
  const [providers, setProviders] = useState<SearchProviderInfo[]>([]);
  const [defaultProvider, setDefaultProvider] = useState<SearchProviderType>('duckduckgo');

  useEffect(() => {
    fetch('/api/search-providers')
      .then(res => res.json())
      .then(data => {
        setProviders(data.providers || []);
        setDefaultProvider(data.defaultProvider || 'duckduckgo');
      })
      .catch(console.error);
  }, []);

  const handleTimingChange = (key: 'onStart' | 'eachRound' | 'beforeSummary' | 'onDemand', value: boolean) => {
    onSearchConfigChange({
      ...searchConfig,
      timing: { ...timing, [key]: value }
    });
  };

  // 現在のプロバイダー（未設定の場合はデフォルト）
  const currentProvider = searchConfig.provider || defaultProvider;
  const isSearXNG = currentProvider === 'searxng';

  // 詳細設定がカスタマイズされているかどうか
  const hasAdvancedCustom =
    timing.eachRound ||
    timing.beforeSummary ||
    timing.onDemand ||
    searchConfig.fetchFullContent ||
    searchConfig.relevanceFilter?.enabled;

  return (
    <div className="space-y-3">
      {/* Web検索ON/OFF（常に表示） */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">Web検索</label>
        <button
          type="button"
          onClick={() => onSearchConfigChange({ ...searchConfig, enabled: !searchConfig.enabled })}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            searchConfig.enabled ? 'bg-green-600' : 'bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          aria-label="Web検索を切り替え"
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              searchConfig.enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {searchConfig.enabled && (
        <div className="space-y-3">
          {/* 基本設定（常に表示） */}
          <div className="space-y-3">
            {/* 検索プロバイダー選択 */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">検索プロバイダー</label>
              <div className="flex flex-wrap gap-1.5">
                {providers.filter(p => p.available).map((provider) => {
                  const isSelected = currentProvider === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        // DuckDuckGoはニュース検索非対応のため、自動的にwebに切り替え
                        const newSearchType = provider.id === 'duckduckgo' && searchConfig.searchType === 'news'
                          ? 'web'
                          : searchConfig.searchType;
                        onSearchConfigChange({
                          ...searchConfig,
                          provider: provider.id,
                          searchType: newSearchType
                        });
                      }}
                      disabled={disabled}
                      title={provider.description}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        isSelected
                          ? 'bg-green-600 border-green-500 text-white'
                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {provider.name}
                    </button>
                  );
                })}
              </div>
              {providers.length === 0 && (
                <p className="text-xs text-gray-500">プロバイダーを読み込み中...</p>
              )}
            </div>

            {/* SearXNG用: 検索エンジン選択 */}
            {isSearXNG && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">SearXNGエンジン</label>
                <div className="flex flex-wrap gap-1.5">
                  {SEARCH_ENGINE_PRESETS.map((engine) => {
                    const isSelected = searchConfig.engines?.includes(engine.id) ?? (engine.id === 'google');
                    return (
                      <button
                        key={engine.id}
                        type="button"
                        onClick={() => {
                          const currentEngines = searchConfig.engines ?? ['google'];
                          let newEngines: string[];
                          if (isSelected) {
                            // 最低1つは選択されている必要がある
                            if (currentEngines.length > 1) {
                              newEngines = currentEngines.filter(e => e !== engine.id);
                            } else {
                              return; // 1つしかない場合は解除不可
                            }
                          } else {
                            newEngines = [...currentEngines, engine.id];
                          }
                          onSearchConfigChange({
                            ...searchConfig,
                            engines: newEngines
                          });
                        }}
                        disabled={disabled}
                        title={engine.description}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                          isSelected
                            ? 'bg-green-600 border-green-500 text-white'
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {engine.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 検索タイプ */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">検索タイプ</label>
              <div className="flex items-center gap-2">
                <select
                  value={searchConfig.provider === 'duckduckgo' ? 'web' : searchConfig.searchType}
                  onChange={(e) => onSearchConfigChange({
                    ...searchConfig,
                    searchType: e.target.value as 'web' | 'news' | 'images'
                  })}
                  disabled={disabled || searchConfig.provider === 'duckduckgo'}
                  title={searchConfig.provider === 'duckduckgo' ? 'DuckDuckGoはWeb検索のみ対応' : '検索タイプを選択'}
                  className="px-2 py-1 bg-gray-600 text-white text-xs rounded border border-gray-500 focus:outline-none focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="web">Web検索</option>
                  <option value="news" disabled={searchConfig.provider === 'duckduckgo'}>ニュース</option>
                </select>
                {searchConfig.provider === 'duckduckgo' && (
                  <span className="text-xs text-red-400">Web検索のみ</span>
                )}
              </div>
            </div>

            {/* 検索結果数 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">検索結果数</label>
                <span className="text-xs text-green-400">{searchConfig.maxResults}件</span>
              </div>
              <input
                type="range"
                min="3"
                max="10"
                value={searchConfig.maxResults}
                onChange={(e) => {
                  const newMaxResults = Number(e.target.value);
                  const currentFullContent = searchConfig.fullContentMaxResults || 3;
                  onSearchConfigChange({
                    ...searchConfig,
                    maxResults: newMaxResults,
                    fullContentMaxResults: Math.min(currentFullContent, newMaxResults)
                  });
                }}
                disabled={disabled}
                title={`検索結果数: ${searchConfig.maxResults}`}
                className={`w-full h-1.5 bg-gray-600 rounded-lg appearance-none accent-green-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              />
            </div>
          </div>

          {/* 詳細設定 */}
          <Accordion
            title="詳細設定"
            defaultOpen={false}
            badge={hasAdvancedCustom ? <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> : undefined}
          >
            {/* 検索タイミング */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">検索タイミング</label>
              <div className="space-y-1">
                <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={timing.onStart}
                    onChange={(e) => handleTimingChange('onStart', e.target.checked)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 rounded border-gray-500 bg-gray-600 text-green-500 focus:ring-green-500 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-300">開始時に検索</span>
                </label>
                <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={timing.eachRound}
                    onChange={(e) => handleTimingChange('eachRound', e.target.checked)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 rounded border-gray-500 bg-gray-600 text-green-500 focus:ring-green-500 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-300">ラウンドごとに検索</span>
                </label>
                <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={timing.beforeSummary}
                    onChange={(e) => handleTimingChange('beforeSummary', e.target.checked)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 rounded border-gray-500 bg-gray-600 text-green-500 focus:ring-green-500 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-300">統合前検索</span>
                </label>
                <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={timing.onDemand}
                    onChange={(e) => handleTimingChange('onDemand', e.target.checked)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 rounded border-gray-500 bg-gray-600 text-green-500 focus:ring-green-500 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-300">AIが要求した時に検索</span>
                  <span className="text-xs text-gray-500">([[SEARCH:...]])</span>
                </label>
              </div>
            </div>

            {/* ページ詳細取得（Jina Reader） */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 shrink-0">ページ全文取得</label>
                <button
                  type="button"
                  onClick={() => onSearchConfigChange({ ...searchConfig, fetchFullContent: !searchConfig.fetchFullContent })}
                  disabled={disabled}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                    searchConfig.fetchFullContent ? 'bg-green-600' : 'bg-gray-600'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label="ページ詳細取得を切り替え"
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      searchConfig.fetchFullContent ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
                {searchConfig.fetchFullContent && (
                  <>
                    <input
                      type="range"
                      min="1"
                      max={searchConfig.maxResults}
                      value={Math.min(searchConfig.fullContentMaxResults || 3, searchConfig.maxResults)}
                      onChange={(e) => onSearchConfigChange({
                        ...searchConfig,
                        fullContentMaxResults: Number(e.target.value)
                      })}
                      disabled={disabled}
                      title={`上位${Math.min(searchConfig.fullContentMaxResults || 3, searchConfig.maxResults)}件の全文を取得`}
                      className={`flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none accent-green-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    />
                    <span className="text-xs text-green-400 shrink-0">{Math.min(searchConfig.fullContentMaxResults || 3, searchConfig.maxResults)}件</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {searchConfig.fetchFullContent
                  ? `Jina Readerで上位${Math.min(searchConfig.fullContentMaxResults || 3, searchConfig.maxResults)}件の全文を取得`
                  : 'スニペットのみ（高速）'}
              </p>
            </div>

            {/* 関連性フィルタリング */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 shrink-0">関連性フィルタ</label>
                <button
                  type="button"
                  onClick={() => onSearchConfigChange({
                    ...searchConfig,
                    relevanceFilter: {
                      ...searchConfig.relevanceFilter,
                      enabled: !searchConfig.relevanceFilter?.enabled
                    }
                  })}
                  disabled={disabled}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                    searchConfig.relevanceFilter?.enabled ? 'bg-purple-600' : 'bg-gray-600'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label="関連性フィルタリングを切り替え"
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      searchConfig.relevanceFilter?.enabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
                {searchConfig.relevanceFilter?.enabled && (
                  <>
                    <span className="text-xs text-gray-400">閾値:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={(searchConfig.relevanceFilter?.threshold ?? 0.5) * 100}
                      onChange={(e) => onSearchConfigChange({
                        ...searchConfig,
                        relevanceFilter: {
                          ...searchConfig.relevanceFilter,
                          enabled: true,
                          threshold: Number(e.target.value) / 100
                        }
                      })}
                      disabled={disabled}
                      title={`関連性スコア${(searchConfig.relevanceFilter?.threshold ?? 0.5) * 100}%以上のみ採用`}
                      className={`flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none accent-purple-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    />
                    <span className="text-xs text-purple-400 shrink-0">{Math.round((searchConfig.relevanceFilter?.threshold ?? 0.5) * 100)}%</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {searchConfig.relevanceFilter?.enabled
                  ? `AIがトピックとの関連性を判定し、${Math.round((searchConfig.relevanceFilter?.threshold ?? 0.5) * 100)}%以下を除外`
                  : '全検索結果を使用'}
              </p>
            </div>
          </Accordion>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {searchConfig.enabled ? '最新情報を検索して議論に活用' : '検索なしで議論'}
      </p>
    </div>
  );
}

interface ModeSectionProps {
  disabled?: boolean;
  discussionMode: DiscussionMode;
  onDiscussionModeChange: (mode: DiscussionMode) => void;
  currentModePreset?: { description: string };
}

function ModeSection({ disabled, discussionMode, onDiscussionModeChange, currentModePreset }: ModeSectionProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400">議論モード</label>
      <div className="flex flex-wrap gap-2">
        {DISCUSSION_MODE_PRESETS.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onDiscussionModeChange(mode.id)}
            disabled={disabled}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              discussionMode === mode.id
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={mode.description}
          >
            {mode.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {currentModePreset?.description || ''}
      </p>
    </div>
  );
}

interface DepthSectionProps {
  disabled?: boolean;
  discussionDepth: DiscussionDepth;
  onDiscussionDepthChange: (depth: DiscussionDepth) => void;
  currentDepthPreset?: { name: string; wordCount: string; description: string };
}

function DepthSection({ disabled, discussionDepth, onDiscussionDepthChange, currentDepthPreset }: DepthSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">議論の深さ</label>
        <span className="text-xs text-blue-400">
          {currentDepthPreset?.name} ({currentDepthPreset?.wordCount})
        </span>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        value={discussionDepth}
        onChange={(e) => onDiscussionDepthChange(Number(e.target.value) as DiscussionDepth)}
        disabled={disabled}
        title={`議論の深さ: ${currentDepthPreset?.name}`}
        className={`w-full h-2 bg-gray-600 rounded-lg appearance-none accent-blue-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>概要</span>
        <span>標準</span>
        <span>徹底</span>
      </div>
      <p className="text-xs text-gray-500">{currentDepthPreset?.description}</p>
    </div>
  );
}

interface KeywordSectionProps {
  disabled?: boolean;
  directionGuide: DirectionGuide;
  keywordInput: string;
  onKeywordInputChange: (input: string) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (keyword: string) => void;
  onKeywordKeyDown: (e: React.KeyboardEvent) => void;
  focusAreaInput: string;
  onFocusAreaInputChange: (input: string) => void;
  onAddFocusArea: () => void;
  onRemoveFocusArea: (area: string) => void;
  onFocusAreaKeyDown: (e: React.KeyboardEvent) => void;
  avoidTopicInput: string;
  onAvoidTopicInputChange: (input: string) => void;
  onAddAvoidTopic: () => void;
  onRemoveAvoidTopic: (topic: string) => void;
  onAvoidTopicKeyDown: (e: React.KeyboardEvent) => void;
}

function KeywordSection({
  disabled,
  directionGuide,
  keywordInput,
  onKeywordInputChange,
  onAddKeyword,
  onRemoveKeyword,
  onKeywordKeyDown,
  focusAreaInput,
  onFocusAreaInputChange,
  onAddFocusArea,
  onRemoveFocusArea,
  onFocusAreaKeyDown,
  avoidTopicInput,
  onAvoidTopicInputChange,
  onAddAvoidTopic,
  onRemoveAvoidTopic,
  onAvoidTopicKeyDown,
}: KeywordSectionProps) {
  return (
    <div className="space-y-4">
      {/* 注目キーワード */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400">注目キーワード（任意）</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => onKeywordInputChange(e.target.value)}
            onKeyDown={onKeywordKeyDown}
            placeholder="キーワードを入力..."
            disabled={disabled}
            className="flex-1 px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={onAddKeyword}
            disabled={disabled || !keywordInput.trim()}
            className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>
        {directionGuide.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {directionGuide.keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded-full"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => onRemoveKeyword(keyword)}
                  disabled={disabled}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500">
          議論で特に注目してほしいキーワードを追加できます
        </p>
      </div>

      {/* 深掘りしたい領域 */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400">深掘りしたい領域（任意）</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={focusAreaInput}
            onChange={(e) => onFocusAreaInputChange(e.target.value)}
            onKeyDown={onFocusAreaKeyDown}
            placeholder="深掘りしたい領域を入力..."
            disabled={disabled}
            className="flex-1 px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={onAddFocusArea}
            disabled={disabled || !focusAreaInput.trim()}
            className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>
        {(directionGuide.focusAreas?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {directionGuide.focusAreas!.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/50 text-green-300 text-xs rounded-full"
              >
                {area}
                <button
                  type="button"
                  onClick={() => onRemoveFocusArea(area)}
                  disabled={disabled}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500">
          特に深く議論してほしい領域を指定できます
        </p>
      </div>

      {/* 避けたいトピック */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400">避けたいトピック（任意）</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={avoidTopicInput}
            onChange={(e) => onAvoidTopicInputChange(e.target.value)}
            onKeyDown={onAvoidTopicKeyDown}
            placeholder="避けたいトピックを入力..."
            disabled={disabled}
            className="flex-1 px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={onAddAvoidTopic}
            disabled={disabled || !avoidTopicInput.trim()}
            className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>
        {(directionGuide.avoidTopics?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {directionGuide.avoidTopics!.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/50 text-red-300 text-xs rounded-full"
              >
                {topic}
                <button
                  type="button"
                  onClick={() => onRemoveAvoidTopic(topic)}
                  disabled={disabled}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500">
          議論で触れてほしくないトピックを指定できます
        </p>
      </div>
    </div>
  );
}

interface TerminationSectionProps {
  disabled?: boolean;
  terminationConfig: TerminationConfig;
  onTerminationConfigChange: (config: TerminationConfig) => void;
  currentTermPreset?: { description: string };
  termKeywordInput: string;
  onTermKeywordInputChange: (input: string) => void;
  onAddTermKeyword: () => void;
  onRemoveTermKeyword: (keyword: string) => void;
  onTermKeywordKeyDown: (e: React.KeyboardEvent) => void;
}

function TerminationSection({
  disabled,
  terminationConfig,
  onTerminationConfigChange,
  currentTermPreset,
  termKeywordInput,
  onTermKeywordInputChange,
  onAddTermKeyword,
  onRemoveTermKeyword,
  onTermKeywordKeyDown,
}: TerminationSectionProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400">終了条件</label>
      <div className="flex flex-wrap gap-2">
        {TERMINATION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onTerminationConfigChange({ ...terminationConfig, condition: preset.id })}
            disabled={disabled}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              terminationConfig.condition === preset.id
                ? 'bg-orange-600 border-orange-500 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {currentTermPreset?.description || ''}
      </p>

      {/* 合意形成モードの閾値設定 */}
      {terminationConfig.condition === 'consensus' && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">合意閾値</span>
            <span className="text-xs text-orange-400">{Math.round((terminationConfig.consensusThreshold || 0.7) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.1"
            value={terminationConfig.consensusThreshold || 0.7}
            onChange={(e) => onTerminationConfigChange({ ...terminationConfig, consensusThreshold: Number(e.target.value) })}
            disabled={disabled}
            title={`合意閾値: ${Math.round((terminationConfig.consensusThreshold || 0.7) * 100)}%`}
            className={`w-full h-2 bg-gray-600 rounded-lg appearance-none accent-orange-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          />
        </div>
      )}

      {/* キーワード終了モードの設定 */}
      {terminationConfig.condition === 'keyword' && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={termKeywordInput}
              onChange={(e) => onTermKeywordInputChange(e.target.value)}
              onKeyDown={onTermKeywordKeyDown}
              placeholder="終了キーワード..."
              disabled={disabled}
              className="flex-1 px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={onAddTermKeyword}
              disabled={disabled || !termKeywordInput.trim()}
              className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              追加
            </button>
          </div>
          {(terminationConfig.terminationKeywords || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(terminationConfig.terminationKeywords || []).map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-900/50 text-orange-300 text-xs rounded-full"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => onRemoveTermKeyword(keyword)}
                    disabled={disabled}
                    className="hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 最大ラウンド数 */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">最大ラウンド数</span>
          <span className="text-xs text-gray-300">{terminationConfig.maxRounds}ラウンド</span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          value={terminationConfig.maxRounds}
          onChange={(e) => onTerminationConfigChange({ ...terminationConfig, maxRounds: Number(e.target.value) })}
          disabled={disabled}
          title={`最大ラウンド数: ${terminationConfig.maxRounds}`}
          className={`w-full h-2 bg-gray-600 rounded-lg appearance-none accent-gray-400 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        />
      </div>
    </div>
  );
}
