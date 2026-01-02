import {
  SearchResult,
  ParticipantRole,
  DiscussionParticipant,
  UserProfile,
  TECH_LEVEL_PRESETS,
  DiscussionMode,
  DiscussionDepth,
  DISCUSSION_DEPTH_PRESETS,
  DirectionGuide,
  FollowUpQuestion,
  FollowUpCategory,
  MessageVote,
} from '@/types';
import {
  formatSearchResults,
  getRolePrompt,
  formatUserProfile,
  formatParticipantsList,
  getDiscussionModePrompt,
  getDepthPrompt,
  formatDirectionGuide,
  formatMessageVotes,
} from './prompt-formatters';

// 過去のターンの要約
export interface PreviousTurnSummary {
  topic: string;
  finalAnswer: string;
}

/**
 * 議論用のシステムプロンプトを生成
 */
export function createDiscussionPrompt(
  topic: string,
  previousMessages: Array<{ provider: string; content: string; role?: string; messageId?: string }>,
  isFirstRound: boolean,
  isFinalSummary: boolean,
  previousTurns?: PreviousTurnSummary[],
  searchResults?: SearchResult[],
  currentRole?: ParticipantRole,
  customRolePrompt?: string,
  allParticipants?: DiscussionParticipant[],
  currentParticipant?: DiscussionParticipant,
  userProfile?: UserProfile,
  discussionMode?: DiscussionMode,
  discussionDepth?: DiscussionDepth,
  directionGuide?: DirectionGuide,
  messageVotes?: MessageVote[]
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

  // ユーザープロファイルを取得
  const userProfileContext = formatUserProfile(userProfile);

  // 議論モードのプロンプトを取得
  const discussionModePrompt = getDiscussionModePrompt(discussionMode, isFinalSummary);

  // 議論の深さプロンプトを取得
  const depthPrompt = getDepthPrompt(discussionDepth);

  // 方向性ガイドを取得
  const directionGuidePrompt = formatDirectionGuide(directionGuide);

  if (isFinalSummary) {
    return createFinalSummaryPrompt(
      topic,
      previousMessages,
      previousContext,
      searchContext,
      discussionModePrompt,
      depthPrompt,
      directionGuidePrompt,
      userProfileContext,
      messageVotes
    );
  }

  // 深さに応じた文字数指示を取得
  const depthPreset = discussionDepth ? DISCUSSION_DEPTH_PRESETS.find((d) => d.level === discussionDepth) : undefined;
  const wordCountInstruction = depthPreset ? depthPreset.wordCount : '200-400文字程度';

  if (isFirstRound) {
    return createFirstRoundPrompt(
      topic,
      previousContext,
      searchContext,
      discussionModePrompt,
      depthPrompt,
      directionGuidePrompt,
      rolePrompt,
      participantsContext,
      userProfileContext,
      wordCountInstruction
    );
  }

  return createSubsequentRoundPrompt(
    topic,
    previousMessages,
    previousContext,
    searchContext,
    discussionModePrompt,
    depthPrompt,
    directionGuidePrompt,
    rolePrompt,
    participantsContext,
    userProfileContext,
    wordCountInstruction
  );
}

/**
 * 最終サマリー用プロンプト
 */
function createFinalSummaryPrompt(
  topic: string,
  previousMessages: Array<{ provider: string; content: string; role?: string; messageId?: string }>,
  previousContext: string,
  searchContext: string,
  discussionModePrompt: string,
  depthPrompt: string,
  directionGuidePrompt: string,
  userProfileContext: string,
  messageVotes?: MessageVote[]
): string {
  const allResponses = previousMessages
    .map((m) => {
      const roleLabel = m.role ? `（${m.role}）` : '';
      return `【${m.provider}${roleLabel}の意見】\n${m.content}`;
    })
    .join('\n\n');

  // ユーザー投票情報を取得
  const votesContext = formatMessageVotes(messageVotes, previousMessages);

  return `あなたは議論の統合者です。以下のトピックについて、複数のAIがそれぞれの役割に基づいて議論を行いました。
それぞれの意見を踏まえて、最終的な統合回答を作成してください。
${discussionModePrompt}${depthPrompt}${directionGuidePrompt}${userProfileContext}${previousContext}${searchContext}
【今回の議論のトピック】
${topic}

【各AIの意見】
${allResponses}
${votesContext}
【指示】
- 各AIの意見の良い点を取り入れてください
- それぞれの役割に基づいた視点を考慮してください
- 矛盾がある場合は、最も合理的な見解を採用してください
- 最終的な結論を明確に述べてください
- 過去の議論がある場合は、その文脈を踏まえて回答してください
- 検索結果がある場合は、最新の情報を考慮して回答してください
- ユーザーの投票がある場合は、同意された意見を重視してください
- 統合回答は日本語で記述してください`;
}

