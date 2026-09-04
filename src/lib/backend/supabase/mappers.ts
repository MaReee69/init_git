import type { AvailabilitySlot, DatingPreferences, Interest, Profile } from '@/types/domain';

// Supabaseの行(snake_case)とドメイン型(camelCase)を変換する。

export function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    displayName: (row.display_name as string) ?? '',
    birthdate: (row.birthdate as string) ?? '',
    gender: (row.gender as Profile['gender']) ?? 'self_describe',
    genderSelfDescribe: (row.gender_self_describe as string) ?? undefined,
    bio: (row.bio as string) ?? undefined,
    conversationStyle: (row.conversation_style as Profile['conversationStyle']) ?? undefined,
    area: (row.area as string) ?? undefined,
    travelDistanceKm: (row.travel_distance_km as number) ?? undefined,
    budgetRange: (row.budget_range as Profile['budgetRange']) ?? undefined,
    ageVerifiedMethod: (row.age_verified_method as Profile['ageVerifiedMethod']) ?? 'self_declared',
    onboardingCompletedAt: (row.onboarding_completed_at as string) ?? undefined,
    termsAgreedAt: (row.terms_agreed_at as string) ?? undefined,
    privacyAgreedAt: (row.privacy_agreed_at as string) ?? undefined,
    status: (row.status as Profile['status']) ?? 'active',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function profileToRow(userId: string, patch: Partial<Omit<Profile, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = { id: userId };
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.birthdate !== undefined) row.birthdate = patch.birthdate;
  if (patch.gender !== undefined) row.gender = patch.gender;
  if (patch.genderSelfDescribe !== undefined) row.gender_self_describe = patch.genderSelfDescribe;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.conversationStyle !== undefined) row.conversation_style = patch.conversationStyle;
  if (patch.area !== undefined) row.area = patch.area;
  if (patch.travelDistanceKm !== undefined) row.travel_distance_km = patch.travelDistanceKm;
  if (patch.budgetRange !== undefined) row.budget_range = patch.budgetRange;
  if (patch.onboardingCompletedAt !== undefined) row.onboarding_completed_at = patch.onboardingCompletedAt;
  if (patch.termsAgreedAt !== undefined) row.terms_agreed_at = patch.termsAgreedAt;
  if (patch.privacyAgreedAt !== undefined) row.privacy_agreed_at = patch.privacyAgreedAt;
  if (patch.status !== undefined) row.status = patch.status;
  return row;
}

export function rowToPreferences(row: Record<string, unknown>): DatingPreferences {
  return {
    profileId: row.profile_id as string,
    seekingGender: (row.seeking_gender as DatingPreferences['seekingGender']) ?? [],
    relationshipIntent: (row.relationship_intent as DatingPreferences['relationshipIntent']) ?? 'undecided',
    ageMin: (row.age_min as number) ?? 18,
    ageMax: (row.age_max as number) ?? 99,
    dateStyle: (row.date_style as string) ?? undefined,
  };
}

export function rowToAvailability(row: Record<string, unknown>): AvailabilitySlot {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    weekday: row.weekday as AvailabilitySlot['weekday'],
    timeBand: row.time_band as AvailabilitySlot['timeBand'],
  };
}

export function rowToInterest(row: Record<string, unknown>): Interest {
  return {
    id: row.id as string,
    key: row.key as string,
    labelJa: row.label_ja as string,
    category: (row.category as string) ?? undefined,
  };
}
