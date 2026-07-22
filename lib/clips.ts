// ─────────────────────────────────────────────────────────────────────────
//  Clips — Supabase-backed video uploads (server-side only)
//  Public URL + keys live in env. The service-role key and the shared upload
//  password are server-only secrets and must never reach the browser.
// ─────────────────────────────────────────────────────────────────────────
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const BUCKET = 'clips';
export const MAX_BYTES = 52_428_800; // 50 MB — matches the bucket cap (austbase storage global limit)
export const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

export type Clip = {
  id: string;
  title: string;
  author: string | null;
  storage_path: string;
  content_type: string | null;
  size: number | null;
  created_at: string;
};

// Cloudflare Workers expose secrets on the request-time env object, not
// process.env at module load. Read them lazily so the build never throws.
function serverEnv(): Record<string, string | undefined> {
  try {
    // Worker bindings (vars + secrets) at request time. Throws during build,
    // when there is no CF context — fall through to process.env there.
    return getCloudflareContext().env as unknown as Record<string, string | undefined>;
  } catch {
    return process.env as Record<string, string | undefined>;
  }
}

export function supabaseUrl(): string {
  const env = serverEnv();
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is not configured');
  return url;
}

export function uploadPassword(): string {
  const pw = serverEnv().CLIPS_PASSWORD;
  if (!pw) throw new Error('CLIPS_PASSWORD is not configured');
  return pw;
}

// Admin client — bypasses RLS. Server actions only, after a password check.
export function admin(): SupabaseClient {
  const env = serverEnv();
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Public playback URL for a stored object (bucket is public-read).
export function publicUrl(path: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;
}

// Newest first. Returns [] on any error so the page still renders.
export async function listClips(): Promise<Clip[]> {
  try {
    const { data, error } = await admin()
      .from('clips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as Clip[];
  } catch {
    return [];
  }
}

// Build a collision-safe object path from a user filename.
export function buildPath(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = (dot >= 0 ? filename.slice(dot + 1) : 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}.${ext || 'mp4'}`;
}
