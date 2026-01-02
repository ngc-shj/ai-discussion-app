'use client';

import {
  DiscussionMode,
  DISCUSSION_MODE_PRESETS,
  DiscussionDepth,
  DISCUSSION_DEPTH_PRESETS,
  DirectionGuide,
  TerminationConfig,
  SearchConfig,
} from '@/types';
import { useInputForm } from '@/hooks/useInputForm';
import { DiscussionOptionsPanel } from './DiscussionOptionsPanel';

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
  const {
    topic,
    isModeExpanded,
    keywordInput,
    termKeywordInput,
    setTopic,
    setIsModeExpanded,
    setKeywordInput,
    setTermKeywordInput,
    handleSubmit,
    handleAddKeyword,
    handleRemoveKeyword,
    handleKeywordKeyDown,
    handleAddTermKeyword,
    handleRemoveTermKeyword,
    handleTermKeywordKeyDown,
  } = useInputForm({
    onSubmit,
    disabled,
    presetTopic,
    onPresetTopicClear,
    directionGuide,
    onDirectionGuideChange,
    terminationConfig,
    onTerminationConfigChange,
  });

  const currentModePreset = DISCUSSION_MODE_PRESETS.find((m) => m.id === discussionMode);
  const currentDepthPreset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === discussionDepth);

  // 設定のサマリーを生成
  const hasCustomSettings =
    searchConfig.enabled ||
    discussionMode !== 'free' ||
    discussionDepth !== 3 ||
    directionGuide.keywords.length > 0 ||
    terminationConfig.condition !== 'rounds';

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
          <DiscussionOptionsPanel
            disabled={disabled}
            searchConfig={searchConfig}
            onSearchConfigChange={onSearchConfigChange}
            discussionMode={discussionMode}
            onDiscussionModeChange={onDiscussionModeChange}
            discussionDepth={discussionDepth}
            onDiscussionDepthChange={onDiscussionDepthChange}
            directionGuide={directionGuide}
            keywordInput={keywordInput}
            onKeywordInputChange={setKeywordInput}
            onAddKeyword={handleAddKeyword}
            onRemoveKeyword={handleRemoveKeyword}
            onKeywordKeyDown={handleKeywordKeyDown}
            terminationConfig={terminationConfig}
            onTerminationConfigChange={onTerminationConfigChange}
            termKeywordInput={termKeywordInput}
            onTermKeywordInputChange={setTermKeywordInput}
            onAddTermKeyword={handleAddTermKeyword}
            onRemoveTermKeyword={handleRemoveTermKeyword}
            onTermKeywordKeyDown={handleTermKeywordKeyDown}
          />
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
