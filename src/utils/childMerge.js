import { supabase } from './supabase';

/**
 * Display-only merge for the Family Garden.
 *
 * Sets linked_child_id on the canonical entry so the Family Garden
 * can combine deed counts from both children into one card.
 * Does NOT touch local profiles, growth areas, habits, or deed rows.
 * Each parent's per-child dashboard remains fully independent.
 */
export async function mergeDuplicateChildren(keepChild, removeChild) {
  const keepId   = keepChild.child_id;
  const removeId = removeChild.child_id;

  // Link the duplicate under the canonical entry
  await supabase
    .from('family_children')
    .update({ linked_child_id: removeId })
    .eq('child_id', keepId);

  // Remove the duplicate's standalone entry
  await supabase
    .from('family_children')
    .delete()
    .eq('child_id', removeId);
}

/**
 * Runs at family link time after the user confirms the child-matching screen.
 *
 * matches: [{ localChild, canonicalChild | null }]
 * sharedFamilyId: the family_id both partners now share
 *
 * Only migrates garden data family_ids (so deeds are visible under the shared
 * family). Does NOT replace local child profiles — each parent keeps their own
 * independent child profile, growth areas, and habits.
 */
export async function mergeGardenData(matches, sharedFamilyId) {
  for (const { localChild, canonicalChild } of matches) {
    if (!localChild) continue;

    // Always fix family_id so this child's deeds appear in the shared garden
    await supabase
      .from('child_garden_actions')
      .update({ family_id: sharedFamilyId })
      .eq('child_id', localChild.id);

    await supabase
      .from('child_garden_settings')
      .update({ family_id: sharedFamilyId })
      .eq('child_id', localChild.id);

    // If matched to a canonical child, link them in family_children (display-only)
    if (canonicalChild && canonicalChild.id !== localChild.id) {
      await supabase
        .from('family_children')
        .update({ linked_child_id: localChild.id })
        .eq('child_id', canonicalChild.id);

      await supabase
        .from('family_children')
        .delete()
        .eq('child_id', localChild.id);
    }
  }
}
