export type Gender = 'male' | 'female' | 'nonbinary' | 'self_describe';
export type RelationshipIntent = 'casual' | 'serious' | 'marriage_oriented' | 'undecided';
export type ConversationStyle = 'text_first' | 'voice_first' | 'balanced';
export type BudgetRange = 'low' | 'mid' | 'high';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type TimeBand = 'morning' | 'afternoon' | 'evening' | 'night';

export interface Profile {
  id: string;
  displayName: string;
  birthdate: string; // YYYY-MM-DD
  gender: Gender;
  genderSelfDescribe?: string;
  bio?: string;
  conversationStyle?: ConversationStyle;
  area?: string;
  travelDistanceKm?: number;
  budgetRange?: BudgetRange;
  ageVerifiedMethod: 'self_declared';
  onboardingCompletedAt?: string;
  termsAgreedAt?: string;
  privacyAgreedAt?: string;
  status: 'active' | 'deactivated' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface DatingPreferences {
  profileId: string;
  seekingGender: Gender[];
  relationshipIntent: RelationshipIntent;
  ageMin: number;
  ageMax: number;
  dateStyle?: string;
}

export interface ProfileAnswer {
  id: string;
  profileId: string;
  questionKey: string;
  answerText?: string;
  answerChoice?: string;
}

export interface Interest {
  id: string;
  key: string;
  labelJa: string;
  category?: string;
}

export interface AvailabilitySlot {
  id: string;
  profileId: string;
  weekday: Weekday;
  timeBand: TimeBand;
}

export interface Photo {
  id: string;
  profileId: string;
  storagePath: string;
  position: number;
  isPrimary: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

export interface AuthSession {
  userId: string;
  email: string;
}

export interface Like {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  createdAt: string;
}

export interface Match {
  id: string;
  profileIdA: string;
  profileIdB: string;
  matchedAt: string;
  status: 'active' | 'unmatched';
}

export type RecommendationEventType =
  | 'recommendation_impression'
  | 'profile_opened'
  | 'like_sent'
  | 'pass'
  | 'match_created'
  | 'first_message_sent'
  | 'reply_received'
  | 'date_proposal_created'
  | 'date_proposal_accepted'
  | 'date_proposal_declined'
  | 'date_completed'
  | 'unmatch'
  | 'block'
  | 'report';

export interface RecommendationEvent {
  id: string;
  profileId: string;
  candidateProfileId?: string;
  eventType: RecommendationEventType;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
