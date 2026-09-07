import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChatBackend } from '../types';
import { rowToMessage } from './mappers';

export function createSupabaseChatBackend(client: SupabaseClient): ChatBackend {
  return {
    async listMessages(_viewerId, matchId) {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(rowToMessage);
    },

    async sendMessage(viewerId, input) {
      let voiceAssetId: string | undefined;
      if (input.contentType === 'voice' && input.voiceClip) {
        const { data: assetRow, error: assetError } = await client
          .from('voice_assets')
          .insert({
            owner_profile_id: viewerId,
            purpose: 'message',
            retain_until: input.voiceClip.retainUntil,
          })
          .select('*')
          .single();
        if (assetError) throw assetError;
        voiceAssetId = assetRow.id as string;
      }

      const { data, error } = await client
        .from('messages')
        .insert({
          match_id: input.matchId,
          sender_id: viewerId,
          content_type: input.contentType,
          body: input.body ?? null,
          voice_asset_id: voiceAssetId ?? null,
          ai_mode: input.aiMode ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return rowToMessage(data);
    },

    async markRead(viewerId, matchId) {
      const { error } = await client
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .neq('sender_id', viewerId)
        .is('read_at', null);
      if (error) throw error;
    },

    subscribeToMessages(matchId, onChange) {
      const channel = client
        .channel(`messages:${matchId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          () => onChange(),
        )
        .subscribe();
      return () => {
        client.removeChannel(channel);
      };
    },

    async reportProfile(viewerId, targetProfileId, matchId, reasonCode, detail) {
      const { error } = await client.from('reports').insert({
        reporter_id: viewerId,
        reported_id: targetProfileId,
        match_id: matchId ?? null,
        reason_code: reasonCode,
        detail: detail ?? null,
      });
      if (error) throw error;
    },

    async blockProfile(_viewerId, targetProfileId) {
      const { error } = await client.rpc('block_profile', { p_target: targetProfileId });
      if (error) throw error;
    },

    async unmatch(viewerId, matchId) {
      const { error } = await client
        .from('matches')
        .update({ status: 'unmatched', unmatched_by: viewerId, unmatched_at: new Date().toISOString() })
        .eq('id', matchId);
      if (error) throw error;
    },
  };
}
