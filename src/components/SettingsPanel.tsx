'use client';

import { AIProviderType, ModelInfo, DiscussionParticipant, UserProfile } from '@/types';
import { AISelector } from './AISelector';
import { UserProfileSettings } from './UserProfileSettings';

interface SettingsPanelProps {
  participants: DiscussionParticipant[];
  onParticipantsChange: (participants: DiscussionParticipant[]) => void;
  availableModels: Record<AIProviderType, ModelInfo[]>;
  availability: Record<AIProviderType, boolean>;
  userProfile: UserProfile;
  onUserProfileChange: (profile: UserProfile) => void;
  disabled?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function SettingsPanel({
  participants,
  onParticipantsChange,
  availableModels,
  availability,
  userProfile,
  onUserProfileChange,
  disabled,
  isOpen = true,
  onClose,
}: SettingsPanelProps) {
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
          w-80 max-w-[85vw] bg-gray-800 p-4 border-l border-gray-700 flex flex-col h-full
        `}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">参加者</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1 text-gray-400 hover:text-white rounded"
              aria-label="参加者パネルを閉じる"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col space-y-4">
          {/* プロファイル設定 */}
          <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
            <UserProfileSettings
              profile={userProfile}
              onProfileChange={onUserProfileChange}
              disabled={disabled}
            />
          </div>

          {/* AI参加者 */}
          <div className="bg-indigo-900/20 rounded-lg p-3 border border-indigo-800/30">
            <AISelector
              participants={participants}
              onParticipantsChange={onParticipantsChange}
              availableModels={availableModels}
              availability={availability}
              disabled={disabled}
            />
          </div>

          <div className="text-sm text-gray-400 pt-2 border-t border-gray-700">
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
