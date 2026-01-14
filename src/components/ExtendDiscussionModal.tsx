'use client';

import { useState, useEffect } from 'react';
import {
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  ExtendDiscussionConfig,
  DISCUSSION_MODE_PRESETS,
  DISCUSSION_DEPTH_PRESETS,
} from '@/types';

interface ExtendDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtend: (config: ExtendDiscussionConfig) => void;
  currentRounds: number;
  currentMode?: DiscussionMode;
  currentDepth?: DiscussionDepth;
  currentKeywords?: string[];
}

export function ExtendDiscussionModal({
  isOpen,
  onClose,
  onExtend,
  currentRounds,
  currentMode = 'free',
  currentDepth = 3,
  currentKeywords = [],
}: ExtendDiscussionModalProps) {
  const [additionalRounds, setAdditionalRounds] = useState(2);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discussionMode, setDiscussionMode] = useState<DiscussionMode | 'keep'>(
    'keep'
  );
  const [discussionDepth, setDiscussionDepth] = useState<DiscussionDepth | 'keep'>(
    'keep'
  );
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');

  // ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const config: ExtendDiscussionConfig = {
      additionalRounds,
    };

    if (discussionMode !== 'keep') {
      config.discussionMode = discussionMode;
    }

    if (discussionDepth !== 'keep') {
      config.discussionDepth = discussionDepth;
    }

    if (keywords.length > 0 || currentKeywords.length > 0) {
      config.directionGuide = {
        keywords: [...currentKeywords, ...keywords],
      };
    }

    onExtend(config);
    onClose();
    // Reset state
    setAdditionalRounds(2);
    setShowAdvanced(false);
    setDiscussionMode('keep');
    setDiscussionDepth('keep');
    setKeywords([]);
    setKeywordInput('');
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const currentModePreset = DISCUSSION_MODE_PRESETS.find((m) => m.id === currentMode);
  const currentDepthPreset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === currentDepth);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            議論を延長
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="text-sm text-gray-400">
            現在の議論を継続し、追加のラウンドを実行します。
          </div>

          {/* Current Status */}
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-500 mb-2">現在の状態</div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded">
                {currentRounds}ラウンド完了
              </span>
              <span className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded">
                {currentModePreset?.name || '自由議論'}
              </span>
              <span className="px-2 py-1 bg-green-900/50 text-green-300 rounded">
                深さ: {currentDepthPreset?.name || '標準'}
              </span>
            </div>
          </div>

          {/* Additional Rounds Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">追加ラウンド数</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="5"
                value={additionalRounds}
                onChange={(e) => setAdditionalRounds(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-lg font-semibold text-white w-16 text-center">
                +{additionalRounds}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              合計: {currentRounds + additionalRounds}ラウンド（現在{currentRounds} + 追加{additionalRounds}）
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            詳細設定（オプション）
          </button>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 pl-4 border-l-2 border-gray-700">
              {/* Discussion Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">議論モード</label>
                <select
                  value={discussionMode}
                  onChange={(e) => setDiscussionMode(e.target.value as DiscussionMode | 'keep')}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="keep">現在の設定を維持（{currentModePreset?.name}）</option>
                  {DISCUSSION_MODE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} - {preset.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discussion Depth */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">議論の深さ</label>
                <select
                  value={discussionDepth}
                  onChange={(e) =>
                    setDiscussionDepth(
                      e.target.value === 'keep' ? 'keep' : (Number(e.target.value) as DiscussionDepth)
                    )
                  }
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="keep">現在の設定を維持（{currentDepthPreset?.name}）</option>
                  {DISCUSSION_DEPTH_PRESETS.map((preset) => (
                    <option key={preset.level} value={preset.level}>
                      Lv.{preset.level} {preset.name} - {preset.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">追加キーワード</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    placeholder="キーワードを入力..."
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    disabled={!keywordInput.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
                {(currentKeywords.length > 0 || keywords.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {currentKeywords.map((keyword) => (
                      <span
                        key={`current-${keyword}`}
                        className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                    {keywords.map((keyword) => (
                      <span
                        key={`new-${keyword}`}
                        className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded flex items-center gap-1"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            延長開始
          </button>
        </div>
      </div>
    </div>
  );
}
