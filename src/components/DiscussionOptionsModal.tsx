'use client';

import { useEffect, useRef } from 'react';
import {
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  SearchConfig,
} from '@/types';
import { DiscussionOptionsPanel } from './DiscussionOptionsPanel';

interface DiscussionOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  // Direction Guide
  directionGuide: DirectionGuide;
  // Termination
  terminationConfig: TerminationConfig;
  onTerminationConfigChange: (config: TerminationConfig) => void;
  // Keyword inputs
  keywordInput: string;
  onKeywordInputChange: (input: string) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (keyword: string) => void;
  onKeywordKeyDown: (e: React.KeyboardEvent) => void;
  // Focus area inputs
  focusAreaInput: string;
  onFocusAreaInputChange: (input: string) => void;
  onAddFocusArea: () => void;
  onRemoveFocusArea: (area: string) => void;
  onFocusAreaKeyDown: (e: React.KeyboardEvent) => void;
  // Avoid topic inputs
  avoidTopicInput: string;
  onAvoidTopicInputChange: (input: string) => void;
  onAddAvoidTopic: () => void;
  onRemoveAvoidTopic: (topic: string) => void;
  onAvoidTopicKeyDown: (e: React.KeyboardEvent) => void;
  // Term keyword inputs
  termKeywordInput: string;
  onTermKeywordInputChange: (input: string) => void;
  onAddTermKeyword: () => void;
  onRemoveTermKeyword: (keyword: string) => void;
  onTermKeywordKeyDown: (e: React.KeyboardEvent) => void;
}

export function DiscussionOptionsModal({
  isOpen,
  onClose,
  disabled,
  searchConfig,
  onSearchConfigChange,
  discussionMode,
  onDiscussionModeChange,
  discussionDepth,
  onDiscussionDepthChange,
  directionGuide,
  terminationConfig,
  onTerminationConfigChange,
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
  termKeywordInput,
  onTermKeywordInputChange,
  onAddTermKeyword,
  onRemoveTermKeyword,
  onTermKeywordKeyDown,
}: DiscussionOptionsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Escキーで閉じる
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

  // モーダル外クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // フォーカストラップ
  useEffect(() => {
    if (!isOpen) return;
    const previousActiveElement = document.activeElement as HTMLElement;
    modalRef.current?.focus();
    return () => {
      previousActiveElement?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/60" />

      {/* モーダル */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discussion-options-title"
        tabIndex={-1}
        className="relative w-full max-w-2xl h-[90vh] max-h-[800px] mx-4 bg-gray-800 rounded-lg shadow-xl border border-gray-700 flex flex-col"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="discussion-options-title" className="text-lg font-semibold text-white">
            議論設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
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
            terminationConfig={terminationConfig}
            onTerminationConfigChange={onTerminationConfigChange}
            termKeywordInput={termKeywordInput}
            onTermKeywordInputChange={onTermKeywordInputChange}
            onAddTermKeyword={onAddTermKeyword}
            onRemoveTermKeyword={onRemoveTermKeyword}
            onTermKeywordKeyDown={onTermKeywordKeyDown}
          />
        </div>

        {/* フッター */}
        <div className="flex justify-end p-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
}
