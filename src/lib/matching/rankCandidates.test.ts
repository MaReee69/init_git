import { rankCandidates } from './rankCandidates';
import { makeCandidate } from './testFixtures';
import type { MatchScoreResult } from './types';

function scoreOf(totalScore: number): MatchScoreResult {
  return { totalScore, featureScores: {} as MatchScoreResult['featureScores'], reasons: [] };
}

describe('rankCandidates', () => {
  it('候補が少ない場合は探索枠を設けずスコア降順にする', () => {
    const candidates = [
      { candidate: makeCandidate(), score: scoreOf(50) },
      { candidate: makeCandidate(), score: scoreOf(90) },
      { candidate: makeCandidate(), score: scoreOf(70) },
    ];
    const ranked = rankCandidates(candidates, { minPoolSizeForExploration: 5 });
    expect(ranked.map((r) => r.score.totalScore)).toEqual([90, 70, 50]);
    expect(ranked.every((r) => !r.isExplorationPick)).toBe(true);
  });

  it('候補が十分にある場合、上位はスコア降順を維持しつつ1件だけ探索枠が挿入される', () => {
    const candidates = Array.from({ length: 8 }, (_, i) => ({
      candidate: makeCandidate(),
      score: scoreOf(100 - i * 10), // 100,90,...,30
    }));
    const ranked = rankCandidates(candidates, { random: () => 0, explorationSlotIndex: 3 });

    // 上位3件はスコア降順のまま
    expect(ranked[0].score.totalScore).toBe(100);
    expect(ranked[1].score.totalScore).toBe(90);
    expect(ranked[2].score.totalScore).toBe(80);

    const explorationPicks = ranked.filter((r) => r.isExplorationPick);
    expect(explorationPicks).toHaveLength(1);
    // random()=0 なので、tail(残り5件)の先頭、すなわち4番目に高いスコア(70)が探索枠として繰り上がる
    expect(ranked[3].isExplorationPick).toBe(true);
    expect(ranked[3].score.totalScore).toBe(70);
  });

  it('探索枠として選ばれた候補は結果セットから重複しない', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => ({
      candidate: makeCandidate({ profileId: `p${i}` }),
      score: scoreOf(100 - i * 10),
    }));
    const ranked = rankCandidates(candidates, { random: () => 0.99, explorationSlotIndex: 3 });
    const ids = ranked.map((r) => r.candidate.profileId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ranked).toHaveLength(6);
  });
});
