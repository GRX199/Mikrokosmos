// Legacy API exposes readAsStringAsync; the new File API differs per SDK.
import * as FileSystem from 'expo-file-system/legacy';
import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import { STORAGE_BUCKET } from '@/core/constants/app';

/**
 * Image uploads + private media URLs.
 * Files live in the private `mikrokosmos-media` bucket; the UI always
 * resolves display URLs through `resolveMediaUrl` (signed URLs).
 */

/** Upload an image picked from camera/gallery; returns a storage path. */
export async function uploadImage(
  userId: string,
  uri: string,
  folder: 'meals' | 'chat'
): Promise<string | null> {
  if (!isSupabaseConfigured) return uri; // mock mode keeps the local data URI

  try {
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${folder}/${userId}/${Date.now()}.${ext}`;
    const blob = await uriToBlob(uri);
    const { error } = await getSupabase()
      .storage.from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    if (error) throw new Error(error.message);
    return path;
  } catch {
    // Uploads must never block logging — the meal/message still saves.
    return null;
  }
}

/** Turn a stored path (or mock data URI) into something an Image can show. */
export async function resolveMediaUrl(pathOrUri?: string | null): Promise<string | null> {
  if (!pathOrUri) return null;
  if (pathOrUri.startsWith('data:') || pathOrUri.startsWith('http')) return pathOrUri;
  if (!isSupabaseConfigured) return null;
  const { data } = await getSupabase()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(pathOrUri, 3600);
  return data?.signedUrl ?? null;
}

async function uriToBlob(uri: string): Promise<Blob> {
  // expo-file-system can read native file:// URIs into base64.
  if (uri.startsWith('file://')) {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return base64ToBlob(base64);
  }
  const res = await fetch(uri);
  return res.blob();
}

function base64ToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}
