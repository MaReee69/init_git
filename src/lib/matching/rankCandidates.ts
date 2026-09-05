import type { MatchCandidateInput, MatchScoreResult, ScoredCandidate } from './types';

export interface RankableCandidate {
  candidate: MatchCandidateInput;
  score: MatchScoreResult;
}

export interface RankCandidatesOptions {
  /** テスト時に決定的な結果を得るための乱数関数（0以上1未満）。省略時はMath.random */
  random?: () => number;
  /** 探索枠を挿入する位置（0始まり）。省略時は3 */
  explorationSlotIndex?: number;
  /** 候補数がこの件数未満の場合は探索枠を設けない */
  minPoolSizeForExploration?: number;
}

/**
 * スコア降順に並べた上で、上位に固定化しないよう小さな探索枠を1件だけ設ける。
 * 人気度（=スコアが高いだけ）で有利になり続けないようにするための仕組みで、
 * 除外条件（ハードフィルタ）を通過した候補の中から無作為に選ぶ。
 */
export function rankCandidates(
  candidates: RankableCandidate[],
  options: RankCandidatesOptions = {},
): ScoredCandidate[] {
  const { random = Math.random, explorationSlotIndex = 3, minPoolSizeForExploration = 5 } = options;

  const sorted = [...candidates].sort((a, b) => b.score.totalScore - a.score.totalScore);

  if (sorted.length < minPoolSizeForExploration) {
    return sorted.map((c) => ({ ...c, isExplorationPick: false }));
  }

  const topCount = Math.min(explorationSlotIndex, sorted.length);
  const tailStartIndex = topCount;
  const tail = sorted.slice(tailStartIndex);
  if (tail.length === 0) {
    return sorted.map((c) => ({ ...c, isExplorationPick: false }));
  }

  const explorationIndexInTail = Math.floor(random() * tail.length);
  const [explorationPick] = tail.splice(explorationIndexInTail, 1);

  const head = sorted.slice(0, topCount);
  const result: ScoredCandidate[] = [
    ...head.map((c) => ({ ...c, isExplorationPick: false })),
    { ...explorationPick, isExplorationPick: true },
    ...tail.map((c) => ({ ...c, isExplorationPick: false })),
  ];
  return result;
}
