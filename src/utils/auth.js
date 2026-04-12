import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';


WebBrowser.maybeCompleteAuthSession();

/** Returns the current session, or null if not signed in. */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Returns the current user object, or null. */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/** Returns the JWT access token for API requests, or null. */
export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token ?? null;
}

/** Sign up with email + password. Returns { user, error }. */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { user: data?.user ?? null, error };
}

/** Sign in with email + password. Returns { user, error }. */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user ?? null, error };
}

/** All AsyncStorage keys that belong to the current user session. */
const USER_STORAGE_KEYS = [
  'tarbiyah_onboarding_v1',
  'tarbiyah_profile',
  'tarbiyah_focus_areas',
  'tarbiyah_daily_cache',
  'tarbiyah_read_days',
  'tarbiyah_goal_checked',
  'tarbiyah_goal_days',
  'tarbiyah_goal_history',
  'tarbiyah_saved_insights',
  'tarbiyah_modules',
  'tarbiyah_family_goals_v1',
  'tarbiyah_family_id',
  'tarbiyah_partner_cache',
  'tarbiyah_greeting_date',
];

/** Sign out, clear Supabase session, and wipe all local user data. */
export async function signOut() {
  await supabase.auth.signOut();
  try {
    // Remove known keys
    await AsyncStorage.multiRemove(USER_STORAGE_KEYS);
    // Remove any dynamic notification ID keys (tarbiyah_goal_notifs_*)
    const allKeys = await AsyncStorage.getAllKeys();
    const dynamicKeys = allKeys.filter(k => k.startsWith('tarbiyah_'));
    if (dynamicKeys.length > 0) await AsyncStorage.multiRemove(dynamicKeys);
  } catch {}
}

/** Sign in with Apple. Returns { user, error }. */
export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    return { user: data?.user ?? null, error };
  } catch (err) {
    if (err.code === 'ERR_REQUEST_CANCELED') return { user: null, error: null }; // user dismissed
    return { user: null, error: err };
  }
}

/** Sign in with Google via OAuth browser flow. Returns { user, error }. */
export async function signInWithGoogle() {
  try {
    // Supabase handles the Google callback server-side, then redirects to our app scheme
    const appRedirect = 'com.tarbiyah.parenting://auth/callback';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: appRedirect,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) return { user: null, error: error ?? new Error('No OAuth URL') };

    // Open the Google auth page — Supabase redirects back to our app scheme when done
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      appRedirect,
    );
    if (result.type !== 'success') return { user: null, error: null };

    // Parse tokens from the deep link URL
    const url = new URL(result.url);
    const params = new URLSearchParams(url.hash.replace('#', ''));
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken) return { user: null, error: new Error('No access token in redirect') };

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token:  accessToken,
      refresh_token: refreshToken,
    });
    return { user: sessionData?.user ?? null, error: sessionError };
  } catch (err) {
    return { user: null, error: err };
  }
}
