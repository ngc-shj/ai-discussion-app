'use client';

import { useState } from 'react';
import { UserProfile } from '@/types';
import { ApiKeys } from '@/hooks';
import { UserProfileSettings } from './UserProfileSettings';

export type SettingsTab = 'ai' | 'search' | 'profile';

interface SettingsContentProps {
  apiKeys: ApiKeys;
  onApiKeyChange: (key: keyof ApiKeys, value: string) => void;
  onSaveApiKeys: () => void;
  hasUnsavedChanges: boolean;
  userProfile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  onBack: () => void;
  disabled?: boolean;
}

// APIキー入力フィールド
function ApiKeyInput({
  label,
  value,
  onChange,
  placeholder,
  isUrl = false,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isUrl?: boolean;
  disabled?: boolean;
}) {
  const [showValue, setShowValue] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <div className="relative">
        <input
          type={isUrl || showValue ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed pr-10"
        />
        {!isUrl && (
          <button
            type="button"
            onClick={() => setShowValue(!showValue)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
            tabIndex={-1}
          >
            {showValue ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// AIプロバイダー設定
function AiProviderSettings({
  apiKeys,
  onApiKeyChange,
  disabled,
}: {
  apiKeys: ApiKeys;
  onApiKeyChange: (key: keyof ApiKeys, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        AIプロバイダーのAPIキーを設定します。環境変数で設定されている場合は空欄でも動作します。
      </p>
      <ApiKeyInput
        label="Claude (Anthropic)"
        value={apiKeys.anthropic || ''}
        onChange={(v) => onApiKeyChange('anthropic', v)}
        placeholder="sk-ant-..."
        disabled={disabled}
      />
      <ApiKeyInput
        label="OpenAI"
        value={apiKeys.openai || ''}
        onChange={(v) => onApiKeyChange('openai', v)}
        placeholder="sk-..."
        disabled={disabled}
      />
      <ApiKeyInput
        label="Gemini (Google AI)"
        value={apiKeys.google || ''}
        onChange={(v) => onApiKeyChange('google', v)}
        placeholder="AIza..."
        disabled={disabled}
      />
      <ApiKeyInput
        label="Ollama Base URL"
        value={apiKeys.ollamaBaseUrl || ''}
        onChange={(v) => onApiKeyChange('ollamaBaseUrl', v)}
        placeholder="http://localhost:11434"
        isUrl
        disabled={disabled}
      />
    </div>
  );
}

// 検索プロバイダー設定
function SearchProviderSettings({
  apiKeys,
  onApiKeyChange,
  disabled,
}: {
  apiKeys: ApiKeys;
  onApiKeyChange: (key: keyof ApiKeys, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Web検索プロバイダーのAPIキーを設定します。複数設定した場合は優先順位に従って使用されます。
      </p>
      <ApiKeyInput
        label="Tavily (推奨)"
        value={apiKeys.tavily || ''}
        onChange={(v) => onApiKeyChange('tavily', v)}
        placeholder="tvly-..."
        disabled={disabled}
      />
      <ApiKeyInput
        label="Serper (Google検索)"
        value={apiKeys.serper || ''}
        onChange={(v) => onApiKeyChange('serper', v)}
        placeholder="..."
        disabled={disabled}
      />
      <ApiKeyInput
        label="Brave Search"
        value={apiKeys.brave || ''}
        onChange={(v) => onApiKeyChange('brave', v)}
        placeholder="BSA..."
        disabled={disabled}
      />
      <ApiKeyInput
        label="SearXNG Base URL"
        value={apiKeys.searxngBaseUrl || ''}
        onChange={(v) => onApiKeyChange('searxngBaseUrl', v)}
        placeholder="http://localhost:8080"
        isUrl
        disabled={disabled}
      />
      <ApiKeyInput
        label="Jina Reader (詳細取得用)"
        value={apiKeys.jina || ''}
        onChange={(v) => onApiKeyChange('jina', v)}
        placeholder="jina_..."
        disabled={disabled}
      />
    </div>
  );
}

export function SettingsContent({
  apiKeys,
  onApiKeyChange,
  onSaveApiKeys,
  hasUnsavedChanges,
  userProfile,
  onProfileChange,
  onBack,
  disabled,
}: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'ai',
      label: 'AIプロバイダー',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: '検索プロバイダー',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'プロファイル',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-700 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          title="戻る"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-white">設定</h2>
        {hasUnsavedChanges && (
          <span className="px-2 py-0.5 text-xs bg-yellow-600/30 text-yellow-400 rounded">
            未保存
          </span>
        )}
      </div>

      {/* タブメニュー（サイドメニュー風） */}
      <div className="flex flex-1 min-h-0">
        {/* 左側タブ */}
        <div className="w-48 border-r border-gray-700 p-2 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-lg transition-colors mb-1 ${
                activeTab === tab.id
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 右側コンテンツ */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'ai' && (
              <AiProviderSettings
                apiKeys={apiKeys}
                onApiKeyChange={onApiKeyChange}
                disabled={disabled}
              />
            )}
            {activeTab === 'search' && (
              <SearchProviderSettings
                apiKeys={apiKeys}
                onApiKeyChange={onApiKeyChange}
                disabled={disabled}
              />
            )}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  プロファイルを設定すると、AIがあなたに合わせた回答を生成します。
                </p>
                <UserProfileSettings
                  profile={userProfile}
                  onProfileChange={onProfileChange}
                  disabled={disabled}
                />
              </div>
            )}
          </div>

          {/* フッター（APIキー設定時のみ保存ボタン表示） */}
          {(activeTab === 'ai' || activeTab === 'search') && (
            <div className="p-4 border-t border-gray-700 shrink-0">
              <button
                type="button"
                onClick={onSaveApiKeys}
                disabled={!hasUnsavedChanges || disabled}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
