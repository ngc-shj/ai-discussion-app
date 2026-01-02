'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DiscussionMessage,
  DiscussionParticipant,
  DiscussionSession,
  PreviousTurnSummary,
  SearchResult,
  MessageVote,
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
import { processSSEStream, SSEEventHandlers } from '@/lib/sse-utils';
import { InterruptedDiscussionState, InterruptedTurnState } from '@/types';
import { useDiscussionSettings } from '@/hooks';

interface ProgressState {
  currentRound: number;
  totalRounds: number;
  currentParticipantIndex: number;
  totalParticipants: number;
  currentParticipant: DiscussionParticipant | null;
  isSummarizing: boolean;
}

export default function Home() {
  // 設定関連（カスタムフックを使用）
  const {
    participants,
    setParticipants,
    availableModels,
    availability,
    searchConfig,
    setSearchConfig,
    userProfile,
    setUserProfile,
    discussionMode,
    setDiscussionMode,
    discussionDepth,
    setDiscussionDepth,
    directionGuide,
    setDirectionGuide,
    terminationConfig,
    setTerminationConfig,
    restoreFromSession,
  } = useDiscussionSettings();

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

  // その他の状態
  const [messageVotes, setMessageVotes] = useState<MessageVote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResult[]>([]);
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

  // 投票を追加/更新するハンドラー
  const handleVote = useCallback((messageId: string, vote: 'agree' | 'disagree' | 'neutral') => {
    setMessageVotes((prev: MessageVote[]) => {
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

      // 中断時の設定を復元
      restoreFromSession({
        participants: turn.participants || session.participants,
        discussionMode: turn.discussionMode,
        discussionDepth: turn.discussionDepth,
        directionGuide: turn.directionGuide,
        terminationConfig: turn.terminationConfig,
        userProfile: turn.userProfile,
      });

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
      restoreFromSession({
        participants: session.participants,
        rounds: session.rounds,
      });
      setInterruptedState(null);
    }
  }, [restoreFromSession]);

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

    // 収集用の変数
    let collectedFinalAnswer = '';
    let collectedSummaryPrompt = '';

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      // SSEストリーム処理
      const handlers: SSEEventHandlers = {
        onProgress: (progress) => {
          if (progress.isSummarizing) {
            setProgress((prev) => ({ ...prev, isSummarizing: true }));
          }
        },
        onSummary: (finalAnswer, summaryPrompt) => {
          collectedFinalAnswer = finalAnswer;
          collectedSummaryPrompt = summaryPrompt || '';
          setCurrentFinalAnswer(finalAnswer);
          setCurrentSummaryPrompt(summaryPrompt || '');
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
          setIsGeneratingFollowUps(true);
        },
        onFollowups: (followups) => {
          setSuggestedFollowUps(followups);
          setIsGeneratingFollowUps(false);
        },
        onError: (error) => {
          console.error('Summary error:', error);
          setError(error);
        },
        onComplete: () => {
          setIsGeneratingSummary(false);
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
          setIsGeneratingFollowUps(false);
        },
      };

      await processSSEStream(response, handlers);

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
    restoreFromSession({
      participants: interruptedState.participants,
      discussionMode: interruptedState.discussionMode,
      discussionDepth: interruptedState.discussionDepth,
      directionGuide: interruptedState.directionGuide,
      terminationConfig: interruptedState.terminationConfig,
      userProfile: interruptedState.userProfile,
    });

    // セッションを復元し、中断状態をクリア
    const session = await getAllSessions().then(sessions =>
      sessions.find(s => s.id === interruptedState.sessionId)
    );
    if (session) {
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

    // 収集用の変数（クロージャでキャプチャ）
    let collectedMessages: DiscussionMessage[] = [...interruptedState.messages];
    let collectedFinalAnswer = '';
    let collectedSummaryPrompt = '';
    let currentProgressState = {
      currentRound: interruptedState.currentRound,
      currentParticipantIndex: interruptedState.currentParticipantIndex,
    };
    const resumeSession = currentSessionRef.current;

    try {
      const response = await fetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      // SSEストリーム処理
      const handlers: SSEEventHandlers = {
        onProgress: (progress) => {
          currentProgressState = {
            currentRound: progress.currentRound,
            currentParticipantIndex: progress.currentParticipantIndex,
          };
          setProgress({
            currentRound: progress.currentRound,
            totalRounds: progress.totalRounds,
            currentParticipantIndex: progress.currentParticipantIndex,
            totalParticipants: progress.totalParticipants,
            currentParticipant: progress.currentParticipant,
            isSummarizing: progress.isSummarizing,
          });
        },
        onMessage: (message) => {
          collectedMessages = [...collectedMessages, message];
          setCurrentMessages(collectedMessages);
          setCompletedParticipants(prev => {
            const newSet = new Set(prev);
            newSet.add(`${message.provider}-${message.model}`);
            return newSet;
          });
          // メッセージ受信のたびにセッションの中断状態を更新（自動保存）
          const latestSession = currentSessionRef.current;
          if (latestSession) {
            const interruptedTurn: InterruptedTurnState = {
              topic: interruptedState.topic,
              participants: interruptedState.participants,
              messages: collectedMessages,
              currentRound: currentProgressState.currentRound,
              currentParticipantIndex: currentProgressState.currentParticipantIndex,
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
        },
        onSummary: (finalAnswer, summaryPrompt) => {
          collectedFinalAnswer = finalAnswer;
          collectedSummaryPrompt = summaryPrompt || '';
          setCurrentFinalAnswer(finalAnswer);
          setCurrentSummaryPrompt(summaryPrompt || '');
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
          setIsGeneratingFollowUps(true);
        },
        onFollowups: (followups) => {
          setSuggestedFollowUps(followups);
          setIsGeneratingFollowUps(false);
        },
        onError: (error) => {
          console.error('Discussion error:', error);
          if (error.includes('No messages were generated') ||
              error.includes('Failed to generate summary with all')) {
            setError(error);
          }
        },
        onComplete: () => {
          setIsLoading(false);
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
        },
      };

      const wasInterrupted = await processSSEStream(
        response,
        handlers,
        () => interruptRequestedRef.current
      );

      // 中断された場合、状態を保存
      if (wasInterrupted) {
        const newInterruptedState: InterruptedDiscussionState = {
          sessionId: resumeSession?.id || '',
          topic: interruptedState.topic,
          participants: interruptedState.participants,
          messages: collectedMessages,
          currentRound: currentProgressState.currentRound,
          currentParticipantIndex: currentProgressState.currentParticipantIndex,
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

      // 議論完了後、セッションにターンを追加して保存
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
            interruptedTurn: undefined,
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
  }, [interruptedState, restoreFromSession]);

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
      interruptRequestedRef.current = false;
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
        } finally {
          setIsSearching(false);
        }
      }

      // 過去のターンを取得（継続議論用）
      let sessionAtStart = currentSessionRef.current;
      const previousTurns: PreviousTurnSummary[] = sessionAtStart?.turns.map((t) => ({
        topic: t.topic,
        finalAnswer: t.finalAnswer,
      })) || [];

      // まだセッションに保存されていない直前のターンがあれば追加
      if (prevTopic && prevFinalAnswer) {
        previousTurns.push({ topic: prevTopic, finalAnswer: prevFinalAnswer });
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

      // 収集用の変数（クロージャでキャプチャ）
      let collectedMessages: DiscussionMessage[] = [];
      let collectedFinalAnswer = '';
      let collectedSummaryPrompt = '';
      let currentProgressState = { currentRound: 1, currentParticipantIndex: 0 };

      try {
        const response = await fetch('/api/discuss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            skipSummary: true,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start discussion');
        }

        // SSEストリーム処理
        const handlers: SSEEventHandlers = {
          onProgress: (progress) => {
            currentProgressState = {
              currentRound: progress.currentRound,
              currentParticipantIndex: progress.currentParticipantIndex,
            };
            setProgress({
              currentRound: progress.currentRound,
              totalRounds: progress.totalRounds,
              currentParticipantIndex: progress.currentParticipantIndex,
              totalParticipants: progress.totalParticipants,
              currentParticipant: progress.currentParticipant,
              isSummarizing: progress.isSummarizing,
            });
          },
          onMessage: (message) => {
            collectedMessages = [...collectedMessages, message];
            setCurrentMessages(collectedMessages);
            setCompletedParticipants(prev => {
              const newSet = new Set(prev);
              newSet.add(`${message.provider}-${message.model}`);
              return newSet;
            });
            // メッセージ受信のたびにセッションの中断状態を更新（自動保存）
            const latestSession = currentSessionRef.current;
            if (latestSession) {
              const interruptedTurn: InterruptedTurnState = {
                topic,
                participants,
                messages: collectedMessages,
                currentRound: currentProgressState.currentRound,
                currentParticipantIndex: currentProgressState.currentParticipantIndex,
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
              setSessions((prev) =>
                prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
              );
            }
          },
          onSummary: (finalAnswer, summaryPrompt) => {
            collectedFinalAnswer = finalAnswer;
            collectedSummaryPrompt = summaryPrompt || '';
            setCurrentFinalAnswer(finalAnswer);
            setCurrentSummaryPrompt(summaryPrompt || '');
            setProgress((prev) => ({ ...prev, isSummarizing: false }));
            setIsGeneratingFollowUps(true);
          },
          onFollowups: (followups) => {
            setSuggestedFollowUps(followups);
            setIsGeneratingFollowUps(false);
          },
          onError: (error) => {
            console.error('Discussion error:', error);
            if (error.includes('No messages were generated') ||
                error.includes('Failed to generate summary with all')) {
              setError(error);
            }
          },
          onReadyForSummary: () => {
            setAwaitingSummary(true);
            setIsLoading(false);
            // セッションの中断状態をクリア（議論は正常に完了した）
            const latestSession = currentSessionRef.current;
            if (latestSession) {
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
          },
          onComplete: () => {
            setIsLoading(false);
            setProgress((prev) => ({ ...prev, isSummarizing: false }));
            setIsGeneratingFollowUps(false);
          },
        };

        const wasInterrupted = await processSSEStream(
          response,
          handlers,
          () => interruptRequestedRef.current
        );

        // 中断された場合、状態を保存
        if (wasInterrupted) {
          const interrupted: InterruptedDiscussionState = {
            sessionId: sessionAtStart?.id || '',
            topic,
            participants,
            messages: collectedMessages,
            currentRound: currentProgressState.currentRound,
            currentParticipantIndex: currentProgressState.currentParticipantIndex,
            totalRounds: terminationConfig.maxRounds,
            searchResults: searchResults.length > 0 ? searchResults : undefined,
            userProfile,
            discussionMode,
            discussionDepth,
            directionGuide,
            terminationConfig,
            interruptedAt: new Date(),
          };
          saveInterruptedState(interrupted);
          setInterruptedState(interrupted);
          setIsLoading(false);
          return;
        }

        // 議論完了後、セッションにターンを追加して保存
        if (collectedFinalAnswer) {
          const newTurn = createNewTurn(
            topic,
            collectedMessages,
            collectedFinalAnswer,
            searchResults.length > 0 ? searchResults : undefined,
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
          clearInterruptedState();
          setInterruptedState(null);

          setCurrentTopic('');
          setCurrentMessages([]);
          setCurrentFinalAnswer('');
          setCurrentSearchResults([]);
          setSuggestedFollowUps([]);
        }
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
