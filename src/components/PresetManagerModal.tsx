'use client';

import { useState } from 'react';
import { SettingsPreset, PresetValidationResult } from '@/types';

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
  const [activeTab, setActiveTab] = useState<'load' | 'save'>('load');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!newPresetName.trim()) return;
    onSaveCurrentAsPreset(newPresetName.trim(), newPresetDescription.trim() || undefined);
    setNewPresetName('');
    setNewPresetDescription('');
    setActiveTab('load');
  };

  const handleLoad = () => {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (preset) {
      onLoadPreset(preset);
      onClose();
    }
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
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            設定プリセット
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-700 shrink-0">
          <button
            onClick={() => setActiveTab('load')}
            className={`flex-1 py-2 px-4 text-sm transition-colors ${
              activeTab === 'load'
                ? 'bg-gray-700 text-white border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            読み込み ({presets.length})
          </button>
          <button
            onClick={() => setActiveTab('save')}
            className={`flex-1 py-2 px-4 text-sm transition-colors ${
              activeTab === 'save'
                ? 'bg-gray-700 text-white border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            新規保存
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {activeTab === 'load' ? (
            /* Load Tab */
            <div className="space-y-2">
              {presets.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  保存されたプリセットがありません
                </div>
              ) : (
                presets.map((preset) => (
                  <PresetListItem
                    key={preset.id}
                    preset={preset}
                    isSelected={selectedPresetId === preset.id}
                    isEditing={editingId === preset.id}
                    editName={editName}
                    onSelect={() => setSelectedPresetId(preset.id)}
                    onEditNameChange={setEditName}
                    onStartEdit={() => handleStartEdit(preset)}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={() => onDeletePreset(preset.id)}
                    onDuplicate={() => onDuplicatePreset(preset.id)}
                  />
                ))
              )}
            </div>
          ) : (
            /* Save Tab */
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">プリセット名</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="例: ブレスト用設定"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">説明（任意）</label>
                <textarea
                  value={newPresetDescription}
                  onChange={(e) => setNewPresetDescription(e.target.value)}
                  placeholder="このプリセットの説明..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                />
              </div>
              <div className="text-xs text-gray-500">
                現在の設定がすべて保存されます：参加者、議論モード、深さ、終了条件、検索設定、プロファイル
              </div>
            </div>
          )}
        </div>

        {/* Validation Warnings */}
        {activeTab === 'load' && validation && !validation.isValid && (
          <div className="mx-4 mb-2 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg shrink-0">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-xs text-yellow-300">
                {validation.warnings.map((w, i) => (
                  <div key={i}>{w.message}</div>
                ))}
                <div className="mt-1 text-yellow-400/70">
                  利用できないモデルは読み込み時にスキップされます
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            キャンセル
          </button>
          {activeTab === 'load' ? (
            <button
              onClick={handleLoad}
              disabled={!selectedPresetId}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              読み込む
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!newPresetName.trim()}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
          )}
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
  onSelect: () => void;
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
  onSelect,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onDuplicate,
}: PresetListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);

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
            </div>

            {/* Menu Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-opacity"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>

          {/* Dropdown Menu */}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div className="absolute right-2 top-10 z-10 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 min-w-[120px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                >
                  名前を変更
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                >
                  複製
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-600 hover:text-red-300"
                >
                  削除
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
