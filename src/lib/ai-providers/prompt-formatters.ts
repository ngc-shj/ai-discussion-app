import {
  SearchResult,
  ParticipantRole,
  ROLE_PRESETS,
  DiscussionParticipant,
  UserProfile,
  TECH_LEVEL_PRESETS,
  RESPONSE_STYLE_PRESETS,
  DiscussionMode,
  DISCUSSION_MODE_PRESETS,
  DiscussionDepth,
  DISCUSSION_DEPTH_PRESETS,
  DirectionGuide,
  MessageVote,
  isCustomRoleId,
  parseStructuredTopic,
} from '@/types';

// 全文コンテンツの最大文字数（1件あたり）
const MAX_FULL_CONTENT_LENGTH = 3000;

/**
 * 全文コンテンツを適切な長さに切り詰める
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  // 文の途中で切れないように、最後の改行または句点で切る
  const truncated = content.slice(0, maxLength);
  const lastBreak = Math.max(
    truncated.lastIndexOf('\n'),
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('. ')
  );
  if (lastBreak > maxLength * 0.7) {
    return truncated.slice(0, lastBreak + 1) + '\n...（省略）';
  }
  return truncated + '...（省略）';
}

/**
 * 検索結果をXML形式でフォーマット
 * 注意: filtered: true の結果（関連性フィルタで除外されたもの）は含めない
 */
export function formatSearchResults(searchResults: SearchResult[]): string {
  if (!searchResults || searchResults.length === 0) {
    return '';
  }

  // filtered: true の結果を除外
  const relevantResults = searchResults.filter((result) => !result.filtered);

  if (relevantResults.length === 0) {
    return '';
  }

  const resultsXml = relevantResults
    .map((result, i) => {
      const dateAttr = result.publishedDate ? ` date="${escapeXmlAttr(result.publishedDate)}"` : '';
      // fullContentがあればそれを使用、なければcontentを使用
      const contentText = result.fullContent
        ? truncateContent(result.fullContent, MAX_FULL_CONTENT_LENGTH)
        : (result.content || '');

      return `  <result index="${i + 1}" url="${escapeXmlAttr(result.url)}"${dateAttr}>
    <title>${escapeXmlContent(result.title)}</title>
    <content>${escapeXmlContent(contentText)}</content>
  </result>`;
    })
    .join('\n');

  return `
【最新の検索結果（XML形式）】
以下の検索結果はXML形式で構造化されています。各<result>要素にはURL、日付などの属性が含まれています。
<search-results count="${relevantResults.length}">
${resultsXml}
</search-results>
`;
}

/**
 * ロールのプロンプトを取得
 * @param role ロールID（プリセット or カスタムロールID）
 * @param customRolePrompt カスタムロールのプロンプト（カスタムロールIDの場合に使用）
 */
export function getRolePrompt(role?: ParticipantRole, customRolePrompt?: string): string {
  if (!role || role === 'neutral') {
    return '';
  }
  // カスタムロールIDの場合はcustomRolePromptを使用
  if (isCustomRoleId(role) && customRolePrompt) {
    return `\n【あなたの役割】\n${customRolePrompt}\n`;
  }
  // プリセットロールの場合
  const preset = ROLE_PRESETS.find((r) => r.id === role);
  if (preset) {
    return `\n【あなたの役割】\n${preset.prompt}\n`;
  }
  return '';
}

/**
 * ユーザープロファイルをフォーマット
 */
