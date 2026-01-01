import { AIProviderType, AIRequest, AIResponse, SearchResult, ParticipantRole, ROLE_PRESETS, DiscussionParticipant } from '@/types';

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

// 検索結果をフォーマット
function formatSearchResults(searchResults: SearchResult[]): string {
  if (!searchResults || searchResults.length === 0) {
    return '';
  }

  const formattedResults = searchResults
    .map((result, i) => {
      let text = `${i + 1}. ${result.title}\n   URL: ${result.url}`;
      if (result.content) {
        text += `\n   内容: ${result.content}`;
      }
      if (result.publishedDate) {
        text += `\n   日付: ${result.publishedDate}`;
      }
      return text;
    })
    .join('\n\n');

  return `\n【最新の検索結果】\n以下は関連する最新の情報です。これらの情報を参考にして議論してください。\n\n${formattedResults}\n`;
}

// ロールのプロンプトを取得
function getRolePrompt(role?: ParticipantRole, customRolePrompt?: string): string {
  if (!role || role === 'neutral') {
    return '';
  }
  if (role === 'custom' && customRolePrompt) {
    return `\n【あなたの役割】\n${customRolePrompt}\n`;
  }
  const preset = ROLE_PRESETS.find((r) => r.id === role);
  if (preset) {
    return `\n【あなたの役割】\n${preset.prompt}\n`;
  }
  return '';
}

// 参加者リストをフォーマット
function formatParticipantsList(
  participants: DiscussionParticipant[],
  currentParticipant?: DiscussionParticipant
): string {
  if (!participants || participants.length === 0) {
    return '';
  }

  const participantLines = participants.map((p) => {
    const rolePreset = p.role ? ROLE_PRESETS.find((r) => r.id === p.role) : undefined;
    const roleName = rolePreset?.name || '中立';
    const roleDesc = rolePreset?.description || 'バランスの取れた客観的な視点';
    const isCurrentUser = currentParticipant &&
      p.provider === currentParticipant.provider &&
      p.model === currentParticipant.model;

    if (isCurrentUser) {
      return `- **あなた**: ${p.displayName} [${roleName}] - ${roleDesc}`;
    }
    return `- ${p.displayName} [${roleName}] - ${roleDesc}`;
  });

  return `\n【今回の議論参加者（予定）】\n${participantLines.join('\n')}\n※一部の参加者がエラーで発言できない場合があります。「これまでの議論」に登場した参加者のみ参照してください。\n`;
}

// 議論用のシステムプロンプト
export function createDiscussionPrompt(
  topic: string,
  previousMessages: Array<{ provider: string; content: string; role?: string }>,
  isFirstRound: boolean,
  isFinalSummary: boolean,
  previousTurns?: PreviousTurnSummary[],
  searchResults?: SearchResult[],
  currentRole?: ParticipantRole,
  customRolePrompt?: string,
  allParticipants?: DiscussionParticipant[],
  currentParticipant?: DiscussionParticipant
): string {
  // 過去のターンのコンテキストを構築
  let previousContext = '';
  if (previousTurns && previousTurns.length > 0) {
    const turnsText = previousTurns
      .map((turn, i) => `【質問${i + 1}】${turn.topic}\n【回答${i + 1}】${turn.finalAnswer}`)
      .join('\n\n');
    previousContext = `\n【これまでの議論の履歴】\n${turnsText}\n`;
  }

  // 検索結果のコンテキストを構築
  const searchContext = formatSearchResults(searchResults || []);

  // ロールのプロンプトを取得
  const rolePrompt = getRolePrompt(currentRole, customRolePrompt);

  // 参加者リストを取得
  const participantsContext = formatParticipantsList(allParticipants || [], currentParticipant);

  if (isFinalSummary) {
    const allResponses = previousMessages
      .map((m) => {
        const roleLabel = m.role ? `（${m.role}）` : '';
        return `【${m.provider}${roleLabel}の意見】\n${m.content}`;
      })
      .join('\n\n');

    return `あなたは議論の統合者です。以下のトピックについて、複数のAIがそれぞれの役割に基づいて議論を行いました。
それぞれの意見を踏まえて、最終的な統合回答を作成してください。
${previousContext}${searchContext}
【今回の議論のトピック】
${topic}

【各AIの意見】
${allResponses}

【指示】
- 各AIの意見の良い点を取り入れてください
- それぞれの役割に基づいた視点を考慮してください
- 矛盾がある場合は、最も合理的な見解を採用してください
- 最終的な結論を明確に述べてください
- 過去の議論がある場合は、その文脈を踏まえて回答してください
- 検索結果がある場合は、最新の情報を考慮して回答してください
- 統合回答は日本語で記述してください`;
  }

  if (isFirstRound) {
    return `あなたは議論に参加するAIアシスタントです。以下のトピックについて、あなたの見解を述べてください。
${rolePrompt}${participantsContext}${previousContext}${searchContext}
【今回の議論のトピック】
${topic}

【指示】
- 論理的かつ建設的な意見を述べてください
- 具体例があれば挙げてください
- 過去の議論がある場合は、その文脈を踏まえて回答してください
- 検索結果がある場合は、最新の情報を参考にして回答してください
- 回答は日本語で、簡潔にまとめてください（200-400文字程度）`;
  }

  const previousResponses = previousMessages
    .map((m) => {
      const roleLabel = m.role ? `（${m.role}）` : '';
      return `【${m.provider}${roleLabel}】: ${m.content}`;
    })
    .join('\n\n');

  return `あなたは議論に参加するAIアシスタントです。以下のトピックについて議論が進行中です。
${rolePrompt}${participantsContext}${previousContext}${searchContext}
【今回の議論のトピック】
${topic}

【これまでの議論】
${previousResponses}

【指示】
- 上記「これまでの議論」に登場した参加者の意見を参照する際は、名前を挙げてコメントしてください（例: 「〇〇さんの意見に同意しますが...」）
- 発言していない参加者には言及しないでください
- 同意する点、異なる視点、追加すべき観点などを明確にしてください
- 特に議論を深めたい相手がいれば、その人に向けて質問や意見を述べてください
- 建設的な議論を心がけてください
- 過去の議論がある場合は、その文脈を踏まえて回答してください
- 検索結果がある場合は、最新の情報を参考にして回答してください
- 回答は日本語で、簡潔にまとめてください（200-400文字程度）`;
}
