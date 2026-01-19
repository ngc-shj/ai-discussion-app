'use client';

import { AIProviderType, ModelInfo, DiscussionParticipant, SupportAgentConfig } from '@/types';
import { AISelector } from './AISelector';

interface ParticipantsPanelProps {
  participants: DiscussionParticipant[];
  onParticipantsChange: (participants: DiscussionParticipant[]) => void;
  availableModels: Record<AIProviderType, ModelInfo[]>;
  availability: Record<AIProviderType, boolean>;
  supportAgent: SupportAgentConfig | null;
  onSupportAgentChange: (config: SupportAgentConfig | null) => void;
  disabled?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onCollapse?: () => void; // デスクトップ用折りたたみ
}

export function ParticipantsPanel({
  participants,
  onParticipantsChange,
  availableModels,
  availability,
  supportAgent,
  onSupportAgentChange,
  disabled,
  isOpen = true,
  onClose,
  onCollapse,
}: ParticipantsPanelProps) {
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
          w-96 max-w-[85vw] bg-gray-800 p-4 border-l border-gray-700 flex flex-col h-full
        `}
      >
        {/* ヘッダー - デスクトップではクリックで折りたたみ */}
        <div
          className={`flex items-center justify-between mb-4 ${onCollapse ? 'md:cursor-pointer' : ''}`}
          onClick={onCollapse ? () => {
            // デスクトップのみ折りたたみ
            if (window.innerWidth >= 768) {
              onCollapse();
            }
          } : undefined}
          title={onCollapse ? 'クリックでパネルを折りたたむ' : undefined}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">参加AI</h2>
            <span className="text-sm text-gray-400">({participants.length})</span>
          </div>
          <div className="flex items-center gap-1">
            {/* デスクトップ用折りたたみアイコン */}
            {onCollapse && (
              <svg className="hidden md:block w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            {/* モバイル用閉じるボタン */}
            {onClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="md:hidden p-1 text-gray-400 hover:text-white rounded"
                aria-label="参加AIパネルを閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* AI選択 */}
          <div className="flex-1 min-h-0 bg-indigo-900/20 rounded-lg p-3 border border-indigo-800/30 overflow-hidden">
            <AISelector
              participants={participants}
              onParticipantsChange={onParticipantsChange}
              availableModels={availableModels}
              availability={availability}
              supportAgent={supportAgent}
              onSupportAgentChange={onSupportAgentChange}
              disabled={disabled}
            />
          </div>

          {/* 処理担当の説明 */}
          {(() => {
            // 各タスクが有効かどうかを判定
            const isKeywordEnabled = supportAgent?.tasks.find(t => t.task === 'keywordExtraction')?.enabled ?? false;
            const isRelevanceEnabled = supportAgent?.tasks.find(t => t.task === 'relevanceScoring')?.enabled ?? false;
            const isFollowupEnabled = supportAgent?.tasks.find(t => t.task === 'followupGeneration')?.enabled ?? false;
            const participant1Name = participants.length > 0
              ? participants[0].displayName || `${participants[0].provider}/${participants[0].model}`
              : '参加AI 1番目';
            const hasSupportAgentTask = isKeywordEnabled || isRelevanceEnabled || isFollowupEnabled;

            return (
              <div className="shrink-0 text-xs text-gray-400 pt-3 mt-3 border-t border-gray-700 space-y-2">
                <p className="font-medium text-gray-300">処理担当</p>
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 shrink-0 w-24">議論:</span>
                    <span className="text-gray-400">参加AI全員（ラウンドロビン）</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 shrink-0 w-24">統合回答:</span>
                    <span className="text-blue-400">{participant1Name}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 shrink-0 w-24">キーワード生成:</span>
                    <span className={isKeywordEnabled ? 'text-green-400' : 'text-blue-400'}>
                      {isKeywordEnabled ? 'サポートエージェント' : participant1Name}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 shrink-0 w-24">関連度評価:</span>
                    <span className={isRelevanceEnabled ? 'text-green-400' : 'text-blue-400'}>
                      {isRelevanceEnabled ? 'サポートエージェント' : participant1Name}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 shrink-0 w-24">フォローアップ:</span>
                    <span className={isFollowupEnabled ? 'text-green-400' : 'text-blue-400'}>
                      {isFollowupEnabled ? 'サポートエージェント' : participant1Name}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                  <p><span className="text-blue-400">●</span> 参加AI 1番目が担当</p>
                  {hasSupportAgentTask && <p><span className="text-green-400">●</span> サポートエージェントが担当</p>}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
