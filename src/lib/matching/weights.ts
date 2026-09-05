import type { MatchWeights } from './types';

/**
 * 初期スコアの重み設定（docs/PRD.md参照）。
 * 設定ファイルとして管理し、computeMatchScore() へ外部から差し替え可能にしている。
 * 将来DBで変更可能にする場合も、この形状(MatchWeights)のレコードを読み込んで渡すだけでよい。
 */
export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  reciprocalFit: 0.2,
  values: 0.2,
  intent: 0.15,
  availability: 0.2,
  location: 0.1,
  interests: 0.1,
  communicationStyle: 0.05,
};
