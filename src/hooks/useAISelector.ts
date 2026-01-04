'use client';

import { useState, useCallback } from 'react';
import {
  AIProviderType,
  ModelInfo,
  DiscussionParticipant,
  ParticipantRole,
  generateParticipantId,
  ROLE_PRESETS,
} from '@/types';

// 最新モデルの数（各プロバイダーごと）
export const LATEST_MODEL_COUNT = 5;

// モデルフィルタの種類
export type ModelFilterType = 'latest-generation' | 'latest-5' | 'all';

// --- モデル分類定義 ---
// GPT系のtier（優先度順）: o はoシリーズ（推論特化）、pro は高性能版
const GPT_TIERS = ['pro', 'o', 'oss'] as const;
// GPT系の機能モデル
const GPT_FUNCTIONS = ['audio', 'realtime', 'image', 'transcribe', 'tts', 'search', 'codex', 'deep-research'] as const;

// Gemini系のtier（優先度順、長いものを先に）
const GEMINI_TIERS = ['flash-lite', 'flash', 'pro'] as const;
// Gemini系の機能モデル
const GEMINI_FUNCTIONS = ['image', 'tts', 'audio'] as const;

// Claude系のtier（優先度順）
const CLAUDE_TIERS = ['opus', 'sonnet', 'haiku'] as const;

// モデルファミリーを抽出する関数
// 同じファミリー内で最新版のみ残すためのグループ化キーを返す
function extractModelFamily(modelId: string): string {
  const id = modelId.toLowerCase();

  // Ollama/ローカルモデル: コロンがある場合はその前の部分をファミリーとして使用
  // 例: deepseek-r1:8b -> deepseek-r1, llama3.2:7b -> llama3.2
  if (id.includes(':')) {
    return id.split(':')[0];
  }

  // 正規化処理
  let normalized = id
    // 末尾の日付を除去
    .replace(/-\d{8,}$/, '') // -20250514 形式
    .replace(/-\d{4}-\d{2}-\d{2}$/, '') // -2025-05-23 形式
    // latest, preview などのサフィックスを除去
    .replace(/-(latest|preview|experimental)$/, '')
    // スペースをハイフンに統一
    .replace(/\s+/g, '-');

  // Claude 3.x系の古いフォーマットを正規化
  // claude-3-7-sonnet -> claude-sonnet, claude-3-opus -> claude-opus
  const claude3Match = normalized.match(/^claude-(\d+(?:-\d+)?)-([a-z]+)$/);
  if (claude3Match) {
    return `claude-${claude3Match[2]}`;
  }

  // Sora系: 動画生成モデル
  // sora-2, sora-2-pro -> sora
  if (normalized.startsWith('sora-')) {
    return 'sora';
  }

  // GPT系: tier と機能の組み合わせ
  if (normalized.startsWith('gpt-')) {
    // tier を抽出
    // - gpt-4o, gpt-4o-mini のような "数字+o" パターン
    // - gpt-5-pro, gpt-oss-20b のような "-tier" パターン
    let tier: string | null = null;
    if (normalized.match(/^gpt-\d+o(?:-|$)/)) {
      tier = 'o';
    } else {
      const tierPattern = new RegExp(`-(${GPT_TIERS.join('|')})(?:-|$)`);
      const tierMatch = normalized.match(tierPattern);
      tier = tierMatch ? tierMatch[1] : null;
    }

    // 機能を抽出
    const funcPattern = new RegExp(`-(${GPT_FUNCTIONS.join('|')})(?:-|$)`);
    const funcMatch = normalized.match(funcPattern);
    const func = funcMatch ? funcMatch[1] : null;

    // 組み合わせで分類
    if (tier && func) {
      return `gpt-${tier}-${func}`;
    }
    if (func) {
      return `gpt-${func}`;
    }
    if (tier) {
      return `gpt-${tier}`;
    }
    return 'gpt';
  }

  // oシリーズ: GPT-4oの推論特化版（gpt-o として扱う）
  if (normalized.match(/^o\d+/)) {
    // 機能を抽出
    const funcPattern = new RegExp(`-(${GPT_FUNCTIONS.join('|')})(?:-|$)`);
    const funcMatch = normalized.match(funcPattern);
    if (funcMatch) {
      return `gpt-o-${funcMatch[1]}`;
    }
    return 'gpt-o';
  }

  // Gemini系: tier と機能の組み合わせ
  if (normalized.startsWith('gemini-') || normalized === 'gemini') {
    // tier を抽出
    const tierPattern = new RegExp(`-(${GEMINI_TIERS.join('|')})(?:-|$)`);
    const tierMatch = normalized.match(tierPattern);
    const tier = tierMatch ? tierMatch[1] : null;

    // 機能を抽出
    const funcPattern = new RegExp(`-(${GEMINI_FUNCTIONS.join('|')})(?:-|$)`);
    const funcMatch = normalized.match(funcPattern);
    const func = funcMatch ? funcMatch[1] : null;

    // 組み合わせで分類
    if (tier && func) {
      return `gemini-${tier}-${func}`;
    }
    if (tier) {
      return `gemini-${tier}`;
    }
    if (func) {
      return `gemini-${func}`;
    }
    return 'gemini';
  }

  // Claude系: tier を抽出
  // claude-opus-4-5, claude-3-opus -> claude-opus
  // claude-sonnet-4, claude-3-7-sonnet -> claude-sonnet
  if (normalized.startsWith('claude-') || normalized === 'claude') {
    const tierPattern = new RegExp(`-(${CLAUDE_TIERS.join('|')})(?:-|$)`);
    const tierMatch = normalized.match(tierPattern);
    if (tierMatch) {
      return `claude-${tierMatch[1]}`;
    }
    return 'claude';
  }

  // Gemma系: gemma-version -> gemma-version
  if (normalized.startsWith('gemma-')) {
    // gemma-3n-e4b-it -> gemma-3n, gemma-3-4b -> gemma-3
    const gemmaMatch = normalized.match(/^gemma-(\d+n?)/);
    if (gemmaMatch) {
      return `gemma-${gemmaMatch[1]}`;
    }
  }

  return normalized;
}

