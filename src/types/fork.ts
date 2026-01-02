// 分岐プリセット
export interface ForkPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

// 分岐プリセット一覧
export const FORK_PRESETS: ForkPreset[] = [
  { id: 'technical', name: '技術的視点', description: '技術的な実現可能性や実装の観点から', prompt: '技術的な実現可能性、パフォーマンス、スケーラビリティ、実装の複雑さなどの観点から議論してください。' },
  { id: 'business', name: 'ビジネス視点', description: 'ビジネス価値やROIの観点から', prompt: 'ビジネス価値、投資対効果、市場競争力、収益性などの観点から議論してください。' },
  { id: 'ethical', name: '倫理的視点', description: '倫理的・社会的な影響の観点から', prompt: '倫理的な問題、社会的影響、公平性、プライバシーなどの観点から議論してください。' },
  { id: 'risk', name: 'リスク視点', description: 'リスクや課題の観点から', prompt: 'リスク、課題、障害となりうる要因、失敗シナリオなどの観点から議論してください。' },
];
