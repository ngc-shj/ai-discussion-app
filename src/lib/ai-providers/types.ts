import { AIProviderType, AIRequest, AIResponse, SearchResult, ParticipantRole, ROLE_PRESETS, DiscussionParticipant, UserProfile, TECH_LEVEL_PRESETS, RESPONSE_STYLE_PRESETS, DiscussionMode, DISCUSSION_MODE_PRESETS, DiscussionDepth, DISCUSSION_DEPTH_PRESETS, DirectionGuide, FollowUpQuestion, FollowUpCategory, MessageVote } from '@/types';

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

// ユーザープロファイルをフォーマット
function formatUserProfile(profile?: UserProfile): string {
  if (!profile) {
    return '';
  }

  const lines: string[] = [];

  if (profile.name) {
    lines.push(`- 名前: ${profile.name}`);
  }
  if (profile.occupation) {
    lines.push(`- 職業・専門分野: ${profile.occupation}`);
  }
  if (profile.techLevel) {
    const level = TECH_LEVEL_PRESETS.find((l) => l.id === profile.techLevel);
    if (level) {
      lines.push(`- 技術レベル: ${level.name}（${level.description}）`);
    }
  }
  if (profile.responseStyle) {
    const style = RESPONSE_STYLE_PRESETS.find((s) => s.id === profile.responseStyle);
    if (style) {
      lines.push(`- 回答スタイル: ${style.name}（${style.description}）`);
    }
  }
  if (profile.interests && profile.interests.length > 0) {
    lines.push(`- 関心のある領域: ${profile.interests.join('、')}`);
  }
  if (profile.customContext) {
    lines.push(`- その他: ${profile.customContext}`);
  }

  if (lines.length === 0) {
    return '';
  }

  return `\n【ユーザーについて】\n${lines.join('\n')}\nこのユーザーに合わせた回答を心がけてください。\n`;
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
    // IDで一致を確認（同じモデルでも異なる参加者を区別）
    const isCurrentUser = currentParticipant && p.id === currentParticipant.id;

    if (isCurrentUser) {
      return `- **あなた**: ${p.displayName} [${roleName}] - ${roleDesc}`;
    }
    return `- ${p.displayName} [${roleName}] - ${roleDesc}`;
  });

  return `\n【今回の議論参加者（予定）】\n${participantLines.join('\n')}\n※一部の参加者がエラーで発言できない場合があります。「これまでの議論」に登場した参加者のみ参照してください。\n`;
}

// 議論モードのプロンプトを取得
function getDiscussionModePrompt(mode?: DiscussionMode, isSummary = false): string {
  if (!mode || mode === 'free') {
    return '';
  }
  const preset = DISCUSSION_MODE_PRESETS.find((m) => m.id === mode);
  if (!preset) {
    return '';
  }
  return isSummary ? (preset.summaryPrompt ? `\n${preset.summaryPrompt}\n` : '') : (preset.prompt ? `\n${preset.prompt}\n` : '');
}

// 議論の深さプロンプトを取得
function getDepthPrompt(depth?: DiscussionDepth): string {
  if (!depth || depth === 3) {
    return ''; // デフォルト（標準）の場合はプロンプト不要
  }
  const preset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === depth);
  if (!preset || !preset.prompt) {
    return '';
  }
  return `\n${preset.prompt}\n回答は${preset.wordCount}程度でまとめてください。\n`;
}

// 方向性ガイドをフォーマット
function formatDirectionGuide(guide?: DirectionGuide): string {
  if (!guide) {
    return '';
  }

  const lines: string[] = [];

  if (guide.keywords && guide.keywords.length > 0) {
    lines.push(`- 注目キーワード: ${guide.keywords.join('、')}`);
  }
  if (guide.focusAreas && guide.focusAreas.length > 0) {
    lines.push(`- 特に深掘りしたい領域: ${guide.focusAreas.join('、')}`);
  }
  if (guide.avoidTopics && guide.avoidTopics.length > 0) {
    lines.push(`- 避けるべきトピック: ${guide.avoidTopics.join('、')}`);
  }

  if (lines.length === 0) {
    return '';
  }

  return `\n【議論の方向性ガイド】\n${lines.join('\n')}\nこれらの指示を考慮して議論してください。\n`;
}

// ユーザー投票情報をフォーマット（統合回答用）
function formatMessageVotes(
  votes?: MessageVote[],
  messages?: Array<{ provider: string; content: string; role?: string; messageId?: string }>
): string {
  if (!votes || votes.length === 0 || !messages) {
    return '';
  }

  const voteLabels: Record<string, string> = {
    agree: '同意',
    disagree: '反対',
    neutral: '中立',
  };

  // 投票のあるメッセージを集計
  const voteSummary: { provider: string; vote: string; contentPreview: string }[] = [];

  for (const vote of votes) {
    const message = messages.find((m) => m.messageId === vote.messageId);
    if (message) {
      voteSummary.push({
        provider: message.provider,
        vote: voteLabels[vote.vote] || vote.vote,
        contentPreview: message.content.slice(0, 50) + (message.content.length > 50 ? '...' : ''),
      });
    }
  }

  if (voteSummary.length === 0) {
    return '';
  }

  // 投票を種類別に集計
  const agreeVotes = voteSummary.filter((v) => v.vote === '同意');
  const disagreeVotes = voteSummary.filter((v) => v.vote === '反対');
  const neutralVotes = voteSummary.filter((v) => v.vote === '中立');

  const lines: string[] = [];

  if (agreeVotes.length > 0) {
    lines.push(`【ユーザーが同意した意見】（${agreeVotes.length}件）`);
    agreeVotes.forEach((v) => {
      lines.push(`- ${v.provider}: "${v.contentPreview}"`);
    });
  }

  if (disagreeVotes.length > 0) {
    lines.push(`【ユーザーが反対した意見】（${disagreeVotes.length}件）`);
    disagreeVotes.forEach((v) => {
      lines.push(`- ${v.provider}: "${v.contentPreview}"`);
    });
  }

  if (neutralVotes.length > 0) {
    lines.push(`【ユーザーが中立とした意見】（${neutralVotes.length}件）`);
    neutralVotes.forEach((v) => {
      lines.push(`- ${v.provider}: "${v.contentPreview}"`);
    });
  }

  if (lines.length === 0) {
    return '';
  }

  return `\n${lines.join('\n')}\n\n※ユーザーの投票を考慮して、同意された意見を重視し、反対された意見については批判的に検討してください。中立の意見は参考程度に扱ってください。\n`;
}

// 議論用のシステムプロンプト
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

  // 深さに応じた文字数指示を取得
  const depthPreset = discussionDepth ? DISCUSSION_DEPTH_PRESETS.find((d) => d.level === discussionDepth) : undefined;
  const wordCountInstruction = depthPreset ? depthPreset.wordCount : '200-400文字程度';

  if (isFirstRound) {
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

// フォローアップ質問生成用のプロンプト
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

// フォローアップ質問のレスポンスをパース
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
