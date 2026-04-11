import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tarbiyah_onboarding_v1';

export async function getOnboardingData() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveOnboardingData(data) {
  try {
    const existing = await getOnboardingData() ?? {};
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...existing, ...data }));
  } catch {}
}

export async function isOnboardingComplete() {
  const data = await getOnboardingData();
  return data?.complete === true;
}

export async function markOnboardingComplete() {
  await saveOnboardingData({ complete: true });
}

export async function resetOnboarding() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
