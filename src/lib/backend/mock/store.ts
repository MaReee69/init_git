import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthSession, AvailabilitySlot, DatingPreferences, Interest, Profile } from '@/types/domain';

const STORAGE_KEY = 'skimatch_mock_db_v1';

export interface MockDb {
  session: AuthSession | null;
  pendingOtp: Record<string, string>;
  profiles: Record<string, Profile>;
  preferences: Record<string, DatingPreferences>;
  availability: Record<string, AvailabilitySlot[]>;
  profileInterests: Record<string, string[]>;
  interests: Interest[];
}

export const DEFAULT_INTERESTS: Interest[] = [
  { id: 'i1', key: 'movie', labelJa: '映画', category: 'culture' },
  { id: 'i2', key: 'travel', labelJa: '旅行', category: 'lifestyle' },
  { id: 'i3', key: 'cafe', labelJa: 'カフェ巡り', category: 'lifestyle' },
  { id: 'i4', key: 'cooking', labelJa: '料理', category: 'lifestyle' },
  { id: 'i5', key: 'music_live', labelJa: '音楽・ライブ', category: 'culture' },
  { id: 'i6', key: 'outdoor', labelJa: 'アウトドア', category: 'activity' },
  { id: 'i7', key: 'fitness', labelJa: '筋トレ・運動', category: 'activity' },
  { id: 'i8', key: 'reading', labelJa: '読書', category: 'culture' },
  { id: 'i9', key: 'art_museum', labelJa: '美術館・展示', category: 'culture' },
  { id: 'i10', key: 'gaming', labelJa: 'ゲーム', category: 'entertainment' },
  { id: 'i11', key: 'pets', labelJa: 'ペット', category: 'lifestyle' },
  { id: 'i12', key: 'sake_wine', labelJa: 'お酒・ワイン', category: 'lifestyle' },
];

function emptyDb(): MockDb {
  return {
    session: null,
    pendingOtp: {},
    profiles: {},
    preferences: {},
    availability: {},
    profileInterests: {},
    interests: DEFAULT_INTERESTS,
  };
}

let cache: MockDb | null = null;
let loadPromise: Promise<MockDb> | null = null;

async function load(): Promise<MockDb> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return emptyDb();
        try {
          const parsed = JSON.parse(raw) as MockDb;
          return { ...emptyDb(), ...parsed, interests: DEFAULT_INTERESTS };
        } catch {
          return emptyDb();
        }
      })
      .catch(() => emptyDb());
  }
  cache = await loadPromise;
  return cache;
}

async function persist(db: MockDb): Promise<void> {
  cache = db;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // AsyncStorageが使えない環境（一部テスト等）では永続化をスキップし、メモリキャッシュのみで継続する
  }
}

export async function readDb(): Promise<MockDb> {
  return load();
}

export async function writeDb(mutator: (db: MockDb) => MockDb): Promise<MockDb> {
  const current = await load();
  const next = mutator(current);
  await persist(next);
  return next;
}

export async function resetMockDb(): Promise<void> {
  await persist(emptyDb());
}
