'use client';

import { useState, useEffect } from 'react';
import { FORK_PRESETS, ForkPreset, formatTopicForDisplay, LOG_TOPIC_MAX_LENGTH } from '@/types';

interface ForkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFork: (label: string, perspective: string) => void;
  topic: string;
}

export function ForkModal({ isOpen, onClose, onCreateFork, topic }: ForkModalProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customPerspective, setCustomPerspective] = useState('');

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

  // モーダルを閉じたときに状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setSelectedPresetId(null);
      setIsCustomExpanded(false);
      setCustomLabel('');
      setCustomPerspective('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePresetSubmit = (preset: ForkPreset) => {
    onCreateFork(preset.name, preset.prompt);
    onClose();
  };

  const handleCustomSubmit = () => {
    if (!customLabel.trim() || !customPerspective.trim()) return;
    onCreateFork(customLabel.trim(), customPerspective.trim());
    onClose();
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
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              議論を分岐
            </h2>
            <p className="text-xs text-gray-400 mt-1 ml-7">別の視点から議論を展開</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topic Preview */}
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-500 mb-1">分岐元のトピック</div>
              <div className="text-sm text-gray-300 line-clamp-2">{formatTopicForDisplay(topic, LOG_TOPIC_MAX_LENGTH)}</div>
            </div>
          </div>

          {/* カスタム視点アコーディオン */}
          <div className="px-4 pt-2 pb-2 shrink-0">
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                className="w-full flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isCustomExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-medium text-white">カスタム視点</span>
                </div>
                <span className="text-xs text-gray-500">独自の視点を入力</span>
              </button>

              {isCustomExpanded && (
                <div className="p-3 border-t border-gray-700 space-y-3 bg-gray-900/30">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">分岐ラベル</label>
                    <input
                      type="text"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="例: セキュリティ観点"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">視点の説明</label>
                    <textarea
                      value={customPerspective}
                      onChange={(e) => setCustomPerspective(e.target.value)}
                      placeholder="例: セキュリティの脆弱性やリスクの観点から議論してください"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomExpanded(false);
                        setCustomLabel('');
                        setCustomPerspective('');
                      }}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleCustomSubmit}
                      disabled={!customLabel.trim() || !customPerspective.trim()}
                      className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      分岐を作成
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* プリセットラベル */}
          <div className="px-4 pt-2 pb-1 shrink-0">
            <div className="text-xs text-gray-500 flex items-center justify-between">
              <span>プリセット視点</span>
              <span>{FORK_PRESETS.length}件</span>
            </div>
          </div>

          {/* プリセット一覧（スクロール領域） */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              {FORK_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className={`group relative p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedPresetId === preset.id
                      ? 'bg-cyan-900/30 border-cyan-500'
                      : 'bg-gray-900/30 border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedPresetId(selectedPresetId === preset.id ? null : preset.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{preset.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{preset.description}</div>

                      {/* 選択時に詳細表示 */}
                      {selectedPresetId === preset.id && (
                        <div className="mt-2 pt-2 border-t border-cyan-500/30 space-y-2">
                          <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
                            {preset.prompt}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePresetSubmit(preset);
                              }}
                              className="flex-1 px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors flex items-center justify-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              この視点で分岐
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expand indicator (when not selected) */}
                    {selectedPresetId !== preset.id && (
                      <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
