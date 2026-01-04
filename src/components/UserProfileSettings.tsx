'use client';

import { useState } from 'react';
import { UserProfile, TechLevel, ResponseStyle, TECH_LEVEL_PRESETS, RESPONSE_STYLE_PRESETS } from '@/types';

interface UserProfileSettingsProps {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  disabled?: boolean;
}

export function UserProfileSettings({ profile, onProfileChange, disabled }: UserProfileSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm font-medium text-gray-300">プロファイル設定</span>
          {hasProfile && (
            <span className="px-1.5 py-0.5 text-xs bg-purple-600/30 text-purple-300 rounded">
              設定済み
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-gray-700">
          {/* 名前 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">名前（任意）</label>
            <input
              type="text"
              value={profile.name || ''}
              onChange={(e) => updateProfile({ name: e.target.value || undefined })}
              placeholder="例: 田中太郎"
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* 職業・専門分野 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">職業・専門分野</label>
            <input
              type="text"
              value={profile.occupation || ''}
              onChange={(e) => updateProfile({ occupation: e.target.value || undefined })}
              placeholder="例: ソフトウェアエンジニア、データサイエンティスト"
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* 技術レベル */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">技術レベル</label>
            <div className="flex flex-wrap gap-1">
              {TECH_LEVEL_PRESETS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => updateProfile({ techLevel: profile.techLevel === level.id ? undefined : level.id })}
                  disabled={disabled}
                  title={level.description}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    profile.techLevel === level.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {level.name}
                </button>
              ))}
            </div>
          </div>

          {/* 回答スタイル */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">回答スタイル</label>
            <div className="flex flex-wrap gap-1">
              {RESPONSE_STYLE_PRESETS.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => updateProfile({ responseStyle: profile.responseStyle === style.id ? undefined : style.id })}
                  disabled={disabled}
                  title={style.description}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    profile.responseStyle === style.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>

          {/* 関心のある領域 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">関心のある領域</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                placeholder="例: AI、Web開発、セキュリティ"
                disabled={disabled}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={addInterest}
                disabled={disabled || !newInterest.trim()}
                className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加
              </button>
            </div>
            {profile.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {profile.interests.map((interest) => (
                  <span
                    key={interest}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded"
                  >
                    {interest}
                    <button
                      type="button"
                      onClick={() => removeInterest(interest)}
                      disabled={disabled}
                      className="hover:text-white disabled:opacity-50"
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
          <div>
            <label className="block text-xs text-gray-400 mb-1">その他（自由記述）</label>
            <textarea
              value={profile.customContext || ''}
              onChange={(e) => updateProfile({ customContext: e.target.value || undefined })}
              placeholder="例: 実務経験10年、最近はAI/MLに注力中、技術的な詳細を好む"
              disabled={disabled}
              rows={2}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* クリアボタン */}
          {hasProfile && (
            <button
              type="button"
              onClick={() => onProfileChange({})}
              disabled={disabled}
              className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-50"
            >
              プロファイルをクリア
            </button>
          )}
        </div>
      )}
    </div>
  );
}
