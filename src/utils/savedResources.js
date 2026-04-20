import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tarbiyah_saved_resources';

export async function getSavedResources() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveResource(resource) {
  try {
    const saved = await getSavedResources();
    if (saved.some(r => r.id === resource.id)) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...saved, { ...resource, kind: 'resource' }]));
  } catch {}
}

export async function unsaveResource(id) {
  try {
    const saved = await getSavedResources();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved.filter(r => r.id !== id)));
  } catch {}
}

export async function isResourceSaved(id) {
  const saved = await getSavedResources();
  return saved.some(r => r.id === id);
}
