import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { DECKS as BUNDLED_DECKS, CARDS as BUNDLED_CARDS } from '../data/conversationCards';

const CACHE_KEY = 'conversation_cards_v1';

async function fetchFromSupabase() {
  const { data, error } = await supabase
    .from('conversation_cards')
    .select('id, deck, question')
    .eq('active', true)
    .order('deck', { ascending: true });

  if (error || !data?.length) throw error ?? new Error('empty');

  const result = { decks: BUNDLED_DECKS, cards: data.map(r => ({ deck: r.deck, q: r.question })) };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: result }));
  return result;
}

// Returns cached data immediately, always refreshes in background.
// Pass onUpdate(result) to receive the fresh data when it arrives.
export async function fetchConversationCards(onUpdate) {
  // 1. Return cache immediately if available
  let cached = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data } = JSON.parse(raw);
      if (data?.decks?.length) cached = data;
    }
  } catch {}

  // 2. Always kick off a background refresh
  fetchFromSupabase()
    .then(fresh => {
      if (onUpdate) onUpdate(fresh);
    })
    .catch(() => {});

  // 3. Return cache now (or bundled fallback if no cache yet)
  return cached ?? { decks: BUNDLED_DECKS, cards: BUNDLED_CARDS };
}

export async function invalidateConversationCardsCache() {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}
