import { getMembers, num, CLUB } from '@/lib/ea';
import { Nav, Footer, SquadIndex } from '@/components/bits';
import { Counter, Reveal } from '@/components/fx';

export const revalidate = 45;

export default async function Squad() {
  const members = await getMembers();
  const totalGoals = members.reduce((s, m) => s + num(m.goals), 0);
  const totalAssists = members.reduce((s, m) => s + num(m.assists), 0);

  return (
    <>
      <Nav active="/squad" />

      <header className="hero" style={{ minHeight: '72svh' }}>
        <div className="hero-meta">
          <span className="mono">Squad index</span>
          <span className="mono dim">{CLUB.platform}</span>
        </div>
        <div className="hero-title-wrap">
          <h1 className="display hero-title" style={{ fontSize: 'clamp(64px, 14vw, 210px)' }}>
            <span className="ln"><span>The</span></span>
            <span className="ln"><span>Squad</span></span>
          </h1>
        </div>
        <div className="hero-sub">
          <span className="mono">{members.length} registered pros</span>
          <span className="mono dim">{totalGoals} goals · {totalAssists} assists combined</span>
        </div>
      </header>

      <main className="surface">
        <section className="sect" style={{ padding: 'clamp(48px,7vh,90px) 0 0' }}>
          <SquadIndex members={members} />
        </section>

        <section className="sect">
          <div className="sect-head">
            <h2>Combined</h2>
            <span className="idx">Σ</span>
          </div>
          <div className="numbers">
            <Reveal className="numcell">
              <div className="v"><Counter value={members.length} /></div>
              <div className="k mono dim">Pros</div>
            </Reveal>
            <Reveal delay={1} className="numcell">
              <div className="v"><Counter value={totalGoals} /></div>
              <div className="k mono dim">Goals</div>
            </Reveal>
            <Reveal delay={2} className="numcell">
              <div className="v"><Counter value={totalAssists} /></div>
              <div className="k mono dim">Assists</div>
            </Reveal>
            <Reveal delay={3} className="numcell">
              <div className="v">
                <Counter value={members.reduce((s, m) => s + num(m.manOfTheMatch), 0)} />
              </div>
              <div className="k mono dim">MOTM awards</div>
            </Reveal>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}
