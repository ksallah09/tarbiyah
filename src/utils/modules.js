import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const MODULES_KEY = 'tarbiyah_modules';
const API_URL = 'https://tarbiyah-production.up.railway.app';

async function getAuthHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

// ── Supabase sync helpers ──────────────────────────────────

function syncModuleToSupabase(mod, userId) {
  supabase.from('user_modules').upsert({
    id:         mod.id,
    user_id:    userId,
    data:       mod,
    created_at: mod.createdAt ?? new Date().toISOString(),
  }, { onConflict: 'user_id,id' }).then(({ error }) => {
    if (error) console.warn('Module sync error:', error.message);
  });
}

function deleteModuleFromSupabase(moduleId, userId) {
  supabase.from('user_modules')
    .delete()
    .eq('id', moduleId)
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) console.warn('Module delete sync error:', error.message);
    });
}

/**
 * Save a module to AsyncStorage + backend (if authenticated).
 * AsyncStorage always updated first so the UI never waits on the network.
 */
export async function saveModule(mod) {
  // Always persist locally first
  try {
    const raw = await AsyncStorage.getItem(MODULES_KEY);
    const modules = raw ? JSON.parse(raw) : [];
    const idx = modules.findIndex(m => m.id === mod.id);
    if (idx >= 0) modules[idx] = mod;
    else modules.unshift(mod);
    await AsyncStorage.setItem(MODULES_KEY, JSON.stringify(modules));
  } catch {}

  // Sync to backend API and Supabase (fire-and-forget)
  const authHeader = await getAuthHeader();
  const userId = await getUserId();

  if (authHeader) {
    (async () => {
      try {
        await fetch(`${API_URL}/modules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(mod),
        });
      } catch {}
    })();
  }

  if (userId) {
    syncModuleToSupabase(mod, userId);
  }
}

/**
 * Delete a module from AsyncStorage + backend (if authenticated).
 */
export async function deleteModule(moduleId) {
  try {
    const raw = await AsyncStorage.getItem(MODULES_KEY);
    const modules = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(MODULES_KEY, JSON.stringify(modules.filter(m => m.id !== moduleId)));
  } catch {}

  const authHeader = await getAuthHeader();
  const userId = await getUserId();

  if (authHeader) {
    (async () => {
      try {
        await fetch(`${API_URL}/modules/${moduleId}`, {
          method: 'DELETE',
          headers: authHeader,
        });
      } catch {}
    })();
  }

  if (userId) {
    deleteModuleFromSupabase(moduleId, userId);
  }
}

function sortNewestFirst(modules) {
  return [...modules].sort((a, b) => {
    // IDs are "mod_<Date.now()>" — extract the timestamp for a reliable sort
    const ta = parseInt((a.id ?? '').replace('mod_', ''), 10) || 0;
    const tb = parseInt((b.id ?? '').replace('mod_', ''), 10) || 0;
    return tb - ta;
  });
}

/**
 * Load modules for the current user.
 * Priority: backend API → Supabase → AsyncStorage cache.
 */
export async function loadModules() {
  const authHeader = await getAuthHeader();

  // Try backend API first
  if (authHeader) {
    try {
      const res = await fetch(`${API_URL}/modules`, { headers: authHeader });
      if (res.ok) {
        const backendModules = await res.json();

        // Merge: keep any locally-saved modules that the backend doesn't know about yet
        const localRaw = await AsyncStorage.getItem(MODULES_KEY);
        const local = localRaw ? JSON.parse(localRaw) : [];
        const backendIds = new Set(backendModules.map(m => m.id));
        const localOnly = local.filter(m => !backendIds.has(m.id));

        // Push local-only modules up to the backend (fire-and-forget)
        const userId = await getUserId();
        if (userId && localOnly.length > 0) {
          for (const mod of localOnly) syncModuleToSupabase(mod, userId);
        }

        // Preserve audioUrl on lessons from local cache — the backend API may not
        // store or return lesson-level audio URLs, so we layer them back in here.
        const mergedBackend = backendModules.map(bm => {
          const lm = local.find(m => m.id === bm.id);
          if (!lm?.lessons) return bm;
          return {
            ...bm,
            lessons: bm.lessons?.map(l => {
              const ll = lm.lessons.find(ll => ll.id === l.id);
              return ll?.audioUrl ? { ...l, audioUrl: ll.audioUrl } : l;
            }) ?? bm.lessons,
          };
        });

        const merged = sortNewestFirst([...localOnly, ...mergedBackend]);
        await AsyncStorage.setItem(MODULES_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch {}
  }

  // Try Supabase as secondary source
  try {
    const userId = await getUserId();
    if (userId) {
      const { data, error } = await supabase
        .from('user_modules')
        .select('data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data?.length > 0) {
        const remoteModules = data.map(r => r.data);
        // Preserve audioUrl from local cache in case Supabase copy doesn't have them
        const localRaw2 = await AsyncStorage.getItem(MODULES_KEY);
        const local2 = localRaw2 ? JSON.parse(localRaw2) : [];
        const withAudio = remoteModules.map(rm => {
          const lm = local2.find(m => m.id === rm.id);
          if (!lm?.lessons) return rm;
          return {
            ...rm,
            lessons: rm.lessons?.map(l => {
              const ll = lm.lessons.find(ll => ll.id === l.id);
              return ll?.audioUrl ? { ...l, audioUrl: ll.audioUrl } : l;
            }) ?? rm.lessons,
          };
        });
        const modules = sortNewestFirst(withAudio);
        await AsyncStorage.setItem(MODULES_KEY, JSON.stringify(modules));
        return modules;
      }

      // If Supabase is empty, push local modules up to sync
      const localRaw = await AsyncStorage.getItem(MODULES_KEY);
      const local = localRaw ? JSON.parse(localRaw) : [];
      if (local.length > 0) {
        for (const mod of local) syncModuleToSupabase(mod, userId);
      }
      return local;
    }
  } catch {}

  // Final fallback: local cache
  try {
    const raw = await AsyncStorage.getItem(MODULES_KEY);
    return raw ? sortNewestFirst(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/**
 * Fast AsyncStorage-only read — no network.
 * Use for instant first-paint while loadModules() refreshes in background.
 */
export async function loadModulesCached() {
  try {
    const raw = await AsyncStorage.getItem(MODULES_KEY);
    return raw ? sortNewestFirst(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

// Pull all modules from Supabase into local cache (call on sign-in)
export async function syncModulesFromRemote() {
  try {
    const userId = await getUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_modules')
      .select('data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data?.length > 0) {
      const modules = data.map(r => r.data);
      await AsyncStorage.setItem(MODULES_KEY, JSON.stringify(modules));
    }
  } catch {}
}
