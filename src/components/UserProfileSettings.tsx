'use client';

import { useState } from 'react';
import { UserProfile, TECH_LEVEL_PRESETS, RESPONSE_STYLE_PRESETS } from '@/types';

interface UserProfileSettingsProps {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  disabled?: boolean;
}

export function UserProfileSettings({ profile, onProfileChange, disabled }: UserProfileSettingsProps) {
  const [newInterest, setNewInterest] = useState('');

  const updateProfile = (updates: Partial<UserProfile>) => {
    onProfileChange({ ...profile, ...updates });
  };

  const addInterest = () => {
    if (newInterest.trim() && !profile.interests?.includes(newInterest.trim())) {
      updateProfile({
        interests: [...(profile.interests || []), newInterest.trim()],
      });
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    updateProfile({
      interests: profile.interests?.filter((i) => i !== interest),
    });
  };

  const hasProfile = profile.name || profile.occupation || profile.techLevel ||
    profile.responseStyle || (profile.interests && profile.interests.length > 0) ||
    profile.customContext;

  return (
    <div className="space-y-4">
      {/* 名前 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">名前（任意）</label>
        <input
          type="text"
          value={profile.name || ''}
          onChange={(e) => updateProfile({ name: e.target.value || undefined })}
          placeholder="例: 田中太郎"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* 職業・専門分野 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">職業・専門分野</label>
        <input
          type="text"
          value={profile.occupation || ''}
          onChange={(e) => updateProfile({ occupation: e.target.value || undefined })}
          placeholder="例: ソフトウェアエンジニア、データサイエンティスト"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* 技術レベル */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">技術レベル</label>
        <div className="flex flex-wrap gap-1.5">
          {TECH_LEVEL_PRESETS.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => updateProfile({ techLevel: profile.techLevel === level.id ? undefined : level.id })}
              disabled={disabled}
              title={level.description}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                profile.techLevel === level.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {level.name}
            </button>
          ))}
        </div>
      </div>

      {/* 回答スタイル */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">回答スタイル</label>
        <div className="flex flex-wrap gap-1.5">
          {RESPONSE_STYLE_PRESETS.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => updateProfile({ responseStyle: profile.responseStyle === style.id ? undefined : style.id })}
              disabled={disabled}
              title={style.description}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                profile.responseStyle === style.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {style.name}
            </button>
          ))}
        </div>
      </div>

      {/* 関心のある領域 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">関心のある領域</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === 'Enter' && (e.preventDefault(), addInterest())}
            placeholder="例: AI、Web開発、セキュリティ"
            disabled={disabled}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={addInterest}
            disabled={disabled || !newInterest.trim()}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>
        {profile.interests && profile.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded-lg"
              >
                {interest}
                <button
                  type="button"
                  onClick={() => removeInterest(interest)}
                  disabled={disabled}
                  className="hover:text-white disabled:opacity-50"
                  aria-label={`${interest}を削除`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* その他のコンテキスト */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">その他（自由記述）</label>
        <textarea
          value={profile.customContext || ''}
          onChange={(e) => updateProfile({ customContext: e.target.value || undefined })}
          placeholder="例: 実務経験10年、最近はAI/MLに注力中、技術的な詳細を好む"
          disabled={disabled}
          rows={4}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        />
      </div>

      {/* クリアボタン */}
      {hasProfile && (
        <button
          type="button"
          onClick={() => onProfileChange({})}
          disabled={disabled}
          className="text-xs text-gray-500 hover:text-gray-400 disabled:opacity-50"
        >
          プロファイルをクリア
        </button>
      )}
    </div>
  );
}
