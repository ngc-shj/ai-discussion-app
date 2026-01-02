'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AIProviderType,
  ModelInfo,
  DiscussionMessage,
  DiscussionParticipant,
  DiscussionSession,
  PreviousTurnSummary,
  DEFAULT_PROVIDERS,
  getOllamaModelColor,
  SearchConfig,
  SearchResult,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  MessageVote,
  generateParticipantId,
  FollowUpQuestion,
  DeepDiveType,
  DEEP_DIVE_PRESETS,
} from '@/types';
import {
  DiscussionPanel,
  SettingsPanel,
  InputForm,
  ProgressIndicator,
  SessionSidebar,
  MobileHeader,
} from '@/components';
import {
  getAllSessions,
  saveSession,
  deleteSession as deleteSessionFromDB,
  updateSessionTitle,
  createNewSession,
  createNewTurn,
  saveInterruptedState,
  getInterruptedState,
  clearInterruptedState,
} from '@/lib/session-storage';
import { InterruptedDiscussionState, InterruptedTurnState } from '@/types';

const STORAGE_KEY_PARTICIPANTS = 'ai-discussion-participants';
const STORAGE_KEY_SEARCH = 'ai-discussion-search';
const STORAGE_KEY_PROFILE = 'ai-discussion-profile';
const STORAGE_KEY_MODE = 'ai-discussion-mode';
const STORAGE_KEY_DEPTH = 'ai-discussion-depth';
const STORAGE_KEY_DIRECTION = 'ai-discussion-direction';
const STORAGE_KEY_TERMINATION = 'ai-discussion-termination';

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
};

interface ProgressState {
  currentRound: number;
  totalRounds: number;
  currentParticipantIndex: number;
  totalParticipants: number;
  currentParticipant: DiscussionParticipant | null;
  isSummarizing: boolean;
}

