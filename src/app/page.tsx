'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  DiscussionSession,
  DeepDiveType,
  DEEP_DIVE_PRESETS,
  SettingsPreset,
  ExtendDiscussionConfig,
} from '@/types';
import {
  DiscussionPanel,
  ParticipantsPanel,
  SettingsModal,
  InputForm,
  ProgressIndicator,
  SessionSidebar,
  MobileHeader,
  PresetManagerModal,
} from '@/components';
import { useDiscussionSettings, useSessionManager, useDiscussion, usePresetManager, useApiKeys } from '@/hooks';

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
    currentSearchKeywords,
    isDiscussing,
    isSearching,
    searchProgress,
    isGeneratingFollowUps,
    isProcessing,
    summaryPhase,
    discussionProgress,
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
    extendDiscussion,
    finalizeDiscussion,
    generateFollowUps,
    streamingMessage,
    startMarker,
    extensionMarkers,
    currentDiscussionMode,
    currentDiscussionDepth,
    currentDirectionGuide,
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

  // APIキー管理
  const {
    apiKeys,
    setApiKey,
    saveApiKeys,
    hasUnsavedChanges: hasUnsavedApiKeyChanges,
    isUrlValid,
  } = useApiKeys();

  // サイドバー・設定パネルの開閉状態
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // PC用サイドバー折りたたみ状態
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);
  // 設定モーダルの開閉状態
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
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
      searchKeywords: interruptedState.searchKeywords,
      // 統合回答生成中だった場合は'awaiting'として扱い、ボタンを表示
      summaryPhase: interruptedState.summaryPhase === 'generating' ? 'awaiting' : interruptedState.summaryPhase,
      startMarker: interruptedState.startMarker,
      extensionMarkers: interruptedState.extensionMarkers,
      discussionMode: interruptedState.discussionMode,
      discussionDepth: interruptedState.discussionDepth,
      directionGuide: interruptedState.directionGuide,
      terminationConfig: interruptedState.terminationConfig,
    });
  }, [isInitialLoadComplete, interruptedState, restoreFromSession, restoreDiscussionState]);


  // 新しいセッションを開始
  const handleNewSession = useCallback(() => {
    // 議論中の場合は中断状態を保存してからクリア
    // 注: isSearching は isDiscussing のサブステート（検索中は必ず isDiscussing も true）
    // currentSessionRefを使用（Reactの状態更新が非同期のため、currentSessionがまだnullの場合がある）
    const sessionToSave = currentSessionRef.current;
    if (isDiscussing && sessionToSave && currentTopic) {
      // 中断フラグを立てる（SSEストリーム処理用）
      handleInterrupt();
      // 中断状態をセッションに即座に保存
      // discussionParticipantsが空の場合はparticipantsを使用
      const interruptedTurn = {
        topic: currentTopic,
        participants: discussionParticipants.length > 0 ? discussionParticipants : participants,
        messages: currentMessages,
        currentRound: discussionProgress.currentRound,
        currentParticipantIndex: discussionProgress.currentParticipantIndex,
        totalRounds: discussionProgress.totalRounds,
        searchResults: currentSearchResults.length > 0 ? currentSearchResults : undefined,
        searchKeywords: currentSearchKeywords.length > 0 ? currentSearchKeywords : undefined,
        searchConfig,
        userProfile,
        discussionMode,
        discussionDepth,
        directionGuide,
        terminationConfig,
        interruptedAt: new Date(),
        summaryPhase: 'idle' as const,
        startMarker: startMarker || undefined,
        extensionMarkers: extensionMarkers.length > 0 ? extensionMarkers : undefined,
      };
      updateAndSaveSession({ interruptedTurn });
    }
    setCurrentSession(null);
    clearCurrentTurnState();
  }, [
    isDiscussing,
    currentSessionRef,
    currentTopic,
    currentMessages,
    currentSearchResults,
    currentSearchKeywords,
    searchConfig,
    discussionParticipants,
    participants,
    discussionProgress,
    userProfile,
    discussionMode,
    discussionDepth,
    directionGuide,
    terminationConfig,
    startMarker,
    extensionMarkers,
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

      // 議論の表示状態を復元（メッセージ、トピック、summaryPhase等）
      restoreDiscussionState({
        topic: turn.topic,
        messages: turn.messages,
        searchResults: turn.searchResults,
        searchKeywords: turn.searchKeywords,
        // 統合回答生成中だった場合は'awaiting'として扱い、ボタンを表示
        summaryPhase: turn.summaryPhase === 'generating' ? 'awaiting' : turn.summaryPhase,
        startMarker: turn.startMarker,
        extensionMarkers: turn.extensionMarkers,
        discussionMode: turn.discussionMode,
        discussionDepth: turn.discussionDepth,
        directionGuide: turn.directionGuide,
        terminationConfig: turn.terminationConfig,
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
        searchKeywords: turn.searchKeywords,
        searchTiming: turn.searchTiming, // 検索タイミングを復元
        searchConfig: turn.searchConfig,
        userProfile: turn.userProfile,
        discussionMode: turn.discussionMode,
        discussionDepth: turn.discussionDepth,
        directionGuide: turn.directionGuide,
        terminationConfig: turn.terminationConfig,
        interruptedAt: turn.interruptedAt,
        // 統合回答生成中だった場合は'awaiting'として扱い、ボタンを表示
        summaryPhase: turn.summaryPhase === 'generating' ? 'awaiting' : turn.summaryPhase,
        // マーカーを復元
        startMarker: turn.startMarker,
        extensionMarkers: turn.extensionMarkers,
      });
    } else {
      // 中断状態がない場合は現在の表示をクリア
      clearCurrentTurnState();
      setInterruptedState(null);
      // セッションに保存された参加者を復元
      if (session.participants && session.participants.length > 0) {
        restoreFromSession({
          participants: session.participants,
        });
      }
    }
  }, [restoreFromSession, restoreDiscussionState, clearCurrentTurnState, setCurrentSession, setInterruptedState]);

  // セッションを削除
  const handleDeleteSession = useCallback(async (id: string) => {
    await sessionManagerDeleteSession(id);
    if (currentSession?.id === id) {
      clearCurrentTurnState();
    }
    // 削除されたセッションの中断状態もクリア
    if (interruptedState?.sessionId === id) {
      setInterruptedState(null);
    }
  }, [currentSession, interruptedState, sessionManagerDeleteSession, clearCurrentTurnState, setInterruptedState]);

  // セッションを一括削除
  const handleBulkDeleteSessions = useCallback(async (ids: string[]) => {
    await sessionManagerBulkDeleteSessions(ids);
    if (currentSession && ids.includes(currentSession.id)) {
      clearCurrentTurnState();
    }
    // 削除されたセッションの中断状態もクリア
    if (interruptedState && ids.includes(interruptedState.sessionId)) {
      setInterruptedState(null);
    }
  }, [currentSession, interruptedState, sessionManagerBulkDeleteSessions, clearCurrentTurnState, setInterruptedState]);

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

  // 中断ボタンが押されたときの処理（状態保存を含む）
  const handleInterruptWithSave = useCallback(() => {
    // 中断フラグを立てる（SSEストリーム処理用）
    handleInterrupt();

    // 現在のセッションに中断状態を保存
    const sessionToSave = currentSessionRef.current;
    if (sessionToSave && currentTopic) {
      const interruptedTurn = {
        topic: currentTopic,
        participants: discussionParticipants.length > 0 ? discussionParticipants : participants,
        messages: currentMessages,
        currentRound: discussionProgress.currentRound,
        currentParticipantIndex: discussionProgress.currentParticipantIndex,
        totalRounds: discussionProgress.totalRounds,
        searchResults: currentSearchResults.length > 0 ? currentSearchResults : undefined,
        searchKeywords: currentSearchKeywords.length > 0 ? currentSearchKeywords : undefined,
        searchConfig,
        userProfile,
        discussionMode,
        discussionDepth,
        directionGuide,
        terminationConfig,
        interruptedAt: new Date(),
        summaryPhase: 'idle' as const,
        startMarker: startMarker || undefined,
        extensionMarkers: extensionMarkers.length > 0 ? extensionMarkers : undefined,
      };
      updateAndSaveSession({ interruptedTurn });
    }
  }, [
    handleInterrupt,
    currentSessionRef,
    currentTopic,
    currentMessages,
    currentSearchResults,
    currentSearchKeywords,
    searchConfig,
    discussionParticipants,
    participants,
    discussionProgress,
    userProfile,
    discussionMode,
    discussionDepth,
    directionGuide,
    terminationConfig,
    startMarker,
    extensionMarkers,
    updateAndSaveSession,
  ]);

  // 現在の設定をプリセットとして保存（userProfileは個人設定のため除外）
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
    });
  }, [savePreset, participants, discussionMode, discussionDepth, directionGuide, terminationConfig, searchConfig]);

  // プリセットを読み込み（userProfileは個人設定のため適用しない）
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

    // 議論設定を適用
    setParticipants(validParticipants);
    setDiscussionMode(preset.discussionMode);
    setDiscussionDepth(preset.discussionDepth);
    setDirectionGuide(preset.directionGuide);
    setTerminationConfig(preset.terminationConfig);
    setSearchConfig(preset.searchConfig);
  }, [validatePreset, availableModels, setParticipants, setDiscussionMode, setDiscussionDepth, setDirectionGuide, setTerminationConfig, setSearchConfig]);

  // プリセットを検証
  const handleValidatePreset = useCallback((preset: SettingsPreset) => {
    return validatePreset(preset, availableModels);
  }, [validatePreset, availableModels]);

  // 議論を最終化（検索→統合回答→フォローアップ）
  const handleFinalizeDiscussion = useCallback(async () => {
    await finalizeDiscussion({
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
  }, [participants, userProfile, discussionMode, discussionDepth, directionGuide, searchConfig, currentSessionRef, setInterruptedState, updateAndSaveSession, finalizeDiscussion]);

  // フォローアップ質問を生成
  const handleGenerateFollowUps = useCallback(async (turnId: string, topic: string, finalAnswer: string) => {
    await generateFollowUps({
      turnId,
      topic,
      finalAnswer,
      participants,
      userProfile,
      currentSessionRef,
      updateAndSaveSession,
    });
  }, [participants, userProfile, currentSessionRef, updateAndSaveSession, generateFollowUps]);

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

  // 議論を延長
  const handleExtendDiscussion = useCallback(async (config: ExtendDiscussionConfig) => {
    await extendDiscussion({
      config,
      participants,
      searchConfig,
      userProfile,
      currentSessionRef,
      setCurrentSession,
      setSessions,
      setInterruptedState,
      updateAndSaveSession,
    });
  }, [participants, searchConfig, userProfile, currentSessionRef, setCurrentSession, setSessions, setInterruptedState, updateAndSaveSession, extendDiscussion]);

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

  // 無効化条件（useDiscussionから取得）
  const isSettingsDisabled = isProcessing;
  const isSessionSelectionDisabled = isProcessing;

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
              onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenPresets={() => setIsPresetModalOpen(true)}
            presetCount={presets.length}
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
          onOpenSettings={() => {
            setIsSidebarOpen(false);
            setIsSettingsModalOpen(true);
          }}
          onOpenPresets={() => {
            setIsSidebarOpen(false);
            setIsPresetModalOpen(true);
          }}
          presetCount={presets.length}
        />
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* モバイル用ヘッダー */}
        <MobileHeader
          title="AI Discussion Arena"
          subtitle={currentSession?.title}
          onMenuClick={() => setIsSidebarOpen(true)}
          onNewSession={handleNewSession}
          onSettingsClick={() => setIsSettingsOpen(true)}
          disabled={isSettingsDisabled}
        />

        {/* デスクトップ用ヘッダー */}
        <header className="hidden md:flex items-center justify-between p-3 border-b border-gray-700 shrink-0 min-h-[52px]">
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
        </header>

        {/* エラー表示 */}
        {error && (
          <div className="mx-3 md:mx-4 mt-3 md:mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm shrink-0">
            {error}
          </div>
        )}

        {/* 中断された議論の復元バナー（該当セッションが選択されている場合のみ表示） */}
        {interruptedState && !isDiscussing && currentSession?.id === interruptedState.sessionId && interruptedState.summaryPhase !== 'awaiting' && interruptedState.summaryPhase !== 'generating' && (
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
                  title="再開情報を消去します（セッションは削除されません）"
                >
                  閉じる
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
          participants={isDiscussing ? discussionParticipants : participants}
          currentTopic={currentTopic}
          currentFinalAnswer={currentFinalAnswer}
          currentSummaryPrompt={currentSummaryPrompt}
          isDiscussing={isDiscussing}
          summaryPhase={summaryPhase}
          searchResults={currentSearchResults}
          searchKeywords={currentSearchKeywords}
          searchProgress={searchProgress}
          onFollowUp={handleFollowUp}
          onDeepDive={handleDeepDive}
          onCounterargument={handleCounterargument}
          onFork={handleFork}
          onGenerateFollowUps={handleGenerateFollowUps}
          messageVotes={messageVotes}
          onVote={handleVote}
          suggestedFollowUps={suggestedFollowUps}
          isGeneratingFollowUps={isGeneratingFollowUps}
          onFinalizeDiscussion={handleFinalizeDiscussion}
          onExtendDiscussion={handleExtendDiscussion}
          currentRounds={discussionProgress.currentRound}
          currentMode={currentDiscussionMode || discussionMode}
          currentDepth={currentDiscussionDepth || discussionDepth}
          currentKeywords={currentDirectionGuide?.keywords || directionGuide.keywords}
          streamingMessage={streamingMessage}
          startMarker={startMarker}
          extensionMarkers={extensionMarkers}
        />

        {/* 進捗インジケーター */}
        <ProgressIndicator
          isActive={isDiscussing}
          currentRound={discussionProgress.currentRound}
          totalRounds={discussionProgress.totalRounds}
          currentProvider={discussionProgress.currentParticipant?.provider || null}
          currentParticipant={discussionProgress.currentParticipant}
          totalProviders={discussionProgress.totalParticipants}
          currentProviderIndex={discussionProgress.currentParticipantIndex}
          isSearching={isSearching}
          isStreaming={!!streamingMessage}
          isGeneratingFollowUps={isGeneratingFollowUps}
          summaryPhase={summaryPhase}
          participants={isDiscussing || summaryPhase !== 'idle' ? discussionParticipants : participants}
          completedParticipants={completedParticipants}
          onInterrupt={handleInterruptWithSave}
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

      {/* 参加AIパネル - デスクトップ */}
      {!isSettingsCollapsed ? (
        <div className="hidden md:block">
          <ParticipantsPanel
            participants={participants}
            onParticipantsChange={setParticipants}
            availableModels={availableModels}
            availability={availability}
            disabled={isSettingsDisabled}
            onCollapse={() => setIsSettingsCollapsed(true)}
          />
        </div>
      ) : (
        /* 折りたたみ時のバー - 参加者数を表示 */
        <button
          type="button"
          onClick={() => setIsSettingsCollapsed(false)}
          className="hidden md:flex flex-col items-center justify-center w-10 bg-gray-800 border-l border-gray-700 hover:bg-gray-700 transition-colors cursor-pointer"
          title="参加AIパネルを開く"
        >
          <svg className="w-5 h-5 text-indigo-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-xs text-gray-400 font-medium">{participants.length}</span>
          <svg className="w-4 h-4 text-gray-500 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* モバイル用参加AIパネル（オーバーレイ）- md以下でのみ表示 */}
      <div className="md:hidden">
        <ParticipantsPanel
          participants={participants}
          onParticipantsChange={setParticipants}
          availableModels={availableModels}
          availability={availability}
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

      {/* 設定モーダル */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        apiKeys={apiKeys}
        onApiKeyChange={setApiKey}
        onSaveApiKeys={saveApiKeys}
        hasUnsavedChanges={hasUnsavedApiKeyChanges}
        isUrlValid={isUrlValid}
        userProfile={userProfile}
        onProfileChange={setUserProfile}
        disabled={isSettingsDisabled}
      />
    </div>
  );
}
