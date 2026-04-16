import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const KEY = 'tarbiyah_goal_history';

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

async function getHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Sync full local history to Supabase (one row per user, history is a jsonb array)
async function syncHistoryToRemote(history) {
  try {
    const userId = await getUserId();
    if (!userId) return;
    supabase.from('user_goal_history').upsert({
      user_id:    userId,
      history,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.warn('Goal history sync error:', error.message);
    });
  } catch {}
}

// Call this once per day when today's goals are loaded.
// Each entry: { date, type, label, text, insightTitle }
export async function saveGoalsForDate(date, goals) {
  try {
    const history = await getHistory();
    const filtered = history.filter(g => g.date !== date);
    const entries = goals.map(g => ({ ...g, date }));
    const updated = [...filtered, ...entries];
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    syncHistoryToRemote(updated);
  } catch {}
}

// Returns the most recent `limit` goals of a given type, newest first.
export async function getRecentGoals(type, limit = 3) {
  const history = await getHistory();
  return history
    .filter(g => g.type === type || (type === 'scientific' && g.type === 'practical'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

// Pull goal history from Supabase into local cache (call on sign-in)
export async function syncGoalHistoryFromRemote() {
  try {
    const userId = await getUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_goal_history')
      .select('history')
      .eq('user_id', userId)
      .single();

    if (!error && Array.isArray(data?.history) && data.history.length > 0) {
      await AsyncStorage.setItem(KEY, JSON.stringify(data.history));
    }
  } catch {}
}
