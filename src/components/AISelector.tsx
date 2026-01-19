'use client';

import { useState, useEffect } from 'react';
import { AIProviderType, ModelInfo, DiscussionParticipant, SupportAgentConfig, DEFAULT_PROVIDERS, ParticipantRole, isCustomRoleId, ROLE_PRESETS } from '@/types';
import { useAISelector, LATEST_MODEL_COUNT } from '@/hooks/useAISelector';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { ParticipantList, ProviderSection, SupportAgentSection } from './ai-selector';
import { RoleEditor } from './RoleEditor';
import sessionEvent from '@/lib/session-event';

interface AISelectorProps {
  participants: DiscussionParticipant[];
  onParticipantsChange: (participants: DiscussionParticipant[]) => void;
  availableModels: Record<AIProviderType, ModelInfo[]>;
  availability: Record<AIProviderType, boolean>;
  supportAgent: SupportAgentConfig | null;
  onSupportAgentChange: (config: SupportAgentConfig | null) => void;
  disabled?: boolean;
}

export function AISelector({
  participants,
  onParticipantsChange,
  availableModels,
  availability,
  supportAgent,
  onSupportAgentChange,
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

  // サポートエージェントを設定
  const handleSetSupportAgent = (provider: AIProviderType, modelId: string) => {
    const models = availableModels[provider] || [];
    const model = models.find((m) => m.id === modelId);
    if (model) {
      onSupportAgentChange({
        provider,
        modelId,
        tasks: supportAgent?.tasks || [
          { task: 'keywordExtraction', enabled: true },
          { task: 'relevanceScoring', enabled: true },
          { task: 'followupGeneration', enabled: true },
        ],
      });
    }
  };

  const {
    customRoles,
    addCustomRole,
    updateCustomRole,
    deleteCustomRole,
    duplicateCustomRole,
  } = useCustomRoles();

  // イベントバスからロールエディタを開く
  useEffect(() => {
    const handleOpenRoleEditor = () => setShowRoleEditor(true);
    sessionEvent.on('openRoleEditor', handleOpenRoleEditor);
    return () => sessionEvent.off('openRoleEditor', handleOpenRoleEditor);
  }, []);

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
    <div className="flex flex-col h-full">
      {/* 参加者セクション - 固定 */}
      <section className="shrink-0 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-300">参加者</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRoleEditor(true)}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              title="カスタムロールを管理"
            >
              ロール管理
            </button>
            <span className="text-xs text-gray-500">{participants.length}人</span>
          </div>
        </div>
        <ParticipantList
          participants={participants}
          customRoles={customRoles}
          disabled={disabled}
          onUpdateRole={handleUpdateRole}
          onRemove={removeParticipant}
          onReorder={onParticipantsChange}
        />
      </section>

      {/* モデル一覧セクション - スクロール */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="text-sm font-medium text-gray-300">モデル一覧</h3>
          <p className="text-xs text-gray-500">クリックで参加者に追加</p>
        </div>

        {/* モデル表示切替 */}
        <div className={`shrink-0 flex flex-wrap items-center gap-2 p-2 mb-2 bg-gray-700/50 rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
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

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
                supportAgentModelId={supportAgent?.modelId}
                supportAgentProvider={supportAgent?.provider}
                onToggleExpanded={() => toggleExpanded(provider.id)}
                onAddParticipant={(modelId, displayName, color) =>
                  addParticipant(provider.id, modelId, displayName, color)
                }
                onSetSupportAgent={(modelId) => handleSetSupportAgent(provider.id, modelId)}
                getParticipantCount={(modelId) => getParticipantCountForModel(provider.id, modelId)}
              />
            );
          })}
        </div>
      </section>

      {/* サポートエージェントセクション */}
      <SupportAgentSection
        supportAgent={supportAgent}
        availableModels={availableModels}
        disabled={disabled}
        onSupportAgentChange={onSupportAgentChange}
      />

      {/* ロール編集モーダル */}
      <RoleEditor
        isOpen={showRoleEditor}
        customRoles={customRoles}
        onAdd={addCustomRole}
        onUpdate={updateCustomRole}
        onDelete={deleteCustomRole}
        onDuplicate={duplicateCustomRole}
        onClose={() => setShowRoleEditor(false)}
      />
    </div>
  );
}
