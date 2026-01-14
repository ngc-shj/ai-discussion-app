# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Discussion Arena is a Next.js application where multiple AI models (Claude, Ollama, OpenAI, Gemini) discuss topics in a round-robin format and generate integrated answers. The app supports real-time streaming via Server-Sent Events (SSE), web search integration, session management with IndexedDB, and various discussion modes.

## Common Commands

```bash
# Development
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Architecture

### Data Flow

1. **Frontend** (`src/app/page.tsx`) → User input and settings
2. **API Routes** (`src/app/api/`) → Handle requests, return SSE streams
3. **Discussion Engine** (`src/lib/discussion-engine/`) → Orchestrates multi-AI discussions
4. **AI Providers** (`src/lib/ai-providers/`) → Abstract interface for Claude, Ollama, OpenAI, Gemini
5. **Search System** (`src/lib/search/`) → Multi-provider search with relevance filtering

### Key Modules

**Discussion Engine** (`src/lib/discussion-engine/index.ts`)
- `runDiscussion()` - Async generator that yields SSE events for real-time updates
- Handles round-robin participant turns, search integration, summary generation
- Supports resumable discussions via `resumeFrom` parameter

**AI Providers** (`src/lib/ai-providers/`)
- Factory pattern: `createProvider(type, model)` returns appropriate provider instance
- Each provider implements `AIProvider` interface with `generate()`, `generateStream()`, `isAvailable()`, `listModels()`
- Prompt building: `createDiscussionPrompt()` in `types.ts`

**Search System** (`src/lib/search/`)
- Multiple providers: Tavily, SearXNG, DuckDuckGo, Brave, Serper
- `performSearch()` - Main entry point with Jina Reader enrichment and AI relevance filtering
- Priority: Tavily > SearXNG > Serper > Brave > DuckDuckGo

**State Management** (`src/hooks/useDiscussion.ts`)
- Central hook managing discussion state, SSE processing, session persistence
- Handles: start, resume, extend, interrupt discussions
- Auto-saves interrupted state to IndexedDB for recovery

**Session Storage** (`src/lib/session-storage.ts`)
- IndexedDB-based persistence via `idb` library
- Stores: sessions, turns, interrupted states, presets

### SSE Event Types

Discussion API returns these event types:
- `progress` - Current round/participant status
- `message` - Completed AI response
- `message_chunk` - Streaming response chunk
- `search_keywords` - Generated search terms
- `search_progress` - Search execution progress
- `search_results` - Search results
- `summary` - Integrated answer
- `followups` - Suggested follow-up questions
- `ready_for_summary` - All rounds complete, awaiting summary
- `complete` / `error` / `terminated`

### Type System

Types are organized in `src/types/` with barrel exports from `index.ts`:
- `provider.ts` - AI provider types
- `participant.ts` - Discussion participant, roles
- `message.ts` - Messages, turns, interruption snapshots
- `session.ts` - Session structure
- `config.ts` - Search, user profile, discussion settings

## Environment Variables

Required (at least one AI provider):
- `ANTHROPIC_API_KEY` - Claude
- `OPENAI_API_KEY` - OpenAI
- `GOOGLE_AI_API_KEY` - Gemini
- `OLLAMA_BASE_URL` - Ollama (default: http://localhost:11434)

Search providers (optional, priority order):
- `TAVILY_API_KEY`
- `SEARXNG_BASE_URL`
- `SERPER_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- (DuckDuckGo requires no key)

Optional:
- `JINA_API_KEY` - Full page content fetching

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- IndexedDB via `idb`
- Markdown: react-markdown + remark-gfm + rehype-highlight
