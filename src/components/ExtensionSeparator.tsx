'use client';

import { StartMarker, ExtensionMarker, DISCUSSION_MODE_PRESETS, DISCUSSION_DEPTH_PRESETS } from '@/types';

interface StartSeparatorProps {
  marker: StartMarker;
}

interface ExtensionSeparatorProps {
  marker: ExtensionMarker;
}

// 議論開始セパレーター
export function StartSeparatorInline({ marker }: StartSeparatorProps) {
  const modePreset = DISCUSSION_MODE_PRESETS.find((m) => m.id === marker.mode);
  const depthPreset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === marker.depth);

  return (
    <div className="mb-4">
      {/* メインのセパレーター */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-green-500/50 to-green-500/50" />
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border border-green-600/50 rounded-full">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-green-300">
            議論開始 {marker.totalRounds}ラウンド
          </span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-green-500/50 to-green-500/50" />
      </div>

      {/* 設定詳細 */}
      <div className="flex justify-center mt-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded border border-purple-700/50">
            {modePreset?.name || marker.mode}
          </span>
          <span className="px-2 py-0.5 bg-green-900/30 text-green-300 rounded border border-green-700/50">
            Lv.{depthPreset?.level} {depthPreset?.name || '標準'}
          </span>
          {marker.keywords && marker.keywords.length > 0 && (
            <span className="px-2 py-0.5 bg-yellow-900/30 text-yellow-300 rounded border border-yellow-700/50">
              キーワード: {marker.keywords.join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExtensionSeparator({ marker }: ExtensionSeparatorProps) {
  const getModeLabel = (mode: string) => {
    return DISCUSSION_MODE_PRESETS.find((m) => m.id === mode)?.name || mode;
  };

  const getDepthLabel = (depth: number) => {
    const preset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === depth);
    return preset ? `Lv.${preset.level} ${preset.name}` : `Lv.${depth}`;
  };

  const hasChanges = marker.modeChanged || marker.depthChanged || (marker.keywordsAdded && marker.keywordsAdded.length > 0);

  return (
    <div className="my-4 flex items-center gap-3">
      {/* 左の線 */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-blue-500/50" />

      {/* 中央のバッジ */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 border border-blue-600/50 rounded-full">
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="text-xs font-medium text-blue-300">
          議論延長 +{marker.additionalRounds}ラウンド
        </span>
        <span className="text-xs text-gray-500">
          (計{marker.newTotalRounds}ラウンド)
        </span>
      </div>

      {/* 右の線 */}
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-blue-500/50 to-blue-500/50" />

      {/* 変更情報のポップオーバー（変更がある場合のみ） */}
      {hasChanges && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-8 hidden group-hover:block z-10">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs shadow-lg">
            {marker.modeChanged && (
              <div className="text-gray-300">
                モード: {getModeLabel(marker.modeChanged.from)} → {getModeLabel(marker.modeChanged.to)}
              </div>
            )}
            {marker.depthChanged && (
              <div className="text-gray-300">
                深さ: {getDepthLabel(marker.depthChanged.from)} → {getDepthLabel(marker.depthChanged.to)}
              </div>
            )}
            {marker.keywordsAdded && marker.keywordsAdded.length > 0 && (
              <div className="text-gray-300">
                キーワード追加: {marker.keywordsAdded.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 変更情報を含むインライン表示版
export function ExtensionSeparatorInline({ marker }: ExtensionSeparatorProps) {
  const getModeLabel = (mode: string) => {
    return DISCUSSION_MODE_PRESETS.find((m) => m.id === mode)?.name || mode;
  };

  const getDepthLabel = (depth: number) => {
    const preset = DISCUSSION_DEPTH_PRESETS.find((d) => d.level === depth);
    return preset ? `Lv.${preset.level} ${preset.name}` : `Lv.${depth}`;
  };

  const hasChanges = marker.modeChanged || marker.depthChanged || (marker.keywordsAdded && marker.keywordsAdded.length > 0);

  return (
    <div className="my-4">
      {/* メインのセパレーター */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-blue-500/50" />
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 border border-blue-600/50 rounded-full">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-xs font-medium text-blue-300">
            議論延長 +{marker.additionalRounds}ラウンド
          </span>
          <span className="text-xs text-gray-500">
            (計{marker.newTotalRounds}ラウンド)
          </span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-blue-500/50 to-blue-500/50" />
      </div>

      {/* 変更詳細（変更がある場合） */}
      {hasChanges && (
        <div className="flex justify-center mt-2">
          <div className="flex flex-wrap gap-2 text-xs">
            {marker.modeChanged && (
              <span className="px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded border border-purple-700/50">
                {getModeLabel(marker.modeChanged.from)} → {getModeLabel(marker.modeChanged.to)}
              </span>
            )}
            {marker.depthChanged && (
              <span className="px-2 py-0.5 bg-green-900/30 text-green-300 rounded border border-green-700/50">
                {getDepthLabel(marker.depthChanged.from)} → {getDepthLabel(marker.depthChanged.to)}
              </span>
            )}
            {marker.keywordsAdded && marker.keywordsAdded.length > 0 && (
              <span className="px-2 py-0.5 bg-yellow-900/30 text-yellow-300 rounded border border-yellow-700/50">
                +キーワード: {marker.keywordsAdded.join(', ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
