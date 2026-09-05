import { z } from 'zod';

import { availabilitySlotSchema, budgetRangeSchema, relationshipIntentSchema } from './profile';

/**
 * 音声マッチコンシェルジュが自然言語の発話から抽出する構造化検索条件。
 * hard_filters / soft_preferences / intent / availability / area / budget / date_style を
 * それぞれ独立したフィールドとして持ち、UIの条件チップ表示にそのまま対応させる。
 */
export const searchCriteriaSchema = z.object({
  hardFilters: z
    .object({
      area: z.string().trim().max(50).optional(),
      availability: z.array(availabilitySlotSchema).max(14).optional(),
    })
    .optional(),
  softPreferences: z
    .object({
      interestKeywords: z.array(z.string()).max(10).optional(),
    })
    .optional(),
  intent: relationshipIntentSchema.optional(),
  budget: budgetRangeSchema.optional(),
  dateStyle: z.string().trim().max(50).optional(),
});
export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;

export function isSearchCriteriaEmpty(criteria: SearchCriteria): boolean {
  return (
    !criteria.hardFilters?.area &&
    (!criteria.hardFilters?.availability || criteria.hardFilters.availability.length === 0) &&
    (!criteria.softPreferences?.interestKeywords || criteria.softPreferences.interestKeywords.length === 0) &&
    !criteria.intent &&
    !criteria.budget &&
    !criteria.dateStyle
  );
}
