# AI Discussion Arena

複数のAI（Claude、Ollama、OpenAI、Gemini）がラウンドロビン形式で議論し、最終的に統合回答を生成するWeb UIアプリケーション。

## 機能

- **マルチAI議論**: 複数のAIモデルが順番に発言し、前の意見を踏まえて議論を深める
- **ラウンドロビン形式**: 指定したラウンド数だけ各AIが順番に発言
- **統合回答生成**: 議論終了後、全ての意見を統合した回答を自動生成
- **リアルタイムストリーミング**: 各AIの回答をリアルタイムで表示
- **セッション管理**: 議論履歴をIndexedDBに保存、複数セッションの管理が可能
- **レスポンシブ対応**: PC・モバイル両対応のUI

## 対応AIプロバイダー

- **Claude** (Anthropic API)
- **Ollama** (ローカル実行)
- **OpenAI** (ChatGPT)
- **Gemini** (Google AI)

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/ngc-shj/ai-discussion-app.git
cd ai-discussion-app
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local`ファイルを作成し、使用するAPIキーを設定:

```env
# Anthropic (Claude)
ANTHROPIC_API_KEY=your_api_key

# OpenAI
OPENAI_API_KEY=your_api_key

# Google AI (Gemini)
GOOGLE_AI_API_KEY=your_api_key

# Ollama (ローカル実行の場合、デフォルトはlocalhost:11434)
OLLAMA_BASE_URL=http://localhost:11434
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開く。

## 使い方

1. 右側の設定パネルで参加するAIモデルを選択
2. ラウンド数を設定（1〜5）
3. 議論したいトピックを入力して「議論開始」をクリック
4. 各AIが順番に回答し、最後に統合回答が生成される

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **データ永続化**: IndexedDB (idb)
- **AI SDK**:
  - `@anthropic-ai/sdk` (Claude)
  - `openai` (OpenAI)
  - `@google/generative-ai` (Gemini)

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。
