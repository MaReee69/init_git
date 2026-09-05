import { mockMatchingBackend } from './mockMatchingBackend';
import { mockProfileBackend } from './mockProfileBackend';
import { readDb, resetMockDb, writeDb } from './store';

interface SeedOptions {
  id: string;
  displayName: string;
  gender: 'male' | 'female';
  seekingGender: ('male' | 'female')[];
  birthYear: number;
  area?: string;
  travelDistanceKm?: number;
}

async function seedProfile(opts: SeedOptions) {
  await mockProfileBackend.upsertMyProfile(opts.id, {
    displayName: opts.displayName,
    birthdate: `${opts.birthYear}-01-01`,
    gender: opts.gender,
    area: opts.area ?? '東京都渋谷区',
    travelDistanceKm: opts.travelDistanceKm ?? 20,
    onboardingCompletedAt: new Date().toISOString(),
    termsAgreedAt: new Date().toISOString(),
    privacyAgreedAt: new Date().toISOString(),
  });
  await mockProfileBackend.upsertMyDatingPreferences(opts.id, {
    seekingGender: opts.seekingGender,
    relationshipIntent: 'serious',
    ageMin: 20,
    ageMax: 45,
  });
  await mockProfileBackend.replaceMyAvailability(opts.id, [{ weekday: 6, timeBand: 'afternoon' }]);
}

describe('mockMatchingBackend', () => {
  beforeEach(async () => {
    await resetMockDb();
  });

  it('相互条件を満たすユーザーだけが候補として返る', async () => {
    await seedProfile({ id: 'alice', displayName: 'あおい', gender: 'female', seekingGender: ['male'], birthYear: 1995 });
    await seedProfile({ id: 'bob', displayName: 'れん', gender: 'male', seekingGender: ['female'], birthYear: 1993 });
    await seedProfile({ id: 'carol', displayName: 'ひな', gender: 'female', seekingGender: ['male'], birthYear: 1997 });

    const candidates = await mockMatchingBackend.listCandidates('alice');
    const ids = candidates.map((c) => c.candidate.profileId);

    expect(ids).toContain('bob');
    expect(ids).not.toContain('carol'); // female同士は相互性別条件を満たさない
    expect(ids).not.toContain('alice'); // 自分自身は含まれない
  });

  it('いいねが片方だけの間はマッチせず、相思相愛になった時だけマッチが成立する', async () => {
    await seedProfile({ id: 'alice', displayName: 'あおい', gender: 'female', seekingGender: ['male'], birthYear: 1995 });
    await seedProfile({ id: 'bob', displayName: 'れん', gender: 'male', seekingGender: ['female'], birthYear: 1993 });

    const firstLike = await mockMatchingBackend.likeProfile('alice', 'bob');
    expect(firstLike.matched).toBe(false);

    const secondLike = await mockMatchingBackend.likeProfile('bob', 'alice');
    expect(secondLike.matched).toBe(true);
    expect(secondLike.match).toBeDefined();

    const aliceMatches = await mockMatchingBackend.listMyMatches('alice');
    expect(aliceMatches).toHaveLength(1);
    expect(aliceMatches[0].counterpart.displayName).toBe('れん');

    const bobMatches = await mockMatchingBackend.listMyMatches('bob');
    expect(bobMatches).toHaveLength(1);
    expect(bobMatches[0].counterpart.displayName).toBe('あおい');
  });

  it('見送った相手は以後candidatesに再表示されない', async () => {
    await seedProfile({ id: 'alice', displayName: 'あおい', gender: 'female', seekingGender: ['male'], birthYear: 1995 });
    await seedProfile({ id: 'bob', displayName: 'れん', gender: 'male', seekingGender: ['female'], birthYear: 1993 });

    await mockMatchingBackend.passProfile('alice', 'bob');
    const candidates = await mockMatchingBackend.listCandidates('alice');
    expect(candidates.map((c) => c.candidate.profileId)).not.toContain('bob');
  });

  it('ブロックした相手は候補からもマッチからも除外される', async () => {
    await seedProfile({ id: 'alice', displayName: 'あおい', gender: 'female', seekingGender: ['male'], birthYear: 1995 });
    await seedProfile({ id: 'bob', displayName: 'れん', gender: 'male', seekingGender: ['female'], birthYear: 1993 });

    await writeDb((db) => ({ ...db, blocks: [...db.blocks, { blockerId: 'alice', blockedId: 'bob' }] }));

    const candidates = await mockMatchingBackend.listCandidates('alice');
    expect(candidates.map((c) => c.candidate.profileId)).not.toContain('bob');

    const reciprocalCandidates = await mockMatchingBackend.listCandidates('bob');
    expect(reciprocalCandidates.map((c) => c.candidate.profileId)).not.toContain('alice');
  });

  it('recordEventで記録したイベントが保存される', async () => {
    await seedProfile({ id: 'alice', displayName: 'あおい', gender: 'female', seekingGender: ['male'], birthYear: 1995 });
    await mockMatchingBackend.recordEvent('alice', 'profile_opened', 'bob');
    const db = await readDb();
    expect(
      db.recommendationEvents.some((e) => e.profileId === 'alice' && e.candidateProfileId === 'bob' && e.eventType === 'profile_opened'),
    ).toBe(true);
  });
});
