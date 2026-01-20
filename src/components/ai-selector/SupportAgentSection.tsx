'use client';

import {
  AIProviderType,
  ModelInfo,
  SupportAgentConfig,
  SupportTask,
  SUPPORT_TASK_LABELS,
  DEFAULT_PROVIDERS,
} from '@/types';

interface SupportAgentSectionProps {
  supportAgent: SupportAgentConfig;
  availableModels: Record<AIProviderType, ModelInfo[]>;
  disabled?: boolean;
  onSupportAgentChange: (config: SupportAgentConfig | null) => void;
}

export function SupportAgentSection({
  supportAgent,
  availableModels,
  disabled,
  onSupportAgentChange,
}: SupportAgentSectionProps) {
  // タスクの有効/無効を切り替え
  const handleTaskToggle = (task: SupportTask) => {
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
    const models = availableModels[supportAgent.provider] || [];
    const model = models.find((m) => m.id === supportAgent.modelId);
    if (model) {
      const providerInfo = DEFAULT_PROVIDERS.find((p) => p.id === supportAgent.provider);
      return `${model.name} (${providerInfo?.name || supportAgent.provider})`;
    }
    return supportAgent.modelId;
  };

  return (
    <div className="space-y-3">
      {/* 選択中のモデル表示 */}
      <div className="flex items-center gap-2 p-2 bg-green-900/30 rounded-lg ring-1 ring-green-500/50">
        <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
        <span className="text-sm text-green-200 truncate flex-1">
          {getSelectedModelDisplay()}
        </span>
      </div>

      {/* タスク設定（常に表示） */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400">タスク設定</p>
        <div className="space-y-2 pl-3 border-l border-green-800/50">
          {supportAgent.tasks.map((taskConfig) => {
            const label = SUPPORT_TASK_LABELS[taskConfig.task];
            return (
              <label
                key={taskConfig.task}
                className={`flex items-start gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={taskConfig.enabled}
                  onChange={() => handleTaskToggle(taskConfig.task)}
                  disabled={disabled}
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
