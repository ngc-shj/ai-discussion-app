'use client';

import { ReactNode } from 'react';
import {
  AIProviderType,
  ModelInfo,
  SupportAgentConfig,
  SupportTask,
  SUPPORT_TASK_LABELS,
  DEFAULT_PROVIDERS,
  DEFAULT_SUPPORT_TASKS,
} from '@/types';

interface SupportAgentSectionProps {
  supportAgent: SupportAgentConfig | null;
  availableModels: Record<AIProviderType, ModelInfo[]>;
  disabled?: boolean;
  onSupportAgentChange: (config: SupportAgentConfig | null) => void;
  isModelPickerExpanded: boolean;
  onToggleModelPicker: () => void;
  modelPicker: ReactNode;
}

export function SupportAgentSection({
  supportAgent,
  availableModels,
  disabled,
  onSupportAgentChange,
  isModelPickerExpanded,
  onToggleModelPicker,
  modelPicker,
}: SupportAgentSectionProps) {
  // タスクの有効/無効を切り替え
  const handleTaskToggle = (task: SupportTask) => {
    if (!supportAgent) return;
    const updatedTasks = supportAgent.tasks.map((t) =>
      t.task === task ? { ...t, enabled: !t.enabled } : t
    );
    onSupportAgentChange({
      ...supportAgent,
      tasks: updatedTasks,
    });
  };

  // 現在選択中のモデル表示名を取得
  const getSelectedModelDisplay = (): string => {
    if (!supportAgent) return '未設定';
    const models = availableModels[supportAgent.provider] || [];
    const model = models.find((m) => m.id === supportAgent.modelId);
    if (model) {
      const providerInfo = DEFAULT_PROVIDERS.find((p) => p.id === supportAgent.provider);
      return `${model.name} (${providerInfo?.name || supportAgent.provider})`;
    }
    return supportAgent.modelId;
  };

  // 表示用タスクリスト（設定済みならその設定、未設定ならデフォルト）
  const displayTasks = supportAgent?.tasks ?? DEFAULT_SUPPORT_TASKS;

  return (
    <div className="space-y-3">
      {/* モデル選択ボタン（モデル名表示 + 展開可能） */}
      <div>
        <button
          type="button"
          onClick={onToggleModelPicker}
          disabled={disabled}
          className={`w-full flex items-center gap-2 p-2 rounded-lg ring-1 transition-colors disabled:opacity-50 ${
            supportAgent
              ? isModelPickerExpanded
                ? 'bg-green-900/30 ring-green-500/50 rounded-b-none'
                : 'bg-green-900/30 ring-green-500/50 hover:bg-green-900/40'
              : isModelPickerExpanded
                ? 'bg-gray-800/50 ring-gray-600/50 rounded-b-none'
                : 'bg-gray-800/50 ring-gray-600/50 hover:bg-gray-700/50'
          }`}
        >
          <svg
            className={`w-4 h-4 transition-transform shrink-0 ${isModelPickerExpanded ? 'rotate-90' : ''} ${
              supportAgent ? 'text-green-400' : 'text-gray-400'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className={`w-3 h-3 rounded-full shrink-0 ${
            supportAgent ? 'bg-green-500' : 'bg-gray-500'
          }`} />
          <span className={`text-sm truncate flex-1 text-left ${
            supportAgent ? 'text-green-200' : 'text-gray-400'
          }`}>
            {getSelectedModelDisplay()}
          </span>
        </button>
        {/* モデルピッカー（展開時） */}
        {isModelPickerExpanded && modelPicker}
      </div>

      {/* タスク設定（常に表示） */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400">タスク設定</p>
        <div className={`space-y-2 pl-3 border-l ${
          supportAgent ? 'border-green-800/50' : 'border-gray-700/50'
        }`}>
          {displayTasks.map((taskConfig) => {
            const label = SUPPORT_TASK_LABELS[taskConfig.task];
            const isDisabled = disabled || !supportAgent;
            return (
              <label
                key={taskConfig.task}
                className={`flex items-start gap-2 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={taskConfig.enabled}
                  onChange={() => handleTaskToggle(taskConfig.task)}
                  disabled={isDisabled}
                  className="mt-0.5 w-3 h-3 text-green-500 bg-gray-700 border-gray-600 rounded"
                />
                <div>
                  <span className="text-xs text-gray-300">{label.name}</span>
                  <p className="text-xs text-gray-500">{label.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
