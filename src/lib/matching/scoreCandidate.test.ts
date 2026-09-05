import {
  computeMatchScore,
  scoreAvailability,
  scoreCommunicationStyle,
  scoreIntent,
  scoreInterests,
  scoreLocation,
  scoreReciprocalFit,
  scoreValues,
} from './scoreCandidate';
import { makeCandidate } from './testFixtures';
import { DEFAULT_MATCH_WEIGHTS } from './weights';

const NOW = new Date('2026-09-05T00:00:00Z');

describe('scoreReciprocalFit', () => {
  it('相手の年齢が希望範囲のちょうど中央なら1.0（境界値）', () => {
    const viewer = makeCandidate({ ageMin: 20, ageMax: 40, birthdate: '1996-09-05' }); // 30歳、相手の範囲の中央
    const candidate = makeCandidate({ birthdate: '1996-09-05', ageMin: 20, ageMax: 40 }); // 30歳
    const result = scoreReciprocalFit(viewer, candidate, NOW);
    expect(result.value).toBeCloseTo(1, 5);
    expect(result.informative).toBe(true);
  });

  it('双方が相手の希望年齢範囲の端ちょうどなら0（境界値）', () => {
    // viewer: 40歳、候補の希望範囲[20,40]の上端 / candidate: 20歳、viewerの希望範囲[20,40]の下端
    const viewer = makeCandidate({ birthdate: '1986-09-05', ageMin: 20, ageMax: 40 });
    const candidateAtEdge = makeCandidate({ birthdate: '2006-09-05', ageMin: 20, ageMax: 40 });
    const result = scoreReciprocalFit(viewer, candidateAtEdge, NOW);
    expect(result.value).toBeCloseTo(0, 5);
  });

  it('ageMin===ageMaxで完全一致なら1、不一致なら0（0除算を起こさない）', () => {
    const viewer = makeCandidate({ ageMin: 30, ageMax: 30, birthdate: '1996-09-05' });
    const exact = makeCandidate({ birthdate: '1996-09-05', ageMin: 20, ageMax: 40 });
    const off = makeCandidate({ birthdate: '1990-09-05', ageMin: 20, ageMax: 40 });
    expect(scoreReciprocalFit(viewer, exact, NOW).value).toBeGreaterThan(scoreReciprocalFit(viewer, off, NOW).value);
  });
});

describe('scoreValues', () => {
  it('共通の質問に対する回答が一致する割合が高いほど高スコア', () => {
    const viewer = makeCandidate({
      answers: [
        { questionKey: 'family', answerChoice: 'important' },
        { questionKey: 'money', answerChoice: 'save' },
      ],
    });
    const candidate = makeCandidate({
      answers: [
        { questionKey: 'family', answerChoice: 'important' },
        { questionKey: 'money', answerChoice: 'spend' },
      ],
    });
    const result = scoreValues(viewer, candidate);
    expect(result.value).toBeCloseTo(0.5, 5);
    expect(result.informative).toBe(true);
  });

  it('共通の回答質問が無い場合は中立0.5でinformative=false（無い情報を理由にしない）', () => {
    const viewer = makeCandidate({ answers: [{ questionKey: 'family', answerChoice: 'important' }] });
    const candidate = makeCandidate({ answers: [] });
    const result = scoreValues(viewer, candidate);
    expect(result.value).toBe(0.5);
    expect(result.informative).toBe(false);
  });
});

describe('scoreIntent', () => {
  it('完全一致は1.0', () => {
    const viewer = makeCandidate({ relationshipIntent: 'serious' });
    const candidate = makeCandidate({ relationshipIntent: 'serious' });
    expect(scoreIntent(viewer, candidate).value).toBe(1);
  });

  it('undecided同士はinformative=trueだが一致より低い', () => {
    const viewer = makeCandidate({ relationshipIntent: 'undecided' });
    const candidate = makeCandidate({ relationshipIntent: 'undecided' });
    const result = scoreIntent(viewer, candidate);
    expect(result.value).toBeLessThan(1);
  });
});

describe('scoreAvailability', () => {
  it('完全一致は1.0', () => {
    const slots = [{ weekday: 6 as const, timeBand: 'afternoon' as const }];
    const viewer = makeCandidate({ availability: slots });
    const candidate = makeCandidate({ availability: slots });
    expect(scoreAvailability(viewer, candidate).value).toBe(1);
  });

  it('重なりが無い場合は0', () => {
    const viewer = makeCandidate({ availability: [{ weekday: 6, timeBand: 'afternoon' }] });
    const candidate = makeCandidate({ availability: [{ weekday: 0, timeBand: 'morning' }] });
    expect(scoreAvailability(viewer, candidate).value).toBe(0);
  });

  it('片方の空き時間が未設定の場合は0かつinformative=false', () => {
    const viewer = makeCandidate({ availability: [] });
    const candidate = makeCandidate({ availability: [{ weekday: 6, timeBand: 'afternoon' }] });
    const result = scoreAvailability(viewer, candidate);
    expect(result.value).toBe(0);
    expect(result.informative).toBe(false);
  });

  it('部分的な重なりはJaccard係数で計算する', () => {
    const viewer = makeCandidate({
      availability: [
        { weekday: 6, timeBand: 'afternoon' },
        { weekday: 0, timeBand: 'morning' },
      ],
    });
    const candidate = makeCandidate({
      availability: [
        { weekday: 6, timeBand: 'afternoon' },
        { weekday: 3, timeBand: 'evening' },
      ],
    });
    // 和集合3件のうち一致1件 = 1/3
    expect(scoreAvailability(viewer, candidate).value).toBeCloseTo(1 / 3, 5);
  });
});

