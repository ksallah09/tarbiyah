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

  await supabase
    .from('family_children')
    .update({ linked_child_id: removeId })
    .eq('child_id', keepId);

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

    const r1 = await supabase
      .from('child_garden_actions')
      .update({ family_id: sharedFamilyId })
      .eq('child_id', localChild.id);
    if (r1.error) console.warn('[merge] garden_actions:', r1.error.message);

    const r2 = await supabase
      .from('child_garden_settings')
      .update({ family_id: sharedFamilyId })
      .eq('child_id', localChild.id);
    if (r2.error) console.warn('[merge] garden_settings:', r2.error.message);

    if (canonicalChild && canonicalChild.id !== localChild.id) {
      const r3 = await supabase
        .from('family_children')
        .upsert({
          family_id:       sharedFamilyId,
          child_id:        canonicalChild.id,
          child_name:      canonicalChild.name,
          linked_child_id: localChild.id,
        }, { onConflict: 'child_id' });
      if (r3.error) console.warn('[merge] family_children upsert:', r3.error.message);

      const r4 = await supabase
        .from('family_children')
        .delete()
        .eq('child_id', localChild.id);
      if (r4.error) console.warn('[merge] family_children delete:', r4.error.message);

      const r5 = await supabase
        .from('family_trees')
        .update({ linked_tree_id: canonicalChild.id })
        .eq('child_id', localChild.id)
        .is('linked_tree_id', null);
      if (r5.error) console.warn('[merge] family_trees:', r5.error.message);
    }
  }
}
