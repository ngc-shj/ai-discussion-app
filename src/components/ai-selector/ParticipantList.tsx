'use client';

import { DiscussionParticipant, ROLE_PRESETS, ParticipantRole } from '@/types';

interface ParticipantListProps {
  participants: DiscussionParticipant[];
  disabled?: boolean;
  onUpdateRole: (id: string, role: ParticipantRole) => void;
  onRemove: (id: string) => void;
}

export function ParticipantList({
  participants,
  disabled,
  onUpdateRole,
  onRemove,
}: ParticipantListProps) {
  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1 p-2 bg-gray-700/30 rounded-lg">
      <div className="text-xs text-gray-400 mb-1">参加者一覧</div>
      {participants.map((participant, index) => {
        const rolePreset = ROLE_PRESETS.find((r) => r.id === participant.role);
        return (
          <div
            key={participant.id}
            className="flex items-center gap-2 p-1.5 bg-gray-800 rounded text-sm"
          >
            <span className="text-gray-500 text-xs w-4">{index + 1}.</span>
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: participant.color }}
            />
            <span className="text-gray-300 truncate flex-1" title={participant.displayName}>
              {participant.displayName}
            </span>
            {/* 役割選択 */}
            <select
              value={participant.role || 'neutral'}
              onChange={(e) => onUpdateRole(participant.id, e.target.value as ParticipantRole)}
              disabled={disabled}
              title={rolePreset?.description || '役割を選択'}
              className="px-1.5 py-0.5 text-xs bg-gray-600 text-gray-200 rounded border-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {ROLE_PRESETS.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {/* 削除ボタン */}
            <button
              type="button"
              onClick={() => onRemove(participant.id)}
              disabled={disabled}
              className="p-0.5 text-gray-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              title="削除"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
