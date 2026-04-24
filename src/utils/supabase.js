import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL  = 'https://auth.thetarbiyahapp.com';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkaG9jY2d2d2VpaG5obHd0bW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODYyOTcsImV4cCI6MjA5MDk2MjI5N30.q6t7d6bEKNKH-uibnfAHEHlSfTFPjKspmndyce8xK0M';

// SecureStore adapter so Supabase persists the session securely on device
const SecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:          SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});
