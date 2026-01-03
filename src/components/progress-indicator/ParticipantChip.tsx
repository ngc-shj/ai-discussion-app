'use client';

import { DiscussionParticipant, isCustomRoleId, ROLE_PRESETS } from '@/types';

interface ParticipantChipProps {
  participant: DiscussionParticipant;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
}

export function ParticipantChip({
  participant: p,
  index,
  isActive,
  isCompleted,
}: ParticipantChipProps) {
  const isPending = !isActive && !isCompleted;

  // 表示名を短縮（MessageBubbleと統一するため、displayNameを使用）
  // displayNameは「Ollama (llama3.2:latest)」のような形式
  const shortName = p.displayName.length > 20
    ? p.displayName.slice(0, 17) + '...'
    : p.displayName;

  // ロール情報（中立以外の場合のみ表示）
  // displayRoleNameがない場合はフォールバック（プリセット→ROLE_PRESETS、カスタム→「カスタム」）
  const isCustomRole = p.role ? isCustomRoleId(p.role) : false;
  const getRoleName = () => {
    if (p.displayRoleName) return p.displayRoleName;
    if (!p.role) return undefined;
    if (isCustomRole) return 'カスタム'; // カスタムロールのフォールバック
    return ROLE_PRESETS.find((r) => r.id === p.role)?.name;
  };
  const roleName = getRoleName();
  const showRole = p.role && p.role !== 'neutral' && roleName;
  const participantKey = `${p.provider}-${p.model}-${index}`;

  return (
    <div
      key={participantKey}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
        transition-all duration-300
        ${isActive
          ? 'ring-2 ring-offset-1 ring-offset-gray-800 scale-105'
          : isCompleted
            ? 'opacity-60'
            : 'opacity-40'
        }
      `}
      style={{
        backgroundColor: `${p.color}20`,
        borderColor: p.color,
        borderWidth: '1px',
        // @ts-expect-error CSS custom property for ring color
        '--tw-ring-color': isActive ? p.color : undefined,
      }}
      title={`${p.displayName}${showRole ? ` [${roleName}]` : ''}${isActive ? ' (実行中)' : isCompleted ? ' (完了)' : ' (待機中)'}`}
    >
      {/* ステータスインジケーター */}
      <div className="relative">
        <div
          className={`w-2.5 h-2.5 rounded-full ${isActive ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: p.color }}
        />
        {isCompleted && (
          <svg
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-green-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      {/* モデル名 */}
      <span
        className={`font-medium ${isPending ? 'text-gray-500' : ''}`}
        style={{ color: isPending ? undefined : p.color }}
      >
        {shortName}
      </span>
      {/* ロール表示（中立以外） */}
      {showRole && (
        <span className={`text-[10px] ${isCustomRole ? 'text-purple-400' : 'text-gray-400'}`}>
          [{roleName}]
        </span>
      )}
    </div>
  );
}

interface SummaryChipProps {
  isSummarizing: boolean;
}

export function SummaryChip({ isSummarizing }: SummaryChipProps) {
  return (
    <div
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border
        transition-all duration-300
        ${isSummarizing
          ? 'border-purple-400 bg-purple-400/20 ring-2 ring-purple-400 ring-offset-1 ring-offset-gray-800 scale-105'
          : 'border-gray-600 bg-gray-700/50 opacity-40'
        }
      `}
      title={isSummarizing ? '統合回答を生成中' : '統合回答 (待機中)'}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${isSummarizing ? 'bg-purple-400 animate-pulse' : 'bg-gray-500'}`} />
      <span className={isSummarizing ? 'text-purple-400 font-medium' : 'text-gray-500'}>統合</span>
    </div>
  );
}
