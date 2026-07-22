// ─────────────────────────────────────────────────────────────────────────
//  Client-side video compression via ffmpeg.wasm (single-threaded core, so
//  it needs no COOP/COEP cross-origin-isolation headers). The core (~32 MB)
//  loads from a CDN on first use and is cached by the browser thereafter.
//  We target a byte budget and back out a video bitrate from the duration,
//  downscale to ≤720p, and encode H.264/AAC MP4 with ultrafast for speed.
// ─────────────────────────────────────────────────────────────────────────

const FFMPEG_VER = '0.12.15';
const CORE_VER = '0.12.10';
const CORE_ST = `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/esm`;
const CORE_MT = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VER}/dist/esm`;
const WORKER_URL = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VER}/dist/esm/worker.js`;

// Multi-threaded encoding (~4-8× faster) needs SharedArrayBuffer, which the
// browser only grants when the page is cross-origin isolated (COOP/COEP — set
// on /clips in next.config). Everywhere else we fall back to the single core.
export function canMultithread(): boolean {
  return typeof globalThis !== 'undefined' && (globalThis as any).crossOriginIsolated === true;
}

// Compress anything larger than this; smaller files upload untouched.
export const TARGET_BYTES = 45 * 1024 * 1024; // ~45 MiB — safely under the 50 MiB cap
// Refuse absurd source files up front — ffmpeg.wasm loads the whole file into
// wasm memory and would crash the tab well before this.
export const SOURCE_MAX_BYTES = 500 * 1024 * 1024;

export type Stage = 'loading' | 'compressing';

let _ffmpeg: any | null = null;

async function getFFmpeg(onLog?: (m: string) => void) {
  if (_ffmpeg) return _ffmpeg;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const ff = new FFmpeg();
  if (onLog) ff.on('log', ({ message }: { message: string }) => onLog(message));

  const mt = canMultithread();
  const base = mt ? CORE_MT : CORE_ST;
  const load: Record<string, string> = {
    classWorkerURL: await toBlobURL(WORKER_URL, 'text/javascript'),
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  };
  if (mt) {
    load.workerURL = await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript');
  }
  await ff.load(load as any);
  _ffmpeg = ff;
  return ff;
}

// Read a video's duration (seconds) without decoding the whole thing.
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const url = URL.createObjectURL(file);
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(0);
    v.src = url;
  });
}

function extOf(file: File): string {
  const dot = file.name.lastIndexOf('.');
  const ext = (dot >= 0 ? file.name.slice(dot + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext || 'mp4';
}

export type CompressOpts = {
  targetBytes?: number;
  onStage?: (s: Stage) => void;
  onProgress?: (ratio: number) => void; // 0..1 during compression
};

// Returns a new MP4 File compressed to roughly targetBytes, or throws.
export async function compressVideo(file: File, opts: CompressOpts = {}): Promise<File> {
  const target = opts.targetBytes ?? TARGET_BYTES;
  opts.onStage?.('loading');
  const ff = await getFFmpeg();

  const duration = await readDuration(file);
  // Budget the bitrate from the target size and duration. Fall back to a
  // conservative default when duration can't be read.
  const audioKbps = 96;
  let videoKbps: number;
  if (duration > 0) {
    const totalKbps = (target * 8) / duration / 1000;
    videoKbps = Math.max(250, Math.floor((totalKbps - audioKbps) * 0.95));
  } else {
    videoKbps = 2500;
  }
  const maxKbps = Math.floor(videoKbps * 1.45);
  const bufKbps = Math.floor(videoKbps * 2);

  const { fetchFile } = await import('@ffmpeg/util');
  const inName = `in.${extOf(file)}`;
  const outName = 'out.mp4';
  await ff.writeFile(inName, await fetchFile(file));

  opts.onStage?.('compressing');
  if (opts.onProgress) {
    ff.on('progress', ({ progress }: { progress: number }) => {
      const r = Math.max(0, Math.min(1, progress));
      opts.onProgress!(r);
    });
  }

  await ff.exec([
    '-i', inName,
    // downscale to ≤720p, keep aspect, force even width
    '-vf', "scale=-2:'min(720,ih)'",
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-b:v', `${videoKbps}k`,
    '-maxrate', `${maxKbps}k`,
    '-bufsize', `${bufKbps}k`,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', `${audioKbps}k`,
    '-movflags', '+faststart',
    '-y', outName,
  ]);

  const data = await ff.readFile(outName);
  await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile(outName).catch(() => {});

  const bytes = (data as Uint8Array);
  const base = file.name.replace(/\.[^.]+$/, '') || 'clip';
  return new File([bytes], `${base}.mp4`, { type: 'video/mp4' });
}