// ファミリー名のソート用優先度を取得
function getFamilySortKey(family: string): string {
  // GPT系: gpt で始まるファミリー（性能順）
  if (family === 'gpt' || family.startsWith('gpt-')) {
    // tier の優先度（性能順）
    if (family === 'gpt-pro' || family.startsWith('gpt-pro-')) return `A00${family}`;
    if (family === 'gpt') return 'A01gpt';
    if (family === 'gpt-o' || family.startsWith('gpt-o-')) return `A02${family}`;
    if (family === 'gpt-oss' || family.startsWith('gpt-oss-')) return `A03${family}`;
    // 機能モデル（アルファベット順）
    return `A09${family}`;
  }

  // sora（動画生成）
  if (family === 'sora') {
    return 'A10';
  }

  // claude- で始まるファミリー
  if (family.startsWith('claude-')) {
    for (let i = 0; i < CLAUDE_TIERS.length; i++) {
      if (family.includes(CLAUDE_TIERS[i])) {
        return `B${i}${family}`;
      }
    }
    return 'B9' + family;
  }

  // gemini系: tier優先度（性能順: pro > flash > flash-lite）
  if (family === 'gemini' || family.startsWith('gemini-')) {
    // pro系（最高性能）
    if (family === 'gemini-pro' || family.startsWith('gemini-pro-')) return `C00${family}`;
    // flash系（高速）
    if (family === 'gemini-flash' || family.startsWith('gemini-flash-') && !family.includes('flash-lite')) return `C01${family}`;
    // flash-lite系（軽量）
    if (family.includes('flash-lite')) return `C02${family}`;
    // その他
    return `C09${family}`;
  }

  // gemma- で始まるファミリー
  if (family.startsWith('gemma-')) {
    return 'D' + family;
  }

  // その他（アルファベット順）
  return 'Z' + family;
}

// 最新世代のみをフィルタリング
function filterLatestGeneration(models: ModelInfo[]): ModelInfo[] {
  const familyMap = new Map<string, ModelInfo>();

  // 各モデルをファミリーごとにグループ化し、最初のもの（最新）を保持
  // ※ APIからのモデルは既に新しい順にソートされている前提
  for (const model of models) {
    const family = extractModelFamily(model.id);
    if (!familyMap.has(family)) {
      familyMap.set(family, model);
    }
  }

  // ファミリー名でソート
  const result = Array.from(familyMap.entries());
  result.sort((a, b) => getFamilySortKey(a[0]).localeCompare(getFamilySortKey(b[0])));

  return result.map(([, model]) => model);
}

export interface UseAISelectorProps {
  participants: DiscussionParticipant[];
  onParticipantsChange: (participants: DiscussionParticipant[]) => void;
}

export interface UseAISelectorReturn {
  // State
  expandedProviders: Record<AIProviderType, boolean>;
  modelFilter: ModelFilterType;

  // Actions
  toggleExpanded: (providerId: AIProviderType) => void;
  setModelFilter: (value: ModelFilterType) => void;
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
  const [modelFilter, setModelFilter] = useState<ModelFilterType>('latest-generation');

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
      const preset = ROLE_PRESETS.find((r) => r.id === role);
      const newParticipant: DiscussionParticipant = {
        id: generateParticipantId(),
        provider,
        model,
        displayName,
        color,
        role,
        displayRoleName: preset?.name,
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
      switch (modelFilter) {
        case 'latest-generation':
          return filterLatestGeneration(models);
        case 'latest-5':
          return models.slice(0, LATEST_MODEL_COUNT);
        case 'all':
        default:
          return models;
      }
    },
    [modelFilter]
  );

  const getSelectedCountForProvider = useCallback(
    (providerId: AIProviderType) => {
      return participants.filter((p) => p.provider === providerId).length;
    },
    [participants]
  );

  return {
    expandedProviders,
    modelFilter,
    toggleExpanded,
    setModelFilter,
    addParticipant,
    removeParticipant,
    updateParticipantRole,
    getParticipantCountForModel,
    getFilteredModels,
    getSelectedCountForProvider,
  };
}
