import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

/**
 * Uploads a local photo URI to Supabase Storage and returns the public URL.
 * @param {string} localUri  - local file:// URI from ImagePicker
 * @param {string} path      - storage path e.g. "children/child_123.jpg"
 */
export async function uploadPhoto(localUri, path) {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: 'base64',
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
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Uploads a local video URI to Supabase Storage and returns the public URL.
 * Uses FileSystem.uploadAsync + a signed URL — the only reliable method
 * for large files in React Native (fetch blob silently uploads 0 bytes).
 */
export async function uploadVideo(localUri, path) {
  const ext      = localUri.split('.').pop()?.toLowerCase() ?? 'mp4';
  const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

  // Get a one-time signed upload URL from Supabase
  const { data: signedData, error: signError } = await supabase.storage
    .from('avatars')
    .createSignedUploadUrl(path);
  if (signError) throw signError;

  // Stream the file directly — no base64, no memory issues
  const result = await FileSystem.uploadAsync(signedData.signedUrl, localUri, {
    httpMethod:  'PUT',
    headers:     { 'Content-Type': mimeType },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Video upload failed: ${result.status}`);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
