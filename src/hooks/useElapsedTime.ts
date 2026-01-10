'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface ElapsedTimeState {
  elapsedSeconds: number;
  isRunning: boolean;
  formattedTime: string;
}

/**
 * 経過時間を計測するカスタムフック
 * @param isActive - タイマーがアクティブかどうか
 * @param resetKey - この値が変わるとタイマーがリセットされる（参加者切り替え時など）
 */
export function useElapsedTime(isActive: boolean, resetKey?: string): ElapsedTimeState {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // タイマーをクリア
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // resetKeyが変わったらタイマーをリセット
  useEffect(() => {
    setElapsedSeconds(0);
    startTimeRef.current = null;
    clearTimer();
  }, [resetKey, clearTimer]);

  // isActiveの変化でタイマーを開始/停止
  useEffect(() => {
    if (isActive) {
      // タイマー開始
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedSeconds(elapsed);
        }
      }, 1000);
    } else {
      // タイマー停止
      clearTimer();
    }

    return clearTimer;
  }, [isActive, clearTimer]);

  // フォーマット済み時間文字列
  const formattedTime = elapsedSeconds < 60
    ? `${elapsedSeconds}秒`
    : `${Math.floor(elapsedSeconds / 60)}分${elapsedSeconds % 60}秒`;

  return {
    elapsedSeconds,
    isRunning: isActive,
    formattedTime,
  };
}
