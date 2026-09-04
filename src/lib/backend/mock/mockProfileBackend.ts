import type { AvailabilitySlot, DatingPreferences, Interest, Profile } from '@/types/domain';

import type { ProfileBackend } from '../types';
import { readDb, writeDb } from './store';

function nowIso(): string {
  return new Date().toISOString();
}

export const mockProfileBackend: ProfileBackend = {
  async getMyProfile(userId) {
    const db = await readDb();
    return db.profiles[userId] ?? null;
  },

  async upsertMyProfile(userId, patch) {
    const defaults: Profile = {
      id: userId,
      displayName: '',
      birthdate: '',
      gender: 'self_describe',
      ageVerifiedMethod: 'self_declared',
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const db = await writeDb((current) => {
      const existing = current.profiles[userId];
      const merged: Profile = { ...defaults, ...existing, ...patch, id: userId, updatedAt: nowIso() };
      return { ...current, profiles: { ...current.profiles, [userId]: merged } };
    });
    return db.profiles[userId];
  },

  async getMyDatingPreferences(userId) {
    const db = await readDb();
    return db.preferences[userId] ?? null;
  },

  async upsertMyDatingPreferences(userId, patch) {
    const db = await writeDb((current) => {
      const merged: DatingPreferences = { profileId: userId, ...patch };
      return { ...current, preferences: { ...current.preferences, [userId]: merged } };
    });
    return db.preferences[userId];
  },

  async replaceMyAvailability(userId, slots) {
    const withIds: AvailabilitySlot[] = slots.map((s, idx) => ({
      id: `${userId}-avail-${idx}`,
      profileId: userId,
      weekday: s.weekday,
      timeBand: s.timeBand,
    }));
    await writeDb((current) => ({
      ...current,
      availability: { ...current.availability, [userId]: withIds },
    }));
    return withIds;
  },

  async replaceMyInterests(userId, interestKeys) {
    await writeDb((current) => ({
      ...current,
      profileInterests: { ...current.profileInterests, [userId]: interestKeys },
    }));
  },

  async listInterests(): Promise<Interest[]> {
    const db = await readDb();
    return db.interests;
  },
};
