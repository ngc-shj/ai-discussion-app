'use client';

import { useState, useEffect, FormEvent } from 'react';
import { DiscussionMode, DISCUSSION_MODE_PRESETS } from '@/types';

interface InputFormProps {
  onSubmit: (topic: string) => void;
  disabled?: boolean;
  presetTopic?: string;
  onPresetTopicClear?: () => void;
  discussionMode: DiscussionMode;
  onDiscussionModeChange: (mode: DiscussionMode) => void;
}

export function InputForm({
  onSubmit,
  disabled,
  presetTopic,
  onPresetTopicClear,
  discussionMode,
  onDiscussionModeChange,
}: InputFormProps) {
  const [topic, setTopic] = useState('');
  const [isModeExpanded, setIsModeExpanded] = useState(false);

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

  return (
    <form onSubmit={handleSubmit} className="p-3 pb-4 md:p-4 md:pb-6 bg-gray-800 border-t border-gray-700">
      {/* 議論モードセレクター（折りたたみ式） */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setIsModeExpanded(!isModeExpanded)}
          disabled={disabled}
          className={`flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
            議論モード: <span className="text-blue-400">{currentModePreset?.name || '自由議論'}</span>
          </span>
        </button>

        {/* 展開時のモード選択 */}
        {isModeExpanded && (
          <div className="mt-2 p-3 bg-gray-700/50 rounded-lg">
            <div className="flex flex-wrap gap-2">
              {DISCUSSION_MODE_PRESETS.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    onDiscussionModeChange(mode.id);
                    setIsModeExpanded(false);
                  }}
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
            <p className="mt-2 text-xs text-gray-500">
              {currentModePreset?.description || ''}
            </p>
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
