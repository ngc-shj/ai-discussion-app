// フォローアップ質問のカテゴリ
export type FollowUpCategory = 'clarification' | 'expansion' | 'example' | 'alternative';

// フォローアップ質問
export interface FollowUpQuestion {
  id: string;
  question: string;
  category: FollowUpCategory;
}

// フォローアップカテゴリのラベル
export const FOLLOW_UP_CATEGORY_LABELS: Record<FollowUpCategory, string> = {
  clarification: '詳細',
  expansion: '拡張',
  example: '具体例',
  alternative: '別視点',
};
