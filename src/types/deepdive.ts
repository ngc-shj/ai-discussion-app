// 深掘りモードの種類
export type DeepDiveType =
  | 'technical'     // 技術的詳細
  | 'practical'     // 実践的な応用
  | 'theoretical'   // 理論的背景
  | 'comparison'    // 比較分析
  | 'implications'  // 影響と結果
  | 'custom';       // カスタム

// 深掘りプリセット
export interface DeepDivePreset {
  id: DeepDiveType;
  name: string;
  description: string;
  prompt: string;
}

// 深掘りプリセット一覧
export const DEEP_DIVE_PRESETS: DeepDivePreset[] = [
  {
    id: 'technical',
    name: '技術的詳細',
    description: '技術的な側面を深掘り',
    prompt: '技術的な詳細、実装方法、アーキテクチャについて深く掘り下げてください。',
  },
  {
    id: 'practical',
    name: '実践的応用',
    description: '実際の適用方法を検討',
    prompt: '実際にどのように適用できるか、具体的なステップや注意点について議論してください。',
  },
  {
    id: 'theoretical',
    name: '理論的背景',
    description: '背景にある理論を探求',
    prompt: '背景にある理論、原理原則、学術的な根拠について深く議論してください。',
  },
  {
    id: 'comparison',
    name: '比較分析',
    description: '他のアプローチと比較',
    prompt: '他のアプローチや代替案と比較し、それぞれの長所短所を分析してください。',
  },
  {
    id: 'implications',
    name: '影響と結果',
    description: '影響や将来への示唆を考察',
    prompt: 'この内容が持つ影響、結果、将来への示唆について深く考察してください。',
  },
];
