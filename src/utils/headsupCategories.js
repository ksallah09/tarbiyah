import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { CATEGORIES as BUNDLED } from '../data/headsup_categories';

const CACHE_KEY = 'headsup_categories_v1';

async function fetchFromSupabase() {
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

  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: categories }));
  return categories;
}

// Returns cached data immediately, always refreshes in background.
// Pass onUpdate(categories) to receive fresh data when it arrives.
export async function fetchCategories(onUpdate) {
  // 1. Return cache immediately if available
  let cached = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data } = JSON.parse(raw);
      if (data?.length) cached = data;
    }
  } catch {}

  // 2. Always kick off a background refresh
  fetchFromSupabase()
    .then(fresh => { if (onUpdate) onUpdate(fresh); })
    .catch(() => {});

  // 3. Return cache now (or bundled fallback if no cache yet)
  return cached ?? BUNDLED;
}

export async function invalidateCategoriesCache() {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}
