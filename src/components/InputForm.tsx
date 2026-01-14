'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import {
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  SearchConfig,
} from '@/types';
import { useInputForm } from '@/hooks/useInputForm';
import { DiscussionOptionsModal } from './DiscussionOptionsModal';
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
    keywordInput,
    focusAreaInput,
    avoidTopicInput,
    termKeywordInput,
    attachedTexts,
    setTopic,
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
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);

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

  // 設定がカスタマイズされているかどうか
  const hasCustomSettings =
    searchConfig.enabled ||
    discussionMode !== 'free' ||
    discussionDepth !== 3 ||
    directionGuide.keywords.length > 0 ||
    directionGuide.focusAreas?.length ||
    directionGuide.avoidTopics?.length ||
    terminationConfig.condition !== 'rounds';

  return (
    <form onSubmit={handleSubmit} className="p-3 pb-4 md:p-4 md:pb-6 bg-gray-800 border-t border-gray-700">
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
        {/* +ボタン（メニュー） */}
        <div ref={attachMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
            disabled={disabled}
            className={`p-2 md:p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 hover:text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative ${
              hasCustomSettings ? 'border-green-500/50' : ''
            }`}
            title="メニュー"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {/* 設定変更バッジ */}
            {hasCustomSettings && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full" />
            )}
          </button>

          {/* ドロップダウンメニュー */}
          {isAttachMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 min-w-[180px] z-10">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setIsAttachMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white flex items-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="whitespace-nowrap">テキストファイルを追加</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOptionsModalOpen(true);
                  setIsAttachMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white flex items-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="whitespace-nowrap">議論設定</span>
                {hasCustomSettings && (
                  <span className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
                )}
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

      {/* 議論設定モーダル */}
      <DiscussionOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        disabled={disabled}
        searchConfig={searchConfig}
        onSearchConfigChange={onSearchConfigChange}
        discussionMode={discussionMode}
        onDiscussionModeChange={onDiscussionModeChange}
        discussionDepth={discussionDepth}
        onDiscussionDepthChange={onDiscussionDepthChange}
        directionGuide={directionGuide}
        terminationConfig={terminationConfig}
        onTerminationConfigChange={onTerminationConfigChange}
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
        termKeywordInput={termKeywordInput}
        onTermKeywordInputChange={setTermKeywordInput}
        onAddTermKeyword={handleAddTermKeyword}
        onRemoveTermKeyword={handleRemoveTermKeyword}
        onTermKeywordKeyDown={handleTermKeywordKeyDown}
      />
    </form>
  );
}
