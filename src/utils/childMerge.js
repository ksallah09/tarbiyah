import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = 'tarbiyah_child_profiles';

/**
 * Merges a duplicate child into a canonical one post-linking.
 * keepChild and removeChild both have the shared family_id already.
 * Both use { child_id, child_name } shape (from family_children table).
 */
export async function mergeDuplicateChildren(keepChild, removeChild) {
  const keepId   = keepChild.child_id;
  const removeId = removeChild.child_id;
  const keepName = keepChild.child_name;

  // Move all garden actions from the duplicate to the kept child
  await supabase
    .from('child_garden_actions')
    .update({ child_id: keepId, child_name: keepName })
    .eq('child_id', removeId);

  // Settings: keep canonical's if they exist, otherwise promote duplicate's
  const { data: keepSettings } = await supabase
    .from('child_garden_settings')
    .select('child_id')
    .eq('child_id', keepId)
    .maybeSingle();

  if (keepSettings) {
    await supabase.from('child_garden_settings').delete().eq('child_id', removeId);
  } else {
    await supabase.from('child_garden_settings').update({ child_id: keepId }).eq('child_id', removeId);
  }

  // Remove duplicate from family_children registry
  await supabase.from('family_children').delete().eq('child_id', removeId);

  // Update local child profiles if the duplicate lives there
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const profiles = raw ? JSON.parse(raw) : [];
    const hasRemove = profiles.some(p => p.id === removeId);
    if (hasRemove) {
      const updated = profiles
        .filter(p => p.id !== removeId)
        .map(p => p.id === keepId ? { ...p, id: keepId } : p);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        await supabase.from('profiles').update({ children_profiles: updated }).eq('user_id', userId);
      }
    }
  } catch (e) {
    console.warn('[childMerge] mergeDuplicateChildren local update failed:', e.message);
  }
}

/**
 * Runs after the user confirms the child-matching screen.
 *
 * matches: [{ localChild, canonicalChild | null }]
 *   - localChild: the joining partner's child
 *   - canonicalChild: the invite creator's child to merge into (null = keep separate)
 *
 * sharedFamilyId: the family_id both partners now share
 */
export async function mergeGardenData(matches, sharedFamilyId) {
  for (const { localChild, canonicalChild } of matches) {
    if (!localChild) continue;

    if (canonicalChild && canonicalChild.id !== localChild.id) {
      // Migrate all garden actions to the canonical child_id
      await supabase
        .from('child_garden_actions')
        .update({
          child_id:   canonicalChild.id,
          family_id:  sharedFamilyId,
          child_name: canonicalChild.name,
        })
        .eq('child_id', localChild.id);

      // Handle settings: keep canonical's if they exist, otherwise promote local
      const { data: canonicalSettings } = await supabase
        .from('child_garden_settings')
        .select('child_id')
        .eq('child_id', canonicalChild.id)
        .maybeSingle();

      if (canonicalSettings) {
        await supabase.from('child_garden_settings').delete().eq('child_id', localChild.id);
      } else {
        await supabase
          .from('child_garden_settings')
          .update({ child_id: canonicalChild.id, family_id: sharedFamilyId })
          .eq('child_id', localChild.id);
      }
    } else {
      // Unmatched — just fix family_id so deeds appear in the shared garden
      await supabase
        .from('child_garden_actions')
        .update({ family_id: sharedFamilyId })
        .eq('child_id', localChild.id);

      await supabase
        .from('child_garden_settings')
        .update({ family_id: sharedFamilyId })
        .eq('child_id', localChild.id);
    }
  }

  // Update local child profiles: replace matched local children with the canonical version
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const profiles = raw ? JSON.parse(raw) : [];
    const updated = profiles.map(p => {
      const match = matches.find(m => m.localChild?.id === p.id);
      if (match?.canonicalChild && match.canonicalChild.id !== p.id) {
        return match.canonicalChild;
      }
      return p;
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      await supabase.from('profiles').update({ children_profiles: updated }).eq('user_id', userId);
    }
  } catch (e) {
    console.warn('[childMerge] local profile update failed:', e.message);
  }
}
