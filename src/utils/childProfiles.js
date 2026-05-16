import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getFamilyId } from './familyGoals';
import { getCachedSyncStatus } from './familySync';

const STORAGE_KEY = 'tarbiyah_child_profiles';

const BOY_COLORS = [
  { color: '#1A3A6B', colorLight: '#EEF4FB' }, // navy
  { color: '#1B4D3E', colorLight: '#E6F4ED' }, // forest green
  { color: '#0E7490', colorLight: '#E0F4F8' }, // teal
  { color: '#92400E', colorLight: '#FEF3E7' }, // amber
  { color: '#374151', colorLight: '#F3F4F6' }, // slate
];

const GIRL_COLORS = [
  { color: '#9D174D', colorLight: '#FCE7F3' }, // rose
  { color: '#7B4FAD', colorLight: '#F3EEFF' }, // purple
  { color: '#C2410C', colorLight: '#FFF0E6' }, // coral
  { color: '#065F46', colorLight: '#ECFDF5' }, // emerald
  { color: '#6B3A8A', colorLight: '#F5EEFF' }, // mauve
];

const NEUTRAL_COLORS = [
  { color: '#1B4D3E', colorLight: '#E6F4ED' },
  { color: '#1A3A6B', colorLight: '#EEF4FB' },
  { color: '#0E7490', colorLight: '#E0F4F8' },
  { color: '#92400E', colorLight: '#FEF3E7' },
  { color: '#374151', colorLight: '#F3F4F6' },
];

export function getChildColor(index, gender) {
  const g = gender?.toLowerCase();
  if (g === 'boy' || g === 'male')   return BOY_COLORS[index % BOY_COLORS.length];
  if (g === 'girl' || g === 'female') return GIRL_COLORS[index % GIRL_COLORS.length];
  return NEUTRAL_COLORS[index % NEUTRAL_COLORS.length];
}

async function getCached() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function setCached(profiles) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {}
}

export async function getAllChildProfiles() {
  return getCached();
}

export async function getChildProfile(id) {
  const all = await getCached();
  return all.find(c => c.id === id) ?? null;
}

export async function saveChildProfile(profile) {
  const all = await getCached();
  const colorIndex = all.length;
  const colors = getChildColor(colorIndex, profile.gender);
  const entry = {
    ...colors,
    ...profile,
    id: profile.id ?? `child_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    growthAreas: profile.growthAreas ?? [],
  };
  const updated = [...all, entry];
  await setCached(updated);
  syncToSupabase(updated);
  syncChildrenToFamilyGarden(updated);
  return entry;
}

export async function updateChildProfile(id, updates) {
  const all = await getCached();
  const updated = all.map(c =>
    c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
  );
  await setCached(updated);
  syncToSupabase(updated);
  return updated.find(c => c.id === id);
}

export async function deleteChildProfile(id) {
  const all = await getCached();
  const updated = all.filter(c => c.id !== id);
  await setCached(updated);
  syncToSupabase(updated);
}

export async function addGrowthArea(childId, growthArea) {
  const child = await getChildProfile(childId);
  if (!child) return null;
  const areas = [...(child.growthAreas ?? []), growthArea];
  return updateChildProfile(childId, { growthAreas: areas });
}

export async function updateGrowthArea(childId, growthAreaId, updates) {
  const child = await getChildProfile(childId);
  if (!child) return null;
  const areas = (child.growthAreas ?? []).map(a =>
    a.id === growthAreaId ? { ...a, ...updates } : a
  );
  return updateChildProfile(childId, { growthAreas: areas });
}

export async function syncChildrenToFamilyGarden(children) {
  try {
    const status = await getCachedSyncStatus();
    if (!status?.linked) return;
    const familyId = await getFamilyId();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId || !familyId) return;
    const rows = children.map(c => ({
      family_id:   familyId,
      child_id:    c.id,
      child_name:  c.name,
      child_color: c.color ?? null,
      child_gender: c.gender ?? null,
      added_by:    userId,
    }));
    await supabase
      .from('family_children')
      .upsert(rows, { onConflict: 'family_id,child_id' });
  } catch (e) {
    console.warn('[childProfiles] syncChildrenToFamilyGarden:', e.message);
  }
}

async function syncToSupabase(profiles) {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.access_token) return;
    const userId = data.session.user.id;
    const { error } = await supabase
      .from('profiles')
      .update({ children_profiles: profiles })
      .eq('user_id', userId);
    if (error) console.warn('[childProfiles] syncToSupabase error:', error.message);
  } catch (e) {
    console.warn('[childProfiles] syncToSupabase threw:', e.message);
  }
}

export async function syncChildProfilesFromSupabase() {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.access_token) return;
    const userId = data.session.user.id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('children_profiles')
      .eq('user_id', userId)
      .single();
    if (profile?.children_profiles?.length) {
      await setCached(profile.children_profiles);
    }
  } catch {}
}
