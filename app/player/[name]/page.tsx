import Link from 'next/link';
import {
  getMembers, getRecentMatches, playerGameLog, resultFor, opponentOf, posLabel, num, prevGoalsSeries, CLUB,
} from '@/lib/ea';
import { Nav, Footer, Spark } from '@/components/bits';
import { Counter, Reveal, BarRow } from '@/components/fx';
import { impact, squadPercentiles, playerForm } from '@/lib/analytics';

export const revalidate = 45;

export default async function Player({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const [members, recent] = await Promise.all([getMembers(), getRecentMatches(24)]);
  const roster = [...members].sort(
    (a, b) => num(b.gamesPlayed) - num(a.gamesPlayed) || num(b.ratingAve) - num(a.ratingAve),
  );
  const idx = roster.findIndex((x) => x.name === name);
  const m = idx >= 0 ? roster[idx] : undefined;

  if (!m) {
    return (
      <>
        <Nav active="/squad" />
        <div className="empty" style={{ paddingTop: '40vh' }}>
          “{name}” isn’t on the current squad list —{' '}
          <Link href="/squad" style={{ color: 'var(--accent)' }}>back to the squad</Link>
        </div>
      </>
    );
  }

  const gp = num(m.gamesPlayed), goals = num(m.goals), assists = num(m.assists);
  const no = String(idx + 1).padStart(2, '0');

  // analytics — computed against the current squad, fresh each load
  const imp = impact(m);
  const pct = squadPercentiles(m, members);
  const form = playerForm(prevGoalsSeries(m));
  const log = playerGameLog(name, recent);

  return (
    <>
      <Nav active="/squad" />

      <header className="pl-hero">
        <div className="watermark" aria-hidden>{no}</div>
        <div className="mono acc" style={{ marginBottom: 18 }}>
          {posLabel(m.proPos)} · pro “{m.proName || '—'}” · OVR {num(m.proOverall) || '—'}
        </div>
        <h1>
          {m.name}<em>.</em>
        </h1>
        <div className="pl-vitals">
          <div className="cell"><span className="mono dim">Apps</span><b><Counter value={gp} /></b></div>
          <div className="cell"><span className="mono dim">Goals</span><b><Counter value={goals} /></b></div>
          <div className="cell"><span className="mono dim">Assists</span><b><Counter value={assists} /></b></div>
          <div className="cell"><span className="mono dim">Avg rating</span><b>{m.ratingAve || '—'}</b></div>
          <div className="cell"><span className="mono dim">MOTM</span><b><Counter value={num(m.manOfTheMatch)} /></b></div>
          <div className="cell"><span className="mono dim">Height</span><b>{num(m.proHeight)}cm</b></div>
        </div>
      </header>

      <main className="surface">
        {/* the algorithm's verdict */}
        <section className="sect">
          <div className="sect-head">
            <h2>Index</h2>
            <span className="idx">01 · position-weighted algorithm</span>
          </div>
          <div className="numbers" style={{ marginTop: 0 }}>
            <Reveal className="numcell">
              <div className="v"><Counter value={imp} /><sub>/99</sub></div>
              <div className="k mono dim">Impact rating · squad rank #{idx + 1}</div>
            </Reveal>
            <Reveal delay={1} className="numcell">
              <div className="v"><Counter value={form} /><sub>/100</sub></div>
              <div className="k mono dim">Scoring form · recency-weighted last 10</div>
            </Reveal>
            <Reveal delay={2} className="numcell">
              <div className="v"><Counter value={goals + assists ? Math.round((goals / (goals + assists)) * 100) : 0} /><sub>%</sub></div>
              <div className="k mono dim">Finisher share of own G+A</div>
            </Reveal>
            <Reveal delay={3} className="numcell">
              <div className="v"><Counter value={gp ? Math.round((num(m.manOfTheMatch) / gp) * 100) : 0} /><sub>%</sub></div>
              <div className="k mono dim">MOTM rate per appearance</div>
            </Reveal>
          </div>
        </section>

        {/* percentile vs the squad */}
        <section className="sect" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sect-head" style={{ margin: '0 var(--gutter)' }}>
            <h2>vs the squad</h2>
            <span className="idx">02 · percentile</span>
          </div>
          <div className="bars" style={{ borderTop: '1px solid var(--hair)' }}>
            <BarRow label="Scoring / game" pct={pct.scoring} />
            <BarRow label="Creating / game" pct={pct.creating} />
            <BarRow label="Match rating" pct={pct.rating} />
            <BarRow label="Winning" pct={pct.winning} />
            <BarRow label="Passing" pct={pct.passing} />
            <BarRow label="Defending / game" pct={pct.defending} />
          </div>
        </section>

        <section className="sect" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sect-head" style={{ margin: '0 var(--gutter)' }}>
            <h2>Accuracy</h2>
            <span className="idx">03</span>
          </div>
          <div className="bars" style={{ borderTop: '1px solid var(--hair)' }}>
            <BarRow label="Passing" pct={num(m.passSuccessRate)} />
            <BarRow label="Shooting" pct={num(m.shotSuccessRate)} />
            <BarRow label="Tackling" pct={num(m.tackleSuccessRate)} />
            <BarRow label="Games won" pct={num(m.winRate)} />
          </div>
        </section>

        <section className="sect">
          <div className="sect-head">
            <h2>Output</h2>
            <span className="idx">04</span>
          </div>
          <div className="numbers">
            <Reveal className="numcell">
              <div className="v">{gp ? ((goals + assists) / gp).toFixed(2) : '0.00'}</div>
              <div className="k mono dim">G+A per game</div>
            </Reveal>
            <Reveal delay={1} className="numcell">
              <div className="v"><Counter value={gp ? Math.round(num(m.passesMade) / gp) : 0} /></div>
              <div className="k mono dim">Passes per game</div>
            </Reveal>
            <Reveal delay={2} className="numcell">
              <div className="v"><Counter value={gp ? Math.round(num(m.tacklesMade) / gp) : 0} /></div>
              <div className="k mono dim">Tackles per game</div>
            </Reveal>
            <Reveal delay={3} className="numcell">
              <div className="v"><Counter value={num(m.redCards)} /></div>
              <div className="k mono dim">Red cards</div>
            </Reveal>
          </div>
          <div style={{ padding: '48px 0 0' }}>
            <div className="mono dim" style={{ marginBottom: 16 }}>
              Goals — last {prevGoalsSeries(m).length} matches
            </div>
            <Spark data={prevGoalsSeries(m)} />
          </div>
        </section>

        {/* per-game match log */}
        {log.length > 0 && (
          <section className="section" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="sec-head" style={{ margin: '0 var(--gutter)' }}>
              <div>
                <span className="kicker">Every appearance</span>
                <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>Match log</h2>
              </div>
            </div>
            <div className="glog-head">
              <span className="l">Res</span><span className="l">Opponent</span><span>Score</span>
              <span>G</span><span>A</span><span>Rat</span>
            </div>
            <div className="glog">
              {log.map(({ m: mm, line }) => {
                const res = resultFor(mm, CLUB.id);
                const meC = mm.clubs[CLUB.id];
                const opp = opponentOf(mm, CLUB.id);
                const g = num(line.goals), a = num(line.assists);
                if (!res || !meC) return null;
                return (
                  <Link key={mm.matchId} href={`/match/${encodeURIComponent(mm.matchId)}`} className="glog-row">
                    <span className={`rz ${res}`}>{res}</span>
                    <span className="vs">
                      {opp?.details?.name || 'Unknown'}
                      <small style={{ display: 'block' }}>
                        {mm.timeAgo ? `${mm.timeAgo.number} ${mm.timeAgo.unit} ago` : ''}
                        {line.mom === '1' ? ' · ★ MOTM' : ''}
                      </small>
                    </span>
                    <span className="sc2">{meC.goals}–{meC.goalsAgainst}</span>
                    <span className={`st2 ${g === 0 ? 'zero' : ''}`}>{g}</span>
                    <span className={`st2 ${a === 0 ? 'zero' : ''}`}>{a}</span>
                    <span className="st2 rat">{line.rating}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <Footer />
      </main>
    </>
  );
}
