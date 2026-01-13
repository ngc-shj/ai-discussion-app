'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { DirectionGuide, TerminationConfig } from '@/types';

export interface UseInputFormProps {
  onSubmit: (topic: string) => void;
  disabled?: boolean;
  presetTopic?: string;
  onPresetTopicClear?: () => void;
  directionGuide: DirectionGuide;
  onDirectionGuideChange: (guide: DirectionGuide) => void;
  terminationConfig: TerminationConfig;
  onTerminationConfigChange: (config: TerminationConfig) => void;
}

export interface UseInputFormReturn {
  // State
  topic: string;
  isModeExpanded: boolean;
  keywordInput: string;
  focusAreaInput: string;
  avoidTopicInput: string;
  termKeywordInput: string;
  // Actions
  setTopic: (topic: string) => void;
  setIsModeExpanded: (expanded: boolean) => void;
  setKeywordInput: (input: string) => void;
  setFocusAreaInput: (input: string) => void;
  setAvoidTopicInput: (input: string) => void;
  setTermKeywordInput: (input: string) => void;
  handleSubmit: (e: FormEvent) => void;
  handleAddKeyword: () => void;
  handleRemoveKeyword: (keyword: string) => void;
  handleKeywordKeyDown: (e: React.KeyboardEvent) => void;
  handleAddFocusArea: () => void;
  handleRemoveFocusArea: (area: string) => void;
  handleFocusAreaKeyDown: (e: React.KeyboardEvent) => void;
  handleAddAvoidTopic: () => void;
  handleRemoveAvoidTopic: (topic: string) => void;
  handleAvoidTopicKeyDown: (e: React.KeyboardEvent) => void;
  handleAddTermKeyword: () => void;
  handleRemoveTermKeyword: (keyword: string) => void;
  handleTermKeywordKeyDown: (e: React.KeyboardEvent) => void;
}