/**
 * 最初のラウンド用プロンプト
 */
function createFirstRoundPrompt(
  topic: string,
  previousContext: string,
  searchContext: string,
  discussionModePrompt: string,
  depthPrompt: string,
  directionGuidePrompt: string,
  rolePrompt: string,
  participantsContext: string,
  userProfileContext: string,
  wordCountInstruction: string
): string {
  return `あなたは議論に参加するAIアシスタントです。以下のトピックについて、あなたの見解を述べてください。
${discussionModePrompt}${depthPrompt}${directionGuidePrompt}${rolePrompt}${participantsContext}${userProfileContext}${previousContext}${searchContext}
【今回の議論のトピック】
${topic}

【指示】
- 論理的かつ建設的な意見を述べてください
- 具体例があれば挙げてください
- 過去の議論がある場合は、その文脈を踏まえて回答してください
- 検索結果がある場合は、最新の情報を参考にして回答してください
- 回答は日本語で、簡潔にまとめてください（${wordCountInstruction}）`;
}

/**
 * 2ラウンド目以降用プロンプト
 */
function createSubsequentRoundPrompt(
  topic: string,
  previousMessages: Array<{ provider: string; content: string; role?: string }>,
  previousContext: string,
  searchContext: string,
  discussionModePrompt: string,
  depthPrompt: string,
  directionGuidePrompt: string,
  rolePrompt: string,
  participantsContext: string,
  userProfileContext: string,
  wordCountInstruction: string
): string {
  const previousResponses = previousMessages
    .map((m) => {
      const roleLabel = m.role ? `（${m.role}）` : '';
      return `【${m.provider}${roleLabel}】: ${m.content}`;
    })
    .join('\n\n');

  return `あなたは議論に参加するAIアシスタントです。以下のトピックについて議論が進行中です。
${discussionModePrompt}${depthPrompt}${directionGuidePrompt}${rolePrompt}${participantsContext}${userProfileContext}${previousContext}${searchContext}
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
- 回答は日本語で、簡潔にまとめてください（${wordCountInstruction}）`;
}

/**
 * フォローアップ質問生成用のプロンプト
 */
export function createFollowUpPrompt(
  topic: string,
  finalAnswer: string,
  userProfile?: UserProfile
): string {
  const techLevelHint = userProfile?.techLevel
    ? TECH_LEVEL_PRESETS.find((l) => l.id === userProfile.techLevel)?.description || ''
    : '';

  return `あなたは議論の補助者です。以下のトピックと回答について、ユーザーが次に知りたいであろうフォローアップ質問を4つ提案してください。

【トピック】
${topic}

【統合回答】
${finalAnswer.slice(0, 1500)}${finalAnswer.length > 1500 ? '...' : ''}

${techLevelHint ? `【ユーザーの技術レベル】\n${techLevelHint}\n` : ''}

【出力形式】
以下のJSON配列形式で出力してください。JSONのみを出力し、他の説明は不要です。

[
  {"category": "clarification", "question": "〜について詳しく説明してもらえますか？"},
  {"category": "expansion", "question": "〜の観点からも考えてみたいのですが..."},
  {"category": "example", "question": "具体的な例を挙げてもらえますか？"},
  {"category": "alternative", "question": "別のアプローチはありますか？"}
]

【カテゴリの説明】
- clarification: 回答の詳細や不明点を明確にする質問
- expansion: 議論を別の視点や領域に広げる質問
- example: 具体例やケーススタディを求める質問
- alternative: 代替案や別のアプローチを探る質問

【注意】
- 各カテゴリから1つずつ質問を生成してください
- 質問は簡潔で具体的にしてください
- 統合回答の内容を踏まえた関連性の高い質問にしてください`;
}

/**
 * フォローアップ質問のレスポンスをパース
 */
export function parseFollowUpResponse(response: string): FollowUpQuestion[] {
  try {
    // JSONを抽出（前後のテキストを除去）
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ category: string; question: string }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const validCategories: FollowUpCategory[] = ['clarification', 'expansion', 'example', 'alternative'];

    return parsed
      .filter((item) => {
        return (
          item &&
          typeof item.category === 'string' &&
          typeof item.question === 'string' &&
          validCategories.includes(item.category as FollowUpCategory)
        );
      })
      .map((item, index) => ({
        id: `followup-${Date.now()}-${index}`,
        category: item.category as FollowUpCategory,
        question: item.question,
      }));
  } catch {
    return [];
  }
}
