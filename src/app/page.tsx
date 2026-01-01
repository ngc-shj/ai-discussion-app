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
} from '@/lib/session-storage';

const STORAGE_KEY_PARTICIPANTS = 'ai-discussion-participants';
const STORAGE_KEY_ROUNDS = 'ai-discussion-rounds';
const STORAGE_KEY_SEARCH = 'ai-discussion-search';
const STORAGE_KEY_PROFILE = 'ai-discussion-profile';

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
  const [rounds, setRounds] = useState(2);
  const [searchConfig, setSearchConfig] = useState<SearchConfig>(DEFAULT_SEARCH_CONFIG);
  const [userProfile, setUserProfile] = useState<UserProfile>({});
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
              const validParticipants = parsed.filter((p) => {
                const providerModels = data[p.provider] || [];
                return providerModels.some((m: ModelInfo) => m.id === p.model);
              });
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

    // ローカルストレージからラウンド数を復元
    const savedRounds = localStorage.getItem(STORAGE_KEY_ROUNDS);
    if (savedRounds) {
      const parsed = parseInt(savedRounds, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        setRounds(parsed);
      }
    }

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
  }, []);

  // 参加者が変更されたらローカルストレージに保存
  useEffect(() => {
    if (participants.length > 0) {
      localStorage.setItem(STORAGE_KEY_PARTICIPANTS, JSON.stringify(participants));
    }
  }, [participants]);

  // ラウンド数が変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ROUNDS, rounds.toString());
  }, [rounds]);

  // 検索設定が変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify(searchConfig));
  }, [searchConfig]);

  // プロファイルが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(userProfile));
  }, [userProfile]);

  // 新しいセッションを開始
  const handleNewSession = useCallback(() => {
    setCurrentSession(null);
    setCurrentMessages([]);
    setCurrentFinalAnswer('');
    setCurrentTopic('');
    setError(null);
  }, []);

  // セッションを選択
  const handleSelectSession = useCallback((session: DiscussionSession) => {
    setCurrentSession(session);
    setCurrentMessages([]);
    setCurrentFinalAnswer('');
    setCurrentTopic('');
    setError(null);

    // セッションの参加者設定を適用
    if (session.participants.length > 0) {
      setParticipants(session.participants);
    }
    if (session.rounds) {
      setRounds(session.rounds);
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
  const handleFollowUp = useCallback((topic: string, previousAnswer: string) => {
    // 回答の最初の100文字を参考として含める
    const answerPreview = previousAnswer.slice(0, 100) + (previousAnswer.length > 100 ? '...' : '');
    const followUpPrompt = `「${topic}」についてもう少し詳しく教えてください。特に以下の点について深掘りしたいです：\n\n（前回の回答より: ${answerPreview}）`;
    setPresetTopic(followUpPrompt);
  }, []);

  // プリセットトピックをクリア
  const handlePresetTopicClear = useCallback(() => {
    setPresetTopic('');
  }, []);

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

      setCurrentMessages([]);
      setCurrentFinalAnswer('');
      setCurrentSearchResults([]);
      setError(null);
      setIsLoading(true);
      setCurrentTopic(topic);
      setCompletedParticipants(new Set());
      setProgress({
        currentRound: 1,
        totalRounds: rounds,
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

      // 新規セッションの場合、議論開始時にセッションを作成
      if (!sessionAtStart) {
        const newSession = createNewSession(
          topic.slice(0, 50) + (topic.length > 50 ? '...' : ''),
          participants,
          rounds
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
            rounds,
            previousTurns,
            searchResults,
            userProfile,
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

        const processLine = (line: string) => {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const progressData = JSON.parse(data);

              switch (progressData.type) {
                case 'progress':
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
                  break;
                case 'summary':
                  collectedFinalAnswer = progressData.finalAnswer;
                  setCurrentFinalAnswer(collectedFinalAnswer);
                  setProgress((prev) => ({ ...prev, isSummarizing: false }));
                  break;
                case 'error':
                  console.error('Discussion error:', progressData.error);
                  // 致命的なエラー（全プロバイダー失敗、統合回答生成失敗）のみ表示
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

        while (true) {
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

        // 議論完了後、セッションにターンを追加して保存
        if (collectedFinalAnswer) {
          const newTurn = createNewTurn(topic, collectedMessages, collectedFinalAnswer, searchResults.length > 0 ? searchResults : undefined);
          const latestSession = currentSessionRef.current;

          if (latestSession) {
            const updatedSession: DiscussionSession = {
              ...latestSession,
              turns: [...latestSession.turns, newTurn],
              updatedAt: new Date(),
            };
            await saveSession(updatedSession);
            setCurrentSession(updatedSession);
            setSessions((prev) =>
              prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
            );
          }

          // 現在のターンをクリア（セッションに保存済み）
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
    },
    [participants, rounds, searchConfig, userProfile]
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

        {/* 議論パネル */}
        <DiscussionPanel
          turns={currentSession?.turns || []}
          currentMessages={currentMessages}
          currentTopic={currentTopic}
          currentFinalAnswer={currentFinalAnswer}
          isLoading={isLoading}
          isSummarizing={progress.isSummarizing}
          searchResults={currentSearchResults}
          onFollowUp={handleFollowUp}
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
        />

        {/* 入力フォーム */}
        <div className="shrink-0">
          <InputForm
            onSubmit={handleStartDiscussion}
            disabled={isLoading || isSearching}
            presetTopic={presetTopic}
            onPresetTopicClear={handlePresetTopicClear}
          />
        </div>
      </div>

      {/* 設定パネル - デスクトップ */}
      {!isSettingsCollapsed && (
        <div className="hidden md:block">
          <SettingsPanel
            participants={participants}
            onParticipantsChange={setParticipants}
            availableModels={availableModels}
            availability={availability}
            rounds={rounds}
            onRoundsChange={setRounds}
            searchConfig={searchConfig}
            onSearchConfigChange={setSearchConfig}
            userProfile={userProfile}
            onUserProfileChange={setUserProfile}
            disabled={isLoading || isSearching}
          />
        </div>
      )}

      {/* モバイル用設定パネル（オーバーレイ）- md以下でのみ表示 */}
      <div className="md:hidden">
        <SettingsPanel
          participants={participants}
          onParticipantsChange={setParticipants}
          availableModels={availableModels}
          availability={availability}
          rounds={rounds}
          onRoundsChange={setRounds}
          searchConfig={searchConfig}
          onSearchConfigChange={setSearchConfig}
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
