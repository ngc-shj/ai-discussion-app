# クライアント側オーケストレーション リファクタリング計画

## 背景

現状の `/api/discussion` がすべての処理を一括で行っているため、中断・復帰のロジックが複雑化している。
クライアント側でループを制御し、各APIを順番に呼び出す方式に変更することで、シンプルかつ保守しやすい構造にする。

## 現状の構造

```
/api/discussion
  └── discussion-engine
        ├── 参加者のAI発言生成
        ├── 検索キーワード生成
        ├── 検索実行 (performSearch直接呼び出し)
        ├── 統合回答生成
        └── フォローアップ質問生成
```

## 目標の構造

```
Client (useDiscussion)
│
├── for (round = 1; round <= rounds; round++) {
│     ├── POST /api/search (ラウンド検索)
│     └── for (participant of participants) {
│           └── POST /api/ai-generate (AI発言、SSEストリーミング)
│         }
│   }
│
├── POST /api/search (統合前検索)
├── POST /api/summary (統合回答、SSEストリーミング)
└── POST /api/followup (フォローアップ質問)
```

## メリット

1. **中断・再開がシンプル** - ループの制御がクライアントにあるので、中断ポイントが自然
2. **各APIが単一責務** - テスト・デバッグが容易
3. **スケーラビリティ** - 検索・AI生成を独立してスケール可能
4. **検索ロジックの集約** - `/api/search` に統一

## 実装計画

### フェーズ1: 新API作成（既存と並行稼働）

#### 1.1 `/api/ai-generate` 作成
- SSEストリーミングでAI発言を返す
- リクエスト: participant, topic, previousMessages, searchResults
- レスポンス: SSE (message_chunk, message, error)

#### 1.2 `/api/search` 拡張
- `timing` パラメータ追加 ('start' | 'round' | 'summary')
- `searchKeywords` パラメータ追加（ラウンド・統合前検索用）
- 既存のGETに加えてPOSTもサポート

#### 1.3 `/api/summarize` (既存APIを活用)
- SSEストリーミングで統合回答を返す
- 既存APIがそのまま使用可能
- リクエスト: topic, participants, messages, searchResults, userProfile
- レスポンス: SSE (summary_chunk, summary, error)

#### 1.4 `/api/followups` (既存APIを活用)
- フォローアップ質問を生成
- 既存APIがそのまま使用可能
- リクエスト: topic, finalAnswer, participants, userProfile
- レスポンス: SSE (followups, error)

### フェーズ2: クライアント側書き換え

#### 2.1 `useDiscussion` のリファクタリング
- `runDiscussion` 関数を新APIを呼び出す形式に変更
- 中断・再開ロジックを簡素化
- IndexedDB保存は継続使用

#### 2.2 状態管理の整理
```typescript
interface DiscussionState {
  phase: 'idle' | 'searching' | 'generating' | 'summarizing' | 'followup' | 'complete';
  currentRound: number;
  currentParticipantIndex: number;
}
```

### フェーズ3: クリーンアップ

#### 3.1 旧API削除
- `/api/discussion` を削除
- `discussion-engine/index.ts` の `runDiscussion` を削除（または内部関数として残す）

#### 3.2 テスト追加
- 各新APIのユニットテスト
- 中断・再開の統合テスト

## API仕様

### POST /api/ai-generate

```typescript
// Request
{
  participant: DiscussionParticipant;
  topic: string;
  round: number;
  previousMessages: DiscussionMessage[];
  searchResults?: SearchResult[];
  userProfile?: UserProfile;
}

// Response (SSE)
event: message_chunk
data: { participantIndex: number, chunk: string }

event: message
data: { participantIndex: number, message: DiscussionMessage }

event: error
data: { error: string }
```

### POST /api/search

```typescript
// Request
{
  query: string;
  timing: 'start' | 'round' | 'summary';
  topic: string;
  searchKeywords?: string[];  // ラウンド・統合前検索用
  config: SearchConfig;
  defaultAI?: { provider: string; model?: string };
}

// Response
{
  results: SearchResult[];
  warnings?: SearchWarning[];
}
```

### POST /api/summary

```typescript
// Request
{
  topic: string;
  messages: DiscussionMessage[];
  searchResults?: SearchResult[];
  userProfile?: UserProfile;
  participants: DiscussionParticipant[];
}

// Response (SSE)
event: summary_chunk
data: { chunk: string }

event: summary
data: { summary: string }

event: error
data: { error: string }
```

### POST /api/followup

```typescript
// Request
{
  topic: string;
  messages: DiscussionMessage[];
  summary: string;
  provider: AIProviderType;
  model?: string;
}

// Response
{
  followups: string[];
}
```

## 移行戦略

1. 新APIを作成（既存と並行稼働）
2. `useDiscussion` に新フラグ `useNewOrchestration: boolean` を追加
3. フラグで新旧を切り替えてテスト
4. 問題なければ旧コードを削除

## 注意点

- IndexedDB の既存データ構造は維持
- 検索キャッシュは共有（サーバーサイドで動作）
- SSEのエラーハンドリングを適切に実装
