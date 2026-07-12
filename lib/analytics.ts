// ─────────────────────────────────────────────────────────────────────
//  Analytics engine — pure algorithms over the live EA data.
//  Nothing here is stored; every score recomputes from the wire.
// ─────────────────────────────────────────────────────────────────────
import { Match, Member, Res, resultFor, num, CLUB } from './ea';

// ── MOMENTUM ─────────────────────────────────────────────────────────
// Exponentially-weighted points from recent results (newest weighs most,
// decay 0.85/match), normalised to 0–100. 100 = winning everything lately.
export interface Momentum {
  score: number;
  ppg: number;
  trend: 'up' | 'down' | 'flat';
}
export function momentum(matches: Match[]): Momentum {
  const pts: number[] = matches
    .map((m) => resultFor(m, CLUB.id))
    .filter(Boolean)
    .map((r) => (r === 'W' ? 3 : r === 'D' ? 1 : 0));
  if (!pts.length) return { score: 0, ppg: 0, trend: 'flat' };

  let sum = 0, wsum = 0;
  pts.forEach((p, i) => {
    const w = Math.pow(0.85, i);
    sum += p * w;
    wsum += w;
  });
  const score = Math.round(((sum / wsum) / 3) * 100);
  const ppg = pts.reduce((a, b) => a + b, 0) / pts.length;

  // trend: recent half vs prior half of the window
  const half = Math.max(1, Math.floor(pts.length / 2));
  const recent = pts.slice(0, half);
  const prior = pts.slice(half);
  const rAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const pAvg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : rAvg;
  const trend = rAvg - pAvg > 0.25 ? 'up' : pAvg - rAvg > 0.25 ? 'down' : 'flat';

  return { score, ppg: Math.round(ppg * 100) / 100, trend };
}

// ── STREAKS ──────────────────────────────────────────────────────────
export function streaks(matches: Match[]) {
  const rs = matches.map((m) => resultFor(m, CLUB.id)).filter(Boolean) as Res[];
  let current = 0;
  const type: Res | null = rs[0] ?? null;
  for (const r of rs) {
    if (r === type) current++;
    else break;
  }
  let unbeaten = 0;
  for (const r of rs) {
    if (r !== 'L') unbeaten++;
    else break;
  }
  let bestWin = 0, run = 0;
  for (const r of [...rs].reverse()) {
    run = r === 'W' ? run + 1 : 0;
    bestWin = Math.max(bestWin, run);
  }
  return { type, current, unbeaten, bestWin };
}

// ── SESSIONS ─────────────────────────────────────────────────────────
// Matches within 3h of each other = one sitting. Returns the last session.
export function lastSession(matches: Match[]) {
  if (!matches.length) return null;
  const GAP = 3 * 3600;
  const sess: Match[] = [matches[0]];
  for (let i = 1; i < matches.length; i++) {
    if (sess[sess.length - 1].timestamp - matches[i].timestamp <= GAP) sess.push(matches[i]);
    else break;
  }
  let w = 0, l = 0, d = 0, gf = 0, ga = 0;
  for (const m of sess) {
    const r = resultFor(m, CLUB.id);
    const me = m.clubs[CLUB.id];
    if (!r || !me) continue;
    if (r === 'W') w++; else if (r === 'L') l++; else d++;
    gf += num(me.goals); ga += num(me.goalsAgainst);
  }
  return { games: sess.length, w, l, d, gf, ga, endedAt: sess[0].timestamp };
}

