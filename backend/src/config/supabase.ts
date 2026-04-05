import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Add it to backend/.env`
    );
  }
  return value;
}

// Service role client — bypasses RLS, used only server-side
// Never expose this key to the mobile app
export const supabase: SupabaseClient = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_KEY'),
  { auth: { persistSession: false } }
);

// Verify a user JWT from the mobile app (uses anon key for token validation)
export async function verifyUserToken(token: string) {
  const anonClient = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
