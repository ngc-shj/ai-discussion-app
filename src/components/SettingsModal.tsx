'use client';

import { useEffect } from 'react';
import { UserProfile } from '@/types';
import { ApiKeys } from '@/hooks';
import { SettingsContent } from './SettingsContent';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKeys;
  onApiKeyChange: (key: keyof ApiKeys, value: string) => void;
  onSaveApiKeys: () => void;
  hasUnsavedChanges: boolean;
  isUrlValid?: (key: keyof ApiKeys) => boolean;
  userProfile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  disabled?: boolean;
}

export function SettingsModal({
  isOpen,
  onClose,
  apiKeys,
  onApiKeyChange,
  onSaveApiKeys,
  hasUnsavedChanges,
  isUrlValid,
  userProfile,
  onProfileChange,
  disabled,
}: SettingsModalProps) {
  // ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* モーダルコンテンツ */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">設定</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              自動保存
            </span>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              aria-label="閉じる"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 設定コンテンツ */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <SettingsContent
            apiKeys={apiKeys}
            onApiKeyChange={onApiKeyChange}
            onSaveApiKeys={onSaveApiKeys}
            hasUnsavedChanges={hasUnsavedChanges}
            isUrlValid={isUrlValid}
            userProfile={userProfile}
            onProfileChange={onProfileChange}
            onBack={onClose}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}