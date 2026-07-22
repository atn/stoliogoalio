import { NextResponse } from 'next/server';

// Cross-origin isolate ONLY /clips so multi-threaded ffmpeg.wasm can use
// SharedArrayBuffer. COEP: credentialless keeps cross-origin <video> playback
// (from the storage host) working without needing CORP on those responses.
// (next.config `headers()` isn't applied at runtime by the Cloudflare adapter,
// so we set them in middleware, which the adapter does run.)
export function middleware() {
  const res = NextResponse.next();
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return res;
}

export const config = { matcher: '/clips' };
