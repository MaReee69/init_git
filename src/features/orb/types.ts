export type OrbState = 'idle' | 'listening' | 'thinking' | 'found' | 'confirm' | 'error';

export const ORB_STATE_LABEL: Record<OrbState, string> = {
  idle: '待機中',
  listening: '聞き取り中',
  thinking: '考え中',
  found: '見つかりました',
  confirm: '確認してください',
  error: 'うまく聞き取れませんでした',
};
