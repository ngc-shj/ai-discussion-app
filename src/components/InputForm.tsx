'use client';

import { useState, FormEvent } from 'react';

interface InputFormProps {
  onSubmit: (topic: string) => void;
  disabled?: boolean;
}

export function InputForm({ onSubmit, disabled }: InputFormProps) {
  const [topic, setTopic] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !disabled) {
      onSubmit(topic.trim());
      setTopic('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 pb-4 md:p-4 md:pb-6 bg-gray-800 border-t border-gray-700">
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
