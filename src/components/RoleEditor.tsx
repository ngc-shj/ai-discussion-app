'use client';

import { useState, useEffect } from 'react';
import { CustomRole, ROLE_PRESETS } from '@/types';

interface RoleEditorProps {
  isOpen: boolean;
  customRoles: CustomRole[];
  onAdd: (name: string, description: string, prompt: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<CustomRole, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}

export function RoleEditor({
  isOpen,
  customRoles,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
}: RoleEditorProps) {
  const [isCreateExpanded, setIsCreateExpanded] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', description: '', prompt: '' });

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

  // モーダルを閉じたときに状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setIsCreateExpanded(false);
      setNewName('');
      setNewDescription('');
      setNewPrompt('');
      setSelectedRoleId(null);
      setSelectedPresetId(null);
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    onAdd(newName.trim(), newDescription.trim(), newPrompt.trim());
    setNewName('');
    setNewDescription('');
    setNewPrompt('');
    setIsCreateExpanded(false);
  };

  const handleStartEdit = (role: CustomRole) => {
    setEditingId(role.id);
    setEditData({
      name: role.name,
      description: role.description,
      prompt: role.prompt,
    });
  };

  const handleSaveEdit = () => {
    if (editingId && editData.name.trim() && editData.prompt.trim()) {
      onUpdate(editingId, {
        name: editData.name.trim(),
        description: editData.description.trim(),
        prompt: editData.prompt.trim(),
      });
    }
    setEditingId(null);
    setEditData({ name: '', description: '', prompt: '' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({ name: '', description: '', prompt: '' });
  };

  const handleDuplicatePreset = (preset: typeof ROLE_PRESETS[0]) => {
    onAdd(
      `${preset.name} (カスタム)`,
      preset.description,
      preset.prompt
    );
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              ロール管理
            </h2>
            <p className="text-xs text-gray-400 mt-1 ml-7">カスタムロールの作成・編集</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 新規作成アコーディオン */}
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsCreateExpanded(!isCreateExpanded)}
                className="w-full flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isCreateExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-medium text-white">新規作成</span>
                </div>
                <span className="text-xs text-gray-500">カスタムロールを追加</span>
              </button>

              {isCreateExpanded && (
                <div className="p-3 border-t border-gray-700 space-y-3 bg-gray-900/30">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">ロール名 <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="例: AI倫理専門家"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">説明</label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="例: AI技術の倫理的側面から議論"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">プロンプト <span className="text-red-400">*</span></label>
                    <textarea
                      value={newPrompt}
                      onChange={(e) => setNewPrompt(e.target.value)}
                      placeholder="例: あなたはAI倫理の専門家として、技術の社会的影響や倫理的課題について深い洞察を提供してください。"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateExpanded(false);
                        setNewName('');
                        setNewDescription('');
                        setNewPrompt('');
                      }}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!newName.trim() || !newPrompt.trim()}
                      className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      作成
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* カスタムロール + プリセットロール（1つのスクロール領域） */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* カスタムロールセクション */}
            <div className="pb-3">
              <div className="text-xs text-gray-500 flex items-center justify-between mb-2">
                <span>カスタムロール</span>
                <span>{customRoles.length}件</span>
              </div>
              <div className="space-y-2">
                {customRoles.length === 0 ? (
                  <div className="text-center text-gray-500 py-6 border border-dashed border-gray-700 rounded-lg">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-sm">カスタムロールがありません</p>
                    <p className="text-xs mt-1">上の「新規作成」またはプリセットを複製してください</p>
                  </div>
                ) : (
                  customRoles.map((role) => (
                    <RoleListItem
                      key={role.id}
                      role={role}
                      isSelected={selectedRoleId === role.id}
                      isEditing={editingId === role.id}
                      editData={editData}
                      onSelect={() => setSelectedRoleId(selectedRoleId === role.id ? null : role.id)}
                      onEditDataChange={setEditData}
                      onStartEdit={() => handleStartEdit(role)}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                      onDelete={() => onDelete(role.id)}
                      onDuplicate={() => onDuplicate(role.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* プリセットロールセクション（タブ形式） */}
            <div className="pt-3 border-t border-gray-700">
              <div className="text-xs text-gray-500 mb-2">プリセットロール</div>

              {/* タブボタン（横並び・折り返し） */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(selectedPresetId === preset.id ? null : preset.id)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                      selectedPresetId === preset.id
                        ? 'bg-gray-600 border-gray-500 text-white'
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* 選択されたプリセットの詳細表示エリア */}
              {selectedPresetId && (() => {
                const selectedPreset = ROLE_PRESETS.find(p => p.id === selectedPresetId);
                if (!selectedPreset) return null;
                return (
                  <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-white">{selectedPreset.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{selectedPreset.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDuplicatePreset(selectedPreset)}
                        className="shrink-0 p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                        title="カスタムとして複製"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {selectedPreset.prompt}
                    </div>
                  </div>
                );
              })()}

              {/* 未選択時のプレースホルダー */}
              {!selectedPresetId && (
                <div className="p-3 bg-gray-900/30 border border-dashed border-gray-700 rounded-lg text-center">
                  <p className="text-xs text-gray-500">プリセットを選択すると詳細が表示されます</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-component for role list item
interface RoleListItemProps {
  role: CustomRole;
  isSelected: boolean;
  isEditing: boolean;
  editData: { name: string; description: string; prompt: string };
  onSelect: () => void;
  onEditDataChange: (data: { name: string; description: string; prompt: string }) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function RoleListItem({
  role,
  isSelected,
  isEditing,
  editData,
  onSelect,
  onEditDataChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onDuplicate,
}: RoleListItemProps) {
  if (isEditing) {
    return (
      <div className="p-3 rounded-lg border bg-purple-900/30 border-purple-500 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">ロール名 <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={editData.name}
            onChange={(e) => onEditDataChange({ ...editData, name: e.target.value })}
            placeholder="ロール名を入力"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">説明</label>
          <input
            type="text"
            value={editData.description}
            onChange={(e) => onEditDataChange({ ...editData, description: e.target.value })}
            placeholder="説明を入力（任意）"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">プロンプト <span className="text-red-400">*</span></label>
          <textarea
            value={editData.prompt}
            onChange={(e) => onEditDataChange({ ...editData, prompt: e.target.value })}
            placeholder="プロンプトを入力"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSaveEdit}
            disabled={!editData.name.trim() || !editData.prompt.trim()}
            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative p-3 rounded-lg border transition-colors cursor-pointer ${
        isSelected
          ? 'bg-purple-900/30 border-purple-500'
          : 'bg-gray-900/30 border-gray-700 hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{role.name}</span>
            <span className="text-xs text-purple-400 bg-purple-400/20 px-1.5 py-0.5 rounded">
              カスタム
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{role.description || '説明なし'}</div>

          {/* 選択時に詳細表示 */}
          {isSelected && (
            <div className="mt-2 pt-2 border-t border-purple-500/30">
              <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                {role.prompt}
              </div>
            </div>
          )}
        </div>

        {/* 常にアイコンボタンを表示 */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded transition-colors"
            title="編集"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
            title="複製"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
            title="削除"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
