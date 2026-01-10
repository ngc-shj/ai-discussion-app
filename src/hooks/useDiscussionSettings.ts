'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AIProviderType,
  ModelInfo,
  DiscussionParticipant,
  SearchConfig,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  DEFAULT_PROVIDERS,
  getLocalModelColor,
  generateParticipantId,
} from '@/types';

// ローカルストレージのキー
const STORAGE_KEYS = {
  PARTICIPANTS: 'ai-discussion-participants',
  SEARCH: 'ai-discussion-search',
  PROFILE: 'ai-discussion-profile',
  MODE: 'ai-discussion-mode',
  DEPTH: 'ai-discussion-depth',
  DIRECTION: 'ai-discussion-direction',
  TERMINATION: 'ai-discussion-termination',
} as const;

// デフォルト値
const DEFAULT_DIRECTION_GUIDE: DirectionGuide = {
  keywords: [],
};

const DEFAULT_TERMINATION_CONFIG: TerminationConfig = {
  condition: 'rounds',
  maxRounds: 5,
};

const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  enabled: false,
  maxResults: 5,
  searchType: 'web',
  language: 'ja',
  timing: {
    onStart: true,
    eachRound: false,
    beforeSummary: false,
    onDemand: false,
  },
};

export interface DiscussionSettingsState {
  participants: DiscussionParticipant[];
  availableModels: Record<AIProviderType, ModelInfo[]>;
  availability: Record<AIProviderType, boolean>;
  searchConfig: SearchConfig;
  userProfile: UserProfile;
  discussionMode: DiscussionMode;
  discussionDepth: DiscussionDepth;
  directionGuide: DirectionGuide;
  terminationConfig: TerminationConfig;
}

export interface DiscussionSettingsActions {
  setParticipants: (participants: DiscussionParticipant[]) => void;
  setSearchConfig: (config: SearchConfig) => void;
  setUserProfile: (profile: UserProfile) => void;
  setDiscussionMode: (mode: DiscussionMode) => void;
  setDiscussionDepth: (depth: DiscussionDepth) => void;
  setDirectionGuide: (guide: DirectionGuide) => void;
  setTerminationConfig: (config: TerminationConfig) => void;
  restoreFromSession: (session: {
    participants: DiscussionParticipant[];
    rounds?: number;
    discussionMode?: DiscussionMode;
    discussionDepth?: DiscussionDepth;
    directionGuide?: DirectionGuide;
    terminationConfig?: TerminationConfig;
    userProfile?: UserProfile;
  }) => void;
}

