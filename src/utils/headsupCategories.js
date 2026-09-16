import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { CATEGORIES as BUNDLED } from '../data/headsup_categories';

const CACHE_KEY      = 'headsup_categories_v1';
const PACKS_CACHE_KEY = 'headsup_user_packs_v1';

async function fetchBaseFromSupabase() {
  const { data, error } = await supabase
    .from('headsup_categories')
    .select('id, label, emoji, color, headsup_cards(word)')
    .order('sort_order', { ascending: true });

  if (error || !data?.length) throw error ?? new Error('empty');

  const categories = data.map(c => ({
    id:    c.id,
    label: c.label,
    emoji: c.emoji,
    color: c.color,
    cards: (c.headsup_cards ?? []).map(r => r.word),
  })).filter(c => c.cards.length > 0);

  if (!categories.length) throw new Error('no cards');
  return categories;
}

async function fetchUserPackCategories() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from('user_headsup_packs')
      .select('pack_id, headsup_packs(id, title, emoji, color, headsup_pack_cards(word))')
      .eq('user_id', session.user.id);

    if (error || !data?.length) return [];

    return data.map(row => {
      const pack = row.headsup_packs;
      if (!pack) return null;
      return {
        id:      pack.id,
        label:   pack.title,
        emoji:   pack.emoji,
        color:   pack.color,
        cards:   (pack.headsup_pack_cards ?? []).map(r => r.word),
        isPack:  true,
      };
    }).filter(Boolean).filter(c => c.cards.length > 0);
  } catch {
    return [];
  }
}

// Returns cached data immediately, always refreshes in background.
export async function fetchCategories(onUpdate) {
  // 1. Return cache immediately
  let cachedBase = null;
  let cachedPacks = [];
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data } = JSON.parse(raw);
      if (data?.length) cachedBase = data;
    }
    const packsRaw = await AsyncStorage.getItem(PACKS_CACHE_KEY);
    if (packsRaw) cachedPacks = JSON.parse(packsRaw) ?? [];
  } catch {}

  const base = cachedBase ?? BUNDLED;
  const initial = [...base, ...cachedPacks];

  // 2. Background refresh
  Promise.all([fetchBaseFromSupabase(), fetchUserPackCategories()])
    .then(async ([freshBase, freshPacks]) => {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: freshBase }));
      await AsyncStorage.setItem(PACKS_CACHE_KEY, JSON.stringify(freshPacks));
      if (onUpdate) onUpdate([...freshBase, ...freshPacks]);
    })
    .catch(() => {});

  return initial;
}

// Called after user adds/removes a pack to immediately refresh
export async function refreshUserPacks(onUpdate) {
  const [base, packs] = await Promise.all([
    AsyncStorage.getItem(CACHE_KEY).then(r => {
      if (!r) return BUNDLED;
      const { data } = JSON.parse(r);
      return data?.length ? data : BUNDLED;
    }),
    fetchUserPackCategories(),
  ]);
  await AsyncStorage.setItem(PACKS_CACHE_KEY, JSON.stringify(packs));
  const merged = [...base, ...packs];
  if (onUpdate) onUpdate(merged);
  return merged;
}

export async function fetchAllPacks() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? null;

  const [packsRes, addedRes] = await Promise.all([
    supabase
      .from('headsup_packs')
      .select('id, title, description, emoji, color, card_count, is_free')
      .eq('active', true)
      .order('sort_order'),
    userId
      ? supabase.from('user_headsup_packs').select('pack_id').eq('user_id', userId)
      : Promise.resolve({ data: [] }),
  ]);

  const addedIds = new Set((addedRes.data ?? []).map(r => r.pack_id));
  return (packsRes.data ?? []).map(p => ({ ...p, added: addedIds.has(p.id) }));
}

export async function addPack(packId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const { error } = await supabase
    .from('user_headsup_packs')
    .insert({ user_id: session.user.id, pack_id: packId });
  if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
    throw new Error(error.message);
  }
}

export async function removePack(packId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  await supabase
    .from('user_headsup_packs')
    .delete()
    .eq('user_id', session.user.id)
    .eq('pack_id', packId);
}

export async function invalidateCategoriesCache() {
  await Promise.all([
    AsyncStorage.removeItem(CACHE_KEY).catch(() => {}),
    AsyncStorage.removeItem(PACKS_CACHE_KEY).catch(() => {}),
  ]);
}
