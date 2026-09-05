import {
  calculateAge,
  isIntentCompatible,
  isLocationReachable,
  isMutualAgeRangeMatch,
  isMutualGenderMatch,
  passesHardFilters,
  REACHABLE_TRAVEL_DISTANCE_KM,
} from './hardFilters';
import { makeCandidate } from './testFixtures';

const NOW = new Date('2026-09-05T00:00:00Z');

describe('calculateAge', () => {
  it('誕生日を迎えている場合は正しい年齢を返す', () => {
    expect(calculateAge('1995-06-15', NOW)).toBe(31);
  });

  it('誕生日前の場合は1歳少なく計算する', () => {
    expect(calculateAge('1995-12-31', NOW)).toBe(30);
  });

  it('誕生日当日は新しい年齢になる', () => {
    expect(calculateAge('1995-09-05', NOW)).toBe(31);
  });

  it('不正な日付は0を返す', () => {
    expect(calculateAge('not-a-date', NOW)).toBe(0);
  });
});

describe('isMutualAgeRangeMatch', () => {
  it('双方の希望年齢範囲に収まる場合はtrue', () => {
    const viewer = makeCandidate({ birthdate: '1995-09-05', ageMin: 25, ageMax: 35 }); // 31歳
    const candidate = makeCandidate({ birthdate: '1998-09-05', ageMin: 25, ageMax: 35 }); // 28歳
    expect(isMutualAgeRangeMatch(viewer, candidate, NOW)).toBe(true);
  });

  it('候補者が自分の希望年齢範囲の境界値ちょうどの場合はtrue（境界値）', () => {
    const viewer = makeCandidate({ birthdate: '1995-09-05', ageMin: 25, ageMax: 35 });
    const candidate = makeCandidate({ birthdate: '1996-09-05', ageMin: 20, ageMax: 40 }); // 30歳
    // viewerの範囲[25,35]に候補35歳ちょうどを設定して境界確認
    const candidateAtMax = makeCandidate({ birthdate: '1991-09-05', ageMin: 20, ageMax: 40 }); // 35歳
    expect(isMutualAgeRangeMatch(viewer, candidateAtMax, NOW)).toBe(true);
    expect(isMutualAgeRangeMatch(viewer, candidate, NOW)).toBe(true);
  });

  it('候補者が自分の希望年齢範囲を1歳超える場合はfalse（境界値）', () => {
    const viewer = makeCandidate({ birthdate: '1995-09-05', ageMin: 25, ageMax: 35 });
    const tooOld = makeCandidate({ birthdate: '1990-09-05', ageMin: 20, ageMax: 45 }); // 36歳
    expect(isMutualAgeRangeMatch(viewer, tooOld, NOW)).toBe(false);
  });

  it('自分が相手の希望年齢範囲外の場合はfalse（片方だけ条件を満たしても不成立）', () => {
    const viewer = makeCandidate({ birthdate: '1980-09-05', ageMin: 25, ageMax: 35 }); // 46歳
    const candidate = makeCandidate({ birthdate: '1998-09-05', ageMin: 25, ageMax: 35 }); // 28歳: viewerの範囲に収まる
    // しかしcandidateの希望範囲[25,35]にviewerの46歳が収まらない
    expect(isMutualAgeRangeMatch(viewer, candidate, NOW)).toBe(false);
  });
});

describe('isMutualGenderMatch', () => {
  it('双方が相手の性別を希望している場合はtrue', () => {
    const viewer = makeCandidate({ gender: 'female', seekingGender: ['male'] });
    const candidate = makeCandidate({ gender: 'male', seekingGender: ['female'] });
    expect(isMutualGenderMatch(viewer, candidate)).toBe(true);
  });

  it('片方しか希望していない場合はfalse', () => {
    const viewer = makeCandidate({ gender: 'female', seekingGender: ['male'] });
    const candidate = makeCandidate({ gender: 'male', seekingGender: ['nonbinary'] });
    expect(isMutualGenderMatch(viewer, candidate)).toBe(false);
  });
});

describe('isIntentCompatible', () => {
  it('casualとmarriage_orientedの組み合わせはfalse（明確に相容れない）', () => {
    const viewer = makeCandidate({ relationshipIntent: 'casual' });
    const candidate = makeCandidate({ relationshipIntent: 'marriage_oriented' });
    expect(isIntentCompatible(viewer, candidate)).toBe(false);
  });

  it('逆順（marriage_oriented, casual）でもfalse', () => {
    const viewer = makeCandidate({ relationshipIntent: 'marriage_oriented' });
    const candidate = makeCandidate({ relationshipIntent: 'casual' });
    expect(isIntentCompatible(viewer, candidate)).toBe(false);
  });

  it('serious同士はtrue', () => {
    const viewer = makeCandidate({ relationshipIntent: 'serious' });
    const candidate = makeCandidate({ relationshipIntent: 'serious' });
    expect(isIntentCompatible(viewer, candidate)).toBe(true);
  });

  it('undecidedはどの組み合わせでもtrue', () => {
    const viewer = makeCandidate({ relationshipIntent: 'undecided' });
    const candidate = makeCandidate({ relationshipIntent: 'marriage_oriented' });
    expect(isIntentCompatible(viewer, candidate)).toBe(true);
  });
});

