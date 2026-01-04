'use client';

import {
  DiscussionMode,
  DISCUSSION_MODE_PRESETS,
  DiscussionDepth,
  DISCUSSION_DEPTH_PRESETS,
  DirectionGuide,
  TerminationConfig,
  TERMINATION_PRESETS,
  SearchConfig,
} from '@/types';

interface DiscussionOptionsPanelProps {
  disabled?: boolean;
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
  terminationConfig,
  onTerminationConfigChange,
  termKeywordInput,
  onTermKeywordInputChange,
  onAddTermKeyword,
  onRemoveTermKeyword,
  onTermKeywordKeyDown,
}: DiscussionOptionsPanelProps) {
  const currentModePreset = DISCUSSION_MODE_PRESETS.find((m) => m.id === discussionMode);
  const currentDepthPreset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === discussionDepth);
  const currentTermPreset = TERMINATION_PRESETS.find((t) => t.id === terminationConfig.condition);

  return (
    <div className="mt-2 space-y-3">
      {/* 情報取得セクション */}
      <div className="p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs font-medium text-green-400">情報取得</span>
        </div>
        <SearchConfigSection
          disabled={disabled}
          searchConfig={searchConfig}
          onSearchConfigChange={onSearchConfigChange}
        />
      </div>

      {/* 議論設定セクション */}
      <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg space-y-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-medium text-blue-400">議論設定</span>
        </div>

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

        {/* 注目キーワード */}
        <KeywordSection
          disabled={disabled}
          directionGuide={directionGuide}
          keywordInput={keywordInput}
          onKeywordInputChange={onKeywordInputChange}
          onAddKeyword={onAddKeyword}
          onRemoveKeyword={onRemoveKeyword}
          onKeywordKeyDown={onKeywordKeyDown}
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
  return (
    <div className="space-y-2">
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
        <div className="space-y-2 pl-2 border-l-2 border-green-600/30">
          <div className="flex items-center gap-2">
            <select
              value={searchConfig.searchType}
              onChange={(e) => onSearchConfigChange({
                ...searchConfig,
                searchType: e.target.value as 'web' | 'news' | 'images'
              })}
              disabled={disabled}
              title="検索タイプを選択"
              className="px-2 py-1 bg-gray-600 text-white text-xs rounded border border-gray-500 focus:outline-none focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="web">Web検索</option>
              <option value="news">ニュース</option>
            </select>
            <span className="text-xs text-gray-400">結果数: {searchConfig.maxResults}</span>
            <input
              type="range"
              min="3"
              max="10"
              value={searchConfig.maxResults}
              onChange={(e) => onSearchConfigChange({
                ...searchConfig,
                maxResults: Number(e.target.value)
              })}
              disabled={disabled}
              title={`検索結果数: ${searchConfig.maxResults}`}
              className={`flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none accent-green-500 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            />
          </div>
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
}

function KeywordSection({
  disabled,
  directionGuide,
  keywordInput,
  onKeywordInputChange,
  onAddKeyword,
  onRemoveKeyword,
  onKeywordKeyDown,
}: KeywordSectionProps) {
  return (
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
