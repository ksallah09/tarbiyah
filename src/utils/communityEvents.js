import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PLACES_KEY = 'AIzaSyAAzZUrCRvsauWBVNUnIf9HgH-CR8ub4Ig';

// ── Fetch events for given place IDs ─────────────────────────────────────────
export async function fetchLocalEvents(placeIds) {
  if (!placeIds?.length) return [];
  const { data, error } = await supabase
    .from('community_events')
    .select('*')
    .in('place_id', placeIds)
    .eq('status', 'active')
    .order('event_date', { ascending: true });
  if (error) { console.warn('[communityEvents] fetchLocalEvents error', error); return []; }
  return data ?? [];
}

// ── Fetch upcoming events matched to child age groups ─────────────────────────
export async function fetchUpcomingForFamily(placeIds, childrenAges) {
  if (!placeIds?.length) return [];
  const today = new Date().toISOString().split('T')[0];
  const cutoff = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('community_events')
    .select('*')
    .in('place_id', placeIds)
    .eq('status', 'active')
    .gte('event_date', today)
    .lte('event_date', cutoff)
    .order('event_date', { ascending: true });

  if (error) { console.warn('[communityEvents] fetchUpcoming error', error); return []; }

  if (!childrenAges?.length) return data ?? [];

  // Map age group IDs to rough numeric ranges
  const ageRanges = {
    'under-5': [0,  5],
    '5-10':    [5,  10],
    '11-15':   [11, 15],
    '16-plus': [16, 99],
  };

  return (data ?? []).filter(ev => {
    if (ev.age_min == null && ev.age_max == null) return true; // all ages
    return childrenAges.some(ag => {
      const [lo, hi] = ageRanges[ag] ?? [0, 99];
      const evMin = ev.age_min ?? 0;
      const evMax = ev.age_max ?? 99;
      return lo <= evMax && hi >= evMin;
    });
  });
}

// ── Submit a new event ────────────────────────────────────────────────────────
export async function submitEvent({ placeId, orgName, title, description, eventDate, eventTime, location, category, ageMin, ageMax, postedBy }) {
  // Fetch contact info from Places API at submission time
  let orgPhone = null, orgWebsite = null, orgAddress = null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website,formatted_address&key=${PLACES_KEY}`;
    const json = await fetch(url).then(r => r.json());
    if (json.status === 'OK') {
      orgPhone   = json.result.formatted_phone_number ?? null;
      orgWebsite = json.result.website ?? null;
      orgAddress = json.result.formatted_address ?? null;
    }
  } catch {}

  const { data, error } = await supabase
    .from('community_events')
    .insert({
      place_id:    placeId,
      org_name:    orgName,
      title,
      description: description ?? null,
      event_date:  eventDate ?? null,
      event_time:  eventTime ?? null,
      location:    location ?? null,
      category:    category ?? 'general',
      age_min:     ageMin ?? null,
      age_max:     ageMax ?? null,
      posted_by:   postedBy,
      org_phone:   orgPhone,
      org_website: orgWebsite,
      org_address: orgAddress,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Verify an event ───────────────────────────────────────────────────────────
export async function verifyEvent(eventId, userId, verdict) {
  // Upsert the verification (user can change their verdict)
  const { error: vErr } = await supabase
    .from('event_verifications')
    .upsert({ event_id: eventId, user_id: userId, verdict }, { onConflict: 'event_id,user_id' });
  if (vErr) throw vErr;

  // Recalculate counts from the verifications table
  const { data: verifs } = await supabase
    .from('event_verifications')
    .select('verdict')
    .eq('event_id', eventId);

  const verifyCount   = (verifs ?? []).filter(v => v.verdict === 'confirmed' || v.verdict === 'attended').length;
  const attendedCount = (verifs ?? []).filter(v => v.verdict === 'attended').length;
  const incorrectCount = (verifs ?? []).filter(v => v.verdict === 'incorrect').length;

  // Determine new trust level
  let trustLevel = 'community';
  if (verifyCount >= 5 && incorrectCount < 2) trustLevel = 'community_confirmed';

  // Determine new status
  let status = 'active';
  if (incorrectCount >= 2) status = 'flagged';

  await supabase
    .from('community_events')
    .update({ verify_count: verifyCount, attended_count: attendedCount, incorrect_count: incorrectCount, trust_level: trustLevel, status })
    .eq('id', eventId);
}

// ── Get user's own verification for an event ──────────────────────────────────
export async function getMyVerdict(eventId, userId) {
  const { data } = await supabase
    .from('event_verifications')
    .select('verdict')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.verdict ?? null;
}

// ── Load communities from profile ─────────────────────────────────────────────
export async function loadCommunities() {
  try {
    const raw = await AsyncStorage.getItem('tarbiyah_profile');
    if (!raw) return [];
    return JSON.parse(raw).communities ?? [];
  } catch { return []; }
}

// ── Load children ages from profile ──────────────────────────────────────────
export async function loadChildrenAges() {
  try {
    const raw = await AsyncStorage.getItem('tarbiyah_profile');
    if (!raw) return [];
    return JSON.parse(raw).childrenAges ?? [];
  } catch { return []; }
}
