import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getFamilyId } from './familyGoals';

const FAMILY_ID_KEY = 'tarbiyah_family_id';
const PARTNER_CACHE_KEY = 'tarbiyah_partner_cache';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

async function getDisplayName() {
  // 1. Try local profile
  try {
    const raw = await AsyncStorage.getItem('tarbiyah_profile');
    if (raw) {
      const p = JSON.parse(raw);
      if (p.name) return p.name;
    }
    const onboarding = await AsyncStorage.getItem('tarbiyah_onboarding_v1');
    if (onboarding) {
      const d = JSON.parse(onboarding);
      if (d.name) return d.name;
    }
  } catch {}
  // 2. Fall back to Supabase profiles table
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', userId)
        .single();
      if (profile?.name) return profile.name;
    }
  } catch {}
  return null;
}

// ─── Sync status ──────────────────────────────────────────────────────────────

/**
 * Returns { linked: bool, partner: { name, userId } | null, familyId }
 */
export async function getFamilySyncStatus() {
  const userId = await getCurrentUserId();
  if (!userId) return { linked: false, partner: null, familyId: null };

  const familyId = await getFamilyId();

  const { data, error } = await supabase
    .from('family_members')
    .select('user_id, display_name, role')
    .eq('family_id', familyId);

  if (error || !data) {
    // Return cached status rather than false if Supabase fails
    const cached = await getCachedSyncStatus();
    if (cached.linked) return cached;
    return { linked: false, partner: null, familyId };
  }

  const others = data.filter(m => m.user_id !== userId);

  if (others.length === 0) {
    // family_members came back empty — could be an RLS issue.
    // Fall back: look for an invite this user created that has been used.
    // Only select columns guaranteed to exist; joiner_name is optional.
    const { data: usedInvites } = await supabase
      .from('family_invites')
      .select('used_by, family_id')
      .eq('created_by', userId)
      .not('used_by', 'is', null)
      .limit(1);

    const usedInvite = usedInvites?.[0];
    if (usedInvite?.used_by) {
      // Try to get joiner_name separately (column added later — may not exist on old rows)
      let joinerName = null;
      try {
        const { data: named } = await supabase
          .from('family_invites')
          .select('joiner_name')
          .eq('created_by', userId)
          .not('used_by', 'is', null)
          .limit(1)
          .single();
        joinerName = named?.joiner_name ?? null;
      } catch {}

      const result = {
        linked: true,
        partner: { name: joinerName, userId: usedInvite.used_by },
        familyId: usedInvite.family_id ?? familyId,
      };
      await AsyncStorage.setItem(PARTNER_CACHE_KEY, JSON.stringify(result));
      return result;
    }

    return { linked: false, partner: null, familyId };
  }

  const partnerMember = others[0];
  let partnerName = partnerMember.display_name;

  // If name wasn't stored in family_members, check used invites we created
  if (!partnerName) {
    const { data: usedInvite } = await supabase
      .from('family_invites')
      .select('joiner_name')
      .eq('created_by', userId)
      .eq('used_by', partnerMember.user_id)
      .limit(1)
      .single();
    partnerName = usedInvite?.joiner_name ?? null;
  }

  const result = { linked: true, partner: { name: partnerName, userId: partnerMember.user_id }, familyId };

  // Cache partner info for offline display
  await AsyncStorage.setItem(PARTNER_CACHE_KEY, JSON.stringify(result));
  return result;
}

export async function getCachedSyncStatus() {
  try {
    const raw = await AsyncStorage.getItem(PARTNER_CACHE_KEY);
    return raw ? JSON.parse(raw) : { linked: false, partner: null, familyId: null };
  } catch {
    return { linked: false, partner: null, familyId: null };
  }
}

// ─── Generate invite ──────────────────────────────────────────────────────────

/**
 * Generates a new invite code for the current user's family.
 * Cancels any existing unused codes first.
 * Returns { code, expiresAt } or throws.
 */
