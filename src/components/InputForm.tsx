'use client';

import { useState, useEffect, FormEvent } from 'react';
import { DiscussionMode, DISCUSSION_MODE_PRESETS, DiscussionDepth, DISCUSSION_DEPTH_PRESETS, DirectionGuide, TerminationConfig, TERMINATION_PRESETS, SearchConfig } from '@/types';

interface InputFormProps {
  onSubmit: (topic: string) => void;
  disabled?: boolean;
  presetTopic?: string;
  onPresetTopicClear?: () => void;
  searchConfig: SearchConfig;
  onSearchConfigChange: (config: SearchConfig) => void;
  discussionMode: DiscussionMode;
  onDiscussionModeChange: (mode: DiscussionMode) => void;
  discussionDepth: DiscussionDepth;
  onDiscussionDepthChange: (depth: DiscussionDepth) => void;
  directionGuide: DirectionGuide;
  onDirectionGuideChange: (guide: DirectionGuide) => void;
  terminationConfig: TerminationConfig;
  onTerminationConfigChange: (config: TerminationConfig) => void;
}

export function InputForm({
  onSubmit,
  disabled,
  presetTopic,
  onPresetTopicClear,
  searchConfig,
  onSearchConfigChange,
  discussionMode,
  onDiscussionModeChange,
  discussionDepth,
  onDiscussionDepthChange,
  directionGuide,
  onDirectionGuideChange,
  terminationConfig,
  onTerminationConfigChange,
}: InputFormProps) {
  const [topic, setTopic] = useState('');
  const [isModeExpanded, setIsModeExpanded] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [termKeywordInput, setTermKeywordInput] = useState('');

  // プリセットトピックが設定されたら入力欄に反映
  useEffect(() => {
    if (presetTopic) {
      setTopic(presetTopic);
      onPresetTopicClear?.();
    }
  }, [presetTopic, onPresetTopicClear]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !disabled) {
      onSubmit(topic.trim());
      setTopic('');
    }
  };

  const currentModePreset = DISCUSSION_MODE_PRESETS.find((m) => m.id === discussionMode);
  const currentDepthPreset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === discussionDepth);

  // キーワード追加
  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !directionGuide.keywords.includes(trimmed)) {
      onDirectionGuideChange({
        ...directionGuide,
        keywords: [...directionGuide.keywords, trimmed],
      });
      setKeywordInput('');
    }
  };

  // キーワード削除
  const handleRemoveKeyword = (keyword: string) => {
    onDirectionGuideChange({
      ...directionGuide,
      keywords: directionGuide.keywords.filter((k) => k !== keyword),
    });
  };

  // Enterキーでキーワード追加
  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  // 終了キーワード追加
  const handleAddTermKeyword = () => {
    const trimmed = termKeywordInput.trim();
    if (trimmed && !terminationConfig.terminationKeywords?.includes(trimmed)) {
      onTerminationConfigChange({
        ...terminationConfig,
        terminationKeywords: [...(terminationConfig.terminationKeywords || []), trimmed],
      });
      setTermKeywordInput('');
    }
  };

  // 終了キーワード削除
  const handleRemoveTermKeyword = (keyword: string) => {
    onTerminationConfigChange({
      ...terminationConfig,
      terminationKeywords: (terminationConfig.terminationKeywords || []).filter((k) => k !== keyword),
    });
  };

  // 設定のサマリーを生成
  const currentTermPreset = TERMINATION_PRESETS.find((t) => t.id === terminationConfig.condition);
  const hasCustomSettings = searchConfig.enabled || discussionMode !== 'free' || discussionDepth !== 3 || directionGuide.keywords.length > 0 || terminationConfig.condition !== 'rounds';

  return (
    <form onSubmit={handleSubmit} className="p-3 pb-4 md:p-4 md:pb-6 bg-gray-800 border-t border-gray-700">
      {/* 議論オプション（折りたたみ式） */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setIsModeExpanded(!isModeExpanded)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors cursor-pointer"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isModeExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>
            議論オプション
            {hasCustomSettings && <span className="ml-1 text-green-400">●</span>}
            <span className="ml-2 text-gray-500">
              ({currentModePreset?.name}, {currentDepthPreset?.name})
            </span>
          </span>
        </button>

        {/* 展開時の設定パネル */}
        {isModeExpanded && (
          <div className="mt-2 p-3 bg-gray-700/50 rounded-lg space-y-4">
            {/* 1. Web検索（情報収集） */}
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
                      className="px-2 py-1 bg-gray-600 text-white text-xs rounded border border-gray-500 focus:outline-none focus:border-green-500"
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
                      className="flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500">
                {searchConfig.enabled ? '最新情報を検索して議論に活用' : '検索なしで議論'}
              </p>
            </div>

            {/* 2. 議論モード選択 */}
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

            {/* 3. 議論の深さ（どこまで話すか） */}
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
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>概要</span>
                <span>標準</span>
                <span>徹底</span>
              </div>
              <p className="text-xs text-gray-500">{currentDepthPreset?.description}</p>
            </div>

            {/* 4. 注目キーワード（何に注目するか） */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400">注目キーワード（任意）</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder="キーワードを入力..."
                  disabled={disabled}
                  className="flex-1 px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
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
                        onClick={() => handleRemoveKeyword(keyword)}
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

            {/* 5. 終了条件（いつ終わるか） */}
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
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                      onChange={(e) => setTermKeywordInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTermKeyword(); } }}
                      placeholder="終了キーワード..."
                      disabled={disabled}
                      className="flex-1 px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddTermKeyword}
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
                            onClick={() => handleRemoveTermKeyword(keyword)}
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

              {/* 最大ラウンド数（安全策） */}
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
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gray-400"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 md:gap-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="議論したいトピックを入力..."
          disabled={disabled}
          className="flex-1 px-3 py-2 md:px-4 md:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm md:text-base"
        />
        <button
          type="submit"
          disabled={disabled || !topic.trim()}
          className="px-4 py-2 md:px-6 md:py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base whitespace-nowrap"
        >
          議論開始
        </button>
      </div>
    </form>
  );
}
