'use client';

import { useState, useEffect, useRef } from 'react';
import { AIProviderType, ModelInfo, DiscussionParticipant, SupportAgentConfig, DEFAULT_PROVIDERS, ParticipantRole, isCustomRoleId, ROLE_PRESETS, getLocalModelColor } from '@/types';
import { useAISelector, LATEST_MODEL_COUNT } from '@/hooks/useAISelector';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { ParticipantList, SupportAgentSection } from './ai-selector';
import { RoleEditor } from './RoleEditor';
import sessionEvent from '@/lib/session-event';

// モデル選択の呼び出し元コンテキスト
type PickerContext = 'participant' | 'support' | null;

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
  // モデル選択の呼び出し元コンテキスト（null = 閉じている）
  const [pickerContext, setPickerContext] = useState<PickerContext>(null);
  // 選択中のプロバイダータブ
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('claude');
  // モデル検索クエリ
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  // サポートエージェントセクションの展開状態
  const [isSupportExpanded, setIsSupportExpanded] = useState(false);
  // サポートエージェント内のモデル選択の展開状態
  const [isSupportModelPickerExpanded, setIsSupportModelPickerExpanded] = useState(false);

  const {
    modelFilter,
    setModelFilter,
    addParticipant,
    removeParticipant,
    getParticipantCountForModel,
    getFilteredModels,
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

  // モデル選択セクション展開時に検索バーにフォーカス
  useEffect(() => {
    if (pickerContext && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [pickerContext]);

  // ロール更新時にロール情報を設定
  const handleUpdateRole = (id: string, role: ParticipantRole) => {
    if (isCustomRoleId(role)) {
      const customRole = customRoles.find((r) => r.id === role);
      if (customRole) {
        const updated = participants.map((p) =>
          p.id === id
            ? { ...p, role, displayRoleName: customRole.name, customRolePrompt: customRole.prompt }
            : p
        );
        onParticipantsChange(updated);
        return;
      }
    }
    const preset = ROLE_PRESETS.find((r) => r.id === role);
    const updated = participants.map((p) =>
      p.id === id
        ? { ...p, role, displayRoleName: preset?.name, customRolePrompt: undefined }
        : p
    );
    onParticipantsChange(updated);
  };

  // サポートエージェントのプレビュー文字列
  const getSupportAgentPreview = () => {
    if (!supportAgent) return '未設定';
    const models = availableModels[supportAgent.provider] || [];
    const model = models.find((m) => m.id === supportAgent.modelId);
    const enabledTasks = supportAgent.tasks.filter(t => t.enabled).length;
    return model ? `${model.name} (${enabledTasks}タスク)` : supportAgent.modelId;
  };

  // モデル選択のトグル（コンテキスト指定）
  const togglePicker = (context: PickerContext) => {
    if (pickerContext === context) {
      // 同じコンテキストなら閉じる
      setPickerContext(null);
      setSearchQuery('');
    } else {
      // 別のコンテキストなら切り替え
      setPickerContext(context);
      setSearchQuery('');
    }
  };

  // 利用可能なプロバイダーのみ取得
  const availableProviders = DEFAULT_PROVIDERS.filter(p => availability[p.id]);

  // 選択中のプロバイダーが利用不可の場合、最初の利用可能なプロバイダーに切り替え
  useEffect(() => {
    if (!availability[selectedProvider] && availableProviders.length > 0) {
      setSelectedProvider(availableProviders[0].id);
    }
  }, [availability, selectedProvider, availableProviders]);

  // 現在のプロバイダーのモデルをフィルタリング
  const currentProviderModels = availableModels[selectedProvider] || [];
  const filteredModels = getFilteredModels(currentProviderModels, selectedProvider);
  const searchFilteredModels = searchQuery
    ? filteredModels.filter((model) =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredModels;

  // 現在のプロバイダー情報
  const currentProvider = DEFAULT_PROVIDERS.find(p => p.id === selectedProvider);

  // モデル選択時の処理（コンテキストに応じて追加先を決定）
  const handleModelSelect = (modelId: string, displayName: string, modelColor: string) => {
    if (pickerContext === 'participant') {
      addParticipant(selectedProvider, modelId, displayName, modelColor);
    } else if (isSupportModelPickerExpanded) {
      // サポートエージェントのモデル選択が展開中ならサポートエージェントとして設定
      handleSetSupportAgent(selectedProvider, modelId);
    }
  };

  // ModelPickerInline コンポーネント（インライン展開）
  const renderModelPicker = (rounded: 'bottom' | 'all' = 'bottom') => (
    <div className={`bg-gray-800/50 overflow-hidden ${rounded === 'all' ? 'rounded-lg' : 'rounded-b-lg'}`}>
      {/* フィルター（タブの上部） */}
      <div className={`flex flex-wrap items-center gap-2 p-2 bg-gray-900/50 border-b border-gray-700 ${disabled ? 'opacity-50' : ''}`}>
        <span className="text-xs text-gray-400">表示:</span>
        {[
          { value: 'latest-generation', label: '最新世代' },
          { value: 'latest-5', label: `最新${LATEST_MODEL_COUNT}件` },
          { value: 'all', label: 'すべて' },
        ].map(({ value, label }) => {
          // Ollamaの場合は「すべて」固定
          const isOllama = selectedProvider === 'ollama';
          const isChecked = isOllama ? value === 'all' : modelFilter === value;
          const isDisabledOption = disabled || (isOllama && value !== 'all');
          return (
            <label key={value} className={`flex items-center gap-1 ${isDisabledOption ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="radio"
                name="modelFilter"
                checked={isChecked}
                onChange={() => !isOllama && setModelFilter(value as typeof modelFilter)}
                disabled={isDisabledOption}
                className="w-3 h-3 text-blue-500 bg-gray-700 border-gray-600"
              />
              <span className="text-xs text-gray-300">{label}</span>
            </label>
          );
        })}
      </div>

      {/* プロバイダータブ */}
      <div className="flex border-b border-gray-700">
        {DEFAULT_PROVIDERS.map((provider) => {
          const isAvailable = availability[provider.id];
          const isActive = selectedProvider === provider.id;
          const modelCount = (availableModels[provider.id] || []).length;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => isAvailable && setSelectedProvider(provider.id)}
              disabled={!isAvailable || disabled}
              className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-white border-b-2 border-blue-500 bg-gray-700/50'
                  : isAvailable
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
              title={isAvailable ? `${provider.name} (${modelCount}モデル)` : `${provider.name} - 利用不可`}
            >
              <span className="truncate">{provider.name}</span>
            </button>
          );
        })}
      </div>

      {/* 検索バー */}
      <div className="p-2 border-b border-gray-700">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="モデルを検索..."
            disabled={disabled}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-700 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              title="検索をクリア"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* モデルリスト */}
      <div className="max-h-48 overflow-y-auto">
        {searchFilteredModels.length > 0 ? (
          <div className="p-2 space-y-1">
            {searchFilteredModels.map((model) => {
              const modelColor = currentProvider?.isLocal ? getLocalModelColor(model.id) : currentProvider?.color || '#666';
              const displayName = model.name;
              const count = getParticipantCountForModel(selectedProvider, model.id);
              const isSupportAgent = supportAgent?.provider === selectedProvider && supportAgent?.modelId === model.id;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleModelSelect(model.id, displayName, modelColor)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-2 p-2 rounded hover:bg-gray-700/50 transition-colors text-left disabled:opacity-50 ${
                    isSupportAgent && isSupportModelPickerExpanded ? 'bg-green-900/30 ring-1 ring-green-500/50' : ''
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: modelColor }}
                  />
                  <span className="text-sm text-gray-300 truncate flex-1" title={model.name}>
                    {model.name}
                  </span>
                  {isSupportAgent && (
                    <span className="text-xs text-green-400 shrink-0">サポート</span>
                  )}
                  {count > 0 && (
                    <span className="text-xs text-blue-400 shrink-0">×{count}</span>
                  )}
                </button>
              );
            })}
            {searchQuery && searchFilteredModels.length < filteredModels.length && (
              <div className="text-xs text-gray-500 pl-2 pt-1">
                {searchFilteredModels.length}/{filteredModels.length} 件表示
              </div>
            )}
          </div>
        ) : searchQuery ? (
          <div className="p-4 text-center text-xs text-gray-400">
            「{searchQuery}」に一致するモデルがありません
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <div className="animate-spin w-3 h-3 border-2 border-gray-500 border-t-gray-300 rounded-full" />
            モデル一覧を取得中...
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col space-y-3">
      {/* 参加者セクション - 青系（処理担当の色と統一） */}
      <section className="bg-blue-900/20 rounded-lg overflow-hidden border border-blue-800/30">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 p-3">
          <h3 className="text-sm font-medium text-blue-200">参加者</h3>
          <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
            {participants.length}
          </span>
          <div className="ml-auto">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowRoleEditor(true); }}
              disabled={disabled}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
              title="カスタムロールを管理"
            >
              ロール管理
            </button>
          </div>
        </div>
        {/* 参加者リスト */}
        <div className="px-3 pb-2">
          <ParticipantList
            participants={participants}
            customRoles={customRoles}
            disabled={disabled}
            onUpdateRole={handleUpdateRole}
            onRemove={removeParticipant}
            onReorder={onParticipantsChange}
          />
        </div>
        {/* モデル追加トリガー + モデルピッカー（一体化） */}
        <div className={`px-3 ${pickerContext === 'participant' ? 'pb-0' : 'pb-3'}`}>
          <button
            type="button"
            onClick={() => togglePicker('participant')}
            disabled={disabled}
            className={`w-full flex items-center gap-2 p-2 transition-colors disabled:opacity-50 ${
              pickerContext === 'participant'
                ? 'bg-gray-800/50 text-blue-300 rounded-t-lg'
                : 'rounded hover:bg-blue-800/30 text-gray-400 hover:text-gray-300'
            }`}
            title={pickerContext === 'participant' ? 'モデル選択を閉じる' : '参加者を追加'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${pickerContext === 'participant' ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs">モデルを追加</span>
          </button>
          {/* 参加者追加用モデルピッカー（トリガーと一体化） */}
          {pickerContext === 'participant' && renderModelPicker()}
        </div>
        {pickerContext === 'participant' && <div className="pb-3" />}
      </section>

      {/* サポートエージェントセクション - 緑系（処理担当の色と統一） */}
      <section className="bg-green-900/20 rounded-lg overflow-hidden border border-green-800/30">
        {/* ヘッダー（クリックで開閉） */}
        <div className={`px-3 ${isSupportExpanded ? 'pb-0' : 'pb-3'}`}>
          <div className={`flex items-center gap-2 p-2 transition-colors ${
            isSupportExpanded
              ? 'bg-gray-800/50 text-green-300 rounded-t-lg'
              : 'rounded hover:bg-green-800/30 text-gray-300 hover:text-green-200'
          }`}>
            <button
              type="button"
              onClick={() => setIsSupportExpanded(!isSupportExpanded)}
              disabled={disabled}
              className="flex items-center gap-2 flex-1 min-w-0 disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 transition-transform shrink-0 ${isSupportExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium shrink-0">サポートエージェント</span>
              {supportAgent ? (
                <span className="text-xs text-green-300 truncate flex-1">
                  {getSupportAgentPreview()}
                </span>
              ) : (
                <span className="text-xs text-gray-500 flex-1">未設定</span>
              )}
            </button>
            {supportAgent && (
              <button
                type="button"
                onClick={() => onSupportAgentChange(null)}
                disabled={disabled}
                className="text-xs text-red-400 hover:text-red-300 bg-red-900/30 px-2 py-0.5 rounded transition-colors disabled:opacity-50 shrink-0"
                title="サポートエージェントを解除"
              >
                解除
              </button>
            )}
          </div>
          {/* 展開時のコンテンツ */}
          {isSupportExpanded && (
            <div className="bg-gray-800/50 rounded-b-lg p-3">
              {/* サポートエージェント詳細設定（モデル名、モデル選択、タスク設定） */}
              <SupportAgentSection
                supportAgent={supportAgent}
                availableModels={availableModels}
                disabled={disabled}
                onSupportAgentChange={onSupportAgentChange}
                isModelPickerExpanded={isSupportModelPickerExpanded}
                onToggleModelPicker={() => setIsSupportModelPickerExpanded(!isSupportModelPickerExpanded)}
                modelPicker={renderModelPicker()}
              />
            </div>
          )}
        </div>
        {isSupportExpanded && <div className="pb-3" />}
      </section>

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
