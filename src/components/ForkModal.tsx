'use client';

import { useState } from 'react';
import { FORK_PRESETS, ForkPreset } from '@/types';

interface ForkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFork: (label: string, perspective: string) => void;
  topic: string;
}

export function ForkModal({ isOpen, onClose, onCreateFork, topic }: ForkModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<ForkPreset | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customPerspective, setCustomPerspective] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (isCustomMode) {
      if (!customLabel.trim() || !customPerspective.trim()) return;
      onCreateFork(customLabel, customPerspective);
    } else {
      if (!selectedPreset) return;
      onCreateFork(selectedPreset.name, selectedPreset.prompt);
    }
    onClose();
    setSelectedPreset(null);
    setCustomLabel('');
    setCustomPerspective('');
    setIsCustomMode(false);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const canSubmit = isCustomMode
    ? customLabel.trim() && customPerspective.trim()
    : selectedPreset !== null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            議論を分岐
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
            このターンから別の視点で議論を分岐させます
          </div>

          {/* Topic Preview */}
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-500 mb-1">分岐元のトピック</div>
            <div className="text-sm text-gray-300 line-clamp-2">{topic}</div>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsCustomMode(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                !isCustomMode
                  ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-500'
                  : 'bg-gray-900/30 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              プリセットから選択
            </button>
            <button
              onClick={() => setIsCustomMode(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                isCustomMode
                  ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-500'
                  : 'bg-gray-900/30 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              カスタム視点
            </button>
          </div>

          {!isCustomMode ? (
            /* Preset Selection */
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">視点を選択</label>
              <div className="grid grid-cols-1 gap-2">
                {FORK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedPreset?.id === preset.id
                        ? 'bg-cyan-900/50 border-cyan-500 text-white'
                        : 'bg-gray-900/30 border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Custom Input */
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">分岐ラベル</label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="例: セキュリティ観点"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">視点の説明</label>
                <textarea
                  value={customPerspective}
                  onChange={(e) => setCustomPerspective(e.target.value)}
                  placeholder="例: セキュリティの脆弱性やリスクの観点から議論してください"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  rows={3}
                />
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
            disabled={!canSubmit}
            className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            分岐を作成
          </button>
        </div>
      </div>
    </div>
  );
}
