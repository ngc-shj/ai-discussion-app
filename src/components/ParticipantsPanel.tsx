'use client';

import { AIProviderType, ModelInfo, DiscussionParticipant } from '@/types';
import { AISelector } from './AISelector';

interface ParticipantsPanelProps {
  participants: DiscussionParticipant[];
  onParticipantsChange: (participants: DiscussionParticipant[]) => void;
  availableModels: Record<AIProviderType, ModelInfo[]>;
  availability: Record<AIProviderType, boolean>;
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
              disabled={disabled}
            />
          </div>

          <div className="shrink-0 text-sm text-gray-400 pt-2 mt-4 border-t border-gray-700">
            <p className="mb-2">
              <strong>ラウンドロビン形式</strong>
            </p>
            <p className="text-xs">
              各AIが順番に発言し、前のAIの意見を踏まえて議論を深めます。
              最後に全ての意見を統合した回答が生成されます。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