export async function generateInviteCode() {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not signed in');

  const familyId = await getFamilyId();
  const displayName = await getDisplayName();

  // Ensure this user is registered as a family member
  const { error: ownerMemberError } = await supabase
    .from('family_members')
    .upsert({ family_id: familyId, user_id: userId, display_name: displayName, role: 'owner' }, { onConflict: 'family_id,user_id' });
  if (ownerMemberError) console.warn('family_members owner upsert error:', ownerMemberError.message);

  // Cancel any prior unused codes from this family
  await supabase
    .from('family_invites')
    .update({ cancelled: true })
    .eq('family_id', familyId)
    .is('used_by', null)
    .is('cancelled', false);

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const { error } = await supabase.from('family_invites').insert({
      family_id:    familyId,
      invite_code:  code,
      created_by:   userId,
      creator_name: displayName,
      expires_at:   expiresAt,
      cancelled:    false,
    });
    if (!error) break;
    // Retry only on unique constraint violation
    if (!error.message.includes('duplicate') && !error.message.includes('unique')) throw new Error(error.message);
    if (attempt === 4) throw new Error('Could not generate a unique code. Please try again.');
  }
  return { code, expiresAt };
}

// ─── Join family ──────────────────────────────────────────────────────────────

/**
 * Joins a family using an invite code entered by the second parent.
 * Returns { success, familyId, ownerName } or { success: false, error }
 */
export async function joinFamilyWithCode(code) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not signed in' };

  const cleanCode = code.trim().toUpperCase();

  // Look up the invite
  const { data: invite, error: fetchError } = await supabase
    .from('family_invites')
    .select('*')
    .eq('invite_code', cleanCode)
    .is('used_by', null)
    .eq('cancelled', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (fetchError || !invite) {
    return { success: false, error: 'Invalid or expired code. Please ask your partner to generate a new one.' };
  }

  if (invite.created_by === userId) {
    return { success: false, error: "That's your own invite code. Share it with your partner." };
  }

  const displayName = await getDisplayName();

  // Mark invite as used — store joiner_name so the invite creator can read it without cross-user queries
  await supabase
    .from('family_invites')
    .update({ used_by: userId, used_at: new Date().toISOString(), joiner_name: displayName })
    .eq('id', invite.id);

  // Migrate goals from old family_id to the shared one
  const oldFamilyId = await getFamilyId();
  if (oldFamilyId !== invite.family_id) {
    await supabase
      .from('family_goals')
      .update({ family_id: invite.family_id })
      .eq('family_id', oldFamilyId);
  }

  // Join the family
  const { error: memberError } = await supabase
    .from('family_members')
    .upsert({ family_id: invite.family_id, user_id: userId, display_name: displayName, role: 'partner' }, { onConflict: 'family_id,user_id' });
  if (memberError) console.warn('family_members upsert error:', memberError.message);

  // Update local family ID
  await AsyncStorage.setItem(FAMILY_ID_KEY, invite.family_id);

  // Name is embedded in the invite — no cross-user query needed
  const ownerName = invite.creator_name ?? null;

  // Write linked status to cache immediately so Progress screen sees it on focus
  const syncResult = {
    linked: true,
    partner: { name: ownerName, userId: invite.created_by },
    familyId: invite.family_id,
  };
  await AsyncStorage.setItem(PARTNER_CACHE_KEY, JSON.stringify(syncResult));

  return {
    success: true,
    familyId: invite.family_id,
    ownerName,
    syncResult,
  };
}

// ─── Leave family ─────────────────────────────────────────────────────────────

export async function leaveFamily() {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const familyId = await getFamilyId();

  // Remove from family_members
  await supabase
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId);

  // Create a new personal family ID
  const newFamilyId = `family_${userId}_${Date.now()}`;
  await AsyncStorage.setItem(FAMILY_ID_KEY, newFamilyId);
  await AsyncStorage.removeItem(PARTNER_CACHE_KEY);
}
