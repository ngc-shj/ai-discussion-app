'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DiscussionParticipant, ROLE_PRESETS, ParticipantRole, CustomRole, isCustomRoleId } from '@/types';

interface ParticipantListProps {
  participants: DiscussionParticipant[];
  customRoles: CustomRole[];
  disabled?: boolean;
  onUpdateRole: (id: string, role: ParticipantRole) => void;
  onRemove: (id: string) => void;
  onReorder: (participants: DiscussionParticipant[]) => void;
}

// ツールチップ付きの参加者名コンポーネント
function ParticipantName({ displayName }: { displayName: string }) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left, y: rect.top - 4 });
  };

  return (
    <span
      className="text-gray-300 truncate min-w-0 flex-1 cursor-default"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipPos(null)}
    >
      {displayName}
      {tooltipPos && (
        <span
          className="fixed z-[9999] px-2 py-1 text-xs text-white bg-gray-900 border border-gray-600 rounded shadow-lg whitespace-nowrap pointer-events-none -translate-y-full"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {displayName}
        </span>
      )}
    </span>
  );
}

// ソート可能な参加者アイテム
interface SortableParticipantItemProps {
  participant: DiscussionParticipant;
  index: number;
  customRoles: CustomRole[];
  disabled?: boolean;
  onUpdateRole: (id: string, role: ParticipantRole) => void;
  onRemove: (id: string) => void;
  getRoleInfo: (roleId: string | undefined) => { name: string; description?: string } | undefined;
}

function SortableParticipantItem({
  participant,
  index,
  customRoles,
  disabled,
  onUpdateRole,
  onRemove,
  getRoleInfo,
}: SortableParticipantItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: participant.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const roleInfo = getRoleInfo(participant.role);
  const isCustom = participant.role && isCustomRoleId(participant.role);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-1.5 bg-gray-800 rounded text-sm ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-blue-500' : ''
      }`}
    >
      {/* ドラッグハンドル */}
      <button
        type="button"
        className="p-0.5 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing disabled:opacity-50 disabled:cursor-not-allowed touch-none"
        disabled={disabled}
        {...attributes}
        {...listeners}
        title="ドラッグして順番を変更"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>
      <span className="text-gray-500 text-xs w-4">{index + 1}.</span>
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: participant.color }}
      />
      <ParticipantName displayName={participant.displayName} />
      {/* 役割選択 */}
      <select
        value={participant.role || 'neutral'}
        onChange={(e) => onUpdateRole(participant.id, e.target.value as ParticipantRole)}
        disabled={disabled}
        title={`${roleInfo?.name || '役割を選択'}${roleInfo?.description ? `: ${roleInfo.description}` : ''}`}
        className={`shrink-0 w-16 px-1 py-0.5 text-xs rounded border-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 cursor-pointer ${
          isCustom ? 'bg-purple-600/50 text-purple-200' : 'bg-gray-600 text-gray-200'
        }`}
      >
        <optgroup label="プリセット">
          {ROLE_PRESETS.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </optgroup>
        {customRoles.length > 0 && (
          <optgroup label="カスタム">
            {customRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </optgroup>
        )}
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
}

export function ParticipantList({
  participants,
  customRoles,
  disabled,
  onUpdateRole,
  onRemove,
  onReorder,
}: ParticipantListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (participants.length === 0) {
    return null;
  }

  // ロールの情報を取得
  const getRoleInfo = (roleId: string | undefined) => {
    if (!roleId) return ROLE_PRESETS.find((r) => r.id === 'neutral');
    if (isCustomRoleId(roleId)) {
      return customRoles.find((r) => r.id === roleId);
    }
    return ROLE_PRESETS.find((r) => r.id === roleId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = participants.findIndex((p) => p.id === active.id);
      const newIndex = participants.findIndex((p) => p.id === over.id);
      const newParticipants = arrayMove(participants, oldIndex, newIndex);
      onReorder(newParticipants);
    }
  };

  return (
    <div className="space-y-1 p-2 bg-gray-700/30 rounded-lg">
      <div className="text-xs text-gray-400 mb-1">参加者一覧（ドラッグで順番変更）</div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={participants.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {participants.map((participant, index) => (
              <SortableParticipantItem
                key={participant.id}
                participant={participant}
                index={index}
                customRoles={customRoles}
                disabled={disabled}
                onUpdateRole={onUpdateRole}
                onRemove={onRemove}
                getRoleInfo={getRoleInfo}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
