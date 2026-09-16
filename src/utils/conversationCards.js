import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { DECKS as BUNDLED_DECKS, CARDS as BUNDLED_CARDS } from '../data/conversationCards';

const CACHE_KEY = 'conversation_cards_v1';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tarbiyah-production.up.railway.app';

async function fetchSharedFromSupabase() {
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

async function fetchUserGenerated() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data } = await supabase
      .from('user_conversation_cards')
      .select('deck, question')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    return (data ?? []).map(r => ({ deck: r.deck, q: r.question, generated: true }));
  } catch {
    return [];
  }
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

  const shared = cached ?? { decks: BUNDLED_DECKS, cards: BUNDLED_CARDS };

  // 2. Fetch user-generated cards (quick — just their own rows)
  const generated = await fetchUserGenerated();
  const initial = { decks: shared.decks, cards: [...shared.cards, ...generated] };

  // 3. Background refresh shared cards from Supabase
  fetchSharedFromSupabase()
    .then(async fresh => {
      const gen = await fetchUserGenerated();
      if (onUpdate) onUpdate({ decks: fresh.decks, cards: [...fresh.cards, ...gen] });
    })
    .catch(() => {});

  return initial;
}

// Calls the backend to generate new cards for a deck, saves them to the user's table.
export async function generateCardsForDeck({ deck, deckLabel, childAge }) {
  const resp = await fetch(`${API_URL}/conversation-cards/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deck, deckLabel, childAge }),
  });
  if (!resp.ok) throw new Error('Generation failed');
  const { questions } = await resp.json();
  if (!Array.isArray(questions) || !questions.length) throw new Error('No questions returned');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const rows = questions.map(q => ({ user_id: session.user.id, deck, question: q }));
  const { error } = await supabase.from('user_conversation_cards').insert(rows);
  if (error) throw new Error(error.message);

  return questions.map(q => ({ deck, q, generated: true }));
}

export async function invalidateConversationCardsCache() {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}
