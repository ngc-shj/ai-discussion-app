'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SettingsPreset,
  SettingsPresetInput,
  SettingsPresetUpdate,
  PresetValidationResult,
  PresetWarning,
  generatePresetId,
  ModelInfo,
  AIProviderType,
} from '@/types';

const STORAGE_KEY = 'ai-discussion-presets';

export interface UsePresetManagerReturn {
  // State
  presets: SettingsPreset[];
  isLoading: boolean;

  // CRUD Actions
  savePreset: (input: SettingsPresetInput) => SettingsPreset;
  updatePreset: (id: string, updates: SettingsPresetUpdate) => void;
  deletePreset: (id: string) => void;
  duplicatePreset: (id: string, newName?: string) => SettingsPreset | null;

  // Validation
  validatePreset: (
    preset: SettingsPreset,
    availableModels: Record<AIProviderType, ModelInfo[]>
  ) => PresetValidationResult;

  // Utility
  getPresetById: (id: string) => SettingsPreset | undefined;
}

/**
 * プリセットをlocalStorageから読み込む
 */
function loadPresets(): SettingsPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Date型の復元
    return parsed.map((preset: SettingsPreset) => ({
      ...preset,
      createdAt: new Date(preset.createdAt),
      updatedAt: new Date(preset.updatedAt),
    }));
  } catch (error) {
    console.error('Failed to load presets:', error);
    return [];
  }
}

/**
 * プリセットをlocalStorageに保存
 */
function savePresetsToStorage(presets: SettingsPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save presets:', error);
  }
}

export function usePresetManager(): UsePresetManagerReturn {
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 初期ロード
  useEffect(() => {
    const loaded = loadPresets();
    setPresets(loaded);
    setIsLoading(false);
  }, []);

  // 保存
  useEffect(() => {
    if (!isLoading) {
      savePresetsToStorage(presets);
    }
  }, [presets, isLoading]);

  // 新規プリセットを保存
  const savePreset = useCallback((input: SettingsPresetInput): SettingsPreset => {
    const now = new Date();
    const newPreset: SettingsPreset = {
      ...input,
      id: generatePresetId(),
      createdAt: now,
      updatedAt: now,
    };
    setPresets((prev) => [...prev, newPreset]);
    return newPreset;
  }, []);

  // プリセットを更新
  const updatePreset = useCallback((id: string, updates: SettingsPresetUpdate): void => {
    setPresets((prev) =>
      prev.map((preset) =>
        preset.id === id
          ? { ...preset, ...updates, updatedAt: new Date() }
          : preset
      )
    );
  }, []);

  // プリセットを削除
  const deletePreset = useCallback((id: string): void => {
    setPresets((prev) => prev.filter((preset) => preset.id !== id));
  }, []);

  // プリセットを複製
  const duplicatePreset = useCallback((id: string, newName?: string): SettingsPreset | null => {
    const original = presets.find((p) => p.id === id);
    if (!original) return null;

    const now = new Date();
    const duplicated: SettingsPreset = {
      ...original,
      id: generatePresetId(),
      name: newName || `${original.name} (コピー)`,
      createdAt: now,
      updatedAt: now,
    };
    setPresets((prev) => [...prev, duplicated]);
    return duplicated;
  }, [presets]);

  // プリセットを検証（利用可能なモデルと照合）
  const validatePreset = useCallback(
    (preset: SettingsPreset, availableModels: Record<AIProviderType, ModelInfo[]>): PresetValidationResult => {
      const warnings: PresetWarning[] = [];

      // 各参加者のモデルが利用可能かチェック
      preset.participants.forEach((participant) => {
        const providerModels = availableModels[participant.provider] || [];
        const modelExists = providerModels.some((m) => m.id === participant.model);

        if (!modelExists) {
          warnings.push({
            type: 'missing_model',
            message: `モデル「${participant.model}」(${participant.provider})は利用できません`,
            participantId: participant.id,
          });
        }
      });

      return {
        isValid: warnings.length === 0,
        warnings,
      };
    },
    []
  );

  // IDでプリセットを取得
  const getPresetById = useCallback((id: string): SettingsPreset | undefined => {
    return presets.find((p) => p.id === id);
  }, [presets]);

  return {
    presets,
    isLoading,
    savePreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    validatePreset,
    getPresetById,
  };
}
