'use client';

import { AIProviderType, ModelInfo, DiscussionParticipant, SearchConfig } from '@/types';
import { AISelector } from './AISelector';

interface SettingsPanelProps {
  participants: DiscussionParticipant[];
  onParticipantsChange: (participants: DiscussionParticipant[]) => void;
  availableModels: Record<AIProviderType, ModelInfo[]>;
  availability: Record<AIProviderType, boolean>;
  rounds: number;
  onRoundsChange: (rounds: number) => void;
  searchConfig: SearchConfig;
  onSearchConfigChange: (config: SearchConfig) => void;
  disabled?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function SettingsPanel({
  participants,
  onParticipantsChange,
  availableModels,
  availability,
  rounds,
  onRoundsChange,
  searchConfig,
  onSearchConfigChange,
  disabled,
  isOpen = true,
  onClose,
}: SettingsPanelProps) {
  // オーバーレイモードで閉じている場合は何も描画しない
  if (onClose && !isOpen) {
    return null;
  }

  return (
    <>
      {/* モバイル用オーバーレイ背景 */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`
          ${onClose ? 'fixed right-0 z-50' : 'relative'}
          w-80 max-w-[85vw] bg-gray-800 p-4 border-l border-gray-700 flex flex-col h-full
        `}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">設定</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1 text-gray-400 hover:text-white rounded"
              aria-label="設定を閉じる"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          <AISelector
            participants={participants}
            onParticipantsChange={onParticipantsChange}
            availableModels={availableModels}
            availability={availability}
            disabled={disabled}
          />

          <div className="space-y-2">
            <label htmlFor="rounds-slider" className="text-sm font-medium text-gray-300">
              ラウンド数: {rounds}
            </label>
            <input
              id="rounds-slider"
              type="range"
              min="1"
              max="5"
              value={rounds}
              onChange={(e) => onRoundsChange(Number(e.target.value))}
              disabled={disabled}
              title="ラウンド数を選択"
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>5</span>
            </div>
          </div>

          {/* 検索設定 */}
          <div className="space-y-3 pt-3 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <label htmlFor="search-toggle" className="text-sm font-medium text-gray-300">
                Web検索を使用
              </label>
              <button
                id="search-toggle"
                type="button"
                onClick={() => onSearchConfigChange({ ...searchConfig, enabled: !searchConfig.enabled })}
                disabled={disabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  searchConfig.enabled ? 'bg-blue-600' : 'bg-gray-600'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                aria-label="Web検索を切り替え"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    searchConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {searchConfig.enabled && (
              <>
                <div className="space-y-2">
                  <label htmlFor="search-type" className="text-xs text-gray-400">
                    検索タイプ
                  </label>
                  <select
                    id="search-type"
                    value={searchConfig.searchType}
                    onChange={(e) => onSearchConfigChange({
                      ...searchConfig,
                      searchType: e.target.value as 'web' | 'news' | 'images'
                    })}
                    disabled={disabled}
                    className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  >
                    <option value="web">Web検索</option>
                    <option value="news">ニュース検索</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="max-results" className="text-xs text-gray-400">
                    検索結果数: {searchConfig.maxResults}
                  </label>
                  <input
                    id="max-results"
                    type="range"
                    min="3"
                    max="10"
                    value={searchConfig.maxResults}
                    onChange={(e) => onSearchConfigChange({
                      ...searchConfig,
                      maxResults: Number(e.target.value)
                    })}
                    disabled={disabled}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>3</span>
                    <span>10</span>
                  </div>
                </div>
              </>
            )}

            <p className="text-xs text-gray-500">
              {searchConfig.enabled
                ? 'トピックに関連する最新情報を検索し、議論に活用します'
                : '検索を有効にすると、最新の情報をもとに議論できます'}
            </p>
          </div>

          <div className="text-sm text-gray-400 pt-2 border-t border-gray-700">
            <p className="mb-2">
              <strong>ラウンドロビン形式</strong>
            </p>
            <p className="text-xs">
              各AIが順番に発言し、前のAIの意見を踏まえて議論を深めます。
              最後に全ての意見を統合した回答が生成されます。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