describe('scoreLocation', () => {
  it('同一エリアは1.0', () => {
    const viewer = makeCandidate({ area: '東京都渋谷区' });
    const candidate = makeCandidate({ area: '東京都渋谷区' });
    expect(scoreLocation(viewer, candidate).value).toBe(1);
  });

  it('エリア未設定はinformative=false', () => {
    const viewer = makeCandidate({ area: undefined });
    const candidate = makeCandidate({ area: '東京都渋谷区' });
    expect(scoreLocation(viewer, candidate).informative).toBe(false);
  });
});

describe('scoreInterests', () => {
  it('興味が完全一致すれば1.0', () => {
    const viewer = makeCandidate({ interestKeys: ['movie', 'cafe'] });
    const candidate = makeCandidate({ interestKeys: ['movie', 'cafe'] });
    expect(scoreInterests(viewer, candidate).value).toBe(1);
  });

  it('双方とも興味未選択なら中立0.5でinformative=false', () => {
    const viewer = makeCandidate({ interestKeys: [] });
    const candidate = makeCandidate({ interestKeys: [] });
    const result = scoreInterests(viewer, candidate);
    expect(result.value).toBe(0.5);
    expect(result.informative).toBe(false);
  });
});

describe('scoreCommunicationStyle', () => {
  it('balancedはどちらとも中間的な適合度を持つ', () => {
    const viewer = makeCandidate({ conversationStyle: 'balanced' });
    const candidate = makeCandidate({ conversationStyle: 'text_first' });
    expect(scoreCommunicationStyle(viewer, candidate).value).toBeCloseTo(0.7, 5);
  });

  it('未設定はinformative=false', () => {
    const viewer = makeCandidate({ conversationStyle: undefined });
    const candidate = makeCandidate({ conversationStyle: 'balanced' });
    expect(scoreCommunicationStyle(viewer, candidate).informative).toBe(false);
  });
});

describe('computeMatchScore', () => {
  it('0-100の範囲に収まる', () => {
    const viewer = makeCandidate();
    const candidate = makeCandidate();
    const result = computeMatchScore(viewer, candidate, DEFAULT_MATCH_WEIGHTS, NOW);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it('明示情報が無い特徴量は理由として提示しない', () => {
    const viewer = makeCandidate({ interestKeys: [], answers: [], conversationStyle: undefined, area: undefined });
    const candidate = makeCandidate({ interestKeys: [], answers: [], conversationStyle: undefined, area: undefined });
    const result = computeMatchScore(viewer, candidate, DEFAULT_MATCH_WEIGHTS, NOW);
    const reasonFeatures = result.reasons.map((r) => r.feature);
    expect(reasonFeatures).not.toContain('interests');
    expect(reasonFeatures).not.toContain('values');
    expect(reasonFeatures).not.toContain('communicationStyle');
    expect(reasonFeatures).not.toContain('location');
  });

  it('理由は最大3件まで', () => {
    const viewer = makeCandidate();
    const candidate = makeCandidate();
    const result = computeMatchScore(viewer, candidate, DEFAULT_MATCH_WEIGHTS, NOW);
    expect(result.reasons.length).toBeLessThanOrEqual(3);
  });

  it('似た者同士は非常に低い相性の候補よりスコアが高い', () => {
    const viewer = makeCandidate({
      relationshipIntent: 'serious',
      interestKeys: ['movie', 'cafe'],
      availability: [{ weekday: 6, timeBand: 'afternoon' }],
      area: '東京都渋谷区',
    });
    const goodMatch = makeCandidate({
      relationshipIntent: 'serious',
      interestKeys: ['movie', 'cafe'],
      availability: [{ weekday: 6, timeBand: 'afternoon' }],
      area: '東京都渋谷区',
    });
    const poorMatch = makeCandidate({
      relationshipIntent: 'undecided',
      interestKeys: ['gaming'],
      availability: [{ weekday: 2, timeBand: 'night' }],
      area: '北海道札幌市',
      travelDistanceKm: 1,
    });
    const goodScore = computeMatchScore(viewer, goodMatch, DEFAULT_MATCH_WEIGHTS, NOW).totalScore;
    const poorScore = computeMatchScore(viewer, poorMatch, DEFAULT_MATCH_WEIGHTS, NOW).totalScore;
    expect(goodScore).toBeGreaterThan(poorScore);
  });
});
