'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ai-discussion-api-keys';

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

export interface UseApiKeysReturn {
  apiKeys: ApiKeys;
  setApiKey: (key: keyof ApiKeys, value: string) => void;
  saveApiKeys: () => void;
  resetApiKeys: () => void;
  hasUnsavedChanges: boolean;
  getApiKeysHeader: () => string;
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

  // Set individual key
  const setApiKey = useCallback((key: keyof ApiKeys, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [key]: value || undefined, // Remove empty strings
    }));
  }, []);

  // Save to localStorage
  const saveApiKeys = useCallback(() => {
    // Clean up empty values
    const cleanedKeys: ApiKeys = {};
    for (const [key, value] of Object.entries(apiKeys)) {
      if (value && value.trim()) {
        cleanedKeys[key as keyof ApiKeys] = value.trim();
      }
    }
    saveApiKeysToStorage(cleanedKeys);
    setSavedKeys(cleanedKeys);
    setApiKeys(cleanedKeys);
  }, [apiKeys]);

  // Reset to empty
  const resetApiKeys = useCallback(() => {
    setApiKeys({});
    saveApiKeysToStorage({});
    setSavedKeys({});
  }, []);

  // Check for unsaved changes
  const hasUnsavedChanges = isLoaded && JSON.stringify(apiKeys) !== JSON.stringify(savedKeys);

  // Get header value for API requests
  const getApiKeysHeader = useCallback(() => {
    // Only include non-empty values
    const keysToSend: ApiKeys = {};
    for (const [key, value] of Object.entries(savedKeys)) {
      if (value && value.trim()) {
        keysToSend[key as keyof ApiKeys] = value.trim();
      }
    }
    return JSON.stringify(keysToSend);
  }, [savedKeys]);

  return {
    apiKeys,
    setApiKey,
    saveApiKeys,
    resetApiKeys,
    hasUnsavedChanges,
    getApiKeysHeader,
  };
}
