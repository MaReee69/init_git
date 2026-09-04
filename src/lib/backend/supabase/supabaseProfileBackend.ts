import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProfileBackend } from '../types';
import { profileToRow, rowToAvailability, rowToInterest, rowToPreferences, rowToProfile } from './mappers';

export function createSupabaseProfileBackend(client: SupabaseClient): ProfileBackend {
  return {
    async getMyProfile(userId) {
      const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data ? rowToProfile(data) : null;
    },

    async upsertMyProfile(userId, patch) {
      const row = profileToRow(userId, patch);
      const { data, error } = await client.from('profiles').upsert(row).select('*').single();
      if (error) throw error;
      return rowToProfile(data);
    },

    async getMyDatingPreferences(userId) {
      const { data, error } = await client
        .from('dating_preferences')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToPreferences(data) : null;
    },

    async upsertMyDatingPreferences(userId, patch) {
      const row = {
        profile_id: userId,
        seeking_gender: patch.seekingGender,
        relationship_intent: patch.relationshipIntent,
        age_min: patch.ageMin,
        age_max: patch.ageMax,
        date_style: patch.dateStyle ?? null,
      };
      const { data, error } = await client.from('dating_preferences').upsert(row).select('*').single();
      if (error) throw error;
      return rowToPreferences(data);
    },

    async replaceMyAvailability(userId, slots) {
      const { error: deleteError } = await client.from('availability_slots').delete().eq('profile_id', userId);
      if (deleteError) throw deleteError;
      if (slots.length === 0) return [];
      const rows = slots.map((s) => ({ profile_id: userId, weekday: s.weekday, time_band: s.timeBand }));
      const { data, error } = await client.from('availability_slots').insert(rows).select('*');
      if (error) throw error;
      return (data ?? []).map(rowToAvailability);
    },

    async replaceMyInterests(userId, interestKeys) {
      const { error: deleteError } = await client.from('profile_interests').delete().eq('profile_id', userId);
      if (deleteError) throw deleteError;
      if (interestKeys.length === 0) return;
      const { data: interestRows, error: interestError } = await client
        .from('interests')
        .select('id, key')
        .in('key', interestKeys);
      if (interestError) throw interestError;
      const rows = (interestRows ?? []).map((i: { id: string }) => ({ profile_id: userId, interest_id: i.id }));
      if (rows.length === 0) return;
      const { error } = await client.from('profile_interests').insert(rows);
      if (error) throw error;
    },

    async listInterests() {
      const { data, error } = await client.from('interests').select('*').order('category');
      if (error) throw error;
      return (data ?? []).map(rowToInterest);
    },
  };
}
