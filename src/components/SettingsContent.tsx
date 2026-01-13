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
  isUrlValid?: (key: keyof ApiKeys) => boolean;
  userProfile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  onBack: () => void;
  disabled?: boolean;
}

// URL入力フィールド（編集可能）
function UrlInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  isValid = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isValid?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-gray-200 text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
          isValid
            ? 'border-gray-600 focus:border-blue-500'
            : 'border-red-500 focus:border-red-500'
        }`}
      />
      {!isValid && (
        <p className="text-xs text-red-400">有効なURL形式で入力してください（例: http://localhost:11434）</p>
      )}
    </div>
  );
}

// APIキー表示フィールド（読み取り専用）
function ApiKeyDisplay({
  label,
  placeholder,
}: {
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <div className="relative">
        <input
          type="text"
          value=""
          placeholder={placeholder}
          readOnly
          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 text-sm cursor-not-allowed"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
          .env.local で設定
        </span>
      </div>
    </div>
  );
}

// セクションヘッダー
function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-medium text-gray-300 pb-2 border-b border-gray-700 mb-3">
      {title}
    </h3>
  );
}

// AIプロバイダー設定
function AiProviderSettings({
  apiKeys,
  onApiKeyChange,
  disabled,
  isUrlValid,
}: {
  apiKeys: ApiKeys;
  onApiKeyChange: (key: keyof ApiKeys, value: string) => void;
  disabled?: boolean;
  isUrlValid?: (key: keyof ApiKeys) => boolean;
}) {
  return (
    <div className="space-y-6">
      {/* APIキー セクション */}
      <div>
        <SectionHeader title="APIキー" />
        <p className="text-xs text-gray-500 mb-3">
          セキュリティ上の理由により、APIキーはブラウザから設定できません。環境変数（.env.local）で設定してください。
        </p>
        <div className="space-y-3">
          <ApiKeyDisplay
            label="Claude (Anthropic)"
            placeholder="sk-ant-..."
          />
          <ApiKeyDisplay
            label="OpenAI"
            placeholder="sk-..."
          />
          <ApiKeyDisplay
            label="Gemini (Google AI)"
            placeholder="AIza..."
          />
        </div>
      </div>

      {/* ホスト名指定 セクション */}
      <div>
        <SectionHeader title="ホスト名指定" />
        <p className="text-xs text-gray-500 mb-3">
          セルフホスト型サービスのURLを設定できます
        </p>
        <div className="space-y-3">
          <UrlInput
            label="Ollama Base URL"
            value={apiKeys.ollamaBaseUrl || ''}
            onChange={(v) => onApiKeyChange('ollamaBaseUrl', v)}
            placeholder="http://localhost:11434"
            disabled={disabled}
            isValid={isUrlValid?.('ollamaBaseUrl') ?? true}
          />
        </div>
      </div>
    </div>
  );
}

// 検索プロバイダー設定
function SearchProviderSettings({
  apiKeys,
  onApiKeyChange,
  disabled,
  isUrlValid,
}: {
  apiKeys: ApiKeys;
  onApiKeyChange: (key: keyof ApiKeys, value: string) => void;
  disabled?: boolean;
  isUrlValid?: (key: keyof ApiKeys) => boolean;
}) {
  return (
    <div className="space-y-6">
      {/* APIキー セクション */}
      <div>
        <SectionHeader title="APIキー" />
        <p className="text-xs text-gray-500 mb-3">
          セキュリティ上の理由により、APIキーはブラウザから設定できません。環境変数（.env.local）で設定してください。
        </p>
        <div className="space-y-3">
          <ApiKeyDisplay
            label="Tavily (推奨)"
            placeholder="tvly-..."
          />
          <ApiKeyDisplay
            label="Serper (Google検索)"
            placeholder="..."
          />
          <ApiKeyDisplay
            label="Brave Search"
            placeholder="BSA..."
          />
          <ApiKeyDisplay
            label="Jina Reader (詳細取得用)"
            placeholder="jina_..."
          />
        </div>
      </div>

      {/* ホスト名指定 セクション */}
      <div>
        <SectionHeader title="ホスト名指定" />
        <p className="text-xs text-gray-500 mb-3">
          セルフホスト型サービスのURLを設定できます
        </p>
        <div className="space-y-3">
          <UrlInput
            label="SearXNG Base URL"
            value={apiKeys.searxngBaseUrl || ''}
            onChange={(v) => onApiKeyChange('searxngBaseUrl', v)}
            placeholder="http://localhost:8080"
            disabled={disabled}
            isValid={isUrlValid?.('searxngBaseUrl') ?? true}
          />
        </div>
      </div>
    </div>
  );
}

export function SettingsContent({
  apiKeys,
  onApiKeyChange,
  onSaveApiKeys,
  hasUnsavedChanges,
  isUrlValid,
  userProfile,
  onProfileChange,
  onBack,
  disabled,
}: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'profile',
      label: 'プロファイル',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'ai',
      label: 'AI',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: '検索',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
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
        </div>
        {/* 全タブ自動保存 */}
        <span className="text-sm text-gray-500">
          自動保存
        </span>
      </div>

      {/* コンテンツエリア */}
      <div className="flex flex-1 min-h-0">
        {/* 左側タブ */}
        <div className="w-44 border-r border-gray-700 p-2 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors mb-1 ${
                activeTab === tab.id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 右側コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 flex justify-center">
          <div className="max-w-lg w-full">
            {activeTab === 'ai' && (
              <AiProviderSettings
                apiKeys={apiKeys}
                onApiKeyChange={onApiKeyChange}
                disabled={disabled}
                isUrlValid={isUrlValid}
              />
            )}
            {activeTab === 'search' && (
              <SearchProviderSettings
                apiKeys={apiKeys}
                onApiKeyChange={onApiKeyChange}
                disabled={disabled}
                isUrlValid={isUrlValid}
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
        </div>
      </div>
    </div>
  );
}
