'use client';

import { AIProviderType, ModelInfo, getOllamaModelColor } from '@/types';
import { ModelFilterType } from '@/hooks/useAISelector';

interface ProviderInfo {
  id: AIProviderType;
  name: string;
  color: string;
}

interface ProviderSectionProps {
  provider: ProviderInfo;
  isAvailable: boolean;
  isExpanded: boolean;
  allModels: ModelInfo[];
  filteredModels: ModelInfo[];
  selectedCount: number;
  modelFilter: ModelFilterType;
  disabled?: boolean;
  onToggleExpanded: () => void;
  onAddParticipant: (modelId: string, displayName: string, color: string) => void;
  getParticipantCount: (modelId: string) => number;
}

export function ProviderSection({
  provider,
  isAvailable,
  isExpanded,
  allModels,
  filteredModels,
  selectedCount,
  modelFilter,
  disabled,
  onToggleExpanded,
  onAddParticipant,
  getParticipantCount,
}: ProviderSectionProps) {
  const isOllama = provider.id === 'ollama';

  return (
    <div
      className={`rounded-lg bg-gray-800 overflow-hidden ${
        !isAvailable ? 'opacity-50' : ''
      }`}
    >
      {/* プロバイダーヘッダー（クリックで折りたたみ） */}
      <button
        type="button"
        onClick={() => isAvailable && onToggleExpanded()}
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
          {filteredModels.length > 0 ? (
            <>
              {filteredModels.map((model) => {
                const modelColor = isOllama ? getOllamaModelColor(model.id) : provider.color;
                const displayName = model.name;
                const count = getParticipantCount(model.id);

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
                      onClick={() => onAddParticipant(model.id, displayName, modelColor)}
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
              {modelFilter !== 'all' && allModels.length > filteredModels.length && (
                <div className="text-xs text-gray-500 pl-2 pt-1">
                  他 {allModels.length - filteredModels.length} モデル（「すべて」で表示）
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
}
