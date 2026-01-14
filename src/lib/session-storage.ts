import { DiscussionSession, DiscussionTurn, SearchResult, SearchKeywordInfo, InterruptedDiscussionSnapshot, DiscussionMessage, StartMarker, ExtensionMarker } from '@/types';

const DB_NAME = 'ai-discussion-db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

// Date型または文字列をISO文字列に変換
function toISOString(date: Date | string): string {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString();
}

// セッションを保存（Date型を文字列に変換）
function serializeSession(session: DiscussionSession): Record<string, unknown> {
  return {
    ...session,
    createdAt: toISOString(session.createdAt),
    updatedAt: toISOString(session.updatedAt),
    turns: session.turns.map((turn) => ({
      ...turn,
      createdAt: toISOString(turn.createdAt),
      messages: turn.messages.map((msg) => ({
        ...msg,
        timestamp: toISOString(msg.timestamp),
      })),
      // マーカーのtimestampをシリアライズ
      startMarker: turn.startMarker ? {
        ...turn.startMarker,
        timestamp: toISOString(turn.startMarker.timestamp),
      } : undefined,
      extensionMarkers: turn.extensionMarkers?.map((marker) => ({
        ...marker,
        timestamp: toISOString(marker.timestamp),
      })),
      // 検索キーワードのtimestampをシリアライズ
      searchKeywords: turn.searchKeywords?.map((info) => ({
        ...info,
        timestamp: toISOString(info.timestamp),
      })),
    })),
    // 中断状態がある場合はシリアライズ
    interruptedTurn: session.interruptedTurn ? {
      ...session.interruptedTurn,
      interruptedAt: toISOString(session.interruptedTurn.interruptedAt),
      messages: session.interruptedTurn.messages.map((msg) => ({
        ...msg,
        timestamp: toISOString(msg.timestamp),
      })),
      // 中断状態の検索キーワードのtimestampをシリアライズ
      searchKeywords: session.interruptedTurn.searchKeywords?.map((info) => ({
        ...info,
        timestamp: toISOString(info.timestamp),
      })),
      // 中断状態のマーカーのtimestampをシリアライズ
      startMarker: session.interruptedTurn.startMarker ? {
        ...session.interruptedTurn.startMarker,
        timestamp: toISOString(session.interruptedTurn.startMarker.timestamp),
      } : undefined,
      extensionMarkers: session.interruptedTurn.extensionMarkers?.map((marker) => ({
        ...marker,
        timestamp: toISOString(marker.timestamp),
      })),
    } : undefined,
  };
}

// セッションを復元（文字列をDate型に変換）
function deserializeSession(data: Record<string, unknown>): DiscussionSession {
  try {
    const interruptedTurnData = data.interruptedTurn as Record<string, unknown> | undefined;
    const turnsData = data.turns as Array<Record<string, unknown>> | undefined;

    return {
      ...data,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
      turns: (turnsData || []).map((turn) => {
        const startMarkerData = turn.startMarker as Record<string, unknown> | undefined;
        const extensionMarkersData = turn.extensionMarkers as Array<Record<string, unknown>> | undefined;
        const searchKeywordsData = turn.searchKeywords as Array<Record<string, unknown>> | undefined;

        return {
          ...turn,
          createdAt: new Date(turn.createdAt as string),
          messages: ((turn.messages as Array<Record<string, unknown>>) || []).map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp as string),
          })),
          // マーカーのtimestampをデシリアライズ
          startMarker: startMarkerData ? {
            ...startMarkerData,
            timestamp: new Date(startMarkerData.timestamp as string),
          } : undefined,
          extensionMarkers: extensionMarkersData?.map((marker) => ({
            ...marker,
            timestamp: new Date(marker.timestamp as string),
          })),
          // 検索キーワードのtimestampをデシリアライズ
          searchKeywords: searchKeywordsData?.map((info) => ({
            ...info,
            timestamp: new Date(info.timestamp as string),
          })),
        };
      }),
      // 中断状態がある場合はデシリアライズ
      interruptedTurn: interruptedTurnData ? (() => {
        const interruptedSearchKeywordsData = interruptedTurnData.searchKeywords as Array<Record<string, unknown>> | undefined;
        const interruptedStartMarkerData = interruptedTurnData.startMarker as Record<string, unknown> | undefined;
        const interruptedExtensionMarkersData = interruptedTurnData.extensionMarkers as Array<Record<string, unknown>> | undefined;
        return {
          ...interruptedTurnData,
          interruptedAt: new Date(interruptedTurnData.interruptedAt as string),
          messages: ((interruptedTurnData.messages as Array<Record<string, unknown>>) || []).map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp as string),
          })),
          // 中断状態の検索キーワードのtimestampをデシリアライズ
          searchKeywords: interruptedSearchKeywordsData?.map((info) => ({
            ...info,
            timestamp: new Date(info.timestamp as string),
          })),
          // 中断状態のマーカーのtimestampをデシリアライズ
          startMarker: interruptedStartMarkerData ? {
            ...interruptedStartMarkerData,
            timestamp: new Date(interruptedStartMarkerData.timestamp as string),
          } : undefined,
          extensionMarkers: interruptedExtensionMarkersData?.map((marker) => ({
            ...marker,
            timestamp: new Date(marker.timestamp as string),
          })),
        };
      })() : undefined,
    } as DiscussionSession;
  } catch (err) {
    console.error('Failed to deserialize session:', err, data);
    throw err;
  }
}

