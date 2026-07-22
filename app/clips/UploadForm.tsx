'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { createUpload, finalizeClip } from './actions';
import { compressVideo, TARGET_BYTES, SOURCE_MAX_BYTES } from '@/lib/compress';

const MAX_BYTES = 52_428_800; // 50 MiB — the hard storage cap (final file)
const ALLOWED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

function mb(bytes: number) {
  return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0);
}

// Anon client — only used to push the file to the pre-signed upload URL.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type State = 'idle' | 'working' | 'done' | 'error';

export default function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<State>('idle');
  const [msg, setMsg] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    let file = fileRef.current?.files?.[0];
    if (!file) return fail('Choose a video file first.');
    if (!file.type.startsWith('video/')) return fail('That’s not a video file.');
    if (file.size > SOURCE_MAX_BYTES) return fail(`That file is huge (${mb(file.size)} MB). Trim it below 500 MB first.`);
    if (!password) return fail('Enter the upload password.');

    setState('working');

    // Compress client-side when the file is over budget or not an accepted
    // container. The result is always an MP4 comfortably under the cap.
    const needsCompress = file.size > TARGET_BYTES || !ALLOWED.includes(file.type);
    if (needsCompress) {
      try {
        const original = file.size;
        file = await compressVideo(file, {
          onStage: (s) =>
            setMsg(s === 'loading' ? 'Loading compressor (first time is slow)…' : 'Compressing… 0%'),
          onProgress: (r) => setMsg(`Compressing… ${Math.round(r * 100)}%`),
        });
        if (file.size > MAX_BYTES) {
          return fail(`Still ${mb(file.size)} MB after compressing — try a shorter clip.`);
        }
        setMsg(`Compressed ${mb(original)} → ${mb(file.size)} MB. Uploading…`);
      } catch (err) {
        return fail('Couldn’t compress that video. Try a different file or a shorter clip.');
      }
    } else {
      setMsg('Preparing upload…');
    }

    const start = await createUpload({
      password,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
    if (!start.ok) return fail(start.error);

    if (!needsCompress) setMsg('Uploading…');
    const up = await supabase.storage
      .from('clips')
      .uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
    if (up.error) return fail('Upload failed — check your connection and try again.');

    setMsg('Saving…');
    const fin = await finalizeClip({
      password,
      path: start.path,
      title,
      author,
      contentType: file.type,
      size: file.size,
    });
    if (!fin.ok) return fail(fin.error);

    setState('done');
    setMsg('Posted. Nice one.');
    setTitle('');
    setAuthor('');
    if (fileRef.current) fileRef.current.value = '';
    router.refresh();
  }

  function fail(m: string) {
    setState('error');
    setMsg(m);
  }

  const busy = state === 'working';

  return (
    <form className="clip-form" onSubmit={onSubmit}>
      <div className="clip-form-grid">
        <label className="clip-field">
          <span className="mono dim">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="30-yard screamer vs. Real"
            maxLength={120}
            disabled={busy}
          />
        </label>
        <label className="clip-field">
          <span className="mono dim">Your name (optional)</span>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Anon"
            maxLength={60}
            disabled={busy}
          />
        </label>
        <label className="clip-field">
          <span className="mono dim">Video file · big clips are auto-compressed</span>
          <input ref={fileRef} type="file" accept="video/*" disabled={busy} />
        </label>
        <label className="clip-field">
          <span className="mono dim">Upload password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={busy}
          />
        </label>
      </div>
      <div className="clip-form-foot">
        <button type="submit" className="clip-btn" disabled={busy}>
          {busy ? 'Working…' : 'Post clip'}
        </button>
        {msg && (
          <span className={`clip-msg mono ${state === 'error' ? 'err' : state === 'done' ? 'ok' : 'dim'}`}>
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
