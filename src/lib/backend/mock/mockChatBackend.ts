import type { Match, Message, VoiceAsset } from '@/types/domain';

import type { ChatBackend } from '../types';
import { randomId, readDb, writeDb, type MockDb } from './store';

function nowIso(): string {
  return new Date().toISOString();
}

function findActiveMatch(db: MockDb, viewerId: string, matchId: string): Match | undefined {
  return db.matches.find(
    (m) => m.id === matchId && m.status === 'active' && (m.profileIdA === viewerId || m.profileIdB === viewerId),
  );
}

const messageListeners = new Map<string, Set<() => void>>();

function notifyMessageListeners(matchId: string): void {
  messageListeners.get(matchId)?.forEach((listener) => listener());
}

export const mockChatBackend: ChatBackend = {
  async listMessages(viewerId, matchId) {
    const db = await readDb();
    if (!findActiveMatch(db, viewerId, matchId)) return [];
    return db.messages
      .filter((m) => m.matchId === matchId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async sendMessage(viewerId, input) {
    const db0 = await readDb();
    if (!findActiveMatch(db0, viewerId, input.matchId)) {
      throw new Error('マッチが見つからないか、既にマッチが解除されています');
    }

    let voiceAssetId: string | undefined;
    if (input.contentType === 'voice' && input.voiceClip) {
      const asset: VoiceAsset = {
        id: randomId('voice'),
        ownerProfileId: viewerId,
        purpose: 'message',
        retainUntil: input.voiceClip.retainUntil ?? undefined,
        createdAt: nowIso(),
      };
      voiceAssetId = asset.id;
      await writeDb((current) => ({ ...current, voiceAssets: [...current.voiceAssets, asset] }));
    }

    const isFirstMessage = db0.messages.every((m) => m.matchId !== input.matchId);

    const message: Message = {
      id: randomId('msg'),
      matchId: input.matchId,
      senderId: viewerId,
      contentType: input.contentType,
      body: input.body,
      voiceAssetId,
      aiMode: input.aiMode,
      createdAt: nowIso(),
    };

    await writeDb((current) => {
      const events = isFirstMessage
        ? [
            ...current.recommendationEvents,
            {
              id: randomId('evt'),
              profileId: viewerId,
              eventType: 'first_message_sent' as const,
              metadata: { matchId: input.matchId },
              createdAt: nowIso(),
            },
          ]
        : current.recommendationEvents;
      return { ...current, messages: [...current.messages, message], recommendationEvents: events };
    });

    notifyMessageListeners(input.matchId);
    return message;
  },

  async markRead(viewerId, matchId) {
    const db = await readDb();
    if (!findActiveMatch(db, viewerId, matchId)) return;
    const readTime = nowIso();
    await writeDb((current) => ({
      ...current,
      messages: current.messages.map((m) =>
        m.matchId === matchId && m.senderId !== viewerId && !m.readAt ? { ...m, readAt: readTime } : m,
      ),
    }));
    notifyMessageListeners(matchId);
  },

  subscribeToMessages(matchId, onChange) {
    if (!messageListeners.has(matchId)) messageListeners.set(matchId, new Set());
    messageListeners.get(matchId)!.add(onChange);

    let lastSignature = '';
    const interval = setInterval(async () => {
      const db = await readDb();
      const relevant = db.messages.filter((m) => m.matchId === matchId);
      const signature = relevant.map((m) => `${m.id}:${m.readAt ?? ''}`).join(',');
      if (signature !== lastSignature) {
        lastSignature = signature;
        onChange();
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      messageListeners.get(matchId)?.delete(onChange);
    };
  },

  async reportProfile(viewerId, targetProfileId, matchId, reasonCode, detail) {
    await writeDb((current) => ({
      ...current,
      reports: [
        ...current.reports,
        { id: randomId('report'), reporterId: viewerId, reportedId: targetProfileId, matchId, reasonCode, detail },
      ],
      recommendationEvents: [
        ...current.recommendationEvents,
        {
          id: randomId('evt'),
          profileId: viewerId,
          candidateProfileId: targetProfileId,
          eventType: 'report',
          createdAt: nowIso(),
        },
      ],
    }));
  },

  async blockProfile(viewerId, targetProfileId) {
    const now = nowIso();
    await writeDb((current) => ({
      ...current,
      blocks: current.blocks.some((b) => b.blockerId === viewerId && b.blockedId === targetProfileId)
        ? current.blocks
        : [...current.blocks, { blockerId: viewerId, blockedId: targetProfileId }],
      matches: current.matches.map((m) =>
        m.status === 'active' &&
        ((m.profileIdA === viewerId && m.profileIdB === targetProfileId) ||
          (m.profileIdA === targetProfileId && m.profileIdB === viewerId))
          ? { ...m, status: 'unmatched', unmatchedBy: viewerId, unmatchedAt: now }
          : m,
      ),
      recommendationEvents: [
        ...current.recommendationEvents,
        { id: randomId('evt'), profileId: viewerId, candidateProfileId: targetProfileId, eventType: 'block', createdAt: now },
      ],
    }));
  },

  async unmatch(viewerId, matchId) {
    const db = await readDb();
    if (!findActiveMatch(db, viewerId, matchId)) return;
    const now = nowIso();
    await writeDb((current) => ({
      ...current,
      matches: current.matches.map((m) =>
        m.id === matchId ? { ...m, status: 'unmatched', unmatchedBy: viewerId, unmatchedAt: now } : m,
      ),
      recommendationEvents: [
        ...current.recommendationEvents,
        { id: randomId('evt'), profileId: viewerId, eventType: 'unmatch', metadata: { matchId }, createdAt: now },
      ],
    }));
  },
};
