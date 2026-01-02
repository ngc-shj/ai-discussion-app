'use client';

import { useState, useCallback } from 'react';
import {
  AIProviderType,
  ModelInfo,
  DiscussionParticipant,
  ParticipantRole,
  generateParticipantId,
} from '@/types';

// 最新モデルの数（各プロバイダーごと）
export const LATEST_MODEL_COUNT = 5;

export interface UseAISelectorProps {
  participants: DiscussionParticipant[];
  onParticipantsChange: (participants: DiscussionParticipant[]) => void;
}

export interface UseAISelectorReturn {
  // State
  expandedProviders: Record<AIProviderType, boolean>;
  showAllModels: boolean;

  // Actions
  toggleExpanded: (providerId: AIProviderType) => void;
  setShowAllModels: (value: boolean) => void;
  addParticipant: (
    provider: AIProviderType,
    model: string,
    displayName: string,
    color: string,
    role?: ParticipantRole
  ) => void;
  removeParticipant: (id: string) => void;
  updateParticipantRole: (id: string, role: ParticipantRole) => void;

  // Utilities
  getParticipantCountForModel: (provider: AIProviderType, model: string) => number;
  getFilteredModels: (models: ModelInfo[]) => ModelInfo[];
  getSelectedCountForProvider: (providerId: AIProviderType) => number;
}

export function useAISelector({
  participants,
  onParticipantsChange,
}: UseAISelectorProps): UseAISelectorReturn {
  const [expandedProviders, setExpandedProviders] = useState<Record<AIProviderType, boolean>>({
    claude: true,
    ollama: true,
    openai: true,
    gemini: true,
  });
  const [showAllModels, setShowAllModels] = useState(false);

  const toggleExpanded = useCallback((providerId: AIProviderType) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  }, []);

  // 参加者を追加（同一モデルでも複数追加可能）
  const addParticipant = useCallback(
    (
      provider: AIProviderType,
      model: string,
      displayName: string,
      color: string,
      role: ParticipantRole = 'neutral'
    ) => {
      const newParticipant: DiscussionParticipant = {
        id: generateParticipantId(),
        provider,
        model,
        displayName,
        color,
        role,
      };
      onParticipantsChange([...participants, newParticipant]);
    },
    [participants, onParticipantsChange]
  );

  // 参加者を削除（IDで識別）
  const removeParticipant = useCallback(
    (id: string) => {
      onParticipantsChange(participants.filter((p) => p.id !== id));
    },
    [participants, onParticipantsChange]
  );

  // 参加者の役割を更新（IDで識別）
  const updateParticipantRole = useCallback(
    (id: string, role: ParticipantRole) => {
      onParticipantsChange(
        participants.map((p) => (p.id === id ? { ...p, role } : p))
      );
    },
    [participants, onParticipantsChange]
  );

  // 特定モデルの参加者数を取得
  const getParticipantCountForModel = useCallback(
    (provider: AIProviderType, model: string) => {
      return participants.filter((p) => p.provider === provider && p.model === model).length;
    },
    [participants]
  );

  const getFilteredModels = useCallback(
    (models: ModelInfo[]) => {
      if (showAllModels) return models;
      return models.slice(0, LATEST_MODEL_COUNT);
    },
    [showAllModels]
  );

  const getSelectedCountForProvider = useCallback(
    (providerId: AIProviderType) => {
      return participants.filter((p) => p.provider === providerId).length;
    },
    [participants]
  );

  return {
    expandedProviders,
    showAllModels,
    toggleExpanded,
    setShowAllModels,
    addParticipant,
    removeParticipant,
    updateParticipantRole,
    getParticipantCountForModel,
    getFilteredModels,
    getSelectedCountForProvider,
  };
}
