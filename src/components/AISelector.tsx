'use client';

import { useState } from 'react';
import { AIProviderType, ModelInfo, DiscussionParticipant, DEFAULT_PROVIDERS, ParticipantRole, isCustomRoleId, ROLE_PRESETS } from '@/types';
import { useAISelector, LATEST_MODEL_COUNT } from '@/hooks/useAISelector';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { ParticipantList, ProviderSection } from './ai-selector';
import { RoleEditor } from './RoleEditor';

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
  const [showRoleEditor, setShowRoleEditor] = useState(false);

  const {
    expandedProviders,
    modelFilter,
    showAllLocalSizes,
    toggleExpanded,
    setModelFilter,
    setShowAllLocalSizes,
    addParticipant,
    removeParticipant,
    getParticipantCountForModel,
    getFilteredModels,
    getSelectedCountForProvider,
  } = useAISelector({ participants, onParticipantsChange });

  const {
    customRoles,
    addCustomRole,
    updateCustomRole,
    deleteCustomRole,
    duplicateCustomRole,
  } = useCustomRoles();

  // ロール更新時にロール情報を設定
  const handleUpdateRole = (id: string, role: ParticipantRole) => {
    if (isCustomRoleId(role)) {
      const customRole = customRoles.find((r) => r.id === role);
      if (customRole) {
        // カスタムロールの場合
        const updated = participants.map((p) =>
          p.id === id
            ? { ...p, role, displayRoleName: customRole.name, customRolePrompt: customRole.prompt }
            : p
        );
        onParticipantsChange(updated);
        return;
      }
    }
    // プリセットロールの場合
    const preset = ROLE_PRESETS.find((r) => r.id === role);
    const updated = participants.map((p) =>
      p.id === id
        ? { ...p, role, displayRoleName: preset?.name, customRolePrompt: undefined }
        : p
    );
    onParticipantsChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">参加AI</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRoleEditor(true)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            title="カスタムロールを管理"
          >
            ロール管理
          </button>
          <span className="text-xs text-gray-500">{participants.length}人参加</span>
        </div>
      </div>

      {/* 選択された参加者一覧 */}
      <ParticipantList
        participants={participants}
        customRoles={customRoles}
        disabled={disabled}
        onUpdateRole={handleUpdateRole}
        onRemove={removeParticipant}
        onReorder={onParticipantsChange}
      />

      {/* モデル表示切替 */}
      <div className={`flex flex-wrap items-center gap-2 p-2 bg-gray-700/50 rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <span className="text-xs text-gray-400">表示:</span>
        <label className={`flex items-center gap-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="radio"
            name="modelFilter"
            checked={modelFilter === 'latest-generation'}
            onChange={() => setModelFilter('latest-generation')}
            disabled={disabled}
            className="w-3 h-3 text-blue-500 bg-gray-700 border-gray-600"
          />
          <span className="text-xs text-gray-300">最新世代</span>
        </label>
        <label className={`flex items-center gap-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="radio"
            name="modelFilter"
            checked={modelFilter === 'latest-5'}
            onChange={() => setModelFilter('latest-5')}
            disabled={disabled}
            className="w-3 h-3 text-blue-500 bg-gray-700 border-gray-600"
          />
          <span className="text-xs text-gray-300">最新{LATEST_MODEL_COUNT}件</span>
        </label>
        <label className={`flex items-center gap-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="radio"
            name="modelFilter"
            checked={modelFilter === 'all'}
            onChange={() => setModelFilter('all')}
            disabled={disabled}
            className="w-3 h-3 text-blue-500 bg-gray-700 border-gray-600"
          />
          <span className="text-xs text-gray-300">すべて</span>
        </label>
        <span className="text-gray-600">|</span>
        <label
          className={`flex items-center gap-1 ${disabled ? 'cursor-not-allowed opacity-50' : modelFilter === 'latest-generation' ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
          title={modelFilter === 'latest-generation' ? 'ローカルモデルの全サイズを表示' : '「最新世代」選択時のみ有効'}
        >
          <input
            type="checkbox"
            checked={showAllLocalSizes}
            onChange={(e) => setShowAllLocalSizes(e.target.checked)}
            disabled={disabled || modelFilter !== 'latest-generation'}
            className="w-3 h-3 text-blue-500 bg-gray-700 border-gray-600 rounded disabled:opacity-50"
          />
          <span className="text-xs text-gray-300">ローカル全サイズ</span>
        </label>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {DEFAULT_PROVIDERS.map((provider) => {
          const isAvailable = availability[provider.id];
          const allModels = availableModels[provider.id] || [];
          const filteredModels = getFilteredModels(allModels, provider.id);

          return (
            <ProviderSection
              key={provider.id}
              provider={provider}
              isAvailable={isAvailable}
              isExpanded={expandedProviders[provider.id]}
              allModels={allModels}
              filteredModels={filteredModels}
              selectedCount={getSelectedCountForProvider(provider.id)}
              modelFilter={modelFilter}
              disabled={disabled}
              onToggleExpanded={() => toggleExpanded(provider.id)}
              onAddParticipant={(modelId, displayName, color) =>
                addParticipant(provider.id, modelId, displayName, color)
              }
              getParticipantCount={(modelId) => getParticipantCountForModel(provider.id, modelId)}
            />
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        同じモデルを異なる役割で複数追加できます
      </p>

      {/* ロール編集モーダル */}
      {showRoleEditor && (
        <RoleEditor
          customRoles={customRoles}
          onAdd={addCustomRole}
          onUpdate={updateCustomRole}
          onDelete={deleteCustomRole}
          onDuplicate={duplicateCustomRole}
          onClose={() => setShowRoleEditor(false)}
        />
      )}
    </div>
  );
}