export default function Home() {
  // セッション管理
  const [sessions, setSessions] = useState<DiscussionSession[]>([]);
  const [currentSession, setCurrentSession] = useState<DiscussionSession | null>(null);

  // 最新のセッションを参照するためのref
  const currentSessionRef = useRef<DiscussionSession | null>(null);
  currentSessionRef.current = currentSession;

  // 現在進行中のターン
  const [currentMessages, setCurrentMessages] = useState<DiscussionMessage[]>([]);
  const [currentFinalAnswer, setCurrentFinalAnswer] = useState<string>('');
  const [currentSummaryPrompt, setCurrentSummaryPrompt] = useState<string>('');
  const [currentTopic, setCurrentTopic] = useState<string>('');

  // ローディング状態
  const [isLoading, setIsLoading] = useState(false);

  // サイドバー・設定パネルの開閉状態
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // PC用サイドバー折りたたみ状態
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);

  // 設定
  const [participants, setParticipants] = useState<DiscussionParticipant[]>([]);
  const [availableModels, setAvailableModels] = useState<Record<AIProviderType, ModelInfo[]>>({
    claude: [],
    ollama: [],
    openai: [],
    gemini: [],
  });
  const [searchConfig, setSearchConfig] = useState<SearchConfig>(DEFAULT_SEARCH_CONFIG);
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [discussionMode, setDiscussionMode] = useState<DiscussionMode>('free');
  const [discussionDepth, setDiscussionDepth] = useState<DiscussionDepth>(3);
  const [directionGuide, setDirectionGuide] = useState<DirectionGuide>(DEFAULT_DIRECTION_GUIDE);
  const [terminationConfig, setTerminationConfig] = useState<TerminationConfig>(DEFAULT_TERMINATION_CONFIG);
  const [messageVotes, setMessageVotes] = useState<MessageVote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResult[]>([]);
  const [availability, setAvailability] = useState<Record<AIProviderType, boolean>>({
    claude: false,
    ollama: false,
    openai: false,
    gemini: false,
  });
  const [error, setError] = useState<string | null>(null);
  // フォローアップ用のプリセットトピック
  const [presetTopic, setPresetTopic] = useState<string>('');
  // 中断された議論の状態
  const [interruptedState, setInterruptedState] = useState<InterruptedDiscussionState | null>(null);
  // 中断リクエストフラグ
  const interruptRequestedRef = useRef(false);
  const [progress, setProgress] = useState<ProgressState>({
    currentRound: 0,
    totalRounds: 0,
    currentParticipantIndex: 0,
    totalParticipants: 0,
    currentParticipant: null,
    isSummarizing: false,
  });
  // 完了した参加者を追跡
  const [completedParticipants, setCompletedParticipants] = useState<Set<string>>(new Set());
  // フォローアップ質問
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<FollowUpQuestion[]>([]);
  const [isGeneratingFollowUps, setIsGeneratingFollowUps] = useState(false);
  // 統合回答待機状態（議論完了後、ユーザーが投票してから生成）
  const [awaitingSummary, setAwaitingSummary] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // セッション一覧を読み込み
  useEffect(() => {
    async function loadSessions() {
      try {
        const loadedSessions = await getAllSessions();
        setSessions(loadedSessions);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    }
    loadSessions();

    // 中断された議論があるかチェック
    const savedInterrupted = getInterruptedState();
    if (savedInterrupted) {
      setInterruptedState(savedInterrupted);
    }
  }, []);

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

  // モデル一覧を取得
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/models');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data);

          // ローカルストレージから保存された参加者を復元
          const savedParticipants = localStorage.getItem(STORAGE_KEY_PARTICIPANTS);
          if (savedParticipants) {
            try {
              const parsed: DiscussionParticipant[] = JSON.parse(savedParticipants);
              // 保存された参加者が現在利用可能なモデルに存在するか確認
              // また、IDがない古いデータにはIDを付与
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
                setParticipants(validParticipants);
                return;
              }
            } catch {
              // パースエラー時は無視してデフォルトを使用
            }
          }

          // 保存データがない場合はデフォルトの参加者を設定
          const initialParticipants: DiscussionParticipant[] = [];
          for (const providerId of ['ollama', 'gemini'] as AIProviderType[]) {
            const models = data[providerId] || [];
            if (models.length > 0) {
              const provider = DEFAULT_PROVIDERS.find((p) => p.id === providerId);
              if (provider) {
                const model = models[0];
                const isOllama = providerId === 'ollama';
                initialParticipants.push({
                  id: generateParticipantId(),
                  provider: providerId,
                  model: model.id,
                  displayName: isOllama ? `Ollama (${model.name})` : `${provider.name} (${model.name})`,
                  color: isOllama ? getOllamaModelColor(model.id) : provider.color,
                });
              }
            }
          }
          if (initialParticipants.length > 0) {
            setParticipants(initialParticipants);
          }
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
      }
    }
    fetchModels();

    // ローカルストレージから検索設定を復元
    const savedSearch = localStorage.getItem(STORAGE_KEY_SEARCH);
    if (savedSearch) {
      try {
        const parsed = JSON.parse(savedSearch);
        setSearchConfig({ ...DEFAULT_SEARCH_CONFIG, ...parsed });
      } catch {
        // パースエラー時は無視
      }
    }

    // ローカルストレージからプロファイルを復元
    const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setUserProfile(parsed);
      } catch {
        // パースエラー時は無視
      }
    }

    // ローカルストレージから議論モードを復元
    const savedMode = localStorage.getItem(STORAGE_KEY_MODE);
    if (savedMode && ['free', 'brainstorm', 'debate', 'consensus', 'critique'].includes(savedMode)) {
      setDiscussionMode(savedMode as DiscussionMode);
    }

    // ローカルストレージから議論の深さを復元
    const savedDepth = localStorage.getItem(STORAGE_KEY_DEPTH);
    if (savedDepth) {
      const parsed = parseInt(savedDepth, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        setDiscussionDepth(parsed as DiscussionDepth);
      }
    }

    // ローカルストレージから方向性ガイドを復元
    const savedDirection = localStorage.getItem(STORAGE_KEY_DIRECTION);
    if (savedDirection) {
      try {
        const parsed = JSON.parse(savedDirection);
        setDirectionGuide({ ...DEFAULT_DIRECTION_GUIDE, ...parsed });
      } catch {
        // パースエラー時は無視
      }
    }

    // ローカルストレージから終了条件を復元
    const savedTermination = localStorage.getItem(STORAGE_KEY_TERMINATION);
    if (savedTermination) {
      try {
        const parsed = JSON.parse(savedTermination);
        setTerminationConfig({ ...DEFAULT_TERMINATION_CONFIG, ...parsed });
      } catch {
        // パースエラー時は無視
      }
    }
  }, []);

  // 参加者が変更されたらローカルストレージに保存
  useEffect(() => {
    if (participants.length > 0) {
      localStorage.setItem(STORAGE_KEY_PARTICIPANTS, JSON.stringify(participants));
    }
  }, [participants]);

  // 検索設定が変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify(searchConfig));
  }, [searchConfig]);

  // プロファイルが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(userProfile));
  }, [userProfile]);

  // 議論モードが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, discussionMode);
  }, [discussionMode]);

  // 議論の深さが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DEPTH, discussionDepth.toString());
  }, [discussionDepth]);

  // 方向性ガイドが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DIRECTION, JSON.stringify(directionGuide));
  }, [directionGuide]);

  // 終了条件が変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TERMINATION, JSON.stringify(terminationConfig));
  }, [terminationConfig]);

  // 投票を追加/更新するハンドラー
  const handleVote = useCallback((messageId: string, vote: 'agree' | 'disagree' | 'neutral') => {
    setMessageVotes(prev => {
      const existing = prev.findIndex(v => v.messageId === messageId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { messageId, vote, timestamp: new Date() };
        return updated;
      }
      return [...prev, { messageId, vote, timestamp: new Date() }];
    });
  }, []);

  // 新しいセッションを開始
  const handleNewSession = useCallback(() => {
    setCurrentSession(null);
    setCurrentMessages([]);
    setCurrentFinalAnswer('');
    setCurrentTopic('');
    setError(null);
    setSuggestedFollowUps([]);
    setIsGeneratingFollowUps(false);
    setAwaitingSummary(false);
    setIsGeneratingSummary(false);
  }, []);

  // セッションを選択
  const handleSelectSession = useCallback((session: DiscussionSession) => {
    setCurrentSession(session);
    setCurrentMessages([]);
    setCurrentFinalAnswer('');
    setCurrentTopic('');
    setError(null);
    setSuggestedFollowUps([]);
    setIsGeneratingFollowUps(false);
    setAwaitingSummary(false);
    setIsGeneratingSummary(false);

    // セッションに中断状態がある場合、interruptedStateにセットし、設定も復元
    if (session.interruptedTurn) {
      const turn = session.interruptedTurn;

      // 中断時の参加者を復元（保存されていればそれを、なければセッションの参加者を使用）
      setParticipants(turn.participants || session.participants);

      // 中断時の設定を復元
      if (turn.discussionMode) {
        setDiscussionMode(turn.discussionMode);
      }
      if (turn.discussionDepth) {
        setDiscussionDepth(turn.discussionDepth);
      }
      if (turn.directionGuide) {
        setDirectionGuide(turn.directionGuide);
      }
      if (turn.terminationConfig) {
        setTerminationConfig(turn.terminationConfig);
      }
      if (turn.userProfile) {
        setUserProfile(turn.userProfile);
      }

      const interrupted: InterruptedDiscussionState = {
        sessionId: session.id,
        topic: turn.topic,
        participants: turn.participants || session.participants,
        messages: turn.messages,
        currentRound: turn.currentRound,
        currentParticipantIndex: turn.currentParticipantIndex,
        totalRounds: turn.totalRounds,
        searchResults: turn.searchResults,
        userProfile: turn.userProfile,
        discussionMode: turn.discussionMode,
        discussionDepth: turn.discussionDepth,
        directionGuide: turn.directionGuide,
        terminationConfig: turn.terminationConfig,
        interruptedAt: turn.interruptedAt,
      };
      setInterruptedState(interrupted);
    } else {
      // 中断状態がない場合はセッションの設定を適用
      if (session.participants.length > 0) {
        setParticipants(session.participants);
      }
      if (session.rounds) {
        setTerminationConfig(prev => ({ ...prev, maxRounds: session.rounds! }));
      }
      setInterruptedState(null);
    }
  }, []);

  // セッションを削除
  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await deleteSessionFromDB(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSession?.id === id) {
        handleNewSession();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [currentSession, handleNewSession]);

  // フォローアップ質問を設定
  const handleFollowUp = useCallback((topic: string, _previousAnswer: string) => {
    // previousAnswerはpreviousTurns経由でAPIに渡される
    const followUpPrompt = `「${topic}」についてもう少し詳しく教えてください。`;
    setPresetTopic(followUpPrompt);
  }, []);

  // セッションの元のトピックを取得（最初のターンのトピック）
  const getOriginalTopic = useCallback(() => {
    return currentSession?.turns[0]?.topic || '';
  }, [currentSession]);

  // 深掘りモードで議論を開始
  const handleDeepDive = useCallback((_topic: string, _previousAnswer: string, type: DeepDiveType, customPrompt?: string) => {
    const preset = DEEP_DIVE_PRESETS.find(p => p.id === type);
    const focusArea = type === 'custom' && customPrompt ? customPrompt : preset?.prompt || '';
    const originalTopic = getOriginalTopic();

    const deepDivePrompt = `【深掘り議論】${preset?.name || 'カスタム'}観点\n\n元のトピック: ${originalTopic}\n\n${focusArea}\n\nこの観点から詳しく議論してください。`;
    setPresetTopic(deepDivePrompt);
  }, [getOriginalTopic]);

  // 反論を生成
  const handleCounterargument = useCallback((_topic: string, _previousAnswer: string) => {
    const originalTopic = getOriginalTopic();
    const counterargumentPrompt = `【反論モード】前回の結論に対して、批判的な視点から反論や別の見解を提示してください。\n\n元のトピック: ${originalTopic}\n\n【指示】\n- 前回の結論の弱点や見落としを指摘してください\n- 別の視点からの反論を展開してください\n- 建設的な批判を心がけてください`;
    setPresetTopic(counterargumentPrompt);
  }, [getOriginalTopic]);

  // 議論を分岐
  const handleFork = useCallback((_turnId: string, _topic: string, _previousAnswer: string, label: string, perspective: string) => {
    const originalTopic = getOriginalTopic();
    const forkPrompt = `【分岐議論】${label}\n\n元のトピック: ${originalTopic}\n\n【新しい視点】\n${perspective}\n\nこの新しい視点から議論を展開してください。`;
    setPresetTopic(forkPrompt);
  }, [getOriginalTopic]);

  // プリセットトピックをクリア
  const handlePresetTopicClear = useCallback(() => {
    setPresetTopic('');
  }, []);

  // 議論を中断
  const handleInterrupt = useCallback(() => {
    interruptRequestedRef.current = true;
  }, []);

  // 中断状態を破棄
  const handleDiscardInterrupted = useCallback(() => {
    clearInterruptedState();
    setInterruptedState(null);
  }, []);

  // 統合回答を生成（投票後に手動で実行）
  const handleGenerateSummary = useCallback(async () => {
    if (currentMessages.length === 0) return;

    setIsGeneratingSummary(true);
    setAwaitingSummary(false);
    setError(null);

    // 過去のターンを取得
    const sessionForTurns = currentSessionRef.current;
    const previousTurns: PreviousTurnSummary[] = sessionForTurns?.turns.map((t) => ({
      topic: t.topic,
      finalAnswer: t.finalAnswer,
    })) || [];

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: currentTopic,
          participants,
          messages: currentMessages,
          previousTurns,
          searchResults: currentSearchResults,
          userProfile,
          discussionMode,
          discussionDepth,
          directionGuide,
          messageVotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let collectedFinalAnswer = '';
      let collectedSummaryPrompt = '';

      const processLine = (line: string) => {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const progressData = JSON.parse(data);

            switch (progressData.type) {
              case 'progress':
                if (progressData.progress?.isSummarizing) {
                  setProgress((prev) => ({ ...prev, isSummarizing: true }));
                }
                break;
              case 'summary':
                collectedFinalAnswer = progressData.finalAnswer;
                collectedSummaryPrompt = progressData.summaryPrompt || '';
                setCurrentFinalAnswer(collectedFinalAnswer);
                setCurrentSummaryPrompt(collectedSummaryPrompt);
                setProgress((prev) => ({ ...prev, isSummarizing: false }));
                setIsGeneratingFollowUps(true);
                break;
              case 'followups':
                if (progressData.suggestedFollowUps) {
                  setSuggestedFollowUps(progressData.suggestedFollowUps);
                }
                setIsGeneratingFollowUps(false);
                break;
              case 'error':
                console.error('Summary error:', progressData.error);
                setError(progressData.error);
                break;
              case 'complete':
                setIsGeneratingSummary(false);
                setProgress((prev) => ({ ...prev, isSummarizing: false }));
                setIsGeneratingFollowUps(false);
                break;
            }
          } catch {
            // JSON parse error, ignore
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            const remainingLines = buffer.split('\n\n');
            for (const line of remainingLines) {
              processLine(line);
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      }

      // 統合回答生成完了後、セッションにターンを追加して保存
      if (collectedFinalAnswer) {
        const newTurn = createNewTurn(
          currentTopic,
          currentMessages,
          collectedFinalAnswer,
          currentSearchResults.length > 0 ? currentSearchResults : undefined,
          collectedSummaryPrompt || undefined
        );
        const latestSession = currentSessionRef.current;

        if (latestSession) {
          const updatedSession: DiscussionSession = {
            ...latestSession,
            turns: [...latestSession.turns, newTurn],
            interruptedTurn: undefined,
            updatedAt: new Date(),
          };
          await saveSession(updatedSession);
          setCurrentSession(updatedSession);
          setSessions((prev) =>
            prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
          );
        }

        // localStorageの中断状態もクリア
        clearInterruptedState();
        setInterruptedState(null);

        // 現在のターンをクリア
        setCurrentTopic('');
        setCurrentMessages([]);
        setCurrentFinalAnswer('');
        setCurrentSearchResults([]);
        setSuggestedFollowUps([]);
        setMessageVotes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [currentMessages, currentTopic, participants, currentSearchResults, userProfile, discussionMode, discussionDepth, directionGuide, messageVotes]);

  // 中断した議論を再開
  const handleResumeDiscussion = useCallback(async () => {
    if (!interruptedState) return;

    // 中断状態をクリア（localStorage）
    clearInterruptedState();
    setInterruptedState(null);

    // 参加者と設定を復元
    setParticipants(interruptedState.participants);
    if (interruptedState.discussionMode) {
      setDiscussionMode(interruptedState.discussionMode);
    }
    if (interruptedState.discussionDepth) {
      setDiscussionDepth(interruptedState.discussionDepth);
    }
    if (interruptedState.directionGuide) {
      setDirectionGuide(interruptedState.directionGuide);
    }
    if (interruptedState.terminationConfig) {
      setTerminationConfig(interruptedState.terminationConfig);
    }
    if (interruptedState.userProfile) {
      setUserProfile(interruptedState.userProfile);
    }

    // セッションを復元し、中断状態をクリア
    const session = await getAllSessions().then(sessions =>
      sessions.find(s => s.id === interruptedState.sessionId)
    );
    if (session) {
      // セッションから中断状態を削除（再開したので）
      const updatedSession: DiscussionSession = {
        ...session,
        interruptedTurn: undefined,
      };
      await saveSession(updatedSession);
      setCurrentSession(updatedSession);
      setSessions((prev) =>
        prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
      );
    }

    // 中断時のメッセージを復元して表示
    setCurrentTopic(interruptedState.topic);
    setCurrentMessages(interruptedState.messages);
    setCurrentSearchResults(interruptedState.searchResults || []);

    // 再開用のAPIを呼び出す
    setIsLoading(true);
    setError(null);
    interruptRequestedRef.current = false;
    setCompletedParticipants(new Set());
    setProgress({
      currentRound: interruptedState.currentRound,
      totalRounds: interruptedState.totalRounds,
      currentParticipantIndex: interruptedState.currentParticipantIndex,
      totalParticipants: interruptedState.participants.length,
      currentParticipant: interruptedState.participants[interruptedState.currentParticipantIndex],
      isSummarizing: false,
    });

    // 過去のターンを取得
    const sessionForTurns = session || currentSessionRef.current;
    const previousTurns: PreviousTurnSummary[] = sessionForTurns?.turns.map((t) => ({
      topic: t.topic,
      finalAnswer: t.finalAnswer,
    })) || [];

    try {
      const response = await fetch('/api/discuss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: interruptedState.topic,
          participants: interruptedState.participants,
          rounds: interruptedState.totalRounds,
          previousTurns,
          searchResults: interruptedState.searchResults,
          userProfile: interruptedState.userProfile,
          discussionMode: interruptedState.discussionMode,
          discussionDepth: interruptedState.discussionDepth,
          directionGuide: interruptedState.directionGuide,
          terminationConfig: interruptedState.terminationConfig,
          messageVotes,
          // 再開用のパラメータ
          resumeFrom: {
            messages: interruptedState.messages,
            currentRound: interruptedState.currentRound,
            currentParticipantIndex: interruptedState.currentParticipantIndex,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resume discussion');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let collectedMessages: DiscussionMessage[] = [...interruptedState.messages];
      let collectedFinalAnswer = '';
      let collectedSummaryPrompt = '';
      // 進捗情報を追跡（中断時・自動保存時に使用）
      let currentProgress = {
        currentRound: interruptedState.currentRound,
        currentParticipantIndex: interruptedState.currentParticipantIndex,
      };
      // 再開時のセッションを保持
      const resumeSession = currentSessionRef.current;

      const processLine = (line: string) => {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const progressData = JSON.parse(data);

            switch (progressData.type) {
              case 'progress':
                currentProgress = {
                  currentRound: progressData.progress.currentRound,
                  currentParticipantIndex: progressData.progress.currentParticipantIndex,
                };
                setProgress({
                  currentRound: progressData.progress.currentRound,
                  totalRounds: progressData.progress.totalRounds,
                  currentParticipantIndex: progressData.progress.currentParticipantIndex,
                  totalParticipants: progressData.progress.totalParticipants,
                  currentParticipant: progressData.progress.currentParticipant,
                  isSummarizing: progressData.progress.isSummarizing,
                });
                break;
              case 'message':
                collectedMessages = [...collectedMessages, progressData.message];
                setCurrentMessages(collectedMessages);
                const messageParticipant = progressData.message;
                if (messageParticipant) {
                  setCompletedParticipants(prev => {
                    const newSet = new Set(prev);
                    newSet.add(`${messageParticipant.provider}-${messageParticipant.model}`);
                    return newSet;
                  });
                }
                // メッセージ受信のたびにセッションの中断状態を更新（自動保存）
                {
                  const latestSession = currentSessionRef.current;
                  if (latestSession) {
                    const interruptedTurn: InterruptedTurnState = {
                      topic: interruptedState.topic,
                      participants: interruptedState.participants, // 再開時の参加者を保存
                      messages: collectedMessages,
                      currentRound: currentProgress.currentRound,
                      currentParticipantIndex: currentProgress.currentParticipantIndex,
                      totalRounds: interruptedState.totalRounds,
                      searchResults: interruptedState.searchResults,
                      userProfile: interruptedState.userProfile,
                      discussionMode: interruptedState.discussionMode,
                      discussionDepth: interruptedState.discussionDepth,
                      directionGuide: interruptedState.directionGuide,
                      terminationConfig: interruptedState.terminationConfig,
                      interruptedAt: new Date(),
                    };
                    const updatedSession: DiscussionSession = {
                      ...latestSession,
                      interruptedTurn,
                      updatedAt: new Date(),
                    };
                    saveSession(updatedSession).catch(err => console.error('Failed to save interrupted state:', err));
                    setSessions((prev) =>
                      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
                    );
                  }
                }
                break;
              case 'summary':
                collectedFinalAnswer = progressData.finalAnswer;
                collectedSummaryPrompt = progressData.summaryPrompt || '';
                setCurrentFinalAnswer(collectedFinalAnswer);
                setCurrentSummaryPrompt(collectedSummaryPrompt);
                setProgress((prev) => ({ ...prev, isSummarizing: false }));
                setIsGeneratingFollowUps(true);
                break;
              case 'followups':
                if (progressData.suggestedFollowUps) {
                  setSuggestedFollowUps(progressData.suggestedFollowUps);
                }
                setIsGeneratingFollowUps(false);
                break;
              case 'error':
                console.error('Discussion error:', progressData.error);
                if (progressData.error.includes('No messages were generated') ||
                    progressData.error.includes('Failed to generate summary with all')) {
                  setError(progressData.error);
                }
                break;
              case 'complete':
                setIsLoading(false);
                setProgress((prev) => ({ ...prev, isSummarizing: false }));
                break;
            }
          } catch {
            // JSON parse error, ignore
          }
        }
      };

      let wasInterrupted = false;

      while (true) {
        // 中断リクエストをチェック
        if (interruptRequestedRef.current) {
          wasInterrupted = true;
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            const remainingLines = buffer.split('\n\n');
            for (const line of remainingLines) {
              processLine(line);
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      }

      // 中断された場合、状態を保存
      if (wasInterrupted) {
        const newInterruptedState: InterruptedDiscussionState = {
          sessionId: resumeSession?.id || '',
          topic: interruptedState.topic,
          participants: interruptedState.participants,
          messages: collectedMessages,
          currentRound: currentProgress.currentRound,
          currentParticipantIndex: currentProgress.currentParticipantIndex,
          totalRounds: interruptedState.totalRounds,
          searchResults: interruptedState.searchResults,
          userProfile: interruptedState.userProfile,
          discussionMode: interruptedState.discussionMode,
          discussionDepth: interruptedState.discussionDepth,
          directionGuide: interruptedState.directionGuide,
          terminationConfig: interruptedState.terminationConfig,
          interruptedAt: new Date(),
        };
        saveInterruptedState(newInterruptedState);
        setInterruptedState(newInterruptedState);
        setIsLoading(false);
        return;
      }

      // 議論完了後、セッションにターンを追加して保存（中断状態もクリア）
      if (collectedFinalAnswer) {
        const newTurn = createNewTurn(
          interruptedState.topic,
          collectedMessages,
          collectedFinalAnswer,
          interruptedState.searchResults,
          collectedSummaryPrompt || undefined
        );
        const latestSession = currentSessionRef.current;

        if (latestSession) {
          const updatedSession: DiscussionSession = {
            ...latestSession,
            turns: [...latestSession.turns, newTurn],
            interruptedTurn: undefined, // 完了したので中断状態をクリア
            updatedAt: new Date(),
          };
          await saveSession(updatedSession);
          setCurrentSession(updatedSession);
          setSessions((prev) =>
            prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
          );
        }

        setCurrentTopic('');
        setCurrentMessages([]);
        setCurrentFinalAnswer('');
        setCurrentSearchResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [interruptedState]);

  // セッションの名前を変更
  const handleRenameSession = useCallback(async (id: string, newTitle: string) => {
    try {
      await updateSessionTitle(id, newTitle);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: new Date() } : s))
      );
      if (currentSession?.id === id) {
        setCurrentSession((prev) => prev ? { ...prev, title: newTitle } : null);
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  }, [currentSession]);

  // 議論を開始
  const handleStartDiscussion = useCallback(
    async (topic: string) => {
      if (participants.length === 0) {
        setError('少なくとも1つのAIモデルを選択してください');
        return;
      }

      // 状態をクリアする前に、直前のターン情報を保存
      const prevTopic = currentTopic;
      const prevFinalAnswer = currentFinalAnswer;

      setCurrentMessages([]);
      setCurrentFinalAnswer('');
      setCurrentSearchResults([]);
      setSuggestedFollowUps([]);
      setIsGeneratingFollowUps(false);
      setError(null);
      setIsLoading(true);
      setCurrentTopic(topic);
      setCompletedParticipants(new Set());
      interruptRequestedRef.current = false; // 中断フラグをリセット
      setProgress({
        currentRound: 1,
        totalRounds: terminationConfig.maxRounds,
        currentParticipantIndex: 0,
        totalParticipants: participants.length,
        currentParticipant: participants[0],
        isSummarizing: false,
      });

      // 検索が有効な場合、先に検索を実行
      let searchResults: SearchResult[] = [];
      if (searchConfig.enabled) {
        setIsSearching(true);
        try {
          const searchQuery = searchConfig.query || topic;
          const searchResponse = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: searchQuery,
              type: searchConfig.searchType,
              limit: searchConfig.maxResults,
              language: searchConfig.language || 'ja',
            }),
          });
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            searchResults = searchData.results || [];
            setCurrentSearchResults(searchResults);
          }
        } catch (err) {
          console.error('Search failed:', err);
          // 検索に失敗しても議論は続行
        } finally {
          setIsSearching(false);
        }
      }

      // 過去のターンを取得（継続議論用）- refを使って最新の値を取得
      let sessionAtStart = currentSessionRef.current;
      const previousTurns: PreviousTurnSummary[] = sessionAtStart?.turns.map((t) => ({
        topic: t.topic,
        finalAnswer: t.finalAnswer,
      })) || [];

      // まだセッションに保存されていない直前のターン（prevFinalAnswer）があれば追加
      // これにより、統合回答表示後に入力フィールドから質問した場合も文脈が引き継がれる
      if (prevTopic && prevFinalAnswer) {
        previousTurns.push({
          topic: prevTopic,
          finalAnswer: prevFinalAnswer,
        });
      }

      // 新規セッションの場合、議論開始時にセッションを作成
      if (!sessionAtStart) {
        const newSession = createNewSession(
          topic.slice(0, 50) + (topic.length > 50 ? '...' : ''),
          participants,
          terminationConfig.maxRounds
        );
        await saveSession(newSession);
        setCurrentSession(newSession);
        setSessions((prev) => [newSession, ...prev]);
        sessionAtStart = newSession;
      }

      try {
        const response = await fetch('/api/discuss', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic,
            participants,
            rounds: terminationConfig.maxRounds,
            previousTurns,
            searchResults,
            userProfile,
            discussionMode,
            discussionDepth,
            directionGuide,
            terminationConfig,
            messageVotes,
            skipSummary: true, // 統合回答はユーザーが投票後に手動で生成
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start discussion');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let collectedMessages: DiscussionMessage[] = [];
        let collectedFinalAnswer = '';
        let collectedSummaryPrompt = '';
        // 進捗情報を追跡（中断時・自動保存時に使用）
        let currentProgress = { currentRound: 1, currentParticipantIndex: 0 };

        const processLine = (line: string) => {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const progressData = JSON.parse(data);

              switch (progressData.type) {
                case 'progress':
                  currentProgress = {
                    currentRound: progressData.progress.currentRound,
                    currentParticipantIndex: progressData.progress.currentParticipantIndex,
                  };
                  setProgress({
                    currentRound: progressData.progress.currentRound,
                    totalRounds: progressData.progress.totalRounds,
                    currentParticipantIndex: progressData.progress.currentParticipantIndex,
                    totalParticipants: progressData.progress.totalParticipants,
                    currentParticipant: progressData.progress.currentParticipant,
                    isSummarizing: progressData.progress.isSummarizing,
                  });
                  break;
                case 'message':
                  collectedMessages = [...collectedMessages, progressData.message];
                  setCurrentMessages(collectedMessages);
                  // メッセージを受信したら、その参加者を完了としてマーク
                  const messageParticipant = progressData.message;
                  if (messageParticipant) {
                    setCompletedParticipants(prev => {
                      const newSet = new Set(prev);
                      newSet.add(`${messageParticipant.provider}-${messageParticipant.model}`);
                      return newSet;
                    });
                  }
                  // メッセージ受信のたびにセッションの中断状態を更新（自動保存）
                  {
                    const latestSession = currentSessionRef.current;
                    if (latestSession) {
                      const interruptedTurn: InterruptedTurnState = {
                        topic,
                        participants, // 現在の参加者を保存
                        messages: collectedMessages,
                        currentRound: currentProgress.currentRound,
                        currentParticipantIndex: currentProgress.currentParticipantIndex,
                        totalRounds: terminationConfig.maxRounds,
                        searchResults: searchResults.length > 0 ? searchResults : undefined,
                        userProfile,
                        discussionMode,
                        discussionDepth,
                        directionGuide,
                        terminationConfig,
                        interruptedAt: new Date(),
                      };
                      const updatedSession: DiscussionSession = {
                        ...latestSession,
                        interruptedTurn,
                        updatedAt: new Date(),
                      };
                      saveSession(updatedSession).catch(err => console.error('Failed to save interrupted state:', err));
                      // sessionsリストも更新
                      setSessions((prev) =>
                        prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
                      );
                    }
                  }
                  break;
                case 'summary':
                  collectedFinalAnswer = progressData.finalAnswer;
                  collectedSummaryPrompt = progressData.summaryPrompt || '';
                  setCurrentFinalAnswer(collectedFinalAnswer);
                  setCurrentSummaryPrompt(collectedSummaryPrompt);
                  setProgress((prev) => ({ ...prev, isSummarizing: false }));
                  setIsGeneratingFollowUps(true);
                  break;
                case 'followups':
                  if (progressData.suggestedFollowUps) {
                    setSuggestedFollowUps(progressData.suggestedFollowUps);
                  }
                  setIsGeneratingFollowUps(false);
                  break;
                case 'error':
                  console.error('Discussion error:', progressData.error);
                  // 致命的なエラー（全プロバイダー失敗、統合回答生成失敗）のみ表示
                  if (progressData.error.includes('No messages were generated') ||
                      progressData.error.includes('Failed to generate summary with all')) {
                    setError(progressData.error);
                  }
                  break;
                case 'ready_for_summary':
                  // 議論完了、統合回答待ち状態
                  setAwaitingSummary(true);
                  setIsLoading(false);
                  // セッションの中断状態をクリア（議論は正常に完了した）
                  {
                    const latestSession = currentSessionRef.current;
                    if (latestSession && latestSession.interruptedTurn) {
                      const updatedSession: DiscussionSession = {
                        ...latestSession,
                        interruptedTurn: undefined,
                        updatedAt: new Date(),
                      };
                      saveSession(updatedSession).catch(err => console.error('Failed to clear interrupted state:', err));
                      setCurrentSession(updatedSession);
                      setSessions((prev) =>
                        prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
                      );
                    }
                  }
                  break;
                case 'complete':
                  setIsLoading(false);
                  setProgress((prev) => ({ ...prev, isSummarizing: false }));
                  setIsGeneratingFollowUps(false);
                  break;
              }
            } catch {
              // JSON parse error, ignore
            }
          }
        };

        let wasInterrupted = false;

        while (true) {
          // 中断リクエストをチェック
          if (interruptRequestedRef.current) {
            wasInterrupted = true;
            reader.cancel();
            break;
          }

          const { done, value } = await reader.read();
          if (done) {
            // ストリーム終了時にバッファに残っているデータを処理
            if (buffer.trim()) {
              const remainingLines = buffer.split('\n\n');
              for (const line of remainingLines) {
                processLine(line);
              }
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processLine(line);
          }
        }

        // 中断された場合、状態を保存
        if (wasInterrupted) {
          const interruptedState: InterruptedDiscussionState = {
            sessionId: sessionAtStart?.id || '',
            topic,
            participants,
            messages: collectedMessages,
            currentRound: currentProgress.currentRound,
            currentParticipantIndex: currentProgress.currentParticipantIndex,
            totalRounds: terminationConfig.maxRounds,
            searchResults: searchResults.length > 0 ? searchResults : undefined,
            userProfile,
            discussionMode,
            discussionDepth,
            directionGuide,
            terminationConfig,
            interruptedAt: new Date(),
          };
          saveInterruptedState(interruptedState);
          setInterruptedState(interruptedState);
          setIsLoading(false);
          return;
        }

        // 議論完了後、セッションにターンを追加して保存（中断状態もクリア）
        // awaitingSummaryの場合は、統合回答が生成されるまでターンをクリアしない
        if (collectedFinalAnswer) {
          const newTurn = createNewTurn(topic, collectedMessages, collectedFinalAnswer, searchResults.length > 0 ? searchResults : undefined, collectedSummaryPrompt || undefined);
          const latestSession = currentSessionRef.current;

          if (latestSession) {
            const updatedSession: DiscussionSession = {
              ...latestSession,
              turns: [...latestSession.turns, newTurn],
              interruptedTurn: undefined, // 完了したので中断状態をクリア
              updatedAt: new Date(),
            };
            await saveSession(updatedSession);
            setCurrentSession(updatedSession);
            setSessions((prev) =>
              prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
            );
          }
          // localStorageの中断状態もクリア
          clearInterruptedState();
          setInterruptedState(null);

          // 現在のターンをクリア（セッションに保存済み）
          setCurrentTopic('');
          setCurrentMessages([]);
          setCurrentFinalAnswer('');
          setCurrentSearchResults([]);
          setSuggestedFollowUps([]);
        }
        // awaitingSummaryの場合は、現在の状態を維持（ユーザーが投票・統合回答生成できるように）
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    [participants, terminationConfig, searchConfig, userProfile, discussionMode, discussionDepth, directionGuide, messageVotes]
  );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* 左サイドバー: セッション一覧 - デスクトップ */}
      {!isSidebarCollapsed && (
        <div className="hidden md:block">
          <SessionSidebar
            sessions={sessions}
            currentSessionId={currentSession?.id || null}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            disabled={isLoading}
            onCollapse={() => setIsSidebarCollapsed(true)}
          />
        </div>
      )}

      {/* モバイル用サイドバー（オーバーレイ）- md以下でのみ表示 */}
      <div className="md:hidden">
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSession?.id || null}
          onSelectSession={(session) => {
            handleSelectSession(session);
            setIsSidebarOpen(false);
          }}
          onNewSession={() => {
            handleNewSession();
            setIsSidebarOpen(false);
          }}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          disabled={isLoading}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* モバイル用ヘッダー */}
        <MobileHeader
          title="AI Discussion Arena"
          subtitle={currentSession?.title}
          onMenuClick={() => setIsSidebarOpen(true)}
          onNewSession={handleNewSession}
          onSettingsClick={() => setIsSettingsOpen(true)}
          disabled={isLoading}
        />

        {/* デスクトップ用ヘッダー */}
        <header className="hidden md:flex items-center justify-between p-3 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            {/* サイドバーが閉じている時は開くボタンのみ表示 */}
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="サイドバーを開く"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {/* 現在のセッション名 */}
            {currentSession && (
              <p className="text-sm text-gray-400 truncate max-w-md">
                {currentSession.title}
              </p>
            )}
          </div>
          {/* 設定パネル折りたたみボタン */}
          <button
            type="button"
            onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title={isSettingsCollapsed ? '設定を開く' : '設定を閉じる'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </header>

        {/* エラー表示 */}
        {error && (
          <div className="mx-3 md:mx-4 mt-3 md:mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm shrink-0">
            {error}
          </div>
        )}

        {/* 中断された議論の復元バナー */}
        {interruptedState && !isLoading && (
          <div className="mx-3 md:mx-4 mt-3 md:mt-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg shrink-0">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-yellow-200 font-medium text-sm">中断された議論があります</p>
                <p className="text-yellow-300/70 text-xs mt-1 truncate" title={interruptedState.topic}>
                  「{interruptedState.topic}」
                </p>
                <p className="text-yellow-300/60 text-xs mt-0.5">
                  ラウンド {interruptedState.currentRound}/{interruptedState.totalRounds}・
                  {interruptedState.messages.length}件のメッセージ・
                  {new Date(interruptedState.interruptedAt).toLocaleString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}に中断
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDiscardInterrupted}
                  className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded transition-colors"
                >
                  破棄
                </button>
                <button
                  type="button"
                  onClick={handleResumeDiscussion}
                  className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  再開
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 議論パネル */}
        <DiscussionPanel
          turns={currentSession?.turns || []}
          currentMessages={currentMessages}
          currentTopic={currentTopic}
          currentFinalAnswer={currentFinalAnswer}
          currentSummaryPrompt={currentSummaryPrompt}
          isLoading={isLoading}
          isSummarizing={progress.isSummarizing}
          searchResults={currentSearchResults}
          onFollowUp={handleFollowUp}
          onDeepDive={handleDeepDive}
          onCounterargument={handleCounterargument}
          onFork={handleFork}
          messageVotes={messageVotes}
          onVote={handleVote}
          suggestedFollowUps={suggestedFollowUps}
          isGeneratingFollowUps={isGeneratingFollowUps}
          awaitingSummary={awaitingSummary}
          isGeneratingSummary={isGeneratingSummary}
          onGenerateSummary={handleGenerateSummary}
        />

        {/* 進捗インジケーター */}
        <ProgressIndicator
          isActive={isLoading}
          currentRound={progress.currentRound}
          totalRounds={progress.totalRounds}
          currentProvider={progress.currentParticipant?.provider || null}
          currentParticipant={progress.currentParticipant}
          totalProviders={progress.totalParticipants}
          currentProviderIndex={progress.currentParticipantIndex}
          isSummarizing={progress.isSummarizing}
          isSearching={isSearching}
          participants={participants}
          completedParticipants={completedParticipants}
          onInterrupt={handleInterrupt}
        />

        {/* 入力フォーム */}
        <div className="shrink-0">
          <InputForm
            onSubmit={handleStartDiscussion}
            disabled={isLoading || isSearching}
            presetTopic={presetTopic}
            onPresetTopicClear={handlePresetTopicClear}
            searchConfig={searchConfig}
            onSearchConfigChange={setSearchConfig}
            discussionMode={discussionMode}
            onDiscussionModeChange={setDiscussionMode}
            discussionDepth={discussionDepth}
            onDiscussionDepthChange={setDiscussionDepth}
            directionGuide={directionGuide}
            onDirectionGuideChange={setDirectionGuide}
            terminationConfig={terminationConfig}
            onTerminationConfigChange={setTerminationConfig}
          />
        </div>
      </div>

      {/* 参加者パネル - デスクトップ */}
      {!isSettingsCollapsed && (
        <div className="hidden md:block">
          <SettingsPanel
            participants={participants}
            onParticipantsChange={setParticipants}
            availableModels={availableModels}
            availability={availability}
            userProfile={userProfile}
            onUserProfileChange={setUserProfile}
            disabled={isLoading || isSearching}
          />
        </div>
      )}

      {/* モバイル用参加者パネル（オーバーレイ）- md以下でのみ表示 */}
      <div className="md:hidden">
        <SettingsPanel
          participants={participants}
          onParticipantsChange={setParticipants}
          availableModels={availableModels}
          availability={availability}
          userProfile={userProfile}
          onUserProfileChange={setUserProfile}
          disabled={isLoading || isSearching}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </div>
  );
}
