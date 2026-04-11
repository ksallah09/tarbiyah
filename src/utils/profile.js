import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveOnboardingData } from './onboarding';
import { saveFocusAreas } from './focusAreas';

/** Save profile data to Supabase after onboarding. */
export async function saveProfileToSupabase({ userId, name, childrenCount, childrenAges, reminderTime, focusAreas, language }) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      user_id:       userId,
      name,
      children_count: childrenCount ?? null,
      children_ages:  childrenAges  ?? [],
      reminder_time:  reminderTime  ?? null,
      focus_areas:    focusAreas    ?? [],
      language:       language      ?? 'English',
    }, { onConflict: 'user_id' });
  return error;
}

/**
 * Fetch profile from Supabase and write it into local AsyncStorage.
 * If no Supabase profile exists yet, marks onboarding complete and
 * leaves any existing local profile data untouched.
 */
export async function syncProfileFromSupabase(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  await Promise.all([
    AsyncStorage.setItem('tarbiyah_profile', JSON.stringify({
      name:          data.name,
      children:      data.children_count,
      childrenAges:  data.children_ages,
      reminderTime:  data.reminder_time,
      language:      data.language ?? 'English',
    })),
    saveOnboardingData({
      name:          data.name,
      childrenCount: data.children_count,
      childrenAges:  data.children_ages,
      reminderTime:  data.reminder_time,
      complete:      true,
    }),
    data.focus_areas?.length ? saveFocusAreas(data.focus_areas) : Promise.resolve(),
  ]);

  return true;
}
