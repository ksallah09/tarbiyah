import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = 'tarbiyah_saved_insights';

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

export async function getSavedInsights() {
  try {
    const userId = await getUserId();
    if (userId) {
      const { data, error } = await supabase
        .from('user_saved_insights')
        .select('data')
        .eq('user_id', userId)
        .order('saved_at', { ascending: true });

      if (!error && data?.length > 0) {
        const insights = data.map(r => r.data);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(insights));
        return insights;
      }

      // Supabase has nothing — push local data up to sync
      const localRaw = await AsyncStorage.getItem(STORAGE_KEY);
      const local = localRaw ? JSON.parse(localRaw) : [];
      if (local.length > 0) {
        for (const insight of local) {
          supabase.from('user_saved_insights').upsert({
            user_id:    userId,
            insight_id: insight.id,
            data:       insight,
            saved_at:   new Date().toISOString(),
          }, { onConflict: 'user_id,insight_id' }).then();
        }
      }
      return local;
    }
  } catch {}

  // Offline / unauthenticated fallback
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveInsight(insight) {
  try {
    const saved = await getSavedInsights();
    if (saved.some(i => i.id === insight.id)) return; // already saved
    const updated = [...saved, insight];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    const userId = await getUserId();
    if (userId) {
      supabase.from('user_saved_insights').upsert({
        user_id:    userId,
        insight_id: insight.id,
        data:       insight,
        saved_at:   new Date().toISOString(),
      }, { onConflict: 'user_id,insight_id' }).then(({ error }) => {
        if (error) console.warn('Saved insight sync error:', error.message);
      });
    }
  } catch {}
}

export async function unsaveInsight(id) {
  try {
    const saved = await getSavedInsights();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved.filter(i => i.id !== id)));

    const userId = await getUserId();
    if (userId) {
      supabase.from('user_saved_insights')
        .delete()
        .eq('user_id', userId)
        .eq('insight_id', id)
        .then(({ error }) => {
          if (error) console.warn('Unsave insight sync error:', error.message);
        });
    }
  } catch {}
}

export async function isInsightSaved(id) {
  const saved = await getSavedInsights();
  return saved.some(i => i.id === id);
}
