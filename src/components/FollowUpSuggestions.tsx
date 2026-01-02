'use client';

import { FollowUpQuestion, FOLLOW_UP_CATEGORY_LABELS, FollowUpCategory } from '@/types';

interface FollowUpSuggestionsProps {
  questions: FollowUpQuestion[];
  onSelect: (question: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const categoryColors: Record<FollowUpCategory, string> = {
  clarification: 'bg-blue-600',
  expansion: 'bg-green-600',
  example: 'bg-yellow-600',
  alternative: 'bg-purple-600',
};

export function FollowUpSuggestions({
  questions,
  onSelect,
  disabled,
  isLoading,
}: FollowUpSuggestionsProps) {
  if (isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-gray-400">
        <div className="animate-spin w-4 h-4 border-2 border-gray-500 border-t-purple-400 rounded-full" />
        <span className="text-sm">フォローアップ質問を生成中...</span>
      </div>
    );
  }

  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm text-gray-400 flex items-center gap-1.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        この質問で議論を続ける:
      </p>
      <div className="grid gap-2">
        {questions.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelect(q.question)}
            disabled={disabled}
            className="flex items-start gap-2 p-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600 hover:border-purple-500 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <span className={`px-2 py-0.5 text-xs rounded ${categoryColors[q.category]} text-white shrink-0 mt-0.5`}>
              {FOLLOW_UP_CATEGORY_LABELS[q.category]}
            </span>
            <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
              {q.question}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
