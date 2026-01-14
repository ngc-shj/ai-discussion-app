'use client';

import { useState, useEffect } from 'react';
import { SettingsPreset, PresetValidationResult, DISCUSSION_MODE_PRESETS, DISCUSSION_DEPTH_PRESETS } from '@/types';

interface PresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: SettingsPreset[];
  onLoadPreset: (preset: SettingsPreset) => void;
  onSaveCurrentAsPreset: (name: string, description?: string) => void;
  onRenamePreset: (id: string, newName: string) => void;
  onDeletePreset: (id: string) => void;
  onDuplicatePreset: (id: string) => void;
  validatePreset: (preset: SettingsPreset) => PresetValidationResult;
}

export function PresetManagerModal({
  isOpen,
  onClose,
  presets,
  onLoadPreset,
  onSaveCurrentAsPreset,
  onRenamePreset,
  onDeletePreset,
  onDuplicatePreset,
  validatePreset,
}: PresetManagerModalProps) {
  const [isSaveExpanded, setIsSaveExpanded] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

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

  const handleSave = () => {
    if (!newPresetName.trim()) return;
    onSaveCurrentAsPreset(newPresetName.trim(), newPresetDescription.trim() || undefined);
    setNewPresetName('');
    setNewPresetDescription('');
    setIsSaveExpanded(false);
  };

  const handleLoad = (preset: SettingsPreset) => {
    onLoadPreset(preset);
    onClose();
  };

  const handleStartEdit = (preset: SettingsPreset) => {
    setEditingId(preset.id);
    setEditName(preset.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenamePreset(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);
  const validation = selectedPreset ? validatePreset(selectedPreset) : null;

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
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              議論プリセットの管理
            </h2>
            <p className="text-xs text-gray-400 mt-1 ml-7">AI参加者・議論モード・深さ・終了条件・検索設定を保存</p>
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
          {/* 新規保存アコーディオン（固定） */}
          <div className="p-4 pb-2 shrink-0">
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSaveExpanded(!isSaveExpanded)}
                className="w-full flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isSaveExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-medium text-white">新規保存</span>
                </div>
                <span className="text-xs text-gray-500">現在の設定を保存</span>
              </button>

              {isSaveExpanded && (
                <div className="p-3 border-t border-gray-700 space-y-3 bg-gray-900/30">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">プリセット名</label>
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="例: ブレインストーミング用"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">説明（任意）</label>
                    <input
                      type="text"
                      value={newPresetDescription}
                      onChange={(e) => setNewPresetDescription(e.target.value)}
                      placeholder="このプリセットの説明..."
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSaveExpanded(false);
                        setNewPresetName('');
                        setNewPresetDescription('');
                      }}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!newPresetName.trim()}
                      className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      保存
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 保存済みプリセットラベル（固定） */}
          <div className="px-4 pt-2 pb-1 shrink-0">
            <div className="text-xs text-gray-500 flex items-center justify-between">
              <span>保存済みプリセット</span>
              <span>{presets.length}件</span>
            </div>
          </div>

          {/* 保存済みプリセット一覧（スクロール領域） */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              {presets.length === 0 ? (
                <div className="text-center text-gray-500 py-8 border border-dashed border-gray-700 rounded-lg">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm">保存されたプリセットがありません</p>
                  <p className="text-xs mt-1">上の「新規保存」から作成してください</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {presets.map((preset) => (
                    <PresetListItem
                      key={preset.id}
                      preset={preset}
                      isSelected={selectedPresetId === preset.id}
                      isEditing={editingId === preset.id}
                      editName={editName}
                      validation={selectedPresetId === preset.id ? validation : null}
                      onSelect={() => setSelectedPresetId(selectedPresetId === preset.id ? null : preset.id)}
                      onLoad={() => handleLoad(preset)}
                      onEditNameChange={setEditName}
                      onStartEdit={() => handleStartEdit(preset)}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={() => setEditingId(null)}
                      onDelete={() => onDeletePreset(preset.id)}
                      onDuplicate={() => onDuplicatePreset(preset.id)}
                    />
                  ))}
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

// Sub-component for preset list item
interface PresetListItemProps {
  preset: SettingsPreset;
  isSelected: boolean;
  isEditing: boolean;
  editName: string;
  validation: PresetValidationResult | null;
  onSelect: () => void;
  onLoad: () => void;
  onEditNameChange: (name: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function PresetListItem({
  preset,
  isSelected,
  isEditing,
  editName,
  validation,
  onSelect,
  onLoad,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onDuplicate,
}: PresetListItemProps) {
  return (
    <div
      className={`group relative p-3 rounded-lg border transition-colors cursor-pointer ${
        isSelected
          ? 'bg-indigo-900/30 border-indigo-500'
          : 'bg-gray-900/30 border-gray-700 hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveEdit();
            if (e.key === 'Escape') onCancelEdit();
          }}
          onBlur={onSaveEdit}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:outline-none focus:border-indigo-500"
          placeholder="プリセット名を入力"
          aria-label="プリセット名"
          autoFocus
        />
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{preset.name}</div>
              {preset.description && (
                <div className="text-xs text-gray-500 mt-0.5 truncate">{preset.description}</div>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span>{preset.participants.length}人参加</span>
                <span>|</span>
                <span>{new Date(preset.updatedAt).toLocaleDateString('ja-JP')}</span>
              </div>

              {/* 選択時に詳細表示 */}
              {isSelected && (
                <div className="mt-2 pt-2 border-t border-indigo-500/30 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {preset.participants.map((p, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-gray-700/50 rounded text-xs text-gray-300">
                        {p.model || '不明'}
                        {p.displayRoleName && <span className="text-indigo-400 ml-1">({p.displayRoleName})</span>}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      {DISCUSSION_MODE_PRESETS.find(m => m.id === preset.discussionMode)?.name || preset.discussionMode}
                    </span>
                    <span>|</span>
                    <span>
                      深さ: {DISCUSSION_DEPTH_PRESETS.find(d => d.level === preset.discussionDepth)?.name || preset.discussionDepth}
                    </span>
                    <span>|</span>
                    <span>{preset.searchConfig?.enabled ? '検索ON' : '検索OFF'}</span>
                  </div>

                  {/* Validation Warnings */}
                  {validation && !validation.isValid && (
                    <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-300">
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          {validation.warnings.map((w, i) => (
                            <div key={i}>{w.message}</div>
                          ))}
                          <div className="mt-0.5 text-yellow-400/70">
                            利用できないモデルは読み込み時にスキップされます
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoad();
                      }}
                      className="flex-1 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                    >
                      読み込む
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartEdit();
                      }}
                      className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    >
                      名前変更
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate();
                      }}
                      className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    >
                      複製
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Expand indicator (when not selected) */}
            {!isSelected && (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        </>
      )}
    </div>
  );
}
