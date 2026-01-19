'use client';

import { useState } from 'react';
import {
  AIProviderType,
  ModelInfo,
  SupportAgentConfig,
  SupportTask,
  SUPPORT_TASK_LABELS,
  DEFAULT_PROVIDERS,
} from '@/types';

interface SupportAgentSectionProps {
  supportAgent: SupportAgentConfig | null;
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
  const [isExpanded, setIsExpanded] = useState(false);

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

  // サポートエージェントを解除
  const handleClear = () => {
    onSupportAgentChange(null);
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

  const isEnabled = supportAgent !== null;

  return (
    <section className="shrink-0 pb-4 border-t border-gray-700 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">サポートエージェント</h3>
        {isEnabled && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            title="サポートエージェントを解除"
          >
            解除
          </button>
        )}
      </div>

      {isEnabled ? (
        <div className="space-y-3">
          {/* 選択中のモデル表示 */}
          <div className="flex items-center gap-2 p-2 bg-purple-900/30 rounded-lg ring-1 ring-purple-500/50">
            <div className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
            <span className="text-sm text-purple-200 truncate flex-1">
              {getSelectedModelDisplay()}
            </span>
          </div>

          {/* タスク設定 */}
          <div>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              disabled={disabled}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
              タスク設定
            </button>

            {isExpanded && (
              <div className="mt-2 space-y-2 pl-3 border-l border-gray-700">
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
                        className="mt-0.5 w-3 h-3 text-purple-500 bg-gray-700 border-gray-600 rounded"
                      />
                      <div>
                        <span className="text-xs text-gray-300">{label.name}</span>
                        <p className="text-xs text-gray-500">{label.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 現在の設定サマリー */}
          {!isExpanded && (
            <p className="text-xs text-gray-500">
              {supportAgent.tasks.filter((t) => t.enabled).length} タスクを担当
            </p>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500 space-y-1">
          <p>モデル一覧から「サポート」を選択して設定</p>
          <p className="text-gray-600">キーワード抽出・関連度評価・フォローアップ生成を専用AIに委任</p>
        </div>
      )}
    </section>
  );
}
