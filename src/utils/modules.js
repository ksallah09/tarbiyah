import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const MODULES_KEY = 'tarbiyah_modules';
const API_URL = 'https://tarbiyah-production.up.railway.app';

async function getAuthHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
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

  // Then sync to backend (fire-and-forget — don't block the caller)
  (async () => {
    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) return;
      await fetch(`${API_URL}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(mod),
      });
    } catch {}
  })();
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

  (async () => {
    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) return;
      await fetch(`${API_URL}/modules/${moduleId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
    } catch {}
  })();
}

/**
 * Load modules for the current user.
 * If authenticated: fetches from backend and refreshes AsyncStorage cache.
 * If offline or unauthenticated: falls back to AsyncStorage.
 */
export async function loadModules() {
  try {
    const authHeader = await getAuthHeader();
    if (authHeader) {
      const res = await fetch(`${API_URL}/modules`, { headers: authHeader });
      if (res.ok) {
        const modules = await res.json();
        // Refresh local cache with server data
        await AsyncStorage.setItem(MODULES_KEY, JSON.stringify(modules));
        return modules;
      }
    }
  } catch {}

  // Fallback: return whatever is cached locally
  try {
    const raw = await AsyncStorage.getItem(MODULES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
