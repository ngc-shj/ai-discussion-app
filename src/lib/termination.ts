import { DiscussionMessage } from '@/types';

/**
 * 合意判定用のキーワード
 */
const CONSENSUS_KEYWORDS = [
  '同意します', '賛成です', '合意です', '異論ありません',
  '同じ意見です', '同感です', 'I agree', 'agreed',
  '結論として', 'まとめると', '全員一致',
];

/**
 * メッセージ間の合意度をチェック
 * 最新ラウンドのメッセージで合意キーワードの出現率を計算
 */
export function checkConsensus(messages: DiscussionMessage[], threshold: number): boolean {
  if (messages.length < 2) return false;

  // 最新ラウンドのメッセージを取得
  const maxRound = Math.max(...messages.map(m => m.round));
  const latestMessages = messages.filter(m => m.round === maxRound);

  if (latestMessages.length < 2) return false;

  // 各メッセージで合意キーワードをチェック
  let consensusCount = 0;
  for (const msg of latestMessages) {
    const content = msg.content.toLowerCase();
    if (CONSENSUS_KEYWORDS.some(kw => content.includes(kw.toLowerCase()))) {
      consensusCount++;
    }
  }

  const consensusRatio = consensusCount / latestMessages.length;
  return consensusRatio >= threshold;
}

/**
 * 終了キーワードをチェック
 * コンテンツ内に指定されたキーワードが含まれているか確認
 */
export function checkTerminationKeywords(content: string, keywords: string[]): boolean {
  const lowerContent = content.toLowerCase();
  return keywords.some(kw => lowerContent.includes(kw.toLowerCase()));
}
