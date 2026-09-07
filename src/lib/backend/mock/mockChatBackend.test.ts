import { mockChatBackend } from './mockChatBackend';
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

describe('mockChatBackend', () => {
  beforeEach(async () => {
    await resetMockDb();
  });

  it('マッチ当事者はメッセージを送受信できる', async () => {
    const matchId = await seedMatch();
    await mockChatBackend.sendMessage('alice', { matchId, contentType: 'text', body: 'こんにちは' });
    const messages = await mockChatBackend.listMessages('bob', matchId);
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toBe('こんにちは');
    expect(messages[0].senderId).toBe('alice');
  });

  it('マッチ当事者以外はメッセージを取得できない', async () => {
    const matchId = await seedMatch();
    await mockChatBackend.sendMessage('alice', { matchId, contentType: 'text', body: 'こんにちは' });
    const messages = await mockChatBackend.listMessages('carol', matchId);
    expect(messages).toEqual([]);
  });

  it('markReadで相手からのメッセージのみ既読になる（自分の送信分は既読にならない）', async () => {
    const matchId = await seedMatch();
    await mockChatBackend.sendMessage('alice', { matchId, contentType: 'text', body: 'アリスから' });
    await mockChatBackend.sendMessage('bob', { matchId, contentType: 'text', body: 'ボブから' });

    await mockChatBackend.markRead('alice', matchId);
    const messages = await mockChatBackend.listMessages('alice', matchId);
    const fromAlice = messages.find((m) => m.senderId === 'alice')!;
    const fromBob = messages.find((m) => m.senderId === 'bob')!;
    expect(fromAlice.readAt).toBeUndefined();
    expect(fromBob.readAt).toBeDefined();
  });

  it('ブロックすると既存マッチが即時解除され、以後チャットにアクセスできなくなる', async () => {
    const matchId = await seedMatch();
    await mockChatBackend.sendMessage('alice', { matchId, contentType: 'text', body: 'こんにちは' });

    await mockChatBackend.blockProfile('alice', 'bob');

    const db = await readDb();
    expect(db.matches.find((m) => m.id === matchId)?.status).toBe('unmatched');
    expect(db.blocks.some((b) => b.blockerId === 'alice' && b.blockedId === 'bob')).toBe(true);

    const messagesAfterBlock = await mockChatBackend.listMessages('alice', matchId);
    expect(messagesAfterBlock).toEqual([]);
  });

  it('unmatchするとマッチがunmatched状態になりチャットが見えなくなる', async () => {
    const matchId = await seedMatch();
    await mockChatBackend.sendMessage('alice', { matchId, contentType: 'text', body: 'こんにちは' });
    await mockChatBackend.unmatch('bob', matchId);

    const messages = await mockChatBackend.listMessages('bob', matchId);
    expect(messages).toEqual([]);
  });

  it('通報を記録できる', async () => {
    const matchId = await seedMatch();
    await mockChatBackend.reportProfile('alice', 'bob', matchId, 'harassment', '不快なメッセージ');
    const db = await readDb();
    expect(db.reports).toHaveLength(1);
    expect(db.reports[0]).toMatchObject({ reporterId: 'alice', reportedId: 'bob', reasonCode: 'harassment' });
  });

  it('声のまま送るモードではvoice_assetが作成され、メッセージに紐づく', async () => {
    const matchId = await seedMatch();
    const message = await mockChatBackend.sendMessage('alice', {
      matchId,
      contentType: 'voice',
      body: '（文字起こし）今度会えますか',
      voiceClip: { retainUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString() },
    });
    expect(message.voiceAssetId).toBeDefined();
    const db = await readDb();
    const asset = db.voiceAssets.find((a) => a.id === message.voiceAssetId);
    expect(asset).toBeDefined();
    expect(asset?.ownerProfileId).toBe('alice');
    expect(asset?.purpose).toBe('message');
  });
});
