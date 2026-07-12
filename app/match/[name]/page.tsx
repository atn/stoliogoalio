import Link from 'next/link';
import {
  getMatchById, resultFor, opponentOf, opponentId, matchLineup, scorersFor,
  num, CLUB, MatchPlayer,
} from '@/lib/ea';
import { Nav, Footer } from '@/components/bits';

export const revalidate = 45;

// route param is the matchId
export default async function MatchPage({ params }: { params: { name: string } }) {
  const id = decodeURIComponent(params.name);
  const m = await getMatchById(id);

  if (!m) {
    return (
      <>
        <Nav active="/matches" />
        <div className="empty" style={{ margin: '30vh var(--gutter)' }}>
          This match isn’t in the current window — <Link href="/matches" style={{ color: 'var(--accent)' }}>back to results</Link>
        </div>
      </>
    );
  }

  const res = resultFor(m, CLUB.id);
  const me = m.clubs[CLUB.id];
  const opp = opponentOf(m, CLUB.id);
  const oppId = opponentId(m, CLUB.id);
  const clubName = me?.details?.name || CLUB.name;
  const gf = num(me?.goals), ga = num(me?.goalsAgainst);

  const ourScorers = scorersFor(m, CLUB.id);
  const ourLine = matchLineup(m, CLUB.id);
  const theirLine = oppId ? matchLineup(m, oppId) : [];

  // Man of the match — highest-rated of whichever side earned the mom flag,
  // else the top-rated player across the game.
  const everyone = [...ourLine.map((p) => ({ p, us: true })), ...theirLine.map((p) => ({ p, us: false }))];
  const flagged = everyone.filter((x) => x.p.mom === '1');
  const motm = (flagged.length ? flagged : everyone).sort((a, b) => num(b.p.rating) - num(a.p.rating))[0];

  // team totals for the head-to-head
  const sum = (line: MatchPlayer[], k: keyof MatchPlayer) =>
    line.reduce((s, p) => s + num(p[k] as string), 0);
  const avgRating = (line: MatchPlayer[]) =>
    line.length ? sum(line, 'rating') / line.length : 0;
  const h2h = [
    { lab: 'Shots', us: sum(ourLine, 'shots'), them: sum(theirLine, 'shots') },
    { lab: 'Passes', us: sum(ourLine, 'passesmade'), them: sum(theirLine, 'passesmade') },
    { lab: 'Tackles', us: sum(ourLine, 'tacklesmade'), them: sum(theirLine, 'tacklesmade') },
    { lab: 'Avg rating', us: Math.round(avgRating(ourLine) * 10) / 10, them: Math.round(avgRating(theirLine) * 10) / 10 },
  ];

  return (
    <>
      <Nav active="/matches" />

      <header className="mx-hero">
        <Link href="/matches" className="mono acc" style={{ display: 'inline-block', marginBottom: 20 }}>
          ← All results
        </Link>
        <div className="mono dim" style={{ marginBottom: 6 }}>
          {res === 'W' ? 'Win' : res === 'L' ? 'Loss' : 'Draw'} ·{' '}
          {m.timeAgo ? `${m.timeAgo.number} ${m.timeAgo.unit} ago` : ''}
          {opp?.details?.customKit?.stadName ? ` · ${opp.details.customKit.stadName}` : ''}
        </div>
        <div className="mx-scoreline">
          <div className="team us">{clubName}</div>
          <div className="nums">
            <span className={gf >= ga ? 'w' : 'l'}>{gf}</span>
            <span className="sep">/</span>
            <span className={ga > gf ? 'w' : 'l'}>{ga}</span>
          </div>
          <div className="team them">{opp?.details?.name || 'Unknown'}</div>
        </div>

        {ourScorers.length > 0 && (
          <div className="mx-goals">
            {ourScorers.filter((s) => s.goals > 0).map((s) => (
              <span className="g" key={s.name}>
                <span className="ball">⚽ {s.goals > 1 ? `×${s.goals}` : ''}</span>
                <Link href={`/player/${encodeURIComponent(s.name)}`}>{s.name}</Link>
              </span>
            ))}
            {ourScorers.filter((s) => s.assists > 0).map((s) => (
              <span className="g" key={s.name + 'a'}>
                <small>assist{s.assists > 1 ? ` ×${s.assists}` : ''}</small>
                <Link href={`/player/${encodeURIComponent(s.name)}`}>{s.name}</Link>
              </span>
            ))}
          </div>
        )}
      </header>

      <main className="surface" style={{ marginTop: 10 }}>
        {/* Man of the match */}
        {motm && (
          <div className="mx-motm">
            <span className="star">★</span>
            <div className="who">
              <div className="lbl">Man of the match</div>
              <div className="nm">
                {motm.us ? (
                  <Link href={`/player/${encodeURIComponent(motm.p.playername)}`}>{motm.p.playername}</Link>
                ) : (
                  motm.p.playername
                )}
              </div>
              <div className="sub">
                {motm.us ? clubName : opp?.details?.name} · {motm.p.pos} · {num(motm.p.goals)} G · {num(motm.p.assists)} A · {num(motm.p.shots)} shots
              </div>
            </div>
            <div className="big">{motm.p.rating}</div>
          </div>
        )}

        {/* head-to-head */}
        <section className="section" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 'clamp(48px,7vh,90px)' }}>
          <div className="sec-head" style={{ margin: '0 var(--gutter)' }}>
            <div>
              <span className="kicker">Head to head</span>
              <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>The tale of the tape</h2>
            </div>
          </div>
          <div className="h2h">
            {h2h.map((r) => {
              const total = r.us + r.them || 1;
              return (
                <div className="h2h-row" key={r.lab}>
                  <div className="top">
                    <b className="us">{r.us}</b>
                    <span className="lab">{r.lab}</span>
                    <b>{r.them}</b>
                  </div>
                  <div className="track">
                    <i className="us" style={{ width: `${(r.us / total) * 100}%` }} />
                    <i className="them" style={{ width: `${(r.them / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* full box scores */}
        <section className="section" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sec-head" style={{ margin: '0 var(--gutter)' }}>
            <div>
              <span className="kicker">Every player · every stat</span>
              <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>Box score</h2>
            </div>
          </div>
          <div className="mx-teams">
            <TeamSheet title={clubName} us players={ourLine} />
            <TeamSheet title={opp?.details?.name || 'Opponent'} players={theirLine} />
          </div>
        </section>
        <Footer />
      </main>
    </>
  );
}

function TeamSheet({ title, players, us }: { title: string; players: MatchPlayer[]; us?: boolean }) {
  return (
    <div className="mx-team">
      <div className="mx-team-head">
        <span className={`nm ${us ? 'us' : ''}`}>{title}</span>
        <span className="mono dim">{players.length} played</span>
      </div>
      <div className="mx-line head">
        <span className="who">Player</span>
        <span>G</span><span>A</span><span>SH</span><span>RAT</span>
      </div>
      {players.map((p) => {
        const g = num(p.goals), a = num(p.assists), sh = num(p.shots);
        const mom = p.mom === '1';
        const cell = (v: number, extra = '') =>
          <span className={`st ${v === 0 ? 'zero' : ''} ${extra}`}>{v}</span>;
        return (
          <div key={p.playername} className={`mx-line ${g > 0 ? 'scorer' : ''} ${mom ? 'mom-row' : ''}`}>
            <span className="who">
              <div className="nm2">
                {us ? <Link href={`/player/${encodeURIComponent(p.playername)}`}>{p.playername}</Link> : p.playername}
              </div>
              <div className="pos2">
                {p.pos}
                {num(p.passattempts) > 0 && ` · ${num(p.passesmade)}/${num(p.passattempts)} pass`}
                {num(p.tacklesmade) > 0 && ` · ${num(p.tacklesmade)} tkl`}
                {num(p.saves) > 0 && ` · ${num(p.saves)} saves`}
                {num(p.redcards) > 0 && ` · 🟥`}
              </div>
            </span>
            {cell(g)}
            {cell(a)}
            {cell(sh)}
            <span className="st rat">{p.rating}</span>
          </div>
        );
      })}
      {!players.length && <div className="mono dim" style={{ padding: '18px var(--gutter)' }}>No player data recorded</div>}
    </div>
  );
}
