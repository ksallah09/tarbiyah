import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getFamilyId } from './familyGoals';

const CACHE_KEY = 'tarbiyah_goal_completions_v1';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function weekStartStr() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, …
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

export function isCompletedOnDate(completions, goalId, dateStr) {
  return completions.some(c => c.goalId === goalId && c.completedAt === dateStr);
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

// ─── Log a completion (today or retroactively) ────────────────────────────────

async function logCompletionEntry(goalId, dateStr) {
  const cached = await getCached();

  if (isCompletedOnDate(cached, goalId, dateStr)) return cached;

  const today = todayStr();
  if (dateStr > today) return cached; // never log future dates

  const familyId = await getFamilyId();
  const entry = { id: `gc_${Date.now()}`, goalId, familyId, completedAt: dateStr };
  const updated = [...cached, entry];
  await setCached(updated);

  const { data: session } = await supabase.auth.getSession();
  if (session?.session?.access_token) {
    supabase
      .from('goal_completions')
      .insert({ id: entry.id, goal_id: goalId, family_id: familyId, completed_at: dateStr })
      .then(({ error }) => { if (error) console.warn('Completion sync error:', error.message); });
  }

  return updated;
}

export async function logCompletion(goalId) {
  return logCompletionEntry(goalId, todayStr());
}

export async function logCompletionForDate(goalId, dateStr) {
  return logCompletionEntry(goalId, dateStr);
}
