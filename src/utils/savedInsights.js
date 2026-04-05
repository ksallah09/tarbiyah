import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tarbiyah_saved_insights';

export async function getSavedInsights() {
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
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...saved, insight]));
  } catch {}
}

export async function unsaveInsight(id) {
  try {
    const saved = await getSavedInsights();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved.filter(i => i.id !== id)));
  } catch {}
}

export async function isInsightSaved(id) {
  const saved = await getSavedInsights();
  return saved.some(i => i.id === id);
}
