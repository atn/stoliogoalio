'use server';

import { revalidatePath } from 'next/cache';
import {
  admin,
  buildPath,
  uploadPassword,
  BUCKET,
  MAX_BYTES,
  ALLOWED_TYPES,
} from '@/lib/clips';

// Constant-time-ish compare to avoid trivially leaking length via timing.
function passwordOk(supplied: string): boolean {
  const expected = uploadPassword();
  if (supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export type CreateUploadResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

// Step 1 — validate the password + file, then mint a short-lived signed
// upload URL. The browser uploads straight to Storage with the returned token,
// so the large video never passes through the Worker.
export async function createUpload(input: {
  password: string;
  filename: string;
  contentType: string;
  size: number;
}): Promise<CreateUploadResult> {
  if (!passwordOk(input.password ?? '')) return { ok: false, error: 'Wrong password.' };
  if (!ALLOWED_TYPES.includes(input.contentType))
    return { ok: false, error: 'Only MP4, MOV, WebM or MKV video files are allowed.' };
  if (!input.size || input.size > MAX_BYTES)
    return { ok: false, error: 'File must be under 50 MB.' };

  const path = buildPath(input.filename);
  const { data, error } = await admin().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: 'Could not start the upload. Try again.' };
  return { ok: true, path: data.path, token: data.token };
}

export type FinalizeResult = { ok: true } | { ok: false; error: string };

// Step 2 — after the browser has uploaded the object, record its metadata.
// Password is re-checked so a stray path can't be registered without it.
export async function finalizeClip(input: {
  password: string;
  path: string;
  title: string;
  author: string;
  contentType: string;
  size: number;
}): Promise<FinalizeResult> {
  if (!passwordOk(input.password ?? '')) return { ok: false, error: 'Wrong password.' };
  const title = (input.title ?? '').trim().slice(0, 120) || 'Untitled clip';
  const author = (input.author ?? '').trim().slice(0, 60) || null;

  const { error } = await admin().from('clips').insert({
    title,
    author,
    storage_path: input.path,
    content_type: input.contentType,
    size: input.size,
  });
  if (error) {
    // Orphan cleanup: the object exists but metadata failed — remove it.
    await admin().storage.from(BUCKET).remove([input.path]).catch(() => {});
    return { ok: false, error: 'Could not save the clip. Try again.' };
  }
  revalidatePath('/clips');
  return { ok: true };
}
