import type { AvailabilitySlot, DateFeedback, DateFeedbackAnswer, DateProposal, Match } from '@/types/domain';

import type { DateBackend } from '../types';
import { randomId, readDb, writeDb, type MockDb } from './store';

function nowIso(): string {
  return new Date().toISOString();
}

function findMatchForParticipant(db: MockDb, profileId: string, matchId: string): Match | undefined {
  return db.matches.find((m) => m.id === matchId && (m.profileIdA === profileId || m.profileIdB === profileId));
}

function computeMutualInterest(db: MockDb, match: Match): boolean {
  const feedbackA = db.dateFeedback.find((f) => f.matchId === match.id && f.profileId === match.profileIdA && f.submittedAt);
  const feedbackB = db.dateFeedback.find((f) => f.matchId === match.id && f.profileId === match.profileIdB && f.submittedAt);
  return Boolean(feedbackA?.wantToMeetAgain) && Boolean(feedbackB?.wantToMeetAgain);
}

export const mockDateBackend: DateBackend = {
  async submitDateFeedback(profileId, matchId, submission) {
    const db = await readDb();
    if (!findMatchForParticipant(db, profileId, matchId)) {
      throw new Error('マッチが見つかりません');
    }

    await writeDb((current) => {
      const existing = current.dateFeedback.find((f) => f.matchId === matchId && f.profileId === profileId);
      const feedback: DateFeedback = {
        id: existing?.id ?? randomId('feedback'),
        matchId,
        profileId,
        wantToMeetAgain: submission.wantToMeetAgain,
        submittedAt: nowIso(),
        createdAt: existing?.createdAt ?? nowIso(),
      };
      const otherFeedback = current.dateFeedback.filter((f) => f.id !== feedback.id);
      const otherAnswers = current.dateFeedbackAnswers.filter((a) => a.feedbackId !== feedback.id);
      const newAnswers: DateFeedbackAnswer[] = submission.answers.map((a) => ({
        id: randomId('feedback-answer'),
        feedbackId: feedback.id,
        questionKey: a.questionKey,
        answerText: a.answerText,
        visibility: a.visibility,
      }));
      return {
        ...current,
        dateFeedback: [...otherFeedback, feedback],
        dateFeedbackAnswers: [...otherAnswers, ...newAnswers],
      };
    });
  },

  async checkMutualReunionInterest(profileId, matchId) {
    const db = await readDb();
    const match = findMatchForParticipant(db, profileId, matchId);
    if (!match) return false;
    return computeMutualInterest(db, match);
  },

  async getSharedAvailability(profileId, matchId) {
    const db = await readDb();
    const match = findMatchForParticipant(db, profileId, matchId);
    if (!match) return [];
    const slotsA = db.availability[match.profileIdA] ?? [];
    const slotsB = db.availability[match.profileIdB] ?? [];
    const keyOf = (s: Pick<AvailabilitySlot, 'weekday' | 'timeBand'>) => `${s.weekday}-${s.timeBand}`;
    const bKeys = new Set(slotsB.map(keyOf));
    return slotsA.filter((s) => bKeys.has(keyOf(s))).map((s) => ({ weekday: s.weekday, timeBand: s.timeBand }));
  },

  async getSharedDateNotes(profileId, matchId) {
    const db = await readDb();
    const match = findMatchForParticipant(db, profileId, matchId);
    if (!match) return [];
    const feedbackIds = db.dateFeedback
      .filter((f) => f.matchId === matchId && (f.profileId === match.profileIdA || f.profileId === match.profileIdB))
      .map((f) => f.id);
    return db.dateFeedbackAnswers
      .filter((a) => feedbackIds.includes(a.feedbackId) && a.visibility === 'shareable' && a.answerText)
      .map((a) => a.answerText!)
      .sort();
  },

  async createSecondDateProposal(profileId, matchId, options) {
    const db = await readDb();
    const match = findMatchForParticipant(db, profileId, matchId);
    if (!match) throw new Error('マッチが見つかりません');
    if (!computeMutualInterest(db, match)) {
      throw new Error('双方の再会意思が確認できていません');
    }

    const proposal: DateProposal = {
      id: randomId('proposal'),
      matchId,
      createdBy: 'ai',
      options,
      status: 'pending',
      createdAt: nowIso(),
    };
    await writeDb((current) => ({ ...current, dateProposals: [...current.dateProposals, proposal] }));
    return proposal;
  },

  async listDateProposals(profileId, matchId) {
    const db = await readDb();
    if (!findMatchForParticipant(db, profileId, matchId)) return [];
    return db.dateProposals
      .filter((p) => p.matchId === matchId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async castDateProposalVote(profileId, proposalId, optionIndex, vote) {
    const db0 = await readDb();
    const proposal = db0.dateProposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error('提案が見つかりません');
    const match = findMatchForParticipant(db0, profileId, proposal.matchId);
    if (!match || match.status !== 'active') throw new Error('マッチが見つかりません');

    const db = await writeDb((current) => {
      const others = current.dateProposalVotes.filter(
        (v) => !(v.proposalId === proposalId && v.profileId === profileId && v.optionIndex === optionIndex),
      );
      return {
        ...current,
        dateProposalVotes: [
          ...others,
          { id: randomId('vote'), proposalId, profileId, optionIndex, vote, createdAt: nowIso() },
        ],
      };
    });

    const aWants = db.dateProposalVotes.some(
      (v) => v.proposalId === proposalId && v.profileId === match.profileIdA && v.optionIndex === optionIndex && v.vote === 'want',
    );
    const bWants = db.dateProposalVotes.some(
      (v) => v.proposalId === proposalId && v.profileId === match.profileIdB && v.optionIndex === optionIndex && v.vote === 'want',
    );

    if (aWants && bWants) {
      await writeDb((current) => ({
        ...current,
        dateProposals: current.dateProposals.map((p) =>
          p.id === proposalId && p.status === 'pending'
            ? { ...p, status: 'confirmed', confirmedOptionIndex: optionIndex }
            : p,
        ),
      }));
      return { confirmed: true, confirmedOptionIndex: optionIndex };
    }

    return { confirmed: false };
  },
};