describe('isLocationReachable', () => {
  it('同じエリア文字列ならtrue', () => {
    const viewer = makeCandidate({ area: '東京都渋谷区', travelDistanceKm: 1 });
    const candidate = makeCandidate({ area: '東京都渋谷区', travelDistanceKm: 1 });
    expect(isLocationReachable(viewer, candidate)).toBe(true);
  });

  it('エリア表記の前後の空白・大文字小文字差は同一視する', () => {
    const viewer = makeCandidate({ area: ' Shibuya ' });
    const candidate = makeCandidate({ area: 'shibuya' });
    expect(isLocationReachable(viewer, candidate)).toBe(true);
  });

  it('エリアが違っても、いずれかの移動可能距離がしきい値ちょうどならtrue（境界値）', () => {
    const viewer = makeCandidate({ area: '東京都渋谷区', travelDistanceKm: REACHABLE_TRAVEL_DISTANCE_KM });
    const candidate = makeCandidate({ area: '大阪府大阪市', travelDistanceKm: 0 });
    expect(isLocationReachable(viewer, candidate)).toBe(true);
  });

  it('エリアが違い、しきい値未満（1km不足）ならfalse（境界値）', () => {
    const viewer = makeCandidate({ area: '東京都渋谷区', travelDistanceKm: REACHABLE_TRAVEL_DISTANCE_KM - 1 });
    const candidate = makeCandidate({ area: '大阪府大阪市', travelDistanceKm: REACHABLE_TRAVEL_DISTANCE_KM - 1 });
    expect(isLocationReachable(viewer, candidate)).toBe(false);
  });

  it('エリア未設定・距離未設定でもクラッシュしない（false扱い）', () => {
    const viewer = makeCandidate({ area: undefined, travelDistanceKm: undefined });
    const candidate = makeCandidate({ area: undefined, travelDistanceKm: undefined });
    expect(isLocationReachable(viewer, candidate)).toBe(false);
  });
});

describe('passesHardFilters', () => {
  const baseViewer = makeCandidate({
    profileId: 'viewer',
    gender: 'female',
    seekingGender: ['male'],
    relationshipIntent: 'serious',
    birthdate: '1995-09-05',
    ageMin: 25,
    ageMax: 35,
    area: '東京都渋谷区',
  });
  const baseCandidate = makeCandidate({
    profileId: 'candidate',
    gender: 'male',
    seekingGender: ['female'],
    relationshipIntent: 'serious',
    birthdate: '1993-09-05',
    ageMin: 25,
    ageMax: 40,
    area: '東京都渋谷区',
  });

  it('すべての条件を満たす場合はtrue', () => {
    expect(
      passesHardFilters({
        viewer: baseViewer,
        candidate: baseCandidate,
        context: { isBlockedEitherDirection: false, alreadyActioned: false },
        now: NOW,
      }),
    ).toBe(true);
  });

  it('自分自身はfalse', () => {
    expect(
      passesHardFilters({
        viewer: baseViewer,
        candidate: { ...baseCandidate, profileId: baseViewer.profileId },
        context: { isBlockedEitherDirection: false, alreadyActioned: false },
        now: NOW,
      }),
    ).toBe(false);
  });

  it('ブロック関係がある場合はfalse', () => {
    expect(
      passesHardFilters({
        viewer: baseViewer,
        candidate: baseCandidate,
        context: { isBlockedEitherDirection: true, alreadyActioned: false },
        now: NOW,
      }),
    ).toBe(false);
  });

  it('既にいいね/見送り済みの場合はfalse（再提示しない）', () => {
    expect(
      passesHardFilters({
        viewer: baseViewer,
        candidate: baseCandidate,
        context: { isBlockedEitherDirection: false, alreadyActioned: true },
        now: NOW,
      }),
    ).toBe(false);
  });

  it('候補者のステータスがactiveでない場合はfalse', () => {
    expect(
      passesHardFilters({
        viewer: baseViewer,
        candidate: { ...baseCandidate, status: 'deactivated' },
        context: { isBlockedEitherDirection: false, alreadyActioned: false },
        now: NOW,
      }),
    ).toBe(false);
  });
});
