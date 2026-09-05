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

describe('mockLlm.extractSearchCriteria', () => {
  it('PRD記載の例文から複数カテゴリを構造化抽出する', async () => {
    const result = await mockLlm.extractSearchCriteria({
      transcript: '都内で、休日の午後にゆっくり出かけられて、映画が好きな人。まずは気軽に会いたい',
      history: [],
    });
    expect(result.criteria.hardFilters?.area).toBe('都内');
    expect(result.criteria.hardFilters?.availability).toEqual([{ weekday: 6, timeBand: 'afternoon' }]);
    expect(result.criteria.softPreferences?.interestKeywords).toEqual(['movie']);
    expect(result.criteria.intent).toBe('casual');
    expect(result.followUpQuestion).toBeUndefined();
  });

  it('時間帯が明示されない場合、曜日だけでは断定せず何も抽出しない（推測で確定しない）', async () => {
    const result = await mockLlm.extractSearchCriteria({
      transcript: '休日にゆっくり出かけられる人がいいです',
      history: [],
    });
    expect(result.criteria.hardFilters?.availability).toBeUndefined();
  });

  it('条件が何も抽出できない場合は聞き返し質問を1問だけ返す', async () => {
    const result = await mockLlm.extractSearchCriteria({ transcript: 'こんにちは', history: [] });
    expect(result.criteria).toEqual({});
    expect(result.followUpQuestion).toBe('もう少し詳しく教えてください。希望のエリアや会える曜日はありますか？');
  });

  it('空文字列でもクラッシュしない', async () => {
    const result = await mockLlm.extractSearchCriteria({ transcript: '', history: [] });
    expect(result.criteria).toEqual({});
  });
});

describe('mockLlm.classifyVoiceCommand', () => {
  it.each([
    ['もう少し詳しく教えて', 'more_detail'],
    ['次の人お願い', 'next'],
    ['この人いいかも', 'like'],
    ['条件を変えたい', 'change_criteria'],
    ['今日は終わる', 'end_session'],
  ] as const)('「%s」は%sと分類する', async (transcript, expected) => {
    expect(await mockLlm.classifyVoiceCommand(transcript)).toBe(expected);
  });

  it('空文字列（無音・認識失敗）はunknownを返す', async () => {
    expect(await mockLlm.classifyVoiceCommand('')).toBe('unknown');
  });

  it('関係のない発話（誤認識の典型例）はunknownを返し、勝手に確定しない', async () => {
    expect(await mockLlm.classifyVoiceCommand('えっと、今日はいい天気ですね')).toBe('unknown');
  });

  it('複数の意図に取れる発話は、より具体的なコマンドを優先する（詳細確認 > いいね）', async () => {
    // 「気になる」は"いいね"のキーワードだが、"もっと詳しく"というより明確な要求を優先すべき
    expect(await mockLlm.classifyVoiceCommand('気になるのでもっと詳しく教えて')).toBe('more_detail');
  });

  it('言い淀み・フィラーが混じっても正しいコマンドを抽出する（誤認識耐性）', async () => {
    expect(await mockLlm.classifyVoiceCommand('えーっと、あの、次の人にしてください')).toBe('next');
  });
});
