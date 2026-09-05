import type { CandidateListItem } from '@/lib/backend/types';
import type { SearchCriteria } from '@/schemas/searchCriteria';

/**
 * 「都内」のような口語的なエリア表現と、プロフィールの市区町村レベルの表記を
 * ゆるく一致させるための最小限の同義語辞書。完全な地理正規化は行わない（MVPの近似）。
 */
const AREA_SYNONYMS: Record<string, string[]> = {
  都内: ['東京'],
  関西: ['大阪', '京都', '兵庫'],
};

export function areaLooselyMatches(candidateArea: string | undefined, wantedArea: string): boolean {
  if (!candidateArea) return false;
  const a = candidateArea.trim();
  const w = wantedArea.trim();
  if (a.includes(w) || w.includes(a)) return true;
  const synonyms = AREA_SYNONYMS[w] ?? [];
  return synonyms.some((s) => a.includes(s));
}

export interface ApplySearchCriteriaResult {
  candidates: CandidateListItem[];
  /** ハード条件により1件も残らなかった場合、何を緩めるべきかの選択肢を返す（AIが勝手に緩めない） */
  eliminatedBy?: 'area' | 'availability';
}

/**
 * 音声コンシェルジュで抽出した検索条件を、既にハード条件+スコアで絞り込み済みの候補一覧に適用する。
 * エリア・空き時間はハード条件として絞り込み、興味・恋愛目的・予算はスコア順を保った上でのソフトな並び替えに使う
 * （dating_preferencesの恋愛目的等は既にバックエンド側でハード条件済みのため、ここでの再解釈は強制しない）。
 */
export function applySearchCriteria(
  candidates: CandidateListItem[],
  criteria: SearchCriteria,
): ApplySearchCriteriaResult {
  let filtered = candidates;

  const wantedArea = criteria.hardFilters?.area;
  if (wantedArea) {
    const next = filtered.filter((c) => areaLooselyMatches(c.candidate.area, wantedArea));
    if (next.length === 0 && filtered.length > 0) {
      return { candidates: [], eliminatedBy: 'area' };
    }
    filtered = next;
  }

  const wantedAvailability = criteria.hardFilters?.availability;
  if (wantedAvailability && wantedAvailability.length > 0) {
    const wantedKeys = new Set(wantedAvailability.map((s) => `${s.weekday}-${s.timeBand}`));
    const next = filtered.filter((c) => c.candidate.availability.some((s) => wantedKeys.has(`${s.weekday}-${s.timeBand}`)));
    if (next.length === 0 && filtered.length > 0) {
      return { candidates: [], eliminatedBy: 'availability' };
    }
    filtered = next;
  }

  const boostKeywords = criteria.softPreferences?.interestKeywords ?? [];
  const wantedIntent = criteria.intent;
  const wantedBudget = criteria.budget;

  if (boostKeywords.length > 0 || wantedIntent || wantedBudget) {
    const softScore = (item: CandidateListItem): number => {
      let s = 0;
      if (boostKeywords.some((k) => item.candidate.interestKeys.includes(k))) s += 2;
      if (wantedIntent && item.candidate.relationshipIntent === wantedIntent) s += 1;
      if (wantedBudget && item.candidate.budgetRange === wantedBudget) s += 1;
      return s;
    };
    filtered = [...filtered].sort((a, b) => softScore(b) - softScore(a));
  }

  return { candidates: filtered };
}
