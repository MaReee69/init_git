import type { CandidateListItem } from '@/lib/backend/types';

import { areaLooselyMatches, applySearchCriteria } from './applySearchCriteria';
import { makeCandidate } from './testFixtures';
import type { MatchScoreResult } from './types';

function makeItem(overrides: Parameters<typeof makeCandidate>[0] = {}, totalScore = 50): CandidateListItem {
  const score: MatchScoreResult = { totalScore, featureScores: {} as MatchScoreResult['featureScores'], reasons: [] };
  return {
    candidate: makeCandidate(overrides),
    score,
    isExplorationPick: false,
    displayName: overrides.profileId ?? 'テスト',
    bio: undefined,
  };
}

describe('areaLooselyMatches', () => {
  it('候補のエリア文字列に希望語が含まれれば一致', () => {
    expect(areaLooselyMatches('東京都渋谷区', '渋谷')).toBe(true);
  });

  it('同義語辞書経由で一致する（都内→東京）', () => {
    expect(areaLooselyMatches('東京都新宿区', '都内')).toBe(true);
  });

  it('関係ないエリアは一致しない', () => {
    expect(areaLooselyMatches('北海道札幌市', '都内')).toBe(false);
  });

  it('候補のエリアが未設定ならfalse', () => {
    expect(areaLooselyMatches(undefined, '都内')).toBe(false);
  });
});

describe('applySearchCriteria', () => {
  it('エリア条件に一致する候補だけを残す', () => {
    const shibuya = makeItem({ profileId: 'shibuya', area: '東京都渋谷区' });
    const sapporo = makeItem({ profileId: 'sapporo', area: '北海道札幌市' });
    const result = applySearchCriteria([shibuya, sapporo], { hardFilters: { area: '都内' } });
    expect(result.candidates.map((c) => c.candidate.profileId)).toEqual(['shibuya']);
    expect(result.eliminatedBy).toBeUndefined();
  });

  it('エリア条件で1件も残らない場合、勝手に条件を外さずeliminatedByを返す', () => {
    const sapporo = makeItem({ profileId: 'sapporo', area: '北海道札幌市' });
    const result = applySearchCriteria([sapporo], { hardFilters: { area: '都内' } });
    expect(result.candidates).toEqual([]);
    expect(result.eliminatedBy).toBe('area');
  });

  it('空き時間条件に一致する候補だけを残す', () => {
    const matchSlot = makeItem({
      profileId: 'a',
      availability: [{ weekday: 6, timeBand: 'afternoon' }],
    });
    const noMatch = makeItem({
      profileId: 'b',
      availability: [{ weekday: 2, timeBand: 'evening' }],
    });
    const result = applySearchCriteria([matchSlot, noMatch], {
      hardFilters: { availability: [{ weekday: 6, timeBand: 'afternoon' }] },
    });
    expect(result.candidates.map((c) => c.candidate.profileId)).toEqual(['a']);
  });

  it('興味のソフト条件は除外せず並び替えのみ行う', () => {
    const noInterest = makeItem({ profileId: 'no-interest', interestKeys: ['gaming'] }, 80);
    const withInterest = makeItem({ profileId: 'with-interest', interestKeys: ['movie'] }, 60);
    const result = applySearchCriteria([noInterest, withInterest], {
      softPreferences: { interestKeywords: ['movie'] },
    });
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].candidate.profileId).toBe('with-interest');
  });

  it('条件が空の場合は元の順序・件数のまま返す', () => {
    const a = makeItem({ profileId: 'a' });
    const b = makeItem({ profileId: 'b' });
    const result = applySearchCriteria([a, b], {});
    expect(result.candidates.map((c) => c.candidate.profileId)).toEqual(['a', 'b']);
  });
});
