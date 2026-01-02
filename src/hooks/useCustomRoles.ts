'use client';

import { useState, useEffect, useCallback } from 'react';
import { CustomRole, generateCustomRoleId, isCustomRoleId, ROLE_PRESETS, RolePreset } from '@/types';

const STORAGE_KEY = 'ai-discussion-custom-roles';

export interface UseCustomRolesReturn {
  // State
  customRoles: CustomRole[];
  isLoading: boolean;

  // Actions
  addCustomRole: (name: string, description: string, prompt: string) => CustomRole;
  updateCustomRole: (id: string, updates: Partial<Omit<CustomRole, 'id' | 'createdAt'>>) => void;
  deleteCustomRole: (id: string) => void;
  duplicateCustomRole: (id: string) => CustomRole | null;

  // Utilities
  getRole: (roleId: string) => RolePreset | CustomRole | undefined;
  getRolePrompt: (roleId: string) => string | undefined;
  getAllRoles: () => (RolePreset | CustomRole)[];
}

/**
 * カスタムロールをlocalStorageから読み込む
 */
function loadCustomRoles(): CustomRole[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Date型の復元
    return parsed.map((role: CustomRole) => ({
      ...role,
      createdAt: new Date(role.createdAt),
      updatedAt: new Date(role.updatedAt),
    }));
  } catch (error) {
    console.error('Failed to load custom roles:', error);
    return [];
  }
}

/**
 * カスタムロールをlocalStorageに保存
 */
function saveCustomRoles(roles: CustomRole[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
  } catch (error) {
    console.error('Failed to save custom roles:', error);
  }
}

export function useCustomRoles(): UseCustomRolesReturn {
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 初期ロード
  useEffect(() => {
    const roles = loadCustomRoles();
    setCustomRoles(roles);
    setIsLoading(false);
  }, []);

  // 保存
  useEffect(() => {
    if (!isLoading) {
      saveCustomRoles(customRoles);
    }
  }, [customRoles, isLoading]);

  // カスタムロールを追加
  const addCustomRole = useCallback((name: string, description: string, prompt: string): CustomRole => {
    const now = new Date();
    const newRole: CustomRole = {
      id: generateCustomRoleId(),
      name,
      description,
      prompt,
      createdAt: now,
      updatedAt: now,
    };
    setCustomRoles((prev) => [...prev, newRole]);
    return newRole;
  }, []);

  // カスタムロールを更新
  const updateCustomRole = useCallback((id: string, updates: Partial<Omit<CustomRole, 'id' | 'createdAt'>>): void => {
    setCustomRoles((prev) =>
      prev.map((role) =>
        role.id === id
          ? { ...role, ...updates, updatedAt: new Date() }
          : role
      )
    );
  }, []);

  // カスタムロールを削除
  const deleteCustomRole = useCallback((id: string): void => {
    setCustomRoles((prev) => prev.filter((role) => role.id !== id));
  }, []);

  // カスタムロールを複製
  const duplicateCustomRole = useCallback((id: string): CustomRole | null => {
    const original = customRoles.find((role) => role.id === id);
    if (!original) return null;

    const now = new Date();
    const newRole: CustomRole = {
      id: generateCustomRoleId(),
      name: `${original.name} (コピー)`,
      description: original.description,
      prompt: original.prompt,
      createdAt: now,
      updatedAt: now,
    };
    setCustomRoles((prev) => [...prev, newRole]);
    return newRole;
  }, [customRoles]);

  // ロールを取得（プリセット or カスタム）
  const getRole = useCallback((roleId: string): RolePreset | CustomRole | undefined => {
    if (isCustomRoleId(roleId)) {
      return customRoles.find((role) => role.id === roleId);
    }
    return ROLE_PRESETS.find((preset) => preset.id === roleId);
  }, [customRoles]);

  // ロールのプロンプトを取得
  const getRolePrompt = useCallback((roleId: string): string | undefined => {
    const role = getRole(roleId);
    return role?.prompt;
  }, [getRole]);

  // すべてのロール（プリセット + カスタム）を取得
  const getAllRoles = useCallback((): (RolePreset | CustomRole)[] => {
    return [...ROLE_PRESETS, ...customRoles];
  }, [customRoles]);

  return {
    customRoles,
    isLoading,
    addCustomRole,
    updateCustomRole,
    deleteCustomRole,
    duplicateCustomRole,
    getRole,
    getRolePrompt,
    getAllRoles,
  };
}
