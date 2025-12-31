'use client';

import { useState } from 'react';
import { AIProviderType, ModelInfo, DiscussionParticipant, DEFAULT_PROVIDERS, getOllamaModelColor } from '@/types';

// 最新モデルの数（各プロバイダーごと）
const LATEST_MODEL_COUNT = 5;

interface AISelectorProps {
  participants: DiscussionParticipant[];
  onParticipantsChange: (participants: DiscussionParticipant[]) => void;
  availableModels: Record<AIProviderType, ModelInfo[]>;
  availability: Record<AIProviderType, boolean>;
  disabled?: boolean;
}

export function AISelector({
  participants,
  onParticipantsChange,
  availableModels,
  availability,
  disabled,
}: AISelectorProps) {
  const [expandedProviders, setExpandedProviders] = useState<Record<AIProviderType, boolean>>({
    claude: true,
    ollama: true,
    openai: true,
    gemini: true,
  });
  const [showAllModels, setShowAllModels] = useState(false);

  const toggleExpanded = (providerId: AIProviderType) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const toggleParticipant = (provider: AIProviderType, model: string, displayName: string, color: string) => {
    const existingIndex = participants.findIndex(
      (p) => p.provider === provider && p.model === model
    );

    if (existingIndex >= 0) {
      onParticipantsChange(participants.filter((_, i) => i !== existingIndex));
    } else {
      onParticipantsChange([...participants, { provider, model, displayName, color }]);
    }
  };

  const isParticipantSelected = (provider: AIProviderType, model: string) => {
    return participants.some((p) => p.provider === provider && p.model === model);
  };

  const getFilteredModels = (models: ModelInfo[]) => {
    if (showAllModels) return models;
    return models.slice(0, LATEST_MODEL_COUNT);
  };

  const getSelectedCountForProvider = (providerId: AIProviderType) => {
    return participants.filter((p) => p.provider === providerId).length;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">参加AI</label>
        <span className="text-xs text-gray-500">{participants.length}個選択中</span>
      </div>

      {/* モデル表示切替 */}
      <div className="flex items-center gap-3 p-2 bg-gray-700/50 rounded-lg">
        <span className="text-xs text-gray-400">表示:</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="modelFilter"
            checked={!showAllModels}
            onChange={() => setShowAllModels(false)}
            className="w-3 h-3 text-blue-500 bg-gray-700 border-gray-600"
          />
          <span className="text-xs text-gray-300">最新{LATEST_MODEL_COUNT}件</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="modelFilter"
            checked={showAllModels}
            onChange={() => setShowAllModels(true)}
            className="w-3 h-3 text-blue-500 bg-gray-700 border-gray-600"
          />
          <span className="text-xs text-gray-300">すべて</span>
        </label>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {DEFAULT_PROVIDERS.map((provider) => {
          const isAvailable = availability[provider.id];
          const allModels = availableModels[provider.id] || [];
          const models = getFilteredModels(allModels);
          const isOllama = provider.id === 'ollama';
          const isExpanded = expandedProviders[provider.id];
          const selectedCount = getSelectedCountForProvider(provider.id);

          return (
            <div
              key={provider.id}
              className={`rounded-lg bg-gray-800 overflow-hidden ${
                !isAvailable ? 'opacity-50' : ''
              }`}
            >
              {/* プロバイダーヘッダー（クリックで折りたたみ） */}
              <button
                type="button"
                onClick={() => isAvailable && toggleExpanded(provider.id)}
                disabled={!isAvailable}
                className={`w-full flex items-center gap-2 p-3 ${
                  isAvailable ? 'hover:bg-gray-700/50 cursor-pointer' : 'cursor-not-allowed'
                } transition-colors`}
              >
                {/* 折りたたみ矢印 */}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: provider.color }}
                >
                  {provider.name.charAt(0)}
                </div>
                <span className="text-gray-200 font-medium">{provider.name}</span>
                {selectedCount > 0 && (
                  <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                    {selectedCount}
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-500">
                  {allModels.length}モデル
                </span>
                {!isAvailable && (
                  <span className="text-xs text-red-400">利用不可</span>
                )}
                {isOllama && isAvailable && (
                  <span className="text-xs text-gray-500">複数選択可</span>
                )}
              </button>

              {/* モデル一覧（折りたたみ可能） */}
              {isAvailable && isExpanded && (
                <div className="px-3 pb-3 space-y-1 ml-6">
                  {models.length > 0 ? (
                    <>
                      {models.map((model) => {
                        const modelColor = isOllama ? getOllamaModelColor(model.id) : provider.color;
                        const displayName = isOllama ? `Ollama (${model.name})` : `${provider.name} (${model.name})`;
                        const isSelected = isParticipantSelected(provider.id, model.id);

                        return (
                          <label
                            key={model.id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                              disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-700'
                            } ${isSelected ? 'bg-gray-700' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleParticipant(provider.id, model.id, displayName, modelColor)}
                              disabled={disabled}
                              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                            />
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: modelColor }}
                            />
                            <span className="text-sm text-gray-300 truncate" title={model.name}>
                              {model.name}
                            </span>
                          </label>
                        );
                      })}
                      {!showAllModels && allModels.length > LATEST_MODEL_COUNT && (
                        <div className="text-xs text-gray-500 pl-2 pt-1">
                          他 {allModels.length - LATEST_MODEL_COUNT} モデル（「すべて」で表示）
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-gray-400 flex items-center gap-2 p-2">
                      <div className="animate-spin w-3 h-3 border-2 border-gray-500 border-t-gray-300 rounded-full" />
                      モデル一覧を取得中...
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
