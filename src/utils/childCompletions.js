import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { notifyPartner } from './partnerNotify';

const TYPE_LABELS = {
  accomplishment_race: 'Habits Race',
  category_blitz:      'Category Blitz',
};

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

async function getStored() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { periodStart: getMonthStart(), counts: {} };
  } catch { return { periodStart: getMonthStart(), counts: {} }; }
}

function resetIfStale(stored) {
  if (!stored) return { periodStart: getMonthStart(), counts: {} };
  const current    = getMonthStart();
  const periodKey  = stored.periodStart ?? stored.weekStart;
  if (periodKey !== current) return { periodStart: current, counts: {} };
  return { ...stored, periodStart: current };
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

// Always write to local first, then sync — local is the source of truth for current user
export async function logCompletion(key) {
  try {
    let stored = resetIfStale(await getStored());
    stored.counts[key] = (stored.counts[key] ?? 0) + 1;
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
    syncToSupabase(stored); // fire-and-forget — does not affect local
    if (key.startsWith('hdone_') || key.startsWith('adone_')) {
      updateChallengeProgress(key);
    }
    return stored.counts;
  } catch { return {}; }
}

async function updateChallengeProgress(key) {
  try {
    const userId = await getUserId();
    if (!userId) return;

    const isHabit    = key.startsWith('hdone_');
    const isActivity = key.startsWith('adone_');

    const { data: challenge, error } = await supabase
      .from('family_challenges')
      .select('*')
      .or(`challenger_id.eq.${userId},partner_id.eq.${userId}`)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error || !challenge) return;

    const { type, config } = challenge;

    // Only count towards matching challenge types
    if (type === 'accomplishment_race' && !isHabit) return;
    if (type === 'category_blitz') {
      if (config.category === 'habits'     && !isHabit)    return;
      if (config.category === 'activities' && !isActivity) return;
    }
    if (type === 'streak') return;

    const isChallenger = challenge.challenger_id === userId;
    const field        = isChallenger ? 'challenger_progress' : 'partner_progress';
    const current      = challenge[field] ?? 0;
    const newVal       = current + 1;
    const target       = challenge.config?.target ?? 1;

    await supabase
      .from('family_challenges')
      .update({ [field]: newVal, updated_at: new Date().toISOString() })
      .eq('id', challenge.id);

    // Win condition — first to reach target
    if (newVal >= target) {
      await supabase
        .from('family_challenges')
        .update({ status: 'completed', winner_id: userId, updated_at: new Date().toISOString() })
        .eq('id', challenge.id);

      const label = TYPE_LABELS[challenge.type] ?? 'Challenge';
      notifyPartner(
        `Challenge over! 🏆`,
        `Your partner reached the target first in the ${label}. Check the results!`,
        { screen: 'Home' }
      );
    }
  } catch {}
}

// For current user — reads local AsyncStorage, seeding from Supabase on a new device
export async function getLocalCounts() {
  const stored = resetIfStale(await getStored());
  const localCounts = stored.counts ?? {};

  // If local is empty, try to restore from Supabase (new device / fresh install)
  if (Object.keys(localCounts).length === 0) {
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
          const remoteCounts = remote.counts ?? {};
          if (Object.keys(remoteCounts).length > 0) {
            await AsyncStorage.setItem(KEY, JSON.stringify(remote));
            return remoteCounts;
          }
        }
      }
    } catch {}
  }

  return localCounts;
}

// For initial load / partner sync — reads Supabase but does NOT overwrite local
export async function getWeekCompletions() {
  try {
    // Always prefer local for the current user — it's written before Supabase syncs
    const local = resetIfStale(await getStored());
    const localCounts = local.counts ?? {};

    // Kick off a background Supabase sync to keep profiles table fresh for partner reads
    getUserId().then(async userId => {
      if (!userId) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('weekly_completions')
          .eq('user_id', userId)
          .single();
        if (data?.weekly_completions) {
          const remote = resetIfStale(data.weekly_completions);
          // Only use remote if local has no data at all (fresh install / new device)
          const localEmpty = Object.keys(localCounts).length === 0;
          if (localEmpty && Object.keys(remote.counts ?? {}).length > 0) {
            await AsyncStorage.setItem(KEY, JSON.stringify(remote));
          }
        }
      } catch {}
    });

    return localCounts;
  } catch {
    return {};
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

// Sum completions for a specific child's growth areas this week
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
