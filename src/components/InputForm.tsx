'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
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
import { AttachedTextChip } from './AttachedTextChip';

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
    focusAreaInput,
    avoidTopicInput,
    termKeywordInput,
    attachedTexts,
    setTopic,
    setIsModeExpanded,
    setKeywordInput,
    setFocusAreaInput,
    setAvoidTopicInput,
    setTermKeywordInput,
    handleSubmit,
    handleAddKeyword,
    handleRemoveKeyword,
    handleKeywordKeyDown,
    handleAddFocusArea,
    handleRemoveFocusArea,
    handleFocusAreaKeyDown,
    handleAddAvoidTopic,
    handleRemoveAvoidTopic,
    handleAvoidTopicKeyDown,
    handleAddTermKeyword,
    handleRemoveTermKeyword,
    handleTermKeywordKeyDown,
    handleRemoveAttachedText,
    handleFileAttach,
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!isAttachMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setIsAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAttachMenuOpen]);

  const currentModePreset = DISCUSSION_MODE_PRESETS.find((m) => m.id === discussionMode);
  const currentDepthPreset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === discussionDepth);

  // textareaの高さを自動調整
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // topicが変わるたびに高さを調整
  useEffect(() => {
    adjustTextareaHeight();
  }, [topic, adjustTextareaHeight]);

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
          <div className="mt-2 p-3 bg-gray-900 rounded-lg border border-gray-600">
          <DiscussionOptionsPanel
            disabled={disabled}
            onClose={() => setIsModeExpanded(false)}
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
            focusAreaInput={focusAreaInput}
            onFocusAreaInputChange={setFocusAreaInput}
            onAddFocusArea={handleAddFocusArea}
            onRemoveFocusArea={handleRemoveFocusArea}
            onFocusAreaKeyDown={handleFocusAreaKeyDown}
            avoidTopicInput={avoidTopicInput}
            onAvoidTopicInputChange={setAvoidTopicInput}
            onAddAvoidTopic={handleAddAvoidTopic}
            onRemoveAvoidTopic={handleRemoveAvoidTopic}
            onAvoidTopicKeyDown={handleAvoidTopicKeyDown}
            terminationConfig={terminationConfig}
            onTerminationConfigChange={onTerminationConfigChange}
            termKeywordInput={termKeywordInput}
            onTermKeywordInputChange={setTermKeywordInput}
            onAddTermKeyword={handleAddTermKeyword}
            onRemoveTermKeyword={handleRemoveTermKeyword}
            onTermKeywordKeyDown={handleTermKeywordKeyDown}
          />
          </div>
        )}
      </div>

      {/* 添付テキスト表示（複数対応） */}
      {attachedTexts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachedTexts.map((item) => (
            <AttachedTextChip
              key={item.id}
              text={item.text}
              source={item.source}
              fileName={item.fileName}
              onRemove={() => handleRemoveAttachedText(item.id)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 md:gap-3 items-end">
        {/* +ボタン（ファイル添付） */}
        <div ref={attachMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
            disabled={disabled}
            className="p-2 md:p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 hover:text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="ファイルを添付"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* ドロップダウンメニュー */}
          {isAttachMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 min-w-[160px] z-10">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setIsAttachMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                テキストファイルを添付
              </button>
            </div>
          )}

          {/* 非表示のファイル入力 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.xml,.yaml,.yml,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.sh,.sql,.csv,.log,.conf,.ini,.env"
            multiple
            onChange={handleFileAttach}
            className="hidden"
            aria-label="テキストファイルを選択"
          />
        </div>
        <textarea
          ref={textareaRef}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            // IME入力中（日本語変換中など）はsubmitしない
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!disabled && (topic.trim() || attachedTexts.length > 0)) {
                handleSubmit(e as unknown as React.FormEvent);
              }
            }
          }}
          placeholder={attachedTexts.length > 0 ? "追加のコメントを入力...（任意）" : "議論したいトピックを入力...（Shift+Enterで改行）"}
          disabled={disabled}
          rows={1}
          className="flex-1 px-3 py-2 md:px-4 md:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm md:text-base resize-none min-h-[42px] max-h-[200px] overflow-y-auto"
        />
        <button
          type="submit"
          disabled={disabled || (!topic.trim() && attachedTexts.length === 0)}
          className="px-4 py-2 md:px-6 md:py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base whitespace-nowrap self-end"
        >
          議論開始
        </button>
      </div>
    </form>
  );
}
