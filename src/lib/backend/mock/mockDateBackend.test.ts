import { mockDateBackend } from './mockDateBackend';
import { mockProfileBackend } from './mockProfileBackend';
import { readDb, resetMockDb, writeDb } from './store';

async function seedMatch(): Promise<string> {
  await mockProfileBackend.upsertMyProfile('alice', { displayName: 'あおい' });
  await mockProfileBackend.upsertMyProfile('bob', { displayName: 'れん' });
  const db = await writeDb((current) => ({
    ...current,
    matches: [
      ...current.matches,
      { id: 'match1', profileIdA: 'alice', profileIdB: 'bob', matchedAt: new Date().toISOString(), status: 'active' as const },
    ],
  }));
  return db.matches[0].id;
}

const SAMPLE_OPTIONS = [
  { placeOrFormat: 'カフェ', dateTimeCandidate: '土曜午後', durationMinutes: 90, budgetRange: 'mid' as const, reason: '静か', rainAlternative: '屋内' },
  { placeOrFormat: '美術館', dateTimeCandidate: '土曜午後', durationMinutes: 120, budgetRange: 'mid' as const, reason: '体験型', rainAlternative: '屋内展示のみ' },
  { placeOrFormat: '散歩', dateTimeCandidate: '土曜午後', durationMinutes: 100, budgetRange: 'mid' as const, reason: '気軽', rainAlternative: 'ランチのみ' },
];

describe('mockDateBackend', () => {
  beforeEach(async () => {
    await resetMockDb();
  });

  describe('checkMutualReunionInterest', () => {
    it('片方だけが希望している間はfalse（相手に開示しない）', async () => {
      const matchId = await seedMatch();
      await mockDateBackend.submitDateFeedback('alice', matchId, { wantToMeetAgain: true, answers: [] });
      expect(await mockDateBackend.checkMutualReunionInterest('alice', matchId)).toBe(false);
      expect(await mockDateBackend.checkMutualReunionInterest('bob', matchId)).toBe(false);
    });

    it('双方が希望した場合のみtrue', async () => {
      const matchId = await seedMatch();
      await mockDateBackend.submitDateFeedback('alice', matchId, { wantToMeetAgain: true, answers: [] });
      await mockDateBackend.submitDateFeedback('bob', matchId, { wantToMeetAgain: true, answers: [] });
      expect(await mockDateBackend.checkMutualReunionInterest('alice', matchId)).toBe(true);
    });

    it('片方がfalseの場合はtrueにならない', async () => {
      const matchId = await seedMatch();
      await mockDateBackend.submitDateFeedback('alice', matchId, { wantToMeetAgain: true, answers: [] });
      await mockDateBackend.submitDateFeedback('bob', matchId, { wantToMeetAgain: false, answers: [] });
      expect(await mockDateBackend.checkMutualReunionInterest('alice', matchId)).toBe(false);
    });
  });

  describe('getSharedDateNotes', () => {
    it('visibility=shareableの回答のみを、発言者を区別せず返す', async () => {
      const matchId = await seedMatch();
      await mockDateBackend.submitDateFeedback('alice', matchId, {
        wantToMeetAgain: true,
        answers: [
          { questionKey: 'fun', answerText: '映画の話で盛り上がった', visibility: 'shareable' },
          { questionKey: 'private_note', answerText: 'アリスの内緒の感想', visibility: 'private' },
        ],
      });
      await mockDateBackend.submitDateFeedback('bob', matchId, {
        wantToMeetAgain: true,
        answers: [{ questionKey: 'safety', answerText: '安全に関する懸念', visibility: 'safety' }],
      });

      const notes = await mockDateBackend.getSharedDateNotes('alice', matchId);
      expect(notes).toEqual(['映画の話で盛り上がった']);
      expect(notes).not.toContain('アリスの内緒の感想');
      expect(notes).not.toContain('安全に関する懸念');
    });
  });

  describe('getSharedAvailability', () => {
    it('双方の空き時間の重なりだけを返す', async () => {
      const matchId = await seedMatch();
      await mockProfileBackend.replaceMyAvailability('alice', [
        { weekday: 6, timeBand: 'afternoon' },
        { weekday: 0, timeBand: 'morning' },
      ]);
      await mockProfileBackend.replaceMyAvailability('bob', [
        { weekday: 6, timeBand: 'afternoon' },
        { weekday: 2, timeBand: 'evening' },
      ]);
      const shared = await mockDateBackend.getSharedAvailability('alice', matchId);
      expect(shared).toEqual([{ weekday: 6, timeBand: 'afternoon' }]);
    });
  });

  describe('createSecondDateProposal', () => {
    it('双方の再会意思が確認できていない場合はエラーになる', async () => {
      const matchId = await seedMatch();
      await expect(mockDateBackend.createSecondDateProposal('alice', matchId, SAMPLE_OPTIONS)).rejects.toThrow();
    });

    it('双方確認済みなら提案を作成できる', async () => {
      const matchId = await seedMatch();
      await mockDateBackend.submitDateFeedback('alice', matchId, { wantToMeetAgain: true, answers: [] });
      await mockDateBackend.submitDateFeedback('bob', matchId, { wantToMeetAgain: true, answers: [] });
      const proposal = await mockDateBackend.createSecondDateProposal('alice', matchId, SAMPLE_OPTIONS);
      expect(proposal.status).toBe('pending');
      expect(proposal.options).toHaveLength(3);
    });
  });

  describe('castDateProposalVote', () => {
    async function createConfirmedPrereqProposal() {
      const matchId = await seedMatch();
      await mockDateBackend.submitDateFeedback('alice', matchId, { wantToMeetAgain: true, answers: [] });
      await mockDateBackend.submitDateFeedback('bob', matchId, { wantToMeetAgain: true, answers: [] });
      const proposal = await mockDateBackend.createSecondDateProposal('alice', matchId, SAMPLE_OPTIONS);
      return { matchId, proposal };
    }

    it('片方だけの投票では確定しない', async () => {
      const { proposal } = await createConfirmedPrereqProposal();
      const result = await mockDateBackend.castDateProposalVote('alice', proposal.id, 0, 'want');
      expect(result.confirmed).toBe(false);
    });

    it('双方が同じ案にwantした時点で自動的に確定する', async () => {
      const { proposal } = await createConfirmedPrereqProposal();
      await mockDateBackend.castDateProposalVote('alice', proposal.id, 0, 'want');
      const result = await mockDateBackend.castDateProposalVote('bob', proposal.id, 0, 'want');
      expect(result.confirmed).toBe(true);
      expect(result.confirmedOptionIndex).toBe(0);

      const db = await readDb();
      const updated = db.dateProposals.find((p) => p.id === proposal.id);
      expect(updated?.status).toBe('confirmed');
      expect(updated?.confirmedOptionIndex).toBe(0);
    });

    it('双方が異なる案にwantしても確定しない', async () => {
      const { proposal } = await createConfirmedPrereqProposal();
      await mockDateBackend.castDateProposalVote('alice', proposal.id, 0, 'want');
      const result = await mockDateBackend.castDateProposalVote('bob', proposal.id, 1, 'want');
      expect(result.confirmed).toBe(false);
    });
  });
});
