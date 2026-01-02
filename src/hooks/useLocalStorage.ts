'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * ローカルストレージと同期するstate管理フック
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
): [T, (value: T | ((prev: T) => T)) => void] {
  const serialize = options?.serialize ?? JSON.stringify;
  const deserialize = options?.deserialize ?? JSON.parse;

  // 初期値を取得（SSR対策でuseStateのイニシャライザ関数を使用）
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = localStorage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // 値を更新してローカルストレージに保存
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, serialize(newValue));
        } catch (error) {
          console.error(`Failed to save to localStorage: ${key}`, error);
        }
      }
      return newValue;
    });
  }, [key, serialize]);

  return [storedValue, setValue];
}

/**
 * 文字列用のシンプルなローカルストレージフック
 */
export function useLocalStorageString(
  key: string,
  initialValue: string
): [string, (value: string) => void] {
  return useLocalStorage(key, initialValue, {
    serialize: (v) => v,
    deserialize: (v) => v,
  });
}
