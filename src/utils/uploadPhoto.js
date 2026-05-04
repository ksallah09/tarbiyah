import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

/**
 * Uploads a local photo URI to Supabase Storage and returns the public URL.
 * @param {string} localUri  - local file:// URI from ImagePicker
 * @param {string} path      - storage path e.g. "children/child_123.jpg"
 */
export async function uploadPhoto(localUri, path) {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const ext        = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType   = ext === 'png' ? 'image/png' : 'image/jpeg';
  const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
