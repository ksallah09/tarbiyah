import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const KEY = 'tarbiyah_monthly_completions';

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

async function getUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch { return null; }
}

async function syncToSupabase(stored) {
  try {
    const userId = await getUserId();
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ weekly_completions: stored })
      .eq('user_id', userId);
  } catch {}
}

async function getStored() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { periodStart: getMonthStart(), counts: {} };
  } catch { return { periodStart: getMonthStart(), counts: {} }; }
}

function resetIfStale(stored) {
  const current = getMonthStart();
  const periodKey = stored.periodStart ?? stored.weekStart; // handle old weekly key
  if (periodKey !== current) return { periodStart: current, counts: {} };
  return { ...stored, periodStart: current };
}

export async function logCompletion(key) {
  try {
    let stored = resetIfStale(await getStored());
    stored.counts[key] = (stored.counts[key] ?? 0) + 1;
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
    syncToSupabase(stored);
    return stored.counts;
  } catch { return {}; }
}

export async function getWeekCompletions() {
  try {
    const userId = await getUserId();
    if (userId) {
      const { data } = await supabase
        .from('profiles')
        .select('weekly_completions')
        .eq('user_id', userId)
        .single();
      if (data?.weekly_completions) {
        const remote = resetIfStale(data.weekly_completions);
        await AsyncStorage.setItem(KEY, JSON.stringify(remote));
        return remote.counts ?? {};
      }
    }
    const stored = resetIfStale(await getStored());
    return stored.counts ?? {};
  } catch {
    const stored = resetIfStale(await getStored());
    return stored.counts ?? {};
  }
}

// Sum all habit/activity completions across all children
export function getMonthlyHabitActivityTotals(counts) {
  let habits = 0, activities = 0;
  for (const [key, val] of Object.entries(counts)) {
    if (key.startsWith('hdone_')) habits += val;
    if (key.startsWith('adone_')) activities += val;
  }
  return { habits, activities };
}

// Fetch partner's monthly habit/activity totals from Supabase
export async function getPartnerMonthCompletions(partnerUserId) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('weekly_completions')
      .eq('user_id', partnerUserId)
      .single();
    if (!data?.weekly_completions) return { habits: 0, activities: 0 };
    const stored = resetIfStale(data.weekly_completions);
    return getMonthlyHabitActivityTotals(stored.counts ?? {});
  } catch { return { habits: 0, activities: 0 }; }
}

// Sum completions for a specific child's growth areas
export function getChildWeeklyCounts(counts, growthAreas) {
  let habits = 0, activities = 0;
  for (const area of (growthAreas ?? [])) {
    for (const [key, val] of Object.entries(counts)) {
      if (key.startsWith(`hdone_${area.id}_`)) habits += val;
      if (key.startsWith(`adone_${area.id}_`)) activities += val;
    }
  }
  return { habits, activities };
}
