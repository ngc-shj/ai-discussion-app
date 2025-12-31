import { AIProviderType, AIRequest, AIResponse } from '@/types';

// モデル情報
export interface ModelInfo {
  id: string;
  name: string;
}

// AIプロバイダーの抽象インターフェース
export interface AIProvider {
  readonly type: AIProviderType;
  readonly name: string;

  generate(request: AIRequest): Promise<AIResponse>;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
}

// 過去のターンの要約
export interface PreviousTurnSummary {
  topic: string;
  finalAnswer: string;
}

// 議論用のシステムプロンプト
export function createDiscussionPrompt(
  topic: string,
  previousMessages: Array<{ provider: string; content: string }>,
  isFirstRound: boolean,
  isFinalSummary: boolean,
  previousTurns?: PreviousTurnSummary[]
): string {
  // 過去のターンのコンテキストを構築
  let previousContext = '';
  if (previousTurns && previousTurns.length > 0) {
    const turnsText = previousTurns
      .map((turn, i) => `【質問${i + 1}】${turn.topic}\n【回答${i + 1}】${turn.finalAnswer}`)
      .join('\n\n');
    previousContext = `\n【これまでの議論の履歴】\n${turnsText}\n`;
  }

  if (isFinalSummary) {
    const allResponses = previousMessages
      .map((m) => `【${m.provider}の意見】\n${m.content}`)
      .join('\n\n');

    return `あなたは議論の統合者です。以下のトピックについて、複数のAIが議論を行いました。
それぞれの意見を踏まえて、最終的な統合回答を作成してください。
${previousContext}
【今回の議論のトピック】
${topic}

【各AIの意見】
${allResponses}

【指示】
- 各AIの意見の良い点を取り入れてください
- 矛盾がある場合は、最も合理的な見解を採用してください
- 最終的な結論を明確に述べてください
- 過去の議論がある場合は、その文脈を踏まえて回答してください
- 統合回答は日本語で記述してください`;
  }

  if (isFirstRound) {
    return `あなたは議論に参加するAIアシスタントです。以下のトピックについて、あなたの見解を述べてください。
${previousContext}
【今回の議論のトピック】
${topic}

【指示】
- 論理的かつ建設的な意見を述べてください
- 具体例があれば挙げてください
- 過去の議論がある場合は、その文脈を踏まえて回答してください
- 回答は日本語で、簡潔にまとめてください（200-400文字程度）`;
  }

  const previousResponses = previousMessages
    .map((m) => `【${m.provider}】: ${m.content}`)
    .join('\n\n');

  return `あなたは議論に参加するAIアシスタントです。以下のトピックについて議論が進行中です。
${previousContext}
【今回の議論のトピック】
${topic}

【これまでの議論】
${previousResponses}

【指示】
- 他のAIの意見を参考にしつつ、あなた自身の見解を述べてください
- 同意する点、異なる視点、追加すべき観点などを明確にしてください
- 建設的な議論を心がけてください
- 過去の議論がある場合は、その文脈を踏まえて回答してください
- 回答は日本語で、簡潔にまとめてください（200-400文字程度）`;
}
