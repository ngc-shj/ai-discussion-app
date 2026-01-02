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
} from '@/types';

/**
 * 検索結果をフォーマット
 */
export function formatSearchResults(searchResults: SearchResult[]): string {
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

/**
 * ロールのプロンプトを取得
 */
export function getRolePrompt(role?: ParticipantRole, customRolePrompt?: string): string {
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
