import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tarbiyah_saved_advice';

export async function getSavedAdvice() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveAdvice(item) {
  try {
    const existing = await getSavedAdvice();
    const updated = [item, ...existing];
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

export async function deleteSavedAdvice(id) {
  try {
    const existing = await getSavedAdvice();
    const updated = existing.filter(i => i.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}
