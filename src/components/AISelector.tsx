'use client';

import { useState } from 'react';
import { AIProviderType, ModelInfo, DiscussionParticipant, DEFAULT_PROVIDERS, getOllamaModelColor, ROLE_PRESETS, ParticipantRole, generateParticipantId } from '@/types';

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

  // 参加者を追加（同一モデルでも複数追加可能）
  const addParticipant = (provider: AIProviderType, model: string, displayName: string, color: string, role: ParticipantRole = 'neutral') => {
    const newParticipant: DiscussionParticipant = {
      id: generateParticipantId(),
      provider,
      model,
      displayName,
      color,
      role,
    };
    onParticipantsChange([...participants, newParticipant]);
  };

  // 参加者を削除（IDで識別）
  const removeParticipant = (id: string) => {
    onParticipantsChange(participants.filter((p) => p.id !== id));
  };

  // 参加者の役割を更新（IDで識別）
  const updateParticipantRole = (id: string, role: ParticipantRole) => {
    onParticipantsChange(
      participants.map((p) =>
        p.id === id ? { ...p, role } : p
      )
    );
  };

  // 特定モデルの参加者数を取得
  const getParticipantCountForModel = (provider: AIProviderType, model: string) => {
    return participants.filter((p) => p.provider === provider && p.model === model).length;
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
        <span className="text-xs text-gray-500">{participants.length}人参加</span>
      </div>

      {/* 選択された参加者一覧 */}
      {participants.length > 0 && (
        <div className="space-y-1 p-2 bg-gray-700/30 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">参加者一覧</div>
          {participants.map((participant, index) => {
            const rolePreset = ROLE_PRESETS.find((r) => r.id === participant.role);
            return (
              <div
                key={participant.id}
                className="flex items-center gap-2 p-1.5 bg-gray-800 rounded text-sm"
              >
                <span className="text-gray-500 text-xs w-4">{index + 1}.</span>
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: participant.color }}
                />
                <span className="text-gray-300 truncate flex-1" title={participant.displayName}>
                  {participant.displayName}
                </span>
                {/* 役割選択 */}
                <select
                  value={participant.role || 'neutral'}
                  onChange={(e) => updateParticipantRole(participant.id, e.target.value as ParticipantRole)}
                  disabled={disabled}
                  title={rolePreset?.description || '役割を選択'}
                  className="px-1.5 py-0.5 text-xs bg-gray-600 text-gray-200 rounded border-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  {ROLE_PRESETS.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                {/* 削除ボタン */}
                <button
                  type="button"
                  onClick={() => removeParticipant(participant.id)}
                  disabled={disabled}
                  className="p-0.5 text-gray-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="削除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

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

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
              </button>

              {/* モデル一覧（折りたたみ可能） */}
              {isAvailable && isExpanded && (
                <div className="px-3 pb-3 space-y-1 ml-6">
                  {models.length > 0 ? (
                    <>
                      {models.map((model) => {
                        const modelColor = isOllama ? getOllamaModelColor(model.id) : provider.color;
                        const displayName = isOllama ? `Ollama (${model.name})` : `${provider.name} (${model.name})`;
                        const count = getParticipantCountForModel(provider.id, model.id);

                        return (
                          <div
                            key={model.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-700/50 transition-colors"
                          >
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: modelColor }}
                            />
                            <span className="text-sm text-gray-300 truncate flex-1" title={model.name}>
                              {model.name}
                            </span>
                            {count > 0 && (
                              <span className="text-xs text-blue-400">×{count}</span>
                            )}
                            {/* 追加ボタン */}
                            <button
                              type="button"
                              onClick={() => addParticipant(provider.id, model.id, displayName, modelColor)}
                              disabled={disabled}
                              className="p-1 text-gray-400 hover:text-green-400 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title="参加者として追加"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
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

      <p className="text-xs text-gray-500">
        同じモデルを異なる役割で複数追加できます
      </p>
    </div>
  );
}
