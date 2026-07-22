import { Nav, Footer } from '@/components/bits';
import { listClips, publicUrl } from '@/lib/clips';
import UploadForm from './UploadForm';

export const revalidate = 0; // always show the freshest clips

function when(iso: string): string {
  const d = new Date(iso).getTime();
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function Clips() {
  const clips = await listClips();

  return (
    <>
      <Nav active="/clips" />

      <header className="hero" style={{ minHeight: '62svh' }}>
        <div className="hero-meta">
          <span className="mono">The reel</span>
          <span className="mono dim">{clips.length} clip{clips.length === 1 ? '' : 's'}</span>
        </div>
        <div className="hero-title-wrap">
          <h1 className="display hero-title" style={{ fontSize: 'clamp(64px, 14vw, 210px)' }}>
            <span className="ln"><span>The</span></span>
            <span className="ln"><span>Clips</span></span>
          </h1>
        </div>
      </header>

      <main className="surface">
        <section className="sect" style={{ padding: 'clamp(48px,7vh,90px) var(--gutter) 0' }}>
          <div className="sect-head">
            <h2>The reel</h2>
            <span className="idx">▶</span>
          </div>
          {clips.length ? (
            <div className="clip-grid">
              {clips.map((c) => (
                <figure className="clip-card" key={c.id}>
                  <video
                    className="clip-video"
                    controls
                    preload="metadata"
                    playsInline
                    src={publicUrl(c.storage_path)}
                  />
                  <figcaption className="clip-cap">
                    <span className="clip-title">{c.title}</span>
                    <span className="mono dim">
                      {c.author ? `${c.author} · ` : ''}{when(c.created_at)}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="empty">No clips on the reel yet — be the first.</div>
          )}

          <details className="clip-post">
            <summary className="clip-post-head">
              <span>Post a clip</span>
              <span className="clip-post-mark" aria-hidden>+</span>
            </summary>
            <UploadForm />
          </details>
        </section>

        <Footer />
      </main>
    </>
  );
}
