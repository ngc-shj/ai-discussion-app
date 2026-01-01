import { DiscussionSession, DiscussionTurn, SearchResult, InterruptedDiscussionState, DiscussionMessage } from '@/types';

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
    })),
  };
}

// セッションを復元（文字列をDate型に変換）
function deserializeSession(data: Record<string, unknown>): DiscussionSession {
  return {
    ...data,
    createdAt: new Date(data.createdAt as string),
    updatedAt: new Date(data.updatedAt as string),
    turns: (data.turns as Array<Record<string, unknown>>).map((turn) => ({
      ...turn,
      createdAt: new Date(turn.createdAt as string),
      messages: (turn.messages as Array<Record<string, unknown>>).map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp as string),
      })),
    })),
  } as DiscussionSession;
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
        sessions.push(deserializeSession(cursor.value));
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

export async function saveSession(session: DiscussionSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(serializeSession(session));

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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
  searchResults?: SearchResult[]
): DiscussionTurn {
  return {
    id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    topic,
    messages,
    finalAnswer,
    searchResults,
    createdAt: new Date(),
  };
}

// 中断された議論状態を保存するためのストレージキー
const INTERRUPTED_STORAGE_KEY = 'ai-discussion-interrupted';

// 中断状態をシリアライズ（Date型を文字列に変換）
function serializeInterruptedState(state: InterruptedDiscussionState): Record<string, unknown> {
  return {
    ...state,
    interruptedAt: toISOString(state.interruptedAt),
    messages: state.messages.map((msg) => ({
      ...msg,
      timestamp: toISOString(msg.timestamp),
    })),
  };
}

// 中断状態をデシリアライズ（文字列をDate型に変換）
function deserializeInterruptedState(data: Record<string, unknown>): InterruptedDiscussionState {
  return {
    ...data,
    interruptedAt: new Date(data.interruptedAt as string),
    messages: (data.messages as Array<Record<string, unknown>>).map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp as string),
    })) as DiscussionMessage[],
  } as InterruptedDiscussionState;
}

// 中断された議論状態を保存
export function saveInterruptedState(state: InterruptedDiscussionState): void {
  try {
    const serialized = serializeInterruptedState(state);
    localStorage.setItem(INTERRUPTED_STORAGE_KEY, JSON.stringify(serialized));
  } catch (err) {
    console.error('Failed to save interrupted state:', err);
  }
}

// 中断された議論状態を取得
export function getInterruptedState(): InterruptedDiscussionState | null {
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
