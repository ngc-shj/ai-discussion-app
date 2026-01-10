'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  DiscussionSession,
  DeepDiveType,
  DEEP_DIVE_PRESETS,
  SettingsPreset,
} from '@/types';
import {
  DiscussionPanel,
  SettingsPanel,
  InputForm,
  ProgressIndicator,
  SessionSidebar,
  MobileHeader,
  PresetManagerModal,
} from '@/components';
import { useDiscussionSettings, useSessionManager, useDiscussion, usePresetManager } from '@/hooks';

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

  // 議論状態とアクション（カスタムフックを使用）
  const {
    currentMessages,
    currentFinalAnswer,
    currentSummaryPrompt,
    currentTopic,
    currentSearchResults,
    isLoading,
    isSearching,
    isGeneratingFollowUps,
    summaryState,
    progress,
    completedParticipants,
    suggestedFollowUps,
    error,
    messageVotes,
    discussionParticipants,
    handleVote,
    clearCurrentTurnState,
    restoreDiscussionState,
    handleInterrupt,
    startDiscussion,
    resumeDiscussion,
    generateSummary,
    streamingMessage,
  } = useDiscussion();

  // セッション管理（カスタムフックを使用）
  const {
    sessions,
    currentSession,
    currentSessionRef,
    interruptedState,
    isInitialLoadComplete,
    setSessions,
    setCurrentSession,
    setInterruptedState,
    deleteSession: sessionManagerDeleteSession,
    bulkDeleteSessions: sessionManagerBulkDeleteSessions,
    renameSession: sessionManagerRenameSession,
    updateAndSaveSession,
    discardInterrupted,
  } = useSessionManager();

  // プリセット管理（カスタムフックを使用）
  const {
    presets,
    savePreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    validatePreset,
  } = usePresetManager();

  // サイドバー・設定パネルの開閉状態
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // PC用サイドバー折りたたみ状態
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);
  // フォローアップ用のプリセットトピック
  const [presetTopic, setPresetTopic] = useState<string>('');
  // プリセットモーダルの開閉状態
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  // 初期ロード完了フラグ
  const initialRestoreDoneRef = useRef(false);

  // 初期ロード時に中断状態を復元
  useEffect(() => {
    // 初期ロードが完了し、中断状態があり、まだ復元していない場合のみ実行
    if (!isInitialLoadComplete) return;
    if (!interruptedState) return;
    if (initialRestoreDoneRef.current) return;

    initialRestoreDoneRef.current = true;

    // 設定を復元
    restoreFromSession({
      participants: interruptedState.participants,
      discussionMode: interruptedState.discussionMode,
      discussionDepth: interruptedState.discussionDepth,
      directionGuide: interruptedState.directionGuide,
      terminationConfig: interruptedState.terminationConfig,
      userProfile: interruptedState.userProfile,
    });

    // 議論の表示状態を復元
    restoreDiscussionState({
      topic: interruptedState.topic,
      messages: interruptedState.messages,
      searchResults: interruptedState.searchResults,
      summaryState: interruptedState.summaryState,
    });

    // 統合回答生成中だった場合は自動的に再開
    if (interruptedState.summaryState === 'generating') {
      // 少し遅延させて状態が安定してから再開
      setTimeout(() => {
        generateSummary({
          participants: interruptedState.participants,
          userProfile: interruptedState.userProfile || userProfile,
          discussionMode: interruptedState.discussionMode || discussionMode,
          discussionDepth: interruptedState.discussionDepth || discussionDepth,
          directionGuide: interruptedState.directionGuide || directionGuide,
          searchConfig,
          currentSessionRef,
          setInterruptedState,
          updateAndSaveSession,
        });
      }, 100);
    }
  }, [isInitialLoadComplete, interruptedState, restoreFromSession, restoreDiscussionState, generateSummary, currentSessionRef, setInterruptedState, updateAndSaveSession, userProfile, discussionMode, discussionDepth, directionGuide, searchConfig]);


  // 新しいセッションを開始
  const handleNewSession = useCallback(() => {
    // 議論中の場合は中断状態を保存してからクリア
    // 注: isSearching は isLoading のサブステート（検索中は必ず isLoading も true）
    if (isLoading && currentSession && currentTopic) {
      // 中断フラグを立てる（SSEストリーム処理用）
      handleInterrupt();
      // 中断状態をセッションに即座に保存
      // discussionParticipantsが空の場合はparticipantsを使用
      const interruptedTurn = {
        topic: currentTopic,
        participants: discussionParticipants.length > 0 ? discussionParticipants : participants,
        messages: currentMessages,
        currentRound: progress.currentRound,
        currentParticipantIndex: progress.currentParticipantIndex,
        totalRounds: progress.totalRounds,
        searchResults: currentSearchResults.length > 0 ? currentSearchResults : undefined,
        userProfile,
        discussionMode,
        discussionDepth,
        directionGuide,
        terminationConfig,
        interruptedAt: new Date(),
        summaryState: 'idle' as const,
      };
      updateAndSaveSession({ interruptedTurn });
    }
    setCurrentSession(null);
    clearCurrentTurnState();
  }, [
    isLoading,
    currentSession,
    currentTopic,
    currentMessages,
    currentSearchResults,
    discussionParticipants,
    participants,
    progress,
    userProfile,
    discussionMode,
    discussionDepth,
    directionGuide,
    terminationConfig,
    handleInterrupt,
    updateAndSaveSession,
    setCurrentSession,
    clearCurrentTurnState,
  ]);

  // セッションを選択
  const handleSelectSession = useCallback((session: DiscussionSession) => {
    setCurrentSession(session);

    // セッションに中断状態がある場合、interruptedStateにセットし、設定も復元
    if (session.interruptedTurn) {
      const turn = session.interruptedTurn;

      // 中断時の設定を復元（参加者を含む）
      restoreFromSession({
        participants: turn.participants || session.participants,
        discussionMode: turn.discussionMode,
        discussionDepth: turn.discussionDepth,
        directionGuide: turn.directionGuide,
        terminationConfig: turn.terminationConfig,
        userProfile: turn.userProfile,
      });

      // 議論の表示状態を復元（メッセージ、トピック、summaryState等）
      restoreDiscussionState({
        topic: turn.topic,
        messages: turn.messages,
        searchResults: turn.searchResults,
        summaryState: turn.summaryState,
      });

      setInterruptedState({
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
        summaryState: turn.summaryState,
      });

      // 統合回答生成中だった場合は自動的に再開
      if (turn.summaryState === 'generating') {
        setTimeout(() => {
          generateSummary({
            participants: turn.participants || session.participants,
            userProfile: turn.userProfile || userProfile,
            discussionMode: turn.discussionMode || discussionMode,
            discussionDepth: turn.discussionDepth || discussionDepth,
            directionGuide: turn.directionGuide || directionGuide,
            searchConfig,
            currentSessionRef,
            setInterruptedState,
            updateAndSaveSession,
          });
        }, 100);
      }
    } else {
      // 中断状態がない場合は現在の表示をクリア
      clearCurrentTurnState();
      setInterruptedState(null);
    }
  }, [restoreFromSession, restoreDiscussionState, clearCurrentTurnState, setCurrentSession, setInterruptedState, generateSummary, userProfile, discussionMode, discussionDepth, directionGuide, currentSessionRef, updateAndSaveSession]);

  // セッションを削除
  const handleDeleteSession = useCallback(async (id: string) => {
    await sessionManagerDeleteSession(id);
    if (currentSession?.id === id) {
      clearCurrentTurnState();
    }
  }, [currentSession, sessionManagerDeleteSession, clearCurrentTurnState]);

  // セッションを一括削除
  const handleBulkDeleteSessions = useCallback(async (ids: string[]) => {
    await sessionManagerBulkDeleteSessions(ids);
    if (currentSession && ids.includes(currentSession.id)) {
      clearCurrentTurnState();
    }
  }, [currentSession, sessionManagerBulkDeleteSessions, clearCurrentTurnState]);

  // セッションの名前を変更
  const handleRenameSession = useCallback(async (id: string, newTitle: string) => {
    await sessionManagerRenameSession(id, newTitle);
  }, [sessionManagerRenameSession]);

  // フォローアップ質問を設定
  const handleFollowUp = useCallback((topic: string, _previousAnswer: string) => {
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

  // 中断状態を破棄
  const handleDiscardInterrupted = useCallback(() => {
    discardInterrupted();
  }, [discardInterrupted]);

  // 現在の設定をプリセットとして保存
  const handleSaveAsPreset = useCallback((name: string, description?: string) => {
    savePreset({
      name,
      description,
      participants,
      discussionMode,
      discussionDepth,
      directionGuide,
      terminationConfig,
      searchConfig,
      userProfile,
    });
  }, [savePreset, participants, discussionMode, discussionDepth, directionGuide, terminationConfig, searchConfig, userProfile]);

  // プリセットを読み込み
  const handleLoadPreset = useCallback((preset: SettingsPreset) => {
    // 利用可能なモデルのみをフィルタリング
    const validation = validatePreset(preset, availableModels);
    let validParticipants = preset.participants;
    if (!validation.isValid) {
      validParticipants = preset.participants.filter((p) => {
        const providerModels = availableModels[p.provider] || [];
        return providerModels.some((m) => m.id === p.model);
      });
    }

    // 全設定を適用
    setParticipants(validParticipants);
    setDiscussionMode(preset.discussionMode);
    setDiscussionDepth(preset.discussionDepth);
    setDirectionGuide(preset.directionGuide);
    setTerminationConfig(preset.terminationConfig);
    setSearchConfig(preset.searchConfig);
    setUserProfile(preset.userProfile);
  }, [validatePreset, availableModels, setParticipants, setDiscussionMode, setDiscussionDepth, setDirectionGuide, setTerminationConfig, setSearchConfig, setUserProfile]);

  // プリセットを検証
  const handleValidatePreset = useCallback((preset: SettingsPreset) => {
    return validatePreset(preset, availableModels);
  }, [validatePreset, availableModels]);

  // 統合回答を生成
  const handleGenerateSummary = useCallback(async () => {
    await generateSummary({
      participants,
      userProfile,
      discussionMode,
      discussionDepth,
      directionGuide,
      searchConfig,
      currentSessionRef,
      setInterruptedState,
      updateAndSaveSession,
    });
  }, [participants, userProfile, discussionMode, discussionDepth, directionGuide, searchConfig, currentSessionRef, setInterruptedState, updateAndSaveSession, generateSummary]);

  // 中断した議論を再開
  const handleResumeDiscussion = useCallback(async () => {
    if (!interruptedState) return;
    await resumeDiscussion({
      interruptedState,
      restoreFromSession,
      currentSessionRef,
      setCurrentSession,
      setSessions,
      setInterruptedState,
      updateAndSaveSession,
    });
  }, [interruptedState, restoreFromSession, currentSessionRef, setCurrentSession, setSessions, setInterruptedState, updateAndSaveSession, resumeDiscussion]);

  // 議論を開始
  const handleStartDiscussion = useCallback(async (topic: string) => {
    await startDiscussion({
      topic,
      participants,
      terminationConfig,
      searchConfig,
      userProfile,
      discussionMode,
      discussionDepth,
      directionGuide,
      currentSessionRef,
      setCurrentSession,
      setSessions,
      setInterruptedState,
      updateAndSaveSession,
    });
  }, [participants, terminationConfig, searchConfig, userProfile, discussionMode, discussionDepth, directionGuide, currentSessionRef, setCurrentSession, setSessions, setInterruptedState, updateAndSaveSession, startDiscussion]);

  // 無効化条件
  const isSettingsDisabled = isLoading || isSearching || summaryState === 'generating';
  // セッション選択の無効化条件（実行中のみ無効にし、投票待ちなどでは選択可能）
  const isSessionSelectionDisabled = isLoading;

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
            onBulkDeleteSessions={handleBulkDeleteSessions}
            onRenameSession={handleRenameSession}
            disabled={isSessionSelectionDisabled}
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
          onBulkDeleteSessions={handleBulkDeleteSessions}
          onRenameSession={handleRenameSession}
          disabled={isSessionSelectionDisabled}
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
          onPresetClick={() => setIsPresetModalOpen(true)}
          presetCount={presets.length}
          disabled={isSettingsDisabled}
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
          <div className="flex items-center gap-1">
            {/* プリセット管理ボタン */}
            <button
              type="button"
              onClick={() => setIsPresetModalOpen(true)}
              disabled={isSettingsDisabled}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="全設定プリセット（参加者・議論オプションを保存/読込）"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {presets.length > 0 && (
                <span className="text-xs text-indigo-400">{presets.length}</span>
              )}
            </button>
            {/* 参加者パネル折りたたみボタン */}
            <button
              type="button"
              onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title={isSettingsCollapsed ? '参加者パネルを開く' : '参加者パネルを閉じる'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
          </div>
        </header>

        {/* エラー表示 */}
        {error && (
          <div className="mx-3 md:mx-4 mt-3 md:mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm shrink-0">
            {error}
          </div>
        )}

        {/* 中断された議論の復元バナー */}
        {interruptedState && !isLoading && interruptedState.summaryState !== 'awaiting' && interruptedState.summaryState !== 'generating' && (
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
          participants={isLoading ? discussionParticipants : participants}
          currentTopic={currentTopic}
          currentFinalAnswer={currentFinalAnswer}
          currentSummaryPrompt={currentSummaryPrompt}
          isLoading={isLoading}
          summaryState={summaryState}
          searchResults={currentSearchResults}
          onFollowUp={handleFollowUp}
          onDeepDive={handleDeepDive}
          onCounterargument={handleCounterargument}
          onFork={handleFork}
          messageVotes={messageVotes}
          onVote={handleVote}
          suggestedFollowUps={suggestedFollowUps}
          isGeneratingFollowUps={isGeneratingFollowUps}
          onGenerateSummary={handleGenerateSummary}
          streamingMessage={streamingMessage}
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
          isSummarizing={summaryState === 'generating' && !streamingMessage}
          isSummaryStreaming={summaryState === 'generating' && !!streamingMessage}
          isSearching={isSearching}
          isStreaming={!!streamingMessage}
          isGeneratingFollowUps={isGeneratingFollowUps}
          summaryState={summaryState}
          participants={isLoading || summaryState !== 'idle' ? discussionParticipants : participants}
          completedParticipants={completedParticipants}
          onInterrupt={handleInterrupt}
        />

        {/* 入力フォーム */}
        <div className="shrink-0">
          <InputForm
            onSubmit={handleStartDiscussion}
            disabled={isSettingsDisabled}
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
            disabled={isSettingsDisabled}
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
          disabled={isSettingsDisabled}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>

      {/* プリセット管理モーダル */}
      <PresetManagerModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        presets={presets}
        onLoadPreset={handleLoadPreset}
        onSaveCurrentAsPreset={handleSaveAsPreset}
        onRenamePreset={(id, name) => updatePreset(id, { name })}
        onDeletePreset={deletePreset}
        onDuplicatePreset={duplicatePreset}
        validatePreset={handleValidatePreset}
      />
    </div>
  );
}
