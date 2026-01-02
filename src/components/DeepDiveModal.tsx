'use client';

import { useState } from 'react';
import { DeepDiveType, DEEP_DIVE_PRESETS } from '@/types';

interface DeepDiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDeepDive: (type: DeepDiveType, customPrompt?: string) => void;
  topic: string;
}

export function DeepDiveModal({ isOpen, onClose, onStartDeepDive, topic }: DeepDiveModalProps) {
  const [selectedType, setSelectedType] = useState<DeepDiveType>('technical');
  const [customPrompt, setCustomPrompt] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (selectedType === 'custom' && !customPrompt.trim()) {
      return;
    }
    onStartDeepDive(selectedType, selectedType === 'custom' ? customPrompt : undefined);
    onClose();
    setCustomPrompt('');
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
            </svg>
            深掘りモード
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
            議論を特定の観点から深掘りします
          </div>

          {/* Topic Preview */}
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-500 mb-1">現在のトピック</div>
            <div className="text-sm text-gray-300 line-clamp-2">{topic}</div>
          </div>

          {/* Preset Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">深掘りの観点</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEEP_DIVE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedType(preset.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedType === preset.id
                      ? 'bg-purple-900/50 border-purple-500 text-white'
                      : 'bg-gray-900/30 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{preset.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt Input */}
          {selectedType === 'custom' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">カスタムプロンプト</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例: セキュリティの観点から詳しく分析してください"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
              />
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
            disabled={selectedType === 'custom' && !customPrompt.trim()}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
            </svg>
            深掘り開始
          </button>
        </div>
      </div>
    </div>
  );
}
