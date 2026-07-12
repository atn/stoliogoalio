import Link from 'next/link';
import {
  getClubRow, getOverall, getRecentMatches, getMembers, num, CLUB,
} from '@/lib/ea';
import { Nav, Footer, Ticker, SquadIndex, ResultRows } from '@/components/bits';
import { Reveal, Counter } from '@/components/fx';
import LiveCenter from '@/components/LiveCenter';
import { momentum, streaks, lastSession, commonScoreline } from '@/lib/analytics';

export const revalidate = 45;

export default async function Home() {
  const [row, overall, matches, members] = await Promise.all([
    getClubRow(), getOverall(), getRecentMatches(20), getMembers(),
  ]);

  if (!row) {
    return (
      <>
        <Nav active="/" />
        <div className="empty" style={{ paddingTop: '40vh' }}>
          The EA wire is down for {CLUB.name} — reload in a minute
        </div>
      </>
    );
  }

  const wins = num(row.wins), losses = num(row.losses), ties = num(row.ties);
  const gp = num(row.gamesPlayed), gf = num(row.goals), ga = num(row.goalsAgainst);
  const skill = overall ? num(overall.skillRating) : 0;
  const clubName = row.clubName || CLUB.name;
  const stadium = row.clubInfo?.customKit?.stadName || '—';

  // analytics — computed fresh from the wire every load
  const mo = momentum(matches);
  const st = streaks(matches);
  const sess = lastSession(matches);
  const common = commonScoreline(matches);
  const streakLabel = st.type ? `${st.type}${st.current}` : '—';

  return (
    <>
      <Nav active="/" />

      {/* ═══ HERO — pinned; the rest of the page slides over it ═══ */}
      <header className="hero">
        <div className="hero-meta">
          <span className="mono">FC 26 Pro Clubs — Club №{CLUB.id}</span>
          <span className="mono">Division {row.currentDivision}</span>
          <span className="mono dim">{stadium}</span>
        </div>
        <div className="hero-title-wrap">
          <h1 className="display hero-title">
            <span className="ln"><span>Stolio</span></span>
            <span className="ln"><span>Goalio</span></span>
          </h1>
        </div>
        <div>
          <div className="hero-sub">
            <div className="big-rec">
              {wins}<em>W</em> {losses}<em>L</em> {ties}<em>D</em>
            </div>
            <span className="mono">Skill rating {skill || '—'} · {members.length} pros</span>
          </div>
          <Ticker matches={matches} />
        </div>
      </header>

      {/* ═══ SURFACE ═══ */}
      <main className="surface">
        {/* latest score — live, polls the wire */}
        <section className="sect" style={{ paddingTop: 'clamp(56px, 9vh, 110px)' }}>
          <div className="sect-head">
            <h2>Latest</h2>
            <span className="idx">01</span>
          </div>
          <LiveCenter clubName={clubName} />
        </section>

        {/* season numbers */}
        <section className="sect">
          <div className="sect-head">
            <h2>Season</h2>
            <span className="idx">02</span>
          </div>
          <div className="numbers" style={{ marginTop: 0 }}>
            <Reveal className="numcell">
              <div className="v"><Counter value={gf} /></div>
              <div className="k mono dim">Goals scored</div>
            </Reveal>
            <Reveal delay={1} className="numcell">
              <div className="v"><Counter value={ga} /></div>
              <div className="k mono dim">Goals conceded</div>
            </Reveal>
            <Reveal delay={2} className="numcell">
              <div className="v"><Counter value={gp ? Math.round((wins / gp) * 100) : 0} /><sub>%</sub></div>
              <div className="k mono dim">Win rate · {gp} played</div>
            </Reveal>
            <Reveal delay={3} className="numcell">
              <div className="v"><Counter value={num(row.cleanSheets)} /></div>
              <div className="k mono dim">Clean sheets</div>
            </Reveal>
          </div>
        </section>

        {/* form engine */}
        <section className="sect">
          <div className="sect-head">
            <h2>Form</h2>
            <span className="idx">03 · computed live</span>
          </div>
          <div className="numbers" style={{ marginTop: 0 }}>
            <Reveal className="numcell">
              <div className="v"><Counter value={mo.score} /><sub>/100</sub></div>
              <div className="k mono dim">
                Momentum · trend {mo.trend === 'up' ? '↗ rising' : mo.trend === 'down' ? '↘ falling' : '→ flat'}
              </div>
            </Reveal>
            <Reveal delay={1} className="numcell">
              <div className="v"><Counter value={mo.ppg} decimals={2} /></div>
              <div className="k mono dim">Points per game · last {matches.length}</div>
            </Reveal>
            <Reveal delay={2} className="numcell">
              <div className="v">{streakLabel}</div>
              <div className="k mono dim">
                Current streak · best win run {st.bestWin} · unbeaten {st.unbeaten}
              </div>
            </Reveal>
            <Reveal delay={3} className="numcell">
              <div className="v">{sess ? `${sess.w}–${sess.l}–${sess.d}` : '—'}</div>
              <div className="k mono dim">
                Last session ({sess?.games ?? 0} games){common ? ` · most common score ${common.line}` : ''}
              </div>
            </Reveal>
          </div>
        </section>

        {/* squad index */}
        <section className="sect" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sect-head" style={{ margin: '0 var(--gutter)' }}>
            <h2>The squad</h2>
            <Link href="/squad" className="sect-more">Ranked by impact →</Link>
          </div>
          <SquadIndex members={members} limit={6} />
        </section>

        {/* results */}
        <section className="sect" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sect-head" style={{ margin: '0 var(--gutter)' }}>
            <h2>Results</h2>
            <Link href="/matches" className="sect-more">All results →</Link>
          </div>
          <ResultRows matches={matches} limit={5} />
        </section>

        <Footer />
      </main>
    </>
  );
}
