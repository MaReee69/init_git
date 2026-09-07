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
  unmatchedBy?: string;
  unmatchedAt?: string;
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

export type MessageContentType = 'text' | 'voice';
export type MessageAiMode = 'own_voice_cleanup' | 'ai_draft' | 'raw_voice_clip';

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  contentType: MessageContentType;
  body?: string;
  voiceAssetId?: string;
  aiMode?: MessageAiMode;
  readAt?: string;
  createdAt: string;
}

export type VoiceAssetPurpose = 'profile_answer' | 'message' | 'onboarding';

export interface VoiceAsset {
  id: string;
  ownerProfileId: string;
  storagePath?: string;
  purpose: VoiceAssetPurpose;
  retainUntil?: string;
  deletedAt?: string;
  createdAt: string;
}

export interface DateFeedback {
  id: string;
  matchId: string;
  profileId: string;
  wantToMeetAgain?: boolean;
  submittedAt?: string;
  createdAt: string;
}

export type DateFeedbackVisibility = 'private' | 'shareable' | 'safety';

export interface DateFeedbackAnswer {
  id: string;
  feedbackId: string;
  questionKey: string;
  answerText?: string;
  visibility: DateFeedbackVisibility;
}

export interface DateProposalOption {
  placeOrFormat: string;
  dateTimeCandidate: string;
  durationMinutes: number;
  budgetRange: BudgetRange;
  reason: string;
  rainAlternative: string;
}

export type DateProposalStatus = 'pending' | 'confirmed' | 'cancelled';

export interface DateProposal {
  id: string;
  matchId: string;
  createdBy: 'ai' | 'user';
  options: DateProposalOption[];
  status: DateProposalStatus;
  confirmedOptionIndex?: number;
  createdAt: string;
}

export type DateProposalVoteChoice = 'want' | 'change' | 'other' | 'skip';

export interface DateProposalVote {
  id: string;
  proposalId: string;
  profileId: string;
  optionIndex: number;
  vote: DateProposalVoteChoice;
  createdAt: string;
}
