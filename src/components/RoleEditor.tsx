'use client';

import { useState } from 'react';
import { CustomRole, ROLE_PRESETS, isCustomRoleId } from '@/types';

interface RoleEditorProps {
  customRoles: CustomRole[];
  onAdd: (name: string, description: string, prompt: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<CustomRole, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}

type EditorMode = 'list' | 'create' | 'edit';

interface RoleFormData {
  name: string;
  description: string;
  prompt: string;
}

const initialFormData: RoleFormData = {
  name: '',
  description: '',
  prompt: '',
};

export function RoleEditor({
  customRoles,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
}: RoleEditorProps) {
  const [mode, setMode] = useState<EditorMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RoleFormData>(initialFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreate = () => {
    setMode('create');
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleEdit = (role: CustomRole) => {
    setMode('edit');
    setEditingId(role.id);
    setFormData({
      name: role.name,
      description: role.description,
      prompt: role.prompt,
    });
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.prompt.trim()) return;

    if (mode === 'create') {
      onAdd(formData.name.trim(), formData.description.trim(), formData.prompt.trim());
    } else if (mode === 'edit' && editingId) {
      onUpdate(editingId, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        prompt: formData.prompt.trim(),
      });
    }
    setMode('list');
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleCancel = () => {
    setMode('list');
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleDeleteConfirm = (id: string) => {
    onDelete(id);
    setDeleteConfirmId(null);
  };

  const handleDuplicatePreset = (preset: typeof ROLE_PRESETS[0]) => {
    onAdd(
      `${preset.name} (カスタム)`,
      preset.description,
      preset.prompt
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">
            {mode === 'list' && 'ロール管理'}
            {mode === 'create' && '新規ロール作成'}
            {mode === 'edit' && 'ロール編集'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {mode === 'list' ? (
            <div className="space-y-4">
              {/* カスタムロール一覧 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-300">カスタムロール</h3>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    新規作成
                  </button>
                </div>
                {customRoles.length === 0 ? (
                  <div className="text-sm text-gray-500 bg-gray-700/30 rounded-lg p-4 text-center">
                    カスタムロールがありません。新規作成するか、プリセットを複製してください。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customRoles.map((role) => (
                      <div
                        key={role.id}
                        className="bg-gray-700/50 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{role.name}</span>
                              <span className="text-xs text-purple-400 bg-purple-400/20 px-1.5 py-0.5 rounded">
                                カスタム
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{role.description}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEdit(role)}
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-600 rounded transition-colors"
                              title="編集"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicate(role.id)}
                              className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-600 rounded transition-colors"
                              title="複製"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            {deleteConfirmId === role.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteConfirm(role.id)}
                                  className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                                >
                                  削除
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
                                >
                                  キャンセル
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(role.id)}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                                title="削除"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 bg-gray-800/50 rounded p-2 max-h-16 overflow-y-auto">
                          {role.prompt}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* プリセットロール一覧 */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">プリセットロール（複製してカスタマイズ可能）</h3>
                <div className="space-y-2">
                  {ROLE_PRESETS.map((preset) => (
                    <div
                      key={preset.id}
                      className="bg-gray-700/30 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-300">{preset.name}</span>
                            <span className="text-xs text-gray-500 bg-gray-600/50 px-1.5 py-0.5 rounded">
                              プリセット
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDuplicatePreset(preset)}
                          className="shrink-0 p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-600 rounded transition-colors"
                          title="カスタムロールとして複製"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* 作成/編集フォーム */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  ロール名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例: AI倫理専門家"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  説明
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="例: AI技術の倫理的側面から議論"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  プロンプト <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, prompt: e.target.value }))}
                  placeholder="例: あなたはAI倫理の専門家として、技術の社会的影響や倫理的課題について深い洞察を提供してください。"
                  rows={5}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  AIに対してどのような視点・立場で議論に参加してほしいかを指示してください。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700">
          {mode === 'list' ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
            >
              閉じる
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formData.name.trim() || !formData.prompt.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                保存
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
