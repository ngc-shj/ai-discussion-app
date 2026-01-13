'use client';

import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import { DirectionGuide, TerminationConfig } from '@/types';
import { AttachmentSource } from '@/components/AttachedTextChip';

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

// 長文テキストを添付ファイル風に表示する閾値
export const LONG_TEXT_THRESHOLD = 200;

// テキストファイルかどうかを拡張子で判定
function isTextFile(fileName: string): boolean {
  const textExtensions = [
    'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml',
    'yaml', 'yml', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'sh',
    'sql', 'csv', 'log', 'conf', 'ini', 'env', 'gitignore', 'dockerfile',
  ];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return textExtensions.includes(ext);
}

// 添付テキストの型
export interface AttachedTextItem {
  id: string;
  text: string;
  source: AttachmentSource;
  fileName?: string;
}

export interface UseInputFormReturn {
  // State
  topic: string;
  isModeExpanded: boolean;
  keywordInput: string;
  focusAreaInput: string;
  avoidTopicInput: string;
  termKeywordInput: string;
  attachedTexts: AttachedTextItem[];
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
  handleRemoveAttachedText: (id: string) => void;
  handleFileAttach: (e: ChangeEvent<HTMLInputElement>) => void;
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
  const [topic, setTopicInternal] = useState('');
  const [isModeExpanded, setIsModeExpanded] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [focusAreaInput, setFocusAreaInput] = useState('');
  const [avoidTopicInput, setAvoidTopicInput] = useState('');
  const [termKeywordInput, setTermKeywordInput] = useState('');
  const [attachedTexts, setAttachedTexts] = useState<AttachedTextItem[]>([]);

  // トピック設定時に長文は添付テキストに変換
  const setTopic = useCallback((newTopic: string) => {
    if (newTopic.length >= LONG_TEXT_THRESHOLD) {
      const newItem: AttachedTextItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: newTopic,
        source: 'pasted',
      };
      setAttachedTexts((prev) => [...prev, newItem]);
      setTopicInternal('');
    } else {
      setTopicInternal(newTopic);
    }
  }, []);

  // 添付テキスト削除
  const handleRemoveAttachedText = useCallback((id: string) => {
    setAttachedTexts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // ファイル添付
  const handleFileAttach = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      // テキストファイルのみ対応
      if (!file.type.startsWith('text/') && !isTextFile(file.name)) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const newItem: AttachedTextItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            text: content,
            source: 'file',
            fileName: file.name,
          };
          setAttachedTexts((prev) => [...prev, newItem]);
        }
      };
      reader.readAsText(file);
    });

    // inputをリセット（同じファイルを再度選択できるように）
    e.target.value = '';
  }, []);


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
    // 添付テキストがあればXMLタグで囲んで構造化（質問→添付の順）
    let submitText = '';
    if (attachedTexts.length > 0) {
      const attachedContents = attachedTexts.map((item, index) => {
        // ファイルの場合はattached-fileタグ、貼り付けの場合はpasted-contentタグ
        if (item.source === 'file' && item.fileName) {
          return `<attached-file name="${item.fileName}">\n${item.text}\n</attached-file>`;
        }
        // 貼り付けの場合
        if (attachedTexts.length === 1) {
          return `<pasted-content>\n${item.text}\n</pasted-content>`;
        }
        return `<pasted-content id="${index + 1}">\n${item.text}\n</pasted-content>`;
      }).join('\n\n');
      // 質問を先に、添付コンテンツを後に配置
      submitText = topic.trim()
        ? `${topic.trim()}\n\n${attachedContents}`
        : attachedContents;
    } else {
      submitText = topic;
    }
    if (submitText.trim() && !disabled) {
      onSubmit(submitText.trim());
      setTopicInternal('');
      setAttachedTexts([]);
    }
  }, [topic, attachedTexts, disabled, onSubmit]);

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
    attachedTexts,
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
    handleRemoveAttachedText,
    handleFileAttach,
  };
}
