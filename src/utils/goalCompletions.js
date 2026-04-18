import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getFamilyId } from './familyGoals';

const CACHE_KEY = 'tarbiyah_goal_completions_v1';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function weekStartStr() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, …
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function getCached() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function setCached(completions) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(completions));
  } catch {}
}

// ─── Queries (operate on a completions array, no async) ───────────────────────

export function countThisWeek(completions, goalId) {
  const weekStart = weekStartStr();
  const today = todayStr();
  return completions.filter(c =>
    c.goalId === goalId &&
    c.completedAt >= weekStart &&
    c.completedAt <= today
  ).length;
}

export function isCompletedToday(completions, goalId) {
  return completions.some(c => c.goalId === goalId && c.completedAt === todayStr());
}

// ─── Load (cache-first, background Supabase refresh) ─────────────────────────

export async function loadCompletions() {
  const cached = await getCached();

  // Background sync — updates cache silently, caller won't see new data until next load
  (async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      const familyId = await getFamilyId();
      const { data, error } = await supabase
        .from('goal_completions')
        .select('*')
        .eq('family_id', familyId)
        .gte('completed_at', weekStartStr());

      if (!error && data) {
        const fresh = data.map(r => ({
          id:          r.id,
          goalId:      r.goal_id,
          familyId:    r.family_id,
          completedAt: r.completed_at,
        }));
        await setCached(fresh);
      }
    } catch {}
  })();

  return cached;
}

// ─── Log a completion for today ───────────────────────────────────────────────

export async function logCompletion(goalId) {
  const cached = await getCached();
  const today = todayStr();

  // One completion per goal per day
  if (isCompletedToday(cached, goalId)) return cached;

  const familyId = await getFamilyId();
  const entry = {
    id:          `gc_${Date.now()}`,
    goalId,
    familyId,
    completedAt: today,
  };

  const updated = [...cached, entry];
  await setCached(updated);

  // Fire-and-forget sync to Supabase
  const { data: session } = await supabase.auth.getSession();
  if (session?.session?.access_token) {
    supabase
      .from('goal_completions')
      .insert({
        id:           entry.id,
        goal_id:      goalId,
        family_id:    familyId,
        completed_at: today,
      })
      .then(({ error }) => { if (error) console.warn('Completion sync error:', error.message); });
  }

  return updated;
}
