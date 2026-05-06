import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveOnboardingData } from './onboarding';
import { saveFocusAreas } from './focusAreas';

export async function saveProfileToSupabase({
  userId, name, childrenCount, childrenAges, reminderTime,
  focusAreas, familyStructure, language,
  parentRole, isWorkingParent, workHoursPerWeek, availability,
  raisedIn, raisingIn, communities,
}) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      user_id:              userId,
      name,
      children_count:       childrenCount       ?? null,
      children_ages:        childrenAges        ?? [],
      reminder_time:        reminderTime        ?? null,
      focus_areas:          focusAreas          ?? [],
      family_structure:     familyStructure     ?? 'prefer_not_to_say',
      language:             language            ?? 'English',
      parent_role:          parentRole          ?? null,
      is_working_parent:    isWorkingParent     ?? null,
      work_hours_per_week:  workHoursPerWeek    ?? null,
      availability:         availability        ?? null,
      raised_in:            raisedIn            ?? [],
      raising_in:           raisingIn           ?? null,
      communities:          communities         ?? [],
    }, { onConflict: 'user_id' });
  return error;
}

export async function syncProfileFromSupabase(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, avatar_url')
    .eq('user_id', userId)
    .single();

  if (error || !data) return false;

  await Promise.all([
    AsyncStorage.setItem('tarbiyah_profile', JSON.stringify({
      name:              data.name,
      children:          data.children_count,
      childrenAges:      data.children_ages,
      reminderTime:      data.reminder_time,
      familyStructure:   data.family_structure   ?? 'prefer_not_to_say',
      language:          data.language           ?? 'English',
      parentRole:        data.parent_role        ?? null,
      isWorkingParent:   data.is_working_parent  ?? null,
      workHoursPerWeek:  data.work_hours_per_week ?? null,
      availability:      data.availability       ?? null,
      raisedIn:          data.raised_in          ?? [],
      raisingIn:         data.raising_in         ?? null,
      communities:       data.communities        ?? [],
    })),
    // Restore profile photo URL so it survives app reinstalls
    data.avatar_url
      ? AsyncStorage.setItem('tarbiyah_profile_photo', data.avatar_url)
      : Promise.resolve(),
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
