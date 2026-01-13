'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ai-discussion-urls';

export interface ApiKeys {
  // AI providers
  anthropic?: string;
  openai?: string;
  google?: string;
  ollamaBaseUrl?: string;
  // Search providers
  tavily?: string;
  serper?: string;
  brave?: string;
  searxngBaseUrl?: string;
  jina?: string;
}

// URLフィールドのみ保存可能（セキュリティ上の理由でAPIキーはlocalStorageに保存しない）
const SAVABLE_KEYS: (keyof ApiKeys)[] = ['ollamaBaseUrl', 'searxngBaseUrl'];

// URL形式をチェック（空文字はtrue）
function isValidUrl(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface UseApiKeysReturn {
  apiKeys: ApiKeys;
  setApiKey: (key: keyof ApiKeys, value: string) => void;
  saveApiKeys: () => void;
  resetApiKeys: () => void;
  hasUnsavedChanges: boolean;
  getApiKeysHeader: () => string;
  isUrlValid: (key: keyof ApiKeys) => boolean;
}

function loadApiKeys(): ApiKeys {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveApiKeysToStorage(keys: ApiKeys): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function useApiKeys(): UseApiKeysReturn {
  const [savedKeys, setSavedKeys] = useState<ApiKeys>({});
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadApiKeys();
    setSavedKeys(loaded);
    setApiKeys(loaded);
    setIsLoaded(true);
  }, []);

  // Set individual key (自動保存)
  const setApiKey = useCallback((key: keyof ApiKeys, value: string) => {
    const newValue = value || undefined;
    setApiKeys(prev => ({
      ...prev,
      [key]: newValue,
    }));

    // URLフィールドの場合は有効なURLのときのみ保存
    if (SAVABLE_KEYS.includes(key) && isValidUrl(newValue)) {
      setSavedKeys(prev => {
        const updated = { ...prev, [key]: newValue };
        // undefinedのキーを削除
        if (!newValue) {
          delete updated[key];
        }
        saveApiKeysToStorage(updated);
        return updated;
      });
    }
  }, []);

  // Save to localStorage (URLフィールドのみ)
  const saveApiKeys = useCallback(() => {
    // URLフィールドのみ保存
    const urlsToSave: ApiKeys = {};
    for (const key of SAVABLE_KEYS) {
      const value = apiKeys[key];
      if (value && value.trim()) {
        urlsToSave[key] = value.trim();
      }
    }
    saveApiKeysToStorage(urlsToSave);
    setSavedKeys(urlsToSave);
    setApiKeys(urlsToSave);
  }, [apiKeys]);

  // Reset to empty
  const resetApiKeys = useCallback(() => {
    setApiKeys({});
    saveApiKeysToStorage({});
    setSavedKeys({});
  }, []);

  // Check for unsaved changes (URLフィールドのみ比較)
  const hasUnsavedChanges = isLoaded && SAVABLE_KEYS.some(key =>
    (apiKeys[key] || '') !== (savedKeys[key] || '')
  );

  // Get header value for API requests (URLフィールドのみ送信)
  const getApiKeysHeader = useCallback(() => {
    // URLフィールドのみ送信
    const urlsToSend: ApiKeys = {};
    for (const key of SAVABLE_KEYS) {
      const value = savedKeys[key];
      if (value && value.trim()) {
        urlsToSend[key] = value.trim();
      }
    }
    return JSON.stringify(urlsToSend);
  }, [savedKeys]);

  // URL形式が有効かチェック
  const isUrlValid = useCallback((key: keyof ApiKeys) => {
    return isValidUrl(apiKeys[key]);
  }, [apiKeys]);

  return {
    apiKeys,
    setApiKey,
    saveApiKeys,
    resetApiKeys,
    hasUnsavedChanges,
    getApiKeysHeader,
    isUrlValid,
  };
}
