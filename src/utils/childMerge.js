import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = 'tarbiyah_child_profiles';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tarbiyah-production.up.railway.app';

/**
 * Merges a duplicate child into a canonical one post-linking.
 * keepChild and removeChild both use { child_id, child_name } shape (family_children table).
 *
 * Deed/settings migration goes through the backend (service role) so cross-user
 * rows are updated regardless of RLS restrictions on the client.
 */
export async function mergeDuplicateChildren(keepChild, removeChild) {
  const keepId   = keepChild.child_id;
  const removeId = removeChild.child_id;
  const keepName = keepChild.child_name;

  // Delegate all Supabase writes to backend (bypasses RLS for cross-user rows)
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const resp = await fetch(`${API_URL}/family/merge-child`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ keepChildId: keepId, keepChildName: keepName, removeChildId: removeId }),
  });
  if (!resp.ok) throw new Error('Backend merge failed');

  // Fix local child profiles: replace the duplicate's child_id with the canonical one
  // so future deeds are logged against the right child
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const profiles = raw ? JSON.parse(raw) : [];
    const hasRemove = profiles.some(p => p.id === removeId);
    if (hasRemove) {
      const hasKeep = profiles.some(p => p.id === keepId);
      let updated;
      if (hasKeep) {
        // Both in local profile — just drop the duplicate
        updated = profiles.filter(p => p.id !== removeId);
      } else {
        // Only the duplicate is local — remap to canonical id but keep the parent's own display name
        updated = profiles.map(p =>
          p.id === removeId ? { ...p, id: keepId } : p
        );
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        await supabase.from('profiles').update({ children_profiles: updated }).eq('user_id', userId);
      }
    }
  } catch (e) {
    console.warn('[childMerge] local profile update failed:', e.message);
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
