import { ageConsentSchema, profileFormSchema } from './profile';

describe('ageConsentSchema', () => {
  function isoDateYearsAgo(years: number, offsetDays = 0): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  it('17歳未満（誕生日前）は拒否する', () => {
    const result = ageConsentSchema.safeParse({
      birthdate: isoDateYearsAgo(18, 1), // まだ18歳の誕生日を迎えていない
      termsAgreed: true,
      privacyAgreed: true,
    });
    expect(result.success).toBe(false);
  });

  it('ちょうど18歳の誕生日は許可する', () => {
    const result = ageConsentSchema.safeParse({
      birthdate: isoDateYearsAgo(18, 0),
      termsAgreed: true,
      privacyAgreed: true,
    });
    expect(result.success).toBe(true);
  });

  it('19歳は許可する', () => {
    const result = ageConsentSchema.safeParse({
      birthdate: isoDateYearsAgo(19),
      termsAgreed: true,
      privacyAgreed: true,
    });
    expect(result.success).toBe(true);
  });

  it('利用規約に同意していない場合は拒否する', () => {
    const result = ageConsentSchema.safeParse({
      birthdate: isoDateYearsAgo(25),
      termsAgreed: false,
      privacyAgreed: true,
    });
    expect(result.success).toBe(false);
  });

  it('不正な日付形式は拒否する', () => {
    const result = ageConsentSchema.safeParse({
      birthdate: '2000/01/01',
      termsAgreed: true,
      privacyAgreed: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('profileFormSchema', () => {
  const base = {
    displayName: 'テスト太郎',
    gender: 'male' as const,
    seekingGender: ['female' as const],
    relationshipIntent: 'casual' as const,
    ageMin: 20,
    ageMax: 30,
    area: '東京都渋谷区',
    availability: [{ weekday: 6 as const, timeBand: 'afternoon' as const }],
  };

  it('必須項目が揃っていれば成功する', () => {
    expect(profileFormSchema.safeParse(base).success).toBe(true);
  });

  it('ageMin > ageMax の場合は拒否する', () => {
    const result = profileFormSchema.safeParse({ ...base, ageMin: 40, ageMax: 30 });
    expect(result.success).toBe(false);
  });

  it('性別がself_describeなのに自由記述が無い場合は拒否する', () => {
    const result = profileFormSchema.safeParse({ ...base, gender: 'self_describe' });
    expect(result.success).toBe(false);
  });

  it('性別がself_describeで自由記述があれば成功する', () => {
    const result = profileFormSchema.safeParse({
      ...base,
      gender: 'self_describe',
      genderSelfDescribe: 'その他',
    });
    expect(result.success).toBe(true);
  });

  it('availabilityが空の場合は拒否する', () => {
    const result = profileFormSchema.safeParse({ ...base, availability: [] });
    expect(result.success).toBe(false);
  });

  it('seekingGenderが空の場合は拒否する', () => {
    const result = profileFormSchema.safeParse({ ...base, seekingGender: [] });
    expect(result.success).toBe(false);
  });
});