export function useDiscussionSettings(): DiscussionSettingsState & DiscussionSettingsActions {
  // 設定状態
  const [participants, setParticipantsState] = useState<DiscussionParticipant[]>([]);
  const [availableModels, setAvailableModels] = useState<Record<AIProviderType, ModelInfo[]>>({
    claude: [],
    ollama: [],
    openai: [],
    gemini: [],
  });
  const [availability, setAvailability] = useState<Record<AIProviderType, boolean>>({
    claude: false,
    ollama: false,
    openai: false,
    gemini: false,
  });
  const [searchConfig, setSearchConfigState] = useState<SearchConfig>(DEFAULT_SEARCH_CONFIG);
  const [userProfile, setUserProfileState] = useState<UserProfile>({});
  const [discussionMode, setDiscussionModeState] = useState<DiscussionMode>('free');
  const [discussionDepth, setDiscussionDepthState] = useState<DiscussionDepth>(3);
  const [directionGuide, setDirectionGuideState] = useState<DirectionGuide>(DEFAULT_DIRECTION_GUIDE);
  const [terminationConfig, setTerminationConfigState] = useState<TerminationConfig>(DEFAULT_TERMINATION_CONFIG);

  // プロバイダーの可用性をチェック
  useEffect(() => {
    async function checkAvailability() {
      try {
        const response = await fetch('/api/providers');
        if (response.ok) {
          const data = await response.json();
          setAvailability(data);
        }
      } catch (err) {
        console.error('Failed to check provider availability:', err);
      }
    }
    checkAvailability();
  }, []);

  // モデル一覧を取得 & ローカルストレージから設定を復元
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/models');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data);

          // ローカルストレージから保存された参加者を復元
          const savedParticipants = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
          if (savedParticipants) {
            try {
              const parsed: DiscussionParticipant[] = JSON.parse(savedParticipants);
              const validParticipants = parsed
                .filter((p) => {
                  const providerModels = data[p.provider] || [];
                  return providerModels.some((m: ModelInfo) => m.id === p.model);
                })
                .map((p) => ({
                  ...p,
                  id: p.id || generateParticipantId(),
                }));
              if (validParticipants.length > 0) {
                setParticipantsState(validParticipants);
                return;
              }
            } catch {
              // パースエラー時は無視
            }
          }

          // デフォルトの参加者を設定
          const initialParticipants: DiscussionParticipant[] = [];
          for (const providerId of ['ollama', 'gemini'] as AIProviderType[]) {
            const models = data[providerId] || [];
            if (models.length > 0) {
              const provider = DEFAULT_PROVIDERS.find((p) => p.id === providerId);
              if (provider) {
                const model = models[0];
                initialParticipants.push({
                  id: generateParticipantId(),
                  provider: providerId,
                  model: model.id,
                  displayName: model.name,
                  color: provider.isLocal ? getLocalModelColor(model.id) : provider.color,
                });
              }
            }
          }
          if (initialParticipants.length > 0) {
            setParticipantsState(initialParticipants);
          }
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
      }
    }
    fetchModels();

    // ローカルストレージから各設定を復元
    const savedSearch = localStorage.getItem(STORAGE_KEYS.SEARCH);
    if (savedSearch) {
      try {
        setSearchConfigState({ ...DEFAULT_SEARCH_CONFIG, ...JSON.parse(savedSearch) });
      } catch { /* ignore */ }
    }

    const savedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (savedProfile) {
      try {
        setUserProfileState(JSON.parse(savedProfile));
      } catch { /* ignore */ }
    }

    const savedMode = localStorage.getItem(STORAGE_KEYS.MODE);
    if (savedMode && ['free', 'brainstorm', 'debate', 'consensus', 'critique'].includes(savedMode)) {
      setDiscussionModeState(savedMode as DiscussionMode);
    }

    const savedDepth = localStorage.getItem(STORAGE_KEYS.DEPTH);
    if (savedDepth) {
      const parsed = parseInt(savedDepth, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        setDiscussionDepthState(parsed as DiscussionDepth);
      }
    }

    const savedDirection = localStorage.getItem(STORAGE_KEYS.DIRECTION);
    if (savedDirection) {
      try {
        setDirectionGuideState({ ...DEFAULT_DIRECTION_GUIDE, ...JSON.parse(savedDirection) });
      } catch { /* ignore */ }
    }

    const savedTermination = localStorage.getItem(STORAGE_KEYS.TERMINATION);
    if (savedTermination) {
      try {
        setTerminationConfigState({ ...DEFAULT_TERMINATION_CONFIG, ...JSON.parse(savedTermination) });
      } catch { /* ignore */ }
    }
  }, []);

  // 設定をローカルストレージに保存
  useEffect(() => {
    if (participants.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants));
    }
  }, [participants]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SEARCH, JSON.stringify(searchConfig));
  }, [searchConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MODE, discussionMode);
  }, [discussionMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEPTH, discussionDepth.toString());
  }, [discussionDepth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DIRECTION, JSON.stringify(directionGuide));
  }, [directionGuide]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TERMINATION, JSON.stringify(terminationConfig));
  }, [terminationConfig]);

  // セッターのラッパー
  const setParticipants = useCallback((p: DiscussionParticipant[]) => setParticipantsState(p), []);
  const setSearchConfig = useCallback((c: SearchConfig) => setSearchConfigState(c), []);
  const setUserProfile = useCallback((p: UserProfile) => setUserProfileState(p), []);
  const setDiscussionMode = useCallback((m: DiscussionMode) => setDiscussionModeState(m), []);
  const setDiscussionDepth = useCallback((d: DiscussionDepth) => setDiscussionDepthState(d), []);
  const setDirectionGuide = useCallback((g: DirectionGuide) => setDirectionGuideState(g), []);
  const setTerminationConfig = useCallback((c: TerminationConfig) => setTerminationConfigState(c), []);

  // セッションから設定を復元
  const restoreFromSession = useCallback((session: {
    participants: DiscussionParticipant[];
    rounds?: number;
    discussionMode?: DiscussionMode;
    discussionDepth?: DiscussionDepth;
    directionGuide?: DirectionGuide;
    terminationConfig?: TerminationConfig;
    userProfile?: UserProfile;
  }) => {
    if (session.participants.length > 0) {
      setParticipantsState(session.participants);
    }
    if (session.rounds) {
      setTerminationConfigState(prev => ({ ...prev, maxRounds: session.rounds! }));
    }
    if (session.discussionMode) {
      setDiscussionModeState(session.discussionMode);
    }
    if (session.discussionDepth) {
      setDiscussionDepthState(session.discussionDepth);
    }
    if (session.directionGuide) {
      setDirectionGuideState(session.directionGuide);
    }
    if (session.terminationConfig) {
      setTerminationConfigState(session.terminationConfig);
    }
    if (session.userProfile) {
      setUserProfileState(session.userProfile);
    }
  }, []);

  return {
    // State
    participants,
    availableModels,
    availability,
    searchConfig,
    userProfile,
    discussionMode,
    discussionDepth,
    directionGuide,
    terminationConfig,
    // Actions
    setParticipants,
    setSearchConfig,
    setUserProfile,
    setDiscussionMode,
    setDiscussionDepth,
    setDirectionGuide,
    setTerminationConfig,
    restoreFromSession,
  };
}