export async function getAllSessions(): Promise<DiscussionSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('updatedAt');
    const request = index.openCursor(null, 'prev'); // 新しい順

    const sessions: DiscussionSession[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        try {
          sessions.push(deserializeSession(cursor.value));
        } catch (err) {
          console.error('Failed to deserialize session, skipping:', cursor.value?.id, err);
        }
        cursor.continue();
      } else {
        resolve(sessions);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getSession(id: string): Promise<DiscussionSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        resolve(deserializeSession(request.result));
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// 保存キュー: 同じセッションIDへの並列書き込みを防止
const saveQueue: Map<string, Promise<void>> = new Map();

export async function saveSession(session: DiscussionSession): Promise<void> {
  const sessionId = session.id;

  // 既存の保存処理があれば待機
  const existingPromise = saveQueue.get(sessionId);
  if (existingPromise) {
    await existingPromise;
  }

  // 新しい保存処理を開始
  const savePromise = (async () => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(serializeSession(session));

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  })();

  saveQueue.set(sessionId, savePromise);

  try {
    await savePromise;
  } finally {
    // 完了後にキューから削除（ただし、自分自身の場合のみ）
    if (saveQueue.get(sessionId) === savePromise) {
      saveQueue.delete(sessionId);
    }
  }
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  const session = await getSession(id);
  if (session) {
    session.title = title;
    session.updatedAt = new Date();
    await saveSession(session);
  }
}

export async function addTurnToSession(
  sessionId: string,
  turn: DiscussionTurn
): Promise<DiscussionSession | null> {
  const session = await getSession(sessionId);
  if (session) {
    session.turns.push(turn);
    session.updatedAt = new Date();
    await saveSession(session);
    return session;
  }
  return null;
}

export function createNewSession(
  title: string,
  participants: DiscussionSession['participants'],
  rounds: number
): DiscussionSession {
  const now = new Date();
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    turns: [],
    participants,
    rounds,
    createdAt: now,
    updatedAt: now,
  };
}

export function createNewTurn(
  topic: string,
  messages: DiscussionTurn['messages'],
  finalAnswer: string,
  searchResults?: SearchResult[],
  summaryPrompt?: string,
  suggestedFollowUps?: DiscussionTurn['suggestedFollowUps'],
  startMarker?: StartMarker,
  extensionMarkers?: ExtensionMarker[],
  searchKeywords?: SearchKeywordInfo[]
): DiscussionTurn {
  return {
    id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    topic,
    messages,
    finalAnswer,
    summaryPrompt,
    searchResults,
    searchKeywords,
    suggestedFollowUps,
    createdAt: new Date(),
    startMarker,
    extensionMarkers,
  };
}

// 中断された議論状態を保存するためのストレージキー
const INTERRUPTED_STORAGE_KEY = 'ai-discussion-interrupted';

// 中断状態をシリアライズ（Date型を文字列に変換）
function serializeInterruptedState(state: InterruptedDiscussionSnapshot): Record<string, unknown> {
  return {
    ...state,
    interruptedAt: toISOString(state.interruptedAt),
    messages: state.messages.map((msg) => ({
      ...msg,
      timestamp: toISOString(msg.timestamp),
    })),
    // マーカーのtimestampをシリアライズ
    startMarker: state.startMarker ? {
      ...state.startMarker,
      timestamp: toISOString(state.startMarker.timestamp),
    } : undefined,
    extensionMarkers: state.extensionMarkers?.map((marker) => ({
      ...marker,
      timestamp: toISOString(marker.timestamp),
    })),
  };
}

// 中断状態をデシリアライズ（文字列をDate型に変換）
function deserializeInterruptedState(data: Record<string, unknown>): InterruptedDiscussionSnapshot {
  const startMarkerData = data.startMarker as Record<string, unknown> | undefined;
  const extensionMarkersData = data.extensionMarkers as Array<Record<string, unknown>> | undefined;

  return {
    ...data,
    interruptedAt: new Date(data.interruptedAt as string),
    messages: (data.messages as Array<Record<string, unknown>>).map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp as string),
    })) as DiscussionMessage[],
    // マーカーのtimestampをデシリアライズ
    startMarker: startMarkerData ? {
      ...startMarkerData,
      timestamp: new Date(startMarkerData.timestamp as string),
    } : undefined,
    extensionMarkers: extensionMarkersData?.map((marker) => ({
      ...marker,
      timestamp: new Date(marker.timestamp as string),
    })),
  } as InterruptedDiscussionSnapshot;
}

// 中断された議論状態を保存
export function saveInterruptedState(state: InterruptedDiscussionSnapshot): void {
  try {
    const serialized = serializeInterruptedState(state);
    localStorage.setItem(INTERRUPTED_STORAGE_KEY, JSON.stringify(serialized));
  } catch (err) {
    console.error('Failed to save interrupted state:', err);
  }
}

// 中断された議論状態を取得
export function getInterruptedState(): InterruptedDiscussionSnapshot | null {
  try {
    const saved = localStorage.getItem(INTERRUPTED_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return deserializeInterruptedState(parsed);
    }
  } catch (err) {
    console.error('Failed to load interrupted state:', err);
  }
  return null;
}

// 中断された議論状態を削除
export function clearInterruptedState(): void {
  try {
    localStorage.removeItem(INTERRUPTED_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear interrupted state:', err);
  }
}