// ── SCORELINE DISTRIBUTION ───────────────────────────────────────────
export function commonScoreline(matches: Match[]): { line: string; times: number } | null {
  const tally = new Map<string, number>();
  for (const m of matches) {
    const me = m.clubs[CLUB.id];
    if (!me) continue;
    const key = `${me.goals}–${me.goalsAgainst}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let best: { line: string; times: number } | null = null;
  tally.forEach((times, line) => {
    if (!best || times > best.times) best = { line, times };
  });
  return best;
}

// ── IMPACT RATING ────────────────────────────────────────────────────
// A position-weighted composite (0–99, FIFA-style floor of 40).
// Attackers score on output, defenders on duels/clean sheets, keepers on
// shutouts — everyone on rating, wins and MOTM rate. Per-game, so bench
// players aren't punished for low totals.
type Bucket = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';

const WEIGHTS: Record<Bucket, Record<string, number>> = {
  forward:    { g: 0.34, a: 0.16, rating: 0.20, motm: 0.10, win: 0.10, pass: 0.05, tackle: 0.05 },
  midfielder: { g: 0.20, a: 0.26, rating: 0.20, motm: 0.10, win: 0.10, pass: 0.09, tackle: 0.05 },
  defender:   { g: 0.06, a: 0.10, rating: 0.24, motm: 0.10, win: 0.14, pass: 0.12, tackle: 0.24 },
  goalkeeper: { cs: 0.36, rating: 0.28, win: 0.20, motm: 0.16 },
};

function bucketOf(m: Member): Bucket {
  const fav = (m.favoritePosition || '').toLowerCase();
  if (fav.includes('goal')) return 'goalkeeper';
  if (fav.includes('def')) return 'defender';
  if (fav.includes('mid')) return 'midfielder';
  return 'forward';
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function impact(m: Member): number {
  const gp = num(m.gamesPlayed);
  if (!gp) return 0;
  const b = bucketOf(m);
  const w = WEIGHTS[b];

  // normalise each signal to 0–1 against realistic per-game ceilings
  const f: Record<string, number> = {
    g: clamp01(num(m.goals) / gp / 1.1),
    a: clamp01(num(m.assists) / gp / 0.9),
    rating: clamp01((num(m.ratingAve) - 5.0) / 3.5), // 5.0 → 0, 8.5 → 1
    motm: clamp01(num(m.manOfTheMatch) / gp / 0.4),
    win: clamp01(num(m.winRate) / 100),
    pass: clamp01((num(m.passSuccessRate) - 50) / 45),
    tackle: clamp01(num(m.tackleSuccessRate) / 90),
    cs: clamp01(num(m.cleanSheetsGK) / gp / 0.5),
  };

  let score = 0;
  for (const [k, weight] of Object.entries(w)) score += (f[k] ?? 0) * weight;

  // small-sample smoothing: shrink toward a neutral 0.45 when GP is low,
  // so two hot games don't out-rank a season of graft
  const confidence = clamp01(gp / 10);
  score = clamp01(confidence * score + (1 - confidence) * 0.45);

  return Math.round(40 + score * 59); // 40–99
}

// ── PERCENTILES vs the squad ─────────────────────────────────────────
export function percentile(value: number, all: number[]): number {
  if (all.length <= 1) return 50;
  const below = all.filter((v) => v < value).length;
  const equal = all.filter((v) => v === value).length;
  return Math.round(((below + equal * 0.5) / all.length) * 100);
}

export function squadPercentiles(m: Member, team: Member[]) {
  const played = team.filter((x) => num(x.gamesPlayed) > 0);
  const per = (f: (x: Member) => number) =>
    percentile(f(m), played.map(f));
  const gp = (x: Member) => Math.max(1, num(x.gamesPlayed));
  return {
    scoring: per((x) => num(x.goals) / gp(x)),
    creating: per((x) => num(x.assists) / gp(x)),
    rating: per((x) => num(x.ratingAve)),
    winning: per((x) => num(x.winRate)),
    passing: per((x) => num(x.passSuccessRate)),
    defending: per((x) => num(x.tacklesMade) / gp(x)),
  };
}

// ── WEIGHTED PLAYER FORM ─────────────────────────────────────────────
// Recency-weighted goals across the last-10 series EA exposes.
export function playerForm(series: number[]): number {
  if (!series.length) return 0;
  let sum = 0, wsum = 0;
  // series is oldest→newest; weight newest heaviest
  series.forEach((g, i) => {
    const w = Math.pow(1.25, i);
    sum += Math.min(g, 3) * w;
    wsum += w;
  });
  return Math.round((sum / wsum / 1.5) * 100);
}