export function formatUserProfile(profile?: UserProfile): string {
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

/**
 * 参加者リストをフォーマット
 */
export function formatParticipantsList(
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

/**
 * 議論モードのプロンプトを取得
 */
export function getDiscussionModePrompt(mode?: DiscussionMode, isSummary = false): string {
  if (!mode || mode === 'free') {
    return '';
  }
  const preset = DISCUSSION_MODE_PRESETS.find((m) => m.id === mode);
  if (!preset) {
    return '';
  }
  return isSummary ? (preset.summaryPrompt ? `\n${preset.summaryPrompt}\n` : '') : (preset.prompt ? `\n${preset.prompt}\n` : '');
}

/**
 * 議論の深さプロンプトを取得
 */
export function getDepthPrompt(depth?: DiscussionDepth): string {
  if (!depth || depth === 3) {
    return ''; // デフォルト（標準）の場合はプロンプト不要
  }
  const preset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === depth);
  if (!preset || !preset.prompt) {
    return '';
  }
  return `\n${preset.prompt}\n回答は${preset.wordCount}程度でまとめてください。\n`;
}

/**
 * 方向性ガイドをフォーマット
 */
export function formatDirectionGuide(guide?: DirectionGuide): string {
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

/**
 * ユーザー投票情報をフォーマット（統合回答用）
 */
export function formatMessageVotes(
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

/**
 * XML形式で議論履歴をフォーマット
 * LLMにとってより構造化された形式で議論の文脈を伝える
 */
export function formatDiscussionHistoryXml(
  messages: Array<{ provider: string; content: string; role?: string; round?: number }>,
  topic: string
): string {
  if (!messages || messages.length === 0) {
    return '';
  }

  // トピックから添付コンテンツを除いた質問部分のみを抽出
  const structured = parseStructuredTopic(topic);
  const topicForAttr = structured.question;

  const messagesXml = messages
    .map((m, index) => {
      const roleAttr = m.role ? ` role="${escapeXmlAttr(m.role)}"` : '';
      const roundAttr = m.round ? ` round="${m.round}"` : '';
      return `  <message index="${index + 1}" speaker="${escapeXmlAttr(m.provider)}"${roleAttr}${roundAttr}>
${escapeXmlContent(m.content)}
  </message>`;
    })
    .join('\n');

  return `<discussion-history topic="${escapeXmlAttr(topicForAttr)}" message_count="${messages.length}">
${messagesXml}
</discussion-history>`;
}

/**
 * XML属性値をエスケープ
 */
function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * XMLコンテンツをエスケープ
 */
function escapeXmlContent(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 検索キーワード生成のタイミング
 */
export type SearchKeywordTiming = 'start' | 'round' | 'summary';

/**
 * 検索キーワード生成用プロンプトを作成
 */
export function createSearchKeywordPrompt(
  topic: string,
  messages?: Array<{ provider: string; content: string }>,
  timing: SearchKeywordTiming = 'start'
): string {
  const currentYear = new Date().getFullYear();

  if (timing === 'start') {
    return `以下のトピックについてWeb検索を行います。
効果的な検索のためのキーワードを3つ生成してください。

トピック: ${topic}

要件:
- 各キーワードは検索エンジンに最適化された形式（短く、具体的に）
- 最新の情報を得られるよう必要に応じて「${currentYear}」などの年号を含める
- 専門用語や固有名詞を適切に使用
- 日本語と英語を適切に使い分ける

出力形式（JSONのみ、他の文章は不要）:
["キーワード1", "キーワード2", "キーワード3"]`;
  }

  // 各ラウンド・統合回答前：メッセージ部分のみXML形式
  const messagesXml = messages
    ?.map((m) => `  <message provider="${escapeXmlAttr(m.provider)}">\n${escapeXmlContent(m.content)}\n  </message>`)
    .join('\n') || '';

  const formattedMessages = messages && messages.length > 0
    ? `<discussion-history message_count="${messages.length}">\n${messagesXml}\n</discussion-history>`
    : '';

  const timingLabel = timing === 'round' ? '追加調査' : 'ファクトチェック';

  return `以下の議論を踏まえて、${timingLabel}のための検索キーワードを3つ生成してください。

トピック: ${topic}

議論内容:
${formattedMessages}

要件:
- 議論で言及された具体的な事実・統計・人名などを確認できるキーワード
- まだ議論で十分に扱われていない関連トピック
- 異なる視点や反論を見つけられるキーワード
- 最新の情報を得られるよう必要に応じて「${currentYear}」などの年号を含める

出力形式（JSONのみ、他の文章は不要）:
["キーワード1", "キーワード2", "キーワード3"]`;
}
