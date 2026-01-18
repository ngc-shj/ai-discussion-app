/**
 * セッション関連イベントのイベントバス
 *
 * フック間の結合を減らし、「セッションリセット」などのイベントを
 * 発行側が購読者を意識せずに通知できるようにする。
 *
 * 使用例:
 *   // 発行側（page.tsx）
 *   sessionEvent.emit('sessionReset');
 *
 *   // 購読側（各フック）
 *   useEffect(() => {
 *     const handler = () => clearMyState();
 *     sessionEvent.on('sessionReset', handler);
 *     return () => sessionEvent.off('sessionReset', handler);
 *   }, [clearMyState]);
 */
import mitt from 'mitt';

// イベント型定義
type SessionEvents = {
  /** セッションリセット（新規セッション開始時など） - セッションも議論状態も全てクリア */
  sessionReset: void;
  /** 議論状態のみクリア（セッション選択時など） - セッションはそのまま */
  discussionClear: void;
};

// シングルトンのイベントバス
const sessionEvent = mitt<SessionEvents>();

export default sessionEvent;
