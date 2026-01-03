# AI Discussion Arena

A Web UI application where multiple AIs (Claude, Ollama, OpenAI, Gemini) discuss topics in a round-robin format and generate integrated answers.

[日本語版 README](README.ja.md)

## Features

### Core Features

- **Multi-AI Discussion**: Multiple AI models take turns speaking, deepening the discussion based on previous opinions
- **Round-Robin Format**: Each AI speaks in turn for the specified number of rounds
- **Integrated Answer Generation**: Automatically generates an answer integrating all opinions after the discussion
- **Real-time Streaming**: Display each AI's response in real-time
- **Web Search Integration**: Search for the latest information using SearXNG and reflect it in the discussion
- **Progress Visualization**: Visual display of selected models and their execution status (pending/active/completed)
- **Session Management**: Save discussion history to IndexedDB, manage multiple sessions
- **Responsive Design**: UI compatible with both PC and mobile devices

### Discussion Modes

- **Free**: Open discussion without specific constraints
- **Brainstorm**: Generate diverse ideas and possibilities
- **Debate**: Structured argumentation with opposing viewpoints
- **Consensus**: Work toward agreement among participants
- **Critique**: Critical analysis and evaluation
- **Counterargument**: Generate opposing perspectives

### Advanced Features

- **Custom Roles**: Define custom roles with personalized prompts for participants
- **Follow-up Suggestions**: AI-generated follow-up questions after discussions
- **Deep Dive Analysis**: In-depth analysis of specific topics
- **Discussion Forking**: Branch discussions to explore alternative directions
- **Message Voting**: Rate individual messages in discussions
- **Interrupted Discussion Recovery**: Resume discussions that were interrupted
- **Termination Conditions**: End discussions by rounds, consensus detection, or manually

## Supported AI Providers

| Provider | Type | Requirements |
|----------|------|--------------|
| **Claude** | Cloud API | Anthropic API Key |
| **Ollama** | Local | Ollama server running |
| **OpenAI** | Cloud API | OpenAI API Key |
| **Gemini** | Cloud API | Google AI API Key |

## Screenshots

### Discussion View
The main discussion panel showing AI conversations with model status indicators:

```
┌─────────────────────────────────────────────────────┐
│  [gemma2:2b ✓] [qwen3:4b ●] [統合]   ← Model chips │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ← Progress    │
│  ● qwen3:4b is responding...   Round 1/2          │
└─────────────────────────────────────────────────────┘
```

## Setup

### Prerequisites

- **Node.js** 18.x or later
- **npm** or **yarn**
- At least one AI provider configured:
  - Anthropic API key for Claude
  - Ollama installed and running for local models
  - OpenAI API key for ChatGPT
  - Google AI API key for Gemini

### 1. Clone the Repository

```bash
git clone https://github.com/ngc-shj/ai-discussion-app.git
cd ai-discussion-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file based on `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set your API keys:

```env
# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Google AI (Gemini)
GOOGLE_AI_API_KEY=xxxxx

# Ollama (default: localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434

# SearXNG (optional, for web search feature)
SEARXNG_BASE_URL=http://localhost:8080
```

> **Note**: You only need to configure the providers you plan to use.

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Provider Setup Details

### Ollama (Local Models)

1. Install Ollama from [ollama.ai](https://ollama.ai/)

2. Pull models you want to use:
   ```bash
   ollama pull gemma2:2b
   ollama pull qwen3:4b
   ollama pull llama3.2:3b
   ```

3. Ensure Ollama server is running:
   ```bash
   ollama serve
   ```

### SearXNG (Web Search)

To use the web search feature, set up a SearXNG instance with JSON format enabled.

**Recommended**: Use the pre-configured Docker setup from [ngc-shj/searxng-mcp-server](https://github.com/ngc-shj/searxng-mcp-server):

```bash
git clone https://github.com/ngc-shj/searxng-mcp-server.git
cd searxng-mcp-server
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/searxng-config/settings.yml:/etc/searxng/settings.yml:ro \
  -e SEARXNG_BASE_URL=http://localhost:8080/ \
  searxng/searxng
```

This setup uses a custom settings file with JSON format output already enabled.

**Manual Setup** (if you prefer):

1. Using Docker:

   ```bash
   docker run -d -p 8080:8080 searxng/searxng
   ```

2. Configure SearXNG to enable JSON format output:
   - Edit `settings.yml` in your SearXNG instance
   - Under `search.formats`, enable `json`

3. Set `SEARXNG_BASE_URL` in your `.env.local`

## Usage

1. **Select AI Models**: In the right settings panel, check the AI models to participate
2. **Set Rounds**: Choose the number of discussion rounds (1-5)
3. **Enable Web Search** (Optional): Toggle "Web検索を使用" to search for latest information
4. **Start Discussion**: Enter your topic and click "議論開始"
5. **View Results**: Watch as each AI responds, followed by an integrated summary

### Web Search Feature

When enabled, the app searches for relevant information before the discussion starts:

- **Search Type**: Web search or News search
- **Result Count**: 3-10 search results
- Results are displayed in a collapsible section and provided to all AI participants

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI**: React 19
- **Styling**: Tailwind CSS 4
- **Data Persistence**: IndexedDB (idb)
- **AI SDKs**:
  - `@anthropic-ai/sdk` (Claude)
  - `openai` (OpenAI)
  - `@google/generative-ai` (Gemini)
  - Ollama (HTTP API)
- **Markdown**: react-markdown, remark-gfm, rehype-highlight
- **Streaming**: Server-Sent Events (SSE)

## Project Structure

```
ai-discussion-app/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Main UI
│   │   └── api/
│   │       ├── discuss/       # Discussion API endpoint (SSE)
│   │       ├── models/        # Available models endpoint
│   │       ├── providers/     # Provider availability check
│   │       ├── search/        # SearXNG search endpoint
│   │       └── summarize/     # Integrated answer generation
│   ├── components/            # React UI components (~20)
│   │   ├── DiscussionPanel.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── InputForm.tsx
│   │   ├── AISelector.tsx
│   │   ├── RoleEditor.tsx
│   │   ├── FinalAnswer.tsx
│   │   ├── FollowUpSuggestions.tsx
│   │   ├── DeepDiveModal.tsx
│   │   ├── ForkModal.tsx
│   │   └── ...
│   ├── hooks/                 # Custom React hooks
│   │   ├── useDiscussion.ts
│   │   ├── useDiscussionSettings.ts
│   │   ├── useSessionManager.ts
│   │   └── ...
│   ├── lib/
│   │   ├── ai-providers/      # AI provider implementations
│   │   ├── discussion-engine/ # Discussion orchestration
│   │   ├── session-storage.ts
│   │   └── sse-utils.ts
│   └── types/                 # TypeScript type definitions
│       ├── index.ts
│       ├── provider.ts
│       ├── participant.ts
│       ├── message.ts
│       ├── config.ts
│       └── session.ts
├── .env.local.example
└── package.json
```

## Troubleshooting

### "Provider not available" Error

- **Ollama**: Ensure `ollama serve` is running and accessible at the configured URL
- **Cloud APIs**: Verify your API keys are correctly set in `.env.local`
- Check the browser console for detailed error messages

### No Models Showing

- For Ollama, ensure you've pulled at least one model (`ollama list` to check)
- For cloud providers, verify API keys have the necessary permissions

### Web Search Not Working

- Ensure SearXNG is running and accessible
- Check that JSON format is enabled in SearXNG settings
- Verify `SEARXNG_BASE_URL` is correctly configured

## License

MIT License - See [LICENSE](LICENSE) file for details.
