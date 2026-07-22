import Link from 'next/link';
import { Member, Match, posLabel, num, resultFor, opponentOf, scorersFor, CLUB } from '@/lib/ea';
import { impact } from '@/lib/analytics';

// ── nav ──────────────────────────────────────────────────────────
export function Nav({ active }: { active: string }) {
  const links = [
    ['/', 'Index'],
    ['/squad', 'Squad'],
    ['/matches', 'Results'],
    ['/clips', 'Clips'],
  ] as const;
  return (
    <div className="nav">
      <div className="nav-in">
        <Link href="/" className="wm">Stolio Goalio</Link>
        <div className="links">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={active === href ? 'on' : ''}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── footer ───────────────────────────────────────────────────────
export function Footer() {
  return (
    <footer className="footer">
      <Link href="/" className="giant" style={{ display: 'block' }}>
        Stolio<br />Goalio
      </Link>
      <div className="meta">
        <span className="mono dim">Live off the EA Sports FC 26 Pro Clubs wire</span>
        <span className="mono dim">Div — · Gen5 · Est. 2026</span>
      </div>
    </footer>
  );
}

// ── results ticker (marquee, server-rendered from live matches) ──
export function Ticker({ matches }: { matches: Match[] }) {
  const items = matches
    .map((m) => {
      const res = resultFor(m, CLUB.id);
      const me = m.clubs[CLUB.id];
      const opp = opponentOf(m, CLUB.id);
      if (!res || !me) return null;
      return { id: m.matchId, res, s: `${me.goals}–${me.goalsAgainst}`, opp: opp?.details?.name ?? '?' };
    })
    .filter(Boolean) as { id: string; res: string; s: string; opp: string }[];

  if (!items.length) return null;
  const row = (key: string) => (
    <div style={{ display: 'flex' }} key={key} aria-hidden={key === 'b'}>
      {items.map((it) => (
        <span className="tick-item" key={key + it.id}>
          <span className={`r ${it.res}`} />
          <b>{it.s}</b> v {it.opp}
        </span>
      ))}
    </div>
  );
  return (
    <div className="tickline">
      <div className="tick-track">{row('a')}{row('b')}</div>
    </div>
  );
}

// ── squad index list ─────────────────────────────────────────────
// Ranked by the impact algorithm — position-weighted, per-game, recency-safe.
export function SquadIndex({ members, limit }: { members: Member[]; limit?: number }) {
  const roster = [...members]
    .map((m) => ({ m, imp: impact(m) }))
    .sort((a, b) => b.imp - a.imp || num(b.m.gamesPlayed) - num(a.m.gamesPlayed))
    .slice(0, limit ?? members.length);
  return (
    <div className="index">
      {roster.map(({ m, imp }, i) => (
        <Link key={m.name} href={`/player/${encodeURIComponent(m.name)}`} className="idx-row">
          <span className="no">{String(i + 1).padStart(2, '0')}</span>
          <span className="nm">{m.name}</span>
          <span className="meta">
            <span className="cell"><b>{posLabel(m.proPos)}</b><span>pos</span></span>
            <span className="cell"><b>{num(m.goals)}</b><span>gls</span></span>
            <span className="cell"><b>{num(m.assists)}</b><span>ast</span></span>
            <span className="cell"><b>{m.ratingAve || '—'}</b><span>avg</span></span>
            <span className="cell"><b>{imp || '—'}</b><span>imp</span></span>
          </span>
        </Link>
      ))}
      {!roster.length && <div className="empty">No squad data on the wire — reload in a moment</div>}
    </div>
  );
}

// ── result rows ──────────────────────────────────────────────────
export function ResultRows({ matches, limit }: { matches: Match[]; limit?: number }) {
  const rows = matches.slice(0, limit ?? matches.length);
  return (
    <div style={{ borderTop: '1px solid var(--hair)' }}>
      {rows.map((m) => {
        const res = resultFor(m, CLUB.id);
        const me = m.clubs[CLUB.id];
        const opp = opponentOf(m, CLUB.id);
        if (!res || !me) return null;
        const scorers = scorersFor(m, CLUB.id).filter((s) => s.goals > 0);
        return (
          <Link className="res-row" key={m.matchId} href={`/match/${encodeURIComponent(m.matchId)}`}>
            <span className={`tag ${res}`}>{res === 'W' ? 'Win' : res === 'L' ? 'Loss' : 'Draw'}</span>
            <span className="opp">
              {opp?.details?.name || 'Unknown'}
              <small>
                {scorers.length
                  ? scorers.map((s) => `${s.name}${s.goals > 1 ? ` ×${s.goals}` : ''}`).join(' · ')
                  : opp?.details?.customKit?.stadName || '—'}
              </small>
            </span>
            <div style={{ textAlign: 'right' }}>
              <span className="sc">{me.goals}–{me.goalsAgainst}</span>
              <div className="when">
                {m.timeAgo ? `${m.timeAgo.number} ${m.timeAgo.unit} ago` : ''} · report →
              </div>
            </div>
          </Link>
        );
      })}
      {!rows.length && <div className="empty">No results on the wire yet</div>}
    </div>
  );
}

// ── printed sparkline ────────────────────────────────────────────
export function Spark({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data);
  const w = 10, gap = 6, h = 44;
  return (
    <svg className="spark" width={data.length * (w + gap)} height={h}
      viewBox={`0 0 ${data.length * (w + gap)} ${h}`} aria-hidden>
      {data.map((v, i) => {
        const bh = Math.max(2, (v / max) * h);
        return (
          <rect key={i} className={v > 0 ? 'on' : 'off'}
            x={i * (w + gap)} y={h - bh} width={w} height={bh} />
        );
      })}
    </svg>
  );
}
