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
  termKeywordInput: string;
  // Actions
  setTopic: (topic: string) => void;
  setIsModeExpanded: (expanded: boolean) => void;
  setKeywordInput: (input: string) => void;
  setTermKeywordInput: (input: string) => void;
  handleSubmit: (e: FormEvent) => void;
  handleAddKeyword: () => void;
  handleRemoveKeyword: (keyword: string) => void;
  handleKeywordKeyDown: (e: React.KeyboardEvent) => void;
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
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  }, [handleAddKeyword]);

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
    termKeywordInput,
    // Actions
    setTopic,
    setIsModeExpanded,
    setKeywordInput,
    setTermKeywordInput,
    handleSubmit,
    handleAddKeyword,
    handleRemoveKeyword,
    handleKeywordKeyDown,
    handleAddTermKeyword,
    handleRemoveTermKeyword,
    handleTermKeywordKeyDown,
  };
}
