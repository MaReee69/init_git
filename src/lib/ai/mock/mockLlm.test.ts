import { mockLlm } from './mockLlm';

describe('mockLlm.extractProfileFromTranscript', () => {
  it('興味キーワードを抽出する', async () => {
    const result = await mockLlm.extractProfileFromTranscript({
      transcript: '映画とカフェ巡りが好きです。',
      history: [],
    });
    expect(result.extracted.interestKeys).toEqual(expect.arrayContaining(['movie', 'cafe']));
  });

  it('恋愛目的のキーワードを抽出する（真剣な交際）', async () => {
    const result = await mockLlm.extractProfileFromTranscript({
      transcript: '真剣にお付き合いできる人を探しています。',
      history: [],
    });
    expect(result.extracted.relationshipIntent).toBe('serious');
  });

  it('曜日・時間帯を抽出できた場合はfollowUpQuestionを返さない', async () => {
    const result = await mockLlm.extractProfileFromTranscript({
      transcript: '土曜の午後に会えたら嬉しいです。',
      history: [],
    });
    expect(result.extracted.availability).toEqual([{ weekday: 6, timeBand: 'afternoon' }]);
    expect(result.followUpQuestion).toBeUndefined();
  });

  it('曜日・時間帯が抽出できない場合はfollowUpQuestionを返す', async () => {
    const result = await mockLlm.extractProfileFromTranscript({
      transcript: '映画が好きです。',
      history: [],
    });
    expect(result.extracted.availability).toBeUndefined();
    expect(result.followUpQuestion).toBe('会いやすい曜日や時間帯はありますか？');
  });

  it('空文字列や無関係な発話でもクラッシュせず安全な結果を返す', async () => {
    const result = await mockLlm.extractProfileFromTranscript({ transcript: '', history: [] });
    expect(result.extracted).toEqual({});
  });
});
