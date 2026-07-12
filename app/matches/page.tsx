import { getRecentMatches, getClubRow, resultFor, num, CLUB } from '@/lib/ea';
import { Nav, Footer, ResultRows, Ticker } from '@/components/bits';
import { Counter, Reveal } from '@/components/fx';
import LiveCenter from '@/components/LiveCenter';

export const revalidate = 45;

export default async function Matches() {
  const [matches, row] = await Promise.all([getRecentMatches(24), getClubRow()]);
  const clubName = row?.clubName || CLUB.name;

  let w = 0, l = 0, d = 0, gf = 0, ga = 0;
  for (const m of matches) {
    const res = resultFor(m, CLUB.id);
    const me = m.clubs[CLUB.id];
    if (!res || !me) continue;
    if (res === 'W') w++; else if (res === 'L') l++; else d++;
    gf += num(me.goals); ga += num(me.goalsAgainst);
  }

  return (
    <>
      <Nav active="/matches" />

      <header className="hero" style={{ minHeight: '72svh' }}>
        <div className="hero-meta">
          <span className="mono">Results wire</span>
          <span className="mono dim">last {matches.length} fixtures</span>
        </div>
        <div className="hero-title-wrap">
          <h1 className="display hero-title" style={{ fontSize: 'clamp(64px, 14vw, 210px)' }}>
            <span className="ln"><span>Res—</span></span>
            <span className="ln"><span>ults</span></span>
          </h1>
        </div>
        <div>
          <div className="hero-sub">
            <div className="big-rec">{w}<em>W</em> {l}<em>L</em> {d}<em>D</em></div>
            <span className="mono dim">{gf} scored · {ga} conceded</span>
          </div>
          <Ticker matches={matches} />
        </div>
      </header>

      <main className="surface">
        <section className="sect" style={{ paddingTop: 'clamp(56px, 9vh, 110px)' }}>
          <div className="sect-head">
            <h2>Latest</h2>
            <span className="idx">Live</span>
          </div>
          <LiveCenter clubName={clubName} />
        </section>

        <section className="sect" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sect-head" style={{ margin: '0 var(--gutter)' }}>
            <h2>All fixtures</h2>
            <span className="idx">{matches.length}</span>
          </div>
          <ResultRows matches={matches} />
        </section>

        <section className="sect">
          <div className="numbers">
            <Reveal className="numcell">
              <div className="v"><Counter value={w} /></div>
              <div className="k mono dim">Won</div>
            </Reveal>
            <Reveal delay={1} className="numcell">
              <div className="v"><Counter value={l} /></div>
              <div className="k mono dim">Lost</div>
            </Reveal>
            <Reveal delay={2} className="numcell">
              <div className="v"><Counter value={d} /></div>
              <div className="k mono dim">Drawn</div>
            </Reveal>
            <Reveal delay={3} className="numcell">
              <div className="v"><Counter value={gf - ga < 0 ? -(gf - ga) : gf - ga} />{gf - ga < 0 ? <sub>−GD</sub> : <sub>+GD</sub>}</div>
              <div className="k mono dim">Goal difference</div>
            </Reveal>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}