export function useInputForm({
  onSubmit,
  disabled,
  presetTopic,
  onPresetTopicClear,
  directionGuide,
  onDirectionGuideChange,
  terminationConfig,
  onTerminationConfigChange,
}: UseInputFormProps): UseInputFormReturn {
  const [topic, setTopic] = useState('');
  const [isModeExpanded, setIsModeExpanded] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [focusAreaInput, setFocusAreaInput] = useState('');
  const [avoidTopicInput, setAvoidTopicInput] = useState('');
  const [termKeywordInput, setTermKeywordInput] = useState('');

  // プリセットトピックが設定されたら入力欄に反映
  useEffect(() => {
    if (presetTopic) {
      setTopic(presetTopic);
      onPresetTopicClear?.();
    }
  }, [presetTopic, onPresetTopicClear]);

  // フォーム送信
  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !disabled) {
      onSubmit(topic.trim());
      setTopic('');
    }
  }, [topic, disabled, onSubmit]);

  // 方向性キーワード追加
  const handleAddKeyword = useCallback(() => {
    const trimmed = keywordInput.trim();
    if (trimmed && !directionGuide.keywords.includes(trimmed)) {
      onDirectionGuideChange({
        ...directionGuide,
        keywords: [...directionGuide.keywords, trimmed],
      });
      setKeywordInput('');
    }
  }, [keywordInput, directionGuide, onDirectionGuideChange]);

  // 方向性キーワード削除
  const handleRemoveKeyword = useCallback((keyword: string) => {
    onDirectionGuideChange({
      ...directionGuide,
      keywords: directionGuide.keywords.filter((k) => k !== keyword),
    });
  }, [directionGuide, onDirectionGuideChange]);

  // Enterキーでキーワード追加
  const handleKeywordKeyDown = useCallback((e: React.KeyboardEvent) => {
    // IME入力中（日本語変換中など）はスキップ
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  }, [handleAddKeyword]);

  // 深掘り領域追加
  const handleAddFocusArea = useCallback(() => {
    const trimmed = focusAreaInput.trim();
    if (trimmed && !directionGuide.focusAreas?.includes(trimmed)) {
      onDirectionGuideChange({
        ...directionGuide,
        focusAreas: [...(directionGuide.focusAreas || []), trimmed],
      });
      setFocusAreaInput('');
    }
  }, [focusAreaInput, directionGuide, onDirectionGuideChange]);

  // 深掘り領域削除
  const handleRemoveFocusArea = useCallback((area: string) => {
    onDirectionGuideChange({
      ...directionGuide,
      focusAreas: (directionGuide.focusAreas || []).filter((a) => a !== area),
    });
  }, [directionGuide, onDirectionGuideChange]);

  // Enterキーで深掘り領域追加
  const handleFocusAreaKeyDown = useCallback((e: React.KeyboardEvent) => {
    // IME入力中（日本語変換中など）はスキップ
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFocusArea();
    }
  }, [handleAddFocusArea]);

  // 避けたいトピック追加
  const handleAddAvoidTopic = useCallback(() => {
    const trimmed = avoidTopicInput.trim();
    if (trimmed && !directionGuide.avoidTopics?.includes(trimmed)) {
      onDirectionGuideChange({
        ...directionGuide,
        avoidTopics: [...(directionGuide.avoidTopics || []), trimmed],
      });
      setAvoidTopicInput('');
    }
  }, [avoidTopicInput, directionGuide, onDirectionGuideChange]);

  // 避けたいトピック削除
  const handleRemoveAvoidTopic = useCallback((topic: string) => {
    onDirectionGuideChange({
      ...directionGuide,
      avoidTopics: (directionGuide.avoidTopics || []).filter((t) => t !== topic),
    });
  }, [directionGuide, onDirectionGuideChange]);

  // Enterキーで避けたいトピック追加
  const handleAvoidTopicKeyDown = useCallback((e: React.KeyboardEvent) => {
    // IME入力中（日本語変換中など）はスキップ
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAvoidTopic();
    }
  }, [handleAddAvoidTopic]);

  // 終了キーワード追加
  const handleAddTermKeyword = useCallback(() => {
    const trimmed = termKeywordInput.trim();
    if (trimmed && !terminationConfig.terminationKeywords?.includes(trimmed)) {
      onTerminationConfigChange({
        ...terminationConfig,
        terminationKeywords: [...(terminationConfig.terminationKeywords || []), trimmed],
      });
      setTermKeywordInput('');
    }
  }, [termKeywordInput, terminationConfig, onTerminationConfigChange]);

  // 終了キーワード削除
  const handleRemoveTermKeyword = useCallback((keyword: string) => {
    onTerminationConfigChange({
      ...terminationConfig,
      terminationKeywords: (terminationConfig.terminationKeywords || []).filter((k) => k !== keyword),
    });
  }, [terminationConfig, onTerminationConfigChange]);

  // Enterキーで終了キーワード追加
  const handleTermKeywordKeyDown = useCallback((e: React.KeyboardEvent) => {
    // IME入力中（日本語変換中など）はスキップ
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTermKeyword();
    }
  }, [handleAddTermKeyword]);

  return {
    // State
    topic,
    isModeExpanded,
    keywordInput,
    focusAreaInput,
    avoidTopicInput,
    termKeywordInput,
    // Actions
    setTopic,
    setIsModeExpanded,
    setKeywordInput,
    setFocusAreaInput,
    setAvoidTopicInput,
    setTermKeywordInput,
    handleSubmit,
    handleAddKeyword,
    handleRemoveKeyword,
    handleKeywordKeyDown,
    handleAddFocusArea,
    handleRemoveFocusArea,
    handleFocusAreaKeyDown,
    handleAddAvoidTopic,
    handleRemoveAvoidTopic,
    handleAvoidTopicKeyDown,
    handleAddTermKeyword,
    handleRemoveTermKeyword,
    handleTermKeywordKeyDown,
  };
}
